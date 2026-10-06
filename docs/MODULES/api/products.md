# Products API

This document details the endpoints for managing products in the Zettaz Cloud Enterprise API.

## Endpoints

### List Products

```
GET /api/v1/products
```

Retrieves a paginated list of products.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20, max: 100) |
| sort | string | Field to sort by (default: 'name') |
| order | string | Sort order ('asc' or 'desc', default: 'asc') |
| search | string | Search term for product name or SKU |
| category | string | Filter by category ID |
| active | boolean | Filter by active status |
| min_stock | number | Filter by minimum stock level |
| max_stock | number | Filter by maximum stock level |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "123",
      "name": "Product A",
      "sku": "PA-12345",
      "description": "Product description goes here",
      "category_id": "456",
      "category_name": "Electronics",
      "price": 49.99,
      "cost_price": 29.99,
      "current_stock_quantity": 100,
      "reorder_level": 20,
      "barcode": "9876543210123",
      "is_active": true,
      "is_sellable": true,
      "last_received_date": "2023-05-15T10:30:00.000Z",
      "tenant_id": "789",
      "created_at": "2023-01-10T09:00:00.000Z",
      "updated_at": "2023-05-15T10:30:00.000Z"
    },
    // Additional products...
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
- Results are automatically filtered by the tenant_id of the authenticated user.
- The response includes category_name for convenience even though it's a joined field.

### Get Product

```
GET /api/v1/products/:id
```

Retrieves a single product by ID.

#### Response

```json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "Product A",
    "sku": "PA-12345",
    "description": "Product description goes here",
    "category_id": "456",
    "category_name": "Electronics",
    "price": 49.99,
    "cost_price": 29.99,
    "current_stock_quantity": 100,
    "reorder_level": 20,
    "barcode": "9876543210123",
    "is_active": true,
    "is_sellable": true,
    "last_received_date": "2023-05-15T10:30:00.000Z",
    "tenant_id": "789",
    "created_at": "2023-01-10T09:00:00.000Z",
    "updated_at": "2023-05-15T10:30:00.000Z",
    "inventory_history": [
      {
        "date": "2023-05-15T10:30:00.000Z",
        "quantity_change": 50,
        "reference_type": "GRN",
        "reference_id": "GRN-001"
      },
      // Additional history entries...
    ]
  }
}
```

#### Notes
- The detailed view includes recent inventory history.
- Tenant isolation is enforced - users can only access products within their tenant.

### Create Product

```
POST /api/v1/products
```

Creates a new product.

#### Request Body

```json
{
  "name": "New Product",
  "sku": "NP-67890",
  "description": "Description of new product",
  "category_id": "456",
  "price": 59.99,
  "cost_price": 35.99,
  "current_stock_quantity": 50,
  "reorder_level": 10,
  "barcode": "9876543210456",
  "is_active": true,
  "is_sellable": true
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "124",
    "name": "New Product",
    "sku": "NP-67890",
    "description": "Description of new product",
    "category_id": "456",
    "price": 59.99,
    "cost_price": 35.99,
    "current_stock_quantity": 50,
    "reorder_level": 10,
    "barcode": "9876543210456",
    "is_active": true,
    "is_sellable": true,
    "tenant_id": "789",
    "created_at": "2023-06-01T14:00:00.000Z",
    "updated_at": "2023-06-01T14:00:00.000Z"
  }
}
```

#### Notes
- SKU must be unique within the tenant.
- The tenant_id is automatically set based on the authenticated user.
- Initial stock quantity creates an inventory transaction record.

### Update Product

```
PUT /api/v1/products/:id
```

Updates an existing product.

#### Request Body

```json
{
  "name": "Updated Product Name",
  "description": "Updated description",
  "price": 54.99,
  "is_active": true
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "Updated Product Name",
    "sku": "PA-12345",
    "description": "Updated description",
    "category_id": "456",
    "price": 54.99,
    "cost_price": 29.99,
    "current_stock_quantity": 100,
    "reorder_level": 20,
    "barcode": "9876543210123",
    "is_active": true,
    "is_sellable": true,
    "tenant_id": "789",
    "created_at": "2023-01-10T09:00:00.000Z",
    "updated_at": "2023-06-01T15:00:00.000Z"
  }
}
```

#### Notes
- Partial updates are supported - only include the fields you want to change.
- SKU cannot be changed if the product has been referenced in transactions.
- Stock quantity cannot be directly modified through this endpoint - use inventory adjustments instead.

### Delete Product

```
DELETE /api/v1/products/:id
```

Deletes a product.

#### Response

```json
{
  "success": true,
  "data": {
    "message": "Product deleted successfully"
  }
}
```

#### Notes
- Products with transaction history cannot be deleted, only deactivated (set is_active to false).
- This is a soft delete that marks the product as deleted but preserves the record.

### Adjust Inventory

```
POST /api/v1/products/:id/adjust-inventory
```

Adjusts the inventory quantity for a product.

#### Request Body

```json
{
  "adjustment_quantity": 10,
  "reason": "Stock count adjustment",
  "notes": "Physical count revealed extra items"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "Product A",
    "previous_quantity": 100,
    "current_quantity": 110,
    "adjustment_quantity": 10,
    "adjustment_id": "ADJ-001",
    "updated_at": "2023-06-01T16:00:00.000Z"
  }
}
```

#### Notes
- Use positive values to increase inventory, negative to decrease.
- Each adjustment creates an audit record.
- The reason field is required for tracking purposes.

### Batch Import Products

```
POST /api/v1/products/import
```

Imports multiple products from a CSV or JSON file.

#### Request Body (multipart/form-data)

```
file: [CSV or JSON file]
update_existing: true
```

#### Response

```json
{
  "success": true,
  "data": {
    "total_processed": 100,
    "created": 80,
    "updated": 15,
    "failed": 5,
    "errors": [
      {
        "row": 10,
        "sku": "INVALID-SKU",
        "error": "Duplicate SKU"
      },
      // Additional errors...
    ]
  }
}
```

#### Notes
- The file must follow the template format available for download.
- Set update_existing to true to update products with matching SKUs.
- Large imports are processed asynchronously with a status endpoint.

### Export Products

```
GET /api/v1/products/export
```

Exports products to CSV or Excel format.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| format | string | Export format ('csv' or 'xlsx', default: 'csv') |
| category | string | Filter by category ID |
| active | boolean | Filter by active status |

#### Response

Binary file download with appropriate content-type and content-disposition headers.

#### Notes
- The export includes all fields from the product model.
- Large exports are generated asynchronously and a download link is provided.

## Error Responses

### Not Found

```json
{
  "success": false,
  "error": {
    "message": "Product not found",
    "code": "NOT_FOUND"
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
      "sku": "SKU must be unique",
      "price": "Price must be a positive number"
    }
  }
}
```

### Conflict Error

```json
{
  "success": false,
  "error": {
    "message": "Cannot delete product with transaction history",
    "code": "CONFLICT"
  }
}
```

## Implementation Notes

### Database Schema

The products table has the following key columns:

- id (primary key)
- name
- sku (unique per tenant)
- description
- category_id (foreign key)
- price
- cost_price
- current_stock_quantity
- reorder_level
- barcode
- is_active
- is_sellable
- last_received_date
- tenant_id (foreign key)
- created_at
- updated_at

### Important Considerations

1. Always use `current_stock_quantity` as the column name for inventory levels, not `stock_quantity`, to maintain consistency across the application.

2. The `last_received_date` field is updated automatically when processing GRNs.

3. Inventory adjustments are tracked in a separate table with references to the product.

4. SKU values must be unique within a tenant but can be duplicated across different tenants.

5. When a product is referenced in a GRN that cannot be found, the system should log a warning and continue processing other items rather than failing the entire transaction.
