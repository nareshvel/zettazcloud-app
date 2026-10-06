-- =============================================================================
-- 2026-08-13 Label printing + CRM wishlists / birthday / anniversary
-- =============================================================================
-- Adds:
--   1. Label-printer columns to printer_settings (type + address; separate from
--      receipt printer so both can be configured independently per store)
--   2. date_of_birth + anniversary_date to customers (for reminder scheduler)
--   3. customer_wishlist_items table (simple product wish-list per customer)
-- All statements are idempotent / guarded.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Label printer columns on printer_settings
-- ---------------------------------------------------------------------------

-- label_printer_type: 'none' | 'zebra_zpl' | 'tsc_network' | 'browser'
SET @tbl = 'printer_settings';
SET @col = 'label_printer_type';
SET @q1 = IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = @col
  ),
  'SELECT 1 -- already exists',
  CONCAT('ALTER TABLE `', @tbl, '` ADD COLUMN `', @col, '` VARCHAR(32) NOT NULL DEFAULT ''none'' COMMENT ''none|zebra_zpl|tsc_network|browser''')
);
PREPARE _s1 FROM @q1; EXECUTE _s1; DEALLOCATE PREPARE _s1;

-- label_printer_address: IP:port for network printers, empty for browser
SET @col = 'label_printer_address';
SET @q2 = IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = @col
  ),
  'SELECT 1 -- already exists',
  CONCAT('ALTER TABLE `', @tbl, '` ADD COLUMN `', @col, '` VARCHAR(128) DEFAULT NULL COMMENT ''IP:port for network label printers''')
);
PREPARE _s2 FROM @q2; EXECUTE _s2; DEALLOCATE PREPARE _s2;

-- label_paper_width_mm: typical label widths 38|50|60|80mm
SET @col = 'label_paper_width_mm';
SET @q3 = IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = @col
  ),
  'SELECT 1 -- already exists',
  CONCAT('ALTER TABLE `', @tbl, '` ADD COLUMN `', @col, '` TINYINT UNSIGNED NOT NULL DEFAULT 50 COMMENT ''label paper width in mm''')
);
PREPARE _s3 FROM @q3; EXECUTE _s3; DEALLOCATE PREPARE _s3;

-- label_paper_height_mm
SET @col = 'label_paper_height_mm';
SET @q4 = IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = @col
  ),
  'SELECT 1 -- already exists',
  CONCAT('ALTER TABLE `', @tbl, '` ADD COLUMN `', @col, '` TINYINT UNSIGNED NOT NULL DEFAULT 25 COMMENT ''label paper height in mm''')
);
PREPARE _s4 FROM @q4; EXECUTE _s4; DEALLOCATE PREPARE _s4;

-- ---------------------------------------------------------------------------
-- 2. CRM: date_of_birth + anniversary_date on customers
-- ---------------------------------------------------------------------------

SET @tbl = 'customers';

SET @col = 'date_of_birth';
SET @q5 = IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = @col
  ),
  'SELECT 1 -- already exists',
  CONCAT('ALTER TABLE `', @tbl, '` ADD COLUMN `', @col, '` DATE DEFAULT NULL COMMENT ''customer date of birth for birthday reminders''')
);
PREPARE _s5 FROM @q5; EXECUTE _s5; DEALLOCATE PREPARE _s5;

SET @col = 'anniversary_date';
SET @q6 = IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = @col
  ),
  'SELECT 1 -- already exists',
  CONCAT('ALTER TABLE `', @tbl, '` ADD COLUMN `', @col, '` DATE DEFAULT NULL COMMENT ''customer wedding / purchase anniversary for reminders''')
);
PREPARE _s6 FROM @q6; EXECUTE _s6; DEALLOCATE PREPARE _s6;

-- ---------------------------------------------------------------------------
-- 3. Customer wishlist items
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `customer_wishlist_items` (
  `id`          VARCHAR(36)  NOT NULL,
  `tenant_id`   VARCHAR(36)  NOT NULL,
  `customer_id` VARCHAR(36)  NOT NULL,
  `product_id`  VARCHAR(36)  NOT NULL,
  `piece_id`    VARCHAR(36)  DEFAULT NULL COMMENT 'optional: specific serialized piece',
  `notes`       TEXT         DEFAULT NULL,
  `added_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_wishlist_item` (`tenant_id`, `customer_id`, `product_id`),
  KEY `idx_wishlist_customer` (`tenant_id`, `customer_id`),
  CONSTRAINT `fk_cwi_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cwi_product`  FOREIGN KEY (`product_id`)  REFERENCES `products`   (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- Verification (review these counts before committing to production)
-- ---------------------------------------------------------------------------
-- SELECT COLUMN_NAME, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS
--  WHERE TABLE_SCHEMA = DATABASE()
--    AND TABLE_NAME IN ('printer_settings','customers','customer_wishlist_items')
--    AND COLUMN_NAME IN ('label_printer_type','label_printer_address','label_paper_width_mm',
--                        'label_paper_height_mm','date_of_birth','anniversary_date')
-- ORDER BY TABLE_NAME, COLUMN_NAME;
