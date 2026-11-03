BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(1);

CREATE TEMP TABLE product_variant_integrity_test_ids (
  admin_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  other_customer_id uuid NOT NULL,
  product_id uuid,
  legacy_product_id uuid,
  option_group_id uuid,
  required_option_group_id uuid,
  red_value_id uuid,
  blue_value_id uuid,
  green_value_id uuid,
  variant_id uuid,
  other_variant_id uuid,
  legacy_variant_id uuid,
  cart_item_id uuid,
  admin_address_id uuid,
  customer_address_id uuid,
  other_address_id uuid,
  order_id uuid
);

DO $setup$
DECLARE
  v_admin_id uuid := gen_random_uuid();
  v_customer_id uuid := gen_random_uuid();
  v_other_customer_id uuid := gen_random_uuid();
  v_product_id uuid;
  v_legacy_product_id uuid;
  v_option_group_id uuid;
  v_red_value_id uuid;
  v_blue_value_id uuid;
  v_green_value_id uuid;
  v_variant_id uuid;
  v_other_variant_id uuid;
  v_legacy_variant_id uuid;
  v_admin_address_id uuid;
  v_customer_address_id uuid;
  v_other_address_id uuid;
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  VALUES
    (
      v_admin_id, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', v_admin_id::text || '@variant-integrity.test',
      '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()
    ),
    (
      v_customer_id, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', v_customer_id::text || '@variant-integrity.test',
      '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()
    ),
    (
      v_other_customer_id, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', v_other_customer_id::text || '@variant-integrity.test',
      '', pg_catalog.now(), '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()
    );

  INSERT INTO public.profiles(id, full_name, phone_number, avatar_url, role)
  VALUES
    (v_admin_id, 'Variant test admin', '', '', 'admin'),
    (v_customer_id, 'Variant test customer', '', '', 'customer'),
    (v_other_customer_id, 'Variant test other customer', '', '', 'customer')
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      phone_number = EXCLUDED.phone_number,
      avatar_url = EXCLUDED.avatar_url,
      role = EXCLUDED.role;

  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_admin_id::text, true);
  v_product_id := public.admin_create_product(
    'Variant integrity product',
    NULL,
    'Regression',
    100,
    20,
    NULL,
    true,
    'active',
    false,
    'variant-integrity-' || pg_catalog.replace(gen_random_uuid()::text, '-', '')
  );

  v_option_group_id := public.admin_create_product_option_group(
    v_product_id, 'Color', false, 0
  );
  v_red_value_id := public.admin_create_product_option_value(v_option_group_id, 'Red', 0);
  v_blue_value_id := public.admin_create_product_option_value(v_option_group_id, 'Blue', 1);
  v_green_value_id := public.admin_create_product_option_value(v_option_group_id, 'Green', 2);

  v_variant_id := public.admin_create_product_variant_with_options(
    v_product_id, 'TEST-RED-' || pg_catalog.substr(v_product_id::text, 1, 8),
    'Red variant', 90, 5, 'active', NULL, ARRAY[v_red_value_id]
  );
  v_other_variant_id := public.admin_create_product_variant_with_options(
    v_product_id, 'TEST-BLUE-' || pg_catalog.substr(v_product_id::text, 1, 8),
    'Blue variant', 100, 3, 'active', NULL, ARRAY[v_blue_value_id]
  );

  v_legacy_product_id := public.admin_create_product(
    'Legacy cart product',
    NULL,
    'Regression',
    50,
    4,
    NULL,
    true,
    'active',
    false,
    'legacy-integrity-' || pg_catalog.replace(gen_random_uuid()::text, '-', '')
  );
  SELECT variant.id
  INTO v_legacy_variant_id
  FROM public.product_variants AS variant
  WHERE variant.product_id = v_legacy_product_id
    AND variant.sku = 'LEGACY-' || pg_catalog.replace(v_legacy_product_id::text, '-', '');

  v_admin_address_id := gen_random_uuid();
  v_customer_address_id := gen_random_uuid();
  v_other_address_id := gen_random_uuid();
  INSERT INTO public.addresses (
    id, user_id, label, recipient_name, phone_number,
    address_line, city, province, postal_code, is_default
  )
  VALUES
    (v_admin_address_id, v_admin_id, 'Test', 'Admin', '000',
      'Admin address', 'Test city', 'Test province', '00000', true),
    (v_customer_address_id, v_customer_id, 'Test', 'Customer', '000',
      'Customer address', 'Test city', 'Test province', '00000', true),
    (v_other_address_id, v_other_customer_id, 'Test', 'Other customer', '000',
      'Other address', 'Test city', 'Test province', '00000', true);

  INSERT INTO product_variant_integrity_test_ids (
    admin_id, customer_id, other_customer_id, product_id, legacy_product_id,
    option_group_id, red_value_id, blue_value_id, green_value_id,
    variant_id, other_variant_id, legacy_variant_id,
    admin_address_id, customer_address_id, other_address_id
  )
  VALUES (
    v_admin_id, v_customer_id, v_other_customer_id, v_product_id, v_legacy_product_id,
    v_option_group_id, v_red_value_id, v_blue_value_id, v_green_value_id,
    v_variant_id, v_other_variant_id, v_legacy_variant_id,
    v_admin_address_id, v_customer_address_id, v_other_address_id
  );
END;
$setup$;

DO $test_admin_update_creates_missing_default_variant$
DECLARE
  v_ids product_variant_integrity_test_ids%ROWTYPE;
  v_product_id uuid;
  v_existing_product_id uuid;
  v_option_default_before public.product_variants%ROWTYPE;
  v_option_default_after public.product_variants%ROWTYPE;
  v_existing_default_before_disable public.product_variants%ROWTYPE;
  v_existing_default_after_disable public.product_variants%ROWTYPE;
  v_default_count bigint;
  v_default_variant public.product_variants%ROWTYPE;
  v_reactivated_product public.products%ROWTYPE;
  v_option_product_after_disable public.products%ROWTYPE;
  v_option_product_after_enable public.products%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_ids FROM product_variant_integrity_test_ids;
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub', v_ids.admin_id::text, true
  );

  v_product_id := public.admin_create_product(
    'Catalog toggle regression product',
    NULL,
    'Regression',
    75,
    6,
    NULL,
    false,
    'active',
    false,
    'catalog-toggle-' || pg_catalog.replace(gen_random_uuid()::text, '-', '')
  );

  PERFORM public.admin_update_product(
    v_product_id,
    'Catalog toggle regression product',
    NULL,
    'Regression',
    75,
    6,
    NULL,
    true,
    'active',
    false
  );

  SELECT count(*)
  INTO v_default_count
  FROM public.product_variants AS variant
  WHERE variant.product_id = v_product_id
    AND variant.sku = 'LEGACY-' || pg_catalog.replace(v_product_id::text, '-', '');

  IF v_default_count <> 1 THEN
    RAISE EXCEPTION 'enabling catalog did not create exactly one legacy default variant';
  END IF;

  SELECT variant.*
  INTO STRICT v_default_variant
  FROM public.product_variants AS variant
  WHERE variant.product_id = v_product_id
    AND variant.sku = 'LEGACY-' || pg_catalog.replace(v_product_id::text, '-', '');

  IF v_default_variant.price <> 75
    OR v_default_variant.stock <> 6
    OR v_default_variant.status <> 'active'
  THEN
    RAISE EXCEPTION 'new default variant did not inherit the edited product price, stock, and status';
  END IF;

  v_existing_product_id := public.admin_create_product(
    'Existing default regression product',
    NULL,
    'Regression',
    75,
    6,
    'https://example.test/initial.png',
    true,
    'active',
    false,
    'existing-default-' || pg_catalog.replace(gen_random_uuid()::text, '-', '')
  );

  SELECT variant.*
  INTO STRICT v_existing_default_before_disable
  FROM public.product_variants AS variant
  WHERE variant.product_id = v_existing_product_id
    AND variant.sku = 'LEGACY-' || pg_catalog.replace(v_existing_product_id::text, '-', '');

  PERFORM public.admin_update_product(
    v_existing_product_id,
    'Existing default regression product',
    NULL,
    'Regression',
    82,
    7,
    'https://example.test/disabled.png',
    false,
    'inactive',
    false
  );

  SELECT product.*
  INTO STRICT v_reactivated_product
  FROM public.products AS product
  WHERE product.id = v_existing_product_id;

  SELECT variant.*
  INTO STRICT v_existing_default_after_disable
  FROM public.product_variants AS variant
  WHERE variant.product_id = v_existing_product_id
    AND variant.sku = 'LEGACY-' || pg_catalog.replace(v_existing_product_id::text, '-', '');

  IF v_reactivated_product.price IS DISTINCT FROM 82
    OR v_reactivated_product.stock IS DISTINCT FROM 7
    OR v_reactivated_product.status IS DISTINCT FROM 'inactive'
    OR v_existing_default_after_disable IS DISTINCT FROM v_existing_default_before_disable
  THEN
    RAISE EXCEPTION 'disabling catalog did not keep product inputs authoritative and preserve the default variant';
  END IF;

  PERFORM public.admin_update_product(
    v_existing_product_id,
    'Existing default regression product',
    NULL,
    'Regression',
    99,
    9,
    'https://example.test/reactivated.png',
    true,
    'active',
    false
  );

  SELECT count(*)
  INTO v_default_count
  FROM public.product_variants AS variant
  WHERE variant.product_id = v_existing_product_id
    AND variant.sku = 'LEGACY-' || pg_catalog.replace(v_existing_product_id::text, '-', '');

  IF v_default_count <> 1 THEN
    RAISE EXCEPTION 'reactivating catalog duplicated an existing legacy default variant';
  END IF;

  SELECT variant.*
  INTO STRICT v_default_variant
  FROM public.product_variants AS variant
  WHERE variant.product_id = v_existing_product_id
    AND variant.sku = 'LEGACY-' || pg_catalog.replace(v_existing_product_id::text, '-', '');

  IF v_default_variant.price IS DISTINCT FROM 99
    OR v_default_variant.stock IS DISTINCT FROM 9
    OR v_default_variant.status IS DISTINCT FROM 'active'
    OR v_default_variant.image_url IS DISTINCT FROM 'https://example.test/reactivated.png'
    OR v_default_variant.id IS DISTINCT FROM v_existing_default_before_disable.id
  THEN
    RAISE EXCEPTION 'reactivating catalog did not update the existing default variant';
  END IF;

  SELECT product.*
  INTO STRICT v_reactivated_product
  FROM public.products AS product
  WHERE product.id = v_existing_product_id;

  IF v_reactivated_product.price IS DISTINCT FROM (
      SELECT pg_catalog.min(variant.price)
      FROM public.product_variants AS variant
      WHERE variant.product_id = v_existing_product_id
        AND variant.status = 'active'
    )
    OR v_reactivated_product.stock IS DISTINCT FROM COALESCE((
      SELECT pg_catalog.sum(variant.stock)::integer
      FROM public.product_variants AS variant
      WHERE variant.product_id = v_existing_product_id
        AND variant.status = 'active'
    ), 0)
    OR v_reactivated_product.status IS DISTINCT FROM 'active'
    OR v_reactivated_product.image_url IS DISTINCT FROM 'https://example.test/reactivated.png'
  THEN
    RAISE EXCEPTION 'reactivated catalog product summary or metadata is inconsistent';
  END IF;

  IF v_reactivated_product.price IS DISTINCT FROM 99
    OR v_reactivated_product.stock IS DISTINCT FROM 9
  THEN
    RAISE EXCEPTION 'reactivated no-option product summary did not match its default variant';
  END IF;

  PERFORM public.admin_update_product(
    v_existing_product_id,
    'Existing default regression product',
    NULL,
    'Regression',
    123,
    42,
    'https://example.test/disabled-again.png',
    true,
    'inactive',
    false
  );

  SELECT product.*
  INTO STRICT v_reactivated_product
  FROM public.products AS product
  WHERE product.id = v_existing_product_id;

  IF v_reactivated_product.price IS DISTINCT FROM 123
    OR v_reactivated_product.stock IS DISTINCT FROM 0
    OR v_reactivated_product.status IS DISTINCT FROM 'inactive'
  THEN
    RAISE EXCEPTION 'disabling a catalog default did not retain input price, zero stock, and requested status';
  END IF;

  SELECT variant.*
  INTO STRICT v_option_default_before
  FROM public.product_variants AS variant
  WHERE variant.product_id = v_ids.product_id
    AND variant.sku = 'LEGACY-' || pg_catalog.replace(v_ids.product_id::text, '-', '');

  UPDATE public.products
  SET price = 999, stock = 999
  WHERE id = v_ids.product_id;

  PERFORM public.admin_update_product(
    v_ids.product_id,
    'Variant integrity product',
    NULL,
    'Regression',
    999,
    999,
    'https://example.test/ignored.png',
    false,
    'inactive',
    false
  );

  SELECT product.*
  INTO STRICT v_option_product_after_disable
  FROM public.products AS product
  WHERE product.id = v_ids.product_id;

  UPDATE public.products
  SET price = 999, stock = 999
  WHERE id = v_ids.product_id;

  PERFORM public.admin_update_product(
    v_ids.product_id,
    'Variant integrity product',
    NULL,
    'Regression',
    999,
    999,
    'https://example.test/ignored.png',
    true,
    'active',
    false
  );

  SELECT product.*
  INTO STRICT v_option_product_after_enable
  FROM public.products AS product
  WHERE product.id = v_ids.product_id;

  IF v_option_product_after_disable.price IS DISTINCT FROM 90
    OR v_option_product_after_disable.stock IS DISTINCT FROM 8
    OR v_option_product_after_disable.status IS DISTINCT FROM 'inactive'
    OR v_option_product_after_enable.price IS DISTINCT FROM 90
    OR v_option_product_after_enable.stock IS DISTINCT FROM 8
    OR v_option_product_after_enable.status IS DISTINCT FROM 'active'
  THEN
    RAISE EXCEPTION 'catalog transitions did not restore active option variant summary and requested product status';
  END IF;

  SELECT count(*)
  INTO v_default_count
  FROM public.product_variants AS variant
  WHERE variant.product_id = v_ids.product_id
    AND variant.sku = 'LEGACY-' || pg_catalog.replace(v_ids.product_id::text, '-', '');

  IF v_default_count <> 1 THEN
    RAISE EXCEPTION 'reactivating catalog with option groups changed the default variant count';
  END IF;

  SELECT variant.*
  INTO STRICT v_option_default_after
  FROM public.product_variants AS variant
  WHERE variant.product_id = v_ids.product_id
    AND variant.sku = 'LEGACY-' || pg_catalog.replace(v_ids.product_id::text, '-', '');

  IF v_option_default_after.id IS DISTINCT FROM v_option_default_before.id
    OR v_option_default_after.product_id IS DISTINCT FROM v_option_default_before.product_id
    OR v_option_default_after.sku IS DISTINCT FROM v_option_default_before.sku
    OR v_option_default_after.label IS DISTINCT FROM v_option_default_before.label
    OR v_option_default_after.price IS DISTINCT FROM v_option_default_before.price
    OR v_option_default_after.stock IS DISTINCT FROM v_option_default_before.stock
    OR v_option_default_after.status IS DISTINCT FROM v_option_default_before.status
    OR v_option_default_after.status IS DISTINCT FROM 'inactive'
    OR v_option_default_after.image_url IS DISTINCT FROM v_option_default_before.image_url
    OR v_option_default_after.option_signature IS DISTINCT FROM v_option_default_before.option_signature
    OR v_option_default_after.created_at IS DISTINCT FROM v_option_default_before.created_at
    OR v_option_default_after.updated_at IS DISTINCT FROM v_option_default_before.updated_at
  THEN
    RAISE EXCEPTION 'reactivating catalog with option groups overwrote default variant data';
  END IF;

  UPDATE public.product_variants
  SET status = 'inactive'
  WHERE product_id = v_ids.product_id
    AND id IN (v_ids.variant_id, v_ids.other_variant_id);

  UPDATE public.products
  SET price = 321, stock = 654
  WHERE id = v_ids.product_id;

  PERFORM public.admin_update_product(
    v_ids.product_id,
    'Variant integrity product',
    NULL,
    'Regression',
    999,
    999,
    'https://example.test/ignored.png',
    true,
    'inactive',
    false
  );

  SELECT product.*
  INTO STRICT v_reactivated_product
  FROM public.products AS product
  WHERE product.id = v_ids.product_id;

  IF v_reactivated_product.price IS DISTINCT FROM 321
    OR v_reactivated_product.stock IS DISTINCT FROM 0
    OR v_reactivated_product.status IS DISTINCT FROM 'inactive'
    OR EXISTS (
      SELECT 1
      FROM public.product_variants AS variant
      WHERE variant.product_id = v_ids.product_id
        AND variant.id IN (v_ids.variant_id, v_ids.other_variant_id)
        AND variant.status <> 'inactive'
    )
  THEN
    RAISE EXCEPTION 'product summary with no active option variants did not retain its prior price and zero stock';
  END IF;

  UPDATE public.product_variants
  SET status = 'active'
  WHERE product_id = v_ids.product_id
    AND id IN (v_ids.variant_id, v_ids.other_variant_id);

  UPDATE public.products
  SET price = 90, stock = 8, status = 'active'
  WHERE id = v_ids.product_id;
END;
$test_admin_update_creates_missing_default_variant$;

SET CONSTRAINTS ALL IMMEDIATE;

GRANT SELECT ON product_variant_integrity_test_ids TO authenticated;
SET LOCAL ROLE authenticated;
DO $test_variant_read_policies$
DECLARE
  v_ids product_variant_integrity_test_ids%ROWTYPE;
  v_inactive_variant_id uuid;
  v_visible_count bigint;
BEGIN
  SELECT * INTO STRICT v_ids FROM product_variant_integrity_test_ids;
  SELECT variant.id INTO STRICT v_inactive_variant_id
  FROM public.product_variants AS variant
  WHERE variant.product_id = v_ids.product_id
    AND variant.sku = 'LEGACY-' || pg_catalog.replace(v_ids.product_id::text, '-', '');

  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub', v_ids.admin_id::text, true
  );
  SELECT count(*) INTO v_visible_count
  FROM public.product_variants AS variant
  WHERE variant.id = v_inactive_variant_id;
  IF v_visible_count <> 1 THEN
    RAISE EXCEPTION 'admin could not read an inactive product variant';
  END IF;

  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub', v_ids.customer_id::text, true
  );
  SELECT count(*) INTO v_visible_count
  FROM public.product_variants AS variant
  WHERE variant.id = v_inactive_variant_id;
  IF v_visible_count <> 0 THEN
    RAISE EXCEPTION 'customer could read an inactive product variant';
  END IF;
END;
$test_variant_read_policies$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $test_legacy_checkout_execute$
DECLARE
  v_ids product_variant_integrity_test_ids%ROWTYPE;
  v_rejected boolean := false;
  v_error_code text;
BEGIN
  SELECT * INTO STRICT v_ids FROM product_variant_integrity_test_ids;
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub', v_ids.other_customer_id::text, true
  );

  IF pg_catalog.has_function_privilege(
    current_user, 'public.checkout_catalog(uuid)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated can still execute the legacy checkout RPC';
  END IF;
  IF NOT pg_catalog.has_function_privilege(
    current_user, 'public.checkout_catalog_variant(uuid)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated cannot execute the variant checkout RPC';
  END IF;

  BEGIN
    PERFORM public.checkout_catalog(v_ids.other_address_id);
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS v_error_code = RETURNED_SQLSTATE;
    v_rejected := v_error_code = '42501';
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'legacy checkout RPC was not rejected for insufficient privilege';
  END IF;

  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub', v_ids.admin_id::text, true
  );
END;
$test_legacy_checkout_execute$;
RESET ROLE;

DO $test_mapping_integrity$
DECLARE
  v_ids product_variant_integrity_test_ids%ROWTYPE;
  v_signature uuid[];
  v_rejected boolean;
  v_error_message text;
  v_default_variant_id uuid;
  v_variant_id uuid;
  v_product_price numeric;
  v_product_stock integer;
BEGIN
  SELECT * INTO STRICT v_ids FROM product_variant_integrity_test_ids;

  SELECT product.price, product.stock
  INTO v_product_price, v_product_stock
  FROM public.products AS product
  WHERE product.id = v_ids.product_id;
  IF v_product_price <> 90 OR v_product_stock <> 8 THEN
    RAISE EXCEPTION 'variant creation did not synchronize product price and stock summaries';
  END IF;

  PERFORM public.admin_update_product_variant_with_options(
    v_ids.variant_id,
    'TEST-RED-' || pg_catalog.substr(v_ids.product_id::text, 1, 8),
    'Red variant',
    110,
    5,
    'active',
    NULL,
    ARRAY[v_ids.red_value_id]
  );
  SELECT product.price
  INTO v_product_price
  FROM public.products AS product
  WHERE product.id = v_ids.product_id;
  IF v_product_price <> 100 THEN
    RAISE EXCEPTION 'variant price update did not recalculate the minimum product price';
  END IF;

  PERFORM public.admin_update_product_variant_with_options(
    v_ids.variant_id,
    'TEST-RED-' || pg_catalog.substr(v_ids.product_id::text, 1, 8),
    'Red variant',
    90,
    5,
    'active',
    NULL,
    ARRAY[v_ids.red_value_id]
  );

  SELECT variant.option_signature
  INTO v_signature
  FROM public.product_variants AS variant
  WHERE variant.id = v_ids.variant_id;
  IF v_signature IS DISTINCT FROM ARRAY[v_ids.red_value_id]::uuid[] THEN
    RAISE EXCEPTION 'insert mapping did not populate the variant signature';
  END IF;

  UPDATE public.product_variant_option_values AS mapping
  SET option_value_id = v_ids.green_value_id
  WHERE mapping.variant_id = v_ids.variant_id;

  SELECT variant.option_signature
  INTO v_signature
  FROM public.product_variants AS variant
  WHERE variant.id = v_ids.variant_id;
  IF v_signature IS DISTINCT FROM ARRAY[v_ids.green_value_id]::uuid[] THEN
    RAISE EXCEPTION 'update mapping did not refresh the variant signature';
  END IF;

  DELETE FROM public.product_variant_option_values AS mapping
  WHERE mapping.variant_id = v_ids.variant_id;

  SELECT variant.option_signature
  INTO v_signature
  FROM public.product_variants AS variant
  WHERE variant.id = v_ids.variant_id;
  IF v_signature IS DISTINCT FROM ARRAY[]::uuid[] THEN
    RAISE EXCEPTION 'delete mapping did not refresh the variant signature';
  END IF;

  v_rejected := false;
  BEGIN
    INSERT INTO public.product_variant_option_values (
      variant_id, product_id, option_group_id, option_value_id
    )
    VALUES (
      v_ids.variant_id, v_ids.product_id, v_ids.option_group_id, v_ids.blue_value_id
    );
  EXCEPTION WHEN unique_violation THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'duplicate combinations were accepted by a direct mapping INSERT';
  END IF;

  INSERT INTO public.product_variant_option_values (
    variant_id, product_id, option_group_id, option_value_id
  )
  VALUES (
    v_ids.variant_id, v_ids.product_id, v_ids.option_group_id, v_ids.red_value_id
  );

  v_rejected := false;
  BEGIN
    UPDATE public.product_variant_option_values AS mapping
    SET option_value_id = v_ids.blue_value_id
    WHERE mapping.variant_id = v_ids.variant_id;
  EXCEPTION WHEN unique_violation THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'duplicate combinations were accepted by a direct mapping UPDATE';
  END IF;

  v_rejected := false;
  BEGIN
    v_variant_id := public.admin_create_product_variant_with_options(
      v_ids.product_id,
      'TEST-DUP-' || pg_catalog.substr(v_ids.product_id::text, 1, 8),
      'Duplicate combination',
      100,
      1,
      'active',
      NULL,
      ARRAY[v_ids.red_value_id]
    );
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    v_rejected := v_error_message = 'admin_variant_combination_duplicate';
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'admin RPC accepted a duplicate option combination';
  END IF;

  SELECT variant.id
  INTO STRICT v_default_variant_id
  FROM public.product_variants AS variant
  WHERE variant.product_id = v_ids.product_id
    AND variant.sku = 'LEGACY-' || pg_catalog.replace(v_ids.product_id::text, '-', '');

  v_rejected := false;
  BEGIN
    PERFORM public.admin_update_product_variant_with_options(
      v_default_variant_id,
      'LEGACY-' || pg_catalog.replace(v_ids.product_id::text, '-', ''),
      'Default',
      100,
      20,
      'active',
      NULL,
      ARRAY[]::uuid[]
    );
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    v_rejected := v_error_message = 'product_variant_integrity_invalid_default';
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'an active catalog default was allowed after options were added';
  END IF;
END;
$test_mapping_integrity$;
SET CONSTRAINTS ALL DEFERRED;

DO $test_access_ownership_and_checkout$
DECLARE
  v_ids product_variant_integrity_test_ids%ROWTYPE;
  v_cart_id uuid;
  v_order_id uuid;
  v_cart_item_id uuid;
  v_other_cart_item_id uuid;
  v_quantity integer;
  v_rejected boolean;
  v_error_message text;
  v_sku_snapshot text;
  v_label_snapshot text;
  v_option_snapshot jsonb;
  v_option_group_id uuid;
  v_required_option_group_id uuid;
  v_orders_before bigint;
  v_stock integer;
  v_product_stock integer;
  v_movement_count bigint;
BEGIN
  SELECT * INTO STRICT v_ids FROM product_variant_integrity_test_ids;

  IF pg_catalog.has_function_privilege(
    'authenticated', 'public.checkout_catalog(uuid)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'the authenticated role can execute the legacy checkout RPC';
  END IF;

  IF pg_catalog.has_column_privilege(
    'authenticated', 'public.order_items', 'variant_sku_snapshot', 'INSERT'
  ) OR pg_catalog.has_column_privilege(
    'authenticated', 'public.order_items', 'variant_options_snapshot', 'UPDATE'
  ) THEN
    RAISE EXCEPTION 'authenticated users can directly write variant order snapshots';
  END IF;

  IF pg_catalog.has_table_privilege(
    'authenticated', 'public.product_variant_option_values', 'UPDATE'
  ) THEN
    RAISE EXCEPTION 'authenticated users can directly update variant mappings';
  END IF;

  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_ids.customer_id::text, true);
  PERFORM public.cart_add_variant(v_ids.product_id, v_ids.variant_id, 2);
  PERFORM public.cart_add_variant(v_ids.product_id, v_ids.other_variant_id, 1);

  SELECT cart.id INTO STRICT v_cart_id
  FROM public.carts AS cart
  WHERE cart.user_id = v_ids.customer_id;

  SELECT count(*) INTO v_movement_count
  FROM public.cart_items AS item
  WHERE item.cart_id = v_cart_id
    AND item.product_id = v_ids.product_id;
  IF v_movement_count <> 2 THEN
    RAISE EXCEPTION 'cart did not retain separate lines for two variants of one product';
  END IF;

  SELECT item.id INTO STRICT v_other_cart_item_id
  FROM public.cart_items AS item
  WHERE item.cart_id = v_cart_id
    AND item.variant_id = v_ids.other_variant_id;
  PERFORM public.cart_remove_item(v_other_cart_item_id);

  SELECT item.id INTO STRICT v_cart_item_id
  FROM public.cart_items AS item
  WHERE item.cart_id = v_cart_id
    AND item.variant_id = v_ids.variant_id;

  v_rejected := false;
  BEGIN
    PERFORM public.admin_create_product_option_group(
      v_ids.product_id, 'Customer must not create this', false, 1
    );
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    v_rejected := v_error_message = 'admin_variant_forbidden';
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'customer access to an admin variant RPC was not denied';
  END IF;

  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub', v_ids.other_customer_id::text, true
  );
  v_rejected := false;
  BEGIN
    PERFORM public.cart_update_item_quantity(v_cart_item_id, 1);
  EXCEPTION WHEN no_data_found THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    v_rejected := v_error_message = 'cart_item_not_found';
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'a customer could update another customer''s cart item';
  END IF;

  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_ids.customer_id::text, true);
  v_rejected := false;
  BEGIN
    PERFORM public.checkout_catalog_variant(v_ids.other_address_id);
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    v_rejected := v_error_message = 'checkout_address_invalid';
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'checkout accepted an address owned by another customer';
  END IF;

  SELECT count(*) INTO v_orders_before
  FROM public.orders AS order_row
  WHERE order_row.user_id = v_ids.customer_id;

  v_order_id := public.checkout_catalog_variant(v_ids.customer_address_id);
  UPDATE product_variant_integrity_test_ids SET order_id = v_order_id;

  SELECT item.quantity, item.variant_sku_snapshot, item.variant_label_snapshot,
         item.variant_options_snapshot
  INTO v_quantity, v_sku_snapshot, v_label_snapshot, v_option_snapshot
  FROM public.order_items AS item
  WHERE item.order_id = v_order_id
    AND item.variant_id = v_ids.variant_id;

  IF v_quantity <> 2
    OR v_option_snapshot IS DISTINCT FROM pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('group', 'Color', 'value', 'Red')
    )
  THEN
    RAISE EXCEPTION 'order item does not preserve quantity and selected option snapshot';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.order_items AS item
    JOIN public.product_variants AS variant ON variant.id = item.variant_id
    WHERE item.order_id = v_order_id
      AND item.variant_id = v_ids.variant_id
      AND v_sku_snapshot = variant.sku
      AND v_label_snapshot = variant.label
      AND item.unit_price = 90
      AND item.subtotal = 180
  ) THEN
    RAISE EXCEPTION 'order item does not preserve variant identity and price snapshots';
  END IF;

  SELECT count(*) INTO v_movement_count
  FROM public.inventory_movements AS movement
  WHERE movement.order_id = v_order_id
    AND movement.variant_id = v_ids.variant_id
    AND movement.movement_type = 'checkout_decrement'
    AND movement.quantity_delta = -2;
  IF v_movement_count <> 1 THEN
    RAISE EXCEPTION 'checkout inventory ledger entry is missing or duplicated';
  END IF;

  SELECT variant.stock INTO v_stock
  FROM public.product_variants AS variant
  WHERE variant.id = v_ids.variant_id;
  SELECT product.stock INTO v_product_stock
  FROM public.products AS product
  WHERE product.id = v_ids.product_id;
  IF v_stock <> 3 OR v_product_stock <> 6 THEN
    RAISE EXCEPTION 'checkout did not synchronize variant and product stock';
  END IF;

  v_rejected := false;
  BEGIN
    PERFORM public.checkout_catalog_variant(v_ids.customer_address_id);
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    v_rejected := v_error_message = 'checkout_cart_empty';
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'a second checkout unexpectedly succeeded for an empty cart';
  END IF;

  SELECT count(*) INTO v_orders_before
  FROM public.orders AS order_row
  WHERE order_row.user_id = v_ids.customer_id;
  SELECT count(*) INTO v_movement_count
  FROM public.inventory_movements AS movement
  WHERE movement.order_id = v_order_id
    AND movement.movement_type = 'checkout_decrement';
  IF v_orders_before <> 1 OR v_movement_count <> 1 THEN
    RAISE EXCEPTION 'repeated checkout created a duplicate order or inventory decrement';
  END IF;

  PERFORM public.cart_add_variant(v_ids.product_id, v_ids.variant_id, 2);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_ids.admin_id::text, true);
  PERFORM public.admin_update_product_variant_with_options(
    v_ids.variant_id,
    'TEST-RED-' || pg_catalog.substr(v_ids.product_id::text, 1, 8),
    'Red variant',
    90,
    1,
    'active',
    NULL,
    ARRAY[v_ids.red_value_id]
  );

  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_ids.customer_id::text, true);
  v_rejected := false;
  BEGIN
    PERFORM public.checkout_catalog_variant(v_ids.customer_address_id);
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    v_rejected := v_error_message = 'checkout_stock_insufficient';
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'checkout accepted a cart quantity greater than current stock';
  END IF;

  SELECT count(*) INTO v_movement_count
  FROM public.cart_items AS item
  WHERE item.id = v_cart_item_id;
  IF v_movement_count <> 0 THEN
    RAISE EXCEPTION 'successful checkout did not clear its own cart item';
  END IF;

  SELECT count(*) INTO v_movement_count
  FROM public.cart_items AS item
  JOIN public.carts AS cart ON cart.id = item.cart_id
  WHERE cart.user_id = v_ids.customer_id
    AND item.variant_id = v_ids.variant_id
    AND item.quantity = 2;
  IF v_movement_count <> 1 THEN
    RAISE EXCEPTION 'failed insufficient-stock checkout changed or removed the cart item';
  END IF;

  SELECT count(*) INTO v_orders_before
  FROM public.orders AS order_row
  WHERE order_row.user_id = v_ids.customer_id;
  SELECT count(*) INTO v_movement_count
  FROM public.inventory_movements AS movement
  WHERE movement.order_id = v_order_id
    AND movement.movement_type = 'checkout_decrement';
  IF v_orders_before <> 1 OR v_movement_count <> 1 THEN
    RAISE EXCEPTION 'failed checkout wrote an order or decremented inventory';
  END IF;

  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub', v_ids.other_customer_id::text, true
  );
  PERFORM public.cart_add_variant(
    v_ids.legacy_product_id, v_ids.legacy_variant_id, 2
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.cart_items AS item
    JOIN public.carts AS cart ON cart.id = item.cart_id
    WHERE cart.user_id = v_ids.other_customer_id
      AND item.product_id = v_ids.legacy_product_id
      AND item.variant_id = v_ids.legacy_variant_id
      AND item.quantity = 2
  ) THEN
    RAISE EXCEPTION 'legacy cart row was not retained before testing disabled variant checkout';
  END IF;
  PERFORM public.cart_clear_items();

  SELECT option_group.id
  INTO v_option_group_id
  FROM public.product_option_groups AS option_group
  WHERE option_group.product_id = v_ids.legacy_product_id;
  IF v_option_group_id IS NOT NULL THEN
    RAISE EXCEPTION 'legacy product unexpectedly has an option group before the test';
  END IF;

  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_ids.admin_id::text, true);
  v_required_option_group_id := public.admin_create_product_option_group(
    v_ids.legacy_product_id, 'Size', true, 0
  );
  PERFORM public.admin_create_product_option_value(
    v_required_option_group_id, 'Small', 0
  );

  SELECT variant.status
  INTO v_error_message
  FROM public.product_variants AS variant
  WHERE variant.id = v_ids.legacy_variant_id;
  IF v_error_message <> 'inactive' THEN
    RAISE EXCEPTION 'legacy default variant was not disabled after adding options';
  END IF;

  SELECT cart.id INTO STRICT v_cart_id
  FROM public.carts AS cart
  WHERE cart.user_id = v_ids.other_customer_id;
  INSERT INTO public.cart_items(cart_id, product_id, variant_id, quantity)
  VALUES (
    v_cart_id, v_ids.legacy_product_id, v_ids.legacy_variant_id, 2
  );

  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub', v_ids.other_customer_id::text, true
  );
  v_rejected := false;
  BEGIN
    PERFORM public.checkout_catalog_variant(v_ids.other_address_id);
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    v_rejected := v_error_message = 'checkout_product_unavailable';
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'checkout accepted a cart item using a disabled legacy default';
  END IF;

  SELECT item.quantity
  INTO v_quantity
  FROM public.cart_items AS item
  JOIN public.carts AS cart ON cart.id = item.cart_id
  WHERE cart.user_id = v_ids.other_customer_id
    AND item.variant_id = v_ids.legacy_variant_id;
  IF v_quantity <> 2 THEN
    RAISE EXCEPTION 'disabled legacy default cart item was changed or removed';
  END IF;
END;
$test_access_ownership_and_checkout$;

SELECT pass('product variant integrity assertions completed');
SELECT * FROM finish();

ROLLBACK;
