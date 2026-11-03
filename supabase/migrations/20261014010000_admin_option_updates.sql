BEGIN;

CREATE OR REPLACE FUNCTION public.admin_update_product_option_group(
  p_option_group_id uuid,
  p_name text,
  p_is_required boolean,
  p_sort_order integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_update_product_option_group$
DECLARE
  v_product_id uuid;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_variant_forbidden';
  END IF;

  IF p_option_group_id IS NULL
    OR p_name IS NULL OR pg_catalog.btrim(p_name) = ''
    OR p_is_required IS NULL
    OR p_sort_order IS NULL OR p_sort_order < 0
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_option_group_invalid';
  END IF;

  SELECT option_group.product_id
  INTO v_product_id
  FROM public.product_option_groups AS option_group
  WHERE option_group.id = p_option_group_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'admin_option_group_not_found';
  END IF;

  PERFORM product.id
  FROM public.products AS product
  WHERE product.id = v_product_id AND product.is_catalog IS TRUE
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'admin_catalog_product_not_found';
  END IF;

  UPDATE public.product_option_groups AS option_group
  SET name = pg_catalog.btrim(p_name),
      is_required = p_is_required,
      sort_order = p_sort_order
  WHERE option_group.id = p_option_group_id;

  RETURN p_option_group_id;
END;
$admin_update_product_option_group$;

CREATE OR REPLACE FUNCTION public.admin_update_product_option_value(
  p_option_value_id uuid,
  p_value text,
  p_sort_order integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_update_product_option_value$
DECLARE
  v_product_id uuid;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_variant_forbidden';
  END IF;

  IF p_option_value_id IS NULL
    OR p_value IS NULL OR pg_catalog.btrim(p_value) = ''
    OR p_sort_order IS NULL OR p_sort_order < 0
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_option_value_invalid';
  END IF;

  SELECT option_value.product_id
  INTO v_product_id
  FROM public.product_option_values AS option_value
  WHERE option_value.id = p_option_value_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'admin_option_value_not_found';
  END IF;

  PERFORM product.id
  FROM public.products AS product
  WHERE product.id = v_product_id AND product.is_catalog IS TRUE
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'admin_catalog_product_not_found';
  END IF;

  UPDATE public.product_option_values AS option_value
  SET value = pg_catalog.btrim(p_value),
      sort_order = p_sort_order
  WHERE option_value.id = p_option_value_id;

  RETURN p_option_value_id;
END;
$admin_update_product_option_value$;

ALTER FUNCTION public.admin_update_product_option_group(uuid, text, boolean, integer) OWNER TO postgres;
ALTER FUNCTION public.admin_update_product_option_value(uuid, text, integer) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.admin_update_product_option_group(uuid, text, boolean, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_product_option_value(uuid, text, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_update_product_option_group(uuid, text, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_product_option_value(uuid, text, integer) TO authenticated;

COMMIT;
