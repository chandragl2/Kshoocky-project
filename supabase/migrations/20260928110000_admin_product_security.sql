CREATE OR REPLACE FUNCTION public.admin_create_product(
  p_title text,
  p_description text,
  p_category text,
  p_price numeric,
  p_stock integer,
  p_image_url text,
  p_is_catalog boolean,
  p_status text,
  p_is_featured boolean,
  p_slug text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_create_product$
DECLARE
  v_product_id uuid;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_product_forbidden';
  END IF;

  IF p_title IS NULL OR pg_catalog.btrim(p_title) = ''
    OR p_category IS NULL OR pg_catalog.btrim(p_category) = ''
    OR p_price IS NULL OR p_price < 0
    OR p_stock IS NULL OR p_stock < 0
    OR p_is_catalog IS NULL OR p_is_featured IS NULL
    OR p_slug IS NULL OR pg_catalog.btrim(p_slug) = ''
    OR p_status IS NULL OR p_status NOT IN ('active', 'inactive', 'out_of_stock')
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_product_invalid';
  END IF;

  INSERT INTO public.products (
    title,
    description,
    category,
    price,
    stock,
    image_url,
    is_catalog,
    status,
    is_featured,
    slug
  )
  VALUES (
    p_title,
    p_description,
    p_category,
    p_price,
    p_stock,
    p_image_url,
    p_is_catalog,
    p_status,
    p_is_featured,
    p_slug
  )
  RETURNING id INTO v_product_id;

  RETURN v_product_id;
END;
$admin_create_product$;

CREATE OR REPLACE FUNCTION public.admin_update_product(
  p_product_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_price numeric,
  p_stock integer,
  p_image_url text,
  p_is_catalog boolean,
  p_status text,
  p_is_featured boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_update_product$
DECLARE
  v_product_id uuid;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_product_forbidden';
  END IF;

  IF p_product_id IS NULL
    OR p_title IS NULL OR pg_catalog.btrim(p_title) = ''
    OR p_category IS NULL OR pg_catalog.btrim(p_category) = ''
    OR p_price IS NULL OR p_price < 0
    OR p_stock IS NULL OR p_stock < 0
    OR p_is_catalog IS NULL OR p_is_featured IS NULL
    OR p_status IS NULL OR p_status NOT IN ('active', 'inactive', 'out_of_stock')
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_product_invalid';
  END IF;

  UPDATE public.products AS product
  SET
    title = p_title,
    description = p_description,
    category = p_category,
    price = p_price,
    stock = p_stock,
    image_url = p_image_url,
    is_catalog = p_is_catalog,
    status = p_status,
    is_featured = p_is_featured
  WHERE product.id = p_product_id
  RETURNING product.id INTO v_product_id;

  IF v_product_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'admin_product_not_found';
  END IF;

  RETURN v_product_id;
END;
$admin_update_product$;

CREATE OR REPLACE FUNCTION public.admin_update_product_status(
  p_product_id uuid,
  p_status text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_update_product_status$
DECLARE
  v_product_id uuid;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_product_forbidden';
  END IF;

  IF p_product_id IS NULL
    OR p_status IS NULL OR p_status NOT IN ('active', 'inactive', 'out_of_stock')
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_product_status_invalid';
  END IF;

  UPDATE public.products AS product
  SET status = p_status
  WHERE product.id = p_product_id
  RETURNING product.id INTO v_product_id;

  IF v_product_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'admin_product_not_found';
  END IF;

  RETURN v_product_id;
END;
$admin_update_product_status$;

CREATE OR REPLACE FUNCTION public.admin_delete_product(p_product_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_delete_product$
DECLARE
  v_product_id uuid;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_product_forbidden';
  END IF;

  IF p_product_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_product_id_invalid';
  END IF;

  DELETE FROM public.products AS product
  WHERE product.id = p_product_id
  RETURNING product.id INTO v_product_id;

  IF v_product_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'admin_product_not_found';
  END IF;

  RETURN v_product_id;
END;
$admin_delete_product$;

CREATE OR REPLACE FUNCTION public.admin_add_product_image(
  p_product_id uuid,
  p_image_url text,
  p_is_primary boolean,
  p_sort_order integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_add_product_image$
DECLARE
  v_image_id uuid;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_product_forbidden';
  END IF;

  IF p_product_id IS NULL OR p_image_url IS NULL OR pg_catalog.btrim(p_image_url) = ''
    OR p_is_primary IS NULL OR p_sort_order IS NULL
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_product_image_invalid';
  END IF;

  PERFORM 1 FROM public.products AS product WHERE product.id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'admin_product_not_found';
  END IF;

  IF p_is_primary THEN
    UPDATE public.product_images AS image
    SET is_primary = false
    WHERE image.product_id = p_product_id AND image.is_primary;
  END IF;

  INSERT INTO public.product_images (product_id, image_url, is_primary, sort_order)
  VALUES (p_product_id, p_image_url, p_is_primary, p_sort_order)
  RETURNING id INTO v_image_id;

  RETURN v_image_id;
END;
$admin_add_product_image$;

CREATE OR REPLACE FUNCTION public.admin_set_primary_product_image(
  p_product_id uuid,
  p_image_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_set_primary_product_image$
DECLARE
  v_image_id uuid;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_product_forbidden';
  END IF;

  IF p_product_id IS NULL OR p_image_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_product_image_invalid';
  END IF;

  PERFORM 1
  FROM public.product_images AS image
  WHERE image.product_id = p_product_id AND image.id = p_image_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'admin_product_image_not_found';
  END IF;

  UPDATE public.product_images AS image
  SET is_primary = (image.id = p_image_id)
  WHERE image.product_id = p_product_id;

  RETURN p_image_id;
END;
$admin_set_primary_product_image$;

CREATE OR REPLACE FUNCTION public.admin_update_product_image_sort_order(
  p_product_id uuid,
  p_image_id uuid,
  p_sort_order integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_update_product_image_sort_order$
DECLARE
  v_image_id uuid;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_product_forbidden';
  END IF;

  IF p_product_id IS NULL OR p_image_id IS NULL OR p_sort_order IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_product_image_invalid';
  END IF;

  UPDATE public.product_images AS image
  SET sort_order = p_sort_order
  WHERE image.product_id = p_product_id AND image.id = p_image_id
  RETURNING image.id INTO v_image_id;

  IF v_image_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'admin_product_image_not_found';
  END IF;

  RETURN v_image_id;
END;
$admin_update_product_image_sort_order$;

CREATE OR REPLACE FUNCTION public.admin_delete_product_image(
  p_product_id uuid,
  p_image_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_delete_product_image$
DECLARE
  v_image_id uuid;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_product_forbidden';
  END IF;

  IF p_product_id IS NULL OR p_image_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_product_image_invalid';
  END IF;

  DELETE FROM public.product_images AS image
  WHERE image.product_id = p_product_id AND image.id = p_image_id
  RETURNING image.id INTO v_image_id;

  IF v_image_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'admin_product_image_not_found';
  END IF;

  RETURN v_image_id;
END;
$admin_delete_product_image$;

ALTER FUNCTION public.admin_create_product(text, text, text, numeric, integer, text, boolean, text, boolean, text) OWNER TO postgres;
ALTER FUNCTION public.admin_update_product(uuid, text, text, text, numeric, integer, text, boolean, text, boolean) OWNER TO postgres;
ALTER FUNCTION public.admin_update_product_status(uuid, text) OWNER TO postgres;
ALTER FUNCTION public.admin_delete_product(uuid) OWNER TO postgres;
ALTER FUNCTION public.admin_add_product_image(uuid, text, boolean, integer) OWNER TO postgres;
ALTER FUNCTION public.admin_set_primary_product_image(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.admin_update_product_image_sort_order(uuid, uuid, integer) OWNER TO postgres;
ALTER FUNCTION public.admin_delete_product_image(uuid, uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.admin_create_product(text, text, text, numeric, integer, text, boolean, text, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_product(uuid, text, text, text, numeric, integer, text, boolean, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_product_status(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_product(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_add_product_image(uuid, text, boolean, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_primary_product_image(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_product_image_sort_order(uuid, uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_product_image(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_create_product(text, text, text, numeric, integer, text, boolean, text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_product(uuid, text, text, text, numeric, integer, text, boolean, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_product_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_product(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_product_image(uuid, text, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_primary_product_image(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_product_image_sort_order(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_product_image(uuid, uuid) TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.product_images FROM PUBLIC, anon, authenticated;