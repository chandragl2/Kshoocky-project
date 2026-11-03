BEGIN;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
);

GRANT SELECT ON TABLE public.products, public.product_images
  TO anon, authenticated;

REVOKE INSERT, UPDATE, DELETE
  ON TABLE public.products, public.product_images
  FROM PUBLIC, anon, authenticated;

CREATE POLICY kshoocky_products_public_select
  ON public.products
  FOR SELECT
  TO anon, authenticated
  USING (is_catalog IS TRUE AND status = 'active');

CREATE POLICY kshoocky_products_admin_select
  ON public.products
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY kshoocky_product_images_public_select
  ON public.product_images
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.products AS product
      WHERE product.id = product_images.product_id
        AND product.is_catalog IS TRUE
        AND product.status = 'active'
    )
  );

CREATE POLICY kshoocky_product_images_admin_select
  ON public.product_images
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY kshoocky_product_images_storage_public_select
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'product-images');

CREATE POLICY kshoocky_product_images_storage_admin_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.is_admin()
  );

CREATE POLICY kshoocky_product_images_storage_admin_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.is_admin()
  );

COMMIT;
