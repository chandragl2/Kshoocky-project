BEGIN;

CREATE POLICY orders_select_own
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY orders_select_admin
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY order_items_select_own
  ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders AS customer_order
      WHERE customer_order.id = order_items.order_id
        AND customer_order.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY order_items_select_admin
  ON public.order_items
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

COMMIT;
