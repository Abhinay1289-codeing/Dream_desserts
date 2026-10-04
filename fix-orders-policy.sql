-- ================================================================
-- Supabase Orders Table & Realtime Setup
-- Run this in Supabase Dashboard -> SQL Editor
-- ================================================================

-- 1. Enable REPLICA IDENTITY FULL on orders table
-- Required so Supabase Realtime sends full old/new row data on UPDATE events
ALTER TABLE orders REPLICA IDENTITY FULL;

-- 2. Enable Realtime Replication for orders table
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- 3. Enable RLS and set public access policies for orders table
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert orders" ON orders;
CREATE POLICY "Anyone can insert orders" ON orders FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read orders" ON orders;
CREATE POLICY "Anyone can read orders" ON orders FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can update orders" ON orders;
CREATE POLICY "Anyone can update orders" ON orders FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can delete orders" ON orders;
CREATE POLICY "Anyone can delete orders" ON orders FOR DELETE USING (true);

-- 4. Enable RLS and set access policies for admin_devices table (Push Notifications)
ALTER TABLE admin_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read admin_devices" ON admin_devices;
CREATE POLICY "Anyone can read admin_devices" ON admin_devices FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert admin_devices" ON admin_devices;
CREATE POLICY "Anyone can insert admin_devices" ON admin_devices FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update admin_devices" ON admin_devices;
CREATE POLICY "Anyone can update admin_devices" ON admin_devices FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can delete admin_devices" ON admin_devices;
CREATE POLICY "Anyone can delete admin_devices" ON admin_devices FOR DELETE USING (true);
