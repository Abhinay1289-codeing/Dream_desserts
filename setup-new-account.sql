-- ================================================================
-- Digital Menu App — All-in-One Supabase Setup Script for New Client
-- ================================================================
-- RUN THIS SCRIPT IN YOUR NEW CLIENT'S SUPABASE PROJECT SQL EDITOR:
-- 1. Go to your Supabase Project Dashboard → SQL Editor
-- 2. Click "+ New Query"
-- 3. Paste this entire script and click "Run" ▶.
-- ================================================================

-- 1. Create Tables
CREATE TABLE IF NOT EXISTS public.menu_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text UNIQUE NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT '',
  image text DEFAULT '',
  description text DEFAULT '',
  available boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.config (
  id integer PRIMARY KEY DEFAULT 1,
  data jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.category_overrides (
  cat_id text PRIMARY KEY,
  label text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  table_number text,
  customer_name text DEFAULT 'Guest',
  customer_phone text,
  items jsonb NOT NULL DEFAULT '[]',
  subtotal numeric DEFAULT 0,
  gst numeric DEFAULT 0,
  total numeric DEFAULT 0,
  notes text,
  status text DEFAULT 'pending',
  order_type text DEFAULT 'dining',
  user_id uuid,
  latitude double precision,
  longitude double precision,
  address text,
  landmark text,
  utr_number text,
  payment_proof_url text,
  created_at timestamptz DEFAULT now()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if any
DROP POLICY IF EXISTS "Public full access to menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "Public full access to config" ON public.config;
DROP POLICY IF EXISTS "Public full access to category_overrides" ON public.category_overrides;
DROP POLICY IF EXISTS "Public full access to orders" ON public.orders;

-- 4. Create Open RLS Policies for Customer Ordering & Admin Updates
CREATE POLICY "Public full access to menu_items" ON public.menu_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access to config" ON public.config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access to category_overrides" ON public.category_overrides FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access to orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);

-- 5. Grant API permissions to anon & authenticated roles
GRANT ALL ON public.menu_items TO anon, authenticated;
GRANT ALL ON public.config TO anon, authenticated;
GRANT ALL ON public.category_overrides TO anon, authenticated;
GRANT ALL ON public.orders TO anon, authenticated;

-- 6. Enable Realtime subscriptions for Live Kitchen & Menu updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.config;
ALTER PUBLICATION supabase_realtime ADD TABLE public.category_overrides;

-- 7. Admin User Setup Reminder:
-- Create an admin user account in Supabase Dashboard → Authentication → Users
-- New admin can log in to admin.html with their new credentials.
