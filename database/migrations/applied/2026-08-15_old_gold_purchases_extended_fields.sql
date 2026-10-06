-- Extended fields on old_gold_purchases
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='old_gold_purchases' AND COLUMN_NAME='item_description');
SET @sql := IF(@col=0,
  'ALTER TABLE old_gold_purchases
    ADD COLUMN item_description      VARCHAR(255) DEFAULT NULL                    AFTER employee_id,
    ADD COLUMN claimed_purity_label  VARCHAR(40)  DEFAULT NULL                    AFTER purity_label,
    ADD COLUMN claimed_purity_pct    DECIMAL(6,3) DEFAULT NULL                    AFTER purity_pct,
    ADD COLUMN test_method           ENUM(''visual'',''acid_test'',''xrf'',''fire_assay'') DEFAULT ''visual'' AFTER claimed_purity_pct,
    ADD COLUMN voucher_type          ENUM(''credit'',''cash'') NOT NULL DEFAULT ''credit'' AFTER status,
    ADD COLUMN payment_mode          ENUM(''cash'',''card'',''upi'',''bank_transfer'',''cheque'',''online'',''other'') DEFAULT NULL AFTER voucher_type,
    ADD COLUMN credited_at           TIMESTAMP DEFAULT NULL                       AFTER payment_mode,
    ADD COLUMN redeemed_at           TIMESTAMP DEFAULT NULL                       AFTER credited_at,
    MODIFY COLUMN notes              TEXT DEFAULT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
