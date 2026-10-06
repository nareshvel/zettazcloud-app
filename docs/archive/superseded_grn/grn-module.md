# Goods Received Note (GRN) Module

## Overview

The Goods Received Note (GRN) module is a critical component of the inventory management system, responsible for recording the receipt of goods against purchase orders. This module enables users to track received items, update inventory levels, and manage the status of purchase orders.

## Business Purpose

GRNs serve several important business functions:

1. **Inventory Control**: Recording the quantity and quality of received goods
2. **Purchase Order Tracking**: Updating the status of purchase orders based on received quantities
3. **Cost Management**: Tracking the actual cost of received goods for inventory valuation
4. **Supplier Performance Monitoring**: Tracking delivery times and quality of received goods
5. **Audit Trail**: Maintaining a record of all received goods for accounting and audit purposes

## Key Entities

### GRN Header

The GRN header contains information about the overall receipt:

| Field | Description |
|-------|-------------|
| `id` | Unique identifier for the GRN (UUID) |
| `tenant_id` | The tenant (business) that owns this GRN |
| `store_id` | The store location receiving the goods |
| `purchase_order_id` | Reference to the primary purchase order (optional) |
| `supplier_id` | The supplier providing the goods |
| `grn_number` | A human-readable reference number |
| `received_date` | Date when goods were received |
| `supplier_invoice_number` | Reference to the supplier's invoice (optional) |
| `supplier_invoice_date` | Date of the supplier's invoice (optional) |
| `status` | Current status of the GRN (DRAFT, COMPLETED) |
| `notes` | Additional notes about the receipt |
| `created_at` | Timestamp when the GRN was created |
| `updated_at` | Timestamp when the GRN was last updated |
| `created_by_user_id` | User who created the GRN |
| `updated_by_user_id` | User who last updated the GRN |

### GRN Items

Each GRN can have multiple line items, each representing a specific product receipt:

| Field | Description |
|-------|-------------|
| `id` | Unique identifier for the GRN item (UUID) |
| `tenant_id` | The tenant (business) that owns this GRN item |
| `grn_id` | Reference to the parent GRN |
| `purchase_order_item_id` | Reference to the purchase order item (optional) |
| `product_id` | The product being received |
| `quantity_received` | Quantity of the product received |
| `quantity_accepted` | Quantity of the product accepted after inspection |
| `quantity_rejected` | Quantity of the product rejected after inspection |
| `unit_cost` | Unit cost of the product |
| `created_at` | Timestamp when the GRN item was created |
| `updated_at` | Timestamp when the GRN item was last updated |

## Status Workflow

The GRN module supports the following status workflow:

1. **DRAFT**: Initial state where the GRN is created but inventory has not been updated
2. **COMPLETED**: Final state where the GRN has been processed and inventory has been updated

When a GRN's status changes between these states, several important processes occur:

### DRAFT to COMPLETED (Inventory Commitment)

When a GRN is moved from DRAFT to COMPLETED:

1. Inventory levels are increased for the received products
2. The weighted average cost (WAC) is recalculated for each product
3. The status of all affected purchase orders is updated
4. The `last_received_date` is updated for the products

### COMPLETED to DRAFT (Inventory Reversal)

When a GRN is moved from COMPLETED to DRAFT:

1. Inventory levels are decreased for the received products
2. The weighted average cost (WAC) is recalculated for each product
3. The status of all affected purchase orders is updated

## Purchase Order Status Synchronization

The GRN module maintains synchronization with the Purchase Order module by updating PO statuses when GRNs are created, updated, or deleted.

### Purchase Order Status Values

| Status | Description |
|--------|-------------|
| `DRAFT` | Initial state, PO is being prepared |
| `ORDERED` | PO has been sent to the supplier |
| `PARTIALLY_RECEIVED` | Some items on the PO have been received |
| `FULLY_RECEIVED` | All items on the PO have been received |
| `CANCELLED` | PO has been cancelled |
| `COMPLETED` | PO has been fully processed and is considered complete |

### PO Status Update Logic

The system implements a comprehensive approach to updating Purchase Order statuses when GRN statuses change:

1. **Collect Affected POs**: Identify all Purchase Orders affected by a GRN
   - The direct PO linked in the GRN header
   - Any POs associated with individual GRN items through their `purchase_order_item_id`

2. **Update Each PO Status**: For each affected PO:
   - Query all items for the PO to check quantity ordered vs. received
   - Calculate if all items are fully received, partially received, or not received
   - Update the PO status accordingly
   - Update the `last_grn_date` field

3. **Handle Multiple POs**: A single GRN can affect multiple POs, and the system ensures all are updated correctly

## Error Handling

The GRN module implements robust error handling to ensure data integrity:

1. **Missing Products**: If a product referenced in a GRN has been deleted, the system logs warnings and skips those specific products while allowing the transaction to continue.

2. **Database Transactions**: All database operations are performed within transactions to ensure data consistency.

3. **Input Validation**: Comprehensive validation of input data before processing.

## API Endpoints

The GRN module exposes the following API endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/grn` | GET | Get a list of GRNs |
| `/api/grn/:id` | GET | Get a specific GRN by ID |
| `/api/grn` | POST | Create a new GRN |
| `/api/grn/:id` | PUT | Update an existing GRN |
| `/api/grn/:id` | DELETE | Delete a GRN |
| `/api/grn/:id/status` | PUT | Update the status of a GRN |

## Implementation Details

### Key Functions

#### `updateAllAffectedPurchaseOrders`

This helper function identifies and updates all Purchase Orders affected by a GRN:

```javascript
const updateAllAffectedPurchaseOrders = async (connection, grnId, tenant_id) => {
  // Get all purchase order IDs affected by this GRN
  const [poResults] = await connection.query(
    'SELECT DISTINCT po.id FROM purchase_orders po ' +
    'LEFT JOIN grn_header gh ON gh.purchase_order_id = po.id ' +
    'LEFT JOIN grn_items gi ON gi.grn_id = gh.id ' +
    'LEFT JOIN purchase_order_items poi ON gi.purchase_order_item_id = poi.id ' +
    'WHERE (gh.id = ? OR gi.grn_id = ?) AND po.tenant_id = ?',
    [grnId, grnId, tenant_id]
  );

  // Create a set of unique PO IDs
  const poIds = new Set();
  
  if (Array.isArray(poResults)) {
    poResults.forEach(po => {
      if (po && po.id) {
        poIds.add(po.id);
      }
    });
  } else if (poResults && poResults.id) {
    poIds.add(poResults.id);
  }

  // Update each affected PO
  for (const poId of poIds) {
    await updatePurchaseOrderStatus(connection, poId, tenant_id);
  }
};
```

#### `updateGrnStatus`

This function handles the status changes for GRNs, including inventory commitment and reversal:

```javascript
const updateGrnStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const tenant_id = req.user.tenant_id;

  // Validate input
  if (!id || !status) {
    return res.status(400).json({ error: 'GRN ID and status are required' });
  }

  try {
    await db.withTransaction(async (connection) => {
      // Get current GRN status
      const [grnResult] = await connection.query(
        'SELECT status FROM grn_header WHERE id = ? AND tenant_id = ?',
        [id, tenant_id]
      );

      const currentStatus = Array.isArray(grnResult) && grnResult.length > 0 
        ? grnResult[0].status 
        : null;

      if (!currentStatus) {
        return res.status(404).json({ error: 'GRN not found' });
      }

      // Handle status changes
      if (currentStatus === 'COMPLETED' && status === 'DRAFT') {
        // Inventory reversal logic
        // ...
      } else if (currentStatus === 'DRAFT' && status === 'COMPLETED') {
        // Inventory commitment logic
        // ...
      }

      // Update all affected purchase orders
      await updateAllAffectedPurchaseOrders(connection, id, tenant_id);

      // Update GRN status
      await connection.query(
        'UPDATE grn_header SET status = ?, updated_at = NOW(), updated_by_user_id = ? WHERE id = ? AND tenant_id = ?',
        [status, req.user.id, id, tenant_id]
      );
    });

    return res.status(200).json({ message: 'GRN status updated successfully' });
  } catch (error) {
    console.error('Error updating GRN status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
```

## Recent Improvements (June 2025)

1. **Enhanced PO Status Handling for GRN Status Changes**:
   - Implemented a new helper function `updateAllAffectedPurchaseOrders` that identifies and updates all Purchase Orders affected by a GRN
   - This function is now called during all GRN status changes (inventory commitment, inventory reversal) and GRN deletion
   - Ensures data consistency between GRNs and POs, even when GRNs contain items from multiple POs

2. **Robust Error Handling for Missing Products**:
   - Added graceful error handling for cases where products referenced in a GRN are no longer in the database
   - System now logs warnings and skips those specific products while allowing the transaction to continue

3. **User-Selected GRN Status Support**:
   - Fixed the GRN creation process to respect the status selected by the user
   - Previously, the status was hardcoded to "COMPLETED"; now it uses `req.body.status || 'COMPLETED'` to allow flexibility

## Future Enhancements

1. **Proactive Over-Receiving Checks**:
   - Implement checks to prevent GRN creation with quantities exceeding PO ordered quantities
   - Provide clear, user-friendly error messages

2. **Item-Level Status Updates**:
   - Update `purchase_order_items.item_received_status` during GRN processing
   - Ensure accurate receipt states at the item level

3. **PO Item Status on Cancellation**:
   - Update PO item statuses to 'CANCELLED' upon PO cancellation for clarity

## UI Components

The GRN module includes the following key UI components:

1. **GoodsReceivingPage**: Main page for listing and managing GRNs
2. **AddGoodsReceivedModal**: Modal for creating and editing GRNs
3. **GrnDetailsView**: Component for viewing GRN details

## Multi-tenancy Support

All GRN operations enforce multi-tenancy by:

1. Including `tenant_id` in all database queries
2. Validating that users can only access GRNs belonging to their tenant
3. Ensuring all related data (products, purchase orders) belong to the same tenant
