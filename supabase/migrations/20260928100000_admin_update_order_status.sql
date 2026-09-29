CREATE OR REPLACE FUNCTION public.admin_update_order_status(
  p_order_id uuid,
  p_order_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_update_order_status$
DECLARE
  v_updated_rows integer;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'admin_order_status_forbidden';
  END IF;

  IF p_order_status IS NULL OR p_order_status NOT IN (
    'pending',
    'processing',
    'shipped',
    'delivered',
    'cancelled'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'admin_order_status_invalid';
  END IF;

  UPDATE public.orders AS target_order
  SET order_status = p_order_status
  WHERE target_order.id = p_order_id;

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  IF v_updated_rows = 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'admin_order_not_found';
  END IF;
END;
$admin_update_order_status$;

ALTER FUNCTION public.admin_update_order_status(uuid, text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.admin_update_order_status(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_order_status(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_order_status(uuid, text) TO authenticated;