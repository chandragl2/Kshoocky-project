BEGIN;

-- Cart + admin RPCs + variant-aware checkout. This migration is committed to a
-- feature branch only and has NOT been applied to Supabase live.

-- Replace legacy (cart_id, product_id) uniqueness with variant-aware uniqueness.
DO $drop_legacy_cart_unique$
DECLARE
  v_constraint_name text;
  v_index_name text;
BEGIN
  FOR v_constraint_name IN
    SELECT constraint_row.conname
    FROM pg_catalog.pg_constraint AS constraint_row
    WHERE constraint_row.conrelid = 'public.cart_items'::regclass
      AND constraint_row.contype = 'u'
      AND ARRAY(
        SELECT attribute_row.attname::text
        FROM pg_catalog.pg_attribute AS attribute_row
        WHERE attribute_row.attrelid = constraint_row.conrelid
          AND attribute_row.attnum = ANY (constraint_row.conkey)
        ORDER BY attribute_row.attname::text
      ) = ARRAY['cart_id', 'product_id']::text[]
  LOOP
    EXECUTE pg_catalog.format(
      'ALTER TABLE public.cart_items DROP CONSTRAINT %I',
      v_constraint_name
    );
  END LOOP;

  -- Also handle a standalone unique index if the legacy uniqueness was not
  -- implemented as a table constraint.
  FOR v_index_name IN
    SELECT index_class.relname
    FROM pg_catalog.pg_index AS index_row
    JOIN pg_catalog.pg_class AS index_class
      ON index_class.oid = index_row.indexrelid
    LEFT JOIN pg_catalog.pg_constraint AS constraint_row
      ON constraint_row.conindid = index_row.indexrelid
    WHERE index_row.indrelid = 'public.cart_items'::regclass
      AND index_row.indisunique
      AND NOT index_row.indisprimary
      AND constraint_row.oid IS NULL
      AND index_row.indpred IS NULL
      AND index_row.indnkeyatts = 2
      AND ARRAY(
        SELECT attribute_row.attname::text
        FROM pg_catalog.pg_attribute AS attribute_row
        WHERE attribute_row.attrelid = index_row.indrelid
          AND attribute_row.attnum = ANY (index_row.indkey::smallint[])
          AND attribute_row.attnum > 0
        ORDER BY attribute_row.attname::text
      ) = ARRAY['cart_id', 'product_id']::text[]
  LOOP
    EXECUTE pg_catalog.format('DROP INDEX public.%I', v_index_name);
  END LOOP;
END;
$drop_legacy_cart_unique$;

CREATE UNIQUE INDEX cart_items_cart_legacy_product_unique_idx
  ON public.cart_items(cart_id, product_id)
  WHERE variant_id IS NULL;

CREATE UNIQUE INDEX cart_items_cart_variant_unique_idx
  ON public.cart_items(cart_id, variant_id)
  WHERE variant_id IS NOT NULL;

-- Admin-only option setup.
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

  PERFORM 1
  FROM public.products AS product
  WHERE product.id = p_product_id
    AND product.is_catalog IS TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'admin_catalog_product_not_found';
  END IF;

  INSERT INTO public.product_option_groups(product_id, name, is_required, sort_order)
  VALUES (p_product_id, pg_catalog.btrim(p_name), p_is_required, p_sort_order)
  RETURNING id INTO v_group_id;

  RETURN v_group_id;
END;
$admin_create_product_option_group$;

CREATE OR REPLACE FUNCTION public.admin_create_product_option_value(
  p_option_group_id uuid,
  p_value text,
  p_sort_order integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_create_product_option_value$
DECLARE
  v_product_id uuid;
  v_value_id uuid;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_variant_forbidden';
  END IF;

  IF p_option_group_id IS NULL
    OR p_value IS NULL OR pg_catalog.btrim(p_value) = ''
    OR p_sort_order IS NULL OR p_sort_order < 0
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_option_value_invalid';
  END IF;

  SELECT option_group.product_id
  INTO v_product_id
  FROM public.product_option_groups AS option_group
  WHERE option_group.id = p_option_group_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'admin_option_group_not_found';
  END IF;

  INSERT INTO public.product_option_values(
    product_id, option_group_id, value, sort_order
  )
  VALUES (
    v_product_id, p_option_group_id, pg_catalog.btrim(p_value), p_sort_order
  )
  RETURNING id INTO v_value_id;

  RETURN v_value_id;
END;
$admin_create_product_option_value$;

CREATE OR REPLACE FUNCTION public.admin_create_product_variant(
  p_product_id uuid,
  p_sku text,
  p_label text,
  p_price numeric,
  p_stock integer,
  p_status text,
  p_image_url text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_create_product_variant$
DECLARE
  v_variant_id uuid;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_variant_forbidden';
  END IF;

  IF p_product_id IS NULL
    OR p_sku IS NULL OR pg_catalog.btrim(p_sku) = ''
    OR p_label IS NULL OR pg_catalog.btrim(p_label) = ''
    OR p_price IS NULL
    OR p_price < 0
    OR p_price::text IN ('NaN', 'Infinity', '-Infinity')
    OR p_stock IS NULL OR p_stock < 0
    OR p_status IS NULL OR p_status NOT IN ('active', 'inactive', 'out_of_stock')
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_variant_invalid';
  END IF;

  PERFORM 1
  FROM public.products AS product
  WHERE product.id = p_product_id
    AND product.is_catalog IS TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'admin_catalog_product_not_found';
  END IF;

  INSERT INTO public.product_variants(
    product_id, sku, label, price, stock, status, image_url
  )
  VALUES (
    p_product_id,
    pg_catalog.btrim(p_sku),
    pg_catalog.btrim(p_label),
    p_price,
    p_stock,
    p_status,
    NULLIF(pg_catalog.btrim(COALESCE(p_image_url, '')), '')
  )
  RETURNING id INTO v_variant_id;

  RETURN v_variant_id;
END;
$admin_create_product_variant$;

CREATE OR REPLACE FUNCTION public.admin_update_product_variant(
  p_variant_id uuid,
  p_sku text,
  p_label text,
  p_price numeric,
  p_stock integer,
  p_status text,
  p_image_url text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_update_product_variant$
DECLARE
  v_variant_id uuid;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_variant_forbidden';
  END IF;

  IF p_variant_id IS NULL
    OR p_sku IS NULL OR pg_catalog.btrim(p_sku) = ''
    OR p_label IS NULL OR pg_catalog.btrim(p_label) = ''
    OR p_price IS NULL
    OR p_price < 0
    OR p_price::text IN ('NaN', 'Infinity', '-Infinity')
    OR p_stock IS NULL OR p_stock < 0
    OR p_status IS NULL OR p_status NOT IN ('active', 'inactive', 'out_of_stock')
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_variant_invalid';
  END IF;

  UPDATE public.product_variants AS variant
  SET
    sku = pg_catalog.btrim(p_sku),
    label = pg_catalog.btrim(p_label),
    price = p_price,
    stock = p_stock,
    status = p_status,
    image_url = NULLIF(pg_catalog.btrim(COALESCE(p_image_url, '')), ''),
    updated_at = pg_catalog.now()
  WHERE variant.id = p_variant_id
    AND EXISTS (
      SELECT 1
      FROM public.products AS product
      WHERE product.id = variant.product_id
        AND product.is_catalog IS TRUE
    )
  RETURNING variant.id INTO v_variant_id;

  IF v_variant_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'admin_variant_not_found';
  END IF;

  RETURN v_variant_id;
END;
$admin_update_product_variant$;

CREATE OR REPLACE FUNCTION public.admin_set_variant_option_values(
  p_variant_id uuid,
  p_option_value_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_set_variant_option_values$
DECLARE
  v_product_id uuid;
  v_target_count integer;
  v_matched_count integer;
  v_distinct_value_count integer;
  v_distinct_group_count integer;
  v_target_values uuid[];
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_variant_forbidden';
  END IF;

  IF p_variant_id IS NULL OR p_option_value_ids IS NULL
    OR pg_catalog.cardinality(p_option_value_ids) > 10
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_variant_options_invalid';
  END IF;

  SELECT variant.product_id
  INTO v_product_id
  FROM public.product_variants AS variant
  WHERE variant.id = p_variant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'admin_variant_not_found';
  END IF;

  v_target_count := pg_catalog.cardinality(p_option_value_ids);

  SELECT
    count(value.id)::integer,
    count(DISTINCT value.id)::integer,
    count(DISTINCT value.option_group_id)::integer
  INTO v_matched_count, v_distinct_value_count, v_distinct_group_count
  FROM pg_catalog.unnest(p_option_value_ids) AS selected(value_id)
  LEFT JOIN public.product_option_values AS value
    ON value.id = selected.value_id
   AND value.product_id = v_product_id;

  IF v_matched_count <> v_target_count
    OR v_distinct_value_count <> v_target_count
    OR v_distinct_group_count <> v_target_count
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_variant_options_invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.product_option_groups AS option_group
    WHERE option_group.product_id = v_product_id
      AND option_group.is_required IS TRUE
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.unnest(p_option_value_ids) AS selected(value_id)
        JOIN public.product_option_values AS value
          ON value.id = selected.value_id
         AND value.product_id = v_product_id
        WHERE value.option_group_id = option_group.id
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_variant_required_option_missing';
  END IF;

  SELECT pg_catalog.array_agg(selected.value_id ORDER BY selected.value_id)
  INTO v_target_values
  FROM pg_catalog.unnest(p_option_value_ids) AS selected(value_id);

  IF v_target_count > 0 AND EXISTS (
    SELECT 1
    FROM public.product_variants AS other_variant
    WHERE other_variant.product_id = v_product_id
      AND other_variant.id <> p_variant_id
      AND ARRAY(
        SELECT mapping.option_value_id
        FROM public.product_variant_option_values AS mapping
        WHERE mapping.variant_id = other_variant.id
        ORDER BY mapping.option_value_id
      ) = v_target_values
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'admin_variant_combination_duplicate';
  END IF;

  DELETE FROM public.product_variant_option_values AS mapping
  WHERE mapping.variant_id = p_variant_id;

  INSERT INTO public.product_variant_option_values(
    variant_id, product_id, option_group_id, option_value_id
  )
  SELECT
    p_variant_id,
    v_product_id,
    value.option_group_id,
    value.id
  FROM pg_catalog.unnest(p_option_value_ids) AS selected(value_id)
  JOIN public.product_option_values AS value
    ON value.id = selected.value_id
   AND value.product_id = v_product_id;
END;
$admin_set_variant_option_values$;

-- Customer cart writes go through owner-checked RPCs instead of direct table DML.
CREATE OR REPLACE FUNCTION public.cart_add_variant(
  p_product_id uuid,
  p_variant_id uuid,
  p_quantity integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $cart_add_variant$
DECLARE
  v_user_id uuid := auth.uid();
  v_cart_id uuid;
  v_existing_item_id uuid;
  v_existing_quantity integer;
  v_stock integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'cart_unauthenticated';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  IF p_product_id IS NULL OR p_variant_id IS NULL
    OR p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 99
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'cart_quantity_invalid';
  END IF;

  INSERT INTO public.carts(user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO UPDATE
    SET updated_at = pg_catalog.now()
  RETURNING id INTO v_cart_id;

  -- Lock the cart line before the variant to keep lock order consistent with checkout.
  SELECT item.id, item.quantity
  INTO v_existing_item_id, v_existing_quantity
  FROM public.cart_items AS item
  WHERE item.cart_id = v_cart_id
    AND item.variant_id = p_variant_id
  FOR UPDATE;

  SELECT variant.stock
  INTO v_stock
  FROM public.product_variants AS variant
  JOIN public.products AS product ON product.id = variant.product_id
  WHERE variant.id = p_variant_id
    AND variant.product_id = p_product_id
    AND variant.status = 'active'
    AND product.status = 'active'
    AND product.is_catalog IS TRUE
  FOR UPDATE OF variant
  FOR SHARE OF product;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'cart_variant_unavailable';
  END IF;

  IF (COALESCE(v_existing_quantity, 0) + p_quantity) > v_stock THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'cart_stock_limit';
  END IF;

  IF v_existing_item_id IS NULL THEN
    INSERT INTO public.cart_items(cart_id, product_id, variant_id, quantity)
    VALUES (v_cart_id, p_product_id, p_variant_id, p_quantity);
  ELSE
    UPDATE public.cart_items AS item
    SET quantity = v_existing_quantity + p_quantity,
        updated_at = pg_catalog.now()
    WHERE item.id = v_existing_item_id;
  END IF;

  RETURN v_cart_id;
END;
$cart_add_variant$;

CREATE OR REPLACE FUNCTION public.cart_update_item_quantity(
  p_cart_item_id uuid,
  p_quantity integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $cart_update_item_quantity$
DECLARE
  v_user_id uuid := auth.uid();
  v_product_id uuid;
  v_variant_id uuid;
  v_stock integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'cart_unauthenticated';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  IF p_cart_item_id IS NULL OR p_quantity IS NULL
    OR p_quantity < 1 OR p_quantity > 99
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'cart_quantity_invalid';
  END IF;

  SELECT item.product_id, item.variant_id
  INTO v_product_id, v_variant_id
  FROM public.cart_items AS item
  JOIN public.carts AS cart ON cart.id = item.cart_id
  WHERE item.id = p_cart_item_id
    AND cart.user_id = v_user_id
  FOR UPDATE OF item;

  IF NOT FOUND OR v_variant_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'cart_item_not_found';
  END IF;

  SELECT variant.stock
  INTO v_stock
  FROM public.product_variants AS variant
  JOIN public.products AS product ON product.id = variant.product_id
  WHERE variant.id = v_variant_id
    AND variant.product_id = v_product_id
    AND variant.status = 'active'
    AND product.status = 'active'
    AND product.is_catalog IS TRUE
  FOR UPDATE OF variant
  FOR SHARE OF product;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'cart_variant_unavailable';
  END IF;
  IF p_quantity > v_stock THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'cart_stock_limit';
  END IF;

  UPDATE public.cart_items AS item
  SET quantity = p_quantity, updated_at = pg_catalog.now()
  WHERE item.id = p_cart_item_id;
END;
$cart_update_item_quantity$;

CREATE OR REPLACE FUNCTION public.cart_remove_item(p_cart_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $cart_remove_item$
DECLARE
  v_user_id uuid := auth.uid();
  v_deleted_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'cart_unauthenticated';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  IF p_cart_item_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'cart_item_id_invalid';
  END IF;

  DELETE FROM public.cart_items AS item
  USING public.carts AS cart
  WHERE item.id = p_cart_item_id
    AND item.cart_id = cart.id
    AND cart.user_id = v_user_id;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  IF v_deleted_count = 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'cart_item_not_found';
  END IF;
END;
$cart_remove_item$;

CREATE OR REPLACE FUNCTION public.cart_clear_items()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $cart_clear_items$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'cart_unauthenticated';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  DELETE FROM public.cart_items AS item
  USING public.carts AS cart
  WHERE item.cart_id = cart.id
    AND cart.user_id = v_user_id;
END;
$cart_clear_items$;

-- Atomic variant checkout. The order, order-item snapshots, stock decrement,
-- inventory ledger, and cart clear all commit or roll back together.
CREATE OR REPLACE FUNCTION public.checkout_catalog_variant(p_address_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $checkout_catalog_variant$
DECLARE
  v_user_id uuid := auth.uid();
  v_cart_id uuid;
  v_address public.addresses%ROWTYPE;
  v_cart_item_ids uuid[] := ARRAY[]::uuid[];
  v_cart_item_count bigint;
  v_joined_item_count bigint;
  v_subtotal numeric := 0;
  v_order_id uuid;
  v_order_item_id uuid;
  v_updated_variant_id uuid;
  v_order_number text;
  v_attempt integer;
  v_item record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'checkout_unauthenticated';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  SELECT address.*
  INTO v_address
  FROM public.addresses AS address
  WHERE address.id = p_address_id
    AND address.user_id = v_user_id
  FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'checkout_address_invalid';
  END IF;

  SELECT cart.id
  INTO v_cart_id
  FROM public.carts AS cart
  WHERE cart.user_id = v_user_id
  FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'checkout_cart_empty';
  END IF;

  PERFORM 1
  FROM public.cart_items AS cart_item
  WHERE cart_item.cart_id = v_cart_id
  FOR UPDATE;

  -- Lock all parent product rows in deterministic order before variant locks.
  -- Checkout also updates product.stock as a legacy aggregate summary.
  PERFORM product.id
  FROM public.products AS product
  JOIN public.cart_items AS cart_item
    ON cart_item.product_id = product.id
  WHERE cart_item.cart_id = v_cart_id
  ORDER BY product.id
  FOR UPDATE OF product;

  SELECT pg_catalog.count(*)
  INTO v_cart_item_count
  FROM public.cart_items AS cart_item
  WHERE cart_item.cart_id = v_cart_id;

  IF v_cart_item_count = 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'checkout_cart_empty';
  END IF;

  SELECT pg_catalog.count(*)
  INTO v_joined_item_count
  FROM public.cart_items AS cart_item
  JOIN public.products AS product
    ON product.id = cart_item.product_id
  JOIN public.product_variants AS variant
    ON variant.id = cart_item.variant_id
   AND variant.product_id = cart_item.product_id
  WHERE cart_item.cart_id = v_cart_id;

  IF v_joined_item_count <> v_cart_item_count THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'checkout_product_unavailable';
  END IF;

  FOR v_item IN
    SELECT
      cart_item.id,
      cart_item.product_id,
      cart_item.variant_id,
      cart_item.quantity,
      product.title,
      product.status AS product_status,
      product.is_catalog,
      variant.sku,
      variant.label AS variant_label,
      variant.price,
      variant.stock,
      variant.status AS variant_status
    FROM public.cart_items AS cart_item
    JOIN public.products AS product
      ON product.id = cart_item.product_id
    JOIN public.product_variants AS variant
      ON variant.id = cart_item.variant_id
     AND variant.product_id = cart_item.product_id
    WHERE cart_item.cart_id = v_cart_id
    ORDER BY variant.id, cart_item.id
    FOR UPDATE OF cart_item, variant
    FOR SHARE OF product
  LOOP
    IF v_item.product_status <> 'active'
      OR NOT v_item.is_catalog
      OR v_item.variant_status <> 'active'
    THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'checkout_product_unavailable';
    END IF;

    IF v_item.quantity IS NULL OR v_item.quantity < 1 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'checkout_quantity_invalid';
    END IF;

    IF v_item.quantity > v_item.stock THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'checkout_stock_insufficient';
    END IF;

    v_subtotal := v_subtotal + (v_item.price * v_item.quantity);
    v_cart_item_ids := pg_catalog.array_append(v_cart_item_ids, v_item.id);
  END LOOP;

  FOR v_attempt IN 1..10 LOOP
    v_order_number :=
      'KSH-'
      || pg_catalog.to_char(
        pg_catalog.timezone('UTC', pg_catalog.clock_timestamp()),
        'YYYYMMDD'
      )
      || '-'
      || pg_catalog.upper(
        pg_catalog.substr(
          pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
          1,
          6
        )
      );

    INSERT INTO public.orders (
      user_id,
      order_number,
      subtotal,
      shipping_fee,
      discount,
      total_price,
      payment_status,
      order_status,
      shipping_address,
      notes
    )
    VALUES (
      v_user_id,
      v_order_number,
      v_subtotal,
      0,
      0,
      v_subtotal,
      'pending',
      'pending',
      pg_catalog.jsonb_build_object(
        'id', v_address.id,
        'label', v_address.label,
        'recipient_name', v_address.recipient_name,
        'phone_number', v_address.phone_number,
        'address_line', v_address.address_line,
        'city', v_address.city,
        'province', v_address.province,
        'postal_code', v_address.postal_code
      ),
      ''
    )
    ON CONFLICT (order_number) DO NOTHING
    RETURNING id INTO v_order_id;

    EXIT WHEN v_order_id IS NOT NULL;
  END LOOP;

  IF v_order_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'checkout_order_number_unavailable';
  END IF;

  FOR v_item IN
    SELECT
      cart_item.product_id,
      cart_item.variant_id,
      cart_item.quantity,
      product.title,
      variant.sku,
      variant.label AS variant_label,
      variant.price,
      COALESCE(
        (
          SELECT pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'group', option_group.name,
              'value', option_value.value
            )
            ORDER BY option_group.sort_order, option_value.sort_order
          )
          FROM public.product_variant_option_values AS mapping
          JOIN public.product_option_groups AS option_group
            ON option_group.id = mapping.option_group_id
           AND option_group.product_id = mapping.product_id
          JOIN public.product_option_values AS option_value
            ON option_value.id = mapping.option_value_id
           AND option_value.product_id = mapping.product_id
           AND option_value.option_group_id = mapping.option_group_id
          WHERE mapping.variant_id = variant.id
        ),
        '[]'::jsonb
      ) AS option_snapshot
    FROM public.cart_items AS cart_item
    JOIN public.products AS product
      ON product.id = cart_item.product_id
    JOIN public.product_variants AS variant
      ON variant.id = cart_item.variant_id
     AND variant.product_id = cart_item.product_id
    WHERE cart_item.cart_id = v_cart_id
      AND cart_item.id = ANY(v_cart_item_ids)
    ORDER BY variant.id
  LOOP
    INSERT INTO public.order_items (
      order_id,
      product_id,
      product_title,
      quantity,
      unit_price,
      subtotal,
      variant_id,
      variant_sku_snapshot,
      variant_label_snapshot,
      variant_options_snapshot
    )
    VALUES (
      v_order_id,
      v_item.product_id,
      v_item.title,
      v_item.quantity,
      v_item.price,
      v_item.price * v_item.quantity,
      v_item.variant_id,
      v_item.sku,
      v_item.variant_label,
      v_item.option_snapshot
    )
    RETURNING id INTO v_order_item_id;

    UPDATE public.product_variants AS variant
    SET stock = variant.stock - v_item.quantity,
        updated_at = pg_catalog.now()
    WHERE variant.id = v_item.variant_id
      AND variant.stock >= v_item.quantity
    RETURNING variant.id INTO v_updated_variant_id;

    IF v_updated_variant_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'checkout_stock_insufficient';
    END IF;

    INSERT INTO public.inventory_movements (
      variant_id, order_id, order_item_id, movement_type, quantity_delta, reason, created_by
    )
    VALUES (
      v_item.variant_id,
      v_order_id,
      v_order_item_id,
      'checkout_decrement',
      -v_item.quantity,
      'Checkout ' || v_order_number,
      v_user_id
    );
  END LOOP;

  -- Keep legacy product listing summaries accurate. Each actual unit's price/stock
  -- remains on product_variants; products.stock represents aggregate active stock.
  UPDATE public.products AS product
  SET
    stock = COALESCE((
      SELECT pg_catalog.sum(variant.stock)::integer
      FROM public.product_variants AS variant
      WHERE variant.product_id = product.id
        AND variant.status = 'active'
    ), 0),
    updated_at = pg_catalog.now()
  WHERE product.id IN (
    SELECT cart_item.product_id
    FROM public.cart_items AS cart_item
    WHERE cart_item.id = ANY(v_cart_item_ids)
  );

  DELETE FROM public.cart_items
  WHERE cart_id = v_cart_id
    AND id = ANY(v_cart_item_ids);

  RETURN v_order_id;
END;
$checkout_catalog_variant$;

-- Cancellation restores variant stock once, from the movement ledger.
-- Legacy orders that have no checkout_decrement movements are not changed.
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
  v_current_status text;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_order_status_forbidden';
  END IF;

  IF p_order_id IS NULL OR p_order_status IS NULL OR p_order_status NOT IN (
    'pending', 'processing', 'shipped', 'delivered', 'completed', 'cancelled'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_order_status_invalid';
  END IF;

  SELECT target_order.order_status
  INTO v_current_status
  FROM public.orders AS target_order
  WHERE target_order.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'admin_order_not_found';
  END IF;

  IF v_current_status = 'cancelled' AND p_order_status <> 'cancelled' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_order_cancelled_terminal';
  END IF;

  IF p_order_status = 'cancelled' THEN
    IF v_current_status IN ('shipped', 'delivered', 'completed') THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_order_cannot_cancel_after_shipment';
    END IF;

    WITH prior_sales AS (
      SELECT
        movement.variant_id,
        movement.order_item_id,
        -movement.quantity_delta AS restore_quantity
      FROM public.inventory_movements AS movement
      WHERE movement.order_id = p_order_id
        AND movement.movement_type = 'checkout_decrement'
        AND movement.order_item_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.inventory_movements AS existing_restore
          WHERE existing_restore.order_item_id = movement.order_item_id
            AND existing_restore.movement_type = 'order_cancel_restore'
        )
    ),
    restored AS (
      INSERT INTO public.inventory_movements(
        variant_id, order_id, order_item_id, movement_type, quantity_delta, reason, created_by
      )
      SELECT
        sale.variant_id,
        p_order_id,
        sale.order_item_id,
        'order_cancel_restore',
        sale.restore_quantity,
        'Cancellation restore',
        auth.uid()
      FROM prior_sales AS sale
      ON CONFLICT DO NOTHING
      RETURNING variant_id, quantity_delta
    ),
    totals AS (
      SELECT restored.variant_id, pg_catalog.sum(restored.quantity_delta) AS restore_quantity
      FROM restored
      GROUP BY restored.variant_id
    )
    UPDATE public.product_variants AS variant
    SET stock = variant.stock + totals.restore_quantity,
        updated_at = pg_catalog.now()
    FROM totals
    WHERE variant.id = totals.variant_id;

    UPDATE public.products AS product
    SET
      stock = COALESCE((
        SELECT pg_catalog.sum(variant.stock)::integer
        FROM public.product_variants AS variant
        WHERE variant.product_id = product.id
          AND variant.status = 'active'
      ), 0),
      updated_at = pg_catalog.now()
    WHERE product.id IN (
      SELECT DISTINCT variant.product_id
      FROM public.product_variants AS variant
      JOIN public.order_items AS item ON item.variant_id = variant.id
      WHERE item.order_id = p_order_id
    );
  END IF;

  UPDATE public.orders AS target_order
  SET order_status = p_order_status
  WHERE target_order.id = p_order_id;
END;
$admin_update_order_status$;

-- Harden function execute privileges. Browser roles may invoke only the narrow
-- authenticated RPCs; they receive no direct DML on inventory movements.
ALTER FUNCTION public.admin_create_product_option_group(uuid, text, boolean, integer) OWNER TO postgres;
ALTER FUNCTION public.admin_create_product_option_value(uuid, text, integer) OWNER TO postgres;
ALTER FUNCTION public.admin_create_product_variant(uuid, text, text, numeric, integer, text, text) OWNER TO postgres;
ALTER FUNCTION public.admin_update_product_variant(uuid, text, text, numeric, integer, text, text) OWNER TO postgres;
ALTER FUNCTION public.admin_set_variant_option_values(uuid, uuid[]) OWNER TO postgres;
ALTER FUNCTION public.cart_add_variant(uuid, uuid, integer) OWNER TO postgres;
ALTER FUNCTION public.cart_update_item_quantity(uuid, integer) OWNER TO postgres;
ALTER FUNCTION public.cart_remove_item(uuid) OWNER TO postgres;
ALTER FUNCTION public.cart_clear_items() OWNER TO postgres;
ALTER FUNCTION public.checkout_catalog_variant(uuid) OWNER TO postgres;
ALTER FUNCTION public.admin_update_order_status(uuid, text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.admin_create_product_option_group(uuid, text, boolean, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_create_product_option_value(uuid, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_create_product_variant(uuid, text, text, numeric, integer, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_product_variant(uuid, text, text, numeric, integer, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_variant_option_values(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cart_add_variant(uuid, uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cart_update_item_quantity(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cart_remove_item(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cart_clear_items() FROM PUBLIC, anon;
-- Disable the legacy checkout RPC after the variant-aware checkout is deployed.
-- Otherwise authenticated users could keep creating orders through the old
-- function, which validates but does not decrement inventory.
REVOKE ALL ON FUNCTION public.checkout_catalog(uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.checkout_catalog_variant(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_order_status(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_create_product_option_group(uuid, text, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_product_option_value(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_product_variant(uuid, text, text, numeric, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_product_variant(uuid, text, text, numeric, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_variant_option_values(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cart_add_variant(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cart_update_item_quantity(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cart_remove_item(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cart_clear_items() TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_catalog_variant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_order_status(uuid, text) TO authenticated;

COMMIT;
