BEGIN;

CREATE POLICY carts_select_own
  ON public.carts
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY cart_items_select_own
  ON public.cart_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.carts AS cart
      WHERE cart.id = cart_items.cart_id
        AND cart.user_id = (SELECT auth.uid())
    )
  );

COMMIT;
