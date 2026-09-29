CREATE OR REPLACE FUNCTION public.admin_create_preorder_event(
  p_title text,
  p_slug text,
  p_description text,
  p_cover_image_url text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_status text
)
RETURNS public.preorder_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_create_preorder_event$
DECLARE
  v_event public.preorder_events%ROWTYPE;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_preorder_forbidden';
  END IF;

  IF p_title IS NULL OR pg_catalog.btrim(p_title) = ''
    OR p_slug IS NULL OR pg_catalog.btrim(p_slug) = ''
    OR p_status IS NULL
    OR p_status NOT IN ('draft', 'active', 'closed', 'cancelled')
    OR (p_starts_at IS NOT NULL AND p_ends_at IS NOT NULL AND p_ends_at < p_starts_at)
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_preorder_event_invalid';
  END IF;

  INSERT INTO public.preorder_events (
    title,
    slug,
    description,
    cover_image_url,
    starts_at,
    ends_at,
    status
  )
  VALUES (
    p_title,
    p_slug,
    p_description,
    p_cover_image_url,
    p_starts_at,
    p_ends_at,
    p_status
  )
  RETURNING * INTO v_event;

  RETURN v_event;
END;
$admin_create_preorder_event$;

CREATE OR REPLACE FUNCTION public.admin_update_preorder_event(
  p_event_id uuid,
  p_title text,
  p_slug text,
  p_description text,
  p_cover_image_url text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_status text
)
RETURNS public.preorder_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_update_preorder_event$
DECLARE
  v_event public.preorder_events%ROWTYPE;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_preorder_forbidden';
  END IF;

  IF p_event_id IS NULL
    OR p_title IS NULL OR pg_catalog.btrim(p_title) = ''
    OR p_slug IS NULL OR pg_catalog.btrim(p_slug) = ''
    OR p_status IS NULL
    OR p_status NOT IN ('draft', 'active', 'closed', 'cancelled')
    OR (p_starts_at IS NOT NULL AND p_ends_at IS NOT NULL AND p_ends_at < p_starts_at)
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_preorder_event_invalid';
  END IF;

  UPDATE public.preorder_events AS event
  SET
    title = p_title,
    slug = p_slug,
    description = p_description,
    cover_image_url = p_cover_image_url,
    starts_at = p_starts_at,
    ends_at = p_ends_at,
    status = p_status
  WHERE event.id = p_event_id
  RETURNING event.* INTO v_event;

  IF v_event.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'admin_preorder_event_not_found';
  END IF;

  RETURN v_event;
END;
$admin_update_preorder_event$;

CREATE OR REPLACE FUNCTION public.admin_delete_preorder_event(p_event_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_delete_preorder_event$
DECLARE
  v_event_id uuid;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_preorder_forbidden';
  END IF;

  IF p_event_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_preorder_event_id_invalid';
  END IF;

  DELETE FROM public.preorder_events AS event
  WHERE event.id = p_event_id
  RETURNING event.id INTO v_event_id;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'admin_preorder_event_not_found';
  END IF;

  RETURN v_event_id;
END;
$admin_delete_preorder_event$;

CREATE OR REPLACE FUNCTION public.admin_add_preorder_product(
  p_event_id uuid,
  p_product_id uuid,
  p_preorder_price numeric,
  p_preorder_stock integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_add_preorder_product$
DECLARE
  v_event_product_id uuid;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_preorder_forbidden';
  END IF;

  IF p_event_id IS NULL OR p_product_id IS NULL
    OR p_preorder_price IS NULL
    OR p_preorder_price = 'NaN'::pg_catalog.numeric
    OR p_preorder_price = 'Infinity'::pg_catalog.numeric
    OR p_preorder_price < 0
    OR p_preorder_stock IS NULL OR p_preorder_stock < 0
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_preorder_product_invalid';
  END IF;

  INSERT INTO public.preorder_event_products (
    event_id,
    product_id,
    preorder_price,
    preorder_stock
  )
  VALUES (
    p_event_id,
    p_product_id,
    p_preorder_price,
    p_preorder_stock
  )
  RETURNING id INTO v_event_product_id;

  RETURN v_event_product_id;
END;
$admin_add_preorder_product$;

CREATE OR REPLACE FUNCTION public.admin_update_preorder_product(
  p_event_product_id uuid,
  p_event_id uuid,
  p_preorder_price numeric,
  p_preorder_stock integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_update_preorder_product$
DECLARE
  v_event_product_id uuid;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_preorder_forbidden';
  END IF;

  IF p_event_product_id IS NULL OR p_event_id IS NULL
    OR p_preorder_price IS NULL
    OR p_preorder_price = 'NaN'::pg_catalog.numeric
    OR p_preorder_price = 'Infinity'::pg_catalog.numeric
    OR p_preorder_price < 0
    OR p_preorder_stock IS NULL OR p_preorder_stock < 0
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_preorder_product_invalid';
  END IF;

  UPDATE public.preorder_event_products AS event_product
  SET
    preorder_price = p_preorder_price,
    preorder_stock = p_preorder_stock
  WHERE event_product.id = p_event_product_id
    AND event_product.event_id = p_event_id
  RETURNING event_product.id INTO v_event_product_id;

  IF v_event_product_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'admin_preorder_product_not_found';
  END IF;

  RETURN v_event_product_id;
END;
$admin_update_preorder_product$;

CREATE OR REPLACE FUNCTION public.admin_delete_preorder_product(
  p_event_product_id uuid,
  p_event_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_delete_preorder_product$
DECLARE
  v_event_product_id uuid;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_preorder_forbidden';
  END IF;

  IF p_event_product_id IS NULL OR p_event_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_preorder_product_id_invalid';
  END IF;

  DELETE FROM public.preorder_event_products AS event_product
  WHERE event_product.id = p_event_product_id
    AND event_product.event_id = p_event_id
  RETURNING event_product.id INTO v_event_product_id;

  IF v_event_product_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'admin_preorder_product_not_found';
  END IF;

  RETURN v_event_product_id;
END;
$admin_delete_preorder_product$;

ALTER FUNCTION public.admin_create_preorder_event(text, text, text, text, timestamptz, timestamptz, text) OWNER TO postgres;
ALTER FUNCTION public.admin_update_preorder_event(uuid, text, text, text, text, timestamptz, timestamptz, text) OWNER TO postgres;
ALTER FUNCTION public.admin_delete_preorder_event(uuid) OWNER TO postgres;
ALTER FUNCTION public.admin_add_preorder_product(uuid, uuid, numeric, integer) OWNER TO postgres;
ALTER FUNCTION public.admin_update_preorder_product(uuid, uuid, numeric, integer) OWNER TO postgres;
ALTER FUNCTION public.admin_delete_preorder_product(uuid, uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.admin_create_preorder_event(text, text, text, text, timestamptz, timestamptz, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_preorder_event(uuid, text, text, text, text, timestamptz, timestamptz, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_preorder_event(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_add_preorder_product(uuid, uuid, numeric, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_preorder_product(uuid, uuid, numeric, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_preorder_product(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_create_preorder_event(text, text, text, text, timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_preorder_event(uuid, text, text, text, text, timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_preorder_event(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_preorder_product(uuid, uuid, numeric, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_preorder_product(uuid, uuid, numeric, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_preorder_product(uuid, uuid) TO authenticated;