# Sales API

This document details the endpoints for managing sales operations in the Zettaz Cloud Enterprise API.

## Overview

The Sales API provides endpoints for creating and managing sales orders, processing point-of-sale (POS) transactions, generating invoices, and handling payments.

## Endpoints

### List Sales Orders

```
GET /api/v1/sales/orders
```

Retrieves a paginated list of sales orders.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20, max: 100) |
| sort | string | Field to sort by (default: 'created_at') |
| order | string | Sort order ('asc' or 'desc', default: 'desc') |
| search | string | Search term for order number or customer name |
| status | string | Filter by status |
| customer_id | string | Filter by customer ID |
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
      "customer_id": "cust_456",
      "customer_name": "ABC Corporation",
      "status": "CONFIRMED",
      "order_date": "2023-05-15T10:00:00.000Z",
      "fulfillment_status": "PARTIAL",
      "payment_status": "PARTIAL",
      "total_amount": 1250.00,
      "balance_due": 500.00,
      "currency": "USD",
      "notes": "Regular monthly order",
      "created_by": "user_id_1",
      "created_by_name": "John Doe",
      "tenant_id": "tenant_123",
      "created_at": "2023-05-15T09:30:00.000Z",
      "updated_at": "2023-05-15T14:30:00.000Z"
    },
    {
      "id": "order_124",
      "order_number": "SO-002",
      "customer_id": "cust_789",
      "customer_name": "XYZ Ltd",
      "status": "CONFIRMED",
      "order_date": "2023-05-16T11:15:00.000Z",
      "fulfillment_status": "UNFULFILLED",
      "payment_status": "UNPAID",
      "total_amount": 750.00,
      "balance_due": 750.00,
      "currency": "USD",
      "notes": "Rush order",
      "created_by": "user_id_2",
      "created_by_name": "Jane Smith",
      "tenant_id": "tenant_123",
      "created_at": "2023-05-16T11:00:00.000Z",
      "updated_at": "2023-05-16T11:15:00.000Z"
    }
    // Additional orders...
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

### Get Sales Order Details

```
GET /api/v1/sales/orders/:id
```

Retrieves detailed information for a specific sales order.

#### Response

```json
{
  "success": true,
  "data": {
    "id": "order_123",
    "order_number": "SO-001",
    "customer_id": "cust_456",
    "customer_name": "ABC Corporation",
    "customer_email": "orders@abccorp.com",
    "customer_phone": "+1234567890",
    "status": "CONFIRMED",
    "order_date": "2023-05-15T10:00:00.000Z",
    "expected_shipment_date": "2023-05-20T00:00:00.000Z",
    "fulfillment_status": "PARTIAL",
    "payment_status": "PARTIAL",
    "shipping_address": {
      "line1": "123 Corporate Park",
      "line2": "Building 4",
      "city": "Business City",
      "state": "CA",
      "postal_code": "90210",
      "country": "USA"
    },
    "billing_address": {
      "line1": "456 Finance Ave",
      "line2": "Suite 789",
      "city": "Business City",
      "state": "CA",
      "postal_code": "90210",
      "country": "USA"
    },
    "subtotal": 1200.00,
    "tax_rate": 7.5,
    "tax_amount": 90.00,
    "shipping_cost": 35.00,
    "discount_amount": 75.00,
    "total_amount": 1250.00,
    "amount_paid": 750.00,
    "balance_due": 500.00,
    "currency": "USD",
    "payment_terms": "Net 30",
    "notes": "Regular monthly order",
    "internal_notes": "Preferred customer, priority handling",
    "created_by": "user_id_1",
    "created_by_name": "John Doe",
    "tenant_id": "tenant_123",
    "created_at": "2023-05-15T09:30:00.000Z",
    "updated_at": "2023-05-15T14:30:00.000Z",
    "items": [
      {
        "id": "item_1",
        "product_id": "prod_1",
        "product_name": "Product A",
        "product_sku": "SKU-001",
        "quantity": 10,
        "fulfilled_quantity": 5,
        "unit_price": 50.00,
        "unit_cost": 30.00,
        "tax_rate": 7.5,
        "tax_amount": 37.50,
        "discount_percentage": 5,
        "discount_amount": 25.00,
        "line_total": 475.00,
        "notes": "Standard package"
      },
      {
        "id": "item_2",
        "product_id": "prod_2",
        "product_name": "Product B",
        "product_sku": "SKU-002",
        "quantity": 15,
        "fulfilled_quantity": 10,
        "unit_price": 55.00,
        "unit_cost": 35.00,
        "tax_rate": 7.5,
        "tax_amount": 52.50,
        "discount_percentage": 5,
        "discount_amount": 50.00,
        "line_total": 775.00,
        "notes": "Special configuration"
      }
    ],
    "invoices": [
      {
        "id": "inv_1",
        "invoice_number": "INV-001",
        "date": "2023-05-15T14:00:00.000Z",
        "amount": 750.00,
        "status": "PAID",
        "payment_date": "2023-05-15T14:30:00.000Z"
      }
    ],
    "fulfillments": [
      {
        "id": "ful_1",
        "fulfillment_number": "FUL-001",
        "date": "2023-05-16T10:00:00.000Z",
        "status": "COMPLETED",
        "shipping_method": "Ground",
        "tracking_number": "TRACK123456",
        "items": [
          {
            "product_id": "prod_1",
            "quantity": 5
          },
          {
            "product_id": "prod_2",
            "quantity": 10
          }
        ]
      }
    ]
  }
}
```

### Create Sales Order

```
POST /api/v1/sales/orders
```

Creates a new sales order.

#### Request Body

```json
{
  "customer_id": "cust_789",
  "order_date": "2023-06-01T10:00:00.000Z",
  "expected_shipment_date": "2023-06-05T00:00:00.000Z",
  "shipping_address": {
    "line1": "789 Customer St",
    "city": "Customer City",
    "state": "NY",
    "postal_code": "10001",
    "country": "USA"
  },
  "billing_address": {
    "line1": "789 Customer St",
    "city": "Customer City",
    "state": "NY",
    "postal_code": "10001",
    "country": "USA"
  },
  "payment_terms": "Net 15",
  "tax_rate": 8.5,
  "shipping_cost": 25.00,
  "discount_amount": 50.00,
  "notes": "Special promotional order",
  "internal_notes": "Marketing campaign June 2023",
  "status": "DRAFT",
  "items": [
    {
      "product_id": "prod_1",
      "quantity": 5,
      "unit_price": 49.99,
      "discount_percentage": 0,
      "notes": "Standard edition"
    },
    {
      "product_id": "prod_3",
      "quantity": 2,
      "unit_price": 129.99,
      "discount_percentage": 10,
      "notes": "Premium edition"
    }
  ]
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "order_125",
    "order_number": "SO-003",
    "customer_id": "cust_789",
    "customer_name": "XYZ Ltd",
    "status": "DRAFT",
    "order_date": "2023-06-01T10:00:00.000Z",
    "expected_shipment_date": "2023-06-05T00:00:00.000Z",
    "fulfillment_status": "UNFULFILLED",
    "payment_status": "UNPAID",
    "subtotal": 509.93,
    "tax_rate": 8.5,
    "tax_amount": 43.34,
    "shipping_cost": 25.00,
    "discount_amount": 76.00,
    "total_amount": 502.27,
    "balance_due": 502.27,
    "currency": "USD",
    "payment_terms": "Net 15",
    "notes": "Special promotional order",
    "internal_notes": "Marketing campaign June 2023",
    "created_by": "user_id_1",
    "created_by_name": "John Doe",
    "tenant_id": "tenant_123",
    "created_at": "2023-06-01T10:15:00.000Z",
    "updated_at": "2023-06-01T10:15:00.000Z",
    "items": [
      {
        "id": "item_5",
        "product_id": "prod_1",
        "product_name": "Product A",
        "product_sku": "SKU-001",
        "quantity": 5,
        "fulfilled_quantity": 0,
        "unit_price": 49.99,
        "unit_cost": 30.00,
        "tax_rate": 8.5,
        "tax_amount": 21.25,
        "discount_percentage": 0,
        "discount_amount": 0.00,
        "line_total": 249.95,
        "notes": "Standard edition"
      },
      {
        "id": "item_6",
        "product_id": "prod_3",
        "product_name": "Product C",
        "product_sku": "SKU-003",
        "quantity": 2,
        "fulfilled_quantity": 0,
        "unit_price": 129.99,
        "unit_cost": 80.00,
        "tax_rate": 8.5,
        "tax_amount": 22.10,
        "discount_percentage": 10,
        "discount_amount": 26.00,
        "line_total": 259.98,
        "notes": "Premium edition"
      }
    ]
  }
}
```

### Update Sales Order

```
PUT /api/v1/sales/orders/:id
```

Updates an existing sales order. This is primarily used to edit draft orders.

#### Request Body

Similar to create, with modifications to the relevant fields.

### Update Sales Order Status

```
PUT /api/v1/sales/orders/:id/status
```

Updates the status of a sales order.

#### Request Body

```json
{
  "status": "CONFIRMED",
  "notes": "Approved by manager"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "order_125",
    "order_number": "SO-003",
    "previous_status": "DRAFT",
    "new_status": "CONFIRMED",
    "updated_at": "2023-06-01T11:30:00.000Z",
    "status_change_notes": "Approved by manager"
  }
}
```

### Process POS Transaction

```
POST /api/v1/sales/pos/transactions
```

Creates a new point-of-sale transaction.

#### Request Body

```json
{
  "customer_id": "cust_walk_in", 
  "payment_method": "CREDIT_CARD",
  "payment_reference": "AUTH123456",
  "notes": "Walk-in customer",
  "items": [
    {
      "product_id": "prod_1",
      "quantity": 2,
      "unit_price": 49.99,
      "discount_percentage": 0
    },
    {
      "product_id": "prod_4",
      "quantity": 1,
      "unit_price": 19.99,
      "discount_percentage": 0
    }
  ],
  "tax_rate": 8.5,
  "discount_amount": 0,
  "amount_tendered": 130.00
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "pos_123",
    "transaction_number": "POS-001",
    "customer_id": "cust_walk_in",
    "customer_name": "Walk-in Customer",
    "transaction_date": "2023-06-01T15:30:00.000Z",
    "subtotal": 119.97,
    "tax_rate": 8.5,
    "tax_amount": 10.20,
    "total_amount": 130.17,
    "payment_method": "CREDIT_CARD",
    "payment_reference": "AUTH123456",
    "amount_tendered": 130.00,
    "change_given": 0.00,
    "status": "COMPLETED",
    "notes": "Walk-in customer",
    "created_by": "user_id_1",
    "created_by_name": "John Doe",
    "tenant_id": "tenant_123",
    "created_at": "2023-06-01T15:30:00.000Z",
    "items": [
      {
        "id": "pos_item_1",
        "product_id": "prod_1",
        "product_name": "Product A",
        "product_sku": "SKU-001",
        "quantity": 2,
        "unit_price": 49.99,
        "tax_rate": 8.5,
        "tax_amount": 8.50,
        "discount_percentage": 0,
        "discount_amount": 0.00,
        "line_total": 99.98
      },
      {
        "id": "pos_item_2",
        "product_id": "prod_4",
        "product_name": "Product D",
        "product_sku": "SKU-004",
        "quantity": 1,
        "unit_price": 19.99,
        "tax_rate": 8.5,
        "tax_amount": 1.70,
        "discount_percentage": 0,
        "discount_amount": 0.00,
        "line_total": 19.99
      }
    ],
    "receipt_url": "https://api.zettaz.com/receipts/POS-001.pdf",
    "invoice_id": "inv_pos_123"
  }
}
```

### Generate Invoice

```
POST /api/v1/sales/orders/:id/invoices
```

Generates a new invoice for a sales order.

#### Request Body

```json
{
  "items": [
    {
      "order_item_id": "item_5",
      "quantity": 5
    },
    {
      "order_item_id": "item_6",
      "quantity": 1
    }
  ],
  "notes": "Partial invoice for initial shipment"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "inv_2",
    "invoice_number": "INV-002",
    "order_id": "order_125",
    "order_number": "SO-003",
    "customer_id": "cust_789",
    "customer_name": "XYZ Ltd",
    "invoice_date": "2023-06-01T14:00:00.000Z",
    "due_date": "2023-06-16T00:00:00.000Z",
    "subtotal": 379.94,
    "tax_amount": 32.29,
    "shipping_cost": 25.00,
    "discount_amount": 0.00,
    "total_amount": 437.23,
    "amount_paid": 0.00,
    "balance_due": 437.23,
    "payment_status": "UNPAID",
    "notes": "Partial invoice for initial shipment",
    "created_by": "user_id_1",
    "created_by_name": "John Doe",
    "tenant_id": "tenant_123",
    "created_at": "2023-06-01T14:00:00.000Z",
    "items": [
      {
        "id": "inv_item_1",
        "order_item_id": "item_5",
        "product_id": "prod_1",
        "product_name": "Product A",
        "product_sku": "SKU-001",
        "quantity": 5,
        "unit_price": 49.99,
        "tax_rate": 8.5,
        "tax_amount": 21.25,
        "discount_percentage": 0,
        "discount_amount": 0.00,
        "line_total": 249.95
      },
      {
        "id": "inv_item_2",
        "order_item_id": "item_6",
        "product_id": "prod_3",
        "product_name": "Product C",
        "product_sku": "SKU-003",
        "quantity": 1,
        "unit_price": 129.99,
        "tax_rate": 8.5,
        "tax_amount": 11.05,
        "discount_percentage": 10,
        "discount_amount": 13.00,
        "line_total": 129.99
      }
    ],
    "pdf_url": "https://api.zettaz.com/invoices/INV-002.pdf"
  }
}
```

### Record Payment

```
POST /api/v1/sales/invoices/:id/payments
```

Records a payment against an invoice.

#### Request Body

```json
{
  "amount": 437.23,
  "payment_method": "BANK_TRANSFER",
  "payment_reference": "WIRE123456",
  "payment_date": "2023-06-05T10:00:00.000Z",
  "notes": "Payment received via wire transfer"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "payment_1",
    "invoice_id": "inv_2",
    "invoice_number": "INV-002",
    "order_id": "order_125",
    "order_number": "SO-003",
    "customer_id": "cust_789",
    "customer_name": "XYZ Ltd",
    "amount": 437.23,
    "payment_method": "BANK_TRANSFER",
    "payment_reference": "WIRE123456",
    "payment_date": "2023-06-05T10:00:00.000Z",
    "notes": "Payment received via wire transfer",
    "created_by": "user_id_1",
    "created_by_name": "John Doe",
    "tenant_id": "tenant_123",
    "created_at": "2023-06-05T10:15:00.000Z",
    "invoice_status": "PAID",
    "invoice_balance": 0.00,
    "order_payment_status": "PARTIAL",
    "order_balance": 65.04
  }
}
```

## Error Responses

### Not Found

```json
{
  "success": false,
  "error": {
    "message": "Sales order not found",
    "code": "NOT_FOUND"
  }
}
```

### Invalid Status Change

```json
{
  "success": false,
  "error": {
    "message": "Cannot change status from CANCELLED to CONFIRMED",
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
      "customer_id": "Customer is required",
      "items": "At least one item is required",
      "items[0].quantity": "Quantity must be greater than 0"
    }
  }
}
```

### Insufficient Inventory

```json
{
  "success": false,
  "error": {
    "message": "Insufficient inventory",
    "code": "INSUFFICIENT_INVENTORY",
    "details": {
      "product_id": "prod_1",
      "product_name": "Product A",
      "requested_quantity": 10,
      "available_quantity": 5
    }
  }
}
```

## Implementation Notes

### Multi-tenancy Considerations

All sales operations enforce tenant isolation:

```javascript
// Direct order query
const [orders] = await connection.query(
  'SELECT * FROM sales_orders WHERE tenant_id = ?',
  [tenant_id]
);

// Joined queries for order items
const [orderItems] = await connection.query(`
  SELECT oi.*, p.name as product_name, p.sku as product_sku 
  FROM sales_order_items oi
  JOIN sales_orders so ON oi.sales_order_id = so.id
  JOIN products p ON oi.product_id = p.id
  WHERE so.id = ? AND so.tenant_id = ?
`, [orderId, tenant_id]);
```

### Point of Sale (POS) Transactions

Point of Sale (POS) transactions are a specific type of sales transaction, typically characterized by immediate payment and inventory fulfillment at a physical location (e.g., a retail store). These are handled using the main sales order creation endpoint (`POST /api/v1/sales/orders`) by setting the `transaction_type` to `"POS"`.

#### Creating a POS Transaction

This endpoint allows for the creation of a new POS transaction.

```
POST /api/v1/sales/orders
```

##### Request Body

The request body is similar to a standard sales order but with specific considerations for POS:

*   `transaction_type`: Must be set to `"POS"`.
*   `status`: Typically set to `"COMPLETED"` or `"PAID"` as POS transactions are usually finalized immediately.
*   `customer_id`: Can be a specific customer or a generic "walk-in" customer ID.
*   `payments`: An array detailing the payment(s) received.
*   `register_id`: (Optional) Identifier for the POS register used.
*   `cashier_id`: (Optional) Identifier for the user (cashier) processing the transaction.

```json
{
  "tenant_id": "tenant_123",
  "customer_id": "cust_walk_in_001", // Or a specific customer ID
  "customer_name_override": "Cash Sale Customer", // Optional, if customer_id is generic
  "transaction_type": "POS",
  "status": "COMPLETED", // Or "PAID"
  "order_date": "2023-10-26T14:30:00.000Z", // Should be current timestamp
  "register_id": "REG01",
  "cashier_id": "user_789",
  "items": [
    {
      "product_id": "prod_A45",
      "quantity": 2,
      "unit_price": 19.99, // Price at the time of POS transaction
      "tax_rate": 8.25,
      "discount_percentage": 0
    },
    {
      "product_id": "prod_B12",
      "quantity": 1,
      "unit_price": 49.95,
      "tax_rate": 8.25,
      "discount_amount": 5.00 // Item-level discount
    }
  ],
  "payments": [
    {
      "payment_method": "CREDIT_CARD", // From predefined payment methods
      "amount": 75.00,
      "transaction_reference": "ch_1KGqY2Lkd...", // From payment gateway
      "payment_date": "2023-10-26T14:30:00.000Z"
    },
    {
      "payment_method": "CASH",
      "amount": 13.13, // Includes calculated change if applicable, or exact cash tendered
      "payment_date": "2023-10-26T14:30:00.000Z"
    }
  ],
  "notes": "POS transaction for walk-in customer.",
  "shipping_address_id": null, // Typically no shipping for POS
  "billing_address_id": null // Or linked to customer
}
```

##### Response (201 Created)

A successful POS transaction creation will return the details of the newly created sales order, marked as a POS type.

```json
{
  "success": true,
  "data": {
    "id": "order_pos_789",
    "order_number": "POS-00123", // System-generated POS transaction number
    "customer_id": "cust_walk_in_001",
    "status": "COMPLETED",
    "transaction_type": "POS",
    "order_date": "2023-10-26T14:30:00.000Z",
    "total_amount": 88.13,
    "amount_paid": 88.13,
    "balance_due": 0.00,
    "currency": "USD",
    "items": [
        // ... item details ...
    ],
    "payments": [
        // ... payment details ...
    ],
    "register_id": "REG01",
    "cashier_id": "user_789",
    "tenant_id": "tenant_123",
    "created_at": "2023-10-26T14:30:05.000Z",
    "updated_at": "2023-10-26T14:30:05.000Z"
  },
  "message": "POS transaction created successfully."
}
```

#### Key Considerations for POS Transactions

*   **Immediate Inventory Deduction**: As noted in the "Inventory Integration" section, items sold via POS transactions should result in immediate deduction from inventory stock levels.
*   **Payment Processing**: Multiple payment methods can be accepted for a single transaction. The `payments` array should detail each part of the payment. See "Payment Processing" for available methods.
*   **Receipt Generation**: The API response provides all necessary data to generate a customer receipt.
*   **Returns at POS**: Product returns for POS transactions can be handled by creating a new transaction with `transaction_type: "RETURN"` (or a specific `POS_RETURN` if defined), referencing the original POS transaction if possible, and including items being returned (often with negative quantities or a specific return price). This would typically result in a refund or store credit, detailed in the `payments` section of the return transaction.
*   **Discounts**: Discounts can be applied at the item level (`discount_amount` or `discount_percentage` in the `items` array) or at the overall transaction level (a `discount_total` field on the main order object, if supported).
*   **Session Management**: While not directly part of this specific endpoint, POS systems often involve register/shift opening and closing. API endpoints for managing POS sessions (e.g., `POST /api/v1/pos/sessions/open`, `POST /api/v1/pos/sessions/:id/close`) might exist separately to track cash flow and reconcile sales for a register or cashier. If these are part of the Sales API, they should be documented.

### Inventory Integration

Sales operations interact with inventory:

1. Order confirmation commits inventory
2. Order cancellation releases inventory commitments
3. POS transactions reduce inventory immediately
4. Returns increase inventory

### Payment Processing

The system supports multiple payment methods:

1. CREDIT_CARD
2. CASH
3. BANK_TRANSFER
4. CHECK
5. ONLINE_PAYMENT
6. STORE_CREDIT

### Transaction Types

Every sales transaction is recorded with a specific type:

1. SALES_ORDER: Standard sales order
2. POS: Point-of-sale transaction
3. RETURN: Product return
4. CREDIT_NOTE: Credit issued to customer
5. DEPOSIT: Advance payment
