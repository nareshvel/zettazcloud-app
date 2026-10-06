-- Promotions Persistence Migration
-- Date: 2025-08-27
-- Purpose: Persist promotional offer discounts at sale and item level, and add audit tables for applied offers

-- Note: This script is written to be idempotent using information_schema checks

-- =============================================
-- Helper: Add column if not exists
-- =============================================
DROP PROCEDURE IF EXISTS add_column_if_not_exists;
DELIMITER //
CREATE PROCEDURE add_column_if_not_exists(
  IN in_table VARCHAR(128),
  IN in_column VARCHAR(128),
  IN in_definition TEXT
)
BEGIN
  DECLARE col_count INT DEFAULT 0;
  SELECT COUNT(*) INTO col_count
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = in_table
    AND COLUMN_NAME = in_column;
  IF col_count = 0 THEN
    SET @ddl = CONCAT('ALTER TABLE ', in_table, ' ADD COLUMN ', in_column, ' ', in_definition);
    PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

-- =============================================
-- 1) Extend sales table
-- =============================================
CALL add_column_if_not_exists('sales', 'promotions_amount', 'DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER discount_amount');
CALL add_column_if_not_exists('sales', 'manual_discount_amount', 'DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER promotions_amount');
-- Optional JSON snapshot of applied offers per sale (redundant to audit tables but helpful for quick reads)
CALL add_column_if_not_exists('sales', 'applied_offers_json', 'JSON NULL AFTER manual_discount_amount');

-- Ensure total still exists; no change to total calculation here (application will compute)

-- =============================================
-- 2) Extend sale_items table for per-item amounts
-- =============================================
CALL add_column_if_not_exists('sale_items', 'base_unit_price', 'DECIMAL(12,2) NULL AFTER price');
CALL add_column_if_not_exists('sale_items', 'manual_discount_per_unit', 'DECIMAL(12,4) NOT NULL DEFAULT 0 AFTER base_unit_price');
CALL add_column_if_not_exists('sale_items', 'promo_discount_per_unit', 'DECIMAL(12,4) NOT NULL DEFAULT 0 AFTER manual_discount_per_unit');
CALL add_column_if_not_exists('sale_items', 'tax_per_unit', 'DECIMAL(12,4) NOT NULL DEFAULT 0 AFTER promo_discount_per_unit');
CALL add_column_if_not_exists('sale_items', 'final_unit_price', 'DECIMAL(12,4) NOT NULL DEFAULT 0 AFTER tax_per_unit');
CALL add_column_if_not_exists('sale_items', 'applied_discounts_json', 'JSON NULL AFTER final_unit_price');

-- Backfill convenience: set base_unit_price to existing price where NULL
SET @sql := 'UPDATE sale_items SET base_unit_price = IFNULL(base_unit_price, price)';
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =============================================
-- 3) Create sale_applied_offers table
-- =============================================
CREATE TABLE IF NOT EXISTS sale_applied_offers (
  id CHAR(36) PRIMARY KEY,
  sale_id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  store_id CHAR(36) NOT NULL,
  offer_id CHAR(36) NULL,
  offer_name VARCHAR(255) NOT NULL,
  offer_type VARCHAR(64) NOT NULL,
  discount_value DECIMAL(12,4) NULL,
  priority INT NULL,
  rules_json JSON NULL,
  price_tiers_json JSON NULL,
  total_discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sale_applied_offers_sale (sale_id),
  INDEX idx_sale_applied_offers_tenant_store (tenant_id, store_id),
  CONSTRAINT fk_sale_applied_offers_sale FOREIGN KEY (sale_id) REFERENCES sales(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================
-- 4) Create sale_item_discounts table
-- =============================================
CREATE TABLE IF NOT EXISTS sale_item_discounts (
  id CHAR(36) PRIMARY KEY,
  sale_id CHAR(36) NOT NULL,
  sale_item_id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  store_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  offer_id CHAR(36) NULL,
  offer_name VARCHAR(255) NOT NULL,
  offer_type VARCHAR(64) NOT NULL,
  rule_type VARCHAR(64) NULL,
  rule_entity_id CHAR(36) NULL,
  quantity_applied INT NULL,
  discount_per_unit DECIMAL(12,4) NOT NULL DEFAULT 0,
  total_discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  metadata_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sale_item_discounts_sale_item (sale_item_id),
  INDEX idx_sale_item_discounts_sale (sale_id),
  INDEX idx_sale_item_discounts_tenant_store (tenant_id, store_id),
  CONSTRAINT fk_sale_item_discounts_sale FOREIGN KEY (sale_id) REFERENCES sales(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_sale_item_discounts_item FOREIGN KEY (sale_item_id) REFERENCES sale_items(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================
-- 5) Lightweight views to help reporting (optional, safe to create if not exists)
-- =============================================
CREATE OR REPLACE VIEW v_sales_discounts_summary AS
SELECT 
  s.id AS sale_id,
  s.subtotal,
  s.tax,
  s.discount_amount AS manual_discount_amount,
  s.promotions_amount AS promotions_amount,
  s.total
FROM sales s;

-- =============================================
-- 6) Permissions/RBAC placeholder (if needed separately)
-- This migration does not alter RBAC; API will enforce permissions.

-- End of migration
