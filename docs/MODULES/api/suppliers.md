# Suppliers API

This document details the endpoints for managing suppliers in the Zettaz Cloud Enterprise API.

## Overview

The Suppliers API provides endpoints for creating, retrieving, updating, and deleting supplier information. It also supports managing supplier contacts, payment terms, and performance metrics.

## Endpoints

### List Suppliers

```
GET /api/v1/suppliers
```

Retrieves a paginated list of suppliers.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20, max: 100) |
| sort | string | Field to sort by (default: 'name') |
| order | string | Sort order ('asc' or 'desc', default: 'asc') |
| search | string | Search term for supplier name, code, or contact info |
| status | string | Filter by status ('ACTIVE', 'INACTIVE') |
| category_id | string | Filter by supplier category |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "sup_123",
      "code": "SUP001",
      "name": "Acme Corporation",
      "contact_name": "John Smith",
      "email": "john.smith@acmecorp.com",
      "phone": "+1234567890",
      "status": "ACTIVE",
      "category_id": "cat_456",
      "category_name": "Electronics",
      "payment_terms": "Net 30",
      "website": "https://www.acmecorp.com",
      "active_po_count": 3,
      "total_spent": 125000.00,
      "currency": "USD",
      "tenant_id": "tenant_123",
      "created_at": "2023-01-15T10:00:00.000Z",
      "updated_at": "2023-05-30T15:30:00.000Z"
    },
    {
      "id": "sup_124",
      "code": "SUP002",
      "name": "Global Supplies Ltd",
      "contact_name": "Jane Doe",
      "email": "jane.doe@globalsupplies.com",
      "phone": "+1987654321",
      "status": "ACTIVE",
      "category_id": "cat_789",
      "category_name": "Office Supplies",
      "payment_terms": "Net 15",
      "website": "https://www.globalsupplies.com",
      "active_po_count": 1,
      "total_spent": 75000.00,
      "currency": "USD",
      "tenant_id": "tenant_123",
      "created_at": "2023-02-10T11:30:00.000Z",
      "updated_at": "2023-06-01T09:45:00.000Z"
    }
    // Additional suppliers...
  ],
  "pagination": {
    "totalItems": 42,
    "totalPages": 3,
    "currentPage": 1,
    "pageSize": 20,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

#### Notes
- Results are automatically filtered by the tenant_id of the authenticated user
- The response includes summary information such as active PO count and total spend
- Supplier codes are typically used for easy reference and integration with other systems

### Get Supplier Details

```
GET /api/v1/suppliers/:id
```

Retrieves detailed information for a specific supplier.

#### Response

```json
{
  "success": true,
  "data": {
    "id": "sup_123",
    "code": "SUP001",
    "name": "Acme Corporation",
    "legal_name": "Acme Corporation Inc.",
    "tax_id": "12-3456789",
    "status": "ACTIVE",
    "category_id": "cat_456",
    "category_name": "Electronics",
    "payment_terms": "Net 30",
    "credit_limit": 50000.00,
    "currency": "USD",
    "website": "https://www.acmecorp.com",
    "notes": "Preferred supplier for electronic components",
    "addresses": [
      {
        "id": "addr_1",
        "type": "BILLING",
        "line1": "123 Corporate Park",
        "line2": "Building 4",
        "city": "Business City",
        "state": "CA",
        "postal_code": "90210",
        "country": "USA",
        "is_default": true
      },
      {
        "id": "addr_2",
        "type": "SHIPPING",
        "line1": "456 Warehouse Blvd",
        "line2": "Dock 7",
        "city": "Logistics Town",
        "state": "CA",
        "postal_code": "90211",
        "country": "USA",
        "is_default": true
      }
    ],
    "contacts": [
      {
        "id": "contact_1",
        "name": "John Smith",
        "title": "Account Manager",
        "email": "john.smith@acmecorp.com",
        "phone": "+1234567890",
        "is_primary": true
      },
      {
        "id": "contact_2",
        "name": "Sarah Johnson",
        "title": "Sales Representative",
        "email": "sarah.johnson@acmecorp.com",
        "phone": "+1234567891",
        "is_primary": false
      }
    ],
    "bank_details": {
      "bank_name": "First National Bank",
      "account_name": "Acme Corporation Inc.",
      "account_number": "XXXX-XXXX-XXXX-1234",
      "routing_number": "XXXXXXXX",
      "swift_code": "FNBXXXX"
    },
    "performance_metrics": {
      "average_lead_time": 14.5,
      "on_time_delivery_rate": 92.5,
      "quality_rating": 4.8,
      "return_rate": 1.2,
      "last_evaluation_date": "2023-05-15T00:00:00.000Z"
    },
    "active_po_count": 3,
    "total_spent": 125000.00,
    "first_po_date": "2023-01-20T00:00:00.000Z",
    "last_po_date": "2023-05-25T00:00:00.000Z",
    "created_by": "user_123",
    "created_by_name": "John Doe",
    "tenant_id": "tenant_123",
    "created_at": "2023-01-15T10:00:00.000Z",
    "updated_at": "2023-05-30T15:30:00.000Z"
  }
}
```

### Create Supplier

```
POST /api/v1/suppliers
```

Creates a new supplier.

#### Request Body

```json
{
  "code": "SUP003",
  "name": "Tech Components Inc",
  "legal_name": "Tech Components Incorporated",
  "tax_id": "98-7654321",
  "status": "ACTIVE",
  "category_id": "cat_456",
  "payment_terms": "Net 45",
  "credit_limit": 25000.00,
  "currency": "USD",
  "website": "https://www.techcomponents.com",
  "notes": "New supplier for specialized electronic components",
  "addresses": [
    {
      "type": "BILLING",
      "line1": "789 Tech Plaza",
      "city": "Silicon Valley",
      "state": "CA",
      "postal_code": "94024",
      "country": "USA",
      "is_default": true
    }
  ],
  "contacts": [
    {
      "name": "Michael Chen",
      "title": "Sales Director",
      "email": "michael.chen@techcomponents.com",
      "phone": "+1456789123",
      "is_primary": true
    }
  ],
  "bank_details": {
    "bank_name": "Tech Credit Union",
    "account_name": "Tech Components Inc",
    "account_number": "7890-1234-5678",
    "routing_number": "87654321",
    "swift_code": "TCUXXXX"
  }
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "sup_125",
    "code": "SUP003",
    "name": "Tech Components Inc",
    "legal_name": "Tech Components Incorporated",
    "tax_id": "98-7654321",
    "status": "ACTIVE",
    "category_id": "cat_456",
    "category_name": "Electronics",
    "payment_terms": "Net 45",
    "credit_limit": 25000.00,
    "currency": "USD",
    "website": "https://www.techcomponents.com",
    "notes": "New supplier for specialized electronic components",
    "addresses": [
      {
        "id": "addr_5",
        "type": "BILLING",
        "line1": "789 Tech Plaza",
        "city": "Silicon Valley",
        "state": "CA",
        "postal_code": "94024",
        "country": "USA",
        "is_default": true
      }
    ],
    "contacts": [
      {
        "id": "contact_5",
        "name": "Michael Chen",
        "title": "Sales Director",
        "email": "michael.chen@techcomponents.com",
        "phone": "+1456789123",
        "is_primary": true
      }
    ],
    "bank_details": {
      "bank_name": "Tech Credit Union",
      "account_name": "Tech Components Inc",
      "account_number": "7890-1234-5678",
      "routing_number": "87654321",
      "swift_code": "TCUXXXX"
    },
    "created_by": "user_123",
    "created_by_name": "John Doe",
    "tenant_id": "tenant_123",
    "created_at": "2023-06-02T14:30:00.000Z",
    "updated_at": "2023-06-02T14:30:00.000Z"
  }
}
```

#### Notes
- Supplier codes must be unique within a tenant
- At least one address and contact is required
- Bank details are encrypted in the database for security
- All suppliers are created within the tenant of the authenticated user

### Update Supplier

```
PUT /api/v1/suppliers/:id
```

Updates an existing supplier.

#### Request Body

Similar to create with modifications to the relevant fields.

#### Response

```json
{
  "success": true,
  "data": {
    "id": "sup_125",
    "code": "SUP003",
    "name": "Tech Components International",
    "legal_name": "Tech Components International Inc.",
    "status": "ACTIVE",
    "updated_at": "2023-06-02T15:45:00.000Z"
    // Other fields...
  }
}
```

### Delete Supplier

```
DELETE /api/v1/suppliers/:id
```

Deletes a supplier or marks them as inactive.

#### Response

```json
{
  "success": true,
  "data": {
    "message": "Supplier deactivated successfully"
  }
}
```

#### Notes
- In most cases, suppliers are not physically deleted but marked as INACTIVE
- Supplier deletion is only allowed if there are no associated purchase orders or other dependencies
- All supplier deletion actions are logged for audit purposes

### Add Supplier Contact

```
POST /api/v1/suppliers/:id/contacts
```

Adds a new contact to an existing supplier.

#### Request Body

```json
{
  "name": "Robert Johnson",
  "title": "Technical Support",
  "email": "robert.johnson@techcomponents.com",
  "phone": "+1456789124",
  "is_primary": false
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "contact_6",
    "name": "Robert Johnson",
    "title": "Technical Support",
    "email": "robert.johnson@techcomponents.com",
    "phone": "+1456789124",
    "is_primary": false,
    "supplier_id": "sup_125",
    "created_at": "2023-06-02T16:30:00.000Z"
  }
}
```

### Update Supplier Contact

```
PUT /api/v1/suppliers/:supplier_id/contacts/:id
```

Updates an existing supplier contact.

#### Request Body

```json
{
  "name": "Robert Johnson",
  "title": "Technical Support Manager",
  "email": "robert.johnson@techcomponents.com",
  "phone": "+1456789124",
  "is_primary": true
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "contact_6",
    "name": "Robert Johnson",
    "title": "Technical Support Manager",
    "email": "robert.johnson@techcomponents.com",
    "phone": "+1456789124",
    "is_primary": true,
    "supplier_id": "sup_125",
    "updated_at": "2023-06-02T16:45:00.000Z"
  }
}
```

#### Notes
- If a contact is marked as primary, any previously primary contact will be automatically set to non-primary

### Delete Supplier Contact

```
DELETE /api/v1/suppliers/:supplier_id/contacts/:id
```

Deletes a supplier contact.

#### Response

```json
{
  "success": true,
  "data": {
    "message": "Contact deleted successfully"
  }
}
```

### Add Supplier Address

```
POST /api/v1/suppliers/:id/addresses
```

Adds a new address to an existing supplier.

#### Request Body

```json
{
  "type": "SHIPPING",
  "line1": "123 Distribution Center",
  "line2": "Unit 10",
  "city": "Logistics City",
  "state": "CA",
  "postal_code": "94025",
  "country": "USA",
  "is_default": true
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "addr_6",
    "type": "SHIPPING",
    "line1": "123 Distribution Center",
    "line2": "Unit 10",
    "city": "Logistics City",
    "state": "CA",
    "postal_code": "94025",
    "country": "USA",
    "is_default": true,
    "supplier_id": "sup_125",
    "created_at": "2023-06-02T17:00:00.000Z"
  }
}
```

### Update Supplier Address

```
PUT /api/v1/suppliers/:supplier_id/addresses/:id
```

Updates an existing supplier address.

#### Request Body

Similar to create with modifications to the relevant fields.

### Delete Supplier Address

```
DELETE /api/v1/suppliers/:supplier_id/addresses/:id
```

Deletes a supplier address.

#### Response

```json
{
  "success": true,
  "data": {
    "message": "Address deleted successfully"
  }
}
```

### Update Supplier Performance

```
PUT /api/v1/suppliers/:id/performance
```

Updates the performance metrics for a supplier.

#### Request Body

```json
{
  "average_lead_time": 15.2,
  "on_time_delivery_rate": 94.5,
  "quality_rating": 4.9,
  "return_rate": 0.8,
  "evaluation_date": "2023-06-01T00:00:00.000Z",
  "notes": "Quarterly performance review completed. Overall improvement in all metrics."
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "supplier_id": "sup_125",
    "performance_metrics": {
      "average_lead_time": 15.2,
      "on_time_delivery_rate": 94.5,
      "quality_rating": 4.9,
      "return_rate": 0.8,
      "last_evaluation_date": "2023-06-01T00:00:00.000Z"
    },
    "updated_at": "2023-06-02T17:30:00.000Z"
  }
}
```

### Get Supplier Products

```
GET /api/v1/suppliers/:id/products
```

Retrieves a list of products supplied by a specific supplier.

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "prod_1",
      "name": "Product A",
      "sku": "SKU-001",
      "supplier_sku": "SUPSKU-001",
      "category_name": "Electronics",
      "current_cost": 49.99,
      "last_purchase_date": "2023-05-15T00:00:00.000Z",
      "lead_time_days": 14,
      "minimum_order_quantity": 10,
      "is_active": true
    },
    {
      "id": "prod_2",
      "name": "Product B",
      "sku": "SKU-002",
      "supplier_sku": "SUPSKU-002",
      "category_name": "Electronics",
      "current_cost": 29.99,
      "last_purchase_date": "2023-05-20T00:00:00.000Z",
      "lead_time_days": 10,
      "minimum_order_quantity": 20,
      "is_active": true
    }
    // Additional products...
  ],
  "pagination": {
    "totalItems": 15,
    "totalPages": 1,
    "currentPage": 1,
    "pageSize": 20,
    "hasNext": false,
    "hasPrevious": false
  }
}
```

### Get Supplier Purchase Orders

```
GET /api/v1/suppliers/:id/purchase-orders
```

Retrieves a paginated list of purchase orders for a specific supplier.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20, max: 100) |
| sort | string | Field to sort by (default: 'created_at') |
| order | string | Sort order ('asc' or 'desc', default: 'desc') |
| status | string | Filter by status |
| start_date | date | Filter by date range start (ISO format) |
| end_date | date | Filter by date range end (ISO format) |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "po_123",
      "po_number": "PO-001",
      "status": "ORDERED",
      "received_status": "NOT_RECEIVED",
      "order_date": "2023-05-15T10:00:00.000Z",
      "expected_delivery_date": "2023-05-29T00:00:00.000Z",
      "last_grn_date": null,
      "total_amount": 2499.50,
      "currency": "USD",
      "notes": "Standard delivery terms",
      "item_count": 2,
      "created_at": "2023-05-15T09:30:00.000Z",
      "updated_at": "2023-05-15T10:00:00.000Z"
    },
    {
      "id": "po_124",
      "po_number": "PO-002",
      "status": "PARTIALLY_RECEIVED",
      "received_status": "PARTIALLY_RECEIVED",
      "order_date": "2023-05-01T11:00:00.000Z",
      "expected_delivery_date": "2023-05-15T00:00:00.000Z",
      "last_grn_date": "2023-05-10T14:00:00.000Z",
      "total_amount": 1799.75,
      "currency": "USD",
      "notes": "Priority shipment",
      "item_count": 3,
      "created_at": "2023-05-01T10:45:00.000Z",
      "updated_at": "2023-05-10T14:00:00.000Z"
    }
    // Additional purchase orders...
  ],
  "pagination": {
    "totalItems": 12,
    "totalPages": 1,
    "currentPage": 1,
    "pageSize": 20,
    "hasNext": false,
    "hasPrevious": false
  }
}
```

## Error Responses

### Not Found

```json
{
  "success": false,
  "error": {
    "message": "Supplier not found",
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
      "code": "Supplier code already exists",
      "name": "Supplier name is required",
      "contacts": "At least one contact is required"
    }
  }
}
```

### Dependency Error

```json
{
  "success": false,
  "error": {
    "message": "Cannot delete supplier with active purchase orders",
    "code": "DEPENDENCY_ERROR",
    "details": {
      "active_po_count": 3
    }
  }
}
```

## Implementation Notes

### Multi-tenancy Considerations

All supplier operations enforce tenant isolation:

```javascript
// Direct supplier query
const [suppliers] = await connection.query(
  'SELECT * FROM suppliers WHERE tenant_id = ?',
  [tenant_id]
);

// Joined queries for supplier products
const [products] = await connection.query(`
  SELECT p.*, pc.name as category_name 
  FROM products p
  JOIN product_suppliers ps ON p.id = ps.product_id
  JOIN product_categories pc ON p.category_id = pc.id
  WHERE ps.supplier_id = ? AND p.tenant_id = ?
`, [supplierId, tenant_id]);
```

### Supplier Performance Tracking

Supplier performance metrics are calculated based on:

1. Purchase order delivery times vs. expected delivery dates
2. Quality of received goods (as recorded during GRN processing)
3. Return rates for products from the supplier
4. These metrics are updated:
   - Automatically during GRN processing
   - Manually through performance evaluations
   - Periodically by a background job that recalculates metrics

### Supplier Categorization

Suppliers can be categorized to help with:

1. Reporting and analytics
2. Applying different approval workflows
3. Setting different payment terms by category
4. Filtering in the user interface

### Address and Contact Management

The system supports multiple addresses and contacts per supplier:

1. Addresses can be of different types (BILLING, SHIPPING, etc.)
2. One address of each type can be marked as default
3. Contacts can be designated as primary
4. Contact information is used for automated notifications

### Security Considerations

Supplier data is protected through:

1. Tenant isolation
2. Role-based access control for supplier operations
3. Encryption of sensitive data like bank details
4. Audit logging of all supplier changes
