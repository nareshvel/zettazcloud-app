-- =============================================================================
-- 2026-08-24 Demo tenants — one per business type
-- =============================================================================
-- PURPOSE
-- -------
-- A working tenant for each vertical so the whole product can be exercised
-- end to end: correct business type, jurisdiction, currency, tax setup,
-- categories, products with the fields that vertical actually uses, and a
-- customer to sell to.
--
-- Five tenants, deliberately spanning different jurisdictions so nothing is
-- silently Antigua-shaped:
--
--   DEMO-JW   Diamond Republic Demo   Jewelry      Antigua (ABST 15%)  DUTY-FREE
--   DEMO-GR   Harbour Fresh Demo      Grocery      Antigua (ABST 15%)  domestic
--   DEMO-EL   Circuit Point Demo      Electronics  UAE     (VAT 5%)    domestic
--   DEMO-AP   Coral & Thread Demo     Apparel      UK      (VAT 20%)   domestic
--   DEMO-RT   Heritage General Demo   Retail       US      (Sales Tax) domestic
--
-- Pharmacy is intentionally absent — the vertical is held back pending
-- regulatory review, so a demo would imply readiness it does not have.
--
-- LOGIN — every demo user is demo@<slug>.zettaz.test with the same password
-- hash as the existing Diamond Republic admin, so you can sign in immediately.
--
-- HOW TO RUN
-- ----------
--   cd backend && npm run migrate:demo
--
-- The `.demo.sql` suffix is meaningful: the migration runner SKIPS these files
-- during an ordinary `npm run migrate`, so demo companies can never appear in a
-- real database by accident. `migrate:demo` opts in explicitly, then runs
-- template provisioning for the tenants this file creates.
--
-- TEMPLATES ARE NOT SEEDED HERE, by design. `npm run migrate:demo` chains
-- `scripts/provision-demo-templates.js`, which builds them through the same
-- service real tenants use. Hand-writing block JSON here would test a path
-- customers never exercise, and would drift every time the defaults improve.
--
-- IDEMPOTENT: INSERT IGNORE with fixed UUIDs. Safe to re-run.
-- TEARDOWN: see the companion DELETE block at the foot of this file.
-- =============================================================================

SET @PW = '$2a$12$z.PB2zdDXrzO0zQ3NcwQAOG0dKWis1c6A.CeKWwLheAfoYZ3wv.J2';

-- ---------------------------------------------------------------------------
-- 1. Tenants
-- ---------------------------------------------------------------------------
-- `onboarding_step` MUST be the literal string 'completed', not 'complete' —
-- Login.tsx's getRedirectPath() checks `onboardingStep !== 'completed'` and
-- sends the user to /onboarding otherwise, regardless of `setup_completed`.
-- (Found 2026-09-02: a mismatched 'complete' here sent every demo tenant to
-- the onboarding wizard on login. INSERT IGNORE means fixing this value here
-- does NOT correct rows already seeded into a live database — see the
-- idempotent UPDATE below, which self-heals any environment that already
-- ran this file with the old typo.)
INSERT IGNORE INTO `tenants` (`id`, `name`, `domain`, `industry_code`, `setup_completed`, `onboarding_step`)
VALUES
  ('demo0001-jw00-0000-0000-000000000001', 'Diamond Republic Demo',  'demo-jewelry',     'jewelry',        1, 'completed'),
  ('demo0002-gr00-0000-0000-000000000002', 'Harbour Fresh Demo',     'demo-grocery',     'grocery',        1, 'completed'),
  ('demo0003-el00-0000-0000-000000000003', 'Circuit Point Demo',     'demo-electronics', 'electronics',    1, 'completed'),
  ('demo0004-ap00-0000-0000-000000000004', 'Coral and Thread Demo',  'demo-apparel',     'apparel',        1, 'completed'),
  ('demo0005-rt00-0000-0000-000000000005', 'Heritage General Demo',  'demo-retail',      'general_retail', 1, 'completed');

-- Idempotent self-heal for databases that already ran this file before the
-- 'complete' -> 'completed' fix above (INSERT IGNORE would otherwise leave
-- the typo'd value in place forever).
UPDATE `tenants` SET `onboarding_step` = 'completed'
WHERE `id` IN (
  'demo0001-jw00-0000-0000-000000000001',
  'demo0002-gr00-0000-0000-000000000002',
  'demo0003-el00-0000-0000-000000000003',
  'demo0004-ap00-0000-0000-000000000004',
  'demo0005-rt00-0000-0000-000000000005'
) AND `onboarding_step` = 'complete';

-- ---------------------------------------------------------------------------
-- 2. Stores
-- ---------------------------------------------------------------------------
-- country_code drives jurisdiction resolution, so each store gets a real one.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `stores`
  (`id`, `tenant_id`, `name`, `address`, `phone`, `email`,
   `currency_code`, `country_code`, `language_code`, `date_format`, `timezone`,
   `tax_rate`, `industry_code`, `is_duty_free`, `is_active`)
VALUES
  ('demo0001-jw00-0000-0000-00000000st01', 'demo0001-jw00-0000-0000-000000000001',
   'Diamond Republic Demo — Heritage Quay',
   '100 Heritage Quay, St. Johns, Antigua and Barbuda', '+1-268-555-0100', 'demo@jewelry.zettaz.test',
   'USD', 'AG', 'en', 'DD/MM/YYYY', 'America/Antigua', 15.00, 'jewelry', 1, 1),

  ('demo0002-gr00-0000-0000-00000000st02', 'demo0002-gr00-0000-0000-000000000002',
   'Harbour Fresh Demo — Market Street',
   '42 Market Street, St. Johns, Antigua and Barbuda', '+1-268-555-0288', 'demo@grocery.zettaz.test',
   'XCD', 'AG', 'en', 'DD/MM/YYYY', 'America/Antigua', 15.00, 'grocery', 0, 1),

  ('demo0003-el00-0000-0000-00000000st03', 'demo0003-el00-0000-0000-000000000003',
   'Circuit Point Demo — Dubai',
   'Sheikh Zayed Road, Dubai, United Arab Emirates', '+971-4-555-0611', 'demo@electronics.zettaz.test',
   'AED', 'AE', 'en', 'DD/MM/YYYY', 'Asia/Dubai', 5.00, 'electronics', 0, 1),

  ('demo0004-ap00-0000-0000-00000000st04', 'demo0004-ap00-0000-0000-000000000004',
   'Coral and Thread Demo — London',
   '18 Regent Street, London SW1Y 4PZ, United Kingdom', '+44-20-7555-0733', 'demo@apparel.zettaz.test',
   'GBP', 'GB', 'en', 'DD/MM/YYYY', 'Europe/London', 20.00, 'apparel', 0, 1),

  ('demo0005-rt00-0000-0000-00000000st05', 'demo0005-rt00-0000-0000-000000000005',
   'Heritage General Demo — Miami',
   '23 High Street, Miami, FL 33101, USA', '+1-305-555-0199', 'demo@retail.zettaz.test',
   'USD', 'US', 'en', 'MM/DD/YYYY', 'America/New_York', 7.00, 'general_retail', 0, 1);

-- ---------------------------------------------------------------------------
-- 3. Jurisdiction binding + sales mode
-- ---------------------------------------------------------------------------
-- sales_mode is the SOURCE OF TRUTH for duty-free; stores.is_duty_free above is
-- the denormalised mirror. They are set together here so they cannot disagree.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `store_jurisdiction_settings`
  (`store_id`, `tenant_id`, `jurisdiction_profile_id`, `sales_mode`,
   `requires_passport`, `requires_boarding_pass`, `export_declaration_text`, `business_tax_id`)
VALUES
  -- Duty-free: traveller documents required, export declaration printed.
  ('demo0001-jw00-0000-0000-00000000st01', 'demo0001-jw00-0000-0000-000000000001',
   'jp-ag-000000-0000-0000-000000000001', 'duty_free', 1, 1,
   'These goods are supplied free of local consumption tax for export. They must be removed from Antigua and Barbuda by the purchaser and may not be consumed or resold within the territory.',
   'ABST-DEMO-0001'),

  ('demo0002-gr00-0000-0000-00000000st02', 'demo0002-gr00-0000-0000-000000000002',
   'jp-ag-000000-0000-0000-000000000001', 'domestic', 0, 0, NULL, 'ABST-DEMO-0002'),

  ('demo0003-el00-0000-0000-00000000st03', 'demo0003-el00-0000-0000-000000000003',
   'jp-ae-000000-0000-0000-000000000001', 'domestic', 0, 0, NULL, 'TRN-DEMO-0003'),

  ('demo0004-ap00-0000-0000-00000000st04', 'demo0004-ap00-0000-0000-000000000004',
   'jp-gb-000000-0000-0000-000000000001', 'domestic', 0, 0, NULL, 'GB-DEMO-0004'),

  ('demo0005-rt00-0000-0000-00000000st05', 'demo0005-rt00-0000-0000-000000000005',
   'jp-us-000000-0000-0000-000000000001', 'domestic', 0, 0, NULL, 'US-DEMO-0005');

-- ---------------------------------------------------------------------------
-- 4. Demo users
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `users`
  (`id`, `tenant_id`, `store_id`, `name`, `email`, `password_hash`,
   `email_verified`, `signup_completed`, `is_active`)
VALUES
  ('demo0001-jw00-0000-0000-00000000us01', 'demo0001-jw00-0000-0000-000000000001',
   'demo0001-jw00-0000-0000-00000000st01', 'Jewelry Demo Admin', 'demo@jewelry.zettaz.test', @PW, 1, 1, 1),
  ('demo0002-gr00-0000-0000-00000000us02', 'demo0002-gr00-0000-0000-000000000002',
   'demo0002-gr00-0000-0000-00000000st02', 'Grocery Demo Admin', 'demo@grocery.zettaz.test', @PW, 1, 1, 1),
  ('demo0003-el00-0000-0000-00000000us03', 'demo0003-el00-0000-0000-000000000003',
   'demo0003-el00-0000-0000-00000000st03', 'Electronics Demo Admin', 'demo@electronics.zettaz.test', @PW, 1, 1, 1),
  ('demo0004-ap00-0000-0000-00000000us04', 'demo0004-ap00-0000-0000-000000000004',
   'demo0004-ap00-0000-0000-00000000st04', 'Apparel Demo Admin', 'demo@apparel.zettaz.test', @PW, 1, 1, 1),
  ('demo0005-rt00-0000-0000-00000000us05', 'demo0005-rt00-0000-0000-000000000005',
   'demo0005-rt00-0000-0000-00000000st05', 'Retail Demo Admin', 'demo@retail.zettaz.test', @PW, 1, 1, 1);

-- ---------------------------------------------------------------------------
-- 5. Tenant-admin role per demo tenant
-- ---------------------------------------------------------------------------
-- Tenant admins bypass permission checks (see rbacPermissionMiddleware), so one
-- role per tenant is enough to make every screen reachable.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `roles` (`id`, `name`, `description`, `tenant_id`, `is_system_role`, `created_by`)
VALUES
  ('demo0001-jw00-0000-0000-00000000ro01', 'Tenant Admin', 'Full access', 'demo0001-jw00-0000-0000-000000000001', 1, 'demo0001-jw00-0000-0000-00000000us01'),
  ('demo0002-gr00-0000-0000-00000000ro02', 'Tenant Admin', 'Full access', 'demo0002-gr00-0000-0000-000000000002', 1, 'demo0002-gr00-0000-0000-00000000us02'),
  ('demo0003-el00-0000-0000-00000000ro03', 'Tenant Admin', 'Full access', 'demo0003-el00-0000-0000-000000000003', 1, 'demo0003-el00-0000-0000-00000000us03'),
  ('demo0004-ap00-0000-0000-00000000ro04', 'Tenant Admin', 'Full access', 'demo0004-ap00-0000-0000-000000000004', 1, 'demo0004-ap00-0000-0000-00000000us04'),
  ('demo0005-rt00-0000-0000-00000000ro05', 'Tenant Admin', 'Full access', 'demo0005-rt00-0000-0000-000000000005', 1, 'demo0005-rt00-0000-0000-00000000us05');

INSERT IGNORE INTO `user_roles` (`user_id`, `role_id`)
VALUES
  ('demo0001-jw00-0000-0000-00000000us01', 'demo0001-jw00-0000-0000-00000000ro01'),
  ('demo0002-gr00-0000-0000-00000000us02', 'demo0002-gr00-0000-0000-00000000ro02'),
  ('demo0003-el00-0000-0000-00000000us03', 'demo0003-el00-0000-0000-00000000ro03'),
  ('demo0004-ap00-0000-0000-00000000us04', 'demo0004-ap00-0000-0000-00000000ro04'),
  ('demo0005-rt00-0000-0000-00000000us05', 'demo0005-rt00-0000-0000-00000000ro05');

-- ---------------------------------------------------------------------------
-- 6. Categories
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `categories` (`id`, `tenant_id`, `name`, `description`, `is_active`)
VALUES
  ('demo0001-jw00-0000-0000-0000000cat01', 'demo0001-jw00-0000-0000-000000000001', 'Gold Jewellery', 'Rings, chains, bangles', 1),
  ('demo0001-jw00-0000-0000-0000000cat02', 'demo0001-jw00-0000-0000-000000000001', 'Diamond Jewellery', 'Certified diamond pieces', 1),
  ('demo0002-gr00-0000-0000-0000000cat03', 'demo0002-gr00-0000-0000-000000000002', 'Produce', 'Fresh fruit and vegetables — sold by weight', 1),
  ('demo0002-gr00-0000-0000-0000000cat04', 'demo0002-gr00-0000-0000-000000000002', 'Dairy', 'Milk, cheese, yoghurt', 1),
  ('demo0002-gr00-0000-0000-0000000cat05', 'demo0002-gr00-0000-0000-000000000002', 'Household', 'Non-food — taxable', 1),
  ('demo0003-el00-0000-0000-0000000cat06', 'demo0003-el00-0000-0000-000000000003', 'Mobile Phones', 'Serialised, IMEI tracked', 1),
  ('demo0003-el00-0000-0000-0000000cat07', 'demo0003-el00-0000-0000-000000000003', 'Audio', 'Headphones and speakers', 1),
  ('demo0004-ap00-0000-0000-0000000cat08', 'demo0004-ap00-0000-0000-000000000004', 'Womenswear', 'Size and colour variants', 1),
  ('demo0004-ap00-0000-0000-0000000cat09', 'demo0004-ap00-0000-0000-000000000004', 'Menswear', 'Size and colour variants', 1),
  ('demo0005-rt00-0000-0000-0000000cat10', 'demo0005-rt00-0000-0000-000000000005', 'Beach & Outdoor', 'Seasonal general merchandise', 1),
  ('demo0005-rt00-0000-0000-0000000cat11', 'demo0005-rt00-0000-0000-000000000005', 'Gifts & Souvenirs', 'Tourist gifts', 1);

-- ---------------------------------------------------------------------------
-- 7. Products — each vertical carries the fields its documents need
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `products`
  (`id`, `tenant_id`, `store_id`, `name`, `description`, `price`, `cost_price`,
   `sku`, `barcode`, `category_id`, `stock_quantity`, `low_stock_threshold`, `is_active`)
VALUES
  -- Jewelry (weights and purity live in industry_field_values / product_pieces)
  ('demo0001-jw00-0000-0000-0000000pr01', 'demo0001-jw00-0000-0000-000000000001', 'demo0001-jw00-0000-0000-00000000st01',
   '22KT Gold Bangle', '22KT, 21.9g net', 2086.17, 1620.00, 'JW-B-3310', '7290001133101', 'demo0001-jw00-0000-0000-0000000cat01', 6, 2, 1),
  ('demo0001-jw00-0000-0000-0000000pr02', 'demo0001-jw00-0000-0000-000000000001', 'demo0001-jw00-0000-0000-00000000st01',
   '22KT Gold Necklace', '22KT, 14.8g net', 1432.64, 1120.00, 'JW-N-2201', '7290001122015', 'demo0001-jw00-0000-0000-0000000cat01', 4, 2, 1),
  ('demo0001-jw00-0000-0000-0000000pr03', 'demo0001-jw00-0000-0000-000000000001', 'demo0001-jw00-0000-0000-00000000st01',
   'Diamond Stud Earrings', '18KT, 0.50ct total, G/VS1', 680.80, 495.00, 'JW-E-1104', '7290001110042', 'demo0001-jw00-0000-0000-0000000cat02', 8, 3, 1),

  -- Grocery: PLU-coded produce priced by weight, plus packaged and taxable lines
  ('demo0002-gr00-0000-0000-0000000pr04', 'demo0002-gr00-0000-0000-000000000002', 'demo0002-gr00-0000-0000-00000000st02',
   'Bananas', 'Loose, sold per kg. PLU 4011', 3.99, 2.10, 'PLU-4011', '4011', 'demo0002-gr00-0000-0000-0000000cat03', 120, 20, 1),
  ('demo0002-gr00-0000-0000-0000000pr05', 'demo0002-gr00-0000-0000-000000000002', 'demo0002-gr00-0000-0000-00000000st02',
   'Organic Avocado', 'Loose, per kg. PLU 94225 (organic = leading 9)', 12.50, 8.20, 'PLU-94225', '94225', 'demo0002-gr00-0000-0000-0000000cat03', 45, 10, 1),
  ('demo0002-gr00-0000-0000-0000000pr06', 'demo0002-gr00-0000-0000-000000000002', 'demo0002-gr00-0000-0000-00000000st02',
   'Whole Milk 2L', 'Exempt — basic food', 6.20, 4.10, 'GR-0007312', '0007312000012', 'demo0002-gr00-0000-0000-0000000cat04', 60, 12, 1),
  ('demo0002-gr00-0000-0000-0000000pr07', 'demo0002-gr00-0000-0000-000000000002', 'demo0002-gr00-0000-0000-00000000st02',
   'Dish Soap 500ml', 'Taxable — non-food', 9.50, 5.80, 'GR-0044820', '0044820000015', 'demo0002-gr00-0000-0000-0000000cat05', 40, 10, 1),

  -- Electronics: serialised, warranty-bearing
  ('demo0003-el00-0000-0000-0000000pr08', 'demo0003-el00-0000-0000-000000000003', 'demo0003-el00-0000-0000-00000000st03',
   'Smartphone X200 128GB', 'IMEI tracked, 24-month warranty', 2450.00, 1980.00, 'SP-X200-128', '8901234500018', 'demo0003-el00-0000-0000-0000000cat06', 15, 5, 1),
  ('demo0003-el00-0000-0000-0000000pr09', 'demo0003-el00-0000-0000-000000000003', 'demo0003-el00-0000-0000-00000000st03',
   'Wireless Earbuds Pro', 'Serialised, 12-month warranty', 480.00, 320.00, 'WE-PRO-2', '8901234500025', 'demo0003-el00-0000-0000-0000000cat07', 30, 8, 1),

  -- Apparel: size and colour in the SKU
  ('demo0004-ap00-0000-0000-0000000pr10', 'demo0004-ap00-0000-0000-000000000004', 'demo0004-ap00-0000-0000-00000000st04',
   'Linen Shirt — M / White', 'Size M, colour White', 189.00, 78.00, 'LS-114-M-WHT', '5060001141145', 'demo0004-ap00-0000-0000-0000000cat09', 22, 5, 1),
  ('demo0004-ap00-0000-0000-0000000pr11', 'demo0004-ap00-0000-0000-000000000004', 'demo0004-ap00-0000-0000-00000000st04',
   'Cotton Shorts — 32 / Navy', 'Size 32, colour Navy', 129.00, 52.00, 'CS-207-32-NVY', '5060002073214', 'demo0004-ap00-0000-0000-0000000cat09', 18, 5, 1),
  ('demo0004-ap00-0000-0000-0000000pr12', 'demo0004-ap00-0000-0000-000000000004', 'demo0004-ap00-0000-0000-00000000st04',
   'Cashmere Coat — M / Camel', 'Size M, colour Camel', 750.00, 340.00, 'CC-880-M-CML', '5060008801144', 'demo0004-ap00-0000-0000-0000000cat08', 6, 2, 1),

  -- General retail
  ('demo0005-rt00-0000-0000-0000000pr13', 'demo0005-rt00-0000-0000-000000000005', 'demo0005-rt00-0000-0000-00000000st05',
   'Beach Towel', 'Cotton, oversized', 45.00, 18.00, 'BT-880', '0123456788801', 'demo0005-rt00-0000-0000-0000000cat10', 55, 10, 1),
  ('demo0005-rt00-0000-0000-0000000pr14', 'demo0005-rt00-0000-0000-000000000005', 'demo0005-rt00-0000-0000-00000000st05',
   'Sunscreen SPF50', '200ml', 38.00, 15.50, 'SS-501', '0123456785012', 'demo0005-rt00-0000-0000-0000000cat10', 70, 15, 1),
  ('demo0005-rt00-0000-0000-0000000pr15', 'demo0005-rt00-0000-0000-000000000005', 'demo0005-rt00-0000-0000-00000000st05',
   'Straw Hat', 'One size', 65.00, 24.00, 'SH-220', '0123456782205', 'demo0005-rt00-0000-0000-0000000cat11', 35, 8, 1);

-- ---------------------------------------------------------------------------
-- 8. Customers
-- ---------------------------------------------------------------------------
-- The jewelry tenant gets a TRAVELLER (passport on file) because it is the
-- duty-free demo — without one, the duty-free document cannot be exercised.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `customers`
  (`id`, `tenant_id`, `store_id`, `first_name`, `last_name`, `email`, `phone_number`,
   `address_line1`, `city`, `state_province`, `postal_code`, `country`,
   `customer_type`, `tax_id_number`, `is_active`)
VALUES
  -- Traveller: passport-bearing, so the duty-free document can be exercised.
  ('demo0001-jw00-0000-0000-0000000cu01', 'demo0001-jw00-0000-0000-000000000001', 'demo0001-jw00-0000-0000-00000000st01',
   'Jane', 'Doe', 'jane.doe@example.com', '+1-555-0123',
   '456 Traveler Ave', 'New York', 'NY', '10001', 'USA', 'INDIVIDUAL', 'TAX-12345678', 1),

  ('demo0002-gr00-0000-0000-0000000cu02', 'demo0002-gr00-0000-0000-000000000002', 'demo0002-gr00-0000-0000-00000000st02',
   'Marcia', 'Joseph', 'marcia.joseph@example.ag', '+1-268-555-0142',
   '14 Cassada Gardens', 'St. Johns', 'St. John', 'AG-1000', 'Antigua and Barbuda', 'INDIVIDUAL', NULL, 1),

  ('demo0003-el00-0000-0000-0000000cu03', 'demo0003-el00-0000-0000-000000000003', 'demo0003-el00-0000-0000-00000000st03',
   'Omar', 'Al-Rashid', 'omar@example.ae', '+971-50-555-0611',
   'Marina Walk', 'Dubai', 'Dubai', '00000', 'United Arab Emirates', 'INDIVIDUAL', 'TRN-100234567', 1),

  -- Business customer: carries a VAT number, so reverse-charge invoicing can be tested.
  ('demo0004-ap00-0000-0000-0000000cu04', 'demo0004-ap00-0000-0000-000000000004', 'demo0004-ap00-0000-0000-00000000st04',
   'Eleanor', 'Whitfield', 'eleanor@example.co.uk', '+44-7700-900733',
   '22 Marylebone Lane', 'London', 'Greater London', 'W1U 2QL', 'United Kingdom', 'BUSINESS', 'GB432109876', 1),

  ('demo0005-rt00-0000-0000-0000000cu05', 'demo0005-rt00-0000-0000-000000000005', 'demo0005-rt00-0000-0000-00000000st05',
   'Carlos', 'Mendez', 'carlos@example.com', '+1-305-555-0199',
   '88 Ocean Drive', 'Miami', 'FL', '33101', 'USA', 'INDIVIDUAL', NULL, 1);


-- =============================================================================
-- TEARDOWN — remove every demo tenant
-- =============================================================================
-- Run this block to reset. FK cascades handle the child rows.
--
--   SET @ids = 'demo0001-jw00-0000-0000-000000000001,demo0002-gr00-0000-0000-000000000002,
--               demo0003-el00-0000-0000-000000000003,demo0004-ap00-0000-0000-000000000004,
--               demo0005-rt00-0000-0000-000000000005';
--
--   DELETE FROM print_templates WHERE tenant_id LIKE 'demo000%';
--   DELETE FROM store_jurisdiction_settings WHERE tenant_id LIKE 'demo000%';
--   DELETE FROM products   WHERE tenant_id LIKE 'demo000%';
--   DELETE FROM categories WHERE tenant_id LIKE 'demo000%';
--   DELETE FROM customers  WHERE tenant_id LIKE 'demo000%';
--   DELETE FROM user_roles WHERE user_id  LIKE 'demo000%';
--   DELETE FROM roles      WHERE tenant_id LIKE 'demo000%';
--   DELETE FROM users      WHERE tenant_id LIKE 'demo000%';
--   DELETE FROM stores     WHERE tenant_id LIKE 'demo000%';
--   DELETE FROM tenants    WHERE id       LIKE 'demo000%';
-- =============================================================================
