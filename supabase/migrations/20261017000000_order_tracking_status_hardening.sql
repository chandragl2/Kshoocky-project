BEGIN;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_order_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_status_check
  CHECK (
    order_status IN (
      'pending',
      'processing',
      'shipped',
      'delivered',
      'completed',
      'cancelled'
    )
  );

CREATE POLICY shipments_status_admin_select
  ON public.shipments
  FOR SELECT
  TO authenticated
  USING (public.is_admin() IS TRUE);

CREATE POLICY shipments_status_owner_select
  ON public.shipments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders AS customer_order
      WHERE customer_order.id = shipments.order_id
        AND customer_order.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY shipment_logs_status_admin_select
  ON public.shipment_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin() IS TRUE);

CREATE POLICY shipment_logs_status_owner_select
  ON public.shipment_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.shipments AS customer_shipment
      JOIN public.orders AS customer_order
        ON customer_order.id = customer_shipment.order_id
      WHERE customer_shipment.id = shipment_logs.shipment_id
        AND customer_order.user_id = (SELECT auth.uid())
    )
  );

REVOKE ALL ON TABLE public.shipments, public.shipment_logs
  FROM PUBLIC, anon, authenticated;
REVOKE INSERT (id, order_id, tracking_number, current_status, created_at, updated_at),
       UPDATE (id, order_id, tracking_number, current_status, created_at, updated_at)
  ON TABLE public.shipments
  FROM PUBLIC, anon, authenticated;
REVOKE INSERT (id, shipment_id, status_title, location, description, created_at),
       UPDATE (id, shipment_id, status_title, location, description, created_at)
  ON TABLE public.shipment_logs
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.shipments, public.shipment_logs
  TO authenticated;

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
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'admin_order_status_forbidden';
  END IF;

  IF p_order_id IS NULL OR p_order_status IS NULL OR p_order_status NOT IN (
    'pending',
    'processing',
    'shipped',
    'delivered',
    'completed',
    'cancelled'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'admin_order_status_invalid';
  END IF;

  SELECT target_order.order_status
  INTO v_current_status
  FROM public.orders AS target_order
  WHERE target_order.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'admin_order_not_found';
  END IF;

  IF v_current_status = p_order_status THEN
    RETURN;
  END IF;

  IF NOT (
    (v_current_status = 'pending' AND p_order_status IN ('processing', 'cancelled'))
    OR (v_current_status = 'processing' AND p_order_status IN ('shipped', 'cancelled'))
    OR (v_current_status = 'shipped' AND p_order_status = 'delivered')
    OR (v_current_status = 'delivered' AND p_order_status = 'completed')
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'admin_order_transition_invalid';
  END IF;

  IF p_order_status = 'cancelled' THEN
    IF EXISTS (
      SELECT 1
      FROM public.shipments AS shipment
      WHERE shipment.order_id = p_order_id
        AND shipment.current_status IN (
          'IN_TRANSIT',
          'CUSTOMS',
          'JAKARTA_WH',
          'DELIVERED'
        )
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '22023',
        MESSAGE = 'admin_order_cannot_cancel_after_shipment';
    END IF;

    PERFORM product.id
    FROM public.products AS product
    JOIN public.product_variants AS variant
      ON variant.product_id = product.id
    JOIN public.order_items AS item
      ON item.variant_id = variant.id
    WHERE item.order_id = p_order_id
    ORDER BY product.id
    FOR UPDATE OF product;

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
      INSERT INTO public.inventory_movements (
        variant_id,
        order_id,
        order_item_id,
        movement_type,
        quantity_delta,
        reason,
        created_by
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
      SELECT
        restored.variant_id,
        pg_catalog.sum(restored.quantity_delta) AS restore_quantity
      FROM restored
      GROUP BY restored.variant_id
    )
    UPDATE public.product_variants AS variant
    SET
      stock = variant.stock + totals.restore_quantity,
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
      JOIN public.order_items AS item
        ON item.variant_id = variant.id
      WHERE item.order_id = p_order_id
    );
  END IF;

  UPDATE public.orders AS target_order
  SET
    order_status = p_order_status,
    updated_at = pg_catalog.now()
  WHERE target_order.id = p_order_id;
END;
$admin_update_order_status$;

CREATE OR REPLACE FUNCTION public.admin_create_shipment(
  p_order_id uuid,
  p_tracking_number text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_create_shipment$
DECLARE
  v_shipment_id uuid;
  v_order_status text;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'admin_shipment_forbidden';
  END IF;

  IF p_order_id IS NULL
    OR p_tracking_number IS NULL
    OR pg_catalog.btrim(p_tracking_number) = ''
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'admin_shipment_invalid';
  END IF;

  SELECT customer_order.order_status
  INTO v_order_status
  FROM public.orders AS customer_order
  WHERE customer_order.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'admin_order_not_found';
  END IF;

  IF v_order_status = 'cancelled' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'admin_shipment_order_cancelled';
  END IF;

  INSERT INTO public.shipments (order_id, tracking_number, current_status)
  VALUES (p_order_id, pg_catalog.btrim(p_tracking_number), 'SEOUL_WH')
  RETURNING id INTO v_shipment_id;

  INSERT INTO public.shipment_logs (
    shipment_id,
    status_title,
    description
  )
  VALUES (
    v_shipment_id,
    'SEOUL_WH',
    'Resi pengiriman dibuat oleh admin.'
  );

  RETURN v_shipment_id;
END;
$admin_create_shipment$;

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

ALTER FUNCTION public.admin_update_order_status(uuid, text) OWNER TO postgres;
ALTER FUNCTION public.admin_create_shipment(uuid, text) OWNER TO postgres;
ALTER FUNCTION public.admin_record_shipment_update(uuid, text, text, text)
  OWNER TO postgres;

REVOKE ALL ON FUNCTION public.admin_update_order_status(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_create_shipment(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_record_shipment_update(uuid, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.checkout_catalog(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.admin_update_order_status(uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_shipment(uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_shipment_update(uuid, text, text, text)
  TO authenticated;

COMMIT;
