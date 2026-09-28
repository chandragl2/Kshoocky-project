CREATE TABLE public.preorder_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar NOT NULL,
  slug varchar NOT NULL UNIQUE,
  description text,
  cover_image_url text,
  status varchar NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'closed', 'cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX preorder_events_status_idx
  ON public.preorder_events (status);
CREATE INDEX preorder_events_starts_at_idx
  ON public.preorder_events (starts_at);
CREATE INDEX preorder_events_ends_at_idx
  ON public.preorder_events (ends_at);

CREATE TABLE public.preorder_event_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL
    REFERENCES public.preorder_events (id) ON DELETE CASCADE,
  product_id uuid NOT NULL
    REFERENCES public.products (id) ON DELETE RESTRICT,
  preorder_price numeric NOT NULL DEFAULT 0
    CHECK (preorder_price >= 0),
  preorder_stock integer NOT NULL DEFAULT 0
    CHECK (preorder_stock >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, product_id)
);

CREATE INDEX preorder_event_products_product_id_idx
  ON public.preorder_event_products (product_id);

ALTER TABLE public.preorder_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preorder_event_products ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.preorder_events TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.preorder_events TO authenticated;
GRANT SELECT ON public.preorder_event_products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.preorder_event_products TO authenticated;

CREATE POLICY "Anyone can read active preorder events"
  ON public.preorder_events
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

CREATE POLICY "Admins can manage preorder events"
  ON public.preorder_events
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Anyone can read products in active preorder events"
  ON public.preorder_event_products
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.preorder_events AS events
      WHERE events.id = preorder_event_products.event_id
        AND events.status = 'active'
    )
  );

CREATE POLICY "Admins can manage preorder event products"
  ON public.preorder_event_products
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());