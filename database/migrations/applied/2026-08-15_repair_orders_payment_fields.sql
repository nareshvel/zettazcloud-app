-- Payment fields on repair_orders
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='repair_orders' AND COLUMN_NAME='job_type');
SET @sql := IF(@col=0,
  'ALTER TABLE repair_orders
    ADD COLUMN job_type              VARCHAR(100)   DEFAULT NULL                         AFTER work_required,
    ADD COLUMN condition_notes       TEXT           DEFAULT NULL                         AFTER job_type,
    ADD COLUMN goldsmith_name        VARCHAR(120)   DEFAULT NULL                         AFTER condition_notes,
    ADD COLUMN advance_payment_mode  ENUM(''cash'',''card'',''upi'',''bank_transfer'',''cheque'',''online'',''other'')
                                                    DEFAULT NULL                         AFTER advance_paid,
    ADD COLUMN balance_paid          DECIMAL(12,2)  DEFAULT NULL                         AFTER advance_payment_mode,
    ADD COLUMN balance_paid_at       TIMESTAMP      DEFAULT NULL                         AFTER balance_paid,
    ADD COLUMN balance_payment_mode  ENUM(''cash'',''card'',''upi'',''bank_transfer'',''cheque'',''online'',''other'')
                                                    DEFAULT NULL                         AFTER balance_paid_at,
    ADD COLUMN payment_gateway       VARCHAR(60)    DEFAULT NULL                         AFTER balance_payment_mode,
    ADD COLUMN payment_gateway_ref   VARCHAR(255)   DEFAULT NULL                         AFTER payment_gateway',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
