BEGIN;

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
      v_payment.payment_status::text,
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
    order_id, payment_method, payment_gateway, payment_status, amount,
    expired_at, gateway_invoice_number, gateway_request_id,
    gateway_request_body, gateway_expires_at, payment_session_state,
    next_reconcile_at
  )
  VALUES (
    v_order.id, 'DOKU Checkout', 'doku', 'pending', v_order.total_price,
    p_expires_at, v_order.order_number, p_request_id, p_request_body,
    p_expires_at, 'creating', p_expires_at
  )
  RETURNING * INTO v_payment;

  RETURN QUERY SELECT
    v_payment.id,
    v_payment.gateway_invoice_number,
    v_payment.gateway_request_id,
    v_payment.gateway_request_body,
    v_payment.payment_status::text,
    v_payment.payment_session_state,
    v_payment.payment_url,
    v_payment.gateway_expires_at;
END;
$doku_begin_payment$;

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
    v_order.payment_status::text,
    v_order.order_status::text,
    COALESCE(v_payment.payment_status, v_order.payment_status)::text,
    v_payment.payment_url,
    v_payment.gateway_expires_at,
    v_payment.payment_session_state;
END;
$doku_get_order_payment_status$;

ALTER FUNCTION public.doku_begin_payment(uuid, text, text, timestamptz)
  OWNER TO postgres;
ALTER FUNCTION public.doku_get_order_payment_status(uuid) OWNER TO postgres;

COMMIT;
