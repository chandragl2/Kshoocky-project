BEGIN;

CREATE TABLE IF NOT EXISTS public.doku_reconciliation_incident_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL
    REFERENCES public.doku_reconciliation_incidents(id),
  source text NOT NULL
    CONSTRAINT doku_reconciliation_incident_observations_source_check
    CHECK (source IN ('reconciliation', 'notification')),
  event_id text,
  body_digest text,
  is_first_event boolean NOT NULL DEFAULT false,
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
    CONSTRAINT doku_reconciliation_incident_observations_reason_check
    CHECK (reason_code ~ '^[a-z0-9_]{1,64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT doku_reconciliation_incident_observations_metadata_check
    CHECK (
      (
        source = 'notification'
        AND event_id IS NOT NULL
        AND pg_catalog.length(event_id) BETWEEN 1 AND 128
        AND body_digest IS NOT NULL
        AND pg_catalog.length(body_digest) = 44
        AND body_digest ~ '^[A-Za-z0-9+/]{43}=$'
        AND pg_catalog.encode(
          pg_catalog.decode(body_digest, 'base64'),
          'base64'
        ) = body_digest
      )
      OR (
        source = 'reconciliation'
        AND event_id IS NULL
        AND body_digest IS NULL
        AND NOT is_first_event
      )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS
  doku_reconciliation_incident_observations_notification_event_key
  ON public.doku_reconciliation_incident_observations (
    source, event_id, body_digest
  )
  WHERE source = 'notification';

CREATE UNIQUE INDEX IF NOT EXISTS
  doku_reconciliation_incident_observations_first_event_key
  ON public.doku_reconciliation_incident_observations (source, event_id)
  WHERE source = 'notification' AND is_first_event;

ALTER TABLE public.doku_reconciliation_incident_observations
  OWNER TO postgres;
ALTER TABLE public.doku_reconciliation_incident_observations
  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.doku_reconciliation_incident_observations
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.doku_validate_reconciliation_incident_observations_schema()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $doku_validate_reconciliation_incident_observations_schema$
DECLARE
  v_missing text;
  v_invalid text;
BEGIN
  IF pg_catalog.to_regclass(
    'public.doku_reconciliation_incident_observations'
  ) IS NULL THEN
    RAISE EXCEPTION 'doku_reconciliation_observation_missing_table';
  END IF;

  SELECT pg_catalog.string_agg(
    required.column_name, ', ' ORDER BY required.column_name
  )
  INTO v_missing
  FROM (
    VALUES
      ('id', 'uuid'),
      ('incident_id', 'uuid'),
      ('source', 'text'),
      ('event_id', 'text'),
      ('body_digest', 'text'),
      ('is_first_event', 'boolean'),
      ('payment_id', 'uuid'),
      ('order_id', 'uuid'),
      ('invoice_number', 'text'),
      ('amount', 'numeric'),
      ('original_request_id', 'text'),
      ('gateway_transaction_id', 'text'),
      ('existing_gateway_transaction_id', 'text'),
      ('gateway_status', 'text'),
      ('gateway_transaction_status', 'text'),
      ('local_payment_status', 'text'),
      ('local_order_payment_status', 'text'),
      ('local_order_status', 'text'),
      ('payment_session_state', 'text'),
      ('reason_code', 'text'),
      ('created_at', 'timestamp with time zone')
  ) AS required(column_name, expected_type)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid =
      'public.doku_reconciliation_incident_observations'::regclass
      AND attribute.attname = required.column_name
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'doku_reconciliation_observation_missing_column: %', v_missing;
  END IF;

  SELECT pg_catalog.string_agg(
    required.column_name, ', ' ORDER BY required.column_name
  )
  INTO v_invalid
  FROM (
    VALUES
      ('id', 'uuid'),
      ('incident_id', 'uuid'),
      ('source', 'text'),
      ('event_id', 'text'),
      ('body_digest', 'text'),
      ('is_first_event', 'boolean'),
      ('payment_id', 'uuid'),
      ('order_id', 'uuid'),
      ('invoice_number', 'text'),
      ('amount', 'numeric'),
      ('original_request_id', 'text'),
      ('gateway_transaction_id', 'text'),
      ('existing_gateway_transaction_id', 'text'),
      ('gateway_status', 'text'),
      ('gateway_transaction_status', 'text'),
      ('local_payment_status', 'text'),
      ('local_order_payment_status', 'text'),
      ('local_order_status', 'text'),
      ('payment_session_state', 'text'),
      ('reason_code', 'text'),
      ('created_at', 'timestamp with time zone')
  ) AS required(column_name, expected_type)
  WHERE EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid =
      'public.doku_reconciliation_incident_observations'::regclass
      AND attribute.attname = required.column_name
      AND pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)
        IS DISTINCT FROM required.expected_type
  );
  IF v_invalid IS NOT NULL THEN
    RAISE EXCEPTION 'doku_reconciliation_observation_invalid_type: %', v_invalid;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      VALUES
        ('id', false),
        ('incident_id', false),
        ('source', false),
        ('event_id', true),
        ('body_digest', true),
        ('is_first_event', false),
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
      ON attribute.attrelid =
        'public.doku_reconciliation_incident_observations'::regclass
     AND attribute.attname = required.column_name
    WHERE attribute.attnotnull IS DISTINCT FROM NOT required.nullable
  ) THEN
    RAISE EXCEPTION 'doku_reconciliation_observation_invalid_nullability';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attrdef AS default_row
    JOIN pg_catalog.pg_attribute AS attribute
      ON attribute.attrelid = default_row.adrelid
     AND attribute.attnum = default_row.adnum
    WHERE default_row.adrelid =
      'public.doku_reconciliation_incident_observations'::regclass
      AND attribute.attname = 'id'
      AND pg_catalog.pg_get_expr(default_row.adbin, default_row.adrelid)
        LIKE '%gen_random_uuid%'
  )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attrdef AS default_row
      JOIN pg_catalog.pg_attribute AS attribute
        ON attribute.attrelid = default_row.adrelid
       AND attribute.attnum = default_row.adnum
      WHERE default_row.adrelid =
        'public.doku_reconciliation_incident_observations'::regclass
        AND attribute.attname = 'created_at'
        AND pg_catalog.pg_get_expr(default_row.adbin, default_row.adrelid)
          IN ('now()', 'CURRENT_TIMESTAMP')
    )
  THEN
    RAISE EXCEPTION 'doku_reconciliation_observation_invalid_default';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_row
    WHERE constraint_row.conrelid =
      'public.doku_reconciliation_incident_observations'::regclass
      AND constraint_row.conname =
        'doku_reconciliation_incident_observations_source_check'
  )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_constraint AS constraint_row
      WHERE constraint_row.conrelid =
        'public.doku_reconciliation_incident_observations'::regclass
        AND constraint_row.conname =
          'doku_reconciliation_incident_observations_reason_check'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_constraint AS constraint_row
      WHERE constraint_row.conrelid =
        'public.doku_reconciliation_incident_observations'::regclass
        AND constraint_row.conname =
          'doku_reconciliation_incident_observations_metadata_check'
    )
  THEN
    RAISE EXCEPTION 'doku_reconciliation_observation_missing_check';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_row
    WHERE constraint_row.conrelid =
      'public.doku_reconciliation_incident_observations'::regclass
      AND constraint_row.conname =
        'doku_reconciliation_incident_observations_pkey'
      AND constraint_row.contype = 'p'
  )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_constraint AS constraint_row
      WHERE constraint_row.conrelid =
        'public.doku_reconciliation_incident_observations'::regclass
        AND constraint_row.contype = 'f'
        AND constraint_row.conkey = ARRAY[
          (
            SELECT attribute.attnum
            FROM pg_catalog.pg_attribute AS attribute
            WHERE attribute.attrelid =
              'public.doku_reconciliation_incident_observations'::regclass
              AND attribute.attname = 'incident_id'
          )
        ]::smallint[]
        AND constraint_row.confrelid =
          'public.doku_reconciliation_incidents'::regclass
        AND constraint_row.confdeltype = 'a'
  )
  THEN
    RAISE EXCEPTION 'doku_reconciliation_observation_invalid_key';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index AS index_row
    JOIN pg_catalog.pg_class AS index_class
      ON index_class.oid = index_row.indexrelid
    WHERE index_row.indrelid =
      'public.doku_reconciliation_incident_observations'::regclass
      AND index_class.relname =
        'doku_reconciliation_incident_observations_notification_event_key'
      AND index_row.indisunique
      AND index_row.indisvalid
      AND index_row.indnkeyatts = 3
      AND ARRAY(
        SELECT attribute.attname
        FROM pg_catalog.unnest(index_row.indkey)
          WITH ORDINALITY AS key(attnum, ordinal_position)
        JOIN pg_catalog.pg_attribute AS attribute
          ON attribute.attrelid = index_row.indrelid
         AND attribute.attnum = key.attnum
        WHERE key.ordinal_position <= index_row.indnkeyatts
        ORDER BY key.ordinal_position
      ) = ARRAY['source', 'event_id', 'body_digest']::name[]
      AND pg_catalog.replace(
        pg_catalog.replace(
          pg_catalog.pg_get_expr(index_row.indpred, index_row.indrelid),
          '(',
          ''
        ),
        ')',
        ''
      ) = 'source = ''notification''::text'
  )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_index AS index_row
      JOIN pg_catalog.pg_class AS index_class
        ON index_class.oid = index_row.indexrelid
      WHERE index_row.indrelid =
        'public.doku_reconciliation_incident_observations'::regclass
        AND index_class.relname =
          'doku_reconciliation_incident_observations_first_event_key'
        AND index_row.indisunique
        AND index_row.indisvalid
        AND index_row.indnkeyatts = 2
        AND ARRAY(
          SELECT attribute.attname
          FROM pg_catalog.unnest(index_row.indkey)
            WITH ORDINALITY AS key(attnum, ordinal_position)
          JOIN pg_catalog.pg_attribute AS attribute
            ON attribute.attrelid = index_row.indrelid
           AND attribute.attnum = key.attnum
          WHERE key.ordinal_position <= index_row.indnkeyatts
          ORDER BY key.ordinal_position
        ) = ARRAY['source', 'event_id']::name[]
        AND pg_catalog.replace(
          pg_catalog.replace(
            pg_catalog.pg_get_expr(index_row.indpred, index_row.indrelid),
            '(',
            ''
          ),
          ')',
          ''
        ) = 'source = ''notification''::text AND is_first_event'
    )
  THEN
    RAISE EXCEPTION 'doku_reconciliation_observation_missing_unique_index';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    WHERE relation.oid =
      'public.doku_reconciliation_incident_observations'::regclass
      AND relation.relowner = pg_catalog.to_regrole('postgres')
      AND relation.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'doku_reconciliation_observation_rls';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies AS policy
    WHERE policy.schemaname = 'public'
      AND policy.tablename =
        'doku_reconciliation_incident_observations'
  ) THEN
    RAISE EXCEPTION 'doku_reconciliation_observation_policy';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(relation.relacl, pg_catalog.acldefault('r', relation.relowner))
    ) AS acl
    WHERE relation.oid =
      'public.doku_reconciliation_incident_observations'::regclass
      AND acl.grantee IN (
        0,
        pg_catalog.to_regrole('anon'),
        pg_catalog.to_regrole('authenticated'),
        pg_catalog.to_regrole('service_role')
      )
  ) THEN
    RAISE EXCEPTION 'doku_reconciliation_observation_privilege';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure_row
    WHERE procedure_row.oid = pg_catalog.to_regprocedure(
      'public.doku_record_reconciliation_incident(text,text,text,uuid,uuid,text,numeric,text,text,text,text,text,text,text,text,text,text)'
    )
      AND procedure_row.proowner = pg_catalog.to_regrole('postgres')
      AND procedure_row.prosecdef
      AND procedure_row.proconfig @> ARRAY['search_path=""']::text[]
  )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc AS procedure_row
      WHERE procedure_row.oid = pg_catalog.to_regprocedure(
        'public.doku_record_notification(text,text,text,numeric,text,text,text,timestamptz)'
      )
        AND procedure_row.proowner = pg_catalog.to_regrole('postgres')
        AND procedure_row.prosecdef
        AND procedure_row.proconfig @> ARRAY['search_path=""']::text[]
    )
  THEN
    RAISE EXCEPTION 'doku_reconciliation_observation_rpc_security';
  END IF;

  IF NOT pg_catalog.has_function_privilege(
    'service_role',
    pg_catalog.to_regprocedure(
      'public.doku_record_reconciliation_incident(text,text,text,uuid,uuid,text,numeric,text,text,text,text,text,text,text,text,text,text)'
    ),
    'EXECUTE'
  )
    OR NOT pg_catalog.has_function_privilege(
      'service_role',
      pg_catalog.to_regprocedure(
        'public.doku_record_notification(text,text,text,numeric,text,text,text,timestamptz)'
      ),
      'EXECUTE'
    )
    OR pg_catalog.has_function_privilege(
      'anon',
      pg_catalog.to_regprocedure(
        'public.doku_record_reconciliation_incident(text,text,text,uuid,uuid,text,numeric,text,text,text,text,text,text,text,text,text,text)'
      ),
      'EXECUTE'
    )
    OR pg_catalog.has_function_privilege(
      'authenticated',
      pg_catalog.to_regprocedure(
        'public.doku_record_reconciliation_incident(text,text,text,uuid,uuid,text,numeric,text,text,text,text,text,text,text,text,text,text)'
      ),
      'EXECUTE'
    )
    OR pg_catalog.has_function_privilege(
      'anon',
      pg_catalog.to_regprocedure(
        'public.doku_record_notification(text,text,text,numeric,text,text,text,timestamptz)'
      ),
      'EXECUTE'
    )
    OR pg_catalog.has_function_privilege(
      'authenticated',
      pg_catalog.to_regprocedure(
        'public.doku_record_notification(text,text,text,numeric,text,text,text,timestamptz)'
      ),
      'EXECUTE'
    )
  THEN
    RAISE EXCEPTION 'doku_reconciliation_observation_rpc_privilege';
  END IF;
END;
$doku_validate_reconciliation_incident_observations_schema$;

ALTER FUNCTION public.doku_validate_reconciliation_incident_observations_schema()
  OWNER TO postgres;
REVOKE ALL ON FUNCTION
  public.doku_validate_reconciliation_incident_observations_schema()
  FROM PUBLIC, anon, authenticated, service_role;

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
  v_observation_incident_id uuid;
  v_first_observation
    public.doku_reconciliation_incident_observations%ROWTYPE;
  v_is_first_event boolean := false;
  v_parent_reason_code text;
  v_incident_key text;
  v_payment public.payments%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_payment_id uuid;
  v_order_id uuid;
  v_invoice_number text;
  v_amount numeric;
  v_original_request_id text;
  v_existing_gateway_transaction_id text;
  v_local_payment_status text;
  v_local_order_payment_status text;
  v_local_order_status text;
  v_local_payment_session_state text;
BEGIN
  IF p_source IS NULL OR p_source NOT IN ('reconciliation', 'notification')
    OR p_reason_code IS NULL
    OR p_reason_code !~ '^[a-z0-9_]{1,64}$'
    OR (p_invoice_number IS NOT NULL
      AND pg_catalog.length(p_invoice_number) NOT BETWEEN 1 AND 64)
    OR (p_amount IS NOT NULL
      AND (p_amount <= 0 OR p_amount <> pg_catalog.trunc(p_amount)))
    OR (p_original_request_id IS NOT NULL
      AND pg_catalog.length(p_original_request_id) NOT BETWEEN 1 AND 128)
    OR (p_gateway_transaction_id IS NOT NULL
      AND pg_catalog.length(p_gateway_transaction_id) NOT BETWEEN 1 AND 128)
    OR (p_existing_gateway_transaction_id IS NOT NULL
      AND pg_catalog.length(p_existing_gateway_transaction_id) NOT BETWEEN 1 AND 128)
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'doku_reconciliation_incident_invalid';
  END IF;

  IF p_source = 'notification' THEN
    IF p_event_id IS NULL
      OR pg_catalog.length(p_event_id) NOT BETWEEN 1 AND 128
      OR p_body_digest IS NULL
      OR pg_catalog.length(p_body_digest) <> 44
      OR p_body_digest !~ '^[A-Za-z0-9+/]{43}=$'
    THEN
      RAISE EXCEPTION USING ERRCODE = '22023',
        MESSAGE = 'doku_reconciliation_incident_invalid_event_metadata';
    END IF;
    IF pg_catalog.encode(
      pg_catalog.decode(p_body_digest, 'base64'),
      'base64'
    ) IS DISTINCT FROM p_body_digest THEN
      RAISE EXCEPTION USING ERRCODE = '22023',
        MESSAGE = 'doku_reconciliation_incident_invalid_event_metadata';
    END IF;

    SELECT observation.incident_id
    INTO v_observation_incident_id
    FROM public.doku_reconciliation_incident_observations AS observation
    WHERE observation.source = 'notification'
      AND observation.event_id = p_event_id
      AND observation.body_digest = p_body_digest;
    IF FOUND THEN
      RETURN v_observation_incident_id;
    END IF;

    SELECT observation.*
    INTO v_first_observation
    FROM public.doku_reconciliation_incident_observations AS observation
    WHERE observation.source = 'notification'
      AND observation.event_id = p_event_id
      AND observation.is_first_event
    FOR UPDATE;
    v_is_first_event := NOT FOUND;
  ELSIF p_event_id IS NOT NULL OR p_body_digest IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'doku_reconciliation_incident_invalid_event_metadata';
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

  v_payment_id := COALESCE(p_payment_id, v_payment.id);
  v_order_id := COALESCE(p_order_id, v_order.id);
  v_invoice_number := COALESCE(p_invoice_number, v_payment.gateway_invoice_number);
  v_amount := COALESCE(p_amount, v_payment.amount);
  v_original_request_id := COALESCE(
    p_original_request_id, v_payment.gateway_request_id
  );
  v_existing_gateway_transaction_id := COALESCE(
    p_existing_gateway_transaction_id, v_payment.gateway_transaction_id
  );
  v_local_payment_status := COALESCE(
    p_local_payment_status, v_payment.payment_status
  );
  v_local_order_payment_status := COALESCE(
    p_local_order_payment_status, v_order.payment_status
  );
  v_local_order_status := COALESCE(p_local_order_status, v_order.order_status);
  v_local_payment_session_state := COALESCE(
    p_local_payment_session_state, v_payment.payment_session_state
  );
  v_parent_reason_code := p_reason_code;

  IF p_source = 'notification'
    AND NOT v_is_first_event
    AND p_reason_code = 'notification_replay_conflict'
    AND ROW(
      v_first_observation.payment_id,
      v_first_observation.order_id,
      v_first_observation.invoice_number,
      v_first_observation.amount,
      v_first_observation.original_request_id,
      v_first_observation.gateway_transaction_id,
      v_first_observation.existing_gateway_transaction_id,
      v_first_observation.gateway_status,
      v_first_observation.gateway_transaction_status,
      v_first_observation.local_payment_status,
      v_first_observation.local_order_payment_status,
      v_first_observation.local_order_status,
      v_first_observation.payment_session_state
    ) IS NOT DISTINCT FROM ROW(
      v_payment_id,
      v_order_id,
      v_invoice_number,
      v_amount,
      v_original_request_id,
      p_gateway_transaction_id,
      v_existing_gateway_transaction_id,
      p_gateway_status,
      p_gateway_transaction_status,
      v_local_payment_status,
      v_local_order_payment_status,
      v_local_order_status,
      v_local_payment_session_state
    )
  THEN
    v_incident_id := v_first_observation.incident_id;
    v_parent_reason_code := v_first_observation.reason_code;
  END IF;

  v_incident_key := pg_catalog.jsonb_build_array(
    v_payment_id,
    v_order_id,
    v_invoice_number,
    v_amount,
    v_original_request_id,
    p_gateway_transaction_id,
    v_existing_gateway_transaction_id,
    p_gateway_status,
    p_gateway_transaction_status,
    v_local_payment_status,
    v_local_order_payment_status,
    v_local_order_status,
    v_local_payment_session_state,
    v_parent_reason_code
  )::text;

  IF v_incident_id IS NULL THEN
    SELECT incident.id
    INTO v_incident_id
    FROM public.doku_reconciliation_incidents AS incident
    WHERE incident.gateway = 'doku'
      AND incident.payment_id IS NOT DISTINCT FROM v_payment_id
      AND incident.order_id IS NOT DISTINCT FROM v_order_id
      AND incident.invoice_number IS NOT DISTINCT FROM v_invoice_number
      AND incident.amount IS NOT DISTINCT FROM v_amount
      AND incident.original_request_id IS NOT DISTINCT FROM v_original_request_id
      AND incident.gateway_transaction_id IS NOT DISTINCT FROM p_gateway_transaction_id
      AND incident.existing_gateway_transaction_id
        IS NOT DISTINCT FROM v_existing_gateway_transaction_id
      AND incident.gateway_status IS NOT DISTINCT FROM p_gateway_status
      AND incident.gateway_transaction_status
        IS NOT DISTINCT FROM p_gateway_transaction_status
      AND incident.local_payment_status IS NOT DISTINCT FROM v_local_payment_status
      AND incident.local_order_payment_status
        IS NOT DISTINCT FROM v_local_order_payment_status
      AND incident.local_order_status IS NOT DISTINCT FROM v_local_order_status
      AND incident.payment_session_state
        IS NOT DISTINCT FROM v_local_payment_session_state
      AND incident.reason_code = v_parent_reason_code
    ORDER BY incident.created_at
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_incident_id IS NULL THEN
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
      v_payment_id, v_order_id, v_invoice_number, v_amount,
      v_original_request_id, p_gateway_transaction_id,
      v_existing_gateway_transaction_id, p_gateway_status,
      p_gateway_transaction_status, v_local_payment_status,
      v_local_order_payment_status, v_local_order_status,
      v_local_payment_session_state, v_parent_reason_code
    )
    ON CONFLICT (gateway, incident_key) DO NOTHING
    RETURNING id INTO v_incident_id;

    IF v_incident_id IS NULL THEN
      SELECT incident.id
      INTO v_incident_id
      FROM public.doku_reconciliation_incidents AS incident
      WHERE incident.gateway = 'doku'
        AND incident.incident_key = v_incident_key;
    END IF;
  END IF;

  IF v_incident_id IS NULL THEN
    RAISE EXCEPTION 'doku_reconciliation_incident_persist_failed';
  END IF;

  IF p_source = 'notification' THEN
    IF v_is_first_event THEN
      INSERT INTO public.doku_reconciliation_incident_observations (
        incident_id, source, event_id, body_digest, is_first_event,
        payment_id, order_id, invoice_number, amount, original_request_id,
        gateway_transaction_id, existing_gateway_transaction_id,
        gateway_status, gateway_transaction_status, local_payment_status,
        local_order_payment_status, local_order_status, payment_session_state,
        reason_code
      )
      VALUES (
        v_incident_id, 'notification', p_event_id, p_body_digest, true,
        v_payment_id, v_order_id, v_invoice_number, v_amount,
        v_original_request_id, p_gateway_transaction_id,
        v_existing_gateway_transaction_id, p_gateway_status,
        p_gateway_transaction_status, v_local_payment_status,
        v_local_order_payment_status, v_local_order_status,
        v_local_payment_session_state, p_reason_code
      )
      ON CONFLICT (source, event_id)
        WHERE source = 'notification' AND is_first_event
      DO NOTHING;
      IF FOUND THEN
        RETURN v_incident_id;
      END IF;

      SELECT observation.*
      INTO v_first_observation
      FROM public.doku_reconciliation_incident_observations AS observation
      WHERE observation.source = 'notification'
        AND observation.event_id = p_event_id
        AND observation.is_first_event
      FOR UPDATE;
      IF FOUND AND v_first_observation.body_digest = p_body_digest THEN
        RETURN v_first_observation.incident_id;
      END IF;

      v_is_first_event := false;
    END IF;

    INSERT INTO public.doku_reconciliation_incident_observations (
      incident_id, source, event_id, body_digest, is_first_event,
      payment_id, order_id, invoice_number, amount, original_request_id,
      gateway_transaction_id, existing_gateway_transaction_id,
      gateway_status, gateway_transaction_status, local_payment_status,
      local_order_payment_status, local_order_status, payment_session_state,
      reason_code
    )
    VALUES (
      v_incident_id, 'notification', p_event_id, p_body_digest, false,
      v_payment_id, v_order_id, v_invoice_number, v_amount,
      v_original_request_id, p_gateway_transaction_id,
      v_existing_gateway_transaction_id, p_gateway_status,
      p_gateway_transaction_status, v_local_payment_status,
      v_local_order_payment_status, v_local_order_status,
      v_local_payment_session_state, p_reason_code
    )
    ON CONFLICT (source, event_id, body_digest)
      WHERE source = 'notification'
    DO NOTHING
    RETURNING incident_id INTO v_observation_incident_id;

    IF v_observation_incident_id IS NOT NULL THEN
      RETURN v_observation_incident_id;
    END IF;

    SELECT observation.incident_id
    INTO v_observation_incident_id
    FROM public.doku_reconciliation_incident_observations AS observation
    WHERE observation.source = 'notification'
      AND observation.event_id = p_event_id
      AND observation.body_digest = p_body_digest;
    IF v_observation_incident_id IS NULL THEN
      RAISE EXCEPTION 'doku_reconciliation_observation_persist_failed';
    END IF;
    RETURN v_observation_incident_id;
  END IF;

  INSERT INTO public.doku_reconciliation_incident_observations (
    incident_id, source, event_id, body_digest, is_first_event,
    payment_id, order_id, invoice_number, amount, original_request_id,
    gateway_transaction_id, existing_gateway_transaction_id,
    gateway_status, gateway_transaction_status, local_payment_status,
    local_order_payment_status, local_order_status, payment_session_state,
    reason_code
  )
  VALUES (
    v_incident_id, 'reconciliation', NULL, NULL, false,
    v_payment_id, v_order_id, v_invoice_number, v_amount,
    v_original_request_id, p_gateway_transaction_id,
    v_existing_gateway_transaction_id, p_gateway_status,
    p_gateway_transaction_status, v_local_payment_status,
    v_local_order_payment_status, v_local_order_status,
    v_local_payment_session_state, p_reason_code
  );

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
    OR p_body_digest !~ '^[A-Za-z0-9+/]{43}=$'
    OR p_invoice_number IS NULL
    OR p_amount IS NULL
    OR p_amount <= 0
    OR p_amount <> pg_catalog.trunc(p_amount)
    OR v_status = ''
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'doku_notification_invalid';
  END IF;
  IF pg_catalog.encode(
    pg_catalog.decode(p_body_digest, 'base64'),
    'base64'
  ) IS DISTINCT FROM p_body_digest THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'doku_notification_invalid';
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

  SELECT observation.body_digest
  INTO v_existing_digest
  FROM public.doku_reconciliation_incident_observations AS observation
  WHERE observation.source = 'notification'
    AND observation.event_id = p_event_id
    AND observation.is_first_event
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing_digest IS DISTINCT FROM p_body_digest THEN
      RAISE EXCEPTION USING ERRCODE = '22023',
        MESSAGE = 'doku_notification_replay_conflict';
    END IF;
    RETURN 'duplicate';
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

  SELECT observation.body_digest
  INTO v_existing_digest
  FROM public.doku_reconciliation_incident_observations AS observation
  WHERE observation.source = 'notification'
    AND observation.event_id = p_event_id
    AND observation.is_first_event
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing_digest IS DISTINCT FROM p_body_digest THEN
      RAISE EXCEPTION USING ERRCODE = '22023',
        MESSAGE = 'doku_notification_replay_conflict';
    END IF;
    RETURN 'duplicate';
  END IF;

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
      PERFORM public.doku_record_reconciliation_incident(
        'notification',
        p_event_id,
        p_body_digest,
        v_payment.id,
        v_order.id,
        p_invoice_number,
        p_amount,
        p_original_request_id,
        p_gateway_transaction_id,
        v_payment.gateway_transaction_id,
        v_status,
        v_status,
        v_payment.payment_status,
        v_order.payment_status,
        v_order.order_status,
        v_payment.payment_session_state,
        'contradictory_success'
      );
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

DO $doku_validate_incident_observations$
BEGIN
  PERFORM public.doku_validate_reconciliation_incident_schema();
  PERFORM public.doku_validate_reconciliation_incident_observations_schema();
END;
$doku_validate_incident_observations$;

COMMIT;
