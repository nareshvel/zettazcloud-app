-- =============================================================================
-- Diamond Republic: Extended Seed Data
-- Date: 2026-08-14
-- Requires: 2026-08-14_diamond_republic_demo_seed.sql already applied
-- Adds: Sales Associate role + 3 associates, 10 customers, 3 suppliers,
--       20 additional products (bridal sets, men's, children's, gemstone pieces)
-- Idempotent: INSERT IGNORE throughout.
-- =============================================================================
-- Tenant:  e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c
-- Store:   a1b2c3d4-e5f6-7890-abcd-ef1234567890
-- Admin:   b1c2d3e4-f5a6-7890-bcde-f12345678901

-- ---------------------------------------------------------------------------
-- 1. Sales Associate role
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `roles`
  (`id`, `tenant_id`, `name`, `description`, `is_system_role`, `created_by`)
VALUES (
  'r1000000-0000-0000-0000-000000000004',
  'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
  'Sales Associate',
  'Floor sales: POS, customer management, product viewing. No admin or reports.',
  0,
  'b1c2d3e4-f5a6-7890-bcde-f12345678901'
);

-- Assign relevant permissions to Sales Associate
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT 'r1000000-0000-0000-0000-000000000004', `id`
FROM `permissions`
WHERE `name` IN (
  'dashboard.view',
  'products.view', 'categories.view', 'inventory.view',
  'sales.view', 'sales.create',
  'customers.view', 'customers.create', 'customers.edit',
  'layaway.view', 'layaway.create',
  'repairs.view', 'repairs.create'
);

-- ---------------------------------------------------------------------------
-- 2. Sales Associates (users)
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `users`
  (`id`, `tenant_id`, `store_id`, `name`, `email`, `phone_number`,
   `password_hash`, `is_active`, `email_verified`, `signup_completed`,
   `created_at`, `updated_at`)
VALUES
  -- Priya Sharma
  ('u2000000-0000-0000-0000-000000000001',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Priya Sharma',
   'priya@diamondrepublic.in', '+91 98401 11001',
   '$2a$12$z.PB2zdDXrzO0zQ3NcwQAOG0dKWis1c6A.CeKWwLheAfoYZ3wv.J2',
   1, 1, 1, '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

  -- Karthik Raj
  ('u2000000-0000-0000-0000-000000000002',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Karthik Raj',
   'karthik@diamondrepublic.in', '+91 98401 11002',
   '$2a$12$z.PB2zdDXrzO0zQ3NcwQAOG0dKWis1c6A.CeKWwLheAfoYZ3wv.J2',
   1, 1, 1, '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

  -- Meena Devi
  ('u2000000-0000-0000-0000-000000000003',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Meena Devi',
   'meena@diamondrepublic.in', '+91 98401 11003',
   '$2a$12$z.PB2zdDXrzO0zQ3NcwQAOG0dKWis1c6A.CeKWwLheAfoYZ3wv.J2',
   1, 1, 1, '2026-08-14 06:00:00', '2026-08-14 06:00:00');

-- Assign Sales Associate role (store-scoped) to all three
INSERT IGNORE INTO `user_roles`
  (`id`, `user_id`, `role_id`, `store_id`, `scope`, `assigned_by`, `created_at`, `updated_at`)
VALUES
  ('ur100000-0000-0000-0000-000000000002',
   'u2000000-0000-0000-0000-000000000001',
   'r1000000-0000-0000-0000-000000000004',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'store', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

  ('ur100000-0000-0000-0000-000000000003',
   'u2000000-0000-0000-0000-000000000002',
   'r1000000-0000-0000-0000-000000000004',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'store', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

  ('ur100000-0000-0000-0000-000000000004',
   'u2000000-0000-0000-0000-000000000003',
   'r1000000-0000-0000-0000-000000000004',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'store', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-14 06:00:00', '2026-08-14 06:00:00');

-- ---------------------------------------------------------------------------
-- 3. Suppliers
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `suppliers`
  (`id`, `tenant_id`, `supplier_name`, `contact_person`, `email`, `phone`,
   `address_line1`, `city`, `state_province`, `postal_code`, `country`,
   `tax_id`, `default_payment_terms`, `notes`, `is_active`,
   `created_by_user_id`, `updated_by_user_id`, `created_at`, `updated_at`)
VALUES
  -- Gold manufacturer - Madurai
  ('s1000000-0000-0000-0000-000000000001',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'Thangam Jewellery Manufacturing',
   'Murugesan Pillai',
   'murugesan@thangamjewels.com', '+91 94430 55001',
   '12, Goldsmith Street, Mattuthavani',
   'Madurai', 'Tamil Nadu', '625009', 'India',
   '33AAACT1234F1Z5', 'Net 30',
   'Primary gold manufacturer. Supplies 22K and 18K pieces. Delivery within 7 days for custom orders.',
   1, 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

  -- Gemstones - Mumbai
  ('s1000000-0000-0000-0000-000000000002',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'Gem Palace Precious Stones',
   'Harish Zaveri',
   'harish@gempalace.in', '+91 98200 77002',
   '47, Zaveri Bazaar, Kalbadevi Road',
   'Mumbai', 'Maharashtra', '400002', 'India',
   '27AAACG4567H1Z2', 'Advance 50%, Balance on delivery',
   'Supplies rubies, emeralds, sapphires, and semi-precious stones. GII/IGI certified where available.',
   1, 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

  -- Certified diamonds - Surat
  ('s1000000-0000-0000-0000-000000000003',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'Ratna Exports Diamond House',
   'Nilesh Shah',
   'nilesh@ratnaexports.com', '+91 99250 33003',
   'Diamond Bourse, Surat Diamond Park, Ichhapore',
   'Surat', 'Gujarat', '394510', 'India',
   '24AAACR8901K1Z8', 'Net 15',
   'GIA and IGI certified round brilliant and fancy cut diamonds. Minimum order ₹2 Lakhs.',
   1, 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-14 06:00:00', '2026-08-14 06:00:00');

-- ---------------------------------------------------------------------------
-- 4. Customers
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `customers`
  (`id`, `tenant_id`, `store_id`, `first_name`, `last_name`, `email`,
   `phone_number`, `address_line1`, `city`, `state_province`, `postal_code`,
   `country`, `customer_type`, `credit_limit`, `outstanding_credit`,
   `notes`, `is_active`, `created_by_user_id`, `updated_by_user_id`,
   `created_at`, `updated_at`)
VALUES

  -- 1. Lakshmi Subramaniam – VIP, buys gold regularly
  ('cust0001-0000-0000-0000-000000000001',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Lakshmi', 'Subramaniam',
   'lakshmi.subbu@gmail.com', '+91 98410 21001',
   '14, Gandhi Nagar, Adyar', 'Chennai', 'Tamil Nadu', '600020', 'India',
   'INDIVIDUAL', 500000.00, 0.00,
   'VIP customer. Buys bridal sets every 2–3 years. Prefers 22K traditional designs. Birthday: 12 Jan.',
   1, 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

  -- 2. Ramesh Iyer – bridal shopping
  ('cust0001-0000-0000-0000-000000000002',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Ramesh', 'Iyer',
   'ramesh.iyer@outlook.com', '+91 98410 21002',
   '7, Rajaji Bhavan, Besant Nagar', 'Chennai', 'Tamil Nadu', '600090', 'India',
   'INDIVIDUAL', 200000.00, 0.00,
   'Purchasing bridal set for daughter''s wedding in November. Budget approx ₹8 Lakhs.',
   1, 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

  -- 3. Kavitha Krishnan – silver collector
  ('cust0001-0000-0000-0000-000000000003',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Kavitha', 'Krishnan',
   'kavitha.k@yahoo.co.in', '+91 98410 21003',
   '23, Alwarpet Main Road', 'Chennai', 'Tamil Nadu', '600018', 'India',
   'INDIVIDUAL', 50000.00, 0.00,
   'Prefers silver and oxidised silver jewellery. Buys frequently for gifts.',
   1, 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

  -- 4. Deepa Mehta – diamond ring purchase
  ('cust0001-0000-0000-0000-000000000004',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Deepa', 'Mehta',
   'deepa.mehta@gmail.com', '+91 98410 21004',
   '5, Poes Garden, Teynampet', 'Chennai', 'Tamil Nadu', '600086', 'India',
   'INDIVIDUAL', 300000.00, 0.00,
   'Anniversary gift purchase — interested in GIA solitaire rings 0.50ct+.',
   1, 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

  -- 5. Pradeep Nair – businessman, bulk
  ('cust0001-0000-0000-0000-000000000005',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Pradeep', 'Nair',
   'pradeep.nair@business.com', '+91 98410 21005',
   '102, Cenotaph Road, Alwarpet', 'Chennai', 'Tamil Nadu', '600018', 'India',
   'INDIVIDUAL', 1000000.00, 0.00,
   'High-value client. Purchases gold for gifting during Diwali and festivals. Net 15 terms.',
   1, 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

  -- 6. Sunita Devi – savings scheme member
  ('cust0001-0000-0000-0000-000000000006',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Sunita', 'Devi',
   'sunita.devi@gmail.com', '+91 98410 21006',
   '9, Mylapore 3rd Street', 'Chennai', 'Tamil Nadu', '600004', 'India',
   'INDIVIDUAL', 0.00, 0.00,
   'Enrolled in Gold Savings Scheme (11+1). Monthly ₹5,000. Good payment track record.',
   1, 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

  -- 7. Anand Kumar – repair customer
  ('cust0001-0000-0000-0000-000000000007',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Anand', 'Kumar',
   'anand.kumar@hotmail.com', '+91 98410 21007',
   '34, Velachery Main Road', 'Chennai', 'Tamil Nadu', '600042', 'India',
   'INDIVIDUAL', 0.00, 0.00,
   'Brought in mangalsutra for chain repair and pendant stone re-setting.',
   1, 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

  -- 8. Sridevi Rajan – layaway customer
  ('cust0001-0000-0000-0000-000000000008',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Sridevi', 'Rajan',
   'sridevi.rajan@gmail.com', '+91 98410 21008',
   '18, Anna Nagar West', 'Chennai', 'Tamil Nadu', '600040', 'India',
   'INDIVIDUAL', 0.00, 0.00,
   'Layaway customer — bridal bangle set reserved. Paying in 6 monthly instalments.',
   1, 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

  -- 9. Balaji Venkatesh – old gold exchange
  ('cust0001-0000-0000-0000-000000000009',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Balaji', 'Venkatesh',
   'balaji.v@gmail.com', '+91 98410 21009',
   '6, T. Nagar 8th Street', 'Chennai', 'Tamil Nadu', '600017', 'India',
   'INDIVIDUAL', 0.00, 0.00,
   'Exchanged old 22K bangles (18g) for credit voucher. Voucher balance ₹1,62,000.',
   1, 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

  -- 10. Nirmala Pillai – walk-in regular
  ('cust0001-0000-0000-0000-000000000010',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Nirmala', 'Pillai',
   'nirmala.pillai@gmail.com', '+91 98410 21010',
   '2, Vadapalani 1st Main Road', 'Chennai', 'Tamil Nadu', '600026', 'India',
   'INDIVIDUAL', 25000.00, 0.00,
   'Regular monthly buyer. Prefers silver and light gold pieces under ₹50K.',
   1, 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-14 06:00:00', '2026-08-14 06:00:00');

-- ---------------------------------------------------------------------------
-- 5. Additional Products (20 more — bridal sets, men's, children's, gemstone)
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `products`
  (`id`, `tenant_id`, `store_id`, `name`, `description`, `price`, `cost_price`,
   `purchase_price`, `markup_pct`, `sku`, `barcode`, `category_id`,
   `stock_quantity`, `low_stock_threshold`, `is_active`, `attributes`,
   `created_by_user_id`, `updated_by_user_id`, `created_at`, `updated_at`)
VALUES

-- ── BRIDAL SETS ──────────────────────────────────────────────────────────────

-- 36. Bridal Necklace + Earring Set 22K
('dr000002-0000-0000-0000-000000000036',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Bridal Necklace & Jhumka Set 22K',
 'Matching 22K gold bridal necklace and jhumka earring set with peacock motif. Bridal collection.',
 545000.00, 485000.00, 449000.00, 12.37,
 'DR-BS-001', '8901234560036',
 'c1000000-0000-0000-0000-000000000001',
 1, 1, 1,
 '{
   "product_type": "Necklace",
   "metal_type": "Gold", "metal_colour": "Yellow",
   "purity": "22K (916)",
   "gross_weight": 56.0, "net_weight": 53.5,
   "wastage_pct": 4.67,
   "stone_type": "No Stone",
   "making_charge": 38000,
   "hallmark_huid": "HUID-DR0036",
   "design_no": "BS-001",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:30:00', '2026-08-14 06:30:00'),

-- 37. Bridal Bangles Set (Set of 4)
('dr000002-0000-0000-0000-000000000037',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Bridal Kangan Set 22K – Set of 4',
 'Set of 4 matching 22K gold bridal bangles with antique finish and kundan detailing.',
 620000.00, 550000.00, 510000.00, 12.73,
 'DR-BS-002', '8901234560037',
 'c1000000-0000-0000-0000-000000000001',
 1, 1, 1,
 '{
   "product_type": "Bangle",
   "metal_type": "Gold", "metal_colour": "Yellow",
   "purity": "22K (916)",
   "gross_weight": 63.5, "net_weight": 60.0,
   "wastage_pct": 5.83,
   "stone_type": "No Stone",
   "making_charge": 42000,
   "hallmark_huid": "HUID-DR0037",
   "design_no": "BS-002",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:30:00', '2026-08-14 06:30:00'),

-- 38. Bridal Diamond Necklace Set 18K
('dr000002-0000-0000-0000-000000000038',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Diamond Bridal Necklace Set 18K',
 '18K white gold bridal necklace + earrings set with 3.20ct total diamond weight. IGI certified.',
 895000.00, 795000.00, 736000.00, 12.58,
 'DR-BS-003', '8901234560038',
 'c1000000-0000-0000-0000-000000000003',
 1, 1, 1,
 '{
   "product_type": "Necklace",
   "metal_type": "Gold", "metal_colour": "White",
   "purity": "18K (750)",
   "gross_weight": 22.0, "net_weight": 20.5,
   "stone_type": "Diamond",
   "number_of_stones": 85,
   "stone_weight": 3.20,
   "stone_quality": "G/VS2/VG – Round Brilliant",
   "stone_value": 580000,
   "stone_certification": "IGI",
   "certificate_no": "IGI-SET-2026-0101",
   "making_charge": 32000,
   "hallmark_huid": "HUID-DR0038",
   "design_no": "BS-003",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:30:00', '2026-08-14 06:30:00'),

-- ── MEN'S JEWELLERY ──────────────────────────────────────────────────────────

-- 39. Men's Gold Chain 22K
('dr000002-0000-0000-0000-000000000039',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Men''s Heavy Gold Chain 22K – 24 inch',
 '22K yellow gold heavy curb chain for men, 24 inches with spring ring clasp.',
 198000.00, 176000.00, 163000.00, 12.50,
 'DR-MJ-001', '8901234560039',
 'c1000000-0000-0000-0000-000000000001',
 2, 1, 1,
 '{
   "product_type": "Chain",
   "metal_type": "Gold", "metal_colour": "Yellow",
   "purity": "22K (916)",
   "gross_weight": 20.5, "net_weight": 19.5,
   "wastage_pct": 5.13,
   "stone_type": "No Stone",
   "making_charge": 9500,
   "hallmark_huid": "HUID-DR0039",
   "design_no": "MJ-001",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:30:00', '2026-08-14 06:30:00'),

-- 40. Men's Gold Bracelet 22K
('dr000002-0000-0000-0000-000000000040',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Men''s Gold Bracelet 22K',
 '22K yellow gold men''s bracelet with box link design and safety clasp.',
 145000.00, 129000.00, 119000.00, 12.40,
 'DR-MJ-002', '8901234560040',
 'c1000000-0000-0000-0000-000000000001',
 2, 1, 1,
 '{
   "product_type": "Bracelet",
   "metal_type": "Gold", "metal_colour": "Yellow",
   "purity": "22K (916)",
   "gross_weight": 15.2, "net_weight": 14.5,
   "wastage_pct": 4.83,
   "stone_type": "No Stone",
   "making_charge": 7200,
   "hallmark_huid": "HUID-DR0040",
   "design_no": "MJ-002",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:30:00', '2026-08-14 06:30:00'),

-- 41. Men's Gold Ring 22K
('dr000002-0000-0000-0000-000000000041',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Men''s Signet Ring 22K',
 '22K yellow gold men''s signet ring with flat top. Size 22. BIS hallmarked.',
 72000.00, 63000.00, 58500.00, 14.29,
 'DR-MJ-003', '8901234560041',
 'c1000000-0000-0000-0000-000000000001',
 3, 1, 1,
 '{
   "product_type": "Ring",
   "metal_type": "Gold", "metal_colour": "Yellow",
   "purity": "22K (916)",
   "gross_weight": 7.5, "net_weight": 7.0,
   "wastage_pct": 7.14,
   "stone_type": "No Stone",
   "making_charge": 4500,
   "hallmark_huid": "HUID-DR0041",
   "design_no": "MJ-003",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:30:00', '2026-08-14 06:30:00'),

-- 42. Men's Diamond Ring 18K
('dr000002-0000-0000-0000-000000000042',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Men''s Diamond Ring 18K',
 '18K white gold men''s diamond ring with 0.25ct princess cut centre. IGI certified.',
 88000.00, 77000.00, 71000.00, 14.29,
 'DR-MJ-004', '8901234560042',
 'c1000000-0000-0000-0000-000000000003',
 2, 1, 1,
 '{
   "product_type": "Ring",
   "metal_type": "Gold", "metal_colour": "White",
   "purity": "18K (750)",
   "gross_weight": 8.5, "net_weight": 8.0,
   "stone_type": "Diamond",
   "number_of_stones": 1,
   "stone_weight": 0.25,
   "stone_quality": "G/VS1/VG – Princess Cut",
   "stone_value": 38000,
   "stone_certification": "IGI",
   "certificate_no": "IGI-MR-2026-0042",
   "making_charge": 8000,
   "hallmark_huid": "HUID-DR0042",
   "design_no": "MJ-004",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:30:00', '2026-08-14 06:30:00'),

-- ── CHILDREN'S JEWELLERY ─────────────────────────────────────────────────────

-- 43. Baby Gold Bangle Pair 22K
('dr000002-0000-0000-0000-000000000043',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Baby Bangle Pair 22K (0–2 years)',
 'Lightweight 22K gold baby bangles, pair. Plain smooth finish. BIS hallmarked.',
 18500.00, 16200.00, 15000.00, 14.20,
 'DR-CJ-001', '8901234560043',
 'c1000000-0000-0000-0000-000000000001',
 6, 2, 1,
 '{
   "product_type": "Bangle",
   "metal_type": "Gold", "metal_colour": "Yellow",
   "purity": "22K (916)",
   "gross_weight": 2.0, "net_weight": 1.9,
   "wastage_pct": 5.26,
   "stone_type": "No Stone",
   "making_charge": 900,
   "hallmark_huid": "HUID-DR0043",
   "design_no": "CJ-001",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:30:00', '2026-08-14 06:30:00'),

-- 44. Children's Gold Necklace 22K
('dr000002-0000-0000-0000-000000000044',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Children''s Gold Necklace 22K (3–8 years)',
 '22K gold lightweight chain necklace with small Lakshmi pendant. Perfect gift for children.',
 24500.00, 21500.00, 19900.00, 13.95,
 'DR-CJ-002', '8901234560044',
 'c1000000-0000-0000-0000-000000000001',
 5, 2, 1,
 '{
   "product_type": "Necklace",
   "metal_type": "Gold", "metal_colour": "Yellow",
   "purity": "22K (916)",
   "gross_weight": 2.6, "net_weight": 2.5,
   "wastage_pct": 4.0,
   "stone_type": "No Stone",
   "making_charge": 1500,
   "hallmark_huid": "HUID-DR0044",
   "design_no": "CJ-002",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:30:00', '2026-08-14 06:30:00'),

-- 45. Children's Silver Anklet Pair
('dr000002-0000-0000-0000-000000000045',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Children''s Silver Anklet Pair 925',
 '925 sterling silver anklet pair for children with tiny bells. Lightweight and safe.',
 1200.00, 850.00, 780.00, 41.18,
 'DR-CJ-003', '8901234560045',
 'c1000000-0000-0000-0000-000000000002',
 12, 4, 1,
 '{
   "product_type": "Anklet",
   "metal_type": "Silver",
   "purity": "925 Sterling Silver",
   "gross_weight": 10.0, "net_weight": 9.5,
   "stone_type": "No Stone",
   "making_charge": 150,
   "design_no": "CJ-003",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:30:00', '2026-08-14 06:30:00'),

-- ── GEMSTONE PIECES ───────────────────────────────────────────────────────────

-- 46. Sapphire Necklace 22K
('dr000002-0000-0000-0000-000000000046',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Blue Sapphire Pendant Necklace 22K',
 '22K gold necklace with natural Ceylon blue sapphire pendant (3.5ct). Classic setting.',
 165000.00, 146000.00, 135000.00, 13.01,
 'DR-GM-001', '8901234560046',
 'c1000000-0000-0000-0000-000000000001',
 1, 1, 1,
 '{
   "product_type": "Necklace",
   "metal_type": "Gold", "metal_colour": "Yellow",
   "purity": "22K (916)",
   "gross_weight": 8.2, "net_weight": 7.8,
   "wastage_pct": 5.13,
   "stone_type": "Sapphire",
   "number_of_stones": 1,
   "stone_weight": 3.5,
   "stone_quality": "Ceylon Blue – Natural unheated",
   "stone_value": 65000,
   "making_charge": 7500,
   "hallmark_huid": "HUID-DR0046",
   "design_no": "GM-001",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:30:00', '2026-08-14 06:30:00'),

-- 47. Emerald Earrings 22K
('dr000002-0000-0000-0000-000000000047',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Colombian Emerald Earrings 22K',
 '22K gold drop earrings with natural Colombian emerald drops (2×1.8ct). Oval cut.',
 215000.00, 191000.00, 177000.00, 12.57,
 'DR-GM-002', '8901234560047',
 'c1000000-0000-0000-0000-000000000001',
 1, 1, 1,
 '{
   "product_type": "Earrings",
   "metal_type": "Gold", "metal_colour": "Yellow",
   "purity": "22K (916)",
   "gross_weight": 9.5, "net_weight": 9.0,
   "wastage_pct": 5.56,
   "stone_type": "Emerald",
   "number_of_stones": 2,
   "stone_weight": 3.6,
   "stone_quality": "Colombian – Minor oil, AAA",
   "stone_value": 108000,
   "making_charge": 9500,
   "hallmark_huid": "HUID-DR0047",
   "design_no": "GM-002",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:30:00', '2026-08-14 06:30:00'),

-- 48. Pearl & Gold Necklace
('dr000002-0000-0000-0000-000000000048',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'South Sea Pearl & Gold Necklace 22K',
 '22K gold necklace with 12mm South Sea pearls and gold beads. 18 inches.',
 185000.00, 164000.00, 152000.00, 12.80,
 'DR-GM-003', '8901234560048',
 'c1000000-0000-0000-0000-000000000001',
 1, 1, 1,
 '{
   "product_type": "Necklace",
   "metal_type": "Gold", "metal_colour": "Yellow",
   "purity": "22K (916)",
   "gross_weight": 12.0, "net_weight": 11.5,
   "wastage_pct": 4.35,
   "stone_type": "Pearl",
   "number_of_stones": 18,
   "stone_weight": 0,
   "stone_quality": "South Sea – 12mm AAA lustre",
   "stone_value": 72000,
   "making_charge": 11000,
   "hallmark_huid": "HUID-DR0048",
   "design_no": "GM-003",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:30:00', '2026-08-14 06:30:00'),

-- ── MORE SILVER & PLATINUM ───────────────────────────────────────────────────

-- 49. Silver Toe Ring Pair
('dr000002-0000-0000-0000-000000000049',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Silver Toe Ring Pair 925 (Bichiya)',
 '925 sterling silver traditional toe ring pair (bichiya) with floral motif. Adjustable.',
 480.00, 310.00, 280.00, 54.84,
 'DR-SX-001', '8901234560049',
 'c1000000-0000-0000-0000-000000000002',
 20, 8, 1,
 '{
   "product_type": "Ring",
   "metal_type": "Silver",
   "purity": "925 Sterling Silver",
   "gross_weight": 4.0, "net_weight": 3.8,
   "stone_type": "No Stone",
   "making_charge": 80,
   "design_no": "SX-001",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:30:00', '2026-08-14 06:30:00'),

-- 50. Platinum Couple Bands (Pair)
('dr000002-0000-0000-0000-000000000050',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Platinum Couple Wedding Band Set Pt 950',
 'Matching Pt 950 platinum wedding bands for couple — his (7g) and hers (5g). Comfort fit.',
 78000.00, 69000.00, 63500.00, 13.04,
 'DR-PX-001', '8901234560050',
 'c1000000-0000-0000-0000-000000000004',
 2, 1, 1,
 '{
   "product_type": "Ring",
   "metal_type": "Platinum",
   "purity": "Pt 950",
   "gross_weight": 12.8, "net_weight": 12.2,
   "stone_type": "No Stone",
   "making_charge": 6200,
   "hallmark_huid": "PLAT-DR0050",
   "design_no": "PX-001",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:30:00', '2026-08-14 06:30:00'),

-- ── MORE DIAMOND PIECES ───────────────────────────────────────────────────────

-- 51. Eternity Ring
('dr000002-0000-0000-0000-000000000051',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Full Eternity Diamond Ring 18K',
 '18K white gold full eternity band with 1.0ct round brilliant diamonds (channel set).',
 225000.00, 198000.00, 183000.00, 13.64,
 'DR-DX-001', '8901234560051',
 'c1000000-0000-0000-0000-000000000003',
 1, 1, 1,
 '{
   "product_type": "Ring",
   "metal_type": "Gold", "metal_colour": "White",
   "purity": "18K (750)",
   "gross_weight": 5.8, "net_weight": 5.5,
   "stone_type": "Diamond",
   "number_of_stones": 20,
   "stone_weight": 1.00,
   "stone_quality": "G/VS2/EX – Round Brilliant",
   "stone_value": 135000,
   "stone_certification": "IGI",
   "certificate_no": "IGI-ET-2026-0051",
   "making_charge": 11000,
   "hallmark_huid": "HUID-DR0051",
   "design_no": "DX-001",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:30:00', '2026-08-14 06:30:00'),

-- 52. Diamond Earrings (Drops)
('dr000002-0000-0000-0000-000000000052',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Diamond Drop Earrings 18K Rose Gold',
 '18K rose gold teardrop earrings with 0.60ct pear-shaped diamond drops. GIA certified.',
 178000.00, 157000.00, 145000.00, 13.38,
 'DR-DX-002', '8901234560052',
 'c1000000-0000-0000-0000-000000000003',
 1, 1, 1,
 '{
   "product_type": "Earrings",
   "metal_type": "Gold", "metal_colour": "Rose / Pink",
   "purity": "18K (750)",
   "gross_weight": 5.2, "net_weight": 4.9,
   "stone_type": "Diamond",
   "number_of_stones": 2,
   "stone_weight": 0.60,
   "stone_quality": "F/VS1/EX – Pear Shape",
   "stone_value": 98000,
   "stone_certification": "GIA",
   "certificate_no": "GIA-5678901234",
   "making_charge": 10000,
   "hallmark_huid": "HUID-DR0052",
   "design_no": "DX-002",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:30:00', '2026-08-14 06:30:00'),

-- ── ADDITIONAL GOLD ───────────────────────────────────────────────────────────

-- 53. Gold Coin 8g
('dr000002-0000-0000-0000-000000000053',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Gold Coin 8g 24K (999)',
 '24K 999 fine gold coin, 8 grams. BIS hallmarked. With certificate and gift box.',
 79500.00, 76000.00, 75000.00, 4.61,
 'DR-GCO-001', '8901234560053',
 'c1000000-0000-0000-0000-000000000001',
 10, 3, 1,
 '{
   "product_type": "Other",
   "metal_type": "Gold", "metal_colour": "Yellow",
   "purity": "24K (999)",
   "gross_weight": 8.0, "net_weight": 8.0,
   "stone_type": "No Stone",
   "making_charge": 500,
   "hallmark_huid": "HUID-DR0053",
   "design_no": "GCO-001",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:30:00', '2026-08-14 06:30:00'),

-- 54. Gold Coin 4g
('dr000002-0000-0000-0000-000000000054',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Gold Coin 4g 24K (999)',
 '24K 999 fine gold coin, 4 grams. BIS hallmarked. Popular festival gifting coin.',
 40200.00, 38200.00, 37700.00, 5.24,
 'DR-GCO-002', '8901234560054',
 'c1000000-0000-0000-0000-000000000001',
 15, 5, 1,
 '{
   "product_type": "Other",
   "metal_type": "Gold", "metal_colour": "Yellow",
   "purity": "24K (999)",
   "gross_weight": 4.0, "net_weight": 4.0,
   "stone_type": "No Stone",
   "making_charge": 300,
   "hallmark_huid": "HUID-DR0054",
   "design_no": "GCO-002",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:30:00', '2026-08-14 06:30:00'),

-- 55. Antique Nath (Nose Ring)
('dr000002-0000-0000-0000-000000000055',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Bridal Nath (Nose Ring) 22K',
 '22K gold traditional bridal nath with pearls and red stone. Comes with chain support.',
 32000.00, 28000.00, 25900.00, 14.29,
 'DR-GX-001', '8901234560055',
 'c1000000-0000-0000-0000-000000000001',
 3, 1, 1,
 '{
   "product_type": "Other",
   "metal_type": "Gold", "metal_colour": "Yellow",
   "purity": "22K (916)",
   "gross_weight": 3.5, "net_weight": 3.2,
   "wastage_pct": 9.38,
   "stone_type": "Other",
   "number_of_stones": 5,
   "stone_value": 2500,
   "making_charge": 2800,
   "hallmark_huid": "HUID-DR0055",
   "design_no": "GX-001",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:30:00', '2026-08-14 06:30:00');

-- =============================================================================
-- Done.
-- Diamond Republic extras:
--   Role:        Sales Associate (r1000000-0000-0000-0000-000000000004)
--   Associates:  Priya Sharma, Karthik Raj, Meena Devi
--   Customers:   10 (cust0001-...-000001 through 000010)
--   Suppliers:   3 (Thangam Manufacturing, Gem Palace, Ratna Exports)
--   Products:    20 more (products 36–55: bridal, men's, children's, gemstone, coins)
--   Total products: 55
-- =============================================================================
