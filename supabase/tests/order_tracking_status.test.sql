BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(1);

CREATE TEMP TABLE order_tracking_status_test_ids (
  customer_id uuid NOT NULL,
  other_customer_id uuid NOT NULL,
  own_shipment_id uuid NOT NULL,
  other_shipment_id uuid NOT NULL
);
GRANT SELECT ON order_tracking_status_test_ids TO authenticated;

CREATE TEMP TABLE preflight_missing_order_columns (
  id uuid NOT NULL,
  order_status varchar NOT NULL
);

CREATE TEMP TABLE preflight_legacy_order_status (
  order_status varchar NOT NULL
    CONSTRAINT orders_order_status_check
    CHECK (order_status IN ('pending', 'processing', 'shipped', 'completed', 'cancelled'))
);

CREATE TEMP TABLE preflight_restricted_order_status (
  order_status varchar NOT NULL
    CONSTRAINT orders_order_status_check
    CHECK (order_status IN ('pending', 'processing', 'shipped', 'delivered', 'completed', 'cancelled')),
  CONSTRAINT orders_delivered_guard
    CHECK (order_status <> 'delivered')
);

CREATE TEMP TABLE preflight_deceptive_order_status (
  order_status varchar NOT NULL
    CONSTRAINT orders_order_status_check
    CHECK (
      CASE
        WHEN order_status = 'delivered' THEN false
        ELSE order_status IN ('pending', 'processing', 'shipped', 'delivered', 'completed', 'cancelled')
      END
    )
);

CREATE FUNCTION pg_temp.order_status_preflight_accepts(p_orders oid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $order_status_preflight_accepts$
  SELECT
    pg_catalog.count(*) = 1
    AND pg_catalog.count(*) FILTER (
      WHERE constraint_row.conname = 'orders_order_status_check'
        AND pg_catalog.pg_get_constraintdef(constraint_row.oid) =
          'CHECK (((order_status)::text = ANY ((ARRAY[''pending''::character varying, ''processing''::character varying, ''shipped''::character varying, ''delivered''::character varying, ''completed''::character varying, ''cancelled''::character varying])::text[])))'
    ) = 1
  FROM pg_catalog.pg_constraint AS constraint_row
  JOIN pg_catalog.pg_attribute AS order_status_column
    ON order_status_column.attrelid = constraint_row.conrelid
   AND order_status_column.attname = 'order_status'
   AND order_status_column.attnum = ANY (constraint_row.conkey)
  WHERE constraint_row.conrelid = p_orders
    AND constraint_row.contype = 'c'
$order_status_preflight_accepts$;

CREATE FUNCTION pg_temp.preflight_columns_exist(p_relation oid, p_columns text[])
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $preflight_columns_exist$
  SELECT NOT EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(p_columns) AS required(column_name)
    WHERE NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute AS attribute
      WHERE attribute.attrelid = p_relation
        AND attribute.attname::text = required.column_name
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
    )
  )
$preflight_columns_exist$;

DO $test_order_tracking_status$
DECLARE
  v_admin_id uuid := gen_random_uuid();
  v_customer_id uuid := gen_random_uuid();
  v_other_customer_id uuid := gen_random_uuid();
  v_product_id uuid;
  v_variant_id uuid;
  v_flow_order_id uuid;
  v_invalid_order_id uuid;
  v_cancel_order_id uuid;
  v_legacy_order_id uuid;
  v_shipped_order_id uuid;
  v_shipment_id uuid;
  v_failed_delivery_order_id uuid;
  v_failed_shipment_id uuid;
  v_delivered_order_id uuid;
  v_delivered_shipment_id uuid;
  v_completed_order_id uuid;
  v_completed_shipment_id uuid;
  v_other_order_id uuid;
  v_other_shipment_id uuid;
  v_order_item_id uuid;
  v_status text;
  v_shipment_status text;
  v_log_titles text[];
  v_stock integer;
  v_movement_count bigint;
  v_log_count bigint;
  v_error_message text;
  v_rpc_definition_before text;
  v_rpc_definition_after text;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'public.admin_record_shipment_update(uuid,text,text,text)'::regprocedure
  )
  INTO v_rpc_definition_before;

  IF NOT pg_temp.order_status_preflight_accepts('public.orders'::regclass) THEN
    RAISE EXCEPTION 'canonical order_status constraint was not accepted';
  END IF;
  IF pg_temp.order_status_preflight_accepts(
    'pg_temp.preflight_legacy_order_status'::regclass
  ) THEN
    RAISE EXCEPTION 'legacy order_status constraint passed preflight';
  END IF;
  IF pg_temp.order_status_preflight_accepts(
    'pg_temp.preflight_restricted_order_status'::regclass
  ) THEN
    RAISE EXCEPTION 'additional delivered-restricting CHECK passed preflight';
  END IF;
  IF pg_temp.order_status_preflight_accepts(
    'pg_temp.preflight_deceptive_order_status'::regclass
  ) THEN
    RAISE EXCEPTION 'noncanonical expression that rejects delivered passed preflight';
  END IF;
  IF pg_temp.preflight_columns_exist(
    'pg_temp.preflight_missing_order_columns'::regclass,
    ARRAY['id', 'order_status', 'updated_at']
  ) THEN
    RAISE EXCEPTION 'missing required order column passed preflight';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(
    'public.admin_record_shipment_update(uuid,text,text,text)'::regprocedure
  )
  INTO v_rpc_definition_after;
  IF v_rpc_definition_after IS DISTINCT FROM v_rpc_definition_before THEN
    RAISE EXCEPTION 'preflight fixtures unexpectedly changed the shipment RPC';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      VALUES
        ('public.shipments', 'id'),
        ('public.shipments', 'order_id'),
        ('public.shipments', 'current_status'),
        ('public.shipments', 'updated_at'),
        ('public.orders', 'id'),
        ('public.orders', 'order_status'),
        ('public.orders', 'updated_at'),
        ('public.shipment_logs', 'shipment_id'),
        ('public.shipment_logs', 'status_title'),
        ('public.shipment_logs', 'location'),
        ('public.shipment_logs', 'description')
    ) AS required(table_name, column_name)
    WHERE NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute AS attribute
      WHERE attribute.attrelid = pg_catalog.to_regclass(required.table_name)
        AND attribute.attname = required.column_name
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
    )
  ) THEN
    RAISE EXCEPTION 'shipment tracking migration is missing a required column';
  END IF;

  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES
    (
      v_admin_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_admin_id::text || '@order-status.test',
      '',
      pg_catalog.now(),
      '{}'::jsonb,
      '{}'::jsonb,
      pg_catalog.now(),
      pg_catalog.now()
    ),
    (
      v_customer_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_customer_id::text || '@order-status.test',
      '',
      pg_catalog.now(),
      '{}'::jsonb,
      '{}'::jsonb,
      pg_catalog.now(),
      pg_catalog.now()
    ),
    (
      v_other_customer_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_other_customer_id::text || '@order-status.test',
      '',
      pg_catalog.now(),
      '{}'::jsonb,
      '{}'::jsonb,
      pg_catalog.now(),
      pg_catalog.now()
    );

  UPDATE public.profiles
  SET role = 'admin'
  WHERE id = v_admin_id;

  INSERT INTO public.products (title, slug, price, stock)
  VALUES (
    'Order status test product',
    'order-status-' || pg_catalog.replace(gen_random_uuid()::text, '-', ''),
    10,
    1
  )
  RETURNING id INTO v_product_id;

  INSERT INTO public.product_variants (
    product_id,
    sku,
    label,
    price,
    stock
  )
  VALUES (
    v_product_id,
    'ORDER-STATUS-' || pg_catalog.replace(gen_random_uuid()::text, '-', ''),
    'Default',
    10,
    1
  )
  RETURNING id INTO v_variant_id;

  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub',
    v_admin_id::text,
    true
  );

  INSERT INTO public.orders (user_id, order_number)
  VALUES (
    v_customer_id,
    'KSH-STATUS-FLOW-' || pg_catalog.replace(gen_random_uuid()::text, '-', '')
  )
  RETURNING id INTO v_flow_order_id;

  PERFORM public.admin_update_order_status(v_flow_order_id, 'processing');
  PERFORM public.admin_update_order_status(v_flow_order_id, 'shipped');
  PERFORM public.admin_update_order_status(v_flow_order_id, 'delivered');
  PERFORM public.admin_update_order_status(v_flow_order_id, 'completed');

  SELECT order_status INTO v_status
  FROM public.orders
  WHERE id = v_flow_order_id;
  IF v_status <> 'completed' THEN
    RAISE EXCEPTION 'valid order flow ended at %', v_status;
  END IF;

  BEGIN
    UPDATE public.orders
    SET order_status = 'invalid_status'
    WHERE id = v_flow_order_id;
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'invalid order status unexpectedly passed the table constraint';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  INSERT INTO public.orders (user_id, order_number)
  VALUES (
    v_customer_id,
    'KSH-STATUS-INVALID-' || pg_catalog.replace(gen_random_uuid()::text, '-', '')
  )
  RETURNING id INTO v_invalid_order_id;

  BEGIN
    PERFORM public.admin_update_order_status(v_invalid_order_id, 'completed');
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'invalid order transition unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;

  INSERT INTO public.orders (user_id, order_number)
  VALUES (
    v_customer_id,
    'KSH-STATUS-CANCEL-' || pg_catalog.replace(gen_random_uuid()::text, '-', '')
  )
  RETURNING id INTO v_cancel_order_id;

  INSERT INTO public.order_items (
    order_id,
    product_id,
    product_title,
    quantity,
    unit_price,
    subtotal,
    variant_id
  )
  VALUES (
    v_cancel_order_id,
    v_product_id,
    'Order status test product',
    2,
    10,
    20,
    v_variant_id
  )
  RETURNING id INTO v_order_item_id;

  INSERT INTO public.inventory_movements (
    variant_id,
    order_id,
    order_item_id,
    movement_type,
    quantity_delta,
    reason,
    created_by
  )
  VALUES (
    v_variant_id,
    v_cancel_order_id,
    v_order_item_id,
    'checkout_decrement',
    -2,
    'Order status test checkout',
    v_customer_id
  );

  PERFORM public.admin_update_order_status(v_cancel_order_id, 'cancelled');
  PERFORM public.admin_update_order_status(v_cancel_order_id, 'cancelled');

  SELECT stock INTO v_stock
  FROM public.product_variants
  WHERE id = v_variant_id;
  SELECT pg_catalog.count(*) INTO v_movement_count
  FROM public.inventory_movements
  WHERE order_item_id = v_order_item_id
    AND movement_type = 'order_cancel_restore';
  IF v_stock <> 3 OR v_movement_count <> 1 THEN
    RAISE EXCEPTION
      'cancellation restore was not exactly once (stock %, restores %)',
      v_stock,
      v_movement_count;
  END IF;

  INSERT INTO public.orders (user_id, order_number)
  VALUES (
    v_customer_id,
    'KSH-STATUS-LEGACY-' || pg_catalog.replace(gen_random_uuid()::text, '-', '')
  )
  RETURNING id INTO v_legacy_order_id;

  INSERT INTO public.order_items (
    order_id,
    product_id,
    product_title,
    quantity,
    unit_price,
    subtotal,
    variant_id
  )
  VALUES (
    v_legacy_order_id,
    v_product_id,
    'Order status test product',
    1,
    10,
    10,
    v_variant_id
  );

  PERFORM public.admin_update_order_status(v_legacy_order_id, 'cancelled');
  SELECT stock INTO v_stock
  FROM public.product_variants
  WHERE id = v_variant_id;
  IF v_stock <> 3 THEN
    RAISE EXCEPTION 'cancellation changed stock without a checkout ledger row';
  END IF;

  INSERT INTO public.orders (user_id, order_number, order_status)
  VALUES (
    v_customer_id,
    'KSH-STATUS-SHIPPED-' || pg_catalog.replace(gen_random_uuid()::text, '-', ''),
    'processing'
  )
  RETURNING id INTO v_shipped_order_id;

  v_shipment_id := public.admin_create_shipment(
    v_shipped_order_id,
    'TRACK-' || pg_catalog.replace(gen_random_uuid()::text, '-', '')
  );
  PERFORM public.admin_record_shipment_update(
    v_shipment_id,
    'IN_TRANSIT',
    'Test location',
    'Package is in transit'
  );
  SELECT pg_catalog.array_agg(shipment_log.status_title ORDER BY shipment_log.status_title)
  INTO v_log_titles
  FROM public.shipment_logs AS shipment_log
  WHERE shipment_log.shipment_id = v_shipment_id;
  IF v_log_titles IS DISTINCT FROM ARRAY['IN_TRANSIT', 'SEOUL_WH']::text[] THEN
    RAISE EXCEPTION 'shipment creation/in-transit log titles are incorrect: %', v_log_titles;
  END IF;

  SELECT order_status INTO v_status
  FROM public.orders
  WHERE id = v_shipped_order_id;
  IF v_status <> 'shipped' THEN
    RAISE EXCEPTION 'in-transit evidence did not move the order to shipped';
  END IF;

  BEGIN
    PERFORM public.admin_update_order_status(v_shipped_order_id, 'cancelled');
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'shipped order cancellation unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;

  PERFORM public.admin_record_shipment_update(
    v_shipment_id,
    'CUSTOMS',
    'Test customs',
    'Package entered customs'
  );
  SELECT pg_catalog.array_agg(shipment_log.status_title ORDER BY shipment_log.status_title)
  INTO v_log_titles
  FROM public.shipment_logs AS shipment_log
  WHERE shipment_log.shipment_id = v_shipment_id;
  IF v_log_titles IS DISTINCT FROM ARRAY['CUSTOMS', 'IN_TRANSIT', 'SEOUL_WH']::text[] THEN
    RAISE EXCEPTION 'customs update log titles are incorrect: %', v_log_titles;
  END IF;

  PERFORM public.admin_record_shipment_update(
    v_shipment_id,
    'JAKARTA_WH',
    'Jakarta warehouse',
    'Package reached Jakarta warehouse'
  );
  SELECT pg_catalog.array_agg(shipment_log.status_title ORDER BY shipment_log.status_title)
  INTO v_log_titles
  FROM public.shipment_logs AS shipment_log
  WHERE shipment_log.shipment_id = v_shipment_id;
  IF v_log_titles IS DISTINCT FROM ARRAY[
    'CUSTOMS',
    'IN_TRANSIT',
    'JAKARTA_WH',
    'SEOUL_WH'
  ]::text[] THEN
    RAISE EXCEPTION 'Jakarta warehouse update log titles are incorrect: %', v_log_titles;
  END IF;

  SELECT shipment.current_status INTO v_status
  FROM public.shipments AS shipment
  WHERE shipment.id = v_shipment_id;
  IF v_status <> 'JAKARTA_WH' THEN
    RAISE EXCEPTION 'valid customs-to-Jakarta shipment progression failed';
  END IF;

  PERFORM public.admin_record_shipment_update(
    v_shipment_id,
    'DELIVERED',
    'Customer address',
    'Delivery confirmed'
  );
  SELECT order_status INTO v_status
  FROM public.orders
  WHERE id = v_shipped_order_id;
  SELECT pg_catalog.count(*) INTO v_log_count
  FROM public.shipment_logs
  WHERE shipment_id = v_shipment_id;
  SELECT pg_catalog.array_agg(shipment_log.status_title ORDER BY shipment_log.status_title)
  INTO v_log_titles
  FROM public.shipment_logs AS shipment_log
  WHERE shipment_log.shipment_id = v_shipment_id;
  IF v_status <> 'delivered'
    OR v_log_count <> 5
    OR v_log_titles IS DISTINCT FROM ARRAY[
      'CUSTOMS',
      'DELIVERED',
      'IN_TRANSIT',
      'JAKARTA_WH',
      'SEOUL_WH'
    ]::text[]
  THEN
    RAISE EXCEPTION
      'delivered shipment did not atomically update order and expected logs (status %, logs %, titles %)',
      v_status,
      v_log_count,
      v_log_titles;
  END IF;

  BEGIN
    PERFORM public.admin_record_shipment_update(
      v_shipment_id,
      'DELIVERED',
      'Customer address',
      'Duplicate delivered status'
    );
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'same shipment status unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;

  BEGIN
    PERFORM public.admin_record_shipment_update(
      v_shipment_id,
      'IN_TRANSIT',
      'Test location',
      'Attempted backwards shipment transition'
    );
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'backwards shipment transition unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;

  BEGIN
    PERFORM public.admin_record_shipment_update(
      v_shipment_id,
      'UNKNOWN_STATUS',
      'Test location',
      'Unknown shipment status'
    );
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'unknown shipment status unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;

  SELECT shipment.current_status INTO v_status
  FROM public.shipments AS shipment
  WHERE shipment.id = v_shipment_id;
  SELECT pg_catalog.count(*) INTO v_log_count
  FROM public.shipment_logs
  WHERE shipment_id = v_shipment_id;
  IF v_status <> 'DELIVERED' OR v_log_count <> 5 THEN
    RAISE EXCEPTION
      'rejected backwards transition changed shipment or history (status %, logs %)',
      v_status,
      v_log_count;
  END IF;
  SELECT pg_catalog.array_agg(shipment_log.status_title ORDER BY shipment_log.status_title)
  INTO v_log_titles
  FROM public.shipment_logs AS shipment_log
  WHERE shipment_log.shipment_id = v_shipment_id;
  IF v_log_titles IS DISTINCT FROM ARRAY[
    'CUSTOMS',
    'DELIVERED',
    'IN_TRANSIT',
    'JAKARTA_WH',
    'SEOUL_WH'
  ]::text[] THEN
    RAISE EXCEPTION 'rejected transitions changed shipment log titles: %', v_log_titles;
  END IF;

  PERFORM public.admin_update_order_status(v_shipped_order_id, 'completed');
  BEGIN
    PERFORM public.admin_update_order_status(v_shipped_order_id, 'delivered');
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'completed order status unexpectedly moved backwards';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;

  INSERT INTO public.orders (user_id, order_number)
  VALUES (
    v_customer_id,
    'KSH-STATUS-FAILED-DELIVERY-' || pg_catalog.replace(gen_random_uuid()::text, '-', '')
  )
  RETURNING id INTO v_failed_delivery_order_id;
  v_failed_shipment_id := public.admin_create_shipment(
    v_failed_delivery_order_id,
    'TRACK-' || pg_catalog.replace(gen_random_uuid()::text, '-', '')
  );
  INSERT INTO public.orders (user_id, order_number)
  VALUES (
    v_other_customer_id,
    'KSH-STATUS-OTHER-' || pg_catalog.replace(gen_random_uuid()::text, '-', '')
  )
  RETURNING id INTO v_other_order_id;
  v_other_shipment_id := public.admin_create_shipment(
    v_other_order_id,
    'TRACK-' || pg_catalog.replace(gen_random_uuid()::text, '-', '')
  );

  INSERT INTO public.orders (user_id, order_number, order_status)
  VALUES (
    v_customer_id,
    'KSH-STATUS-DELIVERED-TERMINAL-' || pg_catalog.replace(gen_random_uuid()::text, '-', ''),
    'delivered'
  )
  RETURNING id INTO v_delivered_order_id;
  v_delivered_shipment_id := public.admin_create_shipment(
    v_delivered_order_id,
    'TRACK-' || pg_catalog.replace(gen_random_uuid()::text, '-', '')
  );

  BEGIN
    PERFORM public.admin_record_shipment_update(
      v_delivered_shipment_id,
      'IN_TRANSIT',
      'Test location',
      'Terminal delivered order must not move shipment'
    );
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'delivered order accepted a non-delivered shipment status';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;

  SELECT shipment.current_status INTO v_status
  FROM public.shipments AS shipment
  WHERE shipment.id = v_delivered_shipment_id;
  SELECT pg_catalog.count(*) INTO v_log_count
  FROM public.shipment_logs
  WHERE shipment_id = v_delivered_shipment_id;
  IF v_status <> 'SEOUL_WH' OR v_log_count <> 1 THEN
    RAISE EXCEPTION 'delivered order shipment update was not rolled back';
  END IF;

  PERFORM public.admin_record_shipment_update(
    v_delivered_shipment_id,
    'DELIVERED',
    'Test location',
    'Synchronize shipment to delivered order'
  );
  SELECT order_status INTO v_status
  FROM public.orders
  WHERE id = v_delivered_order_id;
  SELECT shipment.current_status INTO v_shipment_status
  FROM public.shipments AS shipment
  WHERE shipment.id = v_delivered_shipment_id;
  SELECT pg_catalog.array_agg(shipment_log.status_title ORDER BY shipment_log.status_title)
  INTO v_log_titles
  FROM public.shipment_logs AS shipment_log
  WHERE shipment_log.shipment_id = v_delivered_shipment_id;
  IF v_status <> 'delivered'
    OR v_shipment_status <> 'DELIVERED'
    OR v_log_titles IS DISTINCT FROM ARRAY['DELIVERED', 'SEOUL_WH']::text[]
  THEN
    RAISE EXCEPTION
      'DELIVERED did not synchronize the shipment for a delivered order (order %, shipment %, logs %)',
      v_status,
      v_shipment_status,
      v_log_titles;
  END IF;

  INSERT INTO public.orders (user_id, order_number, order_status)
  VALUES (
    v_customer_id,
    'KSH-STATUS-COMPLETED-TERMINAL-' || pg_catalog.replace(gen_random_uuid()::text, '-', ''),
    'completed'
  )
  RETURNING id INTO v_completed_order_id;
  v_completed_shipment_id := public.admin_create_shipment(
    v_completed_order_id,
    'TRACK-' || pg_catalog.replace(gen_random_uuid()::text, '-', '')
  );

  BEGIN
    PERFORM public.admin_record_shipment_update(
      v_completed_shipment_id,
      'IN_TRANSIT',
      'Test location',
      'Completed order must not move shipment'
    );
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'completed order accepted a non-delivered shipment status';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;

  SELECT shipment.current_status INTO v_status
  FROM public.shipments AS shipment
  WHERE shipment.id = v_completed_shipment_id;
  SELECT pg_catalog.count(*) INTO v_log_count
  FROM public.shipment_logs
  WHERE shipment_id = v_completed_shipment_id;
  IF v_status <> 'SEOUL_WH' OR v_log_count <> 1 THEN
    RAISE EXCEPTION 'completed order shipment update was not rolled back';
  END IF;

  PERFORM public.admin_record_shipment_update(
    v_completed_shipment_id,
    'DELIVERED',
    'Test location',
    'Synchronize shipment to completed order'
  );
  SELECT order_status INTO v_status
  FROM public.orders
  WHERE id = v_completed_order_id;
  SELECT shipment.current_status INTO v_shipment_status
  FROM public.shipments AS shipment
  WHERE shipment.id = v_completed_shipment_id;
  SELECT pg_catalog.array_agg(shipment_log.status_title ORDER BY shipment_log.status_title)
  INTO v_log_titles
  FROM public.shipment_logs AS shipment_log
  WHERE shipment_log.shipment_id = v_completed_shipment_id;
  IF v_status <> 'completed'
    OR v_shipment_status <> 'DELIVERED'
    OR v_log_titles IS DISTINCT FROM ARRAY['DELIVERED', 'SEOUL_WH']::text[]
  THEN
    RAISE EXCEPTION
      'DELIVERED did not synchronize the shipment for a completed order (order %, shipment %, logs %)',
      v_status,
      v_shipment_status,
      v_log_titles;
  END IF;

  BEGIN
    PERFORM public.admin_record_shipment_update(
      v_failed_shipment_id,
      'DELIVERED',
      'Test location',
      'Invalid early delivery'
    );
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'early delivery unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    IF v_error_message <> 'shipment_order_not_shipped' THEN
      RAISE EXCEPTION
        'delivery did not fail because of the order transition (message %)',
        v_error_message;
    END IF;
  END;

  SELECT shipment.current_status INTO v_status
  FROM public.shipments AS shipment
  WHERE shipment.id = v_failed_shipment_id;
  SELECT pg_catalog.count(*) INTO v_log_count
  FROM public.shipment_logs
  WHERE shipment_id = v_failed_shipment_id;
  IF v_status <> 'SEOUL_WH' OR v_log_count <> 1 THEN
    RAISE EXCEPTION 'failed delivery left partial shipment/log updates';
  END IF;

  UPDATE public.shipments
  SET current_status = 'IN_TRANSIT'
  WHERE id = v_failed_shipment_id;
  BEGIN
    PERFORM public.admin_update_order_status(
      v_failed_delivery_order_id,
      'cancelled'
    );
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'order with a dispatched shipment was cancelled';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;
  SELECT order_status INTO v_status
  FROM public.orders
  WHERE id = v_failed_delivery_order_id;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'shipment-based cancellation guard changed order status';
  END IF;
  UPDATE public.shipments
  SET current_status = 'SEOUL_WH'
  WHERE id = v_failed_shipment_id;

  PERFORM public.admin_update_order_status(
    v_failed_delivery_order_id,
    'cancelled'
  );
  BEGIN
    PERFORM public.admin_record_shipment_update(
      v_failed_shipment_id,
      'IN_TRANSIT',
      'Test location',
      'Cancelled order must not move'
    );
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'cancelled shipment update unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;
  BEGIN
    PERFORM public.admin_create_shipment(
      v_failed_delivery_order_id,
      'TRACK-' || pg_catalog.replace(gen_random_uuid()::text, '-', '')
    );
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'shipment creation for cancelled order unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;

  SELECT shipment.current_status INTO v_status
  FROM public.shipments AS shipment
  WHERE shipment.id = v_failed_shipment_id;
  SELECT pg_catalog.count(*) INTO v_log_count
  FROM public.shipment_logs
  WHERE shipment_id = v_failed_shipment_id;
  IF v_status <> 'SEOUL_WH' OR v_log_count <> 1 THEN
    RAISE EXCEPTION 'cancelled shipment was partially updated';
  END IF;

  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub',
    v_customer_id::text,
    true
  );
  BEGIN
    PERFORM public.admin_update_order_status(v_invalid_order_id, 'processing');
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'non-admin order status change unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  IF pg_catalog.has_function_privilege(
    'anon',
    'public.admin_update_order_status(uuid, text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anon can execute the admin order status RPC';
  END IF;
  IF pg_catalog.has_table_privilege(
    'authenticated',
    'public.shipments',
    'UPDATE'
  ) OR pg_catalog.has_table_privilege(
    'authenticated',
    'public.shipment_logs',
    'INSERT'
  ) THEN
    RAISE EXCEPTION 'authenticated can bypass the shipment RPCs with direct DML';
  END IF;
  IF pg_catalog.has_column_privilege(
    'authenticated',
    'public.shipments',
    'current_status',
    'UPDATE'
  ) OR pg_catalog.has_column_privilege(
    'authenticated',
    'public.shipment_logs',
    'description',
    'INSERT'
  ) THEN
    RAISE EXCEPTION 'authenticated has column-level shipment DML privileges';
  END IF;

  INSERT INTO order_tracking_status_test_ids (
    customer_id,
    other_customer_id,
    own_shipment_id,
    other_shipment_id
  )
  VALUES (
    v_customer_id,
    v_other_customer_id,
    v_shipment_id,
    v_other_shipment_id
  );
END;
$test_order_tracking_status$;

SET LOCAL ROLE authenticated;
DO $test_shipment_owner_policies$
DECLARE
  v_ids order_tracking_status_test_ids%ROWTYPE;
  v_own_count bigint;
  v_other_count bigint;
BEGIN
  SELECT * INTO STRICT v_ids FROM order_tracking_status_test_ids;

  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub',
    v_ids.customer_id::text,
    true
  );
  SELECT pg_catalog.count(*) INTO v_own_count
  FROM public.shipments AS shipment
  WHERE shipment.id = v_ids.own_shipment_id;
  SELECT pg_catalog.count(*) INTO v_other_count
  FROM public.shipments AS shipment
  WHERE shipment.id = v_ids.other_shipment_id;
  IF v_own_count <> 1 OR v_other_count <> 0 THEN
    RAISE EXCEPTION 'shipment owner policy exposed the wrong shipments';
  END IF;

  SELECT pg_catalog.count(*) INTO v_own_count
  FROM public.shipment_logs AS shipment_log
  WHERE shipment_log.shipment_id = v_ids.own_shipment_id;
  SELECT pg_catalog.count(*) INTO v_other_count
  FROM public.shipment_logs AS shipment_log
  WHERE shipment_log.shipment_id = v_ids.other_shipment_id;
  IF v_own_count = 0 OR v_other_count <> 0 THEN
    RAISE EXCEPTION 'shipment log owner policy exposed the wrong history';
  END IF;

  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub',
    v_ids.other_customer_id::text,
    true
  );
  SELECT pg_catalog.count(*) INTO v_own_count
  FROM public.shipments AS shipment
  WHERE shipment.id = v_ids.other_shipment_id;
  IF v_own_count <> 1 THEN
    RAISE EXCEPTION 'shipment owner policy denied the correct customer';
  END IF;
END;
$test_shipment_owner_policies$;
RESET ROLE;

SELECT pass('order and shipment status integrity assertions completed');
SELECT * FROM finish();

ROLLBACK;
