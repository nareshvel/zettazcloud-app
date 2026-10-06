-- Migration: Old-gold extended fields
-- Date: 2026-08-15
--
-- Adds:
--   item_description     — physical item description (ring, bangle, chain…)
--   claimed_purity_label — what customer claimed (22K etc.) separate from assayed
--   claimed_purity_pct   — customer-claimed purity %, before testing
--   test_method          — visual | acid_test | xrf | fire_assay
--   voucher_type         — credit | cash
--   payment_mode         — cash settlement mode if voucher_type = cash
--   credited_at          — timestamp when voucher was issued
--   redeemed_at          — timestamp when voucher was redeemed
--
-- Also widens notes from VARCHAR(500) → TEXT.

ALTER TABLE old_gold_purchases
  ADD COLUMN item_description      VARCHAR(255) DEFAULT NULL                    AFTER employee_id,
  ADD COLUMN claimed_purity_label  VARCHAR(40)  DEFAULT NULL                    AFTER purity_label,
  ADD COLUMN claimed_purity_pct    DECIMAL(6,3) DEFAULT NULL                    AFTER purity_pct,
  ADD COLUMN test_method           ENUM('visual','acid_test','xrf','fire_assay') DEFAULT 'visual' AFTER claimed_purity_pct,
  ADD COLUMN voucher_type          ENUM('credit','cash') NOT NULL DEFAULT 'credit' AFTER status,
  ADD COLUMN payment_mode          ENUM('cash','card','upi','bank_transfer','cheque','online','other') DEFAULT NULL AFTER voucher_type,
  ADD COLUMN credited_at           TIMESTAMP DEFAULT NULL                       AFTER payment_mode,
  ADD COLUMN redeemed_at           TIMESTAMP DEFAULT NULL                       AFTER credited_at,
  MODIFY COLUMN notes              TEXT DEFAULT NULL;
