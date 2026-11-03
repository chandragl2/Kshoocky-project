BEGIN;

LOCK TABLE
  public.products,
  public.product_option_groups,
  public.product_variants,
  public.product_variant_option_values
IN ACCESS EXCLUSIVE MODE;

DO $validate_existing_variant_data$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.products AS product
    WHERE product.is_catalog IS TRUE
      AND (
        SELECT count(*)
        FROM public.product_variants AS variant
        WHERE variant.product_id = product.id
          AND variant.sku = 'LEGACY-' || pg_catalog.replace(product.id::text, '-', '')
      ) <> 1
  ) THEN
    RAISE EXCEPTION
      'product_variant_integrity_missing_default: each catalog product must have exactly one legacy default variant';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.products AS product
    JOIN public.product_variants AS default_variant
      ON default_variant.product_id = product.id
     AND default_variant.sku = 'LEGACY-' || pg_catalog.replace(product.id::text, '-', '')
    WHERE product.is_catalog IS TRUE
      AND (
        (
          EXISTS (
            SELECT 1
            FROM public.product_option_groups AS option_group
            WHERE option_group.product_id = product.id
          )
          AND default_variant.status <> 'inactive'
        )
        OR (
          NOT EXISTS (
            SELECT 1
            FROM public.product_option_groups AS option_group
            WHERE option_group.product_id = product.id
          )
          AND default_variant.status <> product.status
        )
      )
  ) THEN
    RAISE EXCEPTION
      'product_variant_integrity_invalid_default: legacy default status does not match the product configuration';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.product_variants AS variant
    JOIN public.product_option_groups AS option_group
      ON option_group.product_id = variant.product_id
     AND option_group.is_required IS TRUE
    WHERE variant.sku <> 'LEGACY-' || pg_catalog.replace(variant.product_id::text, '-', '')
      AND NOT EXISTS (
        SELECT 1
        FROM public.product_variant_option_values AS mapping
        WHERE mapping.variant_id = variant.id
          AND mapping.option_group_id = option_group.id
      )
  ) THEN
    RAISE EXCEPTION
      'product_variant_integrity_missing_required_option: resolve incomplete variants before applying this migration';
  END IF;

  IF EXISTS (
    WITH signatures AS (
      SELECT
        variant.product_id,
        COALESCE(
          pg_catalog.array_agg(mapping.option_value_id ORDER BY mapping.option_value_id)
            FILTER (WHERE mapping.option_value_id IS NOT NULL),
          ARRAY[]::uuid[]
        ) AS option_signature
      FROM public.product_variants AS variant
      LEFT JOIN public.product_variant_option_values AS mapping
        ON mapping.variant_id = variant.id
      WHERE NOT (
        variant.sku = 'LEGACY-' || pg_catalog.replace(variant.product_id::text, '-', '')
        AND EXISTS (
          SELECT 1
          FROM public.product_option_groups AS option_group
          WHERE option_group.product_id = variant.product_id
        )
      )
      GROUP BY variant.id, variant.product_id
    )
    SELECT 1
    FROM signatures
    GROUP BY product_id, option_signature
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'product_variant_integrity_duplicate_combination: resolve duplicate variant combinations before applying this migration';
  END IF;
END;
$validate_existing_variant_data$;

ALTER TABLE public.product_variants
  ADD COLUMN option_signature uuid[];

UPDATE public.product_variants AS variant
SET option_signature = CASE
  WHEN variant.sku = 'LEGACY-' || pg_catalog.replace(variant.product_id::text, '-', '')
    AND EXISTS (
      SELECT 1
      FROM public.product_option_groups AS option_group
      WHERE option_group.product_id = variant.product_id
    )
  THEN NULL
  ELSE COALESCE(
    (
      SELECT pg_catalog.array_agg(mapping.option_value_id ORDER BY mapping.option_value_id)
      FROM public.product_variant_option_values AS mapping
      WHERE mapping.variant_id = variant.id
    ),
    ARRAY[]::uuid[]
  )
END;

ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_product_option_signature_key
  UNIQUE (product_id, option_signature)
  DEFERRABLE INITIALLY DEFERRED;

CREATE OR REPLACE FUNCTION public.refresh_product_variant_option_signature(
  p_variant_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $refresh_product_variant_option_signature$
DECLARE
  v_product_id uuid;
  v_sku text;
  v_signature uuid[];
BEGIN
  SELECT variant.product_id, variant.sku
  INTO v_product_id, v_sku
  FROM public.product_variants AS variant
  WHERE variant.id = p_variant_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_sku = 'LEGACY-' || pg_catalog.replace(v_product_id::text, '-', '')
    AND EXISTS (
      SELECT 1
      FROM public.product_option_groups AS option_group
      WHERE option_group.product_id = v_product_id
    )
  THEN
    v_signature := NULL;
  ELSE
    SELECT COALESCE(
      pg_catalog.array_agg(mapping.option_value_id ORDER BY mapping.option_value_id),
      ARRAY[]::uuid[]
    )
    INTO v_signature
    FROM public.product_variant_option_values AS mapping
    WHERE mapping.variant_id = p_variant_id;
  END IF;

  UPDATE public.product_variants AS variant
  SET option_signature = v_signature
  WHERE variant.id = p_variant_id
    AND variant.option_signature IS DISTINCT FROM v_signature;
END;
$refresh_product_variant_option_signature$;

CREATE OR REPLACE FUNCTION public.sync_variant_signature_from_mapping()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $sync_variant_signature_from_mapping$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM public.refresh_product_variant_option_signature(OLD.variant_id);
  END IF;

  IF TG_OP <> 'DELETE'
    AND (TG_OP = 'INSERT' OR NEW.variant_id IS DISTINCT FROM OLD.variant_id)
  THEN
    PERFORM public.refresh_product_variant_option_signature(NEW.variant_id);
  END IF;

  RETURN NULL;
END;
$sync_variant_signature_from_mapping$;

CREATE CONSTRAINT TRIGGER product_variant_option_values_a_refresh_signature
AFTER INSERT OR UPDATE OR DELETE ON public.product_variant_option_values
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.sync_variant_signature_from_mapping();

CREATE OR REPLACE FUNCTION public.sync_variant_signature_from_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $sync_variant_signature_from_group$
DECLARE
  v_product_id uuid;
  v_variant_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_product_id := OLD.product_id;
  END IF;

  IF TG_OP <> 'DELETE'
    AND (TG_OP = 'INSERT' OR NEW.product_id IS DISTINCT FROM OLD.product_id)
  THEN
    FOR v_variant_id IN
      SELECT variant.id
      FROM public.product_variants AS variant
      WHERE variant.product_id = NEW.product_id
      ORDER BY variant.id
    LOOP
      PERFORM public.refresh_product_variant_option_signature(v_variant_id);
    END LOOP;
  END IF;

  IF v_product_id IS NOT NULL THEN
    FOR v_variant_id IN
      SELECT variant.id
      FROM public.product_variants AS variant
      WHERE variant.product_id = v_product_id
      ORDER BY variant.id
    LOOP
      PERFORM public.refresh_product_variant_option_signature(v_variant_id);
    END LOOP;
  END IF;

  RETURN NULL;
END;
$sync_variant_signature_from_group$;

CREATE TRIGGER product_option_groups_sync_variant_signatures
AFTER INSERT OR UPDATE OR DELETE ON public.product_option_groups
FOR EACH ROW
EXECUTE FUNCTION public.sync_variant_signature_from_group();

CREATE OR REPLACE FUNCTION public.sync_variant_signature_from_variant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $sync_variant_signature_from_variant$
BEGIN
  PERFORM public.refresh_product_variant_option_signature(NEW.id);
  RETURN NULL;
END;
$sync_variant_signature_from_variant$;

CREATE TRIGGER product_variants_sync_option_signature
AFTER INSERT OR UPDATE OF product_id, sku ON public.product_variants
FOR EACH ROW
EXECUTE FUNCTION public.sync_variant_signature_from_variant();

CREATE OR REPLACE FUNCTION public.assert_product_variant_integrity(
  p_product_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $assert_product_variant_integrity$
DECLARE
  v_product public.products%ROWTYPE;
  v_default_count bigint;
  v_default_status text;
  v_has_option_groups boolean;
BEGIN
  SELECT product.*
  INTO v_product
  FROM public.products AS product
  WHERE product.id = p_product_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT count(*), min(variant.status)
  INTO v_default_count, v_default_status
  FROM public.product_variants AS variant
  WHERE variant.product_id = p_product_id
    AND variant.sku = 'LEGACY-' || pg_catalog.replace(p_product_id::text, '-', '');

  v_has_option_groups := EXISTS (
    SELECT 1
    FROM public.product_option_groups AS option_group
    WHERE option_group.product_id = p_product_id
  );

  IF v_product.is_catalog IS TRUE AND v_default_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'product_variant_integrity_missing_default';
  END IF;

  IF v_product.is_catalog IS TRUE
    AND (
      (v_has_option_groups AND v_default_status <> 'inactive')
      OR (NOT v_has_option_groups AND v_default_status <> v_product.status)
    )
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'product_variant_integrity_invalid_default';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.product_variants AS variant
    WHERE variant.product_id = p_product_id
      AND variant.option_signature IS DISTINCT FROM CASE
        WHEN v_has_option_groups
          AND variant.sku = 'LEGACY-' || pg_catalog.replace(p_product_id::text, '-', '')
        THEN NULL::uuid[]
        ELSE COALESCE(
          (
            SELECT pg_catalog.array_agg(
              mapping.option_value_id ORDER BY mapping.option_value_id
            )
            FROM public.product_variant_option_values AS mapping
            WHERE mapping.variant_id = variant.id
          ),
          ARRAY[]::uuid[]
        )
      END
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'product_variant_integrity_signature_mismatch';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.product_variants AS variant
    JOIN public.product_option_groups AS option_group
      ON option_group.product_id = variant.product_id
     AND option_group.is_required IS TRUE
    WHERE variant.product_id = p_product_id
      AND NOT (
        v_has_option_groups
        AND variant.sku = 'LEGACY-' || pg_catalog.replace(p_product_id::text, '-', '')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.product_variant_option_values AS mapping
        WHERE mapping.variant_id = variant.id
          AND mapping.option_group_id = option_group.id
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'admin_variant_required_option_missing';
  END IF;
END;
$assert_product_variant_integrity$;

CREATE OR REPLACE FUNCTION public.check_product_variant_integrity_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $check_product_variant_integrity_trigger$
DECLARE
  v_old_product_id uuid;
  v_new_product_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    IF TG_TABLE_NAME = 'products' THEN
      v_old_product_id := OLD.id;
    ELSIF TG_TABLE_NAME = 'product_variants'
      OR TG_TABLE_NAME = 'product_option_groups'
      OR TG_TABLE_NAME = 'product_variant_option_values'
    THEN
      v_old_product_id := OLD.product_id;
    END IF;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    IF TG_TABLE_NAME = 'products' THEN
      v_new_product_id := NEW.id;
    ELSIF TG_TABLE_NAME = 'product_variants'
      OR TG_TABLE_NAME = 'product_option_groups'
      OR TG_TABLE_NAME = 'product_variant_option_values'
    THEN
      v_new_product_id := NEW.product_id;
    END IF;
  END IF;

  IF v_old_product_id IS NOT NULL THEN
    PERFORM public.assert_product_variant_integrity(v_old_product_id);
  END IF;

  IF v_new_product_id IS NOT NULL
    AND v_new_product_id IS DISTINCT FROM v_old_product_id
  THEN
    PERFORM public.assert_product_variant_integrity(v_new_product_id);
  END IF;

  RETURN NULL;
END;
$check_product_variant_integrity_trigger$;

CREATE CONSTRAINT TRIGGER products_variant_integrity
AFTER INSERT OR UPDATE OR DELETE ON public.products
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.check_product_variant_integrity_trigger();

CREATE CONSTRAINT TRIGGER product_variants_variant_integrity
AFTER INSERT OR UPDATE OR DELETE ON public.product_variants
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.check_product_variant_integrity_trigger();

CREATE CONSTRAINT TRIGGER product_option_groups_variant_integrity
AFTER INSERT OR UPDATE OR DELETE ON public.product_option_groups
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.check_product_variant_integrity_trigger();

CREATE CONSTRAINT TRIGGER product_variant_option_values_variant_integrity
AFTER INSERT OR UPDATE OR DELETE ON public.product_variant_option_values
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.check_product_variant_integrity_trigger();

CREATE OR REPLACE FUNCTION public.sync_product_variant_summary(
  p_product_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $sync_product_variant_summary$
BEGIN
  UPDATE public.products AS product
  SET
    price = COALESCE((
      SELECT pg_catalog.min(variant.price)
      FROM public.product_variants AS variant
      WHERE variant.product_id = product.id
        AND variant.status = 'active'
    ), product.price),
    stock = COALESCE((
      SELECT pg_catalog.sum(variant.stock)::integer
      FROM public.product_variants AS variant
      WHERE variant.product_id = product.id
        AND variant.status = 'active'
    ), 0),
    updated_at = pg_catalog.now()
  WHERE product.id = p_product_id;
END;
$sync_product_variant_summary$;

CREATE OR REPLACE FUNCTION public.sync_product_variant_summary_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $sync_product_variant_summary_trigger$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM public.sync_product_variant_summary(OLD.product_id);
  END IF;

  IF TG_OP <> 'DELETE'
    AND (TG_OP = 'INSERT' OR NEW.product_id IS DISTINCT FROM OLD.product_id)
  THEN
    PERFORM public.sync_product_variant_summary(NEW.product_id);
  END IF;

  RETURN NULL;
END;
$sync_product_variant_summary_trigger$;

CREATE CONSTRAINT TRIGGER product_variants_sync_product_summary
AFTER INSERT OR UPDATE OR DELETE ON public.product_variants
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_variant_summary_trigger();

ALTER FUNCTION public.refresh_product_variant_option_signature(uuid) OWNER TO postgres;
ALTER FUNCTION public.sync_variant_signature_from_mapping() OWNER TO postgres;
ALTER FUNCTION public.sync_variant_signature_from_group() OWNER TO postgres;
ALTER FUNCTION public.sync_variant_signature_from_variant() OWNER TO postgres;
ALTER FUNCTION public.assert_product_variant_integrity(uuid) OWNER TO postgres;
ALTER FUNCTION public.check_product_variant_integrity_trigger() OWNER TO postgres;
ALTER FUNCTION public.sync_product_variant_summary(uuid) OWNER TO postgres;
ALTER FUNCTION public.sync_product_variant_summary_trigger() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.refresh_product_variant_option_signature(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.sync_variant_signature_from_mapping()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.sync_variant_signature_from_group()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.sync_variant_signature_from_variant()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.assert_product_variant_integrity(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.check_product_variant_integrity_trigger()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.sync_product_variant_summary(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.sync_product_variant_summary_trigger()
  FROM PUBLIC, anon, authenticated, service_role;

-- Leave checkout_catalog's original implementation and authenticated grant in
-- place until variant checkout has passed isolated testing.
REVOKE INSERT, UPDATE, DELETE
  ON TABLE
    public.product_option_groups,
    public.product_option_values,
    public.product_variants,
    public.product_variant_option_values,
    public.inventory_movements
  FROM PUBLIC, anon, authenticated;

COMMIT;
