BEGIN;

DO $doku_reconciliation_preflight$
DECLARE
  v_missing text;
  v_order_payment_constraint text;
  v_order_status_constraint text;
  v_payment_status_constraint text;
  v_payment_session_constraint text;
BEGIN
  SELECT pg_catalog.string_agg(
    required.object_name,
    ', ' ORDER BY required.object_name
  )
  INTO v_missing
  FROM (
    VALUES
      ('table public.payments'),
      ('table public.orders'),
      ('table public.doku_webhook_events'),
      ('function public.doku_record_reconciliation(uuid,text,text,numeric,text,text)'),
      ('function public.doku_record_notification(text,text,text,numeric,text,text,text,timestamptz)'),
      ('function public.doku_list_reconciliation_candidates(integer)')
  ) AS required(object_name)
  WHERE CASE required.object_name
    WHEN 'table public.payments' THEN pg_catalog.to_regclass('public.payments') IS NULL
    WHEN 'table public.orders' THEN pg_catalog.to_regclass('public.orders') IS NULL
    WHEN 'table public.doku_webhook_events' THEN pg_catalog.to_regclass('public.doku_webhook_events') IS NULL
    WHEN 'function public.doku_record_reconciliation(uuid,text,text,numeric,text,text)'
      THEN pg_catalog.to_regprocedure('public.doku_record_reconciliation(uuid,text,text,numeric,text,text)') IS NULL
    WHEN 'function public.doku_record_notification(text,text,text,numeric,text,text,text,timestamptz)'
      THEN pg_catalog.to_regprocedure('public.doku_record_notification(text,text,text,numeric,text,text,text,timestamptz)') IS NULL
    WHEN 'function public.doku_list_reconciliation_candidates(integer)'
      THEN pg_catalog.to_regprocedure('public.doku_list_reconciliation_candidates(integer)') IS NULL
    ELSE true
  END;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'doku_reconciliation_preflight_missing_objects: %', v_missing;
  END IF;

  SELECT pg_catalog.string_agg(
    required.column_name,
    ', ' ORDER BY required.column_name
  )
  INTO v_missing
  FROM (
    VALUES
      ('public.payments.id'),
      ('public.payments.order_id'),
      ('public.payments.payment_status'),
      ('public.payments.paid_at'),
      ('public.payments.payment_session_state'),
      ('public.payments.gateway_transaction_id'),
      ('public.payments.gateway_invoice_number'),
      ('public.payments.gateway_request_id'),
      ('public.payments.amount'),
      ('public.payments.gateway_expires_at'),
      ('public.payments.next_reconcile_at'),
      ('public.orders.id'),
      ('public.orders.payment_status'),
      ('public.orders.order_status'),
      ('public.orders.total_price'),
      ('public.orders.updated_at')
  ) AS required(column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid = pg_catalog.to_regclass(split_part(required.column_name, '.', 1) || '.' || split_part(required.column_name, '.', 2))
      AND attribute.attname = split_part(required.column_name, '.', 3)
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'doku_reconciliation_preflight_missing_columns: %', v_missing;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid = 'public.payments'::regclass
      AND attribute.attname = 'id'
      AND pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) = 'uuid'
  )
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_attribute AS attribute
      WHERE attribute.attrelid = 'public.payments'::regclass
        AND attribute.attname = 'amount'
        AND pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) = 'numeric'
    )
  THEN
    RAISE EXCEPTION 'doku_reconciliation_preflight_invalid_payment_types';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      VALUES
        ('public.orders'::regclass, 'id', 'uuid'),
        ('public.orders'::regclass, 'payment_status', 'character varying'),
        ('public.orders'::regclass, 'order_status', 'character varying'),
        ('public.orders'::regclass, 'total_price', 'numeric'),
        ('public.orders'::regclass, 'updated_at', 'timestamp with time zone'),
        ('public.payments'::regclass, 'id', 'uuid'),
        ('public.payments'::regclass, 'order_id', 'uuid'),
        ('public.payments'::regclass, 'payment_status', 'character varying'),
        ('public.payments'::regclass, 'paid_at', 'timestamp with time zone'),
        ('public.payments'::regclass, 'payment_session_state', 'text'),
        ('public.payments'::regclass, 'gateway_transaction_id', 'character varying'),
        ('public.payments'::regclass, 'gateway_invoice_number', 'text'),
        ('public.payments'::regclass, 'gateway_request_id', 'text'),
        ('public.payments'::regclass, 'amount', 'numeric'),
        ('public.payments'::regclass, 'gateway_expires_at', 'timestamp with time zone'),
        ('public.payments'::regclass, 'next_reconcile_at', 'timestamp with time zone')
    ) AS required(table_oid, column_name, expected_type)
    WHERE NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute AS attribute
      WHERE attribute.attrelid = required.table_oid
        AND attribute.attname = required.column_name
        AND pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) = required.expected_type
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
    )
  )
  THEN
    RAISE EXCEPTION 'doku_reconciliation_preflight_invalid_column_types';
  END IF;

  IF pg_catalog.pg_get_constraintdef(
    (SELECT constraint_row.oid
     FROM pg_catalog.pg_constraint AS constraint_row
     WHERE constraint_row.conrelid = 'public.orders'::regclass
       AND constraint_row.conname = 'orders_payment_status_check')
  ) IS NULL
  THEN
    RAISE EXCEPTION 'doku_reconciliation_preflight_missing_constraint: orders_payment_status_check';
  END IF;
  SELECT pg_catalog.pg_get_constraintdef(constraint_row.oid)
  INTO v_order_payment_constraint
  FROM pg_catalog.pg_constraint AS constraint_row
  WHERE constraint_row.conrelid = 'public.orders'::regclass
    AND constraint_row.conname = 'orders_payment_status_check';
  IF v_order_payment_constraint NOT LIKE '%pending%'
    OR v_order_payment_constraint NOT LIKE '%paid%'
    OR v_order_payment_constraint NOT LIKE '%failed%'
    OR v_order_payment_constraint NOT LIKE '%refunded%'
    OR v_order_payment_constraint NOT LIKE '%expired%'
  THEN
    RAISE EXCEPTION 'doku_reconciliation_preflight_invalid_constraint: orders_payment_status_check';
  END IF;

  IF pg_catalog.pg_get_constraintdef(
    (SELECT constraint_row.oid
     FROM pg_catalog.pg_constraint AS constraint_row
     WHERE constraint_row.conrelid = 'public.orders'::regclass
       AND constraint_row.conname = 'orders_order_status_check')
  ) IS NULL
  THEN
    RAISE EXCEPTION 'doku_reconciliation_preflight_missing_constraint: orders_order_status_check';
  END IF;
  SELECT pg_catalog.pg_get_constraintdef(constraint_row.oid)
  INTO v_order_status_constraint
  FROM pg_catalog.pg_constraint AS constraint_row
  WHERE constraint_row.conrelid = 'public.orders'::regclass
    AND constraint_row.conname = 'orders_order_status_check';
  IF v_order_status_constraint NOT LIKE '%pending%'
    OR v_order_status_constraint NOT LIKE '%processing%'
    OR v_order_status_constraint NOT LIKE '%shipped%'
    OR v_order_status_constraint NOT LIKE '%delivered%'
    OR v_order_status_constraint NOT LIKE '%completed%'
    OR v_order_status_constraint NOT LIKE '%cancelled%'
  THEN
    RAISE EXCEPTION 'doku_reconciliation_preflight_invalid_constraint: orders_order_status_check';
  END IF;

  IF pg_catalog.pg_get_constraintdef(
    (SELECT constraint_row.oid
     FROM pg_catalog.pg_constraint AS constraint_row
     WHERE constraint_row.conrelid = 'public.payments'::regclass
       AND constraint_row.conname = 'payments_payment_status_check')
  ) IS NULL
  THEN
    RAISE EXCEPTION 'doku_reconciliation_preflight_missing_constraint: payments_payment_status_check';
  END IF;
  SELECT pg_catalog.pg_get_constraintdef(constraint_row.oid)
  INTO v_payment_status_constraint
  FROM pg_catalog.pg_constraint AS constraint_row
  WHERE constraint_row.conrelid = 'public.payments'::regclass
    AND constraint_row.conname = 'payments_payment_status_check';
  IF v_payment_status_constraint NOT LIKE '%pending%'
    OR v_payment_status_constraint NOT LIKE '%paid%'
    OR v_payment_status_constraint NOT LIKE '%failed%'
    OR v_payment_status_constraint NOT LIKE '%expired%'
    OR v_payment_status_constraint NOT LIKE '%refunded%'
    OR v_payment_status_constraint NOT LIKE '%cancelled%'
  THEN
    RAISE EXCEPTION 'doku_reconciliation_preflight_invalid_constraint: payments_payment_status_check';
  END IF;

  IF pg_catalog.pg_get_constraintdef(
    (SELECT constraint_row.oid
     FROM pg_catalog.pg_constraint AS constraint_row
     WHERE constraint_row.conrelid = 'public.payments'::regclass
       AND constraint_row.conname = 'payments_payment_session_state_check')
  ) IS NULL
  THEN
    RAISE EXCEPTION 'doku_reconciliation_preflight_missing_constraint: payments_payment_session_state_check';
  END IF;
  SELECT pg_catalog.pg_get_constraintdef(constraint_row.oid)
  INTO v_payment_session_constraint
  FROM pg_catalog.pg_constraint AS constraint_row
  WHERE constraint_row.conrelid = 'public.payments'::regclass
    AND constraint_row.conname = 'payments_payment_session_state_check';
  IF v_payment_session_constraint NOT LIKE '%creating%'
    OR v_payment_session_constraint NOT LIKE '%active%'
    OR v_payment_session_constraint NOT LIKE '%uncertain%'
    OR v_payment_session_constraint NOT LIKE '%expired%'
    OR v_payment_session_constraint NOT LIKE '%cancelled%'
  THEN
    RAISE EXCEPTION 'doku_reconciliation_preflight_invalid_constraint: payments_payment_session_state_check';
  END IF;

  IF pg_catalog.to_regprocedure('public.doku_restore_order_inventory_once(uuid,uuid)') IS NULL
    OR pg_catalog.to_regprocedure('public.doku_expire_payment(uuid,text,numeric,text)') IS NULL
  THEN
    RAISE EXCEPTION 'doku_reconciliation_preflight_missing_inventory_rpc';
  END IF;
END;
$doku_reconciliation_preflight$;

CREATE TABLE IF NOT EXISTS public.doku_reconciliation_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_key text NOT NULL,
  gateway text NOT NULL DEFAULT 'doku'
    CONSTRAINT doku_reconciliation_incidents_gateway_check
    CHECK (gateway = 'doku'),
  source text NOT NULL
    CONSTRAINT doku_reconciliation_incidents_source_check
    CHECK (source IN ('reconciliation', 'notification')),
  event_id text,
  body_digest text,
  payment_id uuid,
  order_id uuid,
  invoice_number text,
  amount numeric,
  original_request_id text,
  gateway_transaction_id text,
  existing_gateway_transaction_id text,
  gateway_status text,
  gateway_transaction_status text,
  local_payment_status text,
  local_order_payment_status text,
  local_order_status text,
  payment_session_state text,
  reason_code text NOT NULL
    CONSTRAINT doku_reconciliation_incidents_reason_code_check
    CHECK (reason_code ~ '^[a-z0-9_]{1,64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
  , CONSTRAINT doku_reconciliation_incidents_unique_key
    UNIQUE (gateway, incident_key)
);

CREATE OR REPLACE FUNCTION public.doku_validate_reconciliation_incident_schema()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $doku_validate_reconciliation_incident_schema$
DECLARE
  v_missing text;
  v_invalid text;
BEGIN
  IF pg_catalog.to_regclass('public.doku_reconciliation_incidents') IS NULL THEN
    RAISE EXCEPTION 'doku_reconciliation_incident_missing_table';
  END IF;

  SELECT pg_catalog.string_agg(required.column_name, ', ' ORDER BY required.column_name)
  INTO v_missing
  FROM (
    VALUES
      ('id','uuid'),
      ('incident_key','text'),
      ('gateway','text'),
      ('source','text'),
      ('event_id','text'),
      ('body_digest','text'),
      ('payment_id','uuid'),
      ('order_id','uuid'),
      ('invoice_number','text'),
      ('amount','numeric'),
      ('original_request_id','text'),
      ('gateway_transaction_id','text'),
      ('existing_gateway_transaction_id','text'),
      ('gateway_status','text'),
      ('gateway_transaction_status','text'),
      ('local_payment_status','text'),
      ('local_order_payment_status','text'),
      ('local_order_status','text'),
      ('payment_session_state','text'),
      ('reason_code','text'),
      ('created_at','timestamp with time zone')
  ) AS required(column_name, expected_type)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid = 'public.doku_reconciliation_incidents'::regclass
      AND attribute.attname = required.column_name
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'doku_reconciliation_incident_missing_column: %', v_missing;
  END IF;

  SELECT pg_catalog.string_agg(required.column_name, ', ' ORDER BY required.column_name)
  INTO v_invalid
  FROM (
    VALUES
      ('id','uuid'),
      ('incident_key','text'),
      ('gateway','text'),
      ('source','text'),
      ('event_id','text'),
      ('body_digest','text'),
      ('payment_id','uuid'),
      ('order_id','uuid'),
      ('invoice_number','text'),
      ('amount','numeric'),
      ('original_request_id','text'),
      ('gateway_transaction_id','text'),
      ('existing_gateway_transaction_id','text'),
      ('gateway_status','text'),
      ('gateway_transaction_status','text'),
      ('local_payment_status','text'),
      ('local_order_payment_status','text'),
      ('local_order_status','text'),
      ('payment_session_state','text'),
      ('reason_code','text'),
      ('created_at','timestamp with time zone')
  ) AS required(column_name, expected_type)
  WHERE EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid = 'public.doku_reconciliation_incidents'::regclass
      AND attribute.attname = required.column_name
      AND pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) IS DISTINCT FROM required.expected_type
  );
  IF v_invalid IS NOT NULL THEN
    RAISE EXCEPTION 'doku_reconciliation_incident_invalid_type: %', v_invalid;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      VALUES
        ('id', false),
        ('incident_key', false),
        ('gateway', false),
        ('source', false),
        ('event_id', true),
        ('body_digest', true),
        ('payment_id', true),
        ('order_id', true),
        ('invoice_number', true),
        ('amount', true),
        ('original_request_id', true),
        ('gateway_transaction_id', true),
        ('existing_gateway_transaction_id', true),
        ('gateway_status', true),
        ('gateway_transaction_status', true),
        ('local_payment_status', true),
        ('local_order_payment_status', true),
        ('local_order_status', true),
        ('payment_session_state', true),
        ('reason_code', false),
        ('created_at', false)
    ) AS required(column_name, nullable)
    JOIN pg_catalog.pg_attribute AS attribute
      ON attribute.attrelid = 'public.doku_reconciliation_incidents'::regclass
     AND attribute.attname = required.column_name
    WHERE attribute.attnotnull IS DISTINCT FROM NOT required.nullable
  ) THEN
    RAISE EXCEPTION 'doku_reconciliation_incident_invalid_nullability';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attrdef AS default_row
    JOIN pg_catalog.pg_attribute AS attribute
      ON attribute.attrelid = default_row.adrelid
     AND attribute.attnum = default_row.adnum
    WHERE default_row.adrelid = 'public.doku_reconciliation_incidents'::regclass
      AND attribute.attname = 'id'
      AND pg_catalog.pg_get_expr(default_row.adbin, default_row.adrelid) LIKE '%gen_random_uuid%'
  ) THEN
    RAISE EXCEPTION 'doku_reconciliation_incident_invalid_default: id';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attrdef AS default_row
    JOIN pg_catalog.pg_attribute AS attribute
      ON attribute.attrelid = default_row.adrelid
     AND attribute.attnum = default_row.adnum
    WHERE default_row.adrelid = 'public.doku_reconciliation_incidents'::regclass
      AND attribute.attname = 'gateway'
      AND pg_catalog.pg_get_expr(default_row.adbin, default_row.adrelid) LIKE '%doku%'
  ) THEN
    RAISE EXCEPTION 'doku_reconciliation_incident_invalid_default: gateway';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attrdef AS default_row
    JOIN pg_catalog.pg_attribute AS attribute
      ON attribute.attrelid = default_row.adrelid
     AND attribute.attnum = default_row.adnum
    WHERE default_row.adrelid = 'public.doku_reconciliation_incidents'::regclass
      AND attribute.attname = 'created_at'
      AND pg_catalog.pg_get_expr(default_row.adbin, default_row.adrelid) IN ('now()', 'CURRENT_TIMESTAMP')
  ) THEN
    RAISE EXCEPTION 'doku_reconciliation_incident_invalid_default: created_at';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attrdef AS default_row
    JOIN pg_catalog.pg_attribute AS attribute
      ON attribute.attrelid = default_row.adrelid
     AND attribute.attnum = default_row.adnum
    WHERE default_row.adrelid = 'public.doku_reconciliation_incidents'::regclass
      AND attribute.attname IN ('source','event_id','body_digest','payment_id','order_id','invoice_number','amount','original_request_id','gateway_transaction_id','existing_gateway_transaction_id','gateway_status','gateway_transaction_status','local_payment_status','local_order_payment_status','local_order_status','payment_session_state','reason_code')
  ) THEN
    RAISE EXCEPTION 'doku_reconciliation_incident_invalid_default';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_row
    WHERE constraint_row.conrelid = 'public.doku_reconciliation_incidents'::regclass
      AND constraint_row.conname = 'doku_reconciliation_incidents_gateway_check'
  )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_constraint AS constraint_row
      WHERE constraint_row.conrelid = 'public.doku_reconciliation_incidents'::regclass
        AND constraint_row.conname = 'doku_reconciliation_incidents_source_check'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_constraint AS constraint_row
      WHERE constraint_row.conrelid = 'public.doku_reconciliation_incidents'::regclass
        AND constraint_row.conname = 'doku_reconciliation_incidents_reason_code_check'
    )
  THEN
    RAISE EXCEPTION 'doku_reconciliation_incident_missing_check';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_row
    WHERE constraint_row.conrelid = 'public.doku_reconciliation_incidents'::regclass
      AND constraint_row.contype = 'f'
  ) THEN
    RAISE EXCEPTION 'doku_reconciliation_incident_foreign_key';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_row
    WHERE constraint_row.conrelid = 'public.doku_reconciliation_incidents'::regclass
      AND constraint_row.conname = 'doku_reconciliation_incidents_pkey'
      AND constraint_row.contype = 'p'
  ) THEN
    RAISE EXCEPTION 'doku_reconciliation_incident_missing_primary_key';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index AS index_row
    JOIN pg_catalog.pg_class AS index_class
      ON index_class.oid = index_row.indexrelid
    JOIN pg_catalog.pg_class AS table_class
      ON table_class.oid = index_row.indrelid
    WHERE table_class.oid = 'public.doku_reconciliation_incidents'::regclass
      AND index_class.relname = 'doku_reconciliation_incidents_unique_key'
      AND index_row.indisunique
      AND index_row.indisvalid
      AND index_row.indnkeyatts = 2
      AND pg_catalog.pg_get_indexdef(index_row.indexrelid)
        LIKE '%(gateway, incident_key)%'
  )
  THEN
    RAISE EXCEPTION 'doku_reconciliation_incident_missing_unique_index';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    WHERE relation.oid = 'public.doku_reconciliation_incidents'::regclass
      AND relation.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'doku_reconciliation_incident_rls';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies AS policy
    WHERE policy.schemaname='public'
      AND policy.tablename='doku_reconciliation_incidents'
  ) THEN
    RAISE EXCEPTION 'doku_reconciliation_incident_policy';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(relation.relacl, pg_catalog.acldefault('r', relation.relowner))
    ) AS acl
    WHERE relation.oid = 'public.doku_reconciliation_incidents'::regclass
      AND acl.grantee = 0
  )
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class AS relation
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(relation.relacl, pg_catalog.acldefault('r', relation.relowner))
      ) AS acl
      WHERE relation.oid = 'public.doku_reconciliation_incidents'::regclass
        AND acl.grantee IN (
          pg_catalog.to_regrole('anon'),
          pg_catalog.to_regrole('authenticated'),
          pg_catalog.to_regrole('service_role')
        )
    )
  THEN
    RAISE EXCEPTION 'doku_reconciliation_incident_privilege';
  END IF;
END;
$doku_validate_reconciliation_incident_schema$;

ALTER FUNCTION public.doku_validate_reconciliation_incident_schema() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.doku_validate_reconciliation_incident_schema()
  FROM PUBLIC, anon, authenticated, service_role;

DO $doku_reconciliation_postcreate_preflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      VALUES
        ('id','uuid'),
        ('incident_key','text'),
        ('source','text'),
        ('event_id','text'),
        ('payment_id','uuid'),
        ('order_id','uuid'),
        ('invoice_number','text'),
        ('amount','numeric'),
        ('gateway_transaction_id','text'),
        ('existing_gateway_transaction_id','text'),
        ('reason_code','text'),
        ('created_at','timestamp with time zone')
    ) AS required(column_name, expected_type)
    WHERE NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute AS attribute
      WHERE attribute.attrelid = 'public.doku_reconciliation_incidents'::regclass
        AND attribute.attname = required.column_name
        AND pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) = required.expected_type
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
    )
  )
  THEN
    RAISE EXCEPTION 'doku_reconciliation_preflight_invalid_incident_types';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index AS index_row
    JOIN pg_catalog.pg_class AS index_class
      ON index_class.oid = index_row.indexrelid
    WHERE index_row.indrelid = 'public.doku_reconciliation_incidents'::regclass
      AND index_class.relname = 'doku_reconciliation_incidents_unique_key'
      AND index_row.indisunique
      AND index_row.indisvalid
      AND index_row.indnkeyatts = 2
  )
  THEN
    RAISE EXCEPTION 'doku_reconciliation_preflight_missing_incident_indexes';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'payments'
      AND indexname = 'payments_gateway_invoice_number_unique_idx'
  )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'payments'
        AND indexname = 'payments_gateway_request_id_unique_idx'
    )
  THEN
    RAISE EXCEPTION 'doku_reconciliation_preflight_missing_payment_indexes';
  END IF;
END;
$doku_reconciliation_postcreate_preflight$;

ALTER TABLE public.doku_reconciliation_incidents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.doku_reconciliation_incidents
  FROM PUBLIC, anon, authenticated, service_role;
DO $doku_validate_incident_call$
BEGIN
  PERFORM public.doku_validate_reconciliation_incident_schema();
END;
$doku_validate_incident_call$;

CREATE OR REPLACE FUNCTION public.doku_record_reconciliation_incident(
  p_source text,
  p_event_id text,
  p_body_digest text,
  p_payment_id uuid,
  p_order_id uuid,
  p_invoice_number text,
  p_amount numeric,
  p_original_request_id text,
  p_gateway_transaction_id text,
  p_existing_gateway_transaction_id text,
  p_gateway_status text,
  p_gateway_transaction_status text,
  p_local_payment_status text,
  p_local_order_payment_status text,
  p_local_order_status text,
  p_local_payment_session_state text,
  p_reason_code text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $doku_record_reconciliation_incident$
DECLARE
  v_incident_id uuid;
  v_incident_key text;
  v_payment public.payments%ROWTYPE;
  v_order public.orders%ROWTYPE;
BEGIN
  IF p_source IS NULL OR p_source NOT IN ('reconciliation', 'notification')
    OR p_reason_code IS NULL
    OR p_reason_code !~ '^[a-z0-9_]{1,64}$'
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'doku_reconciliation_incident_invalid';
  END IF;

  IF p_payment_id IS NOT NULL THEN
    SELECT payment.*
    INTO v_payment
    FROM public.payments AS payment
    WHERE payment.id = p_payment_id
      AND payment.payment_gateway = 'doku';
  ELSIF p_invoice_number IS NOT NULL THEN
    SELECT payment.*
    INTO v_payment
    FROM public.payments AS payment
    WHERE payment.gateway_invoice_number = p_invoice_number
      AND payment.payment_gateway = 'doku'
    LIMIT 1;
  END IF;

  IF FOUND AND v_payment.order_id IS NOT NULL THEN
    SELECT target_order.*
    INTO v_order
    FROM public.orders AS target_order
    WHERE target_order.id = v_payment.order_id;
  ELSIF p_order_id IS NOT NULL THEN
    SELECT target_order.*
    INTO v_order
    FROM public.orders AS target_order
    WHERE target_order.id = p_order_id;
  END IF;

  v_incident_key :=
    'payment:' ||
    COALESCE(COALESCE(p_payment_id, v_payment.id)::text, 'none') ||
    ':' || p_reason_code ||
    ':' || COALESCE(p_gateway_status, 'unknown') ||
    ':' || COALESCE(
    p_gateway_transaction_id,
    COALESCE(p_existing_gateway_transaction_id, v_payment.gateway_transaction_id),
    'none'
    );

  INSERT INTO public.doku_reconciliation_incidents (
    incident_key, gateway, source, event_id, body_digest, payment_id, order_id,
    invoice_number, amount, original_request_id,
    gateway_transaction_id, existing_gateway_transaction_id,
    gateway_status, gateway_transaction_status,
    local_payment_status, local_order_payment_status, local_order_status,
    payment_session_state, reason_code
  )
  VALUES (
    v_incident_key, 'doku', p_source, p_event_id, p_body_digest,
    COALESCE(p_payment_id, v_payment.id),
    COALESCE(p_order_id, v_order.id),
    COALESCE(p_invoice_number, v_payment.gateway_invoice_number),
    COALESCE(p_amount, v_payment.amount),
    COALESCE(p_original_request_id, v_payment.gateway_request_id),
    p_gateway_transaction_id,
    COALESCE(p_existing_gateway_transaction_id, v_payment.gateway_transaction_id),
    p_gateway_status,
    p_gateway_transaction_status,
    COALESCE(p_local_payment_status, v_payment.payment_status),
    COALESCE(p_local_order_payment_status, v_order.payment_status),
    COALESCE(p_local_order_status, v_order.order_status),
    COALESCE(p_local_payment_session_state, v_payment.payment_session_state),
    p_reason_code
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_incident_id;

  RETURN v_incident_id;
END;
$doku_record_reconciliation_incident$;

ALTER FUNCTION public.doku_record_reconciliation_incident(
  text,text,text,uuid,uuid,text,numeric,text,text,text,text,text,text,text,text,text,text
) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.doku_record_reconciliation_incident(
  text,text,text,uuid,uuid,text,numeric,text,text,text,text,text,text,text,text,text,text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.doku_record_reconciliation_incident(
  text,text,text,uuid,uuid,text,numeric,text,text,text,text,text,text,text,text,text,text
) TO service_role;

DROP FUNCTION IF EXISTS public.doku_list_reconciliation_candidates(integer);

CREATE FUNCTION public.doku_list_reconciliation_candidates(p_limit integer)
RETURNS TABLE (
  payment_id uuid,
  invoice_number text,
  original_request_id text,
  payment_expires_at timestamptz,
  gateway_transaction_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $doku_list_reconciliation_candidates$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 50 THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'doku_reconciliation_limit_invalid';
  END IF;

  RETURN QUERY
  SELECT
    payment.id,
    payment.gateway_invoice_number,
    payment.gateway_request_id,
    payment.gateway_expires_at,
    payment.gateway_transaction_id::text
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

ALTER FUNCTION public.doku_list_reconciliation_candidates(integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.doku_list_reconciliation_candidates(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.doku_list_reconciliation_candidates(integer)
  TO service_role;

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

  IF v_payment.gateway_invoice_number IS DISTINCT FROM p_invoice_number
    OR v_payment.amount IS DISTINCT FROM p_amount
    OR v_payment.gateway_request_id IS DISTINCT FROM p_original_request_id
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'doku_reconciliation_reference_mismatch';
  END IF;

  IF p_gateway_transaction_id IS NOT NULL
    AND v_payment.gateway_transaction_id IS NOT NULL
    AND v_payment.gateway_transaction_id IS DISTINCT FROM p_gateway_transaction_id
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'doku_reconciliation_transaction_mismatch';
  END IF;

  IF v_status = 'EXPIRED' THEN
    RETURN public.doku_expire_payment(
      p_payment_id,
      p_invoice_number,
      p_amount,
      p_original_request_id
    );
  END IF;

  IF v_status <> 'SUCCESS'
    AND v_status <> 'PENDING'
    AND v_status <> 'FAILED'
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'doku_reconciliation_status_unknown';
  END IF;

  IF v_status IN ('PENDING', 'FAILED')
    AND (
      v_payment.payment_status = 'paid'
      OR v_order.payment_status = 'paid'
    )
  THEN
    RETURN 'already_paid';
  END IF;

  IF v_status <> 'SUCCESS' THEN
    UPDATE public.payments AS payment
    SET reconciliation_error_code = CASE
          WHEN v_status ~ '^[A-Z0-9_]{1,50}$'
            THEN 'gateway_status_' || pg_catalog.lower(v_status)
          ELSE 'gateway_status_unknown'
        END,
        next_reconcile_at = pg_catalog.now() + interval '15 minutes',
        gateway_transaction_id = CASE
          WHEN gateway_transaction_id IS NULL THEN p_gateway_transaction_id
          ELSE gateway_transaction_id
        END,
        updated_at = pg_catalog.now()
    WHERE payment.id = p_payment_id;
    RETURN 'pending';
  END IF;

  IF v_order.order_status IN ('cancelled', 'completed')
    OR v_order.payment_status IN ('expired', 'failed', 'refunded')
    OR v_payment.payment_status IN ('expired', 'cancelled', 'failed', 'refunded')
  THEN
    INSERT INTO public.doku_reconciliation_incidents (
      incident_key, gateway, source, payment_id, order_id, invoice_number, amount,
      original_request_id, gateway_transaction_id,
      existing_gateway_transaction_id, gateway_status,
      gateway_transaction_status, local_payment_status,
      local_order_payment_status, local_order_status,
      payment_session_state, reason_code
    )
    VALUES (
      'payment:' || v_payment.id::text || ':contradictory_success:' || v_status || ':' ||
        COALESCE(p_gateway_transaction_id, v_payment.gateway_transaction_id, 'none'),
      'doku', 'reconciliation', v_payment.id, v_order.id,
      v_payment.gateway_invoice_number, v_payment.amount,
      v_payment.gateway_request_id, p_gateway_transaction_id,
      v_payment.gateway_transaction_id, v_status, v_status,
      v_payment.payment_status, v_order.payment_status,
      v_order.order_status, v_payment.payment_session_state,
      'contradictory_success'
    )
    ON CONFLICT DO NOTHING;
    RETURN 'contradictory_success';
  END IF;

  IF v_payment.payment_status = 'paid'
    AND v_order.payment_status = 'paid'
  THEN
    RETURN 'already_paid';
  END IF;

  IF v_payment.payment_status NOT IN ('pending', 'paid')
    OR v_order.payment_status NOT IN ('pending', 'paid')
  THEN
    INSERT INTO public.doku_reconciliation_incidents (
      incident_key, gateway, source, payment_id, order_id, invoice_number, amount,
      original_request_id, gateway_transaction_id,
      existing_gateway_transaction_id, gateway_status,
      gateway_transaction_status, local_payment_status,
      local_order_payment_status, local_order_status,
      payment_session_state, reason_code
    )
    VALUES (
      'payment:' || v_payment.id::text || ':contradictory_success:' || v_status || ':' ||
        COALESCE(p_gateway_transaction_id, v_payment.gateway_transaction_id, 'none'),
      'doku', 'reconciliation', v_payment.id, v_order.id,
      v_payment.gateway_invoice_number, v_payment.amount,
      v_payment.gateway_request_id, p_gateway_transaction_id,
      v_payment.gateway_transaction_id, v_status, v_status,
      v_payment.payment_status, v_order.payment_status,
      v_order.order_status, v_payment.payment_session_state,
      'contradictory_success'
    )
    ON CONFLICT DO NOTHING;
    RETURN 'contradictory_success';
  END IF;

  UPDATE public.payments AS payment
  SET payment_status = 'paid',
      paid_at = COALESCE(payment.paid_at, pg_catalog.now()),
      gateway_transaction_id = CASE
        WHEN payment.gateway_transaction_id IS NULL
          THEN p_gateway_transaction_id
        ELSE payment.gateway_transaction_id
      END,
      payment_session_state = NULL,
      next_reconcile_at = NULL,
      reconciliation_error_code = NULL,
      last_notification_status = 'SUCCESS',
      updated_at = pg_catalog.now()
  WHERE payment.id = p_payment_id
    AND payment.payment_status IN ('pending', 'paid');

  UPDATE public.orders AS target_order
  SET payment_status = 'paid',
      updated_at = pg_catalog.now()
  WHERE target_order.id = v_order.id
    AND target_order.payment_status IN ('pending', 'paid')
    AND target_order.order_status NOT IN ('cancelled', 'completed');

  IF v_payment.payment_status = 'paid'
    OR v_order.payment_status = 'paid'
  THEN
    RETURN 'paid_state_repaired';
  END IF;
  RETURN 'success_applied';
END;
$doku_record_reconciliation$;

ALTER FUNCTION public.doku_record_reconciliation(
  uuid,text,text,numeric,text,text
) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.doku_record_reconciliation(
  uuid,text,text,numeric,text,text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.doku_record_reconciliation(
  uuid,text,text,numeric,text,text
) TO service_role;

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
  v_status text := pg_catalog.upper(pg_catalog.btrim(p_status));
  v_outcome text;
BEGIN
  IF p_event_id IS NULL
    OR pg_catalog.length(p_event_id) NOT BETWEEN 1 AND 128
    OR p_body_digest IS NULL
    OR pg_catalog.length(p_body_digest) <> 44
    OR p_invoice_number IS NULL
    OR p_amount IS NULL
    OR p_amount <= 0
    OR v_status = ''
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'doku_notification_invalid';
  END IF;

  SELECT payment.order_id
  INTO v_order_id
  FROM public.payments AS payment
  WHERE payment.payment_gateway = 'doku'
    AND payment.gateway_invoice_number = p_invoice_number;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002',
      MESSAGE = 'doku_invoice_not_found';
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
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'doku_notification_amount_mismatch';
  END IF;

  IF p_original_request_id IS NOT NULL
    AND v_payment.gateway_request_id IS DISTINCT FROM p_original_request_id
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'doku_notification_reference_mismatch';
  END IF;

  IF p_gateway_transaction_id IS NOT NULL
    AND v_payment.gateway_transaction_id IS NOT NULL
    AND v_payment.gateway_transaction_id IS DISTINCT FROM p_gateway_transaction_id
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'doku_notification_transaction_mismatch';
  END IF;

  SELECT event.body_digest
  INTO v_existing_digest
  FROM public.doku_webhook_events AS event
  WHERE event.gateway = 'doku'
    AND event.event_id = p_event_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing_digest IS DISTINCT FROM p_body_digest THEN
      RAISE EXCEPTION USING ERRCODE = '22023',
        MESSAGE = 'doku_notification_replay_conflict';
    END IF;
    RETURN 'duplicate';
  END IF;

  IF v_status IN ('SUCCESS', 'EXPIRED')
    AND (
      p_original_request_id IS NULL
      OR v_payment.gateway_request_id IS DISTINCT FROM p_original_request_id
    )
  THEN
    v_outcome := 'reference_missing';
  ELSIF v_status = 'SUCCESS' THEN
    IF v_order.order_status IN ('cancelled', 'completed')
      OR v_order.payment_status IN ('expired', 'failed', 'refunded')
      OR v_payment.payment_status IN ('expired', 'cancelled', 'failed', 'refunded')
    THEN
      INSERT INTO public.doku_reconciliation_incidents (
        incident_key, gateway, source, event_id, body_digest, payment_id, order_id,
        invoice_number, amount, original_request_id,
        gateway_transaction_id, existing_gateway_transaction_id,
        gateway_status, gateway_transaction_status,
        local_payment_status, local_order_payment_status,
        local_order_status, payment_session_state, reason_code
      )
      VALUES (
        'payment:' || v_payment.id::text || ':contradictory_success:' || v_status || ':' ||
          COALESCE(p_gateway_transaction_id, v_payment.gateway_transaction_id, 'none'),
        'doku', 'notification', p_event_id, p_body_digest,
        v_payment.id, v_order.id, p_invoice_number, p_amount,
        p_original_request_id, p_gateway_transaction_id,
        v_payment.gateway_transaction_id, v_status, v_status,
        v_payment.payment_status, v_order.payment_status,
        v_order.order_status, v_payment.payment_session_state,
        'contradictory_success'
      )
      ON CONFLICT DO NOTHING;
      v_outcome := 'contradictory_success';
    ELSIF v_payment.payment_status = 'paid'
      AND v_order.payment_status = 'paid'
    THEN
      v_outcome := 'already_paid';
    ELSE
      UPDATE public.payments AS payment
      SET payment_status = 'paid',
          paid_at = COALESCE(payment.paid_at, p_event_time, pg_catalog.now()),
          gateway_transaction_id = CASE
            WHEN payment.gateway_transaction_id IS NULL
              THEN p_gateway_transaction_id
            ELSE payment.gateway_transaction_id
          END,
          payment_session_state = NULL,
          next_reconcile_at = NULL,
          reconciliation_error_code = NULL,
          last_notification_status = v_status,
          updated_at = pg_catalog.now()
      WHERE payment.id = v_payment.id
        AND payment.payment_status IN ('pending', 'paid');

      UPDATE public.orders AS target_order
      SET payment_status = 'paid',
          updated_at = pg_catalog.now()
      WHERE target_order.id = v_order.id
        AND target_order.payment_status IN ('pending', 'paid')
        AND target_order.order_status NOT IN ('cancelled', 'completed');

      IF v_payment.payment_status = 'paid'
        OR v_order.payment_status = 'paid'
      THEN
        v_outcome := 'paid_state_repaired';
      ELSE
        v_outcome := 'success_applied';
      END IF;
    END IF;
  ELSIF v_status = 'EXPIRED' THEN
    IF v_order.payment_status = 'paid'
      OR v_payment.payment_status = 'paid'
    THEN
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

ALTER FUNCTION public.doku_record_notification(
  text,text,text,numeric,text,text,text,timestamptz
) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.doku_record_notification(
  text,text,text,numeric,text,text,text,timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.doku_record_notification(
  text,text,text,numeric,text,text,text,timestamptz
) TO service_role;

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
    RAISE EXCEPTION USING ERRCODE = 'P0002',
      MESSAGE = 'doku_payment_not_found';
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
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'doku_payment_reference_mismatch';
  END IF;

  IF v_order.payment_status = 'paid'
    OR v_payment.payment_status = 'paid'
  THEN
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
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'doku_payment_not_expired';
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

ALTER FUNCTION public.doku_expire_payment(
  uuid,text,numeric,text
) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.doku_expire_payment(
  uuid,text,numeric,text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.doku_expire_payment(
  uuid,text,numeric,text
) TO service_role;

DO $doku_reconciliation_rpc_preflight$
BEGIN
  IF pg_catalog.to_regprocedure(
    'public.doku_record_reconciliation(uuid,text,text,numeric,text,text)'
  ) IS NULL
    OR pg_catalog.to_regprocedure(
      'public.doku_record_notification(text,text,text,numeric,text,text,text,timestamptz)'
    ) IS NULL
    OR pg_catalog.to_regprocedure(
      'public.doku_record_reconciliation_incident(text,text,text,uuid,uuid,text,numeric,text,text,text,text,text,text,text,text,text,text)'
    ) IS NULL
    OR pg_catalog.to_regprocedure(
      'public.doku_expire_payment(uuid,text,numeric,text)'
    ) IS NULL
    OR pg_catalog.to_regprocedure(
      'public.doku_list_reconciliation_candidates(integer)'
    ) IS NULL
  THEN
    RAISE EXCEPTION 'doku_reconciliation_preflight_missing_rpc_signatures';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    WHERE relation.oid = 'public.doku_reconciliation_incidents'::regclass
      AND relation.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'doku_reconciliation_preflight_incidents_rls_missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure_row
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(
        procedure_row.proacl,
        pg_catalog.acldefault('f', procedure_row.proowner)
      )
    ) AS acl
    WHERE procedure_row.oid = pg_catalog.to_regprocedure(
      'public.doku_record_reconciliation_incident(text,text,text,uuid,uuid,text,numeric,text,text,text,text,text,text,text,text,text,text)'
    )
      AND acl.privilege_type = 'EXECUTE'
      AND (
        acl.grantee = 0
        OR acl.grantee IN (
          pg_catalog.to_regrole('anon'),
          pg_catalog.to_regrole('authenticated')
        )
      )
  )
  THEN
    RAISE EXCEPTION 'doku_reconciliation_incident_rpc_privilege';
  END IF;

  IF NOT pg_catalog.has_function_privilege(
    'service_role',
    pg_catalog.to_regprocedure(
      'public.doku_record_reconciliation_incident(text,text,text,uuid,uuid,text,numeric,text,text,text,text,text,text,text,text,text,text)'
    ),
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'doku_reconciliation_incident_rpc_service_role_missing';
  END IF;
END;
$doku_reconciliation_rpc_preflight$;

COMMIT;
