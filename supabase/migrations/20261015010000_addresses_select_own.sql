BEGIN;

CREATE POLICY addresses_select_own
  ON public.addresses
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

COMMIT;
