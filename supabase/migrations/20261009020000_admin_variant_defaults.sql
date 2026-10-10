BEGIN;

-- Admin wrappers keep variant creation/option mapping atomic and maintain legacy
-- product price/stock as catalogue summary fields during the compatibility phase.
CREATE OR REPLACE FUNCTION public.admin_create_product_option_group(
  p_product_id uuid,
  p_name text,
  p_is_required boolean,
  p_sort_order integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_create_product_option_group$
DECLARE
  v_group_id uuid;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_variant_forbidden';
  END IF;

  IF p_product_id IS NULL
    OR p_name IS NULL OR pg_catalog.btrim(p_name) = ''
    OR p_is_required IS NULL
    OR p_sort_order IS NULL OR p_sort_order < 0
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_option_group_invalid';
  END IF;

  PERFORM product.id
  FROM public.products AS product
  WHERE product.id = p_product_id AND product.is_catalog IS TRUE
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'admin_catalog_product_not_found';
  END IF;

  INSERT INTO public.product_option_groups(product_id, name, is_required, sort_order)
  VALUES (p_product_id, pg_catalog.btrim(p_name), p_is_required, p_sort_order)
  RETURNING id INTO v_group_id;

  -- Once option groups exist, the migrated legacy default variant must no longer
  -- be sellable alongside the configured variant combinations.
  UPDATE public.product_variants AS variant
  SET status = 'inactive', updated_at = pg_catalog.now()
  WHERE variant.product_id = p_product_id
    AND variant.sku = 'LEGACY-' || pg_catalog.replace(p_product_id::text, '-', '');

  UPDATE public.products AS product
  SET stock = COALESCE((
    SELECT pg_catalog.sum(variant.stock)::integer
    FROM public.product_variants AS variant
    WHERE variant.product_id = p_product_id AND variant.status = 'active'
  ), 0)
  WHERE product.id = p_product_id;

  RETURN v_group_id;
END;
$admin_create_product_option_group$;

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
    OR p_price IS NULL
    OR p_price < 0
    OR p_price::text IN ('NaN', 'Infinity', '-Infinity')
    OR p_stock IS NULL OR p_stock < 0
    OR p_is_catalog IS NULL OR p_is_featured IS NULL
    OR p_slug IS NULL OR pg_catalog.btrim(p_slug) = ''
    OR p_status IS NULL OR p_status NOT IN ('active', 'inactive', 'out_of_stock')
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_product_invalid';
  END IF;

  INSERT INTO public.products (
    title, description, category, price, stock, image_url,
    is_catalog, status, is_featured, slug
  )
  VALUES (
    pg_catalog.btrim(p_title), p_description, pg_catalog.btrim(p_category),
    p_price, p_stock, p_image_url, p_is_catalog, p_status, p_is_featured,
    pg_catalog.btrim(p_slug)
  )
  RETURNING id INTO v_product_id;

  IF p_is_catalog IS TRUE THEN
    INSERT INTO public.product_variants (
      product_id, sku, label, price, stock, status, image_url
    )
    VALUES (
      v_product_id,
      'LEGACY-' || pg_catalog.replace(v_product_id::text, '-', ''),
      'Default',
      p_price,
      p_stock,
      p_status,
      p_image_url
    );
  END IF;

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
  v_has_option_groups boolean;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_product_forbidden';
  END IF;

  IF p_product_id IS NULL
    OR p_title IS NULL OR pg_catalog.btrim(p_title) = ''
    OR p_category IS NULL OR pg_catalog.btrim(p_category) = ''
    OR p_price IS NULL
    OR p_price < 0
    OR p_price::text IN ('NaN', 'Infinity', '-Infinity')
    OR p_stock IS NULL OR p_stock < 0
    OR p_is_catalog IS NULL OR p_is_featured IS NULL
    OR p_status IS NULL OR p_status NOT IN ('active', 'inactive', 'out_of_stock')
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_product_invalid';
  END IF;

  PERFORM product.id
  FROM public.products AS product
  WHERE product.id = p_product_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'admin_product_not_found';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.product_option_groups AS option_group
    WHERE option_group.product_id = p_product_id
  )
  INTO v_has_option_groups;

  UPDATE public.products AS product
  SET
    title = pg_catalog.btrim(p_title),
    description = p_description,
    category = pg_catalog.btrim(p_category),
    price = CASE WHEN v_has_option_groups THEN product.price ELSE p_price END,
    stock = CASE WHEN v_has_option_groups THEN product.stock ELSE p_stock END,
    image_url = p_image_url,
    is_catalog = p_is_catalog,
    status = p_status,
    is_featured = p_is_featured
  WHERE product.id = p_product_id
  RETURNING product.id INTO v_product_id;

  IF v_product_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'admin_product_not_found';
  END IF;

  IF NOT v_has_option_groups AND p_is_catalog IS TRUE THEN
    UPDATE public.product_variants AS variant
    SET
      price = p_price,
      stock = p_stock,
      status = p_status,
      image_url = p_image_url,
      updated_at = pg_catalog.now()
    WHERE variant.product_id = v_product_id
      AND variant.sku = 'LEGACY-' || pg_catalog.replace(v_product_id::text, '-', '');
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

  IF NOT EXISTS (
    SELECT 1 FROM public.product_option_groups AS option_group
    WHERE option_group.product_id = v_product_id
  ) THEN
    UPDATE public.product_variants AS variant
    SET status = p_status, updated_at = pg_catalog.now()
    WHERE variant.product_id = v_product_id
      AND variant.sku = 'LEGACY-' || pg_catalog.replace(v_product_id::text, '-', '');

    UPDATE public.products AS product
    SET
      price = COALESCE((
        SELECT pg_catalog.min(variant.price)
        FROM public.product_variants AS variant
        WHERE variant.product_id = v_product_id AND variant.status = 'active'
      ), product.price),
      stock = COALESCE((
        SELECT pg_catalog.sum(variant.stock)::integer
        FROM public.product_variants AS variant
        WHERE variant.product_id = v_product_id AND variant.status = 'active'
      ), 0),
      updated_at = pg_catalog.now()
    WHERE product.id = v_product_id;
  END IF;

  RETURN v_product_id;
END;
$admin_update_product_status$;

CREATE OR REPLACE FUNCTION public.admin_create_product_variant_with_options(
  p_product_id uuid,
  p_sku text,
  p_label text,
  p_price numeric,
  p_stock integer,
  p_status text,
  p_image_url text,
  p_option_value_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_create_product_variant_with_options$
DECLARE
  v_variant_id uuid;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_variant_forbidden';
  END IF;
  IF p_option_value_ids IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_variant_options_invalid';
  END IF;

  PERFORM product.id
  FROM public.products AS product
  WHERE product.id = p_product_id AND product.is_catalog IS TRUE
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'admin_catalog_product_not_found';
  END IF;

  v_variant_id := public.admin_create_product_variant(
    p_product_id, p_sku, p_label, p_price, p_stock, p_status, p_image_url
  );
  PERFORM public.admin_set_variant_option_values(v_variant_id, p_option_value_ids);

  UPDATE public.products AS product
  SET
    price = COALESCE((
      SELECT pg_catalog.min(variant.price)
      FROM public.product_variants AS variant
      WHERE variant.product_id = p_product_id AND variant.status = 'active'
    ), product.price),
    stock = COALESCE((
      SELECT pg_catalog.sum(variant.stock)::integer
      FROM public.product_variants AS variant
      WHERE variant.product_id = p_product_id AND variant.status = 'active'
    ), 0)
  WHERE product.id = p_product_id;

  RETURN v_variant_id;
END;
$admin_create_product_variant_with_options$;

CREATE OR REPLACE FUNCTION public.admin_update_product_variant_with_options(
  p_variant_id uuid,
  p_sku text,
  p_label text,
  p_price numeric,
  p_stock integer,
  p_status text,
  p_image_url text,
  p_option_value_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_update_product_variant_with_options$
DECLARE
  v_product_id uuid;
  v_result_id uuid;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_variant_forbidden';
  END IF;
  IF p_option_value_ids IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_variant_options_invalid';
  END IF;

  SELECT product_id INTO v_product_id
  FROM public.product_variants
  WHERE id = p_variant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'admin_variant_not_found';
  END IF;

  PERFORM product.id
  FROM public.products AS product
  WHERE product.id = v_product_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'admin_catalog_product_not_found';
  END IF;

  PERFORM variant.id
  FROM public.product_variants AS variant
  WHERE variant.id = p_variant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'admin_variant_not_found';
  END IF;

  v_result_id := public.admin_update_product_variant(
    p_variant_id, p_sku, p_label, p_price, p_stock, p_status, p_image_url
  );
  PERFORM public.admin_set_variant_option_values(v_result_id, p_option_value_ids);

  UPDATE public.products AS product
  SET
    price = COALESCE((
      SELECT pg_catalog.min(variant.price)
      FROM public.product_variants AS variant
      WHERE variant.product_id = v_product_id AND variant.status = 'active'
    ), product.price),
    stock = COALESCE((
      SELECT pg_catalog.sum(variant.stock)::integer
      FROM public.product_variants AS variant
      WHERE variant.product_id = v_product_id AND variant.status = 'active'
    ), 0)
  WHERE product.id = v_product_id;

  RETURN v_result_id;
END;
$admin_update_product_variant_with_options$;

ALTER FUNCTION public.admin_create_product_option_group(uuid, text, boolean, integer) OWNER TO postgres;
ALTER FUNCTION public.admin_create_product(text, text, text, numeric, integer, text, boolean, text, boolean, text) OWNER TO postgres;
ALTER FUNCTION public.admin_update_product(uuid, text, text, text, numeric, integer, text, boolean, text, boolean) OWNER TO postgres;
ALTER FUNCTION public.admin_update_product_status(uuid, text) OWNER TO postgres;
ALTER FUNCTION public.admin_create_product_variant_with_options(uuid, text, text, numeric, integer, text, text, uuid[]) OWNER TO postgres;
ALTER FUNCTION public.admin_update_product_variant_with_options(uuid, text, text, numeric, integer, text, text, uuid[]) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.admin_create_product_option_group(uuid, text, boolean, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_create_product(text, text, text, numeric, integer, text, boolean, text, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_product(uuid, text, text, text, numeric, integer, text, boolean, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_product_status(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_create_product_variant_with_options(uuid, text, text, numeric, integer, text, text, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_product_variant_with_options(uuid, text, text, numeric, integer, text, text, uuid[]) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_create_product_option_group(uuid, text, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_product(text, text, text, numeric, integer, text, boolean, text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_product(uuid, text, text, text, numeric, integer, text, boolean, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_product_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_product_variant_with_options(uuid, text, text, numeric, integer, text, text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_product_variant_with_options(uuid, text, text, numeric, integer, text, text, uuid[]) TO authenticated;

-- Cart mutations now use ownership-checked RPCs. Direct table DELETE was the
-- only authenticated DML grant confirmed for cart_items and is no longer needed.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.cart_items FROM PUBLIC, anon, authenticated;

COMMIT;
