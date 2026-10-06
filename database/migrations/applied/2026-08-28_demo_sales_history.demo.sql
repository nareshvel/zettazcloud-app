-- =============================================================================
-- 2026-08-28  Demo sales history
-- =============================================================================
-- WHY
-- ---
-- The demo tenants had products, customers and templates but no completed
-- sales, so every report, dashboard and receipt preview rendered empty. A demo
-- you cannot print a receipt from does not demonstrate a POS.
--
-- Twelve sales across the five verticals, dated over the week to 23 Aug 2026,
-- chosen to exercise the cases that actually differ:
--
--   Jewelry (duty-free)  3 sales, ZERO tax — the whole point of the vertical
--   Grocery              3 sales mixing TAXABLE and EXEMPT lines (milk is
--                        exempt, dish soap is not) so the tax flags and legend
--                        have something to show
--   Electronics          2 sales at UAE VAT 5%
--   Apparel              2 sales at UK VAT 20%
--   General retail       2 sales at US 7%
--
-- Every figure was computed rather than typed: line totals, per-line tax and
-- the sale total are consistent with the stated rate, so a report that sums
-- them agrees with the receipt. Hand-written demo money that does not add up
-- is worse than none, because it makes correct software look broken.
--
-- DOCUMENT NUMBERS
-- ----------------
-- Sales carry `document_number` (INV-2026-000001 …) and the matching
-- `document_sequences` counters are seeded to match. Without those counter
-- rows the next real sale in a demo tenant would issue INV-2026-000001 again
-- and collide with the unique key on (tenant_id, document_number).
--
--   npm run migrate:demo
--
-- IDEMPOTENT: INSERT IGNORE with fixed UUIDs. Safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Payment methods
-- ---------------------------------------------------------------------------
-- Created at signup for real tenants; the demo tenants are inserted directly,
-- so they need them here or `sales.payment_method` points at nothing.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `payment_methods`
  (`id`, `tenant_id`, `name`, `code`, `is_active`, `requires_terminal`, `icon`, `sort_order`)
VALUES
  ('demo0001-jw00-0000-0000-00000000pm1', 'demo0001-jw00-0000-0000-000000000001', 'Cash', 'cash', 1, 0, 'cash', 1),
  ('demo0001-jw00-0000-0000-00000000pm2', 'demo0001-jw00-0000-0000-000000000001', 'Credit/Debit Card', 'card', 1, 1, 'credit-card', 2),
  ('demo0002-gr00-0000-0000-00000000pm1', 'demo0002-gr00-0000-0000-000000000002', 'Cash', 'cash', 1, 0, 'cash', 1),
  ('demo0002-gr00-0000-0000-00000000pm2', 'demo0002-gr00-0000-0000-000000000002', 'Credit/Debit Card', 'card', 1, 1, 'credit-card', 2),
  ('demo0003-el00-0000-0000-00000000pm1', 'demo0003-el00-0000-0000-000000000003', 'Cash', 'cash', 1, 0, 'cash', 1),
  ('demo0003-el00-0000-0000-00000000pm2', 'demo0003-el00-0000-0000-000000000003', 'Credit/Debit Card', 'card', 1, 1, 'credit-card', 2),
  ('demo0004-ap00-0000-0000-00000000pm1', 'demo0004-ap00-0000-0000-000000000004', 'Cash', 'cash', 1, 0, 'cash', 1),
  ('demo0004-ap00-0000-0000-00000000pm2', 'demo0004-ap00-0000-0000-000000000004', 'Credit/Debit Card', 'card', 1, 1, 'credit-card', 2),
  ('demo0005-rt00-0000-0000-00000000pm1', 'demo0005-rt00-0000-0000-000000000005', 'Cash', 'cash', 1, 0, 'cash', 1),
  ('demo0005-rt00-0000-0000-00000000pm2', 'demo0005-rt00-0000-0000-000000000005', 'Credit/Debit Card', 'card', 1, 1, 'credit-card', 2);

-- ---------------------------------------------------------------------------
-- Sales
--
-- Tax is computed on the LINE TOTAL and rounded once. `sale_items.tax_per_unit`
-- below is stored at 4dp precisely so that qty x tax_per_unit reconciles back
-- to these figures — see the note there.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `sales`
  (`id`, `tenant_id`, `store_id`, `cashier_id`, `subtotal`, `tax`, `total`,
   `payment_method`, `status`, `payment_status`, `customer_id`, `document_number`, `created_at`)
VALUES
  ('demo0001-jw00-0000-0000-0000000sa001', 'demo0001-jw00-0000-0000-000000000001', 'demo0001-jw00-0000-0000-00000000st01', 'demo0001-jw00-0000-0000-00000000us01', 2086.17, 0.00, 2086.17,
   'demo0001-jw00-0000-0000-00000000pm2', 'completed', 'PAID', 'demo0001-jw00-0000-0000-0000000cu01', 'INV-2026-000001', '2026-08-18 10:22:00'),
  ('demo0001-jw00-0000-0000-0000000sa002', 'demo0001-jw00-0000-0000-000000000001', 'demo0001-jw00-0000-0000-00000000st01', 'demo0001-jw00-0000-0000-00000000us01', 1361.60, 0.00, 1361.60,
   'demo0001-jw00-0000-0000-00000000pm2', 'completed', 'PAID', 'demo0001-jw00-0000-0000-0000000cu01', 'INV-2026-000002', '2026-08-20 15:41:00'),
  ('demo0001-jw00-0000-0000-0000000sa003', 'demo0001-jw00-0000-0000-000000000001', 'demo0001-jw00-0000-0000-00000000st01', 'demo0001-jw00-0000-0000-00000000us01', 2113.44, 0.00, 2113.44,
   'demo0001-jw00-0000-0000-00000000pm1', 'completed', 'PAID', 'demo0001-jw00-0000-0000-0000000cu01', 'INV-2026-000003', '2026-08-22 11:05:00'),
  ('demo0002-gr00-0000-0000-0000000sa004', 'demo0002-gr00-0000-0000-000000000002', 'demo0002-gr00-0000-0000-00000000st02', 'demo0002-gr00-0000-0000-00000000us02', 24.37, 1.80, 26.17,
   'demo0002-gr00-0000-0000-00000000pm1', 'completed', 'PAID', 'demo0002-gr00-0000-0000-0000000cu02', 'INV-2026-000001', '2026-08-19 08:14:00'),
  ('demo0002-gr00-0000-0000-0000000sa005', 'demo0002-gr00-0000-0000-000000000002', 'demo0002-gr00-0000-0000-00000000st02', 'demo0002-gr00-0000-0000-00000000us02', 37.70, 4.73, 42.43,
   'demo0002-gr00-0000-0000-00000000pm2', 'completed', 'PAID', 'demo0002-gr00-0000-0000-0000000cu02', 'INV-2026-000002', '2026-08-21 17:36:00'),
  ('demo0002-gr00-0000-0000-0000000sa006', 'demo0002-gr00-0000-0000-000000000002', 'demo0002-gr00-0000-0000-00000000st02', 'demo0002-gr00-0000-0000-00000000us02', 19.95, 2.99, 22.94,
   'demo0002-gr00-0000-0000-00000000pm1', 'completed', 'PAID', 'demo0002-gr00-0000-0000-0000000cu02', 'INV-2026-000003', '2026-08-23 09:02:00'),
  ('demo0003-el00-0000-0000-0000000sa007', 'demo0003-el00-0000-0000-000000000003', 'demo0003-el00-0000-0000-00000000st03', 'demo0003-el00-0000-0000-00000000us03', 2450.00, 122.50, 2572.50,
   'demo0003-el00-0000-0000-00000000pm2', 'completed', 'PAID', 'demo0003-el00-0000-0000-0000000cu03', 'INV-2026-000001', '2026-08-17 13:20:00'),
  ('demo0003-el00-0000-0000-0000000sa008', 'demo0003-el00-0000-0000-000000000003', 'demo0003-el00-0000-0000-00000000st03', 'demo0003-el00-0000-0000-00000000us03', 960.00, 48.00, 1008.00,
   'demo0003-el00-0000-0000-00000000pm2', 'completed', 'PAID', 'demo0003-el00-0000-0000-0000000cu03', 'INV-2026-000002', '2026-08-21 16:48:00'),
  ('demo0004-ap00-0000-0000-0000000sa009', 'demo0004-ap00-0000-0000-000000000004', 'demo0004-ap00-0000-0000-00000000st04', 'demo0004-ap00-0000-0000-00000000us04', 378.00, 75.60, 453.60,
   'demo0004-ap00-0000-0000-00000000pm2', 'completed', 'PAID', 'demo0004-ap00-0000-0000-0000000cu04', 'INV-2026-000001', '2026-08-18 12:30:00'),
  ('demo0004-ap00-0000-0000-0000000sa010', 'demo0004-ap00-0000-0000-000000000004', 'demo0004-ap00-0000-0000-00000000st04', 'demo0004-ap00-0000-0000-00000000us04', 879.00, 175.80, 1054.80,
   'demo0004-ap00-0000-0000-00000000pm2', 'completed', 'PAID', 'demo0004-ap00-0000-0000-0000000cu04', 'INV-2026-000002', '2026-08-22 14:15:00'),
  ('demo0005-rt00-0000-0000-0000000sa011', 'demo0005-rt00-0000-0000-000000000005', 'demo0005-rt00-0000-0000-00000000st05', 'demo0005-rt00-0000-0000-00000000us05', 128.00, 8.96, 136.96,
   'demo0005-rt00-0000-0000-00000000pm1', 'completed', 'PAID', 'demo0005-rt00-0000-0000-0000000cu05', 'INV-2026-000001', '2026-08-19 11:11:00'),
  ('demo0005-rt00-0000-0000-0000000sa012', 'demo0005-rt00-0000-0000-000000000005', 'demo0005-rt00-0000-0000-00000000st05', 'demo0005-rt00-0000-0000-00000000us05', 65.00, 4.55, 69.55,
   'demo0005-rt00-0000-0000-00000000pm2', 'completed', 'PAID', 'demo0005-rt00-0000-0000-0000000cu05', 'INV-2026-000002', '2026-08-23 16:05:00');

-- ---------------------------------------------------------------------------
-- Sale lines
--
-- tax_per_unit and final_unit_price are decimal(12,4) and are stored at FULL
-- 4dp precision, not rounded to currency. Bananas at 3.99 with ABST 15% give
-- 0.5985 tax per unit; storing 0.60 would make a 5-unit line total 3.00 while
-- the sale header says 2.99. Money is rounded once, at the line — never per
-- unit. This is what the 4dp columns are for.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `sale_items`
  (`id`, `sale_id`, `product_id`, `quantity`, `price`, `base_unit_price`,
   `tax_per_unit`, `final_unit_price`, `created_at`)
VALUES
  ('demo0001-jw00-0000-0000-000si00101', 'demo0001-jw00-0000-0000-0000000sa001', 'demo0001-jw00-0000-0000-0000000pr01', 1, 2086.17, 2086.17, 0.0000, 2086.1700, '2026-08-18 10:22:00'),
  ('demo0001-jw00-0000-0000-000si00201', 'demo0001-jw00-0000-0000-0000000sa002', 'demo0001-jw00-0000-0000-0000000pr03', 2, 680.80, 680.80, 0.0000, 680.8000, '2026-08-20 15:41:00'),
  ('demo0001-jw00-0000-0000-000si00301', 'demo0001-jw00-0000-0000-0000000sa003', 'demo0001-jw00-0000-0000-0000000pr02', 1, 1432.64, 1432.64, 0.0000, 1432.6400, '2026-08-22 11:05:00'),
  ('demo0001-jw00-0000-0000-000si00302', 'demo0001-jw00-0000-0000-0000000sa003', 'demo0001-jw00-0000-0000-0000000pr03', 1, 680.80, 680.80, 0.0000, 680.8000, '2026-08-22 11:05:00'),
  ('demo0002-gr00-0000-0000-000si00401', 'demo0002-gr00-0000-0000-0000000sa004', 'demo0002-gr00-0000-0000-0000000pr04', 3, 3.99, 3.99, 0.5985, 4.5885, '2026-08-19 08:14:00'),
  ('demo0002-gr00-0000-0000-000si00402', 'demo0002-gr00-0000-0000-0000000sa004', 'demo0002-gr00-0000-0000-0000000pr06', 2, 6.20, 6.20, 0.0000, 6.2000, '2026-08-19 08:14:00'),
  ('demo0002-gr00-0000-0000-000si00501', 'demo0002-gr00-0000-0000-0000000sa005', 'demo0002-gr00-0000-0000-0000000pr05', 1, 12.50, 12.50, 1.8750, 14.3750, '2026-08-21 17:36:00'),
  ('demo0002-gr00-0000-0000-000si00502', 'demo0002-gr00-0000-0000-0000000sa005', 'demo0002-gr00-0000-0000-0000000pr07', 2, 9.50, 9.50, 1.4250, 10.9250, '2026-08-21 17:36:00'),
  ('demo0002-gr00-0000-0000-000si00503', 'demo0002-gr00-0000-0000-0000000sa005', 'demo0002-gr00-0000-0000-0000000pr06', 1, 6.20, 6.20, 0.0000, 6.2000, '2026-08-21 17:36:00'),
  ('demo0002-gr00-0000-0000-000si00601', 'demo0002-gr00-0000-0000-0000000sa006', 'demo0002-gr00-0000-0000-0000000pr04', 5, 3.99, 3.99, 0.5985, 4.5885, '2026-08-23 09:02:00'),
  ('demo0003-el00-0000-0000-000si00701', 'demo0003-el00-0000-0000-0000000sa007', 'demo0003-el00-0000-0000-0000000pr08', 1, 2450.00, 2450.00, 122.5000, 2572.5000, '2026-08-17 13:20:00'),
  ('demo0003-el00-0000-0000-000si00801', 'demo0003-el00-0000-0000-0000000sa008', 'demo0003-el00-0000-0000-0000000pr09', 2, 480.00, 480.00, 24.0000, 504.0000, '2026-08-21 16:48:00'),
  ('demo0004-ap00-0000-0000-000si00901', 'demo0004-ap00-0000-0000-0000000sa009', 'demo0004-ap00-0000-0000-0000000pr10', 2, 189.00, 189.00, 37.8000, 226.8000, '2026-08-18 12:30:00'),
  ('demo0004-ap00-0000-0000-000si01001', 'demo0004-ap00-0000-0000-0000000sa010', 'demo0004-ap00-0000-0000-0000000pr12', 1, 750.00, 750.00, 150.0000, 900.0000, '2026-08-22 14:15:00'),
  ('demo0004-ap00-0000-0000-000si01002', 'demo0004-ap00-0000-0000-0000000sa010', 'demo0004-ap00-0000-0000-0000000pr11', 1, 129.00, 129.00, 25.8000, 154.8000, '2026-08-22 14:15:00'),
  ('demo0005-rt00-0000-0000-000si01101', 'demo0005-rt00-0000-0000-0000000sa011', 'demo0005-rt00-0000-0000-0000000pr13', 2, 45.00, 45.00, 3.1500, 48.1500, '2026-08-19 11:11:00'),
  ('demo0005-rt00-0000-0000-000si01102', 'demo0005-rt00-0000-0000-0000000sa011', 'demo0005-rt00-0000-0000-0000000pr14', 1, 38.00, 38.00, 2.6600, 40.6600, '2026-08-19 11:11:00'),
  ('demo0005-rt00-0000-0000-000si01201', 'demo0005-rt00-0000-0000-0000000sa012', 'demo0005-rt00-0000-0000-0000000pr15', 1, 65.00, 65.00, 4.5500, 69.5500, '2026-08-23 16:05:00');

-- ---------------------------------------------------------------------------
-- Sequence counters — must match the numbers issued above
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `document_sequences`
  (`id`, `tenant_id`, `store_id`, `doc_type`, `period`, `current_value`, `prefix`, `padding`)
VALUES
  ('demo0001-jw00-0000-0000-00000000ds01', 'demo0001-jw00-0000-0000-000000000001', 'demo0001-jw00-0000-0000-00000000st01', 'sale', '2026', 3, 'INV', 6),
  ('demo0002-gr00-0000-0000-00000000ds01', 'demo0002-gr00-0000-0000-000000000002', 'demo0002-gr00-0000-0000-00000000st02', 'sale', '2026', 3, 'INV', 6),
  ('demo0003-el00-0000-0000-00000000ds01', 'demo0003-el00-0000-0000-000000000003', 'demo0003-el00-0000-0000-00000000st03', 'sale', '2026', 2, 'INV', 6),
  ('demo0004-ap00-0000-0000-00000000ds01', 'demo0004-ap00-0000-0000-000000000004', 'demo0004-ap00-0000-0000-00000000st04', 'sale', '2026', 2, 'INV', 6),
  ('demo0005-rt00-0000-0000-00000000ds01', 'demo0005-rt00-0000-0000-000000000005', 'demo0005-rt00-0000-0000-00000000st05', 'sale', '2026', 2, 'INV', 6);

-- =============================================================================
-- TEARDOWN
-- =============================================================================
--   DELETE FROM sale_items        WHERE sale_id LIKE 'demo000%';
--   DELETE FROM sales             WHERE tenant_id LIKE 'demo000%';
--   DELETE FROM document_sequences WHERE tenant_id LIKE 'demo000%';
--   DELETE FROM payment_methods   WHERE tenant_id LIKE 'demo000%';
-- =============================================================================
