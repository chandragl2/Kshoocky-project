BEGIN;

REVOKE EXECUTE ON FUNCTION public.checkout_catalog(uuid) FROM authenticated;

COMMIT;
