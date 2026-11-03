DROP TRIGGER IF EXISTS product_variant_option_values_a_refresh_signature
  ON public.product_variant_option_values;

CREATE TRIGGER product_variant_option_values_a_refresh_signature
AFTER INSERT OR UPDATE OR DELETE ON public.product_variant_option_values
FOR EACH ROW
EXECUTE FUNCTION public.sync_variant_signature_from_mapping();
