# GRN Module: Detailed Technical Documentation

## Overview

This document provides a comprehensive technical overview of the Goods Received Note (GRN) module, focusing on the workflows, database interactions, and status updates throughout the GRN lifecycle.

## Table of Contents

1. [GRN Creation](#grn-creation)
   - [Draft GRN Creation](#draft-grn-creation)
   - [Completed GRN Creation](#completed-grn-creation)
   - [GRN Creation from Purchase Orders](#grn-creation-from-purchase-orders)
   - [Manual GRN Creation](#manual-grn-creation)
2. [GRN Status Updates](#grn-status-updates)
3. [Purchase Order Status Updates](#purchase-order-status-updates)
4. [Database Schema and Relationships](#database-schema-and-relationships)
5. [File Structure and Key Functions](#file-structure-and-key-functions)
6. [Common Issues and Solutions](#common-issues-and-solutions)

## GRN Creation

The GRN creation process involves multiple steps and can be initiated either from a Purchase Order or manually. The process differs slightly depending on the initial status (DRAFT or COMPLETED).

### Draft GRN Creation

**File:** `/backend/controllers/grnController.js`  
**Function:** `createGrn`

#### Process Flow:

1. Request validation (tenant ID, store ID, required fields)
2. GRN number generation using `generateGrnNumber`
3. Database transaction begins
4. GRN header record insertion
5. For each GRN item:
   - GRN item record insertion
   - No inventory updates occur
   - No purchase order or purchase order item updates occur
6. Transaction commits

#### Key SQL Queries:

```sql
-- Store settings check for over-receiving
SELECT allow_over_receiving FROM stores WHERE id = ? AND tenant_id = ?

-- GRN Number generation
-- (Implementation depends on your numbering system)

-- GRN Header Insertion
INSERT INTO goods_received_notes SET ?
-- Actual values from code:
-- {
--   id: currentGrnId,
--   tenant_id,
--   store_id,
--   grn_number: currentGrnNumber,
--   supplier_id: supplier_id || null,
--   purchase_order_id: purchase_order_id || null, 
--   received_date,
--   notes: notes || null,
--   user_id: userId,
--   received_by_user_id: userId,
--   status: 'DRAFT',
--   total_received_value: totalReceivedValue.toFixed(2),
--   supplier_invoice_number: supplier_invoice_number || null,
--   supplier_invoice_date: supplier_invoice_date || null,
--   total_tax_paid: parseFloat(total_tax_paid || 0).toFixed(2),
--   shipping_handling_paid: parseFloat(shipping_handling_paid || 0).toFixed(2),
--   other_charges_paid: parseFloat(other_charges_paid || 0).toFixed(2)
-- }

-- GRN Item Insertion (for each item)
INSERT INTO grn_items SET ?
-- Actual values from code:
-- {
--   id: grnItemId,
--   grn_id: currentGrnId,
--   product_id: item.product_id,
--   purchase_order_item_id: item.purchase_order_item_id || null,
--   quantity_ordered: item.quantity_ordered != null ? parseFloat(item.quantity_ordered) : null,
--   quantity_received: parseFloat(item.quantity_received),
--   unit_cost_price: parseFloat(item.unit_cost_price),
--   tax_rate: parseFloat(item.tax_rate).toFixed(2),
--   batch_number: item.batch_number || null,
--   expiry_date: item.expiry_date || null,
--   remarks: item.remarks || null,
-- }
```

#### Tables Affected:

- `goods_received_notes` - New GRN header record inserted
- `grn_items` - New GRN item records inserted

### Completed GRN Creation

**File:** `/backend/controllers/grnController.js`  
**Function:** `createGrn`

#### Process Flow:

1. Request validation (tenant ID, store ID, required fields)
2. GRN number generation using `generateGrnNumber`
3. Database transaction begins
4. GRN header record insertion with status 'COMPLETED'
5. For each GRN item:
   - GRN item record insertion
   - Inventory update occurs:
     - Product stock quantities increased
     - Weighted average cost calculation and update
     - Inventory log entry created
   - If linked to purchase order item:
     - Purchase order item quantity_received updated
     - Purchase order item status updated (PARTIALLY_RECEIVED or FULLY_RECEIVED)
6. Update all affected purchase orders by calling `updateAllAffectedPurchaseOrders`
7. Transaction commits

#### Key SQL Queries:

```sql
-- GRN Header Insertion (same as Draft but with status 'COMPLETED')
INSERT INTO goods_received_notes SET ?
-- Values are the same as for Draft but with status: 'COMPLETED'

-- GRN Item Insertion (same as Draft)
INSERT INTO grn_items SET ?

-- Pre-processing to find parent PO for PO item
SELECT poi.purchase_order_id, po.id as po_id FROM purchase_order_items poi 
  JOIN purchase_orders po ON poi.purchase_order_id = po.id 
  WHERE poi.id = ? AND po.tenant_id = ?
-- Values: [item.purchase_order_item_id, tenant_id]

-- Get product data for stock update with lock
SELECT stock_quantity, last_received_cost_price, weighted_average_cost, total_quantity_received 
  FROM products WHERE id = ? AND tenant_id = ? FOR UPDATE
-- Values: [item.product_id, tenant_id]

-- Product Stock Update
UPDATE products 
  SET stock_quantity = ?, 
      last_received_cost_price = ?, 
      weighted_average_cost = ?, 
      total_quantity_received = ?, 
      last_received_date = ? 
  WHERE id = ? AND tenant_id = ?
-- Values: [newQtyOnHand.toFixed(2), receivedCost.toFixed(2), newWeightedAverageCost.toFixed(4), 
--         newTotalQuantityReceived.toFixed(2), received_date, item.product_id, tenant_id]

-- Inventory Log Creation
INSERT INTO inventory_logs SET ?
-- Actual values from code:
-- {
--   id: inventoryLogId, 
--   tenant_id, 
--   store_id: grnHeader.store_id, 
--   product_id: item.product_id,
--   quantity_change: receivedQty.toFixed(2), 
--   reason: `GRN Receipt: ${currentGrnNumber}`,
--   current_stock_before_change: oldQtyOnHand.toFixed(2), 
--   current_stock_after_change: newQtyOnHand.toFixed(2),
--   created_by: userId, 
--   reference_type: 'GRN_ITEM', 
--   reference_id: item.meta_grn_item_id
-- }

-- Get PO item data with lock
SELECT poi.quantity_ordered, poi.quantity_received, poi.status AS current_po_item_status, 
  poi.purchase_order_id 
  FROM purchase_order_items poi 
  JOIN purchase_orders po ON poi.purchase_order_id = po.id 
  WHERE poi.id = ? AND po.tenant_id = ? FOR UPDATE
-- Values: [item.purchase_order_item_id, tenant_id]

-- Purchase Order Item Update (if linked to PO)
UPDATE purchase_order_items 
  SET quantity_received = ?, 
      status = ?, 
      item_received_status = ? 
  WHERE id = ?
-- Values: [newTotalPoItemReceivedQty.toFixed(2), newPoItemStatus, newItemReceivedStatus, item.purchase_order_item_id]
```

#### Tables Affected:

- `goods_received_notes` - New GRN header record inserted
- `grn_items` - New GRN item records inserted
- `products` - Stock quantity and weighted average cost updated
- `inventory_logs` - New inventory log entries created
- `purchase_order_items` - Quantity received and status updated
- `purchase_orders` - Status and received status updated

### GRN Creation from Purchase Orders

When creating a GRN from a Purchase Order, the process includes these additional steps:

1. The purchase_order_id is set on the GRN header
2. For each GRN item linked to a PO item:
   - purchase_order_item_id is set on the GRN item
   - meta_purchase_order_id is set on the GRN item (this is a derived field to track the parent PO)
   - quantity_ordered is copied from the PO item

#### Key Queries to Resolve PO Information:

```sql
-- Pre-processing to find parent PO for each PO item
SELECT poi.purchase_order_id, po.id as po_id 
  FROM purchase_order_items poi 
  JOIN purchase_orders po ON poi.purchase_order_id = po.id 
  WHERE poi.id = ? AND po.tenant_id = ?
-- Values: [item.purchase_order_item_id, tenant_id]

-- When updating PO item, get current status and quantities with lock
SELECT poi.quantity_ordered, poi.quantity_received, poi.status AS current_po_item_status, 
  poi.purchase_order_id 
  FROM purchase_order_items poi 
  JOIN purchase_orders po ON poi.purchase_order_id = po.id 
  WHERE poi.id = ? AND po.tenant_id = ? FOR UPDATE
-- Values: [item.purchase_order_item_id, tenant_id]

-- Checking for potential over-receiving (if store doesn't allow it)
SELECT p.name as product_name, poi.quantity_ordered, poi.quantity_received 
  FROM purchase_order_items poi 
  JOIN products p ON poi.product_id = p.id 
  JOIN purchase_orders po ON poi.purchase_order_id = po.id 
  WHERE poi.id = ? AND po.tenant_id = ?
-- Values: [item.purchase_order_item_id, tenant_id]
```

### Manual GRN Creation

For manual GRN creation (without PO reference):

1. No purchase_order_id is set on the GRN header
2. GRN items don't have purchase_order_item_id set
3. Product inventory is still updated if status is COMPLETED
4. No purchase order statuses are updated

## GRN Status Updates

**File:** `/backend/controllers/grnController.js`  
**Function:** `updateGrnStatus`

### Process Flow:

1. Current GRN status check
2. If status change is from DRAFT to COMPLETED:
   - For each GRN item:
     - Inventory update occurs (same as in Completed GRN creation)
     - PO item updates if linked
   - Update all affected purchase orders
3. If status change is from COMPLETED to DRAFT:
   - For each GRN item:
     - Inventory quantities are reversed
     - PO item quantities and statuses are reversed
   - Update all affected purchase orders
4. GRN status update

### Key SQL Queries:

```sql
-- Get current GRN status
SELECT status, purchase_order_id FROM goods_received_notes WHERE id = ? AND tenant_id = ?
-- Values: [grnId, tenant_id]

-- Update GRN status
UPDATE goods_received_notes SET status = ? WHERE id = ? AND tenant_id = ?
-- Values: [newStatus, grnId, tenant_id]

-- Get GRN items
SELECT * FROM grn_items WHERE grn_id = ?
-- Values: [grnId]

-- For DRAFT to COMPLETED transition:
-- (Same queries as in Completed GRN Creation for updating products, inventory logs, and PO items)

-- For COMPLETED to DRAFT transition:

-- Get current product data with lock
SELECT stock_quantity, last_received_date FROM products 
  WHERE id = ? AND tenant_id = ? FOR UPDATE
-- Values: [item.product_id, tenant_id]

-- Reverse inventory (COMPLETED to DRAFT)
UPDATE products 
  SET stock_quantity = stock_quantity - ?, 
      last_received_date = ? 
  WHERE id = ? AND tenant_id = ?
-- Values: [item.quantity_received, null or previous date, item.product_id, tenant_id]

-- Get PO item current status and quantities with lock
SELECT quantity_received, status, item_received_status 
  FROM purchase_order_items poi 
  JOIN purchase_orders po ON poi.purchase_order_id = po.id 
  WHERE poi.id = ? AND po.tenant_id = ? FOR UPDATE
-- Values: [item.purchase_order_item_id, tenant_id]

-- Reverse PO item quantities (COMPLETED to DRAFT)
UPDATE purchase_order_items 
  SET quantity_received = quantity_received - ?, 
      status = ?, 
      item_received_status = ? 
  WHERE id = ?
-- Values: [item.quantity_received, previousStatus, previousStatus, item.purchase_order_item_id]

-- Create inventory log for reversal
INSERT INTO inventory_logs SET ?
-- Similar values as before but with negative quantity_change and reason indicating reversal
```

## Purchase Order Status Updates

**File:** `/backend/controllers/grnController.js`  
**Function:** `updatePurchaseOrderStatus`

### Process Flow:

1. Get all items for the purchase order
2. Analyze item quantities and statuses:
   - Check if all items are fully received
   - Check if any items are received
3. Determine new PO status:
   - RECEIVED: if all items fully received
   - PARTIALLY_RECEIVED: if some items received but not all fully
   - ORDERED: if no items received
4. Update purchase order status and received_status

### Key SQL Queries:

```sql
-- Get all PO items to analyze with lock
SELECT poi.*, 
  COALESCE(poi.numeric_quantity_ordered, poi.quantity_ordered) as quantity_ordered, 
  COALESCE(poi.numeric_quantity_received, poi.quantity_received) as quantity_received,
  poi.status, 
  poi.item_received_status
FROM purchase_order_items poi 
JOIN purchase_orders po ON poi.purchase_order_id = po.id 
WHERE poi.purchase_order_id = ? AND po.tenant_id = ? FOR UPDATE
-- Values: [purchaseOrderId, tenant_id]

-- Update PO status
UPDATE purchase_orders 
  SET status = ? 
  WHERE id = ? AND tenant_id = ?
-- Values: [newPoStatus, purchaseOrderId, tenant_id]
-- newPoStatus logic:
-- - If all items fully received → 'RECEIVED'
-- - If any items received but not all fully → 'PARTIALLY_RECEIVED'
-- - If no items received → 'ORDERED'

-- Update PO received status and date
UPDATE purchase_orders 
  SET received_status = ?, 
      received_date = ? 
  WHERE id = ? AND tenant_id = ?
-- Values: [newReceivedStatus, received_date, purchaseOrderId, tenant_id]
-- newReceivedStatus logic follows similar pattern as status
```

## Database Schema and Relationships

### Key Tables:

- `goods_received_notes`: Stores GRN header information
- `grn_items`: Stores individual items received in a GRN
- `purchase_orders`: Stores PO header information
- `purchase_order_items`: Stores individual items in a PO
- `products`: Stores product information including stock quantities
- `inventory_logs`: Tracks inventory changes

### Primary Relationships:

- GRN → PO: Optional one-to-one (goods_received_notes.purchase_order_id → purchase_orders.id)
- GRN Item → PO Item: Optional one-to-one (grn_items.purchase_order_item_id → purchase_order_items.id)
- GRN → GRN Items: One-to-many (grn_items.grn_id → goods_received_notes.id)
- PO → PO Items: One-to-many (purchase_order_items.purchase_order_id → purchase_orders.id)

## File Structure and Key Functions

### Files:

- `/backend/controllers/grnController.js`: Main controller for GRN operations
- `/backend/routes/grnRoutes.js`: API routes for GRN endpoints
- `/backend/controllers/inventoryController.js`: Handles inventory updates

### Key Functions:

- `createGrn`: Creates a new GRN (draft or completed)
- `updateGrnStatus`: Updates an existing GRN's status
- `updatePurchaseOrderStatus`: Updates a PO's status based on its items
- `updateAllAffectedPurchaseOrders`: Updates all POs affected by a GRN
- `generateGrnNumber`: Generates a unique GRN number
- `calculateWeightedAverageCost`: Calculates new weighted average cost for a product

## Common Issues and Solutions

### Multi-tenancy Considerations:

- All queries involving purchase_order_items join with purchase_orders to validate tenant_id
- The purchase_order_items table does not have tenant_id, but validation happens through the parent PO
- Example of correct multi-tenant query:
  ```sql
  SELECT poi.* FROM purchase_order_items poi 
    JOIN purchase_orders po ON poi.purchase_order_id = po.id 
    WHERE poi.id = ? AND po.tenant_id = ?
  ```
- Example of incorrect query (will cause "Unknown column 'tenant_id' in 'where clause'" error):
  ```sql
  SELECT * FROM purchase_order_items WHERE id = ? AND tenant_id = ?
  ```

### Status Update Issues:

- Purchase order items have both status and item_received_status fields
- Both fields must be updated consistently
- Status field values: ORDERED, PARTIALLY_RECEIVED, FULLY_RECEIVED, CANCELLED
- PO status should be RECEIVED (not COMPLETED) when fully received
- Status determination logic:
  ```javascript
  if (newTotalPoItemReceivedQty >= quantityOrdered) {
    newPoItemStatus = 'FULLY_RECEIVED';
    newItemReceivedStatus = 'FULLY_RECEIVED';
  } else if (newTotalPoItemReceivedQty > 0) {
    newPoItemStatus = 'PARTIALLY_RECEIVED';
    newItemReceivedStatus = 'PARTIALLY_RECEIVED';
  } else {
    newPoItemStatus = 'ORDERED';
    newItemReceivedStatus = 'PENDING_RECEIPT';
  }
  ```

### Database Locking and Transaction Management:

- Critical queries use FOR UPDATE to prevent race conditions
- All GRN operations happen inside transactions using withTransaction:
  ```javascript
  const result = await db.withTransaction(async (connection) => {
    // Database operations here
  });
  ```
- Explicit error handling with rollback on errors is essential
- To avoid deadlocks, always acquire locks in the same order

### Query Optimization:

- Use appropriate indexes on frequently filtered columns (tenant_id, status, etc.)
- The purchase_order_items to purchase_orders join is frequent and should be optimized
- Consider adding an index on (purchase_order_id, status) in purchase_order_items

### Debugging Tips:

- Detailed logging has been added throughout the GRN controller
- Check logs for [Backend], [GRN], and [updatePurchaseOrderStatus] prefixes to trace issues
- Transaction rollback occurs on errors to maintain data integrity
- Monitor database locks if experiencing timeouts or hanging operations
