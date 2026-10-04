-- ================================================
-- Digital Menu App — Sample Menu Insert
-- Run this in Supabase Dashboard → SQL Editor
-- ================================================
-- Categories: Starters (Non-Veg), Starters (Mutton), Starters (Veg),
--             Soups, Biryanis, Fried Rice, Rice
-- ================================================

-- ================================================
-- NON-VEG STARTERS (Chicken)
-- ================================================
INSERT INTO menu_items (name, price, category, available, sort_order) VALUES
  ('Chicken 65',                      219, 'Starters',        true, 101),
  ('Chicken Manchurian',              219, 'Starters',        true, 102),
  ('Chilli Chicken',                  219, 'Starters',        true, 103),
  ('Chicken Lollipop (6 Pcs)',        289, 'Starters',        true, 104),
  ('Dragon Chicken',                  249, 'Starters',        true, 105),
  ('Chicken Majestic',                239, 'Starters',        true, 106),
  ('Chicken 555',                     239, 'Starters',        true, 107),
  ('Garlic Chicken',                  219, 'Starters',        true, 108),
  ('8 to 8 Chicken',                  239, 'Starters',        true, 109),
  ('Pepper Chicken',                  329, 'Starters',        true, 110),
  ('Sezwan Chicken',                  239, 'Starters',        true, 111),
  ('House Special (Chicken)',         389, 'Starters',        true, 112)
ON CONFLICT (name) DO UPDATE
  SET price = EXCLUDED.price,
      category = EXCLUDED.category,
      sort_order = EXCLUDED.sort_order;

-- ================================================
-- MUTTON STARTERS
-- ================================================
INSERT INTO menu_items (name, price, category, available, sort_order) VALUES
  ('Mutton 65',                       319, 'Starters',        true, 201),
  ('Mutton Manchurian',               319, 'Starters',        true, 202),
  ('Chilli Mutton',                   329, 'Starters',        true, 203),
  ('Mutton Roast',                    359, 'Starters',        true, 204),
  ('Pepper Mutton',                   349, 'Starters',        true, 205),
  ('Sezwan Mutton',                   359, 'Starters',        true, 206)
ON CONFLICT (name) DO UPDATE
  SET price = EXCLUDED.price,
      category = EXCLUDED.category,
      sort_order = EXCLUDED.sort_order;

-- ================================================
-- VEG STARTERS
-- ================================================
INSERT INTO menu_items (name, price, category, available, sort_order) VALUES
  ('Gobi Manchurian',                 190, 'Veg Starters',    true, 301),
  ('Gobi Chilli',                     170, 'Veg Starters',    true, 302),
  ('Gobi 65',                         170, 'Veg Starters',    true, 303),
  ('Veg Manchurian',                  199, 'Veg Starters',    true, 304),
  ('Veg 65',                          199, 'Veg Starters',    true, 305),
  ('Veg Chilli',                      189, 'Veg Starters',    true, 306),
  ('Veg Sezwan',                      189, 'Veg Starters',    true, 307),
  ('Chilli Mushroom',                 189, 'Veg Starters',    true, 308),
  ('Mushroom 65',                     189, 'Veg Starters',    true, 309),
  ('Mushroom Manchurian',             189, 'Veg Starters',    true, 310),
  ('Pepper Mushroom',                 189, 'Veg Starters',    true, 311),
  ('Sezwan Mushroom',                 229, 'Veg Starters',    true, 312),
  ('Babycorn Majestic',               199, 'Veg Starters',    true, 313),
  ('Babycorn 555',                    199, 'Veg Starters',    true, 314),
  ('Babycorn Garlic',                 219, 'Veg Starters',    true, 315),
  ('Paneer 65',                       189, 'Veg Starters',    true, 316),
  ('Chilli Paneer',                   189, 'Veg Starters',    true, 317),
  ('Paneer Manchurian',               189, 'Veg Starters',    true, 318),
  ('Paneer Roast',                    199, 'Veg Starters',    true, 319),
  ('Paneer Majestic',                 199, 'Veg Starters',    true, 320),
  ('House Special (Veg)',            229, 'Veg Starters',    true, 321)
ON CONFLICT (name) DO UPDATE
  SET price = EXCLUDED.price,
      category = EXCLUDED.category,
      sort_order = EXCLUDED.sort_order;

-- ================================================
-- SOUPS
-- ================================================
INSERT INTO menu_items (name, price, category, available, sort_order) VALUES
  ('Veg Manchow Soup',                 99, 'Soups',           true, 401),
  ('Chicken Manchow Soup',            129, 'Soups',           true, 402),
  ('Hot N Sour Soup',                 119, 'Soups',           true, 403),
  ('Chicken Hot N Sour Soup',         119, 'Soups',           true, 404),
  ('Sweet Corn Soup',                 129, 'Soups',           true, 405)
ON CONFLICT (name) DO UPDATE
  SET price = EXCLUDED.price,
      category = EXCLUDED.category,
      sort_order = EXCLUDED.sort_order;

-- ================================================
-- BIRYANIS
-- ================================================
INSERT INTO menu_items (name, price, category, available, sort_order) VALUES
  ('Mixed Biryani',                   299, 'Biryanis',        true, 501),
  ('Mixed Mughlai Biryani',           329, 'Biryanis',        true, 502),
  ('Pot Biryani',                     350, 'Biryanis',        true, 503),
  ('Kheema Biryani',                  369, 'Biryanis',        true, 504),
  ('House Special Biryani',           399, 'Biryanis',        true, 505),
  ('Baby Corn Biryani',               219, 'Biryanis',        true, 506),
  ('Veg Mixed Biryani',               249, 'Biryanis',        true, 507)
ON CONFLICT (name) DO UPDATE
  SET price = EXCLUDED.price,
      category = EXCLUDED.category,
      sort_order = EXCLUDED.sort_order;

-- ================================================
-- NON-VEG FRIED RICE
-- ================================================
INSERT INTO menu_items (name, price, category, available, sort_order) VALUES
  ('Chicken Fried Rice',              179, 'Fried Rice',      true, 601),
  ('Spl Chicken Fried Rice',          199, 'Fried Rice',      true, 602),
  ('Egg Fried Rice',                  159, 'Fried Rice',      true, 603),
  ('Double Egg Fried Rice',           169, 'Fried Rice',      true, 604),
  ('Chicken Sezwan Fried Rice',       199, 'Fried Rice',      true, 605),
  ('Mutton Fried Rice',               289, 'Fried Rice',      true, 606),
  ('Spl Mutton Fried Rice',           319, 'Fried Rice',      true, 607),
  ('Spl House Special Fried Rice',    259, 'Fried Rice',      true, 608)
ON CONFLICT (name) DO UPDATE
  SET price = EXCLUDED.price,
      category = EXCLUDED.category,
      sort_order = EXCLUDED.sort_order;

-- ================================================
-- VEG FRIED RICE
-- ================================================
INSERT INTO menu_items (name, price, category, available, sort_order) VALUES
  ('Veg Fried Rice',                  139, 'Veg Fried Rice',  true, 701),
  ('Spl Veg Fried Rice',              169, 'Veg Fried Rice',  true, 702),
  ('Babycorn Fried Rice',             159, 'Veg Fried Rice',  true, 703),
  ('Spl Babycorn Fried Rice',         189, 'Veg Fried Rice',  true, 704),
  ('Mushroom Fried Rice',             189, 'Veg Fried Rice',  true, 705),
  ('Veg Mix Fried Rice',              169, 'Veg Fried Rice',  true, 706),
  ('Veg Manchurian Fried Rice',       169, 'Veg Fried Rice',  true, 707)
ON CONFLICT (name) DO UPDATE
  SET price = EXCLUDED.price,
      category = EXCLUDED.category,
      sort_order = EXCLUDED.sort_order;

-- ================================================
-- RICE
-- ================================================
INSERT INTO menu_items (name, price, category, description, available, sort_order) VALUES
  ('Curd Rice',                        89, 'Rice',  'Served with pickle',     true, 801),
  ('Sambar Rice',                     119, 'Rice',  'Served with papad',      true, 802),
  ('Sambar Rice with Omlette',        189, 'Rice',  '',                       true, 803),
  ('Sambar Rice with Chicken Fry',    219, 'Rice',  '',                       true, 804)
ON CONFLICT (name) DO UPDATE
  SET price = EXCLUDED.price,
      category = EXCLUDED.category,
      description = EXCLUDED.description,
      sort_order = EXCLUDED.sort_order;

-- ================================================
-- Verify: Count by category
-- ================================================
SELECT category, COUNT(*) as item_count
FROM menu_items
GROUP BY category
ORDER BY category;
