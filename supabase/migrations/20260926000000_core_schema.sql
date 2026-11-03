BEGIN;

-- Core application schema for local Supabase migration testing.
-- Does not create preorder or featured-event tables; later migrations own those.

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name varchar,
  phone_number varchar,
  avatar_url text,
  role varchar NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar NOT NULL,
  slug varchar NOT NULL UNIQUE,
  description text,
  category varchar,
  price numeric NOT NULL DEFAULT 0 CHECK (price >= 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url text,
  status varchar NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'out_of_stock')),
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_catalog boolean NOT NULL DEFAULT true
);

CREATE TABLE public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label varchar NOT NULL DEFAULT 'Rumah',
  recipient_name varchar NOT NULL,
  phone_number varchar NOT NULL,
  address_line text NOT NULL,
  city varchar NOT NULL,
  province varchar NOT NULL,
  postal_code varchar NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cart_items_cart_product_unique UNIQUE (cart_id, product_id)
);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_number varchar NOT NULL UNIQUE,
  subtotal numeric NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  shipping_fee numeric NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0),
  discount numeric NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total_price numeric NOT NULL DEFAULT 0 CHECK (total_price >= 0),
  payment_status varchar NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  order_status varchar NOT NULL DEFAULT 'pending'
    CHECK (order_status IN ('pending', 'processing', 'shipped', 'completed', 'cancelled')),
  shipping_address jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_title varchar NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  subtotal numeric NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_method varchar,
  payment_gateway varchar,
  transaction_id varchar,
  gateway_transaction_id varchar,
  payment_status varchar NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'expired', 'refunded', 'cancelled')),
  amount numeric NOT NULL DEFAULT 0 CHECK (amount >= 0),
  paid_at timestamptz,
  expired_at timestamptz,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  tracking_number varchar NOT NULL UNIQUE,
  current_status varchar NOT NULL DEFAULT 'SEOUL_WH'
    CHECK (current_status IN ('SEOUL_WH', 'IN_TRANSIT', 'CUSTOMS', 'JAKARTA_WH', 'DELIVERED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.shipment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  status_title varchar NOT NULL,
  location varchar,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX products_is_catalog_idx ON public.products (is_catalog);
CREATE INDEX product_images_product_sort_idx
  ON public.product_images (product_id, sort_order);
CREATE INDEX payments_order_id_idx ON public.payments (order_id);
CREATE INDEX payments_payment_status_idx ON public.payments (payment_status);
CREATE INDEX payments_transaction_id_idx ON public.payments (transaction_id);
CREATE INDEX payments_gateway_transaction_id_idx
  ON public.payments (gateway_transaction_id);
CREATE INDEX shipments_order_id_idx ON public.shipments (order_id);
CREATE INDEX shipments_tracking_number_idx ON public.shipments (tracking_number);
CREATE INDEX shipment_logs_shipment_id_idx ON public.shipment_logs (shipment_id);
CREATE INDEX shipment_logs_created_at_idx ON public.shipment_logs (created_at);

CREATE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$function$;

CREATE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$function$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- RLS is enabled here; later migrations define feature-specific policies
-- and harden table/function privileges.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_logs ENABLE ROW LEVEL SECURITY;

COMMIT;
