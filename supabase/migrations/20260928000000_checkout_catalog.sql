CREATE OR REPLACE FUNCTION public.checkout_catalog(p_address_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $checkout$
DECLARE
  v_user_id uuid := auth.uid();
  v_cart_id uuid;
  v_address public.addresses%ROWTYPE;
  v_cart_item_ids uuid[] := ARRAY[]::uuid[];
  v_cart_item_count bigint;
  v_joined_item_count bigint;
  v_subtotal numeric := 0;
  v_order_id uuid;
  v_order_number text;
  v_attempt integer;
  v_item record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '28000',
      MESSAGE = 'checkout_unauthenticated';
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
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'checkout_address_invalid';
  END IF;

  SELECT cart.id
  INTO v_cart_id
  FROM public.carts AS cart
  WHERE cart.user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'checkout_cart_empty';
  END IF;

  PERFORM 1
  FROM public.cart_items AS cart_item
  WHERE cart_item.cart_id = v_cart_id
  FOR UPDATE;

  SELECT pg_catalog.count(*)
  INTO v_cart_item_count
  FROM public.cart_items AS cart_item
  WHERE cart_item.cart_id = v_cart_id;

  IF v_cart_item_count = 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'checkout_cart_empty';
  END IF;

  SELECT pg_catalog.count(*)
  INTO v_joined_item_count
  FROM public.cart_items AS cart_item
  JOIN public.products AS product
    ON product.id = cart_item.product_id
  WHERE cart_item.cart_id = v_cart_id;

  IF v_joined_item_count <> v_cart_item_count THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'checkout_product_unavailable';
  END IF;

  FOR v_item IN
    SELECT
      cart_item.id,
      cart_item.product_id,
      cart_item.quantity,
      product.title,
      product.price,
      product.stock,
      product.status,
      product.is_catalog
    FROM public.cart_items AS cart_item
    JOIN public.products AS product
      ON product.id = cart_item.product_id
    WHERE cart_item.cart_id = v_cart_id
    ORDER BY cart_item.created_at, cart_item.id
    FOR UPDATE OF cart_item
    FOR SHARE OF product
  LOOP
    IF v_item.status <> 'active' OR NOT v_item.is_catalog THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'checkout_product_unavailable';
    END IF;

    IF v_item.quantity > v_item.stock THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'checkout_stock_insufficient';
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
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'checkout_order_number_unavailable';
  END IF;

  FOR v_item IN
    SELECT
      cart_item.product_id,
      cart_item.quantity,
      product.title,
      product.price
    FROM public.cart_items AS cart_item
    JOIN public.products AS product
      ON product.id = cart_item.product_id
    WHERE cart_item.cart_id = v_cart_id
      AND cart_item.id = ANY(v_cart_item_ids)
    ORDER BY cart_item.created_at, cart_item.id
  LOOP
    INSERT INTO public.order_items (
      order_id,
      product_id,
      product_title,
      quantity,
      unit_price,
      subtotal
    )
    VALUES (
      v_order_id,
      v_item.product_id,
      v_item.title,
      v_item.quantity,
      v_item.price,
      v_item.price * v_item.quantity
    );
  END LOOP;

  DELETE FROM public.cart_items
  WHERE cart_id = v_cart_id
    AND id = ANY(v_cart_item_ids);

  RETURN v_order_id;
END;
$checkout$;

REVOKE ALL ON FUNCTION public.checkout_catalog(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkout_catalog(uuid) TO authenticated;