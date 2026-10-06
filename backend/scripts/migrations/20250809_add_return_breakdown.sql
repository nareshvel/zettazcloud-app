-- Migration: add breakdown columns to sales_returns and sales_return_items
-- Compatible with MySQL versions that do not support `ADD COLUMN IF NOT EXISTS`

SET @db := DATABASE();

-- sales_returns.subtotal_amount
SET @stmt := (
  SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA=@db AND TABLE_NAME='sales_returns' AND COLUMN_NAME='subtotal_amount') = 0,
    'ALTER TABLE sales_returns ADD COLUMN subtotal_amount DECIMAL(10,2) NULL AFTER return_reason_notes;',
    'SELECT 1;'
  )
);
PREPARE s1 FROM @stmt; EXECUTE s1; DEALLOCATE PREPARE s1;

-- sales_returns.discount_amount
SET @stmt := (
  SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA=@db AND TABLE_NAME='sales_returns' AND COLUMN_NAME='discount_amount') = 0,
    'ALTER TABLE sales_returns ADD COLUMN discount_amount DECIMAL(10,2) NULL AFTER subtotal_amount;',
    'SELECT 1;'
  )
);
PREPARE s2 FROM @stmt; EXECUTE s2; DEALLOCATE PREPARE s2;

-- sales_returns.tax_amount
SET @stmt := (
  SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA=@db AND TABLE_NAME='sales_returns' AND COLUMN_NAME='tax_amount') = 0,
    'ALTER TABLE sales_returns ADD COLUMN tax_amount DECIMAL(10,2) NULL AFTER discount_amount;',
    'SELECT 1;'
  )
);
PREPARE s3 FROM @stmt; EXECUTE s3; DEALLOCATE PREPARE s3;

-- sales_return_items.base_unit_price
SET @stmt := (
  SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA=@db AND TABLE_NAME='sales_return_items' AND COLUMN_NAME='base_unit_price') = 0,
    'ALTER TABLE sales_return_items ADD COLUMN base_unit_price DECIMAL(10,2) NULL AFTER product_id;',
    'SELECT 1;'
  )
);
PREPARE s4 FROM @stmt; EXECUTE s4; DEALLOCATE PREPARE s4;

-- sales_return_items.discount_per_unit
SET @stmt := (
  SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA=@db AND TABLE_NAME='sales_return_items' AND COLUMN_NAME='discount_per_unit') = 0,
    'ALTER TABLE sales_return_items ADD COLUMN discount_per_unit DECIMAL(10,2) NULL AFTER base_unit_price;',
    'SELECT 1;'
  )
);
PREPARE s5 FROM @stmt; EXECUTE s5; DEALLOCATE PREPARE s5;

-- sales_return_items.tax_per_unit
SET @stmt := (
  SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA=@db AND TABLE_NAME='sales_return_items' AND COLUMN_NAME='tax_per_unit') = 0,
    'ALTER TABLE sales_return_items ADD COLUMN tax_per_unit DECIMAL(10,2) NULL AFTER discount_per_unit;',
    'SELECT 1;'
  )
);
PREPARE s6 FROM @stmt; EXECUTE s6; DEALLOCATE PREPARE s6;

-- sales_return_items.final_unit_price
SET @stmt := (
  SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA=@db AND TABLE_NAME='sales_return_items' AND COLUMN_NAME='final_unit_price') = 0,
    'ALTER TABLE sales_return_items ADD COLUMN final_unit_price DECIMAL(10,2) NULL AFTER tax_per_unit;',
    'SELECT 1;'
  )
);
PREPARE s7 FROM @stmt; EXECUTE s7; DEALLOCATE PREPARE s7;

-- sales_return_items.line_subtotal
SET @stmt := (
  SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA=@db AND TABLE_NAME='sales_return_items' AND COLUMN_NAME='line_subtotal') = 0,
    'ALTER TABLE sales_return_items ADD COLUMN line_subtotal DECIMAL(10,2) NULL AFTER final_unit_price;',
    'SELECT 1;'
  )
);
PREPARE s8 FROM @stmt; EXECUTE s8; DEALLOCATE PREPARE s8;

-- sales_return_items.line_discount
SET @stmt := (
  SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA=@db AND TABLE_NAME='sales_return_items' AND COLUMN_NAME='line_discount') = 0,
    'ALTER TABLE sales_return_items ADD COLUMN line_discount DECIMAL(10,2) NULL AFTER line_subtotal;',
    'SELECT 1;'
  )
);
PREPARE s9 FROM @stmt; EXECUTE s9; DEALLOCATE PREPARE s9;

-- sales_return_items.line_tax
SET @stmt := (
  SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA=@db AND TABLE_NAME='sales_return_items' AND COLUMN_NAME='line_tax') = 0,
    'ALTER TABLE sales_return_items ADD COLUMN line_tax DECIMAL(10,2) NULL AFTER line_discount;',
    'SELECT 1;'
  )
);
PREPARE s10 FROM @stmt; EXECUTE s10; DEALLOCATE PREPARE s10;

-- Note: unit_price/total_amount remain for backward compatibility.
-- final_unit_price mirrors the effective unit refund value used for total calculations.
