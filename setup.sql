-- ================================================
-- Digital Menu App — Secure Supabase Setup
-- ================================================
-- IMPORTANT: THIS SETUP FOLLOWS SECURITY BEST PRACTICES!
-- ================================================

-- 0. Create tables if they don't already exist
create table if not exists public.menu_items (
  id uuid default gen_random_uuid() primary key,
  name text unique not null,
  price integer not null default 0,
  category text not null default '',
  image text default '',
  description text default '',
  available boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.config (
  id integer primary key default 1,
  data jsonb not null default '{}'
);

create table if not exists public.category_overrides (
  cat_id text primary key,
  label text not null
);

create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  table_number text,
  customer_name text default 'Guest',
  customer_phone text,
  items jsonb not null default '[]',
  subtotal integer default 0,
  gst integer default 0,
  total integer default 0,
  notes text,
  status text default 'pending',
  order_type text default 'dining',
  user_id uuid,
  latitude double precision,
  longitude double precision,
  address text,
  landmark text,
  utr_number text,
  payment_proof_url text,
  created_at timestamptz default now()
);

-- 1. Enable Row Level Security on ALL tables
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 2. Drop old "allow_all" policies (if they exist)
DROP POLICY IF EXISTS "allow_all" ON menu_items;
DROP POLICY IF EXISTS "allow_all" ON config;
DROP POLICY IF EXISTS "allow_all" ON category_overrides;
DROP POLICY IF EXISTS "allow_all" ON orders;

-- 3. Create NEW RLS Policies: Principle of Least Privilege
-- =======================================================

-- Policy: All users can read menu items (public)
CREATE POLICY "Public can read menu items" 
  ON menu_items 
  FOR SELECT 
  USING (true);

-- Policy: Only authenticated users (admins) can modify menu items
CREATE POLICY "Admins can modify menu items" 
  ON menu_items 
  USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: All users can read config (public)
CREATE POLICY "Public can read config" 
  ON config 
  FOR SELECT 
  USING (true);

-- Policy: Only authenticated users (admins) can modify config
CREATE POLICY "Admins can modify config" 
  ON config 
  USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: All users can read category_overrides (public)
CREATE POLICY "Public can read category overrides" 
  ON category_overrides 
  FOR SELECT 
  USING (true);

-- Policy: Only authenticated users (admins) can modify category_overrides
CREATE POLICY "Admins can modify category overrides" 
  ON category_overrides 
  USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: All users can insert their own orders
CREATE POLICY "Users can insert orders" 
  ON orders 
  FOR INSERT 
  WITH CHECK (true);

-- Policy: Users can read their own orders
CREATE POLICY "Users can read own orders"
  ON orders
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Only authenticated users (admins) can manage orders (stricter email-based or fallback to admin app logic)
-- Note: Assuming admin uses a specific email or doesn't have a normal user_id linked to orders.
CREATE POLICY "Admins can manage orders" 
  ON orders 
  USING (auth.role() = 'authenticated' AND (auth.uid() != user_id OR user_id IS NULL)) 
  WITH CHECK (auth.role() = 'authenticated');

-- ================================================
-- 4. Storage Bucket Setup
-- ================================================
insert into storage.buckets (id, name, public) 
values ('payment_proofs', 'payment_proofs', true)
on conflict (id) do nothing;

CREATE POLICY "Anyone can upload payment proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'payment_proofs');

CREATE POLICY "Public can view payment proofs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payment_proofs');

-- ================================================
-- 5. Production Recommendations
-- ================================================
--
-- - Set up Supabase Auth to create admin users
-- - For stricter control, add admin metadata and check it in RLS
-- - Example: Check that user.email is in admin list
--
--   Example stricter policy:
--
--   CREATE POLICY "Only specific admins can modify items"
--     ON menu_items
--     USING (
--       auth.uid() IS NOT NULL AND
--       auth.email() IN ('admin1@yourcafe.com', 'admin2@yourcafe.com')
--     )
--     WITH CHECK (
--       auth.uid() IS NOT NULL AND
--       auth.email() IN ('admin1@yourcafe.com', 'admin2@yourcafe.com')
--     );
--
-- - Rate limit sensitive endpoints
-- - Regularly audit access logs
--
-- ================================================
