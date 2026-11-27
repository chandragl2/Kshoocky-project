BEGIN;

ALTER TABLE public.orders
  DROP CONSTRAINT orders_payment_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'expired'));

ALTER TABLE public.payments
  ADD COLUMN gateway_invoice_number text,
  ADD COLUMN gateway_request_id text,
  ADD COLUMN gateway_request_body text,
  ADD COLUMN payment_url text,
  ADD COLUMN gateway_expires_at timestamptz,
  ADD COLUMN payment_session_state text,
  ADD COLUMN next_reconcile_at timestamptz,
  ADD COLUMN reconciliation_error_code text,
  ADD COLUMN last_notification_status text,
  ADD CONSTRAINT payments_payment_session_state_check
    CHECK (
      payment_session_state IS NULL
      OR payment_session_state IN ('creating', 'active', 'uncertain', 'expired', 'cancelled')
    ),
  ADD CONSTRAINT payments_reconciliation_error_code_check
    CHECK (
      reconciliation_error_code IS NULL
      OR reconciliation_error_code ~ '^[a-z0-9_]{1,64}$'
    );

CREATE UNIQUE INDEX payments_gateway_invoice_number_unique_idx
  ON public.payments (gateway_invoice_number)
  WHERE gateway_invoice_number IS NOT NULL;
CREATE UNIQUE INDEX payments_gateway_request_id_unique_idx
  ON public.payments (gateway_request_id)
  WHERE gateway_request_id IS NOT NULL;
CREATE INDEX payments_doku_reconciliation_idx
  ON public.payments (next_reconcile_at, gateway_expires_at)
  WHERE payment_gateway = 'doku'
    AND payment_status = 'pending'
    AND payment_session_state IN ('active', 'uncertain');

CREATE TABLE public.checkout_idempotency (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key uuid NOT NULL,
  address_id uuid NOT NULL REFERENCES public.addresses(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, idempotency_key)
);

CREATE TABLE public.doku_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway text NOT NULL DEFAULT 'doku' CHECK (gateway = 'doku'),
  event_id text NOT NULL CHECK (pg_catalog.length(event_id) BETWEEN 1 AND 128),
  body_digest text NOT NULL CHECK (pg_catalog.length(body_digest) = 44),
  invoice_number text NOT NULL,
  transaction_status text NOT NULL,
  outcome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gateway, event_id)
);

ALTER TABLE public.checkout_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doku_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.checkout_idempotency
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.doku_webhook_events
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.payments
  FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.orders
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.checkout_catalog_variant_idempotent(
  p_address_id uuid,
  p_idempotency_key uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $checkout_catalog_variant_idempotent$
DECLARE
  v_user_id uuid := auth.uid();
  v_address_id uuid;
  v_order_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'checkout_unauthenticated';
  END IF;
  IF p_address_id IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'checkout_idempotency_invalid';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  INSERT INTO public.checkout_idempotency (
    user_id, idempotency_key, address_id
  )
  VALUES (v_user_id, p_idempotency_key, p_address_id)
  ON CONFLICT (user_id, idempotency_key) DO NOTHING;

  SELECT request.address_id, request.order_id
  INTO v_address_id, v_order_id
  FROM public.checkout_idempotency AS request
  WHERE request.user_id = v_user_id
    AND request.idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF v_address_id IS DISTINCT FROM p_address_id THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'checkout_idempotency_conflict';
  END IF;
  IF v_order_id IS NOT NULL THEN
    RETURN v_order_id;
  END IF;

  v_order_id := public.checkout_catalog_variant(p_address_id);
  UPDATE public.checkout_idempotency AS request
  SET order_id = v_order_id,
      updated_at = pg_catalog.now()
  WHERE request.user_id = v_user_id
    AND request.idempotency_key = p_idempotency_key;

  RETURN v_order_id;
END;
$checkout_catalog_variant_idempotent$;

CREATE OR REPLACE FUNCTION public.doku_begin_payment(
  p_order_id uuid,
  p_request_id text,
  p_request_body text,
  p_expires_at timestamptz
)
RETURNS TABLE (
  payment_id uuid,
  gateway_invoice_number text,
  gateway_request_id text,
  gateway_request_body text,
  payment_status text,
  payment_session_state text,
  payment_url text,
  gateway_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $doku_begin_payment$
DECLARE
  v_order public.orders%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_body jsonb;
  v_amount_text text;
BEGIN
  IF p_order_id IS NULL
    OR p_request_id IS NULL
    OR pg_catalog.length(p_request_id) NOT BETWEEN 1 AND 128
    OR p_request_body IS NULL
    OR pg_catalog.length(p_request_body) > 32768
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'doku_payment_request_invalid';
  END IF;

  SELECT target_order.*
  INTO v_order
  FROM public.orders AS target_order
  WHERE target_order.id = p_order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'doku_order_not_found';
  END IF;
  IF v_order.payment_status <> 'pending'
    OR v_order.order_status <> 'pending'
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'doku_order_not_payable';
  END IF;

  SELECT payment.*
  INTO v_payment
  FROM public.payments AS payment
  WHERE payment.order_id = p_order_id
    AND payment.payment_gateway = 'doku'
    AND payment.payment_session_state IN ('creating', 'active', 'uncertain')
  ORDER BY payment.created_at DESC
  LIMIT 1
  FOR UPDATE;
  IF FOUND THEN
    RETURN QUERY SELECT
      v_payment.id,
      v_payment.gateway_invoice_number,
      v_payment.gateway_request_id,
      v_payment.gateway_request_body,
      v_payment.payment_status,
      v_payment.payment_session_state,
      v_payment.payment_url,
      v_payment.gateway_expires_at;
    RETURN;
  END IF;

  IF v_order.total_price <= 0
    OR v_order.total_price <> pg_catalog.trunc(v_order.total_price)
    OR v_order.total_price > 999999999999
    OR pg_catalog.length(v_order.order_number) > 30
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'doku_order_amount_invalid';
  END IF;
  IF p_expires_at IS NULL
    OR p_expires_at <= pg_catalog.now()
    OR p_expires_at > pg_catalog.now() + interval '65 minutes'
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'doku_payment_expiry_invalid';
  END IF;

  BEGIN
    v_body := p_request_body::jsonb;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'doku_payment_body_invalid';
  END;
  v_amount_text := v_body #>> '{order,amount}';
  IF v_body #>> '{order,invoice_number}' IS DISTINCT FROM v_order.order_number
    OR v_amount_text IS NULL
    OR v_amount_text !~ '^[0-9]{1,12}$'
    OR v_amount_text::numeric IS DISTINCT FROM v_order.total_price
    OR v_body #>> '{order,currency}' IS DISTINCT FROM 'IDR'
    OR v_body #>> '{payment,payment_due_date}' IS DISTINCT FROM '60'
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'doku_payment_body_mismatch';
  END IF;

  INSERT INTO public.payments (
    order_id,
    payment_method,
    payment_gateway,
    payment_status,
    amount,
    expired_at,
    gateway_invoice_number,
    gateway_request_id,
    gateway_request_body,
    gateway_expires_at,
    payment_session_state,
    next_reconcile_at
  )
  VALUES (
    v_order.id,
    'DOKU Checkout',
    'doku',
    'pending',
    v_order.total_price,
    p_expires_at,
    v_order.order_number,
    p_request_id,
    p_request_body,
    p_expires_at,
    'creating',
    p_expires_at
  )
  RETURNING * INTO v_payment;

  RETURN QUERY SELECT
    v_payment.id,
    v_payment.gateway_invoice_number,
    v_payment.gateway_request_id,
    v_payment.gateway_request_body,
    v_payment.payment_status,
    v_payment.payment_session_state,
    v_payment.payment_url,
    v_payment.gateway_expires_at;
END;
$doku_begin_payment$;

CREATE OR REPLACE FUNCTION public.doku_save_checkout_response(
  p_payment_id uuid,
  p_payment_url text,
  p_gateway_expires_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $doku_save_checkout_response$
DECLARE
  v_updated_rows integer;
BEGIN
  IF p_payment_url IS NULL OR p_payment_url !~ '^https://'
    OR p_gateway_expires_at IS NULL
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'doku_checkout_response_invalid';
  END IF;

  UPDATE public.payments AS payment
  SET payment_url = p_payment_url,
      gateway_expires_at = pg_catalog.least(
        payment.gateway_expires_at, p_gateway_expires_at
      ),
      expired_at = pg_catalog.least(payment.expired_at, p_gateway_expires_at),
      payment_session_state = 'active',
      next_reconcile_at = pg_catalog.least(
        payment.gateway_expires_at, p_gateway_expires_at
      ),
      updated_at = pg_catalog.now()
  WHERE payment.id = p_payment_id
    AND payment.payment_gateway = 'doku'
    AND payment.payment_status = 'pending'
    AND payment.payment_session_state IN ('creating', 'active', 'uncertain');

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  IF v_updated_rows = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'doku_payment_not_active';
  END IF;
END;
$doku_save_checkout_response$;

CREATE OR REPLACE FUNCTION public.doku_mark_payment_uncertain(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $doku_mark_payment_uncertain$
DECLARE
  v_updated_rows integer;
BEGIN
  UPDATE public.payments AS payment
  SET payment_session_state = 'uncertain',
      reconciliation_error_code = 'checkout_response_uncertain',
      next_reconcile_at = payment.gateway_expires_at,
      updated_at = pg_catalog.now()
  WHERE payment.id = p_payment_id
    AND payment.payment_gateway = 'doku'
    AND payment.payment_status = 'pending'
    AND payment.payment_session_state IN ('creating', 'active', 'uncertain');

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  IF v_updated_rows = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'doku_payment_not_active';
  END IF;
END;
$doku_mark_payment_uncertain$;

CREATE OR REPLACE FUNCTION public.doku_get_order_payment_status(p_order_id uuid)
RETURNS TABLE (
  order_payment_status text,
  order_status text,
  payment_status text,
  payment_url text,
  payment_expires_at timestamptz,
  payment_session_state text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $doku_get_order_payment_status$
DECLARE
  v_order public.orders%ROWTYPE;
  v_payment public.payments%ROWTYPE;
BEGIN
  SELECT target_order.*
  INTO v_order
  FROM public.orders AS target_order
  WHERE target_order.id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'doku_order_not_found';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> v_order.user_id
    AND public.is_admin() IS DISTINCT FROM true
  THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'doku_order_forbidden';
  END IF;

  SELECT payment.*
  INTO v_payment
  FROM public.payments AS payment
  WHERE payment.order_id = p_order_id
    AND payment.payment_gateway = 'doku'
  ORDER BY payment.created_at DESC
  LIMIT 1;

  RETURN QUERY SELECT
    v_order.payment_status,
    v_order.order_status,
    COALESCE(v_payment.payment_status, v_order.payment_status),
    v_payment.payment_url,
    v_payment.gateway_expires_at,
    v_payment.payment_session_state;
END;
$doku_get_order_payment_status$;

CREATE OR REPLACE FUNCTION public.doku_list_reconciliation_candidates(p_limit integer)
RETURNS TABLE (
  payment_id uuid,
  invoice_number text,
  original_request_id text,
  payment_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $doku_list_reconciliation_candidates$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 50 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'doku_reconciliation_limit_invalid';
  END IF;

  RETURN QUERY
  SELECT
    payment.id,
    payment.gateway_invoice_number,
    payment.gateway_request_id,
    payment.gateway_expires_at
  FROM public.payments AS payment
  JOIN public.orders AS target_order ON target_order.id = payment.order_id
  WHERE payment.payment_gateway = 'doku'
    AND payment.payment_status = 'pending'
    AND payment.payment_session_state IN ('active', 'uncertain')
    AND payment.gateway_expires_at <= pg_catalog.now()
    AND payment.next_reconcile_at <= pg_catalog.now()
    AND target_order.payment_status = 'pending'
    AND target_order.order_status = 'pending'
  ORDER BY payment.next_reconcile_at, payment.created_at
  LIMIT p_limit;
END;
$doku_list_reconciliation_candidates$;

CREATE OR REPLACE FUNCTION public.doku_defer_payment_reconciliation(
  p_payment_id uuid,
  p_error_code text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $doku_defer_payment_reconciliation$
DECLARE
  v_updated_rows integer;
BEGIN
  IF p_error_code IS NULL OR p_error_code !~ '^[a-z0-9_]{1,64}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'doku_reconciliation_error_invalid';
  END IF;

  UPDATE public.payments AS payment
  SET reconciliation_error_code = p_error_code,
      next_reconcile_at = pg_catalog.now() + interval '15 minutes',
      updated_at = pg_catalog.now()
  WHERE payment.id = p_payment_id
    AND payment.payment_gateway = 'doku'
    AND payment.payment_status = 'pending'
    AND payment.payment_session_state IN ('active', 'uncertain');

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  IF v_updated_rows = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'doku_payment_not_reconcilable';
  END IF;
END;
$doku_defer_payment_reconciliation$;

CREATE OR REPLACE FUNCTION public.doku_restore_order_inventory_once(
  p_order_id uuid,
  p_created_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $doku_restore_order_inventory_once$
BEGIN
  PERFORM product.id
  FROM public.products AS product
  JOIN public.product_variants AS variant ON variant.product_id = product.id
  JOIN public.order_items AS item ON item.variant_id = variant.id
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
      variant_id, order_id, order_item_id, movement_type,
      quantity_delta, reason, created_by
    )
    SELECT
      sale.variant_id,
      p_order_id,
      sale.order_item_id,
      'order_cancel_restore',
      sale.restore_quantity,
      'DOKU payment expiry restore',
      p_created_by
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
  SET stock = COALESCE((
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
END;
$doku_restore_order_inventory_once$;

CREATE OR REPLACE FUNCTION public.doku_expire_payment(
  p_payment_id uuid,
  p_invoice_number text,
  p_amount numeric,
  p_original_request_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $doku_expire_payment$
DECLARE
  v_order_id uuid;
  v_order public.orders%ROWTYPE;
  v_payment public.payments%ROWTYPE;
BEGIN
  SELECT payment.order_id
  INTO v_order_id
  FROM public.payments AS payment
  WHERE payment.id = p_payment_id
    AND payment.payment_gateway = 'doku';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'doku_payment_not_found';
  END IF;

  SELECT target_order.*
  INTO v_order
  FROM public.orders AS target_order
  WHERE target_order.id = v_order_id
  FOR UPDATE;

  SELECT payment.*
  INTO v_payment
  FROM public.payments AS payment
  WHERE payment.id = p_payment_id
  FOR UPDATE;

  IF v_payment.gateway_invoice_number IS DISTINCT FROM p_invoice_number
    OR v_payment.amount IS DISTINCT FROM p_amount
    OR v_payment.gateway_request_id IS DISTINCT FROM p_original_request_id
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'doku_payment_reference_mismatch';
  END IF;
  IF v_order.payment_status = 'paid' OR v_payment.payment_status = 'paid' THEN
    RETURN 'already_paid';
  END IF;
  IF v_order.payment_status = 'expired'
    OR v_order.order_status = 'cancelled'
    OR v_payment.payment_status IN ('expired', 'cancelled')
  THEN
    RETURN 'already_terminal';
  END IF;
  IF v_payment.payment_status <> 'pending'
    OR v_payment.payment_session_state NOT IN ('active', 'uncertain')
    OR v_payment.gateway_expires_at > pg_catalog.now()
    OR v_order.payment_status <> 'pending'
    OR v_order.order_status <> 'pending'
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'doku_payment_not_expired';
  END IF;

  PERFORM public.doku_restore_order_inventory_once(v_order.id, NULL);

  UPDATE public.payments AS payment
  SET payment_status = 'expired',
      payment_session_state = 'expired',
      expired_at = pg_catalog.now(),
      next_reconcile_at = NULL,
      reconciliation_error_code = NULL,
      updated_at = pg_catalog.now()
  WHERE payment.id = p_payment_id;

  UPDATE public.orders AS target_order
  SET payment_status = 'expired',
      order_status = 'cancelled',
      updated_at = pg_catalog.now()
  WHERE target_order.id = v_order.id;

  RETURN 'expired';
END;
$doku_expire_payment$;

CREATE OR REPLACE FUNCTION public.doku_record_notification(
  p_event_id text,
  p_body_digest text,
  p_invoice_number text,
  p_amount numeric,
  p_original_request_id text,
  p_gateway_transaction_id text,
  p_status text,
  p_event_time timestamptz
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $doku_record_notification$
DECLARE
  v_order_id uuid;
  v_order public.orders%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_existing_digest text;
  v_existing_outcome text;
  v_status text := pg_catalog.upper(pg_catalog.btrim(p_status));
  v_outcome text;
BEGIN
  IF p_event_id IS NULL OR pg_catalog.length(p_event_id) NOT BETWEEN 1 AND 128
    OR p_body_digest IS NULL OR pg_catalog.length(p_body_digest) <> 44
    OR p_invoice_number IS NULL OR p_amount IS NULL OR p_amount <= 0
    OR v_status = ''
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'doku_notification_invalid';
  END IF;

  SELECT payment.order_id
  INTO v_order_id
  FROM public.payments AS payment
  WHERE payment.payment_gateway = 'doku'
    AND payment.gateway_invoice_number = p_invoice_number;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'doku_invoice_not_found';
  END IF;

  SELECT target_order.*
  INTO v_order
  FROM public.orders AS target_order
  WHERE target_order.id = v_order_id
  FOR UPDATE;
  SELECT payment.*
  INTO v_payment
  FROM public.payments AS payment
  WHERE payment.payment_gateway = 'doku'
    AND payment.gateway_invoice_number = p_invoice_number
  FOR UPDATE;

  IF v_payment.order_id IS DISTINCT FROM v_order.id
    OR v_payment.amount IS DISTINCT FROM p_amount
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'doku_notification_amount_mismatch';
  END IF;
  IF p_original_request_id IS NOT NULL
    AND v_payment.gateway_request_id IS DISTINCT FROM p_original_request_id
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'doku_notification_reference_mismatch';
  END IF;

  SELECT event.body_digest, event.outcome
  INTO v_existing_digest, v_existing_outcome
  FROM public.doku_webhook_events AS event
  WHERE event.gateway = 'doku'
    AND event.event_id = p_event_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing_digest IS DISTINCT FROM p_body_digest THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'doku_notification_replay_conflict';
    END IF;
    RETURN 'duplicate';
  END IF;

  IF v_status IN ('SUCCESS', 'EXPIRED') AND (
    p_original_request_id IS NULL
    OR v_payment.gateway_request_id IS DISTINCT FROM p_original_request_id
  ) THEN
    v_outcome := 'reference_missing';
  ELSIF v_status = 'SUCCESS' THEN
    IF v_order.payment_status = 'paid' AND v_payment.payment_status = 'paid' THEN
      v_outcome := 'already_paid';
    ELSIF v_order.payment_status = 'paid'
      OR v_order.order_status = 'cancelled'
      OR v_payment.payment_status IN ('expired', 'cancelled')
    THEN
      v_outcome := 'contradictory_success';
    ELSE
      UPDATE public.payments AS payment
      SET payment_status = 'paid',
          paid_at = COALESCE(payment.paid_at, p_event_time, pg_catalog.now()),
          gateway_transaction_id = COALESCE(
            p_gateway_transaction_id, payment.gateway_transaction_id
          ),
          payment_session_state = NULL,
          next_reconcile_at = NULL,
          reconciliation_error_code = NULL,
          last_notification_status = v_status,
          updated_at = pg_catalog.now()
      WHERE payment.id = v_payment.id
        AND payment.payment_status = 'pending';

      UPDATE public.orders AS target_order
      SET payment_status = 'paid',
          updated_at = pg_catalog.now()
      WHERE target_order.id = v_order.id
        AND target_order.payment_status = 'pending'
        AND target_order.order_status <> 'cancelled';
      v_outcome := 'success_applied';
    END IF;
  ELSIF v_status = 'EXPIRED' THEN
    IF v_order.payment_status = 'paid' OR v_payment.payment_status = 'paid' THEN
      v_outcome := 'contradictory_expiry';
    ELSIF v_order.payment_status = 'pending'
      AND v_order.order_status = 'pending'
      AND v_payment.payment_status = 'pending'
      AND v_payment.payment_session_state IN ('active', 'uncertain')
      AND v_payment.gateway_expires_at <= pg_catalog.now()
    THEN
      v_outcome := public.doku_expire_payment(
        v_payment.id,
        p_invoice_number,
        p_amount,
        p_original_request_id
      );
    ELSE
      v_outcome := 'expiry_not_applied';
    END IF;
  ELSIF v_status = 'FAILED' THEN
    v_outcome := 'checkout_failed_ignored';
  ELSIF v_status = 'PENDING' THEN
    v_outcome := 'pending_ignored';
  ELSE
    v_outcome := 'unknown_status_ignored';
  END IF;

  INSERT INTO public.doku_webhook_events (
    gateway, event_id, body_digest, invoice_number,
    transaction_status, outcome
  )
  VALUES (
    'doku', p_event_id, p_body_digest, p_invoice_number, v_status, v_outcome
  );

  IF v_status <> 'SUCCESS' AND v_status <> 'EXPIRED' THEN
    UPDATE public.payments AS payment
    SET last_notification_status = v_status,
        updated_at = pg_catalog.now()
    WHERE payment.id = v_payment.id
      AND payment.payment_status = 'pending';
  END IF;

  RETURN v_outcome;
END;
$doku_record_notification$;

CREATE OR REPLACE FUNCTION public.doku_record_reconciliation(
  p_payment_id uuid,
  p_status text,
  p_invoice_number text,
  p_amount numeric,
  p_original_request_id text,
  p_gateway_transaction_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $doku_record_reconciliation$
DECLARE
  v_order_id uuid;
  v_order public.orders%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_status text := pg_catalog.upper(pg_catalog.btrim(p_status));
BEGIN
  SELECT payment.order_id
  INTO v_order_id
  FROM public.payments AS payment
  WHERE payment.id = p_payment_id
    AND payment.payment_gateway = 'doku';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'doku_payment_not_found';
  END IF;
  SELECT target_order.*
  INTO v_order
  FROM public.orders AS target_order
  WHERE target_order.id = v_order_id
  FOR UPDATE;
  SELECT payment.*
  INTO v_payment
  FROM public.payments AS payment
  WHERE payment.id = p_payment_id
  FOR UPDATE;

  IF v_payment.payment_status = 'paid' OR v_order.payment_status = 'paid' THEN
    RETURN 'already_paid';
  END IF;
  IF v_payment.payment_status <> 'pending'
    OR v_order.payment_status <> 'pending'
    OR v_payment.gateway_invoice_number IS DISTINCT FROM p_invoice_number
    OR v_payment.amount IS DISTINCT FROM p_amount
    OR v_payment.gateway_request_id IS DISTINCT FROM p_original_request_id
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'doku_reconciliation_mismatch';
  END IF;

  IF v_status = 'EXPIRED' THEN
    RETURN public.doku_expire_payment(
      p_payment_id,
      p_invoice_number,
      p_amount,
      p_original_request_id
    );
  END IF;

  UPDATE public.payments AS payment
  SET reconciliation_error_code = CASE
        WHEN v_status = 'SUCCESS' THEN 'success_without_notification'
        WHEN v_status ~ '^[A-Z0-9_]{1,50}$' THEN
          'gateway_status_' || pg_catalog.lower(v_status)
        ELSE 'gateway_status_unknown'
      END,
      next_reconcile_at = pg_catalog.now() + CASE
        WHEN v_status = 'SUCCESS' THEN interval '60 minutes'
        ELSE interval '15 minutes'
      END,
      gateway_transaction_id = COALESCE(
        p_gateway_transaction_id, payment.gateway_transaction_id
      ),
      updated_at = pg_catalog.now()
  WHERE payment.id = p_payment_id;

  RETURN CASE
    WHEN v_status = 'SUCCESS' THEN 'success_waiting_notification'
    ELSE 'pending'
  END;
END;
$doku_record_reconciliation$;

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
  v_order public.orders%ROWTYPE;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_order_status_forbidden';
  END IF;
  IF p_order_id IS NULL OR p_order_status IS NULL OR p_order_status NOT IN (
    'pending', 'processing', 'shipped', 'delivered', 'completed', 'cancelled'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_order_status_invalid';
  END IF;

  SELECT target_order.*
  INTO v_order
  FROM public.orders AS target_order
  WHERE target_order.id = p_order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'admin_order_not_found';
  END IF;
  IF v_order.order_status = p_order_status THEN
    RETURN;
  END IF;
  IF NOT (
    (v_order.order_status = 'pending' AND p_order_status IN ('processing', 'cancelled'))
    OR (v_order.order_status = 'processing' AND p_order_status IN ('shipped', 'cancelled'))
    OR (v_order.order_status = 'shipped' AND p_order_status = 'delivered')
    OR (v_order.order_status = 'delivered' AND p_order_status = 'completed')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_order_transition_invalid';
  END IF;

  IF p_order_status = 'cancelled' THEN
    IF v_order.payment_status = 'paid' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_paid_order_cannot_cancel';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.payments AS payment
      WHERE payment.order_id = p_order_id
        AND payment.payment_gateway = 'doku'
        AND payment.payment_session_state IN ('creating', 'active', 'uncertain')
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_doku_payment_active';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.shipments AS shipment
      WHERE shipment.order_id = p_order_id
        AND shipment.current_status IN (
          'IN_TRANSIT', 'CUSTOMS', 'JAKARTA_WH', 'DELIVERED'
        )
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_order_cannot_cancel_after_shipment';
    END IF;

    PERFORM public.doku_restore_order_inventory_once(p_order_id, auth.uid());
  END IF;

  UPDATE public.orders AS target_order
  SET order_status = p_order_status,
      updated_at = pg_catalog.now()
  WHERE target_order.id = p_order_id;
END;
$admin_update_order_status$;

ALTER FUNCTION public.checkout_catalog_variant_idempotent(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.doku_begin_payment(uuid, text, text, timestamptz) OWNER TO postgres;
ALTER FUNCTION public.doku_save_checkout_response(uuid, text, timestamptz) OWNER TO postgres;
ALTER FUNCTION public.doku_mark_payment_uncertain(uuid) OWNER TO postgres;
ALTER FUNCTION public.doku_get_order_payment_status(uuid) OWNER TO postgres;
ALTER FUNCTION public.doku_list_reconciliation_candidates(integer) OWNER TO postgres;
ALTER FUNCTION public.doku_defer_payment_reconciliation(uuid, text) OWNER TO postgres;
ALTER FUNCTION public.doku_restore_order_inventory_once(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.doku_expire_payment(uuid, text, numeric, text) OWNER TO postgres;
ALTER FUNCTION public.doku_record_notification(text, text, text, numeric, text, text, text, timestamptz)
  OWNER TO postgres;
ALTER FUNCTION public.doku_record_reconciliation(uuid, text, text, numeric, text, text)
  OWNER TO postgres;
ALTER FUNCTION public.admin_update_order_status(uuid, text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.checkout_catalog_variant_idempotent(uuid, uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.checkout_catalog_variant_idempotent(uuid, uuid)
  TO authenticated;
REVOKE ALL ON FUNCTION public.checkout_catalog_variant(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.doku_begin_payment(uuid, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.doku_save_checkout_response(uuid, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.doku_mark_payment_uncertain(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.doku_get_order_payment_status(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.doku_list_reconciliation_candidates(integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.doku_defer_payment_reconciliation(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.doku_restore_order_inventory_once(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.doku_expire_payment(uuid, text, numeric, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.doku_record_notification(
  text, text, text, numeric, text, text, text, timestamptz
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.doku_record_reconciliation(
  uuid, text, text, numeric, text, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_update_order_status(uuid, text)
  FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.doku_begin_payment(uuid, text, text, timestamptz)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.doku_save_checkout_response(uuid, text, timestamptz)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.doku_mark_payment_uncertain(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.doku_get_order_payment_status(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.doku_list_reconciliation_candidates(integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.doku_defer_payment_reconciliation(uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.doku_expire_payment(uuid, text, numeric, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.doku_record_notification(
  text, text, text, numeric, text, text, text, timestamptz
) TO service_role;
GRANT EXECUTE ON FUNCTION public.doku_record_reconciliation(
  uuid, text, text, numeric, text, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_order_status(uuid, text)
  TO authenticated;

COMMIT;
