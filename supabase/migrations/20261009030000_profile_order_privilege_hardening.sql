BEGIN;

-- Keep profile read access governed by the existing RLS policies, but restrict
-- writes to user-editable profile columns. The role column is never writable by
-- browser roles, including during direct INSERT.
REVOKE INSERT, UPDATE, DELETE
  ON TABLE public.profiles
  FROM PUBLIC, anon, authenticated;

GRANT INSERT (id, full_name, phone_number, avatar_url)
  ON TABLE public.profiles
  TO authenticated;

GRANT UPDATE (full_name, phone_number, avatar_url)
  ON TABLE public.profiles
  TO authenticated;

-- Checkout and administration mutations use guarded SECURITY DEFINER RPCs.
-- Browser clients should not be able to create or mutate orders, order lines,
-- payment records, inventory, or the source product catalogue directly.
REVOKE INSERT, UPDATE, DELETE
  ON TABLE public.orders
  FROM PUBLIC, anon, authenticated;

REVOKE INSERT, UPDATE, DELETE
  ON TABLE public.order_items
  FROM PUBLIC, anon, authenticated;

REVOKE INSERT, UPDATE, DELETE
  ON TABLE public.products
  FROM PUBLIC, anon, authenticated;

REVOKE INSERT, UPDATE, DELETE
  ON TABLE public.carts
  FROM PUBLIC, anon, authenticated;

REVOKE INSERT, UPDATE, DELETE
  ON TABLE public.cart_items
  FROM PUBLIC, anon, authenticated;

-- Payment rows and statuses are trusted-server responsibilities. No client or
-- admin UI should be able to spoof a callback by directly writing payment data.
REVOKE INSERT, UPDATE, DELETE
  ON TABLE public.payments
  FROM PUBLIC, anon, authenticated;

COMMIT;
