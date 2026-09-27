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