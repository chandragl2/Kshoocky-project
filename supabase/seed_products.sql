INSERT INTO public.products (
  title,
  slug,
  description,
  category,
  price,
  stock,
  image_url,
  status,
  is_featured
)
VALUES
  (
    'Daily Comma Woody Garden Eau de Parfum',
    'daily-comma-woody-garden-eau-de-parfum',
    NULL,
    'Parfum',
    349000,
    10,
    '/Product/parfum.png',
    'active',
    false
  ),
  (
    'Daily Comma Signal Berry Eau de Parfum',
    'daily-comma-signal-berry-eau-de-parfum',
    NULL,
    'Parfum',
    349000,
    10,
    '/Product/parfum 2.png',
    'active',
    false
  ),
  (
    'Daily Comma Musk Muhwaga Eau de Parfum',
    'daily-comma-musk-muhwaga-eau-de-parfum',
    NULL,
    'Parfum',
    349000,
    10,
    '/Product/parfum 3.png',
    'active',
    false
  ),
  (
    'Daily Comma Cotton White Eau de Parfum',
    'daily-comma-cotton-white-eau-de-parfum',
    NULL,
    'Parfum',
    349000,
    10,
    '/Product/parfum 4.png',
    'active',
    false
  )
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.product_variants (
  product_id,
  sku,
  label,
  price,
  stock,
  status,
  image_url
)
SELECT
  p.id,
  'LEGACY-' || replace(p.id::text, '-', ''),
  'Default',
  p.price,
  p.stock,
  p.status,
  p.image_url
FROM public.products AS p
WHERE p.is_catalog IS TRUE
  AND p.slug IN (
    'daily-comma-woody-garden-eau-de-parfum',
    'daily-comma-signal-berry-eau-de-parfum',
    'daily-comma-musk-muhwaga-eau-de-parfum',
    'daily-comma-cotton-white-eau-de-parfum'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.product_variants AS v
    WHERE v.product_id = p.id
      AND v.sku = 'LEGACY-' || replace(p.id::text, '-', '')
  )
