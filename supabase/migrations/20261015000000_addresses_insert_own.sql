BEGIN;

CREATE POLICY addresses_insert_own
  ON public.addresses
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

COMMIT;
