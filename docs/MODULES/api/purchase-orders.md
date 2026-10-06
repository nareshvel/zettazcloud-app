# Purchase Orders API

This document details the endpoints for managing Purchase Orders in the Zettaz Cloud Enterprise API.

## Overview

Purchase Orders (POs) are used to request products from suppliers and track the ordering process. The purchase order lifecycle typically includes creation, approval, ordering, receiving (via GRNs), and completion.

## Endpoints

### List Purchase Orders

```
GET /api/v1/purchase-orders
```

Retrieves a paginated list of purchase orders.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20, max: 100) |
| sort | string | Field to sort by (default: 'created_at') |
| order | string | Sort order ('asc' or 'desc', default: 'desc') |
| search | string | Search term for PO number or reference |
| status | string | Filter by status ('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CANCELLED') |
| supplier_id | string | Filter by supplier ID |
| start_date | date | Filter by date range start (ISO format) |
| end_date | date | Filter by date range end (ISO format) |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "123",
      "po_number": "PO-001",
      "supplier_id": "456",
      "supplier_name": "Supplier A",
      "status": "ORDERED",
      "received_status": "NOT_RECEIVED",
      "order_date": "2023-05-01T10:00:00.000Z",
      "expected_delivery_date": "2023-05-15T00:00:00.000Z",
      "last_grn_date": null,
      "total_amount": 2500.00,
      "notes": "Standard delivery terms",
      "created_by": "user_id_1",
      "created_by_name": "John Doe",
      "tenant_id": "tenant_123",
      "created_at": "2023-04-28T15:30:00.000Z",
      "updated_at": "2023-05-01T10:00:00.000Z",
      "item_count": 5,
      "received_items_count": 0
    },
    {
      "id": "124",
      "po_number": "PO-002",
      "supplier_id": "789",
      "supplier_name": "Supplier B",
      "status": "PARTIALLY_RECEIVED",
      "received_status": "PARTIALLY_RECEIVED",
      "order_date": "2023-04-15T11:00:00.000Z",
      "expected_delivery_date": "2023-04-30T00:00:00.000Z",
      "last_grn_date": "2023-05-02T14:00:00.000Z",
      "total_amount": 1800.00,
      "notes": "Priority shipment",
      "created_by": "user_id_1",
      "created_by_name": "John Doe",
      "tenant_id": "tenant_123",
      "created_at": "2023-04-14T09:45:00.000Z",
      "updated_at": "2023-05-02T14:00:00.000Z",
      "item_count": 3,
      "received_items_count": 2
    }
    // Additional purchase orders...
  ],
  "pagination": {
    "totalItems": 45,
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
- The response includes summary information such as item_count and received_items_count.
- Supplier information is included for convenience.
- The last_grn_date field indicates when the most recent goods were received.

### Get Purchase Order Details

```
GET /api/v1/purchase-orders/:id
```

Retrieves detailed information for a specific purchase order.

#### Response

```json
{
  "success": true,
  "data": {
    "id": "123",
    "po_number": "PO-001",
    "supplier_id": "456",
    "supplier_name": "Supplier A",
    "supplier_contact": "contact@suppliera.com",
    "status": "ORDERED",
    "received_status": "NOT_RECEIVED",
    "order_date": "2023-05-01T10:00:00.000Z",
    "expected_delivery_date": "2023-05-15T00:00:00.000Z",
    "last_grn_date": null,
    "shipping_address": "123 Warehouse St, Business Park",
    "billing_address": "456 Office Blvd, Corporate Center",
    "payment_terms": "Net 30",
    "total_amount": 2500.00,
    "tax_rate": 7.5,
    "tax_amount": 187.50,
    "shipping_cost": 50.00,
    "discount_amount": 100.00,
    "notes": "Standard delivery terms",
    "created_by": "user_id_1",
    "created_by_name": "John Doe",
    "tenant_id": "tenant_123",
    "created_at": "2023-04-28T15:30:00.000Z",
    "updated_at": "2023-05-01T10:00:00.000Z",
    "items": [
      {
        "id": "item_1",
        "product_id": "prod_1",
        "product_name": "Product A",
        "product_sku": "SKU-001",
        "quantity": 20,
        "received_quantity": 0,
        "remaining_quantity": 20,
        "unit_cost": 50.00,
        "line_total": 1000.00,
        "item_received_status": "NOT_RECEIVED",
        "notes": "Standard quality requirements"
      },
      {
        "id": "item_2",
        "product_id": "prod_2",
        "product_name": "Product B",
        "product_sku": "SKU-002",
        "quantity": 30,
        "received_quantity": 0,
        "remaining_quantity": 30,
        "unit_cost": 50.00,
        "line_total": 1500.00,
        "item_received_status": "NOT_RECEIVED",
        "notes": "Fragile items, handle with care"
      }
      // Additional items...
    ],
    "related_grns": [
      // Empty array if no GRNs created yet
    ],
    "status_history": [
      {
        "status": "DRAFT",
        "timestamp": "2023-04-28T15:30:00.000Z",
        "user_id": "user_id_1",
        "user_name": "John Doe",
        "notes": "Initial purchase order created"
      },
      {
        "status": "ORDERED",
        "timestamp": "2023-05-01T10:00:00.000Z",
        "user_id": "user_id_1",
        "user_name": "John Doe",
        "notes": "Approved and sent to supplier"
      }
    ]
  }
}
```

#### Notes
- The detailed view includes all purchase order items with product information.
- Related GRNs are included to show the receiving history.
- Status history provides an audit trail of status changes.
- Tenant isolation is enforced - users can only access purchase orders within their tenant.

### Create Purchase Order

```
POST /api/v1/purchase-orders
```

Creates a new purchase order.

#### Request Body

```json
{
  "supplier_id": "456",
  "expected_delivery_date": "2023-06-15T00:00:00.000Z",
  "shipping_address": "123 Warehouse St, Business Park",
  "billing_address": "456 Office Blvd, Corporate Center",
  "payment_terms": "Net 30",
  "tax_rate": 7.5,
  "shipping_cost": 50.00,
  "discount_amount": 100.00,
  "notes": "Priority order for seasonal stock",
  "status": "DRAFT",
  "items": [
    {
      "product_id": "prod_1",
      "quantity": 25,
      "unit_cost": 48.00,
      "notes": "Bulk pricing applied"
    },
    {
      "product_id": "prod_3",
      "quantity": 10,
      "unit_cost": 75.00,
      "notes": "New inventory item"
    }
    // Additional items...
  ]
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "125",
    "po_number": "PO-003",
    "supplier_id": "456",
    "supplier_name": "Supplier A",
    "status": "DRAFT",
    "received_status": "NOT_RECEIVED",
    "expected_delivery_date": "2023-06-15T00:00:00.000Z",
    "shipping_address": "123 Warehouse St, Business Park",
    "billing_address": "456 Office Blvd, Corporate Center",
    "payment_terms": "Net 30",
    "total_amount": 1950.00,
    "tax_rate": 7.5,
    "tax_amount": 146.25,
    "shipping_cost": 50.00,
    "discount_amount": 100.00,
    "notes": "Priority order for seasonal stock",
    "created_by": "user_id_1",
    "created_by_name": "John Doe",
    "tenant_id": "tenant_123",
    "created_at": "2023-06-01T11:00:00.000Z",
    "updated_at": "2023-06-01T11:00:00.000Z",
    "items": [
      {
        "id": "item_5",
        "product_id": "prod_1",
        "product_name": "Product A",
        "product_sku": "SKU-001",
        "quantity": 25,
        "received_quantity": 0,
        "unit_cost": 48.00,
        "line_total": 1200.00,
        "item_received_status": "NOT_RECEIVED",
        "notes": "Bulk pricing applied"
      },
      {
        "id": "item_6",
        "product_id": "prod_3",
        "product_name": "Product C",
        "product_sku": "SKU-003",
        "quantity": 10,
        "received_quantity": 0,
        "unit_cost": 75.00,
        "line_total": 750.00,
        "item_received_status": "NOT_RECEIVED",
        "notes": "New inventory item"
      }
    ]
  }
}
```

#### Notes
- The status can be "DRAFT" (default) or "ORDERED"
- PO number is automatically generated
- Line totals and the overall total amount are calculated automatically
- Tax amount is calculated based on the tax rate and subtotal
- All purchase order items are created with item_received_status set to "NOT_RECEIVED"

### Update Purchase Order

```
PUT /api/v1/purchase-orders/:id
```

Updates an existing purchase order. This is primarily used to edit draft purchase orders.

#### Request Body

```json
{
  "expected_delivery_date": "2023-06-20T00:00:00.000Z",
  "notes": "Updated delivery timeframe",
  "shipping_cost": 75.00,
  "items": [
    {
      "id": "item_5",
      "quantity": 30,
      "unit_cost": 45.00,
      "notes": "Increased quantity with better pricing"
    },
    {
      "product_id": "prod_4",
      "quantity": 5,
      "unit_cost": 120.00,
      "notes": "New item added to order"
    }
  ]
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "125",
    "po_number": "PO-003",
    "status": "DRAFT",
    "expected_delivery_date": "2023-06-20T00:00:00.000Z",
    "shipping_cost": 75.00,
    "notes": "Updated delivery timeframe",
    "total_amount": 2475.00,
    "updated_at": "2023-06-01T14:00:00.000Z",
    "items": [
      {
        "id": "item_5",
        "product_id": "prod_1",
        "product_name": "Product A",
        "quantity": 30,
        "unit_cost": 45.00,
        "line_total": 1350.00,
        "notes": "Increased quantity with better pricing"
      },
      {
        "id": "item_6",
        "product_id": "prod_3",
        "product_name": "Product C",
        "quantity": 10,
        "unit_cost": 75.00,
        "line_total": 750.00,
        "notes": "New inventory item"
      },
      {
        "id": "item_7",
        "product_id": "prod_4",
        "product_name": "Product D",
        "quantity": 5,
        "unit_cost": 120.00,
        "line_total": 600.00,
        "notes": "New item added to order"
      }
    ]
  }
}
```

#### Notes
- Only purchase orders in "DRAFT" status can be fully edited
- For purchase orders in "ORDERED" status, only notes and expected_delivery_date can be updated
- Items can be added, removed, or modified only for draft purchase orders
- Total amount and line totals are recalculated automatically

### Update Purchase Order Status

```
PUT /api/v1/purchase-orders/:id/status
```

Updates the status of a purchase order.

#### Request Body

```json
{
  "status": "ORDERED",
  "notes": "Approved by manager and sent to supplier via email"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "125",
    "po_number": "PO-003",
    "previous_status": "DRAFT",
    "new_status": "ORDERED",
    "order_date": "2023-06-01T15:00:00.000Z",
    "updated_at": "2023-06-01T15:00:00.000Z",
    "status_change_notes": "Approved by manager and sent to supplier via email"
  }
}
```

#### Notes
- Valid status transitions include:
  - DRAFT → ORDERED: Sets order_date to current date
  - DRAFT → CANCELLED: Cancels the purchase order
  - ORDERED → CANCELLED: Cancels the purchase order if no items received
  - ORDERED → COMPLETED: Manual completion (though typically done via GRN)
  - PARTIALLY_RECEIVED → COMPLETED: Manual completion (though typically done via GRN)
- The received_status is not directly modifiable through this endpoint; it's updated by the GRN process
- Status changes are recorded in the status_history table

### Cancel Purchase Order

```
PUT /api/v1/purchase-orders/:id/cancel
```

Cancels a purchase order.

#### Request Body

```json
{
  "notes": "Supplier unable to fulfill order"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "125",
    "po_number": "PO-003",
    "previous_status": "ORDERED",
    "new_status": "CANCELLED",
    "updated_at": "2023-06-02T09:00:00.000Z",
    "cancellation_notes": "Supplier unable to fulfill order"
  }
}
```

#### Notes
- Only purchase orders in "DRAFT" or "ORDERED" status can be cancelled
- Purchase orders with received items (PARTIALLY_RECEIVED) cannot be cancelled
- Cancellation is tracked in the status_history table

### Delete Purchase Order

```
DELETE /api/v1/purchase-orders/:id
```

Deletes a draft purchase order.

#### Response

```json
{
  "success": true,
  "data": {
    "message": "Purchase order deleted successfully"
  }
}
```

#### Notes
- Only purchase orders in "DRAFT" status can be deleted
- Purchase orders in other statuses must be cancelled instead

### Get Purchase Order by Number

```
GET /api/v1/purchase-orders/number/:po_number
```

Retrieves a purchase order by its PO number.

#### Response

Same as the Get Purchase Order Details endpoint.

#### Notes
- This is a convenience endpoint for searching by PO number
- Only returns purchase orders within the user's tenant

## Error Responses

### Not Found

```json
{
  "success": false,
  "error": {
    "message": "Purchase order not found",
    "code": "NOT_FOUND"
  }
}
```

### Invalid Status Change

```json
{
  "success": false,
  "error": {
    "message": "Cannot change status from PARTIALLY_RECEIVED to CANCELLED",
    "code": "INVALID_STATUS_TRANSITION"
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
      "supplier_id": "Supplier is required",
      "items": "At least one item is required",
      "items[0].quantity": "Quantity must be greater than 0"
    }
  }
}
```

### Status Conflict

```json
{
  "success": false,
  "error": {
    "message": "Cannot modify items for purchase order in ORDERED status",
    "code": "STATUS_CONFLICT"
  }
}
```

## Implementation Notes

### Purchase Order Status Flow

The purchase order status typically follows this flow:

1. DRAFT: Initial creation state, fully editable
2. ORDERED: Sent to supplier, limited edits allowed
3. PARTIALLY_RECEIVED: Some items received via GRNs
4. COMPLETED: All items received
5. CANCELLED: Order cancelled (only from DRAFT or ORDERED states)

### Received Status

The received_status field tracks the receipt status independently:

- NOT_RECEIVED: No items received
- PARTIALLY_RECEIVED: Some items received
- FULLY_RECEIVED: All items received

This allows distinguishing between a purchase order that is COMPLETED because all expected items were received versus one manually marked as COMPLETED despite not receiving all items.

### Item Received Status

Each purchase order item has its own item_received_status:

- NOT_RECEIVED: No units received
- PARTIALLY_RECEIVED: Some units received
- FULLY_RECEIVED: All units received

This allows tracking receipt status at the line item level.

### Database Schema

Key tables and relationships:

1. purchase_orders: Main table for PO header information
2. purchase_order_items: Line items for each purchase order
3. status_history: Audit trail of status changes

### Multi-tenancy Considerations

All queries include tenant filtering to ensure data isolation:

```javascript
// For direct queries on purchase_orders
const [purchaseOrders] = await connection.query(
  'SELECT * FROM purchase_orders WHERE tenant_id = ?',
  [tenant_id]
);

// For joined queries with purchase_order_items
const [poItems] = await connection.query(`
  SELECT poi.* 
  FROM purchase_order_items poi
  JOIN purchase_orders po ON poi.purchase_order_id = po.id
  WHERE po.id = ? AND po.tenant_id = ?
`, [purchaseOrderId, tenant_id]);
```

### GRN Integration

When a GRN is processed, the following purchase order updates occur:

1. Purchase order's `last_grn_date` is updated
2. Received quantities are updated for affected items
3. Item received status is updated based on quantities
4. Purchase order received_status is recalculated
5. If all items are fully received, status may change to COMPLETED

### Purchase Order Number Generation

PO numbers are automatically generated using a configurable pattern:

- Default format: "PO-{SEQUENCE}"
- Sequence is padded to ensure consistent length (e.g., "PO-00001")
- Sequences can be tenant-specific or global, depending on configuration
