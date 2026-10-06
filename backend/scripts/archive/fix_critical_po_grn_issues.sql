-- CRITICAL FIXES FOR PO/GRN INTEGRATION ISSUES
-- Based on end-to-end testing findings

-- =====================================================
-- ISSUE 1: PO Item Status Empty Instead of NOT_RECEIVED
-- =====================================================

-- Check current PO item status values
SELECT 'Current PO Item Status Distribution' as info,
    status,
    COUNT(*) as count
FROM purchase_order_items
GROUP BY status;

-- Fix any empty/NULL status values to NOT_RECEIVED
UPDATE purchase_order_items 
SET status = 'NOT_RECEIVED' 
WHERE status IS NULL OR status = '';

-- Verify the fix
SELECT 'After Fix - PO Item Status Distribution' as info,
    status,
    COUNT(*) as count
FROM purchase_order_items
GROUP BY status;

-- =====================================================
-- ISSUE 4: products.total_quantity_received Not Updated
-- =====================================================

-- Check current total_quantity_received values
SELECT 'Products Total Quantity Received Check' as info,
    COUNT(*) as total_products,
    COUNT(CASE WHEN total_quantity_received > 0 THEN 1 END) as products_with_received_qty,
    SUM(total_quantity_received) as total_received_across_all
FROM products;

-- Note: This should be updated by GRN creation logic, not SQL
-- The backend code needs to be fixed to update this field

-- =====================================================
-- DIAGNOSTIC QUERIES FOR OTHER ISSUES
-- =====================================================

-- Check GRN header purchase_order_id population (Issue 2)
SELECT 'GRN Header PO ID Check' as info,
    COUNT(*) as total_grns,
    COUNT(purchase_order_id) as grns_with_po_id,
    COUNT(CASE WHEN purchase_order_id IS NULL THEN 1 END) as grns_without_po_id
FROM goods_received_notes;

-- Check GRN items PO ID population (Issue 3)
SELECT 'GRN Items PO ID Check' as info,
    COUNT(*) as total_grn_items,
    COUNT(purchase_order_id) as items_with_po_id,
    COUNT(purchase_order_item_id) as items_with_po_item_id,
    COUNT(CASE WHEN purchase_order_id IS NOT NULL AND purchase_order_item_id IS NOT NULL THEN 1 END) as fully_linked_items
FROM grn_items;

-- Check PO status updates (Issue 5)
SELECT 'PO Status Distribution' as info,
    status,
    COUNT(*) as count
FROM purchase_orders
GROUP BY status;

-- Check PO item quantity updates (Issue 5)
SELECT 'PO Item Quantity Updates' as info,
    COUNT(*) as total_items,
    COUNT(CASE WHEN quantity_received > 0 THEN 1 END) as items_with_received_qty,
    AVG(quantity_received) as avg_received_qty,
    SUM(quantity_received) as total_received_qty
FROM purchase_order_items;

-- Sample data to verify relationships
SELECT 'Sample GRN to PO Relationships' as info,
    grn.id as grn_id,
    grn.grn_number,
    grn.status as grn_status,
    grn.purchase_order_id as grn_header_po_id,
    gi.purchase_order_id as item_po_id,
    gi.purchase_order_item_id,
    po.purchase_order_number,
    po.status as po_status
FROM goods_received_notes grn
LEFT JOIN grn_items gi ON grn.id = gi.grn_id
LEFT JOIN purchase_orders po ON gi.purchase_order_id = po.id
WHERE grn.tenant_id = 'd7f267da-d5d9-4a15-b0d3-31ca710a4492'
ORDER BY grn.created_at DESC
LIMIT 10;
