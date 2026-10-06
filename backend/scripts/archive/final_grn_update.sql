-- Final GRN Schema Update - Execute Only These Queries
-- Based on your error messages, only run what's actually needed

-- =====================================================
-- STEP 1: Update existing data (SAFE TO RUN)
-- =====================================================

-- This populates the purchase_order_id column that was already added
UPDATE grn_items gi
JOIN purchase_order_items poi ON gi.purchase_order_item_id = poi.id
SET gi.purchase_order_id = poi.purchase_order_id
WHERE gi.purchase_order_item_id IS NOT NULL 
  AND (gi.purchase_order_id IS NULL OR gi.purchase_order_id != poi.purchase_order_id);

-- =====================================================
-- STEP 2: Validation Queries (SAFE TO RUN)
-- =====================================================

-- Check current state
SELECT 
    'Current GRN Items State' as info,
    COUNT(*) as total_grn_items,
    COUNT(purchase_order_id) as items_with_po_id,
    COUNT(purchase_order_item_id) as items_with_po_item_id
FROM grn_items;

-- Check for inconsistencies
SELECT 
    'Data Consistency Check' as info,
    COUNT(*) as inconsistent_records
FROM grn_items gi
JOIN purchase_order_items poi ON gi.purchase_order_item_id = poi.id
WHERE gi.purchase_order_id != poi.purchase_order_id;

-- Show sample data
SELECT 
    'Sample GRN Items' as info,
    gi.id,
    gi.grn_id,
    gi.product_id,
    gi.purchase_order_id,
    gi.purchase_order_item_id
FROM grn_items gi
LIMIT 5;
