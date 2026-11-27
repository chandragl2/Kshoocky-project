BEGIN;

ALTER TABLE public.doku_webhook_events
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS review_note text;

DO $doku_webhook_review_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_row
    WHERE constraint_row.conrelid = 'public.doku_webhook_events'::regclass
      AND constraint_row.conname = 'doku_webhook_events_review_state_check'
  ) THEN
    ALTER TABLE public.doku_webhook_events
      ADD CONSTRAINT doku_webhook_events_review_state_check
      CHECK (
        (
          reviewed_at IS NULL
          AND reviewed_by IS NULL
          AND review_note IS NULL
        )
        OR (
          reviewed_at IS NOT NULL
          AND reviewed_by IS NOT NULL
          AND review_note IS NOT NULL
          AND pg_catalog.length(pg_catalog.btrim(review_note)) BETWEEN 1 AND 1000
        )
      );
  END IF;
END;
$doku_webhook_review_constraint$;

CREATE INDEX IF NOT EXISTS doku_webhook_events_incident_queue_idx
  ON public.doku_webhook_events (
    (reviewed_at IS NOT NULL),
    created_at DESC,
    event_id
  )
  WHERE gateway = 'doku'
    AND outcome IN (
      'contradictory_success',
      'contradictory_expiry',
      'expiry_not_applied'
    );

CREATE OR REPLACE FUNCTION public.doku_recover_creating_payment_attempts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $doku_recover_creating_payment_attempts$
DECLARE
  v_recovered integer;
BEGIN
  WITH stale_attempts AS (
    SELECT payment.id
    FROM public.payments AS payment
    JOIN public.orders AS target_order ON target_order.id = payment.order_id
    WHERE payment.payment_gateway = 'doku'
      AND payment.payment_status = 'pending'
      AND payment.payment_session_state = 'creating'
      AND payment.gateway_expires_at <= pg_catalog.now()
      AND payment.next_reconcile_at <= pg_catalog.now()
      AND target_order.payment_status = 'pending'
      AND target_order.order_status = 'pending'
    ORDER BY payment.gateway_expires_at, payment.created_at
    LIMIT 50
    FOR UPDATE OF payment SKIP LOCKED
  )
  UPDATE public.payments AS payment
  SET payment_session_state = 'uncertain',
      next_reconcile_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  FROM stale_attempts
  WHERE payment.id = stale_attempts.id
    AND payment.payment_gateway = 'doku'
    AND payment.payment_status = 'pending'
    AND payment.payment_session_state = 'creating';

  GET DIAGNOSTICS v_recovered = ROW_COUNT;
  RETURN v_recovered;
END;
$doku_recover_creating_payment_attempts$;

CREATE OR REPLACE FUNCTION public.doku_list_webhook_incidents(
  p_limit integer,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  event_id text,
  invoice_number text,
  transaction_status text,
  outcome text,
  created_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_note text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $doku_list_webhook_incidents$
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'doku_incident_review_forbidden';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 50
    OR p_offset IS NULL OR p_offset < 0
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'doku_incident_limit_invalid';
  END IF;

  RETURN QUERY
  SELECT
    event.event_id,
    event.invoice_number,
    event.transaction_status,
    event.outcome,
    event.created_at,
    event.reviewed_at,
    event.reviewed_by,
    event.review_note
  FROM public.doku_webhook_events AS event
  WHERE event.gateway = 'doku'
    AND event.outcome IN (
      'contradictory_success',
      'contradictory_expiry',
      'expiry_not_applied'
    )
  ORDER BY (event.reviewed_at IS NOT NULL), event.created_at DESC, event.event_id
  LIMIT p_limit
  OFFSET p_offset;
END;
$doku_list_webhook_incidents$;

CREATE OR REPLACE FUNCTION public.doku_mark_webhook_incident_reviewed(
  p_event_id text,
  p_review_note text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $doku_mark_webhook_incident_reviewed$
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'doku_incident_review_forbidden';
  END IF;
  IF p_event_id IS NULL
    OR pg_catalog.length(p_event_id) NOT BETWEEN 1 AND 128
    OR p_review_note IS NULL
    OR pg_catalog.length(pg_catalog.btrim(p_review_note)) NOT BETWEEN 1 AND 1000
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'doku_incident_review_invalid';
  END IF;

  UPDATE public.doku_webhook_events AS event
  SET reviewed_at = pg_catalog.now(),
      reviewed_by = auth.uid(),
      review_note = pg_catalog.btrim(p_review_note)
  WHERE event.gateway = 'doku'
    AND event.event_id = p_event_id
    AND event.outcome IN (
      'contradictory_success',
      'contradictory_expiry',
      'expiry_not_applied'
    )
    AND event.reviewed_at IS NULL;

  RETURN FOUND;
END;
$doku_mark_webhook_incident_reviewed$;

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
  IF p_order_status = 'processing' AND v_order.payment_status <> 'paid' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'admin_unpaid_order_cannot_process';
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

ALTER FUNCTION public.doku_recover_creating_payment_attempts() OWNER TO postgres;
ALTER FUNCTION public.doku_list_webhook_incidents(integer, integer) OWNER TO postgres;
ALTER FUNCTION public.doku_mark_webhook_incident_reviewed(text, text) OWNER TO postgres;
ALTER FUNCTION public.admin_update_order_status(uuid, text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.doku_recover_creating_payment_attempts()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.doku_recover_creating_payment_attempts()
  TO service_role;

REVOKE ALL ON FUNCTION public.doku_list_webhook_incidents(integer, integer)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.doku_list_webhook_incidents(integer, integer)
  TO authenticated;

REVOKE ALL ON FUNCTION public.doku_mark_webhook_incident_reviewed(text, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.doku_mark_webhook_incident_reviewed(text, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.admin_update_order_status(uuid, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_order_status(uuid, text)
  TO authenticated;

COMMIT;
