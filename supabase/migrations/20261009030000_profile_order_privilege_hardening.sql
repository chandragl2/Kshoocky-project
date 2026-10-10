BEGIN;

-- Keep profile read access governed by the existing RLS policies, but restrict
-- writes to user-editable profile columns. The role column is never writable by
-- browser roles, including during direct INSERT.
REVOKE INSERT, UPDATE, DELETE
  ON TABLE public.profiles
  FROM PUBLIC, anon, authenticated;

-- Explicitly clear prior column-level grants too, then grant only safe fields.
REVOKE INSERT (id, full_name, phone_number, avatar_url, role, created_at, updated_at)
  ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (id, full_name, phone_number, avatar_url, role, created_at, updated_at)
  ON TABLE public.profiles FROM PUBLIC, anon, authenticated;

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

REVOKE INSERT (id, user_id, order_number, subtotal, shipping_fee, discount, total_price, payment_status, order_status, shipping_address, notes, created_at, updated_at)
  ON TABLE public.orders
  FROM PUBLIC, anon, authenticated;

REVOKE UPDATE (id, user_id, order_number, subtotal, shipping_fee, discount, total_price, payment_status, order_status, shipping_address, notes, created_at, updated_at)
  ON TABLE public.orders
  FROM PUBLIC, anon, authenticated;

REVOKE INSERT, UPDATE, DELETE
  ON TABLE public.order_items
  FROM PUBLIC, anon, authenticated;

REVOKE INSERT (id, order_id, product_id, product_title, quantity, unit_price, subtotal, created_at)
  ON TABLE public.order_items
  FROM PUBLIC, anon, authenticated;

REVOKE UPDATE (id, order_id, product_id, product_title, quantity, unit_price, subtotal, created_at)
  ON TABLE public.order_items
  FROM PUBLIC, anon, authenticated;

REVOKE INSERT, UPDATE, DELETE
  ON TABLE public.products
  FROM PUBLIC, anon, authenticated;

REVOKE INSERT (id, title, slug, description, category, price, stock, image_url, is_catalog, status, is_featured, created_at, updated_at)
  ON TABLE public.products
  FROM PUBLIC, anon, authenticated;

REVOKE UPDATE (id, title, slug, description, category, price, stock, image_url, is_catalog, status, is_featured, created_at, updated_at)
  ON TABLE public.products
  FROM PUBLIC, anon, authenticated;

REVOKE INSERT, UPDATE, DELETE
  ON TABLE public.carts
  FROM PUBLIC, anon, authenticated;

REVOKE INSERT (id, user_id, created_at, updated_at)
  ON TABLE public.carts
  FROM PUBLIC, anon, authenticated;

REVOKE UPDATE (id, user_id, created_at, updated_at)
  ON TABLE public.carts
  FROM PUBLIC, anon, authenticated;

REVOKE INSERT, UPDATE, DELETE
  ON TABLE public.cart_items
  FROM PUBLIC, anon, authenticated;

REVOKE INSERT (id, cart_id, product_id, variant_id, quantity, created_at, updated_at)
  ON TABLE public.cart_items
  FROM PUBLIC, anon, authenticated;

REVOKE UPDATE (id, cart_id, product_id, variant_id, quantity, created_at, updated_at)
  ON TABLE public.cart_items
  FROM PUBLIC, anon, authenticated;

-- Payment rows and statuses are trusted-server responsibilities. No client or
-- admin UI should be able to spoof a callback by directly writing payment data.
REVOKE INSERT, UPDATE, DELETE
  ON TABLE public.payments
  FROM PUBLIC, anon, authenticated;

REVOKE INSERT (id, order_id, payment_method, payment_gateway, transaction_id, gateway_transaction_id, payment_status, amount, paid_at, expired_at, failure_reason, created_at, updated_at)
  ON TABLE public.payments
  FROM PUBLIC, anon, authenticated;

REVOKE UPDATE (id, order_id, payment_method, payment_gateway, transaction_id, gateway_transaction_id, payment_status, amount, paid_at, expired_at, failure_reason, created_at, updated_at)
  ON TABLE public.payments
  FROM PUBLIC, anon, authenticated;

COMMIT;
