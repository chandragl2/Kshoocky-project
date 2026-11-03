BEGIN;

-- Variant summary triggers are deferred, so synchronize explicitly before
-- returning. Option-group summaries come from active variants; their legacy
-- default stays inactive and is not modified, including when catalog is off.
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
  v_default_variant_id uuid;
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
    OR p_price > 9999999999.99
    OR p_price <> pg_catalog.round(p_price, 2)
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

  IF p_is_catalog IS TRUE THEN
    SELECT variant.id
    INTO v_default_variant_id
    FROM public.product_variants AS variant
    WHERE variant.product_id = v_product_id
      AND variant.sku = 'LEGACY-' || pg_catalog.replace(v_product_id::text, '-', '')
    FOR UPDATE;

    IF v_default_variant_id IS NULL THEN
      INSERT INTO public.product_variants (
        product_id, sku, label, price, stock, status, image_url
      )
      VALUES (
        v_product_id,
        'LEGACY-' || pg_catalog.replace(v_product_id::text, '-', ''),
        'Default',
        p_price,
        p_stock,
        CASE WHEN v_has_option_groups THEN 'inactive' ELSE p_status END,
        p_image_url
      );
    ELSIF NOT v_has_option_groups THEN
      UPDATE public.product_variants AS variant
      SET
        price = p_price,
        stock = p_stock,
        status = p_status,
        image_url = p_image_url,
        updated_at = pg_catalog.now()
      WHERE variant.id = v_default_variant_id;
    END IF;
  END IF;

  IF p_is_catalog IS TRUE OR v_has_option_groups THEN
    -- Without option groups, non-catalog product fields stay authoritative;
    -- the retained default is updated from admin input when catalog is enabled.
    PERFORM public.sync_product_variant_summary(v_product_id);
  END IF;

  RETURN v_product_id;
END;
$admin_update_product$;

COMMIT;
