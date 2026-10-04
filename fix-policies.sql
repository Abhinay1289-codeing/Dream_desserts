-- ================================================
-- Digital Menu App — Fix All Supabase Policies
-- RUN THIS in Supabase SQL Editor
-- ================================================

-- Drop ALL existing policies (by their actual names)
DROP POLICY IF EXISTS "allow_all" ON menu_items;
DROP POLICY IF EXISTS "Public can read menu items" ON menu_items;
DROP POLICY IF EXISTS "Admins can modify menu items" ON menu_items;

DROP POLICY IF EXISTS "allow_all" ON config;
DROP POLICY IF EXISTS "Public can read config" ON config;
DROP POLICY IF EXISTS "Admins can modify config" ON config;

DROP POLICY IF EXISTS "allow_all" ON category_overrides;
DROP POLICY IF EXISTS "Public can read category overrides" ON category_overrides;
DROP POLICY IF EXISTS "Admins can modify category overrides" ON category_overrides;

DROP POLICY IF EXISTS "allow_all" ON orders;
DROP POLICY IF EXISTS "Users can insert orders" ON orders;
DROP POLICY IF EXISTS "Anyone can insert orders" ON orders;
DROP POLICY IF EXISTS "Admins can manage orders" ON orders;
DROP POLICY IF EXISTS "Admins can read orders" ON orders;
DROP POLICY IF EXISTS "Admins can update orders" ON orders;

-- ================================================
-- MENU ITEMS
-- ================================================

-- Anyone can read menu items (customers need this)
CREATE POLICY "Public can read menu items"
  ON menu_items FOR SELECT USING (true);

-- Authenticated admins can do everything
CREATE POLICY "Admins can modify menu items"
  ON menu_items FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ================================================
-- CONFIG
-- ================================================

CREATE POLICY "Public can read config"
  ON config FOR SELECT USING (true);

CREATE POLICY "Admins can modify config"
  ON config FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ================================================
-- CATEGORY OVERRIDES
-- ================================================

CREATE POLICY "Public can read category overrides"
  ON category_overrides FOR SELECT USING (true);

CREATE POLICY "Admins can modify category overrides"
  ON category_overrides FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ================================================
-- ORDERS
-- ================================================

-- ✅ Customers (anonymous/auth) can INSERT orders
CREATE POLICY "Anyone can insert orders"
  ON orders FOR INSERT
  WITH CHECK (true);

-- ✅ Customers can read their own online orders
CREATE POLICY "Customers can read own orders"
  ON orders FOR SELECT
  USING (user_id = auth.uid());

-- ✅ Authenticated admins can READ orders
CREATE POLICY "Admins can read orders"
  ON orders FOR SELECT
  USING (auth.role() = 'authenticated');

-- ✅ Authenticated admins can UPDATE order status
CREATE POLICY "Admins can update orders"
  ON orders FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ================================================
-- GRANT table-level permissions to roles
-- ================================================
GRANT SELECT ON menu_items TO anon;
GRANT SELECT ON config TO anon;
GRANT SELECT ON category_overrides TO anon;
GRANT INSERT ON orders TO anon;

GRANT ALL ON menu_items TO authenticated;
GRANT ALL ON config TO authenticated;
GRANT ALL ON category_overrides TO authenticated;
GRANT SELECT, UPDATE ON orders TO authenticated;
