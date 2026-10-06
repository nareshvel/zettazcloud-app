# Inventory Management API

This document details the endpoints for managing inventory in the Zettaz Cloud Enterprise API.

## Overview

The Inventory Management API provides endpoints for tracking stock levels, performing inventory adjustments, managing stock transfers between locations, and viewing inventory transaction history.

## Endpoints

### Get Current Inventory

```
GET /api/v1/inventory
```

Retrieves a paginated list of current inventory levels for all products.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20, max: 100) |
| sort | string | Field to sort by (default: 'product_name') |
| order | string | Sort order ('asc' or 'desc', default: 'asc') |
| search | string | Search term for product name or SKU |
| category_id | string | Filter by category ID |
| location_id | string | Filter by location ID |
| low_stock | boolean | Filter items below reorder level |
| out_of_stock | boolean | Filter items with zero stock |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "product_id": "123",
      "product_name": "Product A",
      "product_sku": "SKU-001",
      "category_id": "456",
      "category_name": "Electronics",
      "current_stock_quantity": 85,
      "reorder_level": 20,
      "available_quantity": 80,
      "committed_quantity": 5,
      "location_id": "loc_1",
      "location_name": "Main Warehouse",
      "last_received_date": "2023-05-15T10:30:00.000Z",
      "last_count_date": "2023-05-20T09:00:00.000Z",
      "stock_status": "NORMAL",
      "unit_cost": 29.99,
      "inventory_value": 2549.15
    },
    {
      "product_id": "124",
      "product_name": "Product B",
      "product_sku": "SKU-002",
      "category_id": "457",
      "category_name": "Furniture",
      "current_stock_quantity": 15,
      "reorder_level": 25,
      "available_quantity": 10,
      "committed_quantity": 5,
      "location_id": "loc_1",
      "location_name": "Main Warehouse",
      "last_received_date": "2023-04-10T14:45:00.000Z",
      "last_count_date": "2023-05-20T09:00:00.000Z",
      "stock_status": "LOW_STOCK",
      "unit_cost": 149.99,
      "inventory_value": 2249.85
    }
    // Additional inventory items...
  ],
  "pagination": {
    "totalItems": 150,
    "totalPages": 8,
    "currentPage": 1,
    "pageSize": 20,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

#### Notes
- Results are automatically filtered by the tenant_id of the authenticated user
- stock_status values: "OUT_OF_STOCK", "LOW_STOCK", "NORMAL", "EXCESS"
- available_quantity = current_stock_quantity - committed_quantity
- committed_quantity represents stock allocated to sales orders but not yet delivered

### Get Product Inventory

```
GET /api/v1/inventory/product/:id
```

Retrieves detailed inventory information for a specific product.

#### Response

```json
{
  "success": true,
  "data": {
    "product_id": "123",
    "product_name": "Product A",
    "product_sku": "SKU-001",
    "category_id": "456",
    "category_name": "Electronics",
    "barcode": "9876543210123",
    "current_stock_quantity": 85,
    "reorder_level": 20,
    "available_quantity": 80,
    "committed_quantity": 5,
    "last_received_date": "2023-05-15T10:30:00.000Z",
    "last_count_date": "2023-05-20T09:00:00.000Z",
    "stock_status": "NORMAL",
    "unit_cost": 29.99,
    "inventory_value": 2549.15,
    "locations": [
      {
        "location_id": "loc_1",
        "location_name": "Main Warehouse",
        "quantity": 65,
        "bin_location": "A-12-3"
      },
      {
        "location_id": "loc_2",
        "location_name": "Store Front",
        "quantity": 20,
        "bin_location": "Display-5"
      }
    ],
    "recent_transactions": [
      {
        "transaction_id": "tr_1",
        "date": "2023-05-15T10:30:00.000Z",
        "type": "RECEIVE",
        "reference_type": "GRN",
        "reference_id": "GRN-001",
        "quantity_change": 50,
        "previous_quantity": 35,
        "new_quantity": 85,
        "notes": "Received from Supplier A"
      },
      {
        "transaction_id": "tr_2",
        "date": "2023-05-10T14:15:00.000Z",
        "type": "SALE",
        "reference_type": "INVOICE",
        "reference_id": "INV-123",
        "quantity_change": -5,
        "previous_quantity": 40,
        "new_quantity": 35,
        "notes": "Sale to Customer B"
      }
      // Additional transactions...
    ],
    "purchase_order_items": [
      {
        "purchase_order_id": "po_1",
        "purchase_order_number": "PO-123",
        "status": "ORDERED",
        "expected_delivery_date": "2023-06-15T00:00:00.000Z",
        "quantity_ordered": 25,
        "quantity_received": 0,
        "unit_cost": 28.99
      }
      // Additional purchase order items...
    ]
  }
}
```

#### Notes
- The response includes location-specific inventory
- Recent transactions show the last 10 inventory movements
- Purchase order items show pending incoming inventory
- All queries enforce tenant isolation

### Adjust Inventory

```
POST /api/v1/inventory/adjust
```

Creates an inventory adjustment to correct stock levels.

#### Request Body

```json
{
  "product_id": "123",
  "location_id": "loc_1",
  "adjustment_quantity": 5,
  "reason": "STOCK_COUNT",
  "notes": "Physical count found 5 additional units",
  "reference_document": "Count Sheet #45"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "adjustment_id": "adj_1",
    "product_id": "123",
    "product_name": "Product A",
    "product_sku": "SKU-001",
    "location_id": "loc_1",
    "location_name": "Main Warehouse",
    "previous_quantity": 65,
    "new_quantity": 70,
    "adjustment_quantity": 5,
    "reason": "STOCK_COUNT",
    "notes": "Physical count found 5 additional units",
    "reference_document": "Count Sheet #45",
    "created_by": "user_id_1",
    "created_by_name": "John Doe",
    "created_at": "2023-06-01T10:15:00.000Z",
    "transaction_id": "tr_10"
  }
}
```

#### Notes
- Adjustment reasons include: "STOCK_COUNT", "DAMAGE", "THEFT", "EXPIRY", "RETURN", "OTHER"
- Use positive quantities to increase stock, negative to decrease
- All adjustments create a corresponding inventory transaction record
- Location-specific inventory is updated
- The total current_stock_quantity of the product is also updated

### Transfer Inventory

```
POST /api/v1/inventory/transfer
```

Creates a stock transfer between locations.

#### Request Body

```json
{
  "source_location_id": "loc_1",
  "destination_location_id": "loc_2",
  "reference_number": "TRF-001",
  "notes": "Weekly store replenishment",
  "items": [
    {
      "product_id": "123",
      "quantity": 10,
      "notes": "Send newest stock"
    },
    {
      "product_id": "124",
      "quantity": 5,
      "notes": "Display units"
    }
  ]
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "transfer_id": "trf_1",
    "reference_number": "TRF-001",
    "source_location_id": "loc_1",
    "source_location_name": "Main Warehouse",
    "destination_location_id": "loc_2",
    "destination_location_name": "Store Front",
    "status": "COMPLETED",
    "notes": "Weekly store replenishment",
    "created_by": "user_id_1",
    "created_by_name": "John Doe",
    "created_at": "2023-06-01T11:30:00.000Z",
    "items": [
      {
        "product_id": "123",
        "product_name": "Product A",
        "product_sku": "SKU-001",
        "quantity": 10,
        "notes": "Send newest stock",
        "source_previous_quantity": 70,
        "source_new_quantity": 60,
        "destination_previous_quantity": 15,
        "destination_new_quantity": 25,
        "transaction_id": "tr_11"
      },
      {
        "product_id": "124",
        "product_name": "Product B",
        "product_sku": "SKU-002",
        "quantity": 5,
        "notes": "Display units",
        "source_previous_quantity": 10,
        "source_new_quantity": 5,
        "destination_previous_quantity": 5,
        "destination_new_quantity": 10,
        "transaction_id": "tr_12"
      }
    ]
  }
}
```

#### Notes
- All transfers create corresponding inventory transaction records
- Location-specific inventory is updated
- The total current_stock_quantity of the product remains unchanged as this is just a movement between locations
- Validation ensures source location has sufficient stock

### Get Inventory Transactions

```
GET /api/v1/inventory/transactions
```

Retrieves a paginated list of inventory transactions.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20, max: 100) |
| sort | string | Field to sort by (default: 'date') |
| order | string | Sort order ('asc' or 'desc', default: 'desc') |
| product_id | string | Filter by product ID |
| location_id | string | Filter by location ID |
| transaction_type | string | Filter by transaction type |
| reference_type | string | Filter by reference type |
| start_date | date | Filter by date range start (ISO format) |
| end_date | date | Filter by date range end (ISO format) |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "transaction_id": "tr_1",
      "date": "2023-05-15T10:30:00.000Z",
      "product_id": "123",
      "product_name": "Product A",
      "product_sku": "SKU-001",
      "location_id": "loc_1",
      "location_name": "Main Warehouse",
      "type": "RECEIVE",
      "reference_type": "GRN",
      "reference_id": "GRN-001",
      "quantity_change": 50,
      "previous_quantity": 35,
      "new_quantity": 85,
      "notes": "Received from Supplier A",
      "created_by": "user_id_1",
      "created_by_name": "John Doe"
    },
    {
      "transaction_id": "tr_2",
      "date": "2023-05-10T14:15:00.000Z",
      "product_id": "123",
      "product_name": "Product A",
      "product_sku": "SKU-001",
      "location_id": "loc_1",
      "location_name": "Main Warehouse",
      "type": "SALE",
      "reference_type": "INVOICE",
      "reference_id": "INV-123",
      "quantity_change": -5,
      "previous_quantity": 40,
      "new_quantity": 35,
      "notes": "Sale to Customer B",
      "created_by": "user_id_2",
      "created_by_name": "Jane Smith"
    }
    // Additional transactions...
  ],
  "pagination": {
    "totalItems": 250,
    "totalPages": 13,
    "currentPage": 1,
    "pageSize": 20,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

#### Notes
- Transaction types include: "RECEIVE", "SALE", "ADJUSTMENT", "TRANSFER_IN", "TRANSFER_OUT", "RETURN", "COMMITMENT", "COMMITMENT_REVERSAL"
- Reference types include: "GRN", "INVOICE", "ADJUSTMENT", "TRANSFER", "RETURN", "SALES_ORDER"
- Results are automatically filtered by the tenant_id of the authenticated user

### Inventory Count

```
POST /api/v1/inventory/count
```

Initiates or completes an inventory count process.

#### Request Body (Start Count)

```json
{
  "count_type": "FULL",
  "location_id": "loc_1",
  "scheduled_date": "2023-06-05T00:00:00.000Z",
  "notes": "Monthly full inventory count",
  "products": [
    "123",
    "124",
    "125"
    // Additional product IDs or empty for all products
  ]
}
```

#### Request Body (Submit Count)

```json
{
  "count_id": "count_1",
  "count_items": [
    {
      "product_id": "123",
      "counted_quantity": 68,
      "notes": "Found 2 damaged units, removed from count"
    },
    {
      "product_id": "124",
      "counted_quantity": 12,
      "notes": "All units in good condition"
    },
    {
      "product_id": "125",
      "counted_quantity": 54,
      "notes": "Count verified twice"
    }
  ],
  "completion_notes": "Count completed by night shift team"
}
```

#### Response (Start Count)

```json
{
  "success": true,
  "data": {
    "count_id": "count_1",
    "count_number": "CNT-2023-06-01",
    "count_type": "FULL",
    "location_id": "loc_1",
    "location_name": "Main Warehouse",
    "status": "PENDING",
    "scheduled_date": "2023-06-05T00:00:00.000Z",
    "notes": "Monthly full inventory count",
    "created_by": "user_id_1",
    "created_by_name": "John Doe",
    "created_at": "2023-06-01T13:00:00.000Z",
    "product_count": 3,
    "products": [
      {
        "product_id": "123",
        "product_name": "Product A",
        "product_sku": "SKU-001",
        "current_quantity": 60,
        "counted_quantity": null,
        "variance": null
      },
      {
        "product_id": "124",
        "product_name": "Product B",
        "product_sku": "SKU-002",
        "current_quantity": 5,
        "counted_quantity": null,
        "variance": null
      },
      {
        "product_id": "125",
        "product_name": "Product C",
        "product_sku": "SKU-003",
        "current_quantity": 50,
        "counted_quantity": null,
        "variance": null
      }
    ]
  }
}
```

#### Response (Submit Count)

```json
{
  "success": true,
  "data": {
    "count_id": "count_1",
    "count_number": "CNT-2023-06-01",
    "count_type": "FULL",
    "location_id": "loc_1",
    "location_name": "Main Warehouse",
    "status": "COMPLETED",
    "scheduled_date": "2023-06-05T00:00:00.000Z",
    "completion_date": "2023-06-05T14:30:00.000Z",
    "notes": "Monthly full inventory count",
    "completion_notes": "Count completed by night shift team",
    "completed_by": "user_id_1",
    "completed_by_name": "John Doe",
    "product_count": 3,
    "products": [
      {
        "product_id": "123",
        "product_name": "Product A",
        "product_sku": "SKU-001",
        "current_quantity": 60,
        "counted_quantity": 68,
        "variance": 8,
        "variance_percentage": 13.33,
        "adjustment_id": "adj_2",
        "notes": "Found 2 damaged units, removed from count"
      },
      {
        "product_id": "124",
        "product_name": "Product B",
        "product_sku": "SKU-002",
        "current_quantity": 5,
        "counted_quantity": 12,
        "variance": 7,
        "variance_percentage": 140.00,
        "adjustment_id": "adj_3",
        "notes": "All units in good condition"
      },
      {
        "product_id": "125",
        "product_name": "Product C",
        "product_sku": "SKU-003",
        "current_quantity": 50,
        "counted_quantity": 54,
        "variance": 4,
        "variance_percentage": 8.00,
        "adjustment_id": "adj_4",
        "notes": "Count verified twice"
      }
    ],
    "adjustments_created": true,
    "total_variance_value": 447.98
  }
}
```

#### Notes
- Count types include: "FULL", "CYCLE", "SPOT"
- Inventory counts go through these statuses: "PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"
- When a count is submitted, inventory adjustments are automatically created for variances
- Each adjustment references the count as its source
- Product last_count_date is updated upon completion

### Export Inventory

```
GET /api/v1/inventory/export
```

Exports current inventory data to CSV or Excel format.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| format | string | Export format ('csv' or 'xlsx', default: 'csv') |
| category_id | string | Filter by category ID |
| location_id | string | Filter by location ID |
| include_zero_stock | boolean | Include items with zero stock (default: true) |

#### Response

Binary file download with appropriate content-type and content-disposition headers.

#### Notes
- The export includes current stock levels, costs, and locations
- Large exports are generated asynchronously and a download link is provided

## Error Responses

### Insufficient Stock

```json
{
  "success": false,
  "error": {
    "message": "Insufficient stock for transfer",
    "code": "INSUFFICIENT_STOCK",
    "details": {
      "product_id": "124",
      "product_name": "Product B",
      "requested_quantity": 10,
      "available_quantity": 5
    }
  }
}
```

### Product Not Found

```json
{
  "success": false,
  "error": {
    "message": "Product not found",
    "code": "NOT_FOUND",
    "details": {
      "product_id": "999"
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
      "adjustment_quantity": "Adjustment quantity cannot be zero",
      "reason": "Reason is required for inventory adjustments"
    }
  }
}
```

### Location Error

```json
{
  "success": false,
  "error": {
    "message": "Source and destination locations cannot be the same",
    "code": "INVALID_LOCATION"
  }
}
```

## Implementation Notes

### Database Schema

Key tables and relationships:

1. products: Contains the current_stock_quantity column
2. inventory_locations: Stores location information
3. inventory_location_stock: Tracks stock by location
4. inventory_transactions: Records all stock movements
5. inventory_adjustments: Documents manual adjustments
6. inventory_transfers: Tracks stock transfers between locations
7. inventory_counts: Manages physical counting processes

### Multi-tenancy Considerations

All inventory queries enforce tenant isolation:

```javascript
// Direct product query
const [products] = await connection.query(
  'SELECT * FROM products WHERE tenant_id = ?',
  [tenant_id]
);

// Joined queries for inventory transactions
const [transactions] = await connection.query(`
  SELECT t.*, p.name as product_name, p.sku as product_sku 
  FROM inventory_transactions t
  JOIN products p ON t.product_id = p.id
  WHERE p.tenant_id = ?
`, [tenant_id]);
```

### Inventory Transaction Types

Every stock movement is recorded with a specific transaction type:

1. RECEIVE: Stock received from suppliers (GRN)
2. SALE: Stock sold to customers
3. ADJUSTMENT: Manual stock adjustments
4. TRANSFER_IN: Stock received from another location
5. TRANSFER_OUT: Stock sent to another location
6. RETURN: Customer returns
7. COMMITMENT: Stock reserved for orders
8. COMMITMENT_REVERSAL: Released commitments

### Stock Quantity Columns

The system uses these quantity columns consistently:

1. current_stock_quantity: Total physical stock quantity
2. committed_quantity: Stock allocated but not yet shipped
3. available_quantity: current_stock_quantity - committed_quantity

### GRN Integration

When processing GRNs, the inventory system:

1. Updates product current_stock_quantity
2. Creates RECEIVE type inventory transactions
3. Updates location-specific inventory
4. Updates product last_received_date

### Robust Error Handling

For inventory operations, robust error handling patterns include:

1. Checking for product existence before operations
2. Validating sufficient stock before decrements
3. Using database transactions for multi-step operations
4. Handling missing products gracefully

Example of robust product handling:

```javascript
// Check if product exists
const [productResult] = await connection.query(
  'SELECT id, current_stock_quantity FROM products WHERE id = ? AND tenant_id = ?',
  [productId, tenant_id]
);

if (!productResult || productResult.length === 0) {
  console.warn(`Product not found during inventory operation: ${productId}`);
  continue; // Skip this item but continue with others
}

// Process inventory changes
const product = productResult[0];
const newQuantity = product.current_stock_quantity + quantityChange;

// Update inventory with consistent column name
await connection.query(
  'UPDATE products SET current_stock_quantity = ? WHERE id = ?',
  [newQuantity, productId]
);
```

### Inventory Count Process

The inventory counting process follows these steps:

1. Create count record with products to count
2. Record system quantities at count creation time
3. Perform physical count and record actual quantities
4. Calculate variances
5. Create adjustment records for variances
6. Update product last_count_date
