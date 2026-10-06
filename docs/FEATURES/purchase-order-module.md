# Purchase Order Module

## Overview

The Purchase Order (PO) module is a fundamental component of the procurement system in Zettaz Cloud Enterprise. It enables businesses to create, manage, and track orders placed with suppliers for products and materials. The module integrates with the Goods Received Note (GRN) module to complete the procurement lifecycle.

## Business Purpose

Purchase Orders serve several critical business functions:

1. **Procurement Planning**: Documenting the intent to purchase specific quantities of products at agreed prices
2. **Supplier Communication**: Providing a formal document to suppliers detailing the order requirements
3. **Budget Control**: Tracking committed expenditures before actual payment
4. **Inventory Planning**: Planning for incoming inventory based on ordered items
5. **Legal Protection**: Creating a legally binding document detailing the terms of the purchase
6. **Audit Trail**: Maintaining records of all procurement activities

## Key Entities

### Purchase Order Header

The Purchase Order header contains information about the overall order:

| Field | Description |
|-------|-------------|
| `id` | Unique identifier for the PO (UUID) |
| `tenant_id` | The tenant (business) that owns this PO |
| `store_id` | The store location making the purchase |
| `supplier_id` | The supplier from whom goods are being ordered |
| `po_number` | A human-readable reference number |
| `order_date` | Date when the order was placed |
| `expected_delivery_date` | Anticipated date of delivery |
| `status` | Current status of the PO (DRAFT, ORDERED, etc.) |
| `received_status` | Status of receipt (NOT_RECEIVED, PARTIALLY_RECEIVED, FULLY_RECEIVED) |
| `last_grn_date` | Date of the most recent GRN for this PO |
| `notes` | Additional notes about the order |
| `shipping_address` | Address for delivery |
| `total_amount` | Total value of the order |
| `created_at` | Timestamp when the PO was created |
| `updated_at` | Timestamp when the PO was last updated |
| `created_by_user_id` | User who created the PO |
| `updated_by_user_id` | User who last updated the PO |

### Purchase Order Items

Each Purchase Order can have multiple line items, each representing a specific product order:

| Field | Description |
|-------|-------------|
| `id` | Unique identifier for the PO item (UUID) |
| `purchase_order_id` | Reference to the parent PO |
| `product_id` | The product being ordered |
| `quantity_ordered` | Quantity of the product ordered |
| `quantity_received` | Quantity of the product received so far |
| `unit_price` | Unit price of the product |
| `subtotal` | Total price for this line item |
| `status` | Status of this line item |
| `item_received_status` | Receipt status of this specific item |
| `created_at` | Timestamp when the PO item was created |
| `updated_at` | Timestamp when the PO item was last updated |

## Status Workflow

The Purchase Order module supports a comprehensive status workflow:

### Purchase Order Status Values

| Status | Description |
|--------|-------------|
| `DRAFT` | Initial state, PO is being prepared |
| `ORDERED` | PO has been sent to the supplier |
| `PARTIALLY_RECEIVED` | Some items on the PO have been received |
| `FULLY_RECEIVED` | All items on the PO have been received |
| `CANCELLED` | PO has been cancelled |
| `COMPLETED` | PO has been fully processed and is considered complete |

### Received Status Values

| Status | Description |
|--------|-------------|
| `NOT_RECEIVED` | No items have been received yet |
| `PARTIALLY_RECEIVED` | Some items have been received, but not all |
| `FULLY_RECEIVED` | All items have been received |

### Status Transition Rules

1. **New PO Creation**: Initial status is set to `DRAFT`
2. **PO Confirmation**: Status changes from `DRAFT` to `ORDERED` when the PO is confirmed
3. **Goods Receipt**: 
   - When some items are received: Status updates to `PARTIALLY_RECEIVED`
   - When all items are received: Status updates to `FULLY_RECEIVED`
4. **Cancellation**: A PO can be cancelled if no goods have been received, changing status to `CANCELLED`
5. **Completion**: A fully received PO can be marked as `COMPLETED` to indicate the procurement cycle is finished

## Integration with GRN Module

The Purchase Order module is tightly integrated with the Goods Received Note (GRN) module:

1. **PO Selection in GRN**: When creating a GRN, users can select an existing PO
2. **Item Auto-population**: PO items are automatically populated in the GRN
3. **Quantity Tracking**: As items are received via GRNs, the received quantities in the PO are updated
4. **Status Updates**: PO status is automatically updated based on GRN processing
5. **Last GRN Date**: The `last_grn_date` field is updated whenever a new GRN is processed for the PO

### Status Synchronization Logic

When a GRN status changes or a GRN is deleted, the system updates all affected Purchase Orders:

1. **Calculate Item Status**: For each PO item, compare `quantity_ordered` vs. `quantity_received`
2. **Determine Overall Status**: Based on item statuses, determine the overall PO status:
   - If all items are fully received: `FULLY_RECEIVED`
   - If some items are received: `PARTIALLY_RECEIVED`
   - If no items are received: `NOT_RECEIVED` (reverts to `ORDERED` if previously had receipts)

## API Endpoints

The Purchase Order module exposes the following API endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/purchase-orders` | GET | Get a list of Purchase Orders |
| `/api/purchase-orders/:id` | GET | Get a specific Purchase Order by ID |
| `/api/purchase-orders` | POST | Create a new Purchase Order |
| `/api/purchase-orders/:id` | PUT | Update an existing Purchase Order |
| `/api/purchase-orders/:id` | DELETE | Delete a Purchase Order |
| `/api/purchase-orders/:id/status` | PUT | Update the status of a Purchase Order |
| `/api/purchase-orders/:id/items` | GET | Get all items for a specific Purchase Order |

## Implementation Details

### Key Functions

#### `updatePurchaseOrderStatus`

This function updates a Purchase Order's status based on the receipt status of its items:

```javascript
const updatePurchaseOrderStatus = async (connection, purchaseOrderId, tenant_id) => {
  try {
    // Get PO status to check if it's in DRAFT status
    const [poStatusResult] = await connection.query(
      'SELECT status FROM purchase_orders WHERE id = ? AND tenant_id = ?',
      [purchaseOrderId, tenant_id]
    );
    
    // Skip update if PO is in DRAFT status
    let poStatus;
    if (Array.isArray(poStatusResult) && poStatusResult.length > 0) {
      poStatus = poStatusResult[0].status;
    } else if (poStatusResult && typeof poStatusResult === 'object') {
      poStatus = poStatusResult.status;
    }
    
    if (poStatus === 'DRAFT') {
      console.log(`Skipping PO status update for PO ${purchaseOrderId} as it is in DRAFT status`);
      return;
    }

    // Get all PO items to calculate status
    const [rows, fields] = await connection.query(
      'SELECT poi.quantity_ordered, poi.quantity_received FROM purchase_order_items poi ' +
      'JOIN purchase_orders po ON poi.purchase_order_id = po.id ' +
      'WHERE poi.purchase_order_id = ? AND po.tenant_id = ?',
      [purchaseOrderId, tenant_id]
    );
    
    let poItems;
    if (Array.isArray(rows)) {
      poItems = rows;
    } else if (rows && typeof rows === 'object') {
      poItems = [rows];
    } else {
      poItems = [];
    }

    // Calculate receipt status based on item quantities
    let allItemsFullyReceived = true;
    let anyItemReceived = false;
    let hasOrderableItems = false;

    for (const item of poItems) {
      if (item.quantity_ordered > 0) {
        hasOrderableItems = true;
        
        if (item.quantity_received > 0) {
          anyItemReceived = true;
        }
        
        if (item.quantity_received < item.quantity_ordered) {
          allItemsFullyReceived = false;
        }
      }
    }

    // Determine new PO status
    let newPoStatus;
    let newReceivedStatus;
    
    if (!hasOrderableItems) {
      newPoStatus = 'COMPLETED';
      newReceivedStatus = 'FULLY_RECEIVED';
    } else if (allItemsFullyReceived) {
      newPoStatus = 'COMPLETED';
      newReceivedStatus = 'FULLY_RECEIVED';
    } else if (anyItemReceived) {
      newPoStatus = 'PARTIALLY_RECEIVED';
      newReceivedStatus = 'PARTIALLY_RECEIVED';
    } else {
      newPoStatus = 'ORDERED';
      newReceivedStatus = 'NOT_RECEIVED';
    }

    // Update PO status and last_grn_date
    await connection.query(
      'UPDATE purchase_orders SET status = ?, received_status = ?, last_grn_date = NOW(), ' +
      'updated_at = NOW() WHERE id = ? AND tenant_id = ?',
      [newPoStatus, newReceivedStatus, purchaseOrderId, tenant_id]
    );

    console.log(`Updated PO ${purchaseOrderId} status to ${newPoStatus} and received_status to ${newReceivedStatus}`);
    return { status: newPoStatus, received_status: newReceivedStatus };
  } catch (error) {
    console.error(`Error updating purchase order status for PO ${purchaseOrderId}:`, error);
    throw error;
  }
};
```

## UI Components

The Purchase Order module includes the following key UI components:

1. **PurchaseManagementPage**: Main page for listing and managing Purchase Orders
2. **CreatePurchaseOrderModal**: Modal for creating new Purchase Orders
3. **EditPurchaseOrderModal**: Modal for editing existing Purchase Orders
4. **PurchaseOrderDetailsView**: Component for viewing Purchase Order details

## Multi-tenancy Support

All Purchase Order operations enforce multi-tenancy by:

1. Including `tenant_id` in all database queries
2. Validating that users can only access Purchase Orders belonging to their tenant
3. Ensuring all related data (products, suppliers) belong to the same tenant

## Validation Rules

The Purchase Order module implements the following validation rules:

1. **Required Fields**: PO number, supplier, order date
2. **Item Validation**: Each item must have a valid product, quantity, and unit price
3. **Status Validation**: Status changes must follow the allowed workflow
4. **Cancellation Validation**: POs can only be cancelled if no goods have been received

## Known Issues and Planned Enhancements

1. **Item Status Updates**: Currently, `purchase_order_items.item_received_status` is not consistently updated during GRN processing. This field should be updated to accurately reflect receipt states at the item level.

2. **PO Item Status on Cancellation**: When a PO is cancelled, `purchase_order_items.status` is not changed to 'CANCELLED'. Consider updating item statuses upon PO cancellation for clarity.

3. **Tax Rate Handling**: The `CreatePurchaseOrderModal.tsx` has `taxRate = 0.0` (hardcoded). This needs clarification if intentional or if tax calculation at the PO creation stage is a future requirement.

## Best Practices

1. **Status Management**: Always use the provided helper functions to update PO status to ensure consistency
2. **Transaction Usage**: Wrap related database operations in transactions to maintain data integrity
3. **Multi-PO Awareness**: When processing GRNs, be aware that a single GRN can affect multiple POs
4. **Error Handling**: Implement robust error handling, especially for status transitions
