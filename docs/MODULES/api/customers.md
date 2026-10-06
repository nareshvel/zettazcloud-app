# Customers API

This document details the endpoints for managing customers in the Zettaz Cloud Enterprise API.

## Overview

The Customers API provides endpoints for creating, retrieving, updating, and deleting customer information. It also supports managing customer contacts, addresses, payment methods, and viewing customer order history.

## Endpoints

### List Customers

```
GET /api/v1/customers
```

Retrieves a paginated list of customers.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20, max: 100) |
| sort | string | Field to sort by (default: 'name') |
| order | string | Sort order ('asc' or 'desc', default: 'asc') |
| search | string | Search term for customer name, email, or phone |
| status | string | Filter by status ('ACTIVE', 'INACTIVE') |
| customer_type | string | Filter by customer type ('INDIVIDUAL', 'BUSINESS') |
| segment | string | Filter by customer segment |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "cust_123",
      "customer_number": "C0001",
      "name": "ABC Corporation",
      "contact_name": "Jane Smith",
      "email": "jane.smith@abccorp.com",
      "phone": "+1234567890",
      "customer_type": "BUSINESS",
      "status": "ACTIVE",
      "segment": "ENTERPRISE",
      "total_orders": 12,
      "total_spent": 15750.25,
      "currency": "USD",
      "last_order_date": "2023-05-15T10:30:00.000Z",
      "created_at": "2023-01-10T09:00:00.000Z",
      "updated_at": "2023-05-15T10:30:00.000Z"
    },
    {
      "id": "cust_124",
      "customer_number": "C0002",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "phone": "+1987654321",
      "customer_type": "INDIVIDUAL",
      "status": "ACTIVE",
      "segment": "REGULAR",
      "total_orders": 5,
      "total_spent": 2500.75,
      "currency": "USD",
      "last_order_date": "2023-05-10T14:45:00.000Z",
      "created_at": "2023-01-15T11:30:00.000Z",
      "updated_at": "2023-05-10T14:45:00.000Z"
    }
    // Additional customers...
  ],
  "pagination": {
    "totalItems": 35,
    "totalPages": 2,
    "currentPage": 1,
    "pageSize": 20,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

#### Notes
- Results are automatically filtered by the tenant_id of the authenticated user
- The response includes summary information such as total orders and total spend
- Customer numbers are unique within a tenant and are used for easy reference

### Get Customer Details

```
GET /api/v1/customers/:id
```

Retrieves detailed information for a specific customer.

#### Response

```json
{
  "success": true,
  "data": {
    "id": "cust_123",
    "customer_number": "C0001",
    "name": "ABC Corporation",
    "legal_name": "ABC Corporation Inc.",
    "tax_id": "12-3456789",
    "contact_name": "Jane Smith",
    "email": "jane.smith@abccorp.com",
    "phone": "+1234567890",
    "customer_type": "BUSINESS",
    "status": "ACTIVE",
    "segment": "ENTERPRISE",
    "payment_terms": "Net 30",
    "credit_limit": 50000.00,
    "current_balance": 10250.75,
    "currency": "USD",
    "website": "https://www.abccorp.com",
    "notes": "Key account - VP approval required for discounts over 15%",
    "addresses": [
      {
        "id": "addr_1",
        "type": "BILLING",
        "line1": "123 Corporate Ave",
        "line2": "Suite 500",
        "city": "Business City",
        "state": "NY",
        "postal_code": "10001",
        "country": "USA",
        "is_default": true
      },
      {
        "id": "addr_2",
        "type": "SHIPPING",
        "line1": "456 Logistics Blvd",
        "line2": "Building 3",
        "city": "Shipping Town",
        "state": "NY",
        "postal_code": "10002",
        "country": "USA",
        "is_default": true
      }
    ],
    "contacts": [
      {
        "id": "contact_1",
        "name": "Jane Smith",
        "title": "Procurement Manager",
        "email": "jane.smith@abccorp.com",
        "phone": "+1234567890",
        "is_primary": true
      },
      {
        "id": "contact_2",
        "name": "Robert Johnson",
        "title": "Finance Director",
        "email": "robert.johnson@abccorp.com",
        "phone": "+1234567891",
        "is_primary": false
      }
    ],
    "payment_methods": [
      {
        "id": "pm_1",
        "type": "CREDIT_CARD",
        "is_default": true,
        "card_type": "Visa",
        "last_four": "4242",
        "expiry_month": 12,
        "expiry_year": 2025,
        "cardholder_name": "ABC Corp"
      },
      {
        "id": "pm_2",
        "type": "BANK_ACCOUNT",
        "is_default": false,
        "account_type": "CHECKING",
        "account_name": "ABC Corporation Inc.",
        "last_four": "6789"
      }
    ],
    "total_orders": 12,
    "total_spent": 15750.25,
    "first_order_date": "2023-01-20T10:00:00.000Z",
    "last_order_date": "2023-05-15T10:30:00.000Z",
    "created_by": "user_123",
    "created_by_name": "John Doe",
    "created_at": "2023-01-10T09:00:00.000Z",
    "updated_at": "2023-05-15T10:30:00.000Z"
  }
}
```

### Create Customer

```
POST /api/v1/customers
```

Creates a new customer.

#### Request Body

```json
{
  "customer_number": "C0003",
  "name": "XYZ Inc",
  "legal_name": "XYZ Incorporated",
  "tax_id": "98-7654321",
  "contact_name": "Michael Brown",
  "email": "michael.brown@xyzinc.com",
  "phone": "+1456789123",
  "customer_type": "BUSINESS",
  "status": "ACTIVE",
  "segment": "MID_MARKET",
  "payment_terms": "Net 15",
  "credit_limit": 25000.00,
  "currency": "USD",
  "website": "https://www.xyzinc.com",
  "notes": "New customer - referred by ABC Corporation",
  "addresses": [
    {
      "type": "BILLING",
      "line1": "789 Business Park",
      "city": "Commerce City",
      "state": "CA",
      "postal_code": "90210",
      "country": "USA",
      "is_default": true
    }
  ],
  "contacts": [
    {
      "name": "Michael Brown",
      "title": "CEO",
      "email": "michael.brown@xyzinc.com",
      "phone": "+1456789123",
      "is_primary": true
    }
  ]
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "cust_125",
    "customer_number": "C0003",
    "name": "XYZ Inc",
    "legal_name": "XYZ Incorporated",
    "tax_id": "98-7654321",
    "contact_name": "Michael Brown",
    "email": "michael.brown@xyzinc.com",
    "phone": "+1456789123",
    "customer_type": "BUSINESS",
    "status": "ACTIVE",
    "segment": "MID_MARKET",
    "payment_terms": "Net 15",
    "credit_limit": 25000.00,
    "currency": "USD",
    "website": "https://www.xyzinc.com",
    "notes": "New customer - referred by ABC Corporation",
    "addresses": [
      {
        "id": "addr_5",
        "type": "BILLING",
        "line1": "789 Business Park",
        "city": "Commerce City",
        "state": "CA",
        "postal_code": "90210",
        "country": "USA",
        "is_default": true
      }
    ],
    "contacts": [
      {
        "id": "contact_5",
        "name": "Michael Brown",
        "title": "CEO",
        "email": "michael.brown@xyzinc.com",
        "phone": "+1456789123",
        "is_primary": true
      }
    ],
    "created_by": "user_123",
    "created_by_name": "John Doe",
    "tenant_id": "tenant_123",
    "created_at": "2023-06-02T14:30:00.000Z",
    "updated_at": "2023-06-02T14:30:00.000Z"
  }
}
```

#### Notes
- Customer numbers can be auto-generated if not provided
- At least one address is required for business customers
- All customers are created within the tenant of the authenticated user
- Email addresses must be unique within a tenant

### Update Customer

```
PUT /api/v1/customers/:id
```

Updates an existing customer.

#### Request Body

Similar to create with modifications to the relevant fields.

#### Response

```json
{
  "success": true,
  "data": {
    "id": "cust_125",
    "customer_number": "C0003",
    "name": "XYZ International Inc",
    "email": "info@xyzinc.com",
    "status": "ACTIVE",
    "updated_at": "2023-06-02T15:45:00.000Z"
    // Other fields...
  }
}
```

### Delete Customer

```
DELETE /api/v1/customers/:id
```

Deletes a customer or marks them as inactive.

#### Response

```json
{
  "success": true,
  "data": {
    "message": "Customer deactivated successfully"
  }
}
```

#### Notes
- In most cases, customers are not physically deleted but marked as INACTIVE
- Customer deletion is only allowed if there are no outstanding invoices or orders
- All customer deletion actions are logged for audit purposes

### Add Customer Contact

```
POST /api/v1/customers/:id/contacts
```

Adds a new contact to an existing customer.

#### Request Body

```json
{
  "name": "Sarah Williams",
  "title": "Operations Manager",
  "email": "sarah.williams@xyzinc.com",
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
    "name": "Sarah Williams",
    "title": "Operations Manager",
    "email": "sarah.williams@xyzinc.com",
    "phone": "+1456789124",
    "is_primary": false,
    "customer_id": "cust_125",
    "created_at": "2023-06-02T16:30:00.000Z"
  }
}
```

### Update Customer Contact

```
PUT /api/v1/customers/:customer_id/contacts/:id
```

Updates an existing customer contact.

#### Request Body

```json
{
  "name": "Sarah Williams",
  "title": "Operations Director",
  "email": "sarah.williams@xyzinc.com",
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
    "name": "Sarah Williams",
    "title": "Operations Director",
    "email": "sarah.williams@xyzinc.com",
    "phone": "+1456789124",
    "is_primary": true,
    "customer_id": "cust_125",
    "updated_at": "2023-06-02T16:45:00.000Z"
  }
}
```

#### Notes
- If a contact is marked as primary, any previously primary contact will be automatically set to non-primary

### Delete Customer Contact

```
DELETE /api/v1/customers/:customer_id/contacts/:id
```

Deletes a customer contact.

#### Response

```json
{
  "success": true,
  "data": {
    "message": "Contact deleted successfully"
  }
}
```

### Add Customer Address

```
POST /api/v1/customers/:id/addresses
```

Adds a new address to an existing customer.

#### Request Body

```json
{
  "type": "SHIPPING",
  "line1": "123 Warehouse Road",
  "city": "Distribution City",
  "state": "CA",
  "postal_code": "90211",
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
    "line1": "123 Warehouse Road",
    "city": "Distribution City",
    "state": "CA",
    "postal_code": "90211",
    "country": "USA",
    "is_default": true,
    "customer_id": "cust_125",
    "created_at": "2023-06-02T17:00:00.000Z"
  }
}
```

### Update Customer Address

```
PUT /api/v1/customers/:customer_id/addresses/:id
```

Updates an existing customer address.

#### Request Body

Similar to create with modifications to the relevant fields.

### Delete Customer Address

```
DELETE /api/v1/customers/:customer_id/addresses/:id
```

Deletes a customer address.

#### Response

```json
{
  "success": true,
  "data": {
    "message": "Address deleted successfully"
  }
}
```

### Add Payment Method

```
POST /api/v1/customers/:id/payment-methods
```

Adds a new payment method to an existing customer.

#### Request Body

```json
{
  "type": "CREDIT_CARD",
  "is_default": true,
  "card_type": "Mastercard",
  "card_number": "5555555555554444",
  "expiry_month": 12,
  "expiry_year": 2025,
  "cardholder_name": "XYZ Inc",
  "billing_address_id": "addr_5"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "pm_3",
    "type": "CREDIT_CARD",
    "is_default": true,
    "card_type": "Mastercard",
    "last_four": "4444",
    "expiry_month": 12,
    "expiry_year": 2025,
    "cardholder_name": "XYZ Inc",
    "customer_id": "cust_125",
    "created_at": "2023-06-02T17:15:00.000Z"
  }
}
```

#### Notes
- Card numbers and bank account details are securely encrypted
- Only the last four digits are returned in responses
- If a payment method is marked as default, any previously default payment method will be automatically set to non-default

### Delete Payment Method

```
DELETE /api/v1/customers/:customer_id/payment-methods/:id
```

Deletes a customer payment method.

#### Response

```json
{
  "success": true,
  "data": {
    "message": "Payment method deleted successfully"
  }
}
```

### Get Customer Orders

```
GET /api/v1/customers/:id/orders
```

Retrieves a paginated list of orders for a specific customer.

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
      "id": "order_123",
      "order_number": "SO-001",
      "status": "COMPLETED",
      "order_date": "2023-05-15T10:30:00.000Z",
      "total_amount": 1250.75,
      "currency": "USD",
      "payment_status": "PAID",
      "shipping_status": "DELIVERED",
      "fulfillment_date": "2023-05-16T14:00:00.000Z",
      "items_count": 5,
      "created_at": "2023-05-15T10:30:00.000Z",
      "updated_at": "2023-05-16T14:00:00.000Z"
    },
    {
      "id": "order_124",
      "order_number": "SO-002",
      "status": "PROCESSING",
      "order_date": "2023-05-10T14:45:00.000Z",
      "total_amount": 750.50,
      "currency": "USD",
      "payment_status": "PAID",
      "shipping_status": "PENDING",
      "fulfillment_date": null,
      "items_count": 3,
      "created_at": "2023-05-10T14:45:00.000Z",
      "updated_at": "2023-05-10T14:45:00.000Z"
    }
    // Additional orders...
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

### Get Customer Invoices

```
GET /api/v1/customers/:id/invoices
```

Retrieves a paginated list of invoices for a specific customer.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20, max: 100) |
| sort | string | Field to sort by (default: 'created_at') |
| order | string | Sort order ('asc' or 'desc', default: 'desc') |
| status | string | Filter by status ('PAID', 'UNPAID', 'OVERDUE') |
| start_date | date | Filter by date range start (ISO format) |
| end_date | date | Filter by date range end (ISO format) |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "inv_123",
      "invoice_number": "INV-001",
      "order_id": "order_123",
      "order_number": "SO-001",
      "status": "PAID",
      "issue_date": "2023-05-15T11:00:00.000Z",
      "due_date": "2023-06-14T11:00:00.000Z",
      "paid_date": "2023-05-15T11:05:00.000Z",
      "total_amount": 1250.75,
      "balance_due": 0.00,
      "currency": "USD",
      "created_at": "2023-05-15T11:00:00.000Z",
      "updated_at": "2023-05-15T11:05:00.000Z"
    },
    {
      "id": "inv_124",
      "invoice_number": "INV-002",
      "order_id": "order_124",
      "order_number": "SO-002",
      "status": "PAID",
      "issue_date": "2023-05-10T15:00:00.000Z",
      "due_date": "2023-06-09T15:00:00.000Z",
      "paid_date": "2023-05-10T15:10:00.000Z",
      "total_amount": 750.50,
      "balance_due": 0.00,
      "currency": "USD",
      "created_at": "2023-05-10T15:00:00.000Z",
      "updated_at": "2023-05-10T15:10:00.000Z"
    }
    // Additional invoices...
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

### Get Customer Statement

```
GET /api/v1/customers/:id/statement
```

Retrieves a statement of account for a specific customer.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| start_date | date | Start date for statement period (ISO format, default: 30 days ago) |
| end_date | date | End date for statement period (ISO format, default: current date) |
| include_paid | boolean | Whether to include paid invoices (default: false) |

#### Response

```json
{
  "success": true,
  "data": {
    "customer": {
      "id": "cust_123",
      "customer_number": "C0001",
      "name": "ABC Corporation",
      "contact_name": "Jane Smith",
      "email": "jane.smith@abccorp.com"
    },
    "statement_period": {
      "start_date": "2023-05-01T00:00:00.000Z",
      "end_date": "2023-05-31T23:59:59.999Z"
    },
    "summary": {
      "opening_balance": 5000.25,
      "total_invoiced": 12500.75,
      "total_paid": 7250.25,
      "closing_balance": 10250.75,
      "currency": "USD",
      "overdue_amount": 3500.50
    },
    "transactions": [
      {
        "date": "2023-05-01T00:00:00.000Z",
        "type": "BALANCE_FORWARD",
        "reference": "",
        "description": "Opening Balance",
        "amount": 5000.25,
        "balance": 5000.25
      },
      {
        "date": "2023-05-05T10:00:00.000Z",
        "type": "INVOICE",
        "reference": "INV-001",
        "description": "Invoice for Order SO-001",
        "amount": 1250.75,
        "balance": 6251.00
      },
      {
        "date": "2023-05-05T14:00:00.000Z",
        "type": "PAYMENT",
        "reference": "PMT-001",
        "description": "Payment for Invoice INV-001",
        "amount": -1250.75,
        "balance": 5000.25
      }
      // Additional transactions...
    ],
    "aging": {
      "current": 5000.25,
      "1_30_days": 3000.50,
      "31_60_days": 1500.00,
      "61_90_days": 750.00,
      "over_90_days": 0.00,
      "total": 10250.75
    },
    "generated_at": "2023-06-02T18:00:00.000Z"
  }
}
```

## Error Responses

### Not Found

```json
{
  "success": false,
  "error": {
    "message": "Customer not found",
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
      "name": "Customer name is required",
      "email": "Email address is invalid",
      "customer_number": "Customer number already exists"
    }
  }
}
```

### Dependency Error

```json
{
  "success": false,
  "error": {
    "message": "Cannot delete customer with outstanding invoices",
    "code": "DEPENDENCY_ERROR",
    "details": {
      "outstanding_invoices": 3
    }
  }
}
```

## Implementation Notes

### Multi-tenancy Considerations

All customer operations enforce tenant isolation:

```javascript
// Direct customer query
const [customers] = await connection.query(
  'SELECT * FROM customers WHERE tenant_id = ?',
  [tenant_id]
);

// Joined queries for customer orders
const [orders] = await connection.query(`
  SELECT o.* 
  FROM sales_orders o
  WHERE o.customer_id = ? AND o.tenant_id = ?
  ORDER BY o.created_at DESC
`, [customerId, tenant_id]);
```

### Customer Segmentation

Customer segmentation helps with:

1. Pricing strategies
2. Marketing campaigns
3. Service level differentiation
4. Reporting and analytics

Common segments include:

- ENTERPRISE: Large business customers
- MID_MARKET: Medium-sized businesses
- SMALL_BUSINESS: Small businesses
- REGULAR: Individual regular customers
- VIP: High-value customers with special benefits

### Address and Contact Management

The system supports multiple addresses and contacts per customer:

1. Addresses can be of different types (BILLING, SHIPPING, etc.)
2. One address of each type can be marked as default
3. Contacts can be designated as primary
4. Contact information is used for automated communications

### Payment Processing

Payment methods are securely stored:

1. Credit card information is tokenized and encrypted
2. Only the last four digits are stored for display
3. Expiry dates are tracked for reminders
4. Bank account details are similarly secured
5. Payment methods link to billing addresses

### Customer Statement Generation

Customer statements are generated using:

1. Opening balance calculation based on start date
2. Transaction history during the statement period
3. Aging analysis of outstanding invoices
4. Summary statistics for the period
5. PDF generation for email or download

### Security Considerations

Customer data is protected through:

1. Tenant isolation in database queries
2. Role-based access control for customer operations
3. Encryption of sensitive data like payment information
4. Audit logging of all customer changes
5. Compliance with data protection regulations

### Integration with Sales Process

Customer information integrates with the sales process:

1. Customer details are used in sales orders
2. Credit limits are checked during order processing
3. Payment terms determine invoice due dates
4. Address information is used for shipping
5. Contact information is used for order communications
