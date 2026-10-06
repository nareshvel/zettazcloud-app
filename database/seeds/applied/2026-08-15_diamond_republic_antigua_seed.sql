-- =============================================================================
-- Seed: Diamond Republic — Heritage Quay, St. John's, Antigua & Barbuda
-- Date: 2026-08-15
-- Re-seed after running 2026-08-15_teardown_diamond_republic.sql
--
-- Org details:
--   Name      : Diamond Republic
--   Address   : #100 Heritage Quay, St. John's, Antigua and Barbuda
--   Currency  : USD   |  Tax: ABST 15%
--   Date fmt  : DD/MM/YYYY  |  TZ: America/Antigua (UTC-4)
--   Weight    : grams (g)
--
-- Key UUIDs:
--   Tenant  : e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c
--   Store   : a1b2c3d4-e5f6-7890-abcd-ef1234567890
--   Admin   : b1c2d3e4-f5a6-7890-bcde-f12345678901
--   Login   : admin@diamondrepublic.in  / same password hash as before
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TENANT
-- ─────────────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO `tenants`
  (`id`, `name`, `domain`, `industry_code`, `settings`, `created_at`, `updated_at`)
VALUES (
  'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
  'Diamond Republic',
  'diamondrepublic.ag',
  'jewelry',
  '{"allow_negative_stock": false, "businessType": "jewelry", "country": "AG"}',
  '2026-08-15 10:00:00',
  '2026-08-15 10:00:00'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. STORE
-- ─────────────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO `stores`
  (`id`, `tenant_id`, `name`, `address`, `phone`, `email`,
   `tax_rate`, `currency_code`, `language_code`, `country_code`,
   `date_format`, `time_format`, `timezone`, `number_format`,
   `decimal_precision`, `locale_code`, `measurement_system`,
   `allow_negative_stock`, `allow_over_receiving`,
   `discount_application_rule`, `default_tax_basis`,
   `tax_config`, `theme`, `is_active`, `created_at`, `updated_at`)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
  'Diamond Republic – Heritage Quay',
  '#100 Heritage Quay, St. John''s, Antigua and Barbuda',
  '+1 268 562 4488',
  'sales@diamondrepublic.ag',
  15.00,       -- ABST (Antigua & Barbuda Sales Tax) = 15%
  'USD',
  'en',
  'AG',
  'DD/MM/YYYY',
  'hh:mm A',
  'America/Antigua',
  '1,234.56',  -- standard US format
  2,
  'en-AG',
  'metric',
  0,
  0,
  'BEFORE_TAX',
  'EXCLUSIVE',
  '{"rules": [], "default_rate": 0.15, "tax_name": "ABST"}',
  'light',
  1,
  '2026-08-15 10:00:00',
  '2026-08-15 10:00:00'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ADMIN USER
-- ─────────────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO `users`
  (`id`, `tenant_id`, `store_id`, `name`, `email`, `phone_number`,
   `password_hash`, `is_active`, `email_verified`, `signup_completed`,
   `created_at`, `updated_at`)
VALUES (
  'b1c2d3e4-f5a6-7890-bcde-f12345678901',
  'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Michael Thompson',
  'admin@diamondrepublic.in',
  '+1 268 562 4488',
  '$2a$12$z.PB2zdDXrzO0zQ3NcwQAOG0dKWis1c6A.CeKWwLheAfoYZ3wv.J2',
  1, 1, 1,
  '2026-08-15 10:00:00', '2026-08-15 10:00:00'
);

-- Staff users
INSERT IGNORE INTO `users`
  (`id`, `tenant_id`, `store_id`, `name`, `email`, `phone_number`,
   `password_hash`, `is_active`, `email_verified`, `signup_completed`,
   `created_at`, `updated_at`)
VALUES
  ('u3000000-0000-0000-0000-000000000001',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Sharon Thomas', 'sharon@diamondrepublic.ag', '+1 268 720 1001',
   '$2a$12$z.PB2zdDXrzO0zQ3NcwQAOG0dKWis1c6A.CeKWwLheAfoYZ3wv.J2',
   1, 1, 1, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),

  ('u3000000-0000-0000-0000-000000000002',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Kezia Williams', 'kezia@diamondrepublic.ag', '+1 268 720 1002',
   '$2a$12$z.PB2zdDXrzO0zQ3NcwQAOG0dKWis1c6A.CeKWwLheAfoYZ3wv.J2',
   1, 1, 1, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),

  ('u3000000-0000-0000-0000-000000000003',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Marcus Joseph', 'marcus@diamondrepublic.ag', '+1 268 720 1003',
   '$2a$12$z.PB2zdDXrzO0zQ3NcwQAOG0dKWis1c6A.CeKWwLheAfoYZ3wv.J2',
   1, 1, 1, '2026-08-15 10:00:00', '2026-08-15 10:00:00');

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ROLES & RBAC
-- ─────────────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO `roles`
  (`id`, `tenant_id`, `name`, `description`, `is_system_role`, `created_by`)
VALUES
  ('r1000000-0000-0000-0000-000000000001',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'Tenant Admin', 'Full tenant administrative access', 1,
   'b1c2d3e4-f5a6-7890-bcde-f12345678901'),
  ('r1000000-0000-0000-0000-000000000002',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'Store Manager', 'Full store management access', 1,
   'b1c2d3e4-f5a6-7890-bcde-f12345678901'),
  ('r1000000-0000-0000-0000-000000000003',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'Cashier', 'POS, sales and customer management', 1,
   'b1c2d3e4-f5a6-7890-bcde-f12345678901'),
  ('r1000000-0000-0000-0000-000000000004',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'Sales Associate', 'Floor sales — POS, customers, products', 0,
   'b1c2d3e4-f5a6-7890-bcde-f12345678901');

-- Admin → all permissions
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT 'r1000000-0000-0000-0000-000000000001', `id` FROM `permissions`;

-- Manager → all except system admin permissions
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT 'r1000000-0000-0000-0000-000000000002', `id` FROM `permissions`
WHERE `name` NOT IN ('users.delete','roles.manage','settings.delete','subscriptions.manage');

-- Cashier → sales + inventory view
-- ('dashboard.view' intentionally absent — see migration
-- 2026-09-03_remove_dashboard_view_from_cashier_roles.sql)
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT 'r1000000-0000-0000-0000-000000000003', `id` FROM `permissions`
WHERE `name` IN (
  'products.view','categories.view','inventory.view',
  'sales.view','sales.create','customers.view','customers.create','customers.edit',
  'repairs.view','repairs.create','layaway.view','layaway.create'
);

-- Sales Associate → same as Cashier
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT 'r1000000-0000-0000-0000-000000000004', `id` FROM `permissions`
WHERE `name` IN (
  'products.view','categories.view','inventory.view',
  'sales.view','sales.create','customers.view','customers.create','customers.edit',
  'repairs.view','repairs.create','layaway.view','layaway.create'
);

-- Assign roles
INSERT IGNORE INTO `user_roles`
  (`id`, `user_id`, `role_id`, `scope`, `assigned_by`, `created_at`, `updated_at`)
VALUES
  ('ur200000-0000-0000-0000-000000000001',
   'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   'r1000000-0000-0000-0000-000000000001',
   'tenant', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-15 10:00:00', '2026-08-15 10:00:00');

INSERT IGNORE INTO `user_roles`
  (`id`, `user_id`, `role_id`, `store_id`, `scope`, `assigned_by`, `created_at`, `updated_at`)
VALUES
  ('ur200000-0000-0000-0000-000000000002',
   'u3000000-0000-0000-0000-000000000001',
   'r1000000-0000-0000-0000-000000000002',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'store', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-15 10:00:00', '2026-08-15 10:00:00'),

  ('ur200000-0000-0000-0000-000000000003',
   'u3000000-0000-0000-0000-000000000002',
   'r1000000-0000-0000-0000-000000000004',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'store', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-15 10:00:00', '2026-08-15 10:00:00'),

  ('ur200000-0000-0000-0000-000000000004',
   'u3000000-0000-0000-0000-000000000003',
   'r1000000-0000-0000-0000-000000000004',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'store', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-15 10:00:00', '2026-08-15 10:00:00');

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. PRICING SETTINGS
-- ─────────────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO `tenant_pricing_settings`
  (`tenant_id`, `weight_pricing_enabled`,
   `default_making_charge_type`, `default_making_charge_value`, `default_wastage_pct`,
   `market_rate_api_key`, `market_rate_local_premium_pct`,
   `market_rate_auto_publish`, `market_rate_fetch_time`, `weight_unit`)
VALUES (
  'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
  1,           -- weight pricing ON (Caribbean jewelry store prices by weight)
  'per_gram', 12.00, 2.00,
  NULL,        -- goldapi.io key to be configured in Settings
  2.50,        -- 2.5% local premium over spot (Caribbean import duty)
  0, '09:00',
  'g'          -- grams
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. EMPLOYEES
-- ─────────────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO `employees`
  (`id`, `tenant_id`, `store_id`, `user_id`,
   `employee_code`, `first_name`, `last_name`, `email`, `phone`,
   `job_title`, `commission_pct`, `is_sales_staff`, `is_active`,
   `created_at`, `updated_at`)
VALUES
  ('e4000000-0000-0000-0000-000000000001',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   'EMP-001', 'Michael', 'Thompson', 'admin@diamondrepublic.in', '+1 268 562 4488',
   'Owner / Director', 0.00, 0, 1,
   '2026-08-15 10:00:00', '2026-08-15 10:00:00'),

  ('e4000000-0000-0000-0000-000000000002',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'u3000000-0000-0000-0000-000000000001',
   'EMP-002', 'Sharon', 'Thomas', 'sharon@diamondrepublic.ag', '+1 268 720 1001',
   'Store Manager', 2.00, 1, 1,
   '2026-08-15 10:00:00', '2026-08-15 10:00:00'),

  ('e4000000-0000-0000-0000-000000000003',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'u3000000-0000-0000-0000-000000000002',
   'EMP-003', 'Kezia', 'Williams', 'kezia@diamondrepublic.ag', '+1 268 720 1002',
   'Senior Sales Associate', 3.00, 1, 1,
   '2026-08-15 10:00:00', '2026-08-15 10:00:00'),

  ('e4000000-0000-0000-0000-000000000004',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'u3000000-0000-0000-0000-000000000003',
   'EMP-004', 'Marcus', 'Joseph', 'marcus@diamondrepublic.ag', '+1 268 720 1003',
   'Sales Associate', 2.50, 1, 1,
   '2026-08-15 10:00:00', '2026-08-15 10:00:00');

-- Sales targets (Aug 2026)
INSERT IGNORE INTO `employee_sales_targets`
  (`id`, `tenant_id`, `employee_id`,
   `period_type`, `period_start`, `period_end`,
   `target_amount`, `incentive_pct`, `bonus_flat`)
VALUES
  ('est00001-0000-0000-0000-000000000001',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'e4000000-0000-0000-0000-000000000002',
   'monthly', '2026-08-01', '2026-08-31', 35000.00, 2.00, NULL),

  ('est00001-0000-0000-0000-000000000002',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'e4000000-0000-0000-0000-000000000003',
   'monthly', '2026-08-01', '2026-08-31', 25000.00, 3.00, NULL),

  ('est00001-0000-0000-0000-000000000003',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'e4000000-0000-0000-0000-000000000004',
   'monthly', '2026-08-01', '2026-08-31', 20000.00, 2.50, NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. SUPPLIERS
-- ─────────────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO `suppliers`
  (`id`, `tenant_id`, `supplier_name`, `contact_person`, `email`, `phone`,
   `address_line1`, `city`, `state_province`, `postal_code`, `country`,
   `tax_id`, `default_payment_terms`, `notes`, `is_active`,
   `created_by_user_id`, `updated_by_user_id`, `created_at`, `updated_at`)
VALUES
  ('s2000000-0000-0000-0000-000000000001',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'Caribbean Diamond Supply Ltd.',
   'Devon Charles',
   'devon@caribdiamonds.ag', '+1 268 460 9001',
   'Vendors Mall, Woods Centre', 'St. John''s', 'Saint John', NULL, 'Antigua and Barbuda',
   NULL, 'Net 30',
   'Local diamond and gemstone supplier. Supplies GIA/IGI certified stones. Offers memo/consignment terms.',
   1, 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-15 10:00:00', '2026-08-15 10:00:00'),

  ('s2000000-0000-0000-0000-000000000002',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'Miami Jewelry Wholesale Inc.',
   'Roberto Alvarez',
   'roberto@miamijewelrywholesale.com', '+1 305 555 0182',
   '100 NW 5th Ave, Suite 400', 'Miami', 'Florida', '33128', 'United States',
   '65-4321987', 'Net 45',
   'Primary gold and diamond supplier. Ships overnight to Antigua. Minimum order $5,000.',
   1, 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-15 10:00:00', '2026-08-15 10:00:00'),

  ('s2000000-0000-0000-0000-000000000003',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'Orient Pearl & Gemstone Co.',
   'Chen Wei-Ming',
   'weiming@orientpearl.com.tw', '+886 2 2345 6789',
   '88 Zhongshan N. Road, Section 3', 'Taipei', NULL, '104', 'Taiwan',
   NULL, 'T/T 30 days prior to shipment',
   'Supplies South Sea, Tahitian and Akoya pearls. Freshwater pearl strands also available.',
   1, 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-15 10:00:00', '2026-08-15 10:00:00');

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. CATEGORIES
-- ─────────────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO `categories`
  (`id`, `tenant_id`, `name`, `description`, `is_active`,
   `created_by_user_id`, `updated_by_user_id`, `created_at`, `updated_at`)
VALUES
  ('c2000000-0000-0000-0000-000000000001',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'Gold Jewelry',
   '14K and 18K gold pieces — chains, bangles, earrings, pendants, rings',
   1, 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-15 10:00:00', '2026-08-15 10:00:00'),

  ('c2000000-0000-0000-0000-000000000002',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'Diamond Jewelry',
   'GIA / IGI certified diamond rings, bracelets, pendants and earrings',
   1, 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-15 10:00:00', '2026-08-15 10:00:00'),

  ('c2000000-0000-0000-0000-000000000003',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'Pearl & Gemstone',
   'South Sea, Tahitian, Akoya pearls and aquamarine, topaz, emerald pieces',
   1, 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-15 10:00:00', '2026-08-15 10:00:00'),

  ('c2000000-0000-0000-0000-000000000004',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'Silver Jewelry',
   '925 sterling silver — Caribbean motifs, CZ, turquoise and plain pieces',
   1, 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-15 10:00:00', '2026-08-15 10:00:00'),

  ('c2000000-0000-0000-0000-000000000005',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'Men''s Collection',
   'Men''s 14K gold chains, bracelets, signet rings and platinum wedding bands',
   1, 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-15 10:00:00', '2026-08-15 10:00:00');


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. PRODUCTS (35 Caribbean-style items)
-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers: T = tenant, S = store
SET @T = 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c';
SET @S = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
SET @U = 'b1c2d3e4-f5a6-7890-bcde-f12345678901';

-- ── GOLD JEWELRY (cat 1) ─────────────────────────────────────────────────────
-- Column mapping: cost_price = supplier cost, price = selling price,
--                low_stock_threshold = reorder point
INSERT IGNORE INTO `products`
  (`id`, `tenant_id`, `store_id`, `category_id`, `name`, `sku`,
   `description`, `cost_price`, `price`,
   `stock_quantity`, `low_stock_threshold`, `total_quantity_received`, `is_active`,
   `attributes`,
   `created_by_user_id`, `created_at`, `updated_at`)
VALUES
  ('dr200001-0000-0000-0000-000000000001', @T, @S,
   'c2000000-0000-0000-0000-000000000001',
   '18K Gold Rope Chain Necklace 22"', 'GC-18K-001',
   'Classic 18K yellow gold rope chain, 22 inch, 4mm width. Lobster clasp. Made in Italy.',
   820.00, 1150.00, 5, 2, 5, 1,
   '{"metal":"Gold","purity":"18K","weight_grams":9.2,"clasp":"Lobster","length_inches":22,"width_mm":4}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('dr200001-0000-0000-0000-000000000002', @T, @S,
   'c2000000-0000-0000-0000-000000000001',
   '14K Gold Figaro Chain Bracelet 7.5"', 'GC-14K-002',
   'Classic Figaro-link bracelet in 14K yellow gold. 7.5 inch, 3mm width.',
   340.00, 490.00, 8, 3, 8, 1,
   '{"metal":"Gold","purity":"14K","weight_grams":4.8,"clasp":"Box","length_inches":7.5,"width_mm":3}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('dr200001-0000-0000-0000-000000000003', @T, @S,
   'c2000000-0000-0000-0000-000000000001',
   '18K Gold Hoop Earrings 30mm', 'GE-18K-003',
   'Polished 18K yellow gold hoops, 30mm diameter. Hinged snap closure.',
   580.00, 820.00, 6, 2, 6, 1,
   '{"metal":"Gold","purity":"18K","weight_grams":6.1,"diameter_mm":30,"style":"Hoop"}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('dr200001-0000-0000-0000-000000000004', @T, @S,
   'c2000000-0000-0000-0000-000000000001',
   '14K Gold Caribbean Sun Pendant', 'GP-14K-004',
   '14K gold sun pendant with radiant design, inspired by Caribbean sunsets. 18mm disc.',
   260.00, 385.00, 10, 3, 10, 1,
   '{"metal":"Gold","purity":"14K","weight_grams":3.2,"style":"Pendant","theme":"Caribbean Sun"}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('dr200001-0000-0000-0000-000000000005', @T, @S,
   'c2000000-0000-0000-0000-000000000001',
   '18K Gold Bangle Bracelet Plain', 'GB-18K-005',
   'Smooth polished 18K yellow gold oval bangle. 62mm inner diameter. 4mm wide.',
   920.00, 1320.00, 4, 2, 4, 1,
   '{"metal":"Gold","purity":"18K","weight_grams":11.4,"inner_diameter_mm":62,"width_mm":4,"style":"Bangle"}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('dr200001-0000-0000-0000-000000000006', @T, @S,
   'c2000000-0000-0000-0000-000000000001',
   '14K Gold Stud Earrings – Pearl Drop', 'GE-14K-006',
   '14K yellow gold studs with 7mm freshwater pearl drop. Butterfly backs.',
   185.00, 275.00, 12, 4, 12, 1,
   '{"metal":"Gold","purity":"14K","weight_grams":1.8,"stone":"Freshwater Pearl","stone_size_mm":7}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('dr200001-0000-0000-0000-000000000007', @T, @S,
   'c2000000-0000-0000-0000-000000000001',
   '18K Gold Twisted Rope Ring', 'GR-18K-007',
   'Twisted rope-design band in 18K yellow gold. Available sizes 5-10. Weight shown for size 7.',
   420.00, 620.00, 7, 2, 7, 1,
   '{"metal":"Gold","purity":"18K","weight_grams":5.3,"style":"Band","design":"Twisted Rope","size":7}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


-- ── DIAMOND JEWELRY (cat 2) ───────────────────────────────────────────────────
  ('dr200001-0000-0000-0000-000000000008', @T, @S,
   'c2000000-0000-0000-0000-000000000002',
   '18K Gold Diamond Solitaire Ring – 0.75ct', 'DR-18K-001',
   '18K white gold four-prong solitaire. 0.75ct round brilliant, H color, VS2 clarity. GIA certified.',
   3200.00, 4800.00, 2, 1, 2, 1,
   '{"metal":"Gold","purity":"18K","metal_color":"White","weight_grams":3.8,"stone":"Diamond","stone_carat":0.75,"clarity":"VS2","color":"H","cut":"Excellent","certificate":"GIA","style":"Solitaire"}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('dr200001-0000-0000-0000-000000000009', @T, @S,
   'c2000000-0000-0000-0000-000000000002',
   '18K Gold Diamond Halo Engagement Ring – 1.0ct', 'DR-18K-002',
   '18K white gold halo engagement ring. 1.0ct round brilliant centre, H-I color, SI1. IGI certified.',
   5800.00, 8500.00, 1, 1, 1, 1,
   '{"metal":"Gold","purity":"18K","metal_color":"White","weight_grams":4.5,"stone":"Diamond","stone_carat":1.00,"clarity":"SI1","color":"H","cut":"Very Good","certificate":"IGI","style":"Halo"}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('dr200001-0000-0000-0000-000000000010', @T, @S,
   'c2000000-0000-0000-0000-000000000002',
   '14K Gold Diamond Tennis Bracelet 2.0ct', 'DB-14K-001',
   '14K white gold 4-prong channel-set tennis bracelet. Total 2.0ctw round diamonds, G-H/SI.',
   4200.00, 6200.00, 2, 1, 2, 1,
   '{"metal":"Gold","purity":"14K","metal_color":"White","weight_grams":10.2,"stone":"Diamond","stone_carat_total":2.00,"clarity":"SI","color":"G-H","style":"Tennis Bracelet","length_inches":7}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('dr200001-0000-0000-0000-000000000011', @T, @S,
   'c2000000-0000-0000-0000-000000000002',
   '18K Gold Diamond Stud Earrings 0.5ct tw', 'DE-18K-001',
   '18K white gold 4-prong diamond studs. Total 0.50ctw, H-I color, SI1-SI2. Screw-back posts.',
   1800.00, 2650.00, 4, 2, 4, 1,
   '{"metal":"Gold","purity":"18K","metal_color":"White","weight_grams":2.1,"stone":"Diamond","stone_carat_total":0.50,"clarity":"SI1-SI2","color":"H-I","style":"Stud"}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('dr200001-0000-0000-0000-000000000012', @T, @S,
   'c2000000-0000-0000-0000-000000000002',
   '18K Rose Gold Diamond Crossover Ring – 0.30ct', 'DR-18K-003',
   '18K rose gold bypass/crossover ring with 0.30ctw pave diamonds. Modern Caribbean design.',
   1250.00, 1850.00, 3, 1, 3, 1,
   '{"metal":"Gold","purity":"18K","metal_color":"Rose","weight_grams":3.2,"stone":"Diamond","stone_carat_total":0.30,"clarity":"VS","color":"G","style":"Bypass"}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('dr200001-0000-0000-0000-000000000013', @T, @S,
   'c2000000-0000-0000-0000-000000000002',
   '14K Gold Diamond Pendant – 0.25ct Teardrop', 'DP-14K-001',
   '14K yellow gold teardrop diamond pendant. 0.25ct pear-shape, F-G color, SI1.',
   680.00, 980.00, 5, 2, 5, 1,
   '{"metal":"Gold","purity":"14K","metal_color":"Yellow","weight_grams":2.0,"stone":"Diamond","stone_carat":0.25,"stone_shape":"Pear","clarity":"SI1","color":"F-G","style":"Teardrop Pendant"}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


-- ── PEARL & GEMSTONE (cat 3) ──────────────────────────────────────────────────
  ('dr200001-0000-0000-0000-000000000014', @T, @S,
   'c2000000-0000-0000-0000-000000000003',
   'South Sea Pearl Strand Necklace 18"', 'PN-SS-001',
   'Graduated South Sea pearl strand, 9-11mm, white with silver/rose overtone. 18K gold clasp.',
   1800.00, 2800.00, 3, 1, 3, 1,
   '{"pearl_type":"South Sea","pearl_size_mm":"9-11","length_inches":18,"luster":"High","overtone":"Silver/Rose","clasp":"18K Gold"}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('dr200001-0000-0000-0000-000000000015', @T, @S,
   'c2000000-0000-0000-0000-000000000003',
   'Tahitian Pearl Drop Earrings – 10mm', 'PE-TP-001',
   'Tahitian black pearl drop earrings, 10mm round, peacock overtone. 18K white gold hooks.',
   760.00, 1100.00, 4, 2, 4, 1,
   '{"pearl_type":"Tahitian","pearl_size_mm":10,"overtone":"Peacock","metal":"18K White Gold","style":"Drop"}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('dr200001-0000-0000-0000-000000000016', @T, @S,
   'c2000000-0000-0000-0000-000000000003',
   '14K Gold Aquamarine & Diamond Ring', 'GR-AQ-001',
   '14K white gold ring, 2.5ct oval aquamarine centre, 0.12ctw diamond halo. Caribbean blue.',
   880.00, 1280.00, 4, 2, 4, 1,
   '{"metal":"Gold","purity":"14K","metal_color":"White","weight_grams":3.6,"stone":"Aquamarine","stone_carat":2.50,"stone_shape":"Oval","accent_stone":"Diamond","accent_carat":0.12}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('dr200001-0000-0000-0000-000000000017', @T, @S,
   'c2000000-0000-0000-0000-000000000003',
   '18K Gold Blue Topaz Pendant – Caribbean Sea', 'GP-BT-001',
   '18K yellow gold pendant with 4ct Swiss blue topaz drop. Inspired by Antigua''s waters.',
   540.00, 780.00, 6, 2, 6, 1,
   '{"metal":"Gold","purity":"18K","weight_grams":3.8,"stone":"Blue Topaz","stone_type":"Swiss Blue","stone_carat":4.00,"stone_shape":"Pear","theme":"Caribbean Sea"}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('dr200001-0000-0000-0000-000000000018', @T, @S,
   'c2000000-0000-0000-0000-000000000003',
   'Akoya Pearl Stud Earrings 7.5mm', 'PE-AK-001',
   '7.5mm round Akoya pearl studs with 14K yellow gold butterfly posts. AAA quality.',
   280.00, 420.00, 8, 3, 8, 1,
   '{"pearl_type":"Akoya","pearl_size_mm":7.5,"grade":"AAA","metal":"14K Yellow Gold","style":"Stud"}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('dr200001-0000-0000-0000-000000000019', @T, @S,
   'c2000000-0000-0000-0000-000000000003',
   '14K Gold Emerald & Diamond Earrings', 'GE-EM-001',
   '14K yellow gold lever-back earrings with 0.80ctw oval emerald and 0.08ctw diamond accent.',
   720.00, 1050.00, 3, 1, 3, 1,
   '{"metal":"Gold","purity":"14K","metal_color":"Yellow","stone":"Emerald","stone_carat_total":0.80,"stone_shape":"Oval","accent_stone":"Diamond","accent_carat":0.08}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('dr200001-0000-0000-0000-000000000020', @T, @S,
   'c2000000-0000-0000-0000-000000000003',
   'Freshwater Pearl & Aquamarine Bracelet', 'PB-FW-001',
   'Stretch bracelet with 8mm freshwater pearls and faceted aquamarine beads. 14K gold spacers.',
   195.00, 290.00, 10, 4, 10, 1,
   '{"pearl_type":"Freshwater","pearl_size_mm":8,"accent_stone":"Aquamarine","metal":"14K Gold","style":"Stretch Bracelet"}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


-- ── SILVER JEWELRY (cat 4) ────────────────────────────────────────────────────
  ('dr200001-0000-0000-0000-000000000021', @T, @S,
   'c2000000-0000-0000-0000-000000000004',
   '925 Silver Sea Turtle Pendant', 'SP-SEA-001',
   'Handcrafted 925 sterling silver sea turtle pendant. Caribbean motif. 28mm wide.',
   38.00, 68.00, 20, 6, 20, 1,
   '{"metal":"Silver","purity":"925","weight_grams":5.2,"theme":"Sea Turtle","width_mm":28,"finish":"Oxidized"}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('dr200001-0000-0000-0000-000000000022', @T, @S,
   'c2000000-0000-0000-0000-000000000004',
   '925 Silver Starfish Earrings with CZ', 'SE-SEA-001',
   '925 silver starfish stud earrings with clear CZ accents. 15mm.',
   22.00, 42.00, 25, 8, 25, 1,
   '{"metal":"Silver","purity":"925","weight_grams":3.1,"theme":"Starfish","stone":"CZ","size_mm":15}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('dr200001-0000-0000-0000-000000000023', @T, @S,
   'c2000000-0000-0000-0000-000000000004',
   '925 Silver Conch Shell Bracelet', 'SB-SEA-001',
   '925 silver charm bracelet with conch shell, anchor and palm tree charms. Caribbean souvenir.',
   55.00, 95.00, 15, 5, 15, 1,
   '{"metal":"Silver","purity":"925","weight_grams":8.4,"theme":"Caribbean","charms":["Conch Shell","Anchor","Palm Tree"],"length_inches":7.5}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('dr200001-0000-0000-0000-000000000024', @T, @S,
   'c2000000-0000-0000-0000-000000000004',
   '925 Silver & Turquoise Cuff Bracelet', 'SB-TQ-001',
   'Open cuff bracelet in 925 silver with inlaid turquoise stone. Adjustable. 18mm wide.',
   75.00, 130.00, 10, 3, 10, 1,
   '{"metal":"Silver","purity":"925","weight_grams":14.2,"stone":"Turquoise","width_mm":18,"style":"Open Cuff"}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('dr200001-0000-0000-0000-000000000025', @T, @S,
   'c2000000-0000-0000-0000-000000000004',
   '925 Silver Dolphin Ring', 'SR-SEA-001',
   'Leaping dolphin band ring in 925 sterling silver. Polished finish.',
   28.00, 52.00, 18, 6, 18, 1,
   '{"metal":"Silver","purity":"925","weight_grams":4.1,"theme":"Dolphin","style":"Band Ring"}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('dr200001-0000-0000-0000-000000000026', @T, @S,
   'c2000000-0000-0000-0000-000000000004',
   '925 Silver Hoop Earrings 40mm', 'SE-HP-001',
   'Plain polished 925 sterling silver hoops. 40mm diameter. Hinged click-in closure.',
   32.00, 58.00, 22, 7, 22, 1,
   '{"metal":"Silver","purity":"925","weight_grams":5.6,"diameter_mm":40,"style":"Hoop"}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('dr200001-0000-0000-0000-000000000027', @T, @S,
   'c2000000-0000-0000-0000-000000000004',
   '925 Silver & Blue Topaz Pendant', 'SP-BT-001',
   'Pear-shaped blue topaz pendant, 2ct, bezel-set in 925 sterling silver. Budget-friendly alternative.',
   85.00, 145.00, 14, 5, 14, 1,
   '{"metal":"Silver","purity":"925","weight_grams":3.8,"stone":"Blue Topaz","stone_carat":2.00,"stone_shape":"Pear","setting":"Bezel"}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


-- ── MEN'S COLLECTION (cat 5) ──────────────────────────────────────────────────
  ('dr200001-0000-0000-0000-000000000028', @T, @S,
   'c2000000-0000-0000-0000-000000000005',
   '14K Gold Cuban Link Chain – 24" 6mm', 'MC-14K-001',
   'Solid 14K yellow gold Cuban link chain. 24 inch, 6mm width. Lobster clasp. Men''s signature piece.',
   2800.00, 3900.00, 3, 1, 3, 1,
   '{"metal":"Gold","purity":"14K","weight_grams":32.5,"length_inches":24,"width_mm":6,"style":"Cuban Link","clasp":"Lobster"}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('dr200001-0000-0000-0000-000000000029', @T, @S,
   'c2000000-0000-0000-0000-000000000005',
   '14K Gold Men''s Signet Ring', 'MR-14K-001',
   'Classic men''s signet ring in 14K yellow gold. Flat top 14x12mm, engravable. Size 10.',
   580.00, 840.00, 5, 2, 5, 1,
   '{"metal":"Gold","purity":"14K","weight_grams":8.6,"style":"Signet","top_mm":"14x12","size":10,"engravable":true}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('dr200001-0000-0000-0000-000000000030', @T, @S,
   'c2000000-0000-0000-0000-000000000005',
   '14K Gold Men''s Bracelet – Miami Cuban 8"', 'MB-14K-001',
   'Men''s 14K yellow gold Miami Cuban link bracelet. 8 inch, 8mm. Box lock with double safety.',
   1480.00, 2100.00, 4, 2, 4, 1,
   '{"metal":"Gold","purity":"14K","weight_grams":18.2,"length_inches":8,"width_mm":8,"style":"Miami Cuban","clasp":"Box Lock"}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('dr200001-0000-0000-0000-000000000031', @T, @S,
   'c2000000-0000-0000-0000-000000000005',
   'Platinum Men''s Wedding Band 6mm', 'MR-PT-001',
   'Comfort-fit men''s wedding band in Pt950 platinum. 6mm wide, flat matte finish.',
   1200.00, 1650.00, 4, 2, 4, 1,
   '{"metal":"Platinum","purity":"950","weight_grams":14.8,"width_mm":6,"style":"Wedding Band","finish":"Matte","size":10}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('dr200001-0000-0000-0000-000000000032', @T, @S,
   'c2000000-0000-0000-0000-000000000005',
   '18K Gold Men''s Diamond Ring 0.25ct', 'MR-18K-DM',
   '18K yellow gold men''s channel-set diamond band. 0.25ctw, H-I/SI. 8mm wide.',
   1100.00, 1580.00, 3, 1, 3, 1,
   '{"metal":"Gold","purity":"18K","weight_grams":9.8,"width_mm":8,"stone":"Diamond","stone_carat_total":0.25,"clarity":"SI","color":"H-I","style":"Channel Set Band"}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('dr200001-0000-0000-0000-000000000033', @T, @S,
   'c2000000-0000-0000-0000-000000000005',
   '925 Silver Men''s Anchor Cuff Bracelet', 'MB-SL-001',
   'Men''s heavy 925 silver open cuff with embossed anchor motif. 20mm wide. Caribbean nautical style.',
   95.00, 165.00, 8, 3, 8, 1,
   '{"metal":"Silver","purity":"925","weight_grams":28.5,"theme":"Anchor/Nautical","width_mm":20,"style":"Cuff"}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  -- 2 more (35 total)
  ('dr200001-0000-0000-0000-000000000034', @T, @S,
   'c2000000-0000-0000-0000-000000000001',
   '14K Gold Infinity Necklace 18"', 'GN-14K-007',
   '14K yellow gold infinity symbol pendant on a 1mm box chain. 18 inch. Delicate everyday wear.',
   180.00, 265.00, 12, 4, 12, 1,
   '{"metal":"Gold","purity":"14K","weight_grams":2.6,"symbol":"Infinity","length_inches":18,"style":"Pendant Necklace"}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('dr200001-0000-0000-0000-000000000035', @T, @S,
   'c2000000-0000-0000-0000-000000000002',
   '18K Gold Diamond Eternity Band 0.50ct', 'DR-18K-ETB',
   '18K white gold full eternity band, 0.50ctw round diamonds, G-H/VS2. 2mm wide.',
   2100.00, 3100.00, 2, 1, 2, 1,
   '{"metal":"Gold","purity":"18K","metal_color":"White","weight_grams":3.0,"stone":"Diamond","stone_carat_total":0.50,"clarity":"VS2","color":"G-H","style":"Eternity Band","width_mm":2}',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00');


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. SERIALIZED PIECES (4 serialized products → product_piece_sequences + product_pieces)
--     Products: dr…008 (solitaire), dr…009 (halo), dr…010 (tennis), dr…028 (Cuban chain)
-- ─────────────────────────────────────────────────────────────────────────────
-- product_piece_sequences is a simple tenant-level counter (not per-product)
INSERT IGNORE INTO `product_piece_sequences` (`tenant_id`, `last_value`)
VALUES ('e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c', 9);

-- Solitaire pieces (3 available + 1 sold)
INSERT IGNORE INTO `product_pieces`
  (`id`, `tenant_id`, `store_id`, `product_id`,
   `piece_code`, `barcode`, `status`,
   `gross_weight`, `net_weight`, `purity`,
   `purchase_price`, `cost_price`, `selling_price`,
   `cost_code`, `attributes`, `notes`,
   `created_by_user_id`, `created_at`, `updated_at`)
VALUES
  ('pp000001-0000-0000-0000-000000000001', @T, @S,
   'dr200001-0000-0000-0000-000000000008',
   'DR-SOL-0001', '4001000000001', 'available',
   3.85, 3.85, '18K', 3200.00, 3200.00, 4800.00,
   'ABF2G', '{"cert_no":"GIA-2406783411","color":"H","clarity":"VS2","cut":"Excellent","carat":0.75}',
   'GIA certificate on file.',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('pp000001-0000-0000-0000-000000000002', @T, @S,
   'dr200001-0000-0000-0000-000000000008',
   'DR-SOL-0002', '4001000000002', 'available',
   3.78, 3.78, '18K', 3250.00, 3250.00, 4900.00,
   'ABF3H', '{"cert_no":"GIA-2406783412","color":"G","clarity":"VS1","cut":"Excellent","carat":0.75}',
   'Upgraded colour vs price.',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('pp000001-0000-0000-0000-000000000003', @T, @S,
   'dr200001-0000-0000-0000-000000000008',
   'DR-SOL-0003', '4001000000003', 'available',
   3.82, 3.82, '18K', 3180.00, 3180.00, 4750.00,
   'ABE9F', '{"cert_no":"GIA-2406783413","color":"I","clarity":"VS2","cut":"Very Good","carat":0.75}',
   NULL,
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00');

-- Halo engagement ring pieces (1 available)
INSERT IGNORE INTO `product_pieces`
  (`id`, `tenant_id`, `store_id`, `product_id`,
   `piece_code`, `barcode`, `status`,
   `gross_weight`, `net_weight`, `purity`,
   `purchase_price`, `cost_price`, `selling_price`,
   `cost_code`, `attributes`, `notes`,
   `created_by_user_id`, `created_at`, `updated_at`)
VALUES
  ('pp000001-0000-0000-0000-000000000004', @T, @S,
   'dr200001-0000-0000-0000-000000000009',
   'DR-HAL-0001', '4001000000004', 'available',
   4.52, 4.52, '18K', 5800.00, 5800.00, 8500.00,
   'ACG4J', '{"cert_no":"IGI-LG563847291","color":"H","clarity":"SI1","cut":"Very Good","carat":1.00,"style":"Halo"}',
   'IGI certified. Accompanied by appraisal.',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00');

-- Tennis bracelet pieces (2 available)
INSERT IGNORE INTO `product_pieces`
  (`id`, `tenant_id`, `store_id`, `product_id`,
   `piece_code`, `barcode`, `status`,
   `gross_weight`, `net_weight`, `purity`,
   `purchase_price`, `cost_price`, `selling_price`,
   `cost_code`, `attributes`, `notes`,
   `created_by_user_id`, `created_at`, `updated_at`)
VALUES
  ('pp000001-0000-0000-0000-000000000005', @T, @S,
   'dr200001-0000-0000-0000-000000000010',
   'DR-TEN-0001', '4001000000005', 'available',
   10.25, 10.25, '14K', 4200.00, 4200.00, 6200.00,
   'ADH5K', '{"stones":52,"carat_total":2.00,"color":"G-H","clarity":"SI","length_inches":7}',
   NULL,
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('pp000001-0000-0000-0000-000000000006', @T, @S,
   'dr200001-0000-0000-0000-000000000010',
   'DR-TEN-0002', '4001000000006', 'available',
   10.18, 10.18, '14K', 4180.00, 4180.00, 6180.00,
   'ADG4K', '{"stones":52,"carat_total":1.98,"color":"H","clarity":"SI","length_inches":7}',
   'Slight under-carat. Priced accordingly.',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00');

-- Cuban link chain pieces (3 available)
INSERT IGNORE INTO `product_pieces`
  (`id`, `tenant_id`, `store_id`, `product_id`,
   `piece_code`, `barcode`, `status`,
   `gross_weight`, `net_weight`, `purity`,
   `purchase_price`, `cost_price`, `selling_price`,
   `cost_code`, `attributes`, `notes`,
   `created_by_user_id`, `created_at`, `updated_at`)
VALUES
  ('pp000001-0000-0000-0000-000000000007', @T, @S,
   'dr200001-0000-0000-0000-000000000028',
   'DR-CUB-0001', '4001000000007', 'available',
   32.50, 32.50, '14K', 2800.00, 2800.00, 3900.00,
   'BAJ8L', '{"length_inches":24,"width_mm":6,"clasp":"Lobster"}',
   NULL,
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('pp000001-0000-0000-0000-000000000008', @T, @S,
   'dr200001-0000-0000-0000-000000000028',
   'DR-CUB-0002', '4001000000008', 'available',
   32.85, 32.85, '14K', 2835.00, 2835.00, 3950.00,
   'BAK9M', '{"length_inches":24,"width_mm":6,"clasp":"Lobster"}',
   'Slightly heavier than nominal.',
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00'),


  ('pp000001-0000-0000-0000-000000000009', @T, @S,
   'dr200001-0000-0000-0000-000000000028',
   'DR-CUB-0003', '4001000000009', 'available',
   33.10, 33.10, '14K', 2855.00, 2855.00, 3980.00,
   'BAL0N', '{"length_inches":24,"width_mm":6,"clasp":"Lobster"}',
   NULL,
   @U, '2026-08-15 10:00:00', '2026-08-15 10:00:00');

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. METAL RATES (USD, effective 2026-08-15)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO `metal_rates`
  (`id`, `tenant_id`, `store_id`, `metal`, `purity_label`, `purity_pct`,
   `rate_per_gram`, `buy_rate_per_gram`,
   `effective_from`, `effective_to`,
   `created_by_user_id`, `created_at`)
VALUES
  -- Gold — 24K spot ~$89.50/g + 2.5% local premium = ~$91.74; rounded to retail
  ('mr200001-0000-0000-0000-000000000001', @T, @S,
   'Gold', '24K', 100.00, 92.00, 87.40,
   '2026-08-15 09:00:00', NULL,
   @U, '2026-08-15 09:00:00'),


  ('mr200001-0000-0000-0000-000000000002', @T, @S,
   'Gold', '22K', 91.67, 84.30, 80.09,
   '2026-08-15 09:00:00', NULL,
   @U, '2026-08-15 09:00:00'),


  ('mr200001-0000-0000-0000-000000000003', @T, @S,
   'Gold', '18K', 75.00, 69.00, 65.55,
   '2026-08-15 09:00:00', NULL,
   @U, '2026-08-15 09:00:00'),


  ('mr200001-0000-0000-0000-000000000004', @T, @S,
   'Gold', '14K', 58.50, 53.82, 51.13,
   '2026-08-15 09:00:00', NULL,
   @U, '2026-08-15 09:00:00'),


  ('mr200001-0000-0000-0000-000000000005', @T, @S,
   'Gold', '10K', 41.67, 38.33, 36.41,
   '2026-08-15 09:00:00', NULL,
   @U, '2026-08-15 09:00:00'),


  -- Silver — spot ~$1.03/g + 2.5% = ~$1.056
  ('mr200001-0000-0000-0000-000000000006', @T, @S,
   'Silver', '999', 99.90, 1.06, 1.01,
   '2026-08-15 09:00:00', NULL,
   @U, '2026-08-15 09:00:00'),


  ('mr200001-0000-0000-0000-000000000007', @T, @S,
   'Silver', '925', 92.50, 0.98, 0.93,
   '2026-08-15 09:00:00', NULL,
   @U, '2026-08-15 09:00:00'),


  -- Platinum — spot ~$31.90/g + 2.5% = ~$32.70
  ('mr200001-0000-0000-0000-000000000008', @T, @S,
   'Platinum', 'Pt950', 95.00, 32.72, 31.08,
   '2026-08-15 09:00:00', NULL,
   @U, '2026-08-15 09:00:00'),


  -- Palladium — spot ~$38.30/g + 2.5% = ~$39.26
  ('mr200001-0000-0000-0000-000000000009', @T, @S,
   'Palladium', 'Pd999', 99.90, 39.25, 37.29,
   '2026-08-15 09:00:00', NULL,
   @U, '2026-08-15 09:00:00');


-- ─────────────────────────────────────────────────────────────────────────────
-- 12. CUSTOMER CODE SEQUENCE
-- ─────────────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO `customer_code_sequences` (`tenant_id`, `last_value`)
VALUES ('e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c', 12);

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. CUSTOMERS (12 Caribbean customers)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO `customers`
  (`id`, `tenant_id`, `store_id`, `customer_code`, `first_name`, `last_name`,
   `email`, `phone_number`, `address_line1`, `city`, `state_province`, `country`,
   `date_of_birth`, `anniversary_date`, `notes`,
   `credit_limit`, `outstanding_credit`, `is_active`,
   `created_by_user_id`, `updated_by_user_id`, `created_at`, `updated_at`)
VALUES
  ('cust2001-0000-0000-0000-000000000001', @T, @S,
   'CU-000001', 'Diana', 'Kentish-Adams',
   'diana.ka@gmail.com', '+1 268 725 3310',
   '24 Crosbies Road', 'St. John''s', 'Saint John', 'Antigua and Barbuda',
   '1985-03-14', '2012-06-20',
   'High-value client. Prefers 18K white gold and diamonds. Celebrating 14th anniversary this year.',
   0.00, 0.00, 1, @U, @U, '2026-08-15 10:05:00', '2026-08-15 10:05:00'),

  ('cust2001-0000-0000-0000-000000000002', @T, @S,
   'CU-000002', 'Robert', 'Etienne',
   'robert.etienne@yahoo.com', '+1 268 460 7752',
   '8 Gambles Terrace', 'St. John''s', 'Saint John', 'Antigua and Barbuda',
   '1979-11-28', NULL,
   'Buys Cuban chains and men''s pieces. Pays cash. Anniversary unknown.',
   0.00, 0.00, 1, @U, @U, '2026-08-15 10:06:00', '2026-08-15 10:06:00'),

  ('cust2001-0000-0000-0000-000000000003', @T, @S,
   'CU-000003', 'Marcia', 'Williams-George',
   'marciawg@hotmail.com', '+1 268 720 8841',
   '15 Redcliffe Street', 'St. John''s', 'Saint John', 'Antigua and Barbuda',
   '1992-07-04', '2018-04-12',
   'Young professional. Loves pearl jewelry. Anniversary: April 12.',
   0.00, 0.00, 1, @U, @U, '2026-08-15 10:07:00', '2026-08-15 10:07:00'),

  ('cust2001-0000-0000-0000-000000000004', @T, @S,
   'CU-000004', 'James', 'Challenger',
   'jchallenger@candw.ag', '+1 268 462 1144',
   'Harbour View Drive', 'English Harbour', 'Saint Paul', 'Antigua and Barbuda',
   '1965-08-19', '1995-12-01',
   'Long-term customer. Runs a sailing charter business. Buys gifts for wife. High-net-worth.',
   0.00, 0.00, 1, @U, @U, '2026-08-15 10:08:00', '2026-08-15 10:08:00'),

  ('cust2001-0000-0000-0000-000000000005', @T, @S,
   'CU-000005', 'Sophia', 'Francis',
   'sophiafrancis@digicelbb.com', '+1 268 727 2255',
   '3 Upper Nevis Street', 'St. John''s', 'Saint John', 'Antigua and Barbuda',
   '1988-01-30', '2015-09-05',
   'Teacher. Budget-conscious but shops for special occasions.',
   0.00, 0.00, 1, @U, @U, '2026-08-15 10:09:00', '2026-08-15 10:09:00'),

  ('cust2001-0000-0000-0000-000000000006', @T, @S,
   'CU-000006', 'Trevor', 'Browne-Harrington',
   'tbrowne@claro.ag', '+1 268 764 9933',
   '22 Bishops Gate', 'Falmouth Harbour', 'Saint Paul', 'Antigua and Barbuda',
   '1958-05-22', '1985-02-14',
   'Retired hotel executive. Valentine anniversary (Feb 14). Gifts only gold and diamonds.',
   0.00, 0.00, 1, @U, @U, '2026-08-15 10:10:00', '2026-08-15 10:10:00'),

  ('cust2001-0000-0000-0000-000000000007', @T, @S,
   'CU-000007', 'Camille', 'Pemberton',
   'camille.p@gmail.com', '+1 268 723 4412',
   'Long Street', 'Bolans', 'Saint Mary', 'Antigua and Barbuda',
   '1995-10-11', NULL,
   'Young fashion customer. Prefers silver with coloured stones.',
   0.00, 0.00, 1, @U, @U, '2026-08-15 10:11:00', '2026-08-15 10:11:00'),

  ('cust2001-0000-0000-0000-000000000008', @T, @S,
   'CU-000008', 'Gregory', 'James',
   'gregoryjames@flow.ag', '+1 268 460 3321',
   'Valley Road', 'St. John''s', 'Saint John', 'Antigua and Barbuda',
   '1972-04-08', '2000-07-22',
   'Police officer. Anniversary July 22. Layaway preferred payment method.',
   0.00, 0.00, 1, @U, @U, '2026-08-15 10:12:00', '2026-08-15 10:12:00'),

  ('cust2001-0000-0000-0000-000000000009', @T, @S,
   'CU-000009', 'Angela', 'Clarke-Stevens',
   'angelacs@winair.ag', '+1 268 720 5500',
   '7 Friars Hill Road', 'St. John''s', 'Saint John', 'Antigua and Barbuda',
   '1980-12-25', '2008-10-18',
   'Airline staff. Loves South Sea pearls. Gets Caribbean discount.',
   0.00, 0.00, 1, @U, @U, '2026-08-15 10:13:00', '2026-08-15 10:13:00'),

  ('cust2001-0000-0000-0000-000000000010', @T, @S,
   'CU-000010', 'Henry', 'St. Claire',
   'h.stclaire@antiguanice.com', '+1 268 462 0880',
   '45 Factory Road', 'St. John''s', 'Saint John', 'Antigua and Barbuda',
   '1969-06-14', NULL,
   'Business owner. Occasional buyer for staff gifts. Prefers engravable items.',
   0.00, 0.00, 1, @U, @U, '2026-08-15 10:14:00', '2026-08-15 10:14:00'),

  ('cust2001-0000-0000-0000-000000000011', @T, @S,
   'CU-000011', 'Naomi', 'Lake-Jeffers',
   'naomilj@gmail.com', '+1 268 726 8819',
   '12 Donovans Drive', 'St. John''s', 'Saint John', 'Antigua and Barbuda',
   '1990-02-14', '2020-02-14',
   'Married on Valentine''s Day. Sentimental buyer. Wants diamond eternity band as upgrade.',
   0.00, 0.00, 1, @U, @U, '2026-08-15 10:15:00', '2026-08-15 10:15:00'),

  ('cust2001-0000-0000-0000-000000000012', @T, @S,
   'CU-000012', 'Patrick', 'Horsford',
   'phorsford@antiguabc.com', '+1 268 463 5555',
   'Heron Road, Point Panorama', 'St. John''s', 'Saint John', 'Antigua and Barbuda',
   '1955-09-30', '1980-08-09',
   'Attorney-at-law. 46th anniversary in August. Buying surprise gift for wife.',
   0.00, 0.00, 1, @U, @U, '2026-08-15 10:16:00', '2026-08-15 10:16:00');

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. CRM — WISHLIST ITEMS
-- ─────────────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO `customer_wishlist_items`
  (`id`, `tenant_id`, `customer_id`, `product_id`, `piece_id`, `notes`, `added_at`)
VALUES
  ('wl200001-0000-0000-0000-000000000001', @T,
   'cust2001-0000-0000-0000-000000000001',
   'dr200001-0000-0000-0000-000000000009',
   'pp000001-0000-0000-0000-000000000004',
   'Wants the 1.0ct halo ring for her 15th anniversary next year.',
   '2026-08-15 10:00:00'),

  ('wl200001-0000-0000-0000-000000000002', @T,
   'cust2001-0000-0000-0000-000000000011',
   'dr200001-0000-0000-0000-000000000035',
   NULL,
   'Diamond eternity band upgrade from plain wedding ring. Budget ~$3,000.',
   '2026-08-15 10:00:00'),

  ('wl200001-0000-0000-0000-000000000003', @T,
   'cust2001-0000-0000-0000-000000000007',
   'dr200001-0000-0000-0000-000000000024',
   NULL,
   'Turquoise cuff — wants to try it on. Follow up when next in.',
   '2026-08-15 10:00:00');


-- ─────────────────────────────────────────────────────────────────────────────
-- 15. HISTORICAL SALES (3 completed sales)
-- ─────────────────────────────────────────────────────────────────────────────
-- Sales columns: id, tenant_id, store_id, cashier_id, subtotal, tax, total,
--   payment_method, status, payment_status, discount_type, discount_value,
--   discount_amount, customer_id, employee_id
-- Sale items: id, sale_id, product_id, quantity, price

-- Sale 1: Trevor Browne-Harrington — Valentine's Day gift, Feb 2026
INSERT IGNORE INTO `sales`
  (`id`, `tenant_id`, `store_id`, `cashier_id`,
   `subtotal`, `tax`, `total`,
   `payment_method`, `status`, `payment_status`,
   `discount_type`, `discount_value`, `discount_amount`,
   `promotions_amount`, `manual_discount_amount`,
   `customer_id`, `employee_id`)
VALUES
  ('sale2001-0000-0000-0000-000000000001', @T, @S,
   'u3000000-0000-0000-0000-000000000002',
   820.00, 123.00, 943.00,
   'credit_card', 'completed', 'PAID',
   NULL, 0, 0, 0, 0,
   'cust2001-0000-0000-0000-000000000006',
   'e4000000-0000-0000-0000-000000000003');

INSERT IGNORE INTO `sale_items`
  (`id`, `sale_id`, `product_id`, `quantity`, `price`,
   `base_unit_price`, `manual_discount_per_unit`, `promo_discount_per_unit`,
   `tax_per_unit`, `final_unit_price`, `created_at`)
VALUES
  ('si200001-0000-0000-0000-000000000001',
   'sale2001-0000-0000-0000-000000000001',
   'dr200001-0000-0000-0000-000000000003', 1, 820.00,
   820.00, 0, 0, 0, 820.00, '2026-02-14 11:30:00');

-- Sale 2: Robert Etienne — Cuban chain, June 2026
INSERT IGNORE INTO `sales`
  (`id`, `tenant_id`, `store_id`, `cashier_id`,
   `subtotal`, `tax`, `total`,
   `payment_method`, `status`, `payment_status`,
   `discount_type`, `discount_value`, `discount_amount`,
   `promotions_amount`, `manual_discount_amount`,
   `customer_id`, `employee_id`)
VALUES
  ('sale2001-0000-0000-0000-000000000002', @T, @S,
   'u3000000-0000-0000-0000-000000000003',
   3900.00, 555.00, 4255.00,
   'cash', 'completed', 'PAID',
   'fixed', 200, 200, 0, 0,
   'cust2001-0000-0000-0000-000000000002',
   'e4000000-0000-0000-0000-000000000004');

INSERT IGNORE INTO `sale_items`
  (`id`, `sale_id`, `product_id`, `quantity`, `price`,
   `base_unit_price`, `manual_discount_per_unit`, `promo_discount_per_unit`,
   `tax_per_unit`, `final_unit_price`, `created_at`)
VALUES
  ('si200001-0000-0000-0000-000000000002',
   'sale2001-0000-0000-0000-000000000002',
   'dr200001-0000-0000-0000-000000000028', 1, 3900.00,
   3900.00, 0, 0, 0, 3900.00, '2026-06-05 11:15:00');

-- Update serialized piece to sold
UPDATE `product_pieces`
SET `status` = 'sold',
    `sale_id` = 'sale2001-0000-0000-0000-000000000002',
    `sale_item_id` = 'si200001-0000-0000-0000-000000000002',
    `updated_at` = '2026-06-05 11:15:00'
WHERE `id` = 'pp000001-0000-0000-0000-000000000009';

-- Sale 3: Marcia Williams-George — Pearl earrings + pendant, July 2026
INSERT IGNORE INTO `sales`
  (`id`, `tenant_id`, `store_id`, `cashier_id`,
   `subtotal`, `tax`, `total`,
   `payment_method`, `status`, `payment_status`,
   `discount_type`, `discount_value`, `discount_amount`,
   `promotions_amount`, `manual_discount_amount`,
   `customer_id`, `employee_id`)
VALUES
  ('sale2001-0000-0000-0000-000000000003', @T, @S,
   'u3000000-0000-0000-0000-000000000002',
   1520.00, 228.00, 1748.00,
   'debit_card', 'completed', 'PAID',
   NULL, 0, 0, 0, 0,
   'cust2001-0000-0000-0000-000000000003',
   'e4000000-0000-0000-0000-000000000003');

INSERT IGNORE INTO `sale_items`
  (`id`, `sale_id`, `product_id`, `quantity`, `price`,
   `base_unit_price`, `manual_discount_per_unit`, `promo_discount_per_unit`,
   `tax_per_unit`, `final_unit_price`, `created_at`)
VALUES
  ('si200001-0000-0000-0000-000000000003',
   'sale2001-0000-0000-0000-000000000003',
   'dr200001-0000-0000-0000-000000000018', 1, 420.00,
   420.00, 0, 0, 0, 420.00, '2026-07-10 14:20:00'),

  ('si200001-0000-0000-0000-000000000004',
   'sale2001-0000-0000-0000-000000000003',
   'dr200001-0000-0000-0000-000000000015', 1, 1100.00,
   1100.00, 0, 0, 0, 1100.00, '2026-07-10 14:20:00');

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. REPAIR ORDERS + UPDATES (3 active)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO `repair_ticket_sequences` (`tenant_id`, `last_value`)
VALUES ('e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c', 3);

INSERT IGNORE INTO `repair_orders`
  (`id`, `tenant_id`, `store_id`,
   `ticket_no`, `customer_id`, `employee_id`,
   `item_description`, `metal`, `weight`,
   `problem_description`, `work_required`, `job_type`,
   `condition_notes`, `goldsmith_name`,
   `estimated_cost`, `advance_paid`, `advance_payment_mode`,
   `status`, `received_date`, `promised_date`,
   `photos`, `notes`,
   `created_at`, `updated_at`)
VALUES
  -- Repair 1: Size ring for Sophia Francis — in progress
  ('ro200001-0000-0000-0000-000000000001', @T, @S,
   'RO-00001',
   'cust2001-0000-0000-0000-000000000005',
   'e4000000-0000-0000-0000-000000000002',
   '14K Yellow Gold Diamond Solitaire Ring',
   'Gold', 2.80,
   'Ring is currently size 7, needs to be resized to size 5.5',
   'Ring sizing down (removal of gold). Prong check and re-tip as needed.',
   'sizing',
   'One prong slightly worn. Two small pave diamonds secure.',
   'Alexander Peters (in-house)',
   65.00, 30.00, 'cash',
   'in_progress', '2026-08-12', '2026-08-19',
   '[]', 'Customer travelling until Aug 20. Call when ready.',
   '2026-08-12 09:30:00', '2026-08-13 10:00:00'),

  -- Repair 2: Clasp replacement for James Challenger
  ('ro200001-0000-0000-0000-000000000002', @T, @S,
   'RO-00002',
   'cust2001-0000-0000-0000-000000000004',
   'e4000000-0000-0000-0000-000000000002',
   '18K Yellow Gold Rope Chain Necklace 24"',
   'Gold', 11.50,
   'Lobster clasp broken — will not close securely.',
   'Replace lobster clasp with new 18K lobster clasp (8mm). Polish chain.',
   'clasp_replacement',
   'Chain in excellent condition. Minor surface scratches only.',
   'Alexander Peters (in-house)',
   85.00, 0.00, 'cash',
   'received', '2026-08-14', '2026-08-18',
   '[]', 'VIP client — priority. Text on completion.',
   '2026-08-14 11:00:00', '2026-08-14 11:00:00'),

  -- Repair 3: Pearl restringing for Angela Clarke-Stevens
  ('ro200001-0000-0000-0000-000000000003', @T, @S,
   'RO-00003',
   'cust2001-0000-0000-0000-000000000009',
   'e4000000-0000-0000-0000-000000000003',
   'South Sea Pearl Strand Necklace 18"',
   NULL, NULL,
   'Old silk thread frayed. Two pearls have slipped. Clasp tarnished.',
   'Full restring on silk with knots between each pearl. Clean clasp or replace if needed.',
   'restringing',
   '47 pearls, all present. Matching clasp 18K yellow gold barrel.',
   'In-house stringer (Kezia Williams)',
   95.00, 50.00, 'card',
   'ready', '2026-08-13', '2026-08-17',
   '[]', 'Customer notified by WhatsApp — picking up Aug 16.',
   '2026-08-13 14:00:00', '2026-08-15 09:00:00');

INSERT IGNORE INTO `repair_order_updates`
  (`id`, `tenant_id`, `repair_order_id`, `status`, `note`, `updated_by_user_id`, `created_at`)
VALUES
  ('rou00001-0000-0000-0000-000000000001',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'ro200001-0000-0000-0000-000000000001',
   'in_progress',
   'Goldsmith started sizing. Prong inspection done — all prongs OK.',
   @U, '2026-08-13 10:00:00'),


  ('rou00001-0000-0000-0000-000000000002',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'ro200001-0000-0000-0000-000000000003',
   'in_progress',
   'Restringing started. All 47 pearls counted and cleaned.',
   'u3000000-0000-0000-0000-000000000002', '2026-08-14 09:30:00'),

  ('rou00001-0000-0000-0000-000000000003',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'ro200001-0000-0000-0000-000000000003',
   'ready',
   'Restringing complete. Clasp polished and re-soldered. Quality checked.',
   'u3000000-0000-0000-0000-000000000002', '2026-08-15 09:00:00');


-- ─────────────────────────────────────────────────────────────────────────────
-- 17. MEMO / CONSIGNMENT (sequences + 2 transactions)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO `memo_sequences` (`tenant_id`, `last_value`)
VALUES ('e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c', 2);

-- Memo IN: received 3 diamond rings on consignment from Caribbean Diamond Supply Ltd
INSERT IGNORE INTO `memo_transactions`
  (`id`, `tenant_id`, `store_id`,
   `memo_no`, `direction`, `party_type`, `supplier_id`,
   `employee_id`, `issue_date`, `due_date`,
   `status`, `total_value`, `notes`,
   `created_at`, `updated_at`)
VALUES
  ('mt200001-0000-0000-0000-000000000001', @T, @S,
   'MEM-00001', 'in', 'supplier',
   's2000000-0000-0000-0000-000000000001',
   'e4000000-0000-0000-0000-000000000002',
   '2026-08-01', '2026-08-31',
   'open', 14400.00,
   'Consignment from Caribbean Diamond Supply. 30-day memo. Unsold pieces to be returned by Aug 31.',
   '2026-08-01 10:00:00', '2026-08-01 10:00:00');

INSERT IGNORE INTO `memo_items`
  (`id`, `tenant_id`, `memo_id`, `product_id`, `piece_id`,
   `description`, `quantity`, `returned_quantity`,
   `unit_value`, `line_value`, `status`)
VALUES
  ('mitem001-0000-0000-0000-000000000001', @T,
   'mt200001-0000-0000-0000-000000000001',
   'dr200001-0000-0000-0000-000000000008',
   'pp000001-0000-0000-0000-000000000001',
   '18K Gold Diamond Solitaire 0.75ct [DR-SOL-0001] — H/VS2/GIA',
   1, 0, 4800.00, 4800.00, 'held'),

  ('mitem001-0000-0000-0000-000000000002', @T,
   'mt200001-0000-0000-0000-000000000001',
   'dr200001-0000-0000-0000-000000000008',
   'pp000001-0000-0000-0000-000000000002',
   '18K Gold Diamond Solitaire 0.75ct [DR-SOL-0002] — G/VS1/GIA',
   1, 0, 4900.00, 4900.00, 'held'),

  ('mitem001-0000-0000-0000-000000000003', @T,
   'mt200001-0000-0000-0000-000000000001',
   'dr200001-0000-0000-0000-000000000009',
   'pp000001-0000-0000-0000-000000000004',
   '18K Gold Diamond Halo 1.0ct [DR-HAL-0001] — H/SI1/IGI',
   1, 0, 8500.00, 8500.00, 'held');

-- Update piece statuses to 'hold'
UPDATE `product_pieces`
SET `status` = 'hold', `updated_at` = '2026-08-01 10:00:00'
WHERE `id` IN (
  'pp000001-0000-0000-0000-000000000001',
  'pp000001-0000-0000-0000-000000000002',
  'pp000001-0000-0000-0000-000000000004'
);

-- Memo OUT: 2 pearl necklaces sent to Angela Clarke-Stevens to try at home
INSERT IGNORE INTO `memo_transactions`
  (`id`, `tenant_id`, `store_id`,
   `memo_no`, `direction`, `party_type`, `customer_id`,
   `employee_id`, `issue_date`, `due_date`,
   `status`, `total_value`, `notes`,
   `created_at`, `updated_at`)
VALUES
  ('mt200001-0000-0000-0000-000000000002', @T, @S,
   'MEM-00002', 'out', 'customer',
   'cust2001-0000-0000-0000-000000000009',
   'e4000000-0000-0000-0000-000000000003',
   '2026-08-14', '2026-08-21',
   'open', 3900.00,
   'Angela taking 2 pearl pieces home on 7-day approval. ID verified.',
   '2026-08-14 15:00:00', '2026-08-14 15:00:00');

INSERT IGNORE INTO `memo_items`
  (`id`, `tenant_id`, `memo_id`, `product_id`, `piece_id`,
   `description`, `quantity`, `returned_quantity`,
   `unit_value`, `line_value`, `status`)
VALUES
  ('mitem001-0000-0000-0000-000000000004', @T,
   'mt200001-0000-0000-0000-000000000002',
   'dr200001-0000-0000-0000-000000000014', NULL,
   'South Sea Pearl Strand Necklace 18" — graduated 9-11mm',
   1, 0, 2800.00, 2800.00, 'held'),

  ('mitem001-0000-0000-0000-000000000005', @T,
   'mt200001-0000-0000-0000-000000000002',
   'dr200001-0000-0000-0000-000000000015', NULL,
   'Tahitian Pearl Drop Earrings 10mm — peacock overtone',
   1, 0, 1100.00, 1100.00, 'held');

-- ─────────────────────────────────────────────────────────────────────────────
-- 18. LAYAWAY — 1 active plan (Diana Kentish-Adams, halo ring)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO `layaway_sequences` (`tenant_id`, `last_value`)
VALUES ('e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c', 1);

INSERT IGNORE INTO `layaway_plans`
  (`id`, `tenant_id`, `store_id`, `plan_no`,
   `customer_id`, `employee_id`,
   `total_amount`, `down_payment`, `paid_amount`,
   `installment_amount`, `installment_count`, `frequency`,
   `start_date`, `due_date`, `status`, `notes`,
   `created_at`, `updated_at`)
VALUES
  ('lp200001-0000-0000-0000-000000000001', @T, @S,
   'LAY-00001',
   'cust2001-0000-0000-0000-000000000001',
   'e4000000-0000-0000-0000-000000000002',
   8500.00, 1500.00, 3000.00,
   1000.00, 7, 'monthly',
   '2026-07-01', '2027-01-01', 'active',
   '18K Gold Diamond Halo 1.0ct (DR-HAL-0001) on layaway for 15th anniversary. Piece held.',
   '2026-07-01 10:00:00', '2026-08-01 10:00:00');

INSERT IGNORE INTO `layaway_items`
  (`id`, `layaway_id`, `tenant_id`, `product_id`, `piece_id`,
   `description`, `quantity`, `unit_price`, `line_total`)
VALUES
  ('li200001-0000-0000-0000-000000000001',
   'lp200001-0000-0000-0000-000000000001', @T,
   'dr200001-0000-0000-0000-000000000009',
   'pp000001-0000-0000-0000-000000000004',
   '18K Gold Diamond Halo Engagement Ring 1.0ct [DR-HAL-0001]',
   1, 8500.00, 8500.00);

INSERT IGNORE INTO `layaway_payments`
  (`id`, `tenant_id`, `layaway_id`,
   `amount`, `payment_method`, `notes`, `received_by_user_id`, `paid_at`)
VALUES
  ('lpay2001-0000-0000-0000-000000000001',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'lp200001-0000-0000-0000-000000000001',
   1500.00, 'credit_card', 'Initial deposit (down payment).',
   @U, '2026-07-01 10:00:00'),


  ('lpay2001-0000-0000-0000-000000000002',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'lp200001-0000-0000-0000-000000000001',
   1000.00, 'debit_card', 'Monthly instalment #1.',
   @U, '2026-08-01 10:00:00'),


  ('lpay2001-0000-0000-0000-000000000003',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'lp200001-0000-0000-0000-000000000001',
   500.00, 'cash', 'Additional partial payment. Customer dropped in.',
   'u3000000-0000-0000-0000-000000000001', '2026-08-15 11:00:00');

-- ─────────────────────────────────────────────────────────────────────────────
-- 19. OLD GOLD / EXCHANGE PURCHASES (2 vouchers)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO `old_gold_voucher_sequences` (`tenant_id`, `last_value`)
VALUES ('e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c', 2);

INSERT IGNORE INTO `old_gold_purchases`
  (`id`, `tenant_id`, `store_id`, `voucher_no`,
   `customer_id`, `employee_id`,
   `item_description`, `metal`, `purity_label`, `claimed_purity_label`,
   `purity_pct`, `claimed_purity_pct`,
   `test_method`,
   `gross_weight`, `stone_deduction`, `net_weight`,
   `rate_per_gram`, `amount_deduction`, `valuation_amount`,
   `status`, `voucher_type`, `payment_mode`,
   `credited_at`, `notes`,
   `created_at`, `updated_at`)
VALUES
  -- Voucher 1: Henry St. Claire bringing in old 18K chain (cash settlement)
  ('ogp00001-0000-0000-0000-000000000001', @T, @S,
   'OGP-00001',
   'cust2001-0000-0000-0000-000000000010',
   'e4000000-0000-0000-0000-000000000002',
   'Old 18K yellow gold chain necklace, 20 inches, broken clasp',
   'Gold', '18K', '18K',
   75.00, 75.00,
   'acid_test',
   11.80, 0.00, 11.80,
   69.00, 0.00, 814.20,
   'credited', 'cash', 'cash',
   '2026-08-08 15:00:00',
   'Acid test confirmed 18K. Paid at 18K rate. Customer happy.',
   '2026-08-08 14:45:00', '2026-08-08 15:05:00'),

  -- Voucher 2: Camille Pemberton — old silver + partial exchange credit (pending)
  ('ogp00001-0000-0000-0000-000000000002', @T, @S,
   'OGP-00002',
   'cust2001-0000-0000-0000-000000000007',
   'e4000000-0000-0000-0000-000000000003',
   '925 silver bangle and 2x silver rings, mixed condition',
   'Silver', '925', '925',
   92.50, 92.50,
   'acid_test',
   42.60, 0.00, 42.60,
   0.98, 0.00, 41.75,
   'valued', 'credit', 'other',
   NULL,
   'Valuation done. Camille will redeem against silver turquoise cuff (OGP-000021). Follow up.',
   '2026-08-15 13:00:00', '2026-08-15 13:00:00');


-- ─────────────────────────────────────────────────────────────────────────────
-- 20. SAVINGS SCHEMES (1 plan + 2 enrollments + payments)
-- ─────────────────────────────────────────────────────────────────────────────
-- Also seed the sequence table
INSERT IGNORE INTO `savings_scheme_sequences` (`tenant_id`, `last_value`)
VALUES ('e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c', 2);

INSERT IGNORE INTO `savings_scheme_plans`
  (`id`, `tenant_id`, `name`, `accrual_type`,
   `installment_amount`, `duration_months`,
   `bonus_type`, `bonus_value`, `terms`, `is_active`)
VALUES
  ('ssp00001-0000-0000-0000-000000000001',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'Diamond Republic Gold Saver Plan', 'amount',
   100.00, 11,
   'extra_installment', 1.00,
   'Pay $100/month for 11 months and receive 1 free instalment ($100 bonus) = $1,200 credit toward any purchase.',
   1);

INSERT IGNORE INTO `savings_scheme_enrollments`
  (`id`, `tenant_id`, `store_id`, `plan_id`,
   `enrollment_no`, `customer_id`, `employee_id`,
   `start_date`, `maturity_date`,
   `paid_installments`, `total_paid`, `total_weight`, `bonus_amount`, `status`, `notes`)
VALUES
  -- Naomi Lake-Jeffers saving toward the diamond eternity band
  ('sse00001-0000-0000-0000-000000000001',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'ssp00001-0000-0000-0000-000000000001',
   'SSP-000001',
   'cust2001-0000-0000-0000-000000000011',
   'e4000000-0000-0000-0000-000000000003',
   '2026-05-01', '2027-04-01',
   4, 400.00, 0.00, 0.00, 'active',
   'Saving for diamond eternity band upgrade. On track.'),

  -- Sophia Francis saving for a gift for herself
  ('sse00001-0000-0000-0000-000000000002',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'ssp00001-0000-0000-0000-000000000001',
   'SSP-000002',
   'cust2001-0000-0000-0000-000000000005',
   'e4000000-0000-0000-0000-000000000004',
   '2026-06-01', '2027-05-01',
   3, 300.00, 0.00, 0.00, 'active',
   'Wants a pearl necklace. Will choose when fully saved.');

-- Payments for Naomi (4 months) — columns: id, tenant_id, enrollment_id, installment_no, amount, payment_method, received_by_user_id, paid_at
INSERT IGNORE INTO `savings_scheme_payments`
  (`id`, `tenant_id`, `enrollment_id`, `installment_no`, `amount`, `payment_method`, `received_by_user_id`, `paid_at`)
VALUES
  ('sspay001-0000-0000-0000-000000000001',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'sse00001-0000-0000-0000-000000000001', 1, 100.00, 'debit_card', @U, '2026-05-01 10:00:00'),
  ('sspay001-0000-0000-0000-000000000002',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'sse00001-0000-0000-0000-000000000001', 2, 100.00, 'debit_card', @U, '2026-06-01 10:00:00'),
  ('sspay001-0000-0000-0000-000000000003',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'sse00001-0000-0000-0000-000000000001', 3, 100.00, 'debit_card', @U, '2026-07-01 10:00:00'),
  ('sspay001-0000-0000-0000-000000000004',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'sse00001-0000-0000-0000-000000000001', 4, 100.00, 'debit_card', @U, '2026-08-01 10:00:00'),
-- Payments for Sophia (3 months)
  ('sspay001-0000-0000-0000-000000000005',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'sse00001-0000-0000-0000-000000000002', 1, 100.00, 'cash',
   'u3000000-0000-0000-0000-000000000003', '2026-06-01 10:00:00'),
  ('sspay001-0000-0000-0000-000000000006',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'sse00001-0000-0000-0000-000000000002', 2, 100.00, 'cash',
   'u3000000-0000-0000-0000-000000000003', '2026-07-01 10:00:00'),
  ('sspay001-0000-0000-0000-000000000007',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'sse00001-0000-0000-0000-000000000002', 3, 100.00, 'cash',
   'u3000000-0000-0000-0000-000000000003', '2026-08-01 10:00:00');

-- ─────────────────────────────────────────────────────────────────────────────
-- 21. SCHEMA MIGRATION RECORD
-- ─────────────────────────────────────────────────────────────────────────────
-- The migration runner records this file in schema_migrations on success.

-- ─────────────────────────────────────────────────────────────────────────────
-- DONE
-- ─────────────────────────────────────────────────────────────────────────────
-- Summary:
--   Tenant / Store        : Diamond Republic, #100 Heritage Quay, Antigua
--   Users                 : 4 (admin + 3 staff)
--   Roles                 : 4
--   Employees             : 4 (w/ sales targets)
--   Suppliers             : 3
--   Categories            : 5
--   Products              : 35
--   Serialized pieces     : 9 (4 products tracked)
--   Metal rates           : 9 (Gold 24K–10K, Silver 999/925, Platinum, Palladium)
--   Customers             : 12
--   Wishlist items        : 3
--   Sales (completed)     : 3
--   Repair orders         : 3 (active)
--   Memo transactions     : 2 (1 consignment-in, 1 approval-out)
--   Layaway plans         : 1 (active, 3 payments made)
--   Old gold vouchers     : 2
--   Savings scheme plans  : 1
--   Savings enrollments   : 2 (active)
--   Savings payments      : 7
-- =============================================================================
