-- Minimal GRN Schema Update - Only Execute What's Needed
-- Run this only if the previous script had errors

-- =====================================================
-- Check if purchase_order_id column already exists in grn_items
-- =====================================================

-- First, let's check what we have:
-- DESCRIBE grn_items;

-- =====================================================
-- Only add purchase_order_id column if it doesn't exist
-- =====================================================

-- If the column doesn't exist, run this:
-- ALTER TABLE grn_items 
-- ADD COLUMN purchase_order_id VARCHAR(36) NULL 
-- AFTER product_id;

-- =====================================================
-- Only add index if it doesn't exist
-- =====================================================

-- If the index doesn't exist, run this:
-- CREATE INDEX idx_grn_items_purchase_order_id ON grn_items(purchase_order_id);

-- =====================================================
-- Only add foreign key if it doesn't exist
-- =====================================================

-- If the foreign key doesn't exist, run this:
-- ALTER TABLE grn_items 
-- ADD CONSTRAINT fk_grn_items_purchase_order_id 
-- FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) 
-- ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================
-- Update existing data (safe to run multiple times)
-- =====================================================

-- This is safe to run even if already executed:
UPDATE grn_items gi
JOIN purchase_order_items poi ON gi.purchase_order_item_id = poi.id
SET gi.purchase_order_id = poi.purchase_order_id
WHERE gi.purchase_order_item_id IS NOT NULL 
  AND gi.purchase_order_id IS NULL;

-- =====================================================
-- Validation query to check current state
-- =====================================================

-- Check if the column exists and has data:
SELECT 
    COUNT(*) as total_grn_items,
    COUNT(purchase_order_id) as items_with_po_id,
    COUNT(purchase_order_item_id) as items_with_po_item_id
FROM grn_items;

-- Check for any inconsistencies:
SELECT COUNT(*) as inconsistent_records
FROM grn_items gi
JOIN purchase_order_items poi ON gi.purchase_order_item_id = poi.id
WHERE gi.purchase_order_id != poi.purchase_order_id;

-- Should return 0 inconsistent records
