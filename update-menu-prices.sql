-- ================================================
-- Digital Menu App — Menu Price Update
-- Run this in Supabase Dashboard → SQL Editor
-- ================================================

-- 1. UPDATE BIRYANI PRICES
UPDATE menu_items SET price = 200, description = 'Parcel ₹150 | Table ₹200' WHERE name = 'Chicken Fry Piece Biryani';
UPDATE menu_items SET price = 250, description = 'Parcel ₹180 | Table ₹250' WHERE name = 'Chicken Dum Biryani';
UPDATE menu_items SET price = 270 WHERE name = 'Chicken Moghalai Biryani';
UPDATE menu_items SET price = 260 WHERE name = 'Chicken Lollipop Biryani';

-- 2. ADD NEW BIRYANI ITEM (Boneless Chicken Biryani)
INSERT INTO menu_items (name, price, category, description, available, sort_order)
VALUES ('Boneless Chicken Biryani', 240, 'Biryanis', 'Fresh boneless chicken biryani · made to order', true, 225)
ON CONFLICT (name) DO UPDATE SET price = EXCLUDED.price, category = EXCLUDED.category;

-- 3. UPDATE CHINESE: Rename Lollipops + enable Chicken 65 + add Chicken Roast
UPDATE menu_items SET name = 'Chicken Lollipops (6 Pcs) (Dry/Wet)', price = 289 WHERE name = 'Chicken Lollipops (6 Pcs-wet)';
UPDATE menu_items SET price = 219 WHERE name = 'Chicken 65';

-- 4. ADD NEW CHINESE ITEM (Chicken Roast)
INSERT INTO menu_items (name, price, category, description, available, sort_order)
VALUES ('Chicken Roast', 230, 'Chinese', 'Juicy roasted chicken · house special', true, 235)
ON CONFLICT (name) DO UPDATE SET price = EXCLUDED.price, category = EXCLUDED.category;

-- 5. UPDATE TEAS & SAMOSAS & QUICK BITES
INSERT INTO menu_items (name, price, category, image, available, sort_order)
VALUES ('Chicken Samosa (4 Pcs)', 119, 'Samosas & Momos', 'assets/images/chicken-samosa.jpeg', true, 80)
ON CONFLICT (name) DO UPDATE SET price = EXCLUDED.price, category = EXCLUDED.category;

UPDATE menu_items SET price = 59 WHERE name = 'Corn Samosa (4 Pcs)';
UPDATE menu_items SET price = 119 WHERE name = 'Chicken Samosa (4 Pcs)';
UPDATE menu_items SET price = 40 WHERE name IN ('Green Tea', 'Pepper Milk', 'Turmeric Milk', 'Badam Milk', 'Horlicks', 'Boost', 'Coke', 'thumpsup', 'Sprite');

UPDATE menu_items SET price = 20 WHERE name = 'Black Tea';
UPDATE menu_items SET price = 30 WHERE name = 'Tea';
UPDATE menu_items SET name = 'Cheese Shots (6 Pcs)' WHERE name = 'Cheese Shots (4 Pcs)';

-- 6. LOLLIPOP UPDATES
DELETE FROM menu_items WHERE name = 'Chicken Lollipops (8 Pcs)' AND category = 'Fried Chicken & Fish';
UPDATE menu_items SET name = 'Chicken Lollipops (6 Pcs) (Dry/Wet)' WHERE name LIKE '%Chicken Lollipops%';
UPDATE menu_items SET name = 'Chicken Lollipop (6 Pcs)' WHERE name LIKE '%Chicken Lollipop%' AND name NOT LIKE '%Biryani%' AND name NOT LIKE '%(Dry/Wet)%';

-- ================================================
-- Verify: check that all new prices are correct
-- ================================================
SELECT name, price, category, available
FROM menu_items
WHERE name IN ('Corn Samosa (4 Pcs)', 'Chicken Samosa (4 Pcs)', 'Green Tea', 'Pepper Milk', 'Turmeric Milk', 'Badam Milk', 'Horlicks', 'Boost', 'Coke', 'thumpsup', 'Sprite')
ORDER BY category, sort_order;



