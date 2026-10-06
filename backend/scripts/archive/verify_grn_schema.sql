-- GRN Schema Verification Script
-- Cross-check database structure for our implementation plan

-- =====================================================
-- STEP 1: Verify Table Structures
-- =====================================================

-- Check goods_received_notes table structure
SELECT 'goods_received_notes table structure' as info;
DESCRIBE goods_received_notes;

-- Check grn_items table structure (focus on PO columns)
SELECT 'grn_items table structure' as info;
DESCRIBE grn_items;

-- =====================================================
-- STEP 2: Verify Data Population
-- =====================================================

-- Check current GRN items data state
SELECT 
    'GRN Items Data Summary' as info,
    COUNT(*) as total_grn_items,
    COUNT(purchase_order_id) as items_with_po_id,
    COUNT(purchase_order_item_id) as items_with_po_item_id,
    COUNT(CASE WHEN purchase_order_id IS NOT NULL AND purchase_order_item_id IS NOT NULL THEN 1 END) as po_linked_items,
    COUNT(CASE WHEN purchase_order_id IS NULL AND purchase_order_item_id IS NULL THEN 1 END) as manual_items
FROM grn_items;

-- Check for data consistency
SELECT 
    'Data Consistency Check' as info,
    COUNT(*) as total_po_items,
    COUNT(CASE WHEN gi.purchase_order_id = poi.purchase_order_id THEN 1 END) as consistent_records,
    COUNT(CASE WHEN gi.purchase_order_id != poi.purchase_order_id THEN 1 END) as inconsistent_records
FROM grn_items gi
JOIN purchase_order_items poi ON gi.purchase_order_item_id = poi.id;

-- =====================================================
-- STEP 3: Verify GRN Types Distribution
-- =====================================================

-- Check GRN types based on our new schema
SELECT 
    'GRN Types Analysis' as analysis,
    grn.id as grn_id,
    grn.grn_number,
    grn.purchase_order_id as header_po_id,
    COUNT(gi.id) as total_items,
    COUNT(gi.purchase_order_id) as po_linked_items,
    COUNT(CASE WHEN gi.purchase_order_id IS NULL THEN 1 END) as manual_items,
    COUNT(DISTINCT gi.purchase_order_id) as unique_po_count,
    CASE 
        WHEN COUNT(gi.purchase_order_id) = 0 THEN 'MANUAL_GRN'
        WHEN COUNT(DISTINCT gi.purchase_order_id) = 1 AND COUNT(gi.purchase_order_id) = COUNT(gi.id) THEN 'PURE_PO_GRN'
        ELSE 'MIXED_GRN'
    END as grn_type
FROM goods_received_notes grn
LEFT JOIN grn_items gi ON grn.id = gi.grn_id
WHERE grn.tenant_id = 'd7f267da-d5d9-4a15-b0d3-31ca710a4492'
GROUP BY grn.id, grn.grn_number, grn.purchase_order_id
ORDER BY grn.created_at DESC
LIMIT 10;

-- =====================================================
-- STEP 4: Verify Foreign Key Relationships
-- =====================================================

-- Check foreign key constraints on grn_items
SELECT 
    'Foreign Key Constraints' as info,
    CONSTRAINT_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'grn_items'
  AND REFERENCED_TABLE_NAME IS NOT NULL;

-- =====================================================
-- STEP 5: Verify Indexes for Performance
-- =====================================================

-- Check indexes on grn_items table
SELECT 
    'Indexes on grn_items' as info,
    INDEX_NAME,
    COLUMN_NAME,
    NON_UNIQUE
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'grn_items'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;

-- =====================================================
-- STEP 6: Sample Data Verification
-- =====================================================

-- Show sample GRN items with PO relationships
SELECT 
    'Sample GRN Items with PO Data' as info,
    gi.id as grn_item_id,
    gi.grn_id,
    grn.grn_number,
    gi.product_id,
    gi.purchase_order_id as item_po_id,
    gi.purchase_order_item_id,
    grn.purchase_order_id as header_po_id,
    poi.purchase_order_id as poi_parent_po_id,
    CASE 
        WHEN gi.purchase_order_id IS NULL THEN 'MANUAL'
        ELSE 'PO_LINKED'
    END as item_type
FROM grn_items gi
LEFT JOIN goods_received_notes grn ON gi.grn_id = grn.id
LEFT JOIN purchase_order_items poi ON gi.purchase_order_item_id = poi.id
WHERE grn.tenant_id = 'd7f267da-d5d9-4a15-b0d3-31ca710a4492'
ORDER BY gi.created_at DESC
LIMIT 10;
