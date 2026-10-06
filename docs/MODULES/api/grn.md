# Goods Received Notes (GRN) API

This document details the endpoints for managing Goods Received Notes in the Zettaz Cloud Enterprise API.

## Overview

Goods Received Notes (GRNs) are used to record the receipt of goods against purchase orders. The GRN module handles inventory updates, purchase order status updates, and tracking of received products.

**Note on Fetching Purchase Orders for GRN Creation:** When fetching Purchase Orders to populate selection UIs for GRN creation (typically using the `GET /api/purchase-orders` endpoint from the Purchase Order API), this endpoint now supports filtering by multiple statuses. You can pass a comma-separated list in the `status` query parameter (e.g., `GET /api/purchase-orders?status=ORDERED,PARTIALLY_RECEIVED`) to retrieve POs that are either fully ordered or already partially received.

## Endpoints

### List GRNs

```
GET /api/v1/grn
```

Retrieves a paginated list of Goods Received Notes.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20, max: 100) |
| sort | string | Field to sort by (default: 'created_at') |
| order | string | Sort order ('asc' or 'desc', default: 'desc') |
| search | string | Search term for GRN number or reference |
| status | string | Filter by GRN status ('DRAFT', 'COMPLETED') |
| purchase_order_id | string | Filter by purchase order ID |
| start_date | date | Filter by date range start (ISO format) |
| end_date | date | Filter by date range end (ISO format) |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "123",
      "grn_number": "GRN-001",
      "purchase_order_id": "456",
      "purchase_order_number": "PO-001",
      "supplier_id": "789",
      "supplier_name": "Supplier A",
      "status": "COMPLETED",
      "date_received": "2023-05-15T10:30:00.000Z",
      "notes": "All items received in good condition",
      "created_by": "user_id_1",
      "created_by_name": "John Doe",
      "tenant_id": "tenant_123",
      "created_at": "2023-05-15T10:30:00.000Z",
      "updated_at": "2023-05-15T10:35:00.000Z",
      "item_count": 5,
      "total_received_quantity": 100
    },
    // Additional GRNs...
  ],
  "pagination": {
    "totalItems": 50,
    "totalPages": 3,
    "currentPage": 1,
    "pageSize": 20,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

#### Notes
- Results are automatically filtered by the tenant_id of the authenticated user.
- The response includes summary information such as item_count and total_received_quantity.
- Supplier and purchase order information are included for convenience.

### Get GRN Details

```
GET /api/v1/grn/:id
```

Retrieves detailed information for a specific Goods Received Note.

#### Response

```json
{
  "success": true,
  "data": {
    "id": "123",
    "grn_number": "GRN-001",
    "purchase_order_id": "456",
    "purchase_order_number": "PO-001",
    "supplier_id": "789",
    "supplier_name": "Supplier A",
    "status": "COMPLETED",
    "date_received": "2023-05-15T10:30:00.000Z",
    "notes": "All items received in good condition",
    "created_by": "user_id_1",
    "created_by_name": "John Doe",
    "tenant_id": "tenant_123",
    "created_at": "2023-05-15T10:30:00.000Z",
    "updated_at": "2023-05-15T10:35:00.000Z",
    "items": [
      {
        "id": "item_1",
        "product_id": "prod_1",
        "product_name": "Product A",
        "product_sku": "SKU-001",
        "expected_quantity": 20,
        "received_quantity": 20,
        "unit_cost": 29.99,
        "notes": "All units in good condition"
      },
      {
        "id": "item_2",
        "product_id": "prod_2",
        "product_name": "Product B",
        "product_sku": "SKU-002",
        "expected_quantity": 30,
        "received_quantity": 28,
        "unit_cost": 19.99,
        "notes": "2 units damaged"
      },
      // Additional items...
    ]
  }
}
```

#### Notes
- The detailed view includes all GRN items with product information.
- Expected quantities are derived from the linked purchase order.
- Tenant isolation is enforced - users can only access GRNs within their tenant.

### Create GRN

```
POST /api/v1/grn
```

Creates a new Goods Received Note. This endpoint supports receiving items against single or multiple Purchase Orders, or even without a direct PO link at the GRN header level.

#### Request Body

```json
{
  "purchase_order_id": "456", // Optional: UUID of a single PO. Can be null if items are from multiple POs or no specific PO.
  "supplier_id": "789", // Required if purchase_order_id is null and items are not linked to POs.
  "store_id": "store_abc", // Required: The store where goods are being received.
  "date_received": "2023-06-01T09:00:00.000Z",
  "notes": "Partial delivery, items from PO-001 and PO-002",
  "status": "COMPLETED", // e.g., DRAFT, COMPLETED
  "items": [
    {
      "purchase_order_item_id": "po_item_abc", // Recommended: UUID of the specific PO item being received. Links this GRN item to a PO line.
      "product_id": "prod_1", // Required if purchase_order_item_id is not provided or for manual items.
      "received_quantity": 15,
      "unit_cost_price": 29.99, // The actual cost at the time of receiving.
      "notes": "5 units back-ordered from PO-001"
    },
    {
      "purchase_order_item_id": "po_item_xyz", // Links this item to a different PO (e.g., PO-002).
      "product_id": "prod_2",
      "received_quantity": 30,
      "unit_cost_price": 19.99,
      "notes": "Complete delivery for this item from PO-002"
    },
    {
      "product_id": "prod_3", // Manual item, not linked to a PO item.
      "received_quantity": 5,
      "unit_cost_price": 10.00,
      "notes": "Sample items received without PO"
    }
    // Additional items...
  ]
}
```

#### Notes on `items` array:
- Each item in the `items` array represents a product being received.
- `purchase_order_item_id`: **Highly recommended**. This should be the UUID of the specific line item from a Purchase Order. Providing this ensures accurate tracking against POs and enables a single GRN to receive items from multiple POs.
  - If `purchase_order_item_id` is provided, `product_id` might be redundant if the system can look it up, but including it can be a good validation measure. The backend will prioritize `purchase_order_item_id` for linking.
  - `expected_quantity` is typically derived from the linked `purchase_order_item_id` by the backend.
- `product_id`: Required if `purchase_order_item_id` is not provided (i.e., for items received manually without a PO line item reference).
- `received_quantity`: The actual quantity of the product received.
- `unit_cost_price`: The cost of the item at the time of receiving. This is important for inventory valuation (e.g., Weighted Average Cost).

#### Behavior:
- If `status` is set to `COMPLETED` (or a similar status that implies finalization):
  - Inventory levels for the received products will be updated.
  - If `purchase_order_item_id` is provided for items, the `quantity_received` on those PO items will be updated, and their status (e.g., `PARTIALLY_RECEIVED`, `FULLY_RECEIVED`) will be re-evaluated.
  - The overall status of all unique Purchase Orders involved (linked via `purchase_order_id` in the header or via `purchase_order_item_id` in items) will be updated (e.g., to `PARTIALLY_RECEIVED` or `FULLY_RECEIVED`).
- A unique `grn_number` will be generated by the system.

#### Response

```json
{
  "success": true,
  "data": {
    "id": "124",
    "grn_number": "GRN-002",
    "purchase_order_id": "456",
    "purchase_order_number": "PO-001",
    "supplier_id": "789",
    "supplier_name": "Supplier A",
    "status": "COMPLETED",
    "date_received": "2023-06-01T09:00:00.000Z",
    "notes": "Partial delivery, remaining items expected next week",
    "created_by": "user_id_1",
    "created_by_name": "John Doe",
    "tenant_id": "tenant_123",
    "created_at": "2023-06-01T09:05:00.000Z",
    "updated_at": "2023-06-01T09:05:00.000Z",
    "items": [
      {
        "id": "item_3",
        "product_id": "prod_1",
        "product_name": "Product A",
        "product_sku": "SKU-001",
        "expected_quantity": 20,
        "received_quantity": 15,
        "unit_cost": 29.99,
        "notes": "5 units back-ordered"
      },
      {
        "id": "item_4",
        "product_id": "prod_2",
        "product_name": "Product B",
        "product_sku": "SKU-002",
        "expected_quantity": 30,
        "received_quantity": 30,
        "unit_cost": 19.99,
        "notes": "Complete delivery"
      }
      // Additional items...
    ],
    "inventory_updates": [
      {
        "product_id": "prod_1",
        "previous_quantity": 50,
        "new_quantity": 65,
        "change": 15
      },
      {
        "product_id": "prod_2",
        "previous_quantity": 20,
        "new_quantity": 50,
        "change": 30
      }
    ],
    "purchase_order_status": {
      "previous_status": "ORDERED",
      "new_status": "PARTIALLY_RECEIVED",
      "received_status": "PARTIALLY_RECEIVED"
    }
  }
}
```

#### Notes
- The status can be "DRAFT" or "COMPLETED" - if "DRAFT", inventory is not updated until status is changed to "COMPLETED"
- When status is "COMPLETED", the following occurs:
  - Product inventory quantities are increased
  - Product last_received_date is updated
  - Purchase order status is updated based on received quantities
  - Purchase order last_grn_date is updated
  - The `item_received_status` on the corresponding `purchase_order_items` is updated to reflect received quantities (e.g., 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED').
- All operations are performed within a database transaction to ensure data integrity

### Update GRN

```
PUT /api/v1/grn/:id
```

Updates an existing Goods Received Note. This is primarily used to edit draft GRNs or update notes.

#### Request Body

```json
{
  "date_received": "2023-06-01T10:00:00.000Z",
  "notes": "Updated delivery notes",
  "items": [
    {
      "id": "item_3",
      "received_quantity": 18,
      "notes": "Additional 3 units arrived separately"
    }
    // Additional items to update...
  ]
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "124",
    "grn_number": "GRN-002",
    "status": "DRAFT",
    "date_received": "2023-06-01T10:00:00.000Z",
    "notes": "Updated delivery notes",
    "updated_at": "2023-06-01T10:05:00.000Z",
    "items": [
      {
        "id": "item_3",
        "product_id": "prod_1",
        "received_quantity": 18,
        "notes": "Additional 3 units arrived separately"
      },
      // Other items remain unchanged...
    ]
  }
}
```

#### Notes
- Only draft GRNs can have their items modified
- Completed GRNs can only have their notes updated
- Item updates must include the item ID for identification

### Update GRN Status

```
PATCH /api/v1/grn/:id/status
```

Updates the status of a specific Goods Received Note. This is a critical operation that triggers inventory adjustments, updates linked purchase order items, and re-evaluates the status of all affected purchase orders.

#### Request Body

```json
{
  "new_status": "COMPLETED", // Required: The target status for the GRN.
  "tenant_id": "tenant_123" // Required: The tenant ID to ensure operation is within the correct context.
}
```

**Valid Status Transitions and Behavior:**

- **`DRAFT` -> `COMPLETED` / `POSTED`:**
  - **Inventory Commitment:** Stock levels for received products are increased. Weighted Average Cost (WAC) for products may be recalculated.
  - **PO Item Update:** The `quantity_received` on linked `purchase_order_items` is updated (usually increased based on the GRN item's `received_quantity`). The status of these PO items is re-evaluated (e.g., to `PARTIALLY_RECEIVED` or `FULLY_RECEIVED`).
  - **PO Header Update:** The overall status of all unique Purchase Orders associated with the GRN items is re-evaluated and updated.
  - An inventory log entry is created for each item, detailing the stock change.

- **`COMPLETED` / `POSTED` -> `DRAFT` / `CANCELLED`:**
  - **Inventory Reversal:** Stock levels for received products are decreased (reversed based on the GRN item's `received_quantity`).
  - **PO Item Update:** The `quantity_received` on linked `purchase_order_items` is correspondingly decreased. The status of these PO items is re-evaluated.
  - **PO Header Update:** The overall status of all unique Purchase Orders associated with the GRN items is re-evaluated and updated.
  - An inventory log entry is created for each item, detailing the stock reversal.

- **`DRAFT` -> `CANCELLED`:**
  - No inventory impact as items were not yet committed.
  - PO items are not affected if no quantities were previously considered 'received' under a 'COMPLETED' status.
  - The GRN is marked as `CANCELLED`.

- **General Rules:**
  - Certain transitions might be disallowed (e.g., from `CANCELLED` to `COMPLETED` directly without specific business logic). The API will return an error for invalid transitions.
  - The `tenant_id` in the request body is crucial for ensuring data integrity and security in a multi-tenant system.

#### Response

On success (HTTP 200), typically returns a message indicating success:
```json
{
  "message": "GRN status updated successfully to COMPLETED."
}
```
Or, if the status is already the new status:
```json
{
  "message": "GRN status is already COMPLETED."
}
```

In case of an error (e.g., GRN not found, invalid status transition), an appropriate error response (4xx or 5xx) will be returned.

#### Notes
- All database operations (GRN status update, product stock update, PO item updates, PO header updates, inventory logging) are performed within a single database transaction to ensure data consistency. If any part fails, the entire transaction is rolled back.

### Delete GRN

```
DELETE /api/v1/grn/:id
```

Deletes a draft Goods Received Note.

#### Response

```json
{
  "success": true,
  "data": {
    "message": "GRN deleted successfully"
  }
}
```

#### Notes
- Only GRNs in "DRAFT" status can be deleted
- Completed GRNs must be reversed by changing status to "DRAFT" first

### Get Purchase Order Items for GRN

```
GET /api/v1/grn/purchase-order/:id
```

Retrieves purchase order items to use when creating a new GRN.

#### Response

```json
{
  "success": true,
  "data": {
    "purchase_order": {
      "id": "456",
      "po_number": "PO-001",
      "supplier_id": "789",
      "supplier_name": "Supplier A",
      "status": "ORDERED",
      "received_status": "NOT_RECEIVED",
      "order_date": "2023-05-01T09:00:00.000Z"
    },
    "items": [
      {
        "id": "poi_1",
        "product_id": "prod_1",
        "product_name": "Product A",
        "product_sku": "SKU-001",
        "quantity": 20,
        "received_quantity": 0,
        "remaining_quantity": 20,
        "unit_cost": 29.99
      },
      {
        "id": "poi_2",
        "product_id": "prod_2",
        "product_name": "Product B",
        "product_sku": "SKU-002",
        "quantity": 30,
        "received_quantity": 0,
        "remaining_quantity": 30,
        "unit_cost": 19.99
      }
      // Additional items...
    ]
  }
}
```

#### Notes
- This endpoint calculates remaining quantities to receive based on previous GRNs
- Only purchase orders in "ORDERED" status with unreceived items are valid for GRN creation
- Tenant isolation is enforced through proper JOIN conditions

## Error Responses

### Not Found

```json
{
  "success": false,
  "error": {
    "message": "GRN not found",
    "code": "NOT_FOUND"
  }
}
```

### Invalid Status Change

```json
{
  "success": false,
  "error": {
    "message": "Cannot change status: GRN is already in COMPLETED status",
    "code": "INVALID_STATUS"
  }
}
```

### Purchase Order Not Valid

```json
{
  "success": false,
  "error": {
    "message": "Purchase order is not in a valid status for receiving goods",
    "code": "INVALID_PURCHASE_ORDER",
    "details": {
      "current_status": "CANCELLED"
    }
  }
}
```

### Validation Error

```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": {
      "items[0].received_quantity": "Received quantity cannot exceed expected quantity. Attempted to receive 25 items, but only 20 were ordered.",
      "date_received": "Date received cannot be in the future"
    }
  }
}
```

*(This error covers scenarios like attempting to receive more items than ordered on a purchase order line.)*

## Implementation Notes

### Database Transactions

All GRN operations that affect multiple tables use database transactions to ensure data integrity. The key operations include:

1. Creating a GRN with COMPLETED status
2. Updating a GRN status from DRAFT to COMPLETED
3. Updating a GRN status from COMPLETED to DRAFT (reversal)

### Inventory Updates

When a GRN is completed, the following inventory updates occur:

1. Product `current_stock_quantity` is increased by the received quantity
2. Product `last_received_date` is updated to the GRN date_received
3. Inventory transaction records are created for auditing

### Purchase Order Updates

When a GRN is completed, the following purchase order updates occur:

1. Purchase order `last_grn_date` is updated
2. Purchase order `status` is updated based on receipt status:
   - All items fully received: "COMPLETED"
   - Some items partially received: "PARTIALLY_RECEIVED"
   - No change if still items remaining

### Error Handling

Robust error handling is implemented for:

1. Missing products during inventory updates: If a product referenced in the GRN is not found (e.g., deleted after PO creation but before GRN completion), a warning is logged by the system, that specific product's inventory update is skipped, and the overall GRN operation (creation or status update) proceeds for other valid items within the transaction. This ensures that GRN processing is not entirely blocked by isolated data inconsistencies.
2. Database transaction failures
3. Validation errors on received quantities

### Important Code Patterns

1. Always properly destructure MySQL2 query results:
```javascript
// Correct pattern:
const [poItems] = await connection.query(
  `SELECT poi.* FROM purchase_order_items poi
   JOIN purchase_orders po ON poi.purchase_order_id = po.id
   WHERE po.id = ? AND po.tenant_id = ?`,
  [purchaseOrderId, tenant_id]
);
```

2. Respect user input for status fields:
```javascript
// Correct pattern:
const status = req.body.status || 'COMPLETED';
```

3. Properly handle multi-tenant filtering in JOINs:
```javascript
// Correct pattern for JOINs with tenant isolation:
const [poItems] = await connection.query(`
  SELECT poi.* 
  FROM purchase_order_items poi
  JOIN purchase_orders po ON poi.purchase_order_id = po.id
  WHERE po.id = ? AND po.tenant_id = ?
`, [purchaseOrderId, tenant_id]);
```

4. Gracefully handle missing products:
```javascript
// Check if product exists
const [productResult] = await connection.query(
  'SELECT id, current_stock_quantity FROM products WHERE id = ? AND tenant_id = ?',
  [item.product_id, tenant_id]
);

if (!productResult || productResult.length === 0) {
  // Log warning but continue processing other items
  console.warn(`Product not found during GRN processing: ${item.product_id}`);
  continue; // Skip this item but continue with others
}
```

5. Consistently use column names:
```javascript
// Always use current_stock_quantity, not stock_quantity
await connection.query(
  'UPDATE products SET current_stock_quantity = current_stock_quantity + ? WHERE id = ?',
  [quantity, productId]
);
```
