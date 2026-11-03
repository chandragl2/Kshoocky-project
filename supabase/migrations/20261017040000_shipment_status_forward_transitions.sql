BEGIN;

DO $shipment_status_migration_preflight$
DECLARE
  v_missing_columns text;
  v_order_status_allows_delivered boolean;
  v_order_status_check_count integer;
  v_canonical_order_status_check_count integer;
BEGIN
  IF pg_catalog.to_regclass('public.orders') IS NULL
    OR pg_catalog.to_regclass('public.shipments') IS NULL
    OR pg_catalog.to_regclass('public.shipment_logs') IS NULL
    OR pg_catalog.to_regprocedure('public.is_admin()') IS NULL
    OR pg_catalog.to_regprocedure('public.admin_update_order_status(uuid,text)') IS NULL
  THEN
    RAISE EXCEPTION
      'shipment_status_migration_prerequisite_missing: expected order, shipment, admin checker, and order status RPC objects';
  END IF;

  SELECT pg_catalog.string_agg(
    required.table_name || '.' || required.column_name,
    ', ' ORDER BY required.table_name, required.column_name
  )
  INTO v_missing_columns
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
  );

  IF v_missing_columns IS NOT NULL THEN
    RAISE EXCEPTION
      'shipment_status_migration_missing_columns: %',
      v_missing_columns;
  END IF;

  SELECT
    pg_catalog.count(*),
    pg_catalog.count(*) FILTER (
      WHERE constraint_row.conname = 'orders_order_status_check'
        AND pg_catalog.pg_get_constraintdef(constraint_row.oid) =
          'CHECK (((order_status)::text = ANY ((ARRAY[''pending''::character varying, ''processing''::character varying, ''shipped''::character varying, ''delivered''::character varying, ''completed''::character varying, ''cancelled''::character varying])::text[])))'
    )
  INTO
    v_order_status_check_count,
    v_canonical_order_status_check_count
  FROM pg_catalog.pg_constraint AS constraint_row
  JOIN pg_catalog.pg_attribute AS order_status_column
    ON order_status_column.attrelid = constraint_row.conrelid
   AND order_status_column.attname = 'order_status'
   AND order_status_column.attnum = ANY (constraint_row.conkey)
  WHERE constraint_row.conrelid = 'public.orders'::regclass
    AND constraint_row.contype = 'c';

  v_order_status_allows_delivered :=
    v_order_status_check_count = 1
    AND v_canonical_order_status_check_count = 1;

  IF NOT v_order_status_allows_delivered THEN
    RAISE EXCEPTION
      'shipment_status_migration_order_status_constraint_invalid: expected exactly the canonical orders_order_status_check and no other CHECK constraint referencing order_status';
  END IF;
END;
$shipment_status_migration_preflight$;

CREATE OR REPLACE FUNCTION public.admin_record_shipment_update(
  p_shipment_id uuid,
  p_status text,
  p_location text,
  p_description text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_record_shipment_update$
DECLARE
  v_order_id uuid;
  v_order_status text;
  v_current_status text;
  v_current_route_step integer;
  v_next_route_step integer;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'admin_shipment_forbidden';
  END IF;

  IF p_shipment_id IS NULL OR p_status IS NULL OR p_status NOT IN (
    'SEOUL_WH',
    'IN_TRANSIT',
    'CUSTOMS',
    'JAKARTA_WH',
    'DELIVERED'
  ) OR p_description IS NULL OR pg_catalog.btrim(p_description) = ''
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'admin_shipment_update_invalid';
  END IF;

  SELECT shipment.order_id, shipment.current_status
  INTO v_order_id, v_current_status
  FROM public.shipments AS shipment
  WHERE shipment.id = p_shipment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'admin_shipment_not_found';
  END IF;

  SELECT customer_order.order_status
  INTO v_order_status
  FROM public.orders AS customer_order
  WHERE customer_order.id = v_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'admin_order_not_found';
  END IF;

  IF v_order_status = 'cancelled' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'shipment_order_cancelled';
  END IF;

  IF v_order_status IN ('delivered', 'completed')
    AND p_status <> 'DELIVERED'
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'shipment_order_terminal';
  END IF;

  v_current_route_step := CASE v_current_status
    WHEN 'SEOUL_WH' THEN 1
    WHEN 'IN_TRANSIT' THEN 2
    WHEN 'CUSTOMS' THEN 3
    WHEN 'JAKARTA_WH' THEN 4
    WHEN 'DELIVERED' THEN 5
    ELSE NULL
  END;
  v_next_route_step := CASE p_status
    WHEN 'SEOUL_WH' THEN 1
    WHEN 'IN_TRANSIT' THEN 2
    WHEN 'CUSTOMS' THEN 3
    WHEN 'JAKARTA_WH' THEN 4
    WHEN 'DELIVERED' THEN 5
    ELSE NULL
  END;

  IF v_current_route_step IS NULL
    OR v_next_route_step IS NULL
    OR v_next_route_step <= v_current_route_step
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'shipment_status_transition_invalid';
  END IF;

  UPDATE public.shipments AS shipment
  SET
    current_status = p_status,
    updated_at = pg_catalog.now()
  WHERE shipment.id = p_shipment_id;

  INSERT INTO public.shipment_logs (
    shipment_id,
    status_title,
    location,
    description
  )
  VALUES (
    p_shipment_id,
    p_status,
    NULLIF(pg_catalog.btrim(COALESCE(p_location, '')), ''),
    pg_catalog.btrim(p_description)
  );

  IF p_status IN ('IN_TRANSIT', 'CUSTOMS', 'JAKARTA_WH', 'DELIVERED') THEN
    IF v_order_status = 'processing' THEN
      PERFORM public.admin_update_order_status(v_order_id, 'shipped');
      v_order_status := 'shipped';
    END IF;

    IF p_status = 'DELIVERED' AND v_order_status = 'shipped' THEN
      PERFORM public.admin_update_order_status(v_order_id, 'delivered');
    ELSIF v_order_status NOT IN ('shipped', 'delivered', 'completed') THEN
      RAISE EXCEPTION USING
        ERRCODE = '22023',
        MESSAGE = 'shipment_order_not_shipped';
    END IF;
  END IF;
END;
$admin_record_shipment_update$;

ALTER FUNCTION public.admin_record_shipment_update(uuid, text, text, text)
  OWNER TO postgres;

REVOKE ALL ON FUNCTION public.admin_record_shipment_update(uuid, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_record_shipment_update(uuid, text, text, text)
  TO authenticated;

DO $revoke_legacy_checkout_execute$
BEGIN
  IF pg_catalog.to_regprocedure('public.checkout_catalog(uuid)') IS NOT NULL THEN
    EXECUTE
      'REVOKE ALL ON FUNCTION public.checkout_catalog(uuid) FROM PUBLIC, anon, authenticated, service_role';
  END IF;
END;
$revoke_legacy_checkout_execute$;

COMMIT;
