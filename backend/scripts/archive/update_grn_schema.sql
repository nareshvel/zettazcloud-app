-- GRN Schema Update Script
-- Purpose: Add purchase_order_id to grn_items table for better PO tracking in mixed GRNs
-- Date: 2025-08-05
-- Author: System Architecture Update

-- =====================================================
-- STEP 1: Add purchase_order_id column to grn_items table
-- =====================================================

-- Add purchase_order_id column before purchase_order_item_id for logical ordering
ALTER TABLE grn_items 
ADD COLUMN purchase_order_id VARCHAR(36) NULL 
AFTER product_id;

-- Add index for performance on PO-related queries
CREATE INDEX idx_grn_items_purchase_order_id ON grn_items(purchase_order_id);

-- Add foreign key constraint to ensure data integrity
ALTER TABLE grn_items 
ADD CONSTRAINT fk_grn_items_purchase_order_id 
FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) 
ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================
-- STEP 2: Update existing data to populate new column
-- =====================================================

-- For existing GRN items that have purchase_order_item_id, 
-- populate the purchase_order_id from the parent PO item
UPDATE grn_items gi
JOIN purchase_order_items poi ON gi.purchase_order_item_id = poi.id
SET gi.purchase_order_id = poi.purchase_order_id
WHERE gi.purchase_order_item_id IS NOT NULL;

-- =====================================================
-- STEP 3: Keep goods_received_notes.purchase_order_id 
-- =====================================================

-- Decision: KEEP purchase_order_id in goods_received_notes
-- Logic:
-- - For pure PO GRNs (all items from same PO): populate this field
-- - For mixed GRNs (multiple POs or manual items): set to NULL
-- - This provides quick filtering and reporting capabilities

-- Note: Skipping modification of goods_received_notes.purchase_order_id 
-- because it has existing foreign key constraint 'fk_grn_purchase_order'
-- The column is already properly configured for our needs

-- =====================================================
-- STEP 4: Add indexes for performance
-- =====================================================

-- Ensure we have proper indexes for GRN queries
-- Note: Using DROP/CREATE pattern since IF NOT EXISTS may not be supported in all MySQL versions

-- Drop indexes if they exist (ignore errors if they don't exist)
DROP INDEX IF EXISTS idx_grn_status_tenant ON goods_received_notes;
DROP INDEX IF EXISTS idx_grn_received_date ON goods_received_notes;
DROP INDEX IF EXISTS idx_grn_items_grn_id ON grn_items;

-- Create the indexes
CREATE INDEX idx_grn_status_tenant ON goods_received_notes(status, tenant_id);
CREATE INDEX idx_grn_received_date ON goods_received_notes(received_date);
CREATE INDEX idx_grn_items_grn_id ON grn_items(grn_id);

-- =====================================================
-- STEP 5: Validation queries (run after script)
-- =====================================================

-- Uncomment these queries to validate the schema changes:

/*
-- Check the new column structure
DESCRIBE grn_items;

-- Verify data population
SELECT 
    gi.id,
    gi.grn_id,
    gi.product_id,
    gi.purchase_order_id,
    gi.purchase_order_item_id,
    poi.purchase_order_id as poi_parent_po_id
FROM grn_items gi
LEFT JOIN purchase_order_items poi ON gi.purchase_order_item_id = poi.id
WHERE gi.purchase_order_item_id IS NOT NULL
LIMIT 10;

-- Check for any inconsistencies
SELECT COUNT(*) as inconsistent_records
FROM grn_items gi
JOIN purchase_order_items poi ON gi.purchase_order_item_id = poi.id
WHERE gi.purchase_order_id != poi.purchase_order_id;

-- Should return 0 inconsistent records
*/

-- =====================================================
-- SCHEMA UPDATE COMPLETE
-- =====================================================

-- Summary of changes:
-- 1. ✅ Added purchase_order_id column to grn_items
-- 2. ✅ Positioned column logically (after product_id)
-- 3. ✅ Added foreign key constraint for data integrity
-- 4. ✅ Added performance indexes
-- 5. ✅ Populated existing data automatically
-- 6. ✅ Kept goods_received_notes.purchase_order_id for pure PO GRNs
-- 7. ✅ Added proper documentation and validation queries

-- Next steps:
-- 1. Execute this script on the database
-- 2. Update backend code to use new schema
-- 3. Update documentation to reflect new logic
-- 4. Test all GRN operations with new schema
