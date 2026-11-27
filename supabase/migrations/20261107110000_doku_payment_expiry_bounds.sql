BEGIN;

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
      gateway_expires_at = CASE
        WHEN payment.gateway_expires_at IS NULL
          OR payment.gateway_expires_at > p_gateway_expires_at
        THEN p_gateway_expires_at
        ELSE payment.gateway_expires_at
      END,
      expired_at = CASE
        WHEN payment.expired_at IS NULL OR payment.expired_at > p_gateway_expires_at
        THEN p_gateway_expires_at
        ELSE payment.expired_at
      END,
      payment_session_state = 'active',
      next_reconcile_at = CASE
        WHEN payment.gateway_expires_at IS NULL
          OR payment.gateway_expires_at > p_gateway_expires_at
        THEN p_gateway_expires_at
        ELSE payment.gateway_expires_at
      END,
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

ALTER FUNCTION public.doku_save_checkout_response(uuid, text, timestamptz)
  OWNER TO postgres;

COMMIT;
