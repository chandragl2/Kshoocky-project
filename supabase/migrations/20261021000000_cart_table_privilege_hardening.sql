BEGIN;

GRANT SELECT
  ON TABLE public.carts, public.cart_items
  TO authenticated;

REVOKE SELECT
  ON TABLE public.carts, public.cart_items
  FROM PUBLIC, anon;

REVOKE TRIGGER, TRUNCATE, REFERENCES, MAINTAIN
  ON TABLE public.carts, public.cart_items
  FROM PUBLIC, anon, authenticated;

COMMIT;
