-- Add last_grn_date column to purchase_orders table
ALTER TABLE purchase_orders ADD COLUMN last_grn_date DATETIME DEFAULT NULL COMMENT 'Date when last GRN was processed for this PO';
