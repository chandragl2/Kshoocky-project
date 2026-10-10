BEGIN;

-- KSHOOCKY product-variant foundation.
-- Additive only: legacy product price/stock and checkout behavior remain in place.
-- This file is a proposal on a feature branch; it has NOT been applied to Supabase.

CREATE TABLE public.product_option_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (pg_catalog.btrim(name) <> ''),
  is_required boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_option_groups_product_name_key UNIQUE (product_id, name),
  CONSTRAINT product_option_groups_id_product_key UNIQUE (id, product_id)
);

CREATE TABLE public.product_option_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  option_group_id uuid NOT NULL,
  value text NOT NULL CHECK (pg_catalog.btrim(value) <> ''),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_option_values_group_value_key UNIQUE (option_group_id, value),
  CONSTRAINT product_option_values_id_product_group_key UNIQUE (id, product_id, option_group_id),
  CONSTRAINT product_option_values_group_product_fkey
    FOREIGN KEY (option_group_id, product_id)
    REFERENCES public.product_option_groups(id, product_id)
    ON DELETE CASCADE
);

CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku text NOT NULL UNIQUE CHECK (pg_catalog.btrim(sku) <> ''),
  label text NOT NULL DEFAULT 'Default' CHECK (pg_catalog.btrim(label) <> ''),
  price numeric(12, 2) NOT NULL CHECK (price >= 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'out_of_stock')),
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_variants_id_product_key UNIQUE (id, product_id)
);

CREATE TABLE public.product_variant_option_values (
  variant_id uuid NOT NULL,
  product_id uuid NOT NULL,
  option_group_id uuid NOT NULL,
  option_value_id uuid NOT NULL,
  CONSTRAINT product_variant_option_values_pkey PRIMARY KEY (variant_id, option_group_id),
  CONSTRAINT product_variant_option_values_variant_product_fkey
    FOREIGN KEY (variant_id, product_id)
    REFERENCES public.product_variants(id, product_id)
    ON DELETE CASCADE,
  CONSTRAINT product_variant_option_values_value_product_group_fkey
    FOREIGN KEY (option_value_id, product_id, option_group_id)
    REFERENCES public.product_option_values(id, product_id, option_group_id)
    ON DELETE CASCADE
);

-- variant_id is nullable during the phased client rollout. Legacy callers may omit it
-- until cart RPCs/client code are upgraded.
ALTER TABLE public.cart_items
  ADD COLUMN variant_id uuid;

-- Keep a cart line's variant tied to the same product. This composite reference
-- also prevents deleting a variant that is still present in a cart.
ALTER TABLE public.cart_items
  ADD CONSTRAINT cart_items_variant_product_fkey
  FOREIGN KEY (variant_id, product_id)
  REFERENCES public.product_variants(id, product_id)
  ON DELETE RESTRICT;

-- Existing orders deliberately keep NULL variant snapshots: the historical variant
-- cannot be reconstructed reliably from today's product data. Variant references
-- are restricted from deletion to preserve historical integrity.
ALTER TABLE public.order_items
  ADD COLUMN variant_id uuid,
  ADD COLUMN variant_sku_snapshot text,
  ADD COLUMN variant_label_snapshot text,
  ADD COLUMN variant_options_snapshot jsonb;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_variant_product_fkey
  FOREIGN KEY (variant_id, product_id)
  REFERENCES public.product_variants(id, product_id)
  ON DELETE RESTRICT;

CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES public.orders(id) ON DELETE RESTRICT,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE RESTRICT,
  movement_type text NOT NULL CHECK (
    movement_type IN ('checkout_decrement', 'order_cancel_restore', 'admin_adjustment')
  ),
  quantity_delta integer NOT NULL CHECK (quantity_delta <> 0),
  reason text NOT NULL CHECK (pg_catalog.btrim(reason) <> ''),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_movement_sign_check CHECK (
    (movement_type = 'checkout_decrement' AND quantity_delta < 0)
    OR (movement_type = 'order_cancel_restore' AND quantity_delta > 0)
    OR movement_type = 'admin_adjustment'
  )
);

-- A sale/restore movement may only be recorded once per order item.
CREATE UNIQUE INDEX inventory_movements_checkout_once_idx
  ON public.inventory_movements(order_item_id)
  WHERE movement_type = 'checkout_decrement' AND order_item_id IS NOT NULL;

CREATE UNIQUE INDEX inventory_movements_cancel_restore_once_idx
  ON public.inventory_movements(order_item_id)
  WHERE movement_type = 'order_cancel_restore' AND order_item_id IS NOT NULL;

CREATE INDEX product_option_groups_product_idx
  ON public.product_option_groups(product_id, sort_order);
CREATE INDEX product_option_values_group_idx
  ON public.product_option_values(option_group_id, sort_order);
CREATE INDEX product_variants_product_status_idx
  ON public.product_variants(product_id, status);
CREATE INDEX product_variant_option_values_value_idx
  ON public.product_variant_option_values(option_value_id);
CREATE INDEX cart_items_variant_idx
  ON public.cart_items(variant_id);
CREATE INDEX order_items_variant_idx
  ON public.order_items(variant_id);
CREATE INDEX inventory_movements_variant_created_idx
  ON public.inventory_movements(variant_id, created_at DESC);
CREATE INDEX inventory_movements_order_idx
  ON public.inventory_movements(order_id);

-- Fail safely instead of silently skipping malformed catalog products.
DO $backfill_validation$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.products AS product
    WHERE product.is_catalog IS TRUE
      AND (
        product.price IS NULL
        OR product.price < 0
        OR product.stock IS NULL
        OR product.stock < 0
        OR product.price::text IN ('NaN', 'Infinity', '-Infinity')
      )
  ) THEN
    RAISE EXCEPTION
      'product_variant_backfill_invalid_catalog_data: fix invalid catalog price/stock before applying this migration';
  END IF;
END;
$backfill_validation$;

-- Create one default variant for every existing catalog product.
INSERT INTO public.product_variants (
  product_id,
  sku,
  label,
  price,
  stock,
  status,
  image_url
)
SELECT
  product.id,
  'LEGACY-' || pg_catalog.replace(product.id::text, '-', ''),
  'Default',
  product.price,
  product.stock,
  product.status,
  product.image_url
FROM public.products AS product
WHERE product.is_catalog IS TRUE;

-- Associate legacy cart rows with the default variant, without changing product_id
-- so the currently deployed client continues to read the same cart rows.
UPDATE public.cart_items AS cart_item
SET variant_id = variant.id
FROM public.product_variants AS variant
WHERE variant.product_id = cart_item.product_id
  AND variant.sku = 'LEGACY-' || pg_catalog.replace(variant.product_id::text, '-', '')
  AND cart_item.variant_id IS NULL;

-- Variant tables are read-only for public/client roles in this first schema phase.
-- Admin write paths will be added through narrowly scoped admin RPCs in a later phase.
ALTER TABLE public.product_option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_option_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variant_option_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.product_option_groups,
  public.product_option_values,
  public.product_variants,
  public.product_variant_option_values,
  public.inventory_movements
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
  public.product_option_groups,
  public.product_option_values,
  public.product_variants,
  public.product_variant_option_values
TO anon, authenticated;

CREATE POLICY product_option_groups_public_read
  ON public.product_option_groups
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.products AS product
      WHERE product.id = product_option_groups.product_id
        AND product.is_catalog IS TRUE
        AND product.status = 'active'
    )
  );

CREATE POLICY product_option_values_public_read
  ON public.product_option_values
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.product_option_groups AS option_group
      JOIN public.products AS product ON product.id = option_group.product_id
      WHERE option_group.id = product_option_values.option_group_id
        AND option_group.product_id = product_option_values.product_id
        AND product.is_catalog IS TRUE
        AND product.status = 'active'
    )
  );

CREATE POLICY product_variants_public_read
  ON public.product_variants
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'active'
    AND EXISTS (
      SELECT 1
      FROM public.products AS product
      WHERE product.id = product_variants.product_id
        AND product.is_catalog IS TRUE
        AND product.status = 'active'
    )
  );

CREATE POLICY product_variant_option_values_public_read
  ON public.product_variant_option_values
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.product_variants AS variant
      JOIN public.products AS product ON product.id = variant.product_id
      WHERE variant.id = product_variant_option_values.variant_id
        AND variant.product_id = product_variant_option_values.product_id
        AND variant.status = 'active'
        AND product.is_catalog IS TRUE
        AND product.status = 'active'
    )
  );

-- No client policy or table grant is created for inventory_movements.
-- Checkout/admin functions will write this ledger transactionally in later phases.

COMMIT;
