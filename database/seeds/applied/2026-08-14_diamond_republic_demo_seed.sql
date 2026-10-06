-- =============================================================================
-- Demo Seed: Diamond Republic
-- Date: 2026-08-14
-- Purpose: Full jewelry demo tenant with realistic Indian jewelry inventory
--          covering Gold, Silver, Platinum, Diamond (certified), and Fashion pieces.
-- Password for all users: same hash as Zettaz demo → (same password as admin@zettaz.com)
-- Idempotent: INSERT IGNORE throughout.
-- =============================================================================

-- Fixed UUIDs (stable across re-runs)
-- Tenant:         e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c
-- Store:          a1b2c3d4-e5f6-7890-abcd-ef1234567890
-- Admin User:     b1c2d3e4-f5a6-7890-bcde-f12345678901
-- Role Admin:     r1000000-0000-0000-0000-000000000001
-- Role Manager:   r1000000-0000-0000-0000-000000000002
-- Role Cashier:   r1000000-0000-0000-0000-000000000003
-- Cat Gold:       c1000000-0000-0000-0000-000000000001
-- Cat Silv:       c1000000-0000-0000-0000-000000000002
-- Cat Diam:       c1000000-0000-0000-0000-000000000003
-- Cat Plat:       c1000000-0000-0000-0000-000000000004
-- Cat Fash:       c1000000-0000-0000-0000-000000000005

-- ---------------------------------------------------------------------------
-- 1. Tenant
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `tenants`
  (`id`, `name`, `domain`, `industry_code`, `settings`, `created_at`, `updated_at`)
VALUES (
  'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
  'Diamond Republic',
  'diamondrepublic.in',
  'jewelry',
  '{"allow_negative_stock": false, "businessType": "jewelry"}',
  '2026-08-14 06:00:00',
  '2026-08-14 06:00:00'
);

-- ---------------------------------------------------------------------------
-- 2. Store
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `stores`
  (`id`, `tenant_id`, `name`, `address`, `phone`, `email`,
   `tax_rate`, `currency_code`, `language_code`, `country_code`,
   `date_format`, `time_format`, `timezone`, `number_format`,
   `decimal_precision`, `locale_code`, `measurement_system`,
   `allow_negative_stock`, `allow_over_receiving`,
   `discount_application_rule`, `default_tax_basis`,
   `tax_config`, `created_at`, `updated_at`)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
  'Diamond Republic – T. Nagar',
  'No. 12, Usman Road, T. Nagar, Chennai – 600 017, Tamil Nadu',
  '+91 98400 12345',
  'sales@diamondrepublic.in',
  3.00,        -- GST on gold jewelry is 3%
  'INR',
  'en',
  'IN',
  'DD/MM/YYYY',
  'hh:mm A',
  'Asia/Kolkata',
  '1,23,456.78',  -- Indian number format
  2,
  'en-IN',
  'metric',
  0,           -- jewelry store, no negative stock
  0,
  'BEFORE_TAX',
  'EXCLUSIVE',
  '{"rules": [], "default_rate": 0.03}',
  '2026-08-14 06:00:00',
  '2026-08-14 06:00:00'
);

-- ---------------------------------------------------------------------------
-- 3. Admin User  (no 'role' column – RBAC handles that below)
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `users`
  (`id`, `tenant_id`, `store_id`, `name`, `email`, `phone_number`,
   `password_hash`, `is_active`, `email_verified`, `signup_completed`,
   `created_at`, `updated_at`)
VALUES (
  'b1c2d3e4-f5a6-7890-bcde-f12345678901',
  'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Rahul Mehta',
  'admin@diamondrepublic.in',
  '+91 98400 12345',
  '$2a$12$z.PB2zdDXrzO0zQ3NcwQAOG0dKWis1c6A.CeKWwLheAfoYZ3wv.J2',
  1, 1, 1,
  '2026-08-14 06:00:00',
  '2026-08-14 06:00:00'
);

-- ---------------------------------------------------------------------------
-- 4. RBAC Roles for Diamond Republic tenant
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `roles`
  (`id`, `tenant_id`, `name`, `description`, `is_system_role`, `created_by`)
VALUES
  ('r1000000-0000-0000-0000-000000000001',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'Tenant Admin', 'Full tenant administrative access', 1,
   'b1c2d3e4-f5a6-7890-bcde-f12345678901'),
  ('r1000000-0000-0000-0000-000000000002',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'Store Manager', 'Full management of assigned stores', 1,
   'b1c2d3e4-f5a6-7890-bcde-f12345678901'),
  ('r1000000-0000-0000-0000-000000000003',
   'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'Cashier', 'Basic sales and customer management', 1,
   'b1c2d3e4-f5a6-7890-bcde-f12345678901');

-- Assign all permissions to Tenant Admin role
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT 'r1000000-0000-0000-0000-000000000001', `id` FROM `permissions`;

-- Assign admin user to Tenant Admin role (tenant-scoped)
INSERT IGNORE INTO `user_roles`
  (`id`, `user_id`, `role_id`, `scope`, `assigned_by`, `created_at`, `updated_at`)
VALUES (
  'ur100000-0000-0000-0000-000000000001',
  'b1c2d3e4-f5a6-7890-bcde-f12345678901',
  'r1000000-0000-0000-0000-000000000001',
  'tenant',
  'b1c2d3e4-f5a6-7890-bcde-f12345678901',
  '2026-08-14 06:00:00',
  '2026-08-14 06:00:00'
);

-- ---------------------------------------------------------------------------
-- 5. Categories
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `categories`
  (`id`, `tenant_id`, `name`, `description`, `is_active`, `created_by_user_id`, `updated_by_user_id`, `created_at`, `updated_at`)
VALUES
  ('c1000000-0000-0000-0000-000000000001', 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'Gold Jewellery', '22K and 18K gold pieces – rings, necklaces, bangles, chains', 1,
   'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

  ('c1000000-0000-0000-0000-000000000002', 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'Silver Jewellery', '925 sterling silver – anklets, necklaces, earrings, rings', 1,
   'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

  ('c1000000-0000-0000-0000-000000000003', 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'Diamond Jewellery', 'Certified diamond pieces – GIA, IGI and BIS certified', 1,
   'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

  ('c1000000-0000-0000-0000-000000000004', 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'Platinum Jewellery', 'Pt 950 platinum pieces – bands, bracelets', 1,
   'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

  ('c1000000-0000-0000-0000-000000000005', 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
   'Fashion Jewellery', 'Brass and oxidised silver fashion pieces', 1,
   'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
   '2026-08-14 06:00:00', '2026-08-14 06:00:00');

-- ---------------------------------------------------------------------------
-- 6. Products (35 pieces)
--    price       = selling price (INR, ex-GST)
--    cost_price  = gold rate × net weight + making + stone value
--    attributes  = industry dynamic fields (jewelry)
--
--    Gold rate used for seed: ₹9,500/g (22K approx Aug 2026)
--    Silver rate: ₹115/g | Platinum rate: ₹5,800/g
-- ---------------------------------------------------------------------------

-- ── GOLD RINGS ──────────────────────────────────────────────────────────────

INSERT IGNORE INTO `products`
  (`id`, `tenant_id`, `store_id`, `name`, `description`, `price`, `cost_price`,
   `purchase_price`, `markup_pct`, `sku`, `barcode`, `category_id`,
   `stock_quantity`, `low_stock_threshold`, `is_active`, `attributes`,
   `created_by_user_id`, `updated_by_user_id`, `created_at`, `updated_at`)
VALUES

-- 1. Classic Plain Gold Ring
('dr000001-0000-0000-0000-000000000001',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Classic Plain Gold Ring',
 'Elegant plain gold ring in 22K yellow gold. Timeless design suitable for daily wear.',
 48500.00, 43000.00, 40000.00, 12.79,
 'DR-GR-001', '8901234560001',
 'c1000000-0000-0000-0000-000000000001',
 3, 1, 1,
 '{
   "product_type": "Ring",
   "metal_type": "Gold", "metal_colour": "Yellow",
   "purity": "22K (916)",
   "gross_weight": 5.2, "net_weight": 5.0,
   "wastage_pct": 4.0,
   "stone_type": "No Stone",
   "making_charge": 3000,
   "hallmark_huid": "HUID-DR0001",
   "design_no": "GR-001",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- 2. Floral Gold Ring
('dr000001-0000-0000-0000-000000000002',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Floral Motif Gold Ring',
 '22K yellow gold ring with hand-engraved floral pattern. BIS hallmarked.',
 62000.00, 55000.00, 51000.00, 12.73,
 'DR-GR-002', '8901234560002',
 'c1000000-0000-0000-0000-000000000001',
 2, 1, 1,
 '{
   "product_type": "Ring",
   "metal_type": "Gold", "metal_colour": "Yellow",
   "purity": "22K (916)",
   "gross_weight": 6.8, "net_weight": 6.5,
   "wastage_pct": 4.5,
   "stone_type": "No Stone",
   "making_charge": 4200,
   "hallmark_huid": "HUID-DR0002",
   "design_no": "GR-002",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- 3. Ruby Cocktail Ring
('dr000001-0000-0000-0000-000000000003',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Ruby Cocktail Ring 22K',
 '22K gold cocktail ring set with a natural ruby centre stone. Vintage-inspired design.',
 95000.00, 88000.00, 82000.00, 7.32,
 'DR-GR-003', '8901234560003',
 'c1000000-0000-0000-0000-000000000001',
 1, 1, 1,
 '{
   "product_type": "Ring",
   "metal_type": "Gold", "metal_colour": "Yellow",
   "purity": "22K (916)",
   "gross_weight": 7.5, "net_weight": 7.1,
   "wastage_pct": 5.0,
   "stone_type": "Ruby",
   "number_of_stones": 1,
   "stone_weight": 1.2,
   "stone_quality": "AAA – Natural, no heat",
   "stone_value": 15000,
   "making_charge": 6500,
   "hallmark_huid": "HUID-DR0003",
   "design_no": "GR-003",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00');

INSERT IGNORE INTO `products`
  (`id`, `tenant_id`, `store_id`, `name`, `description`, `price`, `cost_price`,
   `purchase_price`, `markup_pct`, `sku`, `barcode`, `category_id`,
   `stock_quantity`, `low_stock_threshold`, `is_active`, `attributes`,
   `created_by_user_id`, `updated_by_user_id`, `created_at`, `updated_at`)
VALUES

-- ── GOLD NECKLACES ──────────────────────────────────────────────────────────

-- 4. Traditional Gold Necklace
('dr000001-0000-0000-0000-000000000004',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Traditional Choker Necklace 22K',
 'Heavy 22K yellow gold traditional choker necklace. South Indian bridal design.',
 185000.00, 165000.00, 152000.00, 12.12,
 'DR-GN-001', '8901234560004',
 'c1000000-0000-0000-0000-000000000001',
 1, 1, 1,
 '{
   "product_type": "Necklace",
   "metal_type": "Gold", "metal_colour": "Yellow",
   "purity": "22K (916)",
   "gross_weight": 19.5, "net_weight": 18.5,
   "wastage_pct": 5.4,
   "stone_type": "No Stone",
   "making_charge": 14000,
   "hallmark_huid": "HUID-DR0004",
   "design_no": "GN-001",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- 5. Mangalsutra
('dr000001-0000-0000-0000-000000000005',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Gold Mangalsutra with Black Beads',
 '22K gold mangalsutra with traditional black bead chain and gold pendant. BIS hallmarked.',
 82000.00, 73000.00, 68000.00, 12.33,
 'DR-GN-002', '8901234560005',
 'c1000000-0000-0000-0000-000000000001',
 2, 1, 1,
 '{
   "product_type": "Mangalsutra",
   "metal_type": "Gold", "metal_colour": "Yellow",
   "purity": "22K (916)",
   "gross_weight": 8.8, "net_weight": 8.2,
   "wastage_pct": 6.8,
   "stone_type": "No Stone",
   "making_charge": 5500,
   "hallmark_huid": "HUID-DR0005",
   "design_no": "GN-002",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- 6. Haar (Long Gold Necklace)
('dr000001-0000-0000-0000-000000000006',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Bridal Gold Haar',
 '22K yellow gold long haar with intricate temple design. Bridal collection piece.',
 415000.00, 370000.00, 342000.00, 12.16,
 'DR-GN-003', '8901234560006',
 'c1000000-0000-0000-0000-000000000001',
 1, 1, 1,
 '{
   "product_type": "Haar",
   "metal_type": "Gold", "metal_colour": "Yellow",
   "purity": "22K (916)",
   "gross_weight": 42.0, "net_weight": 40.0,
   "wastage_pct": 5.0,
   "stone_type": "No Stone",
   "making_charge": 28000,
   "hallmark_huid": "HUID-DR0006",
   "design_no": "GN-003",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- ── GOLD EARRINGS ────────────────────────────────────────────────────────────

-- 7. Gold Jhumka Earrings
('dr000001-0000-0000-0000-000000000007',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Traditional Jhumka Earrings 22K',
 '22K yellow gold jhumka with hanging bells. South Indian temple jewellery style.',
 62000.00, 55000.00, 51000.00, 12.73,
 'DR-GE-001', '8901234560007',
 'c1000000-0000-0000-0000-000000000001',
 2, 1, 1,
 '{
   "product_type": "Jhumka",
   "metal_type": "Gold", "metal_colour": "Yellow",
   "purity": "22K (916)",
   "gross_weight": 6.5, "net_weight": 6.2,
   "wastage_pct": 4.6,
   "stone_type": "No Stone",
   "making_charge": 4800,
   "hallmark_huid": "HUID-DR0007",
   "design_no": "GE-001",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- 8. Rose Gold Drop Earrings
('dr000001-0000-0000-0000-000000000008',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Rose Gold Teardrop Earrings 18K',
 '18K rose gold modern teardrop earrings with satin finish.',
 48000.00, 42000.00, 39000.00, 14.29,
 'DR-GE-002', '8901234560008',
 'c1000000-0000-0000-0000-000000000001',
 3, 1, 1,
 '{
   "product_type": "Earrings",
   "metal_type": "Gold", "metal_colour": "Rose / Pink",
   "purity": "18K (750)",
   "gross_weight": 4.8, "net_weight": 4.5,
   "wastage_pct": 6.25,
   "stone_type": "No Stone",
   "making_charge": 3800,
   "hallmark_huid": "HUID-DR0008",
   "design_no": "GE-002",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- ── GOLD BANGLES ─────────────────────────────────────────────────────────────

-- 9. Plain Gold Bangle
('dr000001-0000-0000-0000-000000000009',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Plain Gold Bangle 22K',
 '22K yellow gold plain round bangle. Size 2.6. Sold as single piece.',
 125000.00, 111000.00, 103000.00, 12.61,
 'DR-GB-001', '8901234560009',
 'c1000000-0000-0000-0000-000000000001',
 4, 2, 1,
 '{
   "product_type": "Bangle",
   "metal_type": "Gold", "metal_colour": "Yellow",
   "purity": "22K (916)",
   "gross_weight": 13.0, "net_weight": 12.5,
   "wastage_pct": 4.0,
   "stone_type": "No Stone",
   "making_charge": 7500,
   "hallmark_huid": "HUID-DR0009",
   "design_no": "GB-001",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- 10. Antique Kangan (Pair)
('dr000001-0000-0000-0000-000000000010',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Antique Kangan Set 22K (Pair)',
 '22K antique finish kangan pair with meenakari motifs. Bridal collection.',
 285000.00, 254000.00, 235000.00, 12.20,
 'DR-GB-002', '8901234560010',
 'c1000000-0000-0000-0000-000000000001',
 1, 1, 1,
 '{
   "product_type": "Bangle",
   "metal_type": "Gold", "metal_colour": "Yellow",
   "purity": "22K (916)",
   "gross_weight": 29.5, "net_weight": 28.0,
   "wastage_pct": 5.36,
   "stone_type": "No Stone",
   "making_charge": 20000,
   "hallmark_huid": "HUID-DR0010",
   "design_no": "GB-002",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- ── GOLD CHAINS ──────────────────────────────────────────────────────────────

-- 11. Singapore Chain
('dr000001-0000-0000-0000-000000000011',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Singapore Chain 22K – 18 inch',
 '22K yellow gold Singapore box chain, 18 inches. Lightweight and elegant.',
 82000.00, 73000.00, 67500.00, 12.33,
 'DR-GC-001', '8901234560011',
 'c1000000-0000-0000-0000-000000000001',
 3, 1, 1,
 '{
   "product_type": "Chain",
   "metal_type": "Gold", "metal_colour": "Yellow",
   "purity": "22K (916)",
   "gross_weight": 8.5, "net_weight": 8.2,
   "wastage_pct": 3.66,
   "stone_type": "No Stone",
   "making_charge": 4500,
   "hallmark_huid": "HUID-DR0011",
   "design_no": "GC-001",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- 12. Rope Chain
('dr000001-0000-0000-0000-000000000012',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Rope Twist Chain 22K – 20 inch',
 '22K yellow gold rope twist chain, 20 inches with lobster clasp.',
 102000.00, 91000.00, 84000.00, 12.09,
 'DR-GC-002', '8901234560012',
 'c1000000-0000-0000-0000-000000000001',
 2, 1, 1,
 '{
   "product_type": "Chain",
   "metal_type": "Gold", "metal_colour": "Yellow",
   "purity": "22K (916)",
   "gross_weight": 10.5, "net_weight": 10.0,
   "wastage_pct": 5.0,
   "stone_type": "No Stone",
   "making_charge": 5500,
   "hallmark_huid": "HUID-DR0012",
   "design_no": "GC-002",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- ── GOLD PENDANTS ────────────────────────────────────────────────────────────

-- 13. Lord Ganesh Pendant
('dr000001-0000-0000-0000-000000000013',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Lord Ganesh Pendant 22K',
 '22K gold Lord Ganesh pendant with intricate detailing. Highly auspicious.',
 32000.00, 28500.00, 26400.00, 12.28,
 'DR-GP-001', '8901234560013',
 'c1000000-0000-0000-0000-000000000001',
 5, 2, 1,
 '{
   "product_type": "Pendant",
   "metal_type": "Gold", "metal_colour": "Yellow",
   "purity": "22K (916)",
   "gross_weight": 3.2, "net_weight": 3.0,
   "wastage_pct": 6.67,
   "stone_type": "No Stone",
   "making_charge": 2200,
   "hallmark_huid": "HUID-DR0013",
   "design_no": "GP-001",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- 14. Om Pendant
('dr000001-0000-0000-0000-000000000014',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Om Symbol Pendant 22K',
 '22K yellow gold Om symbol pendant with matte finish. Spiritual jewellery.',
 26500.00, 23500.00, 21700.00, 12.77,
 'DR-GP-002', '8901234560014',
 'c1000000-0000-0000-0000-000000000001',
 6, 2, 1,
 '{
   "product_type": "Pendant",
   "metal_type": "Gold", "metal_colour": "Yellow",
   "purity": "22K (916)",
   "gross_weight": 2.7, "net_weight": 2.5,
   "wastage_pct": 8.0,
   "stone_type": "No Stone",
   "making_charge": 1800,
   "hallmark_huid": "HUID-DR0014",
   "design_no": "GP-002",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- 15. Gold Anklet
('dr000001-0000-0000-0000-000000000015',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Gold Anklet 22K (Single)',
 '22K yellow gold anklet with ghungroo bells. Traditional design. Sold as single piece.',
 52000.00, 46000.00, 42600.00, 13.04,
 'DR-GA-001', '8901234560015',
 'c1000000-0000-0000-0000-000000000001',
 4, 2, 1,
 '{
   "product_type": "Anklet",
   "metal_type": "Gold", "metal_colour": "Yellow",
   "purity": "22K (916)",
   "gross_weight": 5.5, "net_weight": 5.2,
   "wastage_pct": 5.77,
   "stone_type": "No Stone",
   "making_charge": 3800,
   "hallmark_huid": "HUID-DR0015",
   "design_no": "GA-001",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- ── SILVER JEWELLERY ─────────────────────────────────────────────────────────

-- 16. Silver Payal (Anklet Pair)
('dr000001-0000-0000-0000-000000000016',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Silver Payal (Pair) 925',
 '925 sterling silver traditional payal with bells. Set of two. BIS marked.',
 2800.00, 2200.00, 2000.00, 27.27,
 'DR-SA-001', '8901234560016',
 'c1000000-0000-0000-0000-000000000002',
 8, 3, 1,
 '{
   "product_type": "Anklet",
   "metal_type": "Silver",
   "purity": "925 Sterling Silver",
   "gross_weight": 26.0, "net_weight": 25.0,
   "stone_type": "No Stone",
   "making_charge": 450,
   "hallmark_huid": "SILV-DR0016",
   "design_no": "SA-001",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- 17. Silver Necklace
('dr000001-0000-0000-0000-000000000017',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Silver Layered Necklace 925',
 '925 sterling silver multi-layered necklace with leaf motif charms.',
 3600.00, 2900.00, 2650.00, 24.14,
 'DR-SN-001', '8901234560017',
 'c1000000-0000-0000-0000-000000000002',
 6, 2, 1,
 '{
   "product_type": "Necklace",
   "metal_type": "Silver",
   "purity": "925 Sterling Silver",
   "gross_weight": 32.0, "net_weight": 30.5,
   "stone_type": "No Stone",
   "making_charge": 600,
   "hallmark_huid": "SILV-DR0017",
   "design_no": "SN-001",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- 18. Silver Bracelet
('dr000001-0000-0000-0000-000000000018',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Silver Chain Bracelet 925',
 '925 sterling silver box chain bracelet with toggle clasp.',
 1750.00, 1350.00, 1250.00, 29.63,
 'DR-SB-001', '8901234560018',
 'c1000000-0000-0000-0000-000000000002',
 10, 3, 1,
 '{
   "product_type": "Bracelet",
   "metal_type": "Silver",
   "purity": "925 Sterling Silver",
   "gross_weight": 15.5, "net_weight": 15.0,
   "stone_type": "No Stone",
   "making_charge": 250,
   "hallmark_huid": "SILV-DR0018",
   "design_no": "SB-001",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- 19. Silver Ring
('dr000001-0000-0000-0000-000000000019',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Silver Oxidised Statement Ring 925',
 '925 silver oxidised ring with tribal motif. Adjustable size.',
 650.00, 480.00, 440.00, 35.42,
 'DR-SR-001', '8901234560019',
 'c1000000-0000-0000-0000-000000000002',
 15, 5, 1,
 '{
   "product_type": "Ring",
   "metal_type": "Silver",
   "purity": "925 Sterling Silver",
   "gross_weight": 5.2, "net_weight": 5.0,
   "stone_type": "No Stone",
   "making_charge": 100,
   "design_no": "SR-001",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- 20. Silver Earrings
('dr000001-0000-0000-0000-000000000020',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Silver Jhumka Earrings 925',
 '925 silver traditional jhumka earrings with ghungroo drops.',
 980.00, 760.00, 700.00, 28.95,
 'DR-SE-001', '8901234560020',
 'c1000000-0000-0000-0000-000000000002',
 12, 4, 1,
 '{
   "product_type": "Jhumka",
   "metal_type": "Silver",
   "purity": "925 Sterling Silver",
   "gross_weight": 8.5, "net_weight": 8.0,
   "stone_type": "No Stone",
   "making_charge": 150,
   "design_no": "SE-001",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- ── DIAMOND JEWELLERY (Certified) ────────────────────────────────────────────

-- 21. GIA Solitaire Diamond Ring
('dr000001-0000-0000-0000-000000000021',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'GIA Solitaire Diamond Ring 18K',
 '18K white gold solitaire ring set with a GIA certified 0.50ct F/VS1 round brilliant diamond.',
 185000.00, 162000.00, 150000.00, 14.20,
 'DR-DR-001', '8901234560021',
 'c1000000-0000-0000-0000-000000000003',
 1, 1, 1,
 '{
   "product_type": "Ring",
   "metal_type": "Gold", "metal_colour": "White",
   "purity": "18K (750)",
   "gross_weight": 4.0, "net_weight": 3.8,
   "stone_type": "Diamond",
   "number_of_stones": 1,
   "stone_weight": 0.50,
   "stone_quality": "F/VS1/EX – Round Brilliant",
   "stone_value": 95000,
   "stone_certification": "GIA",
   "certificate_no": "GIA-2326541892",
   "making_charge": 8500,
   "hallmark_huid": "HUID-DR0021",
   "design_no": "DR-001",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- 22. IGI Diamond Pendant
('dr000001-0000-0000-0000-000000000022',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'IGI Diamond Pendant 18K',
 '18K white gold diamond pendant. IGI certified 0.25ct G/VS2 princess cut centre.',
 74000.00, 64500.00, 59500.00, 14.73,
 'DR-DR-002', '8901234560022',
 'c1000000-0000-0000-0000-000000000003',
 2, 1, 1,
 '{
   "product_type": "Pendant",
   "metal_type": "Gold", "metal_colour": "White",
   "purity": "18K (750)",
   "gross_weight": 2.6, "net_weight": 2.4,
   "stone_type": "Diamond",
   "number_of_stones": 1,
   "stone_weight": 0.25,
   "stone_quality": "G/VS2/VG – Princess Cut",
   "stone_value": 38000,
   "stone_certification": "IGI",
   "certificate_no": "IGI-LG-536218940",
   "making_charge": 5500,
   "hallmark_huid": "HUID-DR0022",
   "design_no": "DR-002",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- 23. Diamond Stud Earrings
('dr000001-0000-0000-0000-000000000023',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Diamond Stud Earrings 18K',
 '18K white gold prong-set diamond stud earrings. Total diamond weight 0.40ct.',
 88000.00, 77000.00, 71000.00, 14.29,
 'DR-DR-003', '8901234560023',
 'c1000000-0000-0000-0000-000000000003',
 3, 1, 1,
 '{
   "product_type": "Earrings",
   "metal_type": "Gold", "metal_colour": "White",
   "purity": "18K (750)",
   "gross_weight": 2.9, "net_weight": 2.7,
   "stone_type": "Diamond",
   "number_of_stones": 2,
   "stone_weight": 0.40,
   "stone_quality": "G/VS2/EX – Round Brilliant",
   "stone_value": 60000,
   "stone_certification": "IGI",
   "certificate_no": "IGI-LG-987312045",
   "making_charge": 6000,
   "hallmark_huid": "HUID-DR0023",
   "design_no": "DR-003",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- 24. Diamond Tennis Bracelet
('dr000001-0000-0000-0000-000000000024',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Diamond Tennis Bracelet 18K',
 '18K white gold diamond tennis bracelet with 25 round brilliant diamonds. Total 2.0ct.',
 465000.00, 415000.00, 385000.00, 12.05,
 'DR-DR-004', '8901234560024',
 'c1000000-0000-0000-0000-000000000003',
 1, 1, 1,
 '{
   "product_type": "Bracelet",
   "metal_type": "Gold", "metal_colour": "White",
   "purity": "18K (750)",
   "gross_weight": 8.5, "net_weight": 8.0,
   "stone_type": "Diamond",
   "number_of_stones": 25,
   "stone_weight": 2.00,
   "stone_quality": "H/SI1/VG – Round Brilliant",
   "stone_value": 280000,
   "stone_certification": "SGL",
   "certificate_no": "SGL-BRC-2026-0814",
   "making_charge": 18000,
   "hallmark_huid": "HUID-DR0024",
   "design_no": "DR-004",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- 25. Diamond Necklace
('dr000001-0000-0000-0000-000000000025',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Diamond Cluster Necklace 18K',
 '18K yellow gold diamond cluster necklace. 12 round diamonds totalling 0.60ct.',
 145000.00, 128000.00, 118000.00, 13.28,
 'DR-DR-005', '8901234560025',
 'c1000000-0000-0000-0000-000000000003',
 1, 1, 1,
 '{
   "product_type": "Necklace",
   "metal_type": "Gold", "metal_colour": "Yellow",
   "purity": "18K (750)",
   "gross_weight": 6.8, "net_weight": 6.4,
   "stone_type": "Diamond",
   "number_of_stones": 12,
   "stone_weight": 0.60,
   "stone_quality": "G/SI1/VG – Round Brilliant",
   "stone_value": 72000,
   "stone_certification": "IGI",
   "certificate_no": "IGI-LG-102938471",
   "making_charge": 12000,
   "hallmark_huid": "HUID-DR0025",
   "design_no": "DR-005",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- 26. Diamond Bangle
('dr000001-0000-0000-0000-000000000026',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Diamond Bangle 18K White Gold',
 '18K white gold half-eternity bangle with 0.80ct round brilliant diamonds.',
 210000.00, 187000.00, 173000.00, 12.30,
 'DR-DR-006', '8901234560026',
 'c1000000-0000-0000-0000-000000000003',
 1, 1, 1,
 '{
   "product_type": "Bangle",
   "metal_type": "Gold", "metal_colour": "White",
   "purity": "18K (750)",
   "gross_weight": 10.5, "net_weight": 9.8,
   "stone_type": "Diamond",
   "number_of_stones": 18,
   "stone_weight": 0.80,
   "stone_quality": "F/VS2/EX – Round Brilliant",
   "stone_value": 115000,
   "stone_certification": "GIA",
   "certificate_no": "GIA-6174398025",
   "making_charge": 16000,
   "hallmark_huid": "HUID-DR0026",
   "design_no": "DR-006",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- ── PLATINUM JEWELLERY ───────────────────────────────────────────────────────

-- 27. Platinum Wedding Band
('dr000001-0000-0000-0000-000000000027',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Platinum Wedding Band Pt 950',
 'Pt 950 platinum plain wedding band. Comfort fit, 4mm width.',
 46000.00, 40500.00, 37500.00, 13.58,
 'DR-PR-001', '8901234560027',
 'c1000000-0000-0000-0000-000000000004',
 3, 1, 1,
 '{
   "product_type": "Ring",
   "metal_type": "Platinum",
   "purity": "Pt 950",
   "gross_weight": 7.5, "net_weight": 7.2,
   "stone_type": "No Stone",
   "making_charge": 3500,
   "hallmark_huid": "PLAT-DR0027",
   "design_no": "PR-001",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- 28. Platinum Diamond Ring
('dr000001-0000-0000-0000-000000000028',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Platinum Solitaire Ring Pt 950 with Diamond',
 'Pt 950 platinum ring with 0.30ct GIA certified E/VVS1 round brilliant diamond.',
 165000.00, 146000.00, 135000.00, 12.88,
 'DR-PR-002', '8901234560028',
 'c1000000-0000-0000-0000-000000000004',
 1, 1, 1,
 '{
   "product_type": "Ring",
   "metal_type": "Platinum",
   "purity": "Pt 950",
   "gross_weight": 6.0, "net_weight": 5.7,
   "stone_type": "Diamond",
   "number_of_stones": 1,
   "stone_weight": 0.30,
   "stone_quality": "E/VVS1/EX – Round Brilliant",
   "stone_value": 78000,
   "stone_certification": "GIA",
   "certificate_no": "GIA-7193084521",
   "making_charge": 9500,
   "hallmark_huid": "PLAT-DR0028",
   "design_no": "PR-002",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- 29. Platinum Bracelet
('dr000001-0000-0000-0000-000000000029',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Platinum Box Chain Bracelet Pt 950',
 'Pt 950 platinum box chain bracelet, 7.5 inch, with lobster clasp.',
 74000.00, 65500.00, 60500.00, 12.98,
 'DR-PB-001', '8901234560029',
 'c1000000-0000-0000-0000-000000000004',
 2, 1, 1,
 '{
   "product_type": "Bracelet",
   "metal_type": "Platinum",
   "purity": "Pt 950",
   "gross_weight": 12.5, "net_weight": 12.0,
   "stone_type": "No Stone",
   "making_charge": 6500,
   "hallmark_huid": "PLAT-DR0029",
   "design_no": "PB-001",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- ── FASHION JEWELLERY (Brass) ─────────────────────────────────────────────────

-- 30. Oxidised Jhumka
('dr000001-0000-0000-0000-000000000030',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Oxidised Silver Jhumka Earrings',
 'Brass base oxidised silver finish jhumka earrings with thread tassel.',
 450.00, 180.00, 160.00, 150.00,
 'DR-FE-001', '8901234560030',
 'c1000000-0000-0000-0000-000000000005',
 25, 10, 1,
 '{
   "product_type": "Jhumka",
   "metal_type": "Brass",
   "stone_type": "No Stone",
   "design_no": "FE-001",
   "hsn_code": "7117"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- 31. Kundan Necklace Set
('dr000001-0000-0000-0000-000000000031',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Kundan Bridal Necklace Set',
 'Brass Kundan necklace set with earrings and maangtikka. Bridal fashion jewellery.',
 1250.00, 480.00, 430.00, 160.42,
 'DR-FN-001', '8901234560031',
 'c1000000-0000-0000-0000-000000000005',
 15, 5, 1,
 '{
   "product_type": "Necklace",
   "metal_type": "Brass",
   "stone_type": "Other",
   "number_of_stones": 42,
   "design_no": "FN-001",
   "hsn_code": "7117"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- 32. Pearl Bracelet
('dr000001-0000-0000-0000-000000000032',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Freshwater Pearl Stretch Bracelet',
 'Genuine freshwater pearl stretch bracelet on elastic cord. 8mm pearls.',
 850.00, 420.00, 380.00, 102.38,
 'DR-FB-001', '8901234560032',
 'c1000000-0000-0000-0000-000000000005',
 20, 8, 1,
 '{
   "product_type": "Bracelet",
   "metal_type": "Brass",
   "stone_type": "Pearl",
   "number_of_stones": 22,
   "design_no": "FB-001",
   "hsn_code": "7116"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- 33. Oxidised Choker
('dr000001-0000-0000-0000-000000000033',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Oxidised Silver Choker Necklace',
 'Brass oxidised finish choker with turquoise stone accents.',
 950.00, 380.00, 340.00, 150.00,
 'DR-FN-002', '8901234560033',
 'c1000000-0000-0000-0000-000000000005',
 18, 6, 1,
 '{
   "product_type": "Necklace",
   "metal_type": "Brass",
   "stone_type": "Other",
   "number_of_stones": 8,
   "design_no": "FN-002",
   "hsn_code": "7117"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- ── SPECIAL / BRIDAL ─────────────────────────────────────────────────────────

-- 34. Emerald Gold Ring
('dr000001-0000-0000-0000-000000000034',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Colombian Emerald Gold Ring 22K',
 '22K yellow gold ring featuring a natural Colombian emerald centre stone.',
 128000.00, 113000.00, 104500.00, 13.27,
 'DR-GR-010', '8901234560034',
 'c1000000-0000-0000-0000-000000000001',
 1, 1, 1,
 '{
   "product_type": "Ring",
   "metal_type": "Gold", "metal_colour": "Yellow",
   "purity": "22K (916)",
   "gross_weight": 6.2, "net_weight": 5.8,
   "wastage_pct": 6.90,
   "stone_type": "Emerald",
   "number_of_stones": 1,
   "stone_weight": 2.5,
   "stone_quality": "AAA Colombian – Minor oil",
   "stone_value": 37500,
   "making_charge": 7000,
   "hallmark_huid": "HUID-DR0034",
   "design_no": "GR-010",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00'),

-- 35. Two-Tone Gold Brooch
('dr000001-0000-0000-0000-000000000035',
 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Peacock Brooch 18K Two-Tone Gold',
 '18K two-tone gold peacock brooch with sapphire eyes and enamel feather detailing.',
 115000.00, 101000.00, 93000.00, 13.86,
 'DR-GR-011', '8901234560035',
 'c1000000-0000-0000-0000-000000000001',
 1, 1, 1,
 '{
   "product_type": "Brooch",
   "metal_type": "Gold", "metal_colour": "Two-Tone",
   "purity": "18K (750)",
   "gross_weight": 9.8, "net_weight": 9.2,
   "wastage_pct": 6.52,
   "stone_type": "Sapphire",
   "number_of_stones": 2,
   "stone_weight": 0.30,
   "stone_quality": "Cornflower Blue, VVS",
   "stone_value": 18000,
   "making_charge": 12000,
   "hallmark_huid": "HUID-DR0035",
   "design_no": "GR-011",
   "hsn_code": "7113"
 }',
 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
 '2026-08-14 06:00:00', '2026-08-14 06:00:00');

-- =============================================================================
-- Done. Diamond Republic demo data loaded:
--   Tenant:     e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c
--   Store:      a1b2c3d4-e5f6-7890-abcd-ef1234567890
--   Login:      admin@diamondrepublic.in  (same password as admin@zettaz.com)
--   Categories: 5 (Gold, Silver, Diamond, Platinum, Fashion)
--   Products:   35 pieces covering all jewelry field variations
-- =============================================================================
