# Payments API

This document details the endpoints for managing payments in the Zettaz Cloud Enterprise API.

## Overview

The Payments API provides endpoints for processing, tracking, and managing payment transactions within the system. This includes customer payments for sales orders/invoices, vendor payments for purchase orders, refunds, and payment method management.

## Endpoints

### List Payments

```
GET /api/v1/payments
```

Retrieves a paginated list of payments.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20, max: 100) |
| sort | string | Field to sort by (default: 'payment_date') |
| order | string | Sort order ('asc' or 'desc', default: 'desc') |
| start_date | string | Filter by payment date range start (ISO format) |
| end_date | string | Filter by payment date range end (ISO format) |
| payment_type | string | Filter by payment type ('CUSTOMER', 'VENDOR') |
| payment_method | string | Filter by payment method ('CASH', 'CREDIT_CARD', 'BANK_TRANSFER', etc.) |
| status | string | Filter by status ('COMPLETED', 'PENDING', 'FAILED', 'REFUNDED', 'VOIDED') |
| reference_type | string | Filter by reference type ('SALES_ORDER', 'PURCHASE_ORDER', 'INVOICE') |
| reference_id | string | Filter by reference ID (sales order ID, purchase order ID, invoice ID) |
| entity_id | string | Filter by entity ID (customer ID or vendor ID) |
| payment_ref | string | Search by payment reference number |
| amount_min | number | Filter by minimum payment amount |
| amount_max | number | Filter by maximum payment amount |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "pay_123456",
      "payment_date": "2023-05-15T14:30:00.000Z",
      "payment_type": "CUSTOMER",
      "payment_method": "CREDIT_CARD",
      "amount": 1299.99,
      "currency": "USD",
      "status": "COMPLETED",
      "reference_type": "INVOICE",
      "reference_id": "inv_7890",
      "reference_number": "INV-20230515-001",
      "entity_id": "cust_12345",
      "entity_name": "Acme Corporation",
      "payment_reference": "TXN48765432",
      "created_by": "user_123",
      "created_by_name": "John Doe",
      "created_at": "2023-05-15T14:30:00.000Z",
      "updated_at": "2023-05-15T14:30:00.000Z"
    },
    {
      "id": "pay_123457",
      "payment_date": "2023-05-14T11:15:00.000Z",
      "payment_type": "VENDOR",
      "payment_method": "BANK_TRANSFER",
      "amount": 5680.75,
      "currency": "USD",
      "status": "COMPLETED",
      "reference_type": "PURCHASE_ORDER",
      "reference_id": "po_4567",
      "reference_number": "PO-20230510-003",
      "entity_id": "ven_789",
      "entity_name": "ABC Suppliers Inc.",
      "payment_reference": "WIRE98765432",
      "created_by": "user_123",
      "created_by_name": "John Doe",
      "created_at": "2023-05-14T11:15:00.000Z",
      "updated_at": "2023-05-14T11:15:00.000Z"
    },
    // Additional payments...
  ],
  "pagination": {
    "totalItems": 253,
    "totalPages": 13,
    "currentPage": 1,
    "pageSize": 20,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

### Get Payment Details

```
GET /api/v1/payments/:id
```

Retrieves detailed information for a specific payment.

#### Response

```json
{
  "success": true,
  "data": {
    "id": "pay_123456",
    "payment_date": "2023-05-15T14:30:00.000Z",
    "payment_type": "CUSTOMER",
    "payment_method": "CREDIT_CARD",
    "payment_method_details": {
      "card_type": "VISA",
      "last_four": "4242",
      "expiry_month": "12",
      "expiry_year": "2025",
      "cardholder_name": "John Smith"
    },
    "amount": 1299.99,
    "currency": "USD",
    "status": "COMPLETED",
    "reference_type": "INVOICE",
    "reference_id": "inv_7890",
    "reference_number": "INV-20230515-001",
    "entity_id": "cust_12345",
    "entity_name": "Acme Corporation",
    "entity_type": "CUSTOMER",
    "payment_reference": "TXN48765432",
    "gateway": "STRIPE",
    "gateway_transaction_id": "ch_1NhT5ZGswietty38Qr4rT9Yf",
    "notes": "Payment for May order",
    "metadata": {
      "tax_amount": 118.18,
      "shipping_amount": 25.00
    },
    "items": [
      {
        "invoice_id": "inv_7890",
        "invoice_number": "INV-20230515-001",
        "amount_applied": 1299.99,
        "original_amount": 1299.99,
        "balance_after": 0
      }
    ],
    "refund_status": null,
    "refunded_amount": 0,
    "created_by": "user_123",
    "created_by_name": "John Doe",
    "tenant_id": "tenant_123",
    "created_at": "2023-05-15T14:30:00.000Z",
    "updated_at": "2023-05-15T14:30:00.000Z"
  }
}
```

### Record Customer Payment

```
POST /api/v1/payments/customer
```

Records a payment received from a customer.

#### Request Body

```json
{
  "customer_id": "cust_12345",
  "payment_date": "2023-05-15T14:30:00.000Z",
  "payment_method": "CREDIT_CARD",
  "payment_method_details": {
    "card_type": "VISA",
    "last_four": "4242",
    "expiry_month": "12",
    "expiry_year": "2025",
    "cardholder_name": "John Smith"
  },
  "amount": 1299.99,
  "currency": "USD",
  "payment_reference": "TXN48765432",
  "gateway": "STRIPE",
  "gateway_transaction_id": "ch_1NhT5ZGswietty38Qr4rT9Yf",
  "notes": "Payment for May order",
  "items": [
    {
      "invoice_id": "inv_7890",
      "amount_applied": 1299.99
    }
  ],
  "metadata": {
    "tax_amount": 118.18,
    "shipping_amount": 25.00
  }
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "pay_123456",
    "payment_date": "2023-05-15T14:30:00.000Z",
    "payment_type": "CUSTOMER",
    "payment_method": "CREDIT_CARD",
    "amount": 1299.99,
    "currency": "USD",
    "status": "COMPLETED",
    "reference_type": "INVOICE",
    "reference_id": "inv_7890",
    "reference_number": "INV-20230515-001",
    "entity_id": "cust_12345",
    "entity_name": "Acme Corporation",
    "payment_reference": "TXN48765432",
    "gateway": "STRIPE",
    "gateway_transaction_id": "ch_1NhT5ZGswietty38Qr4rT9Yf",
    "notes": "Payment for May order",
    "items": [
      {
        "invoice_id": "inv_7890",
        "invoice_number": "INV-20230515-001",
        "amount_applied": 1299.99,
        "original_amount": 1299.99,
        "balance_after": 0
      }
    ],
    "created_by": "user_123",
    "created_by_name": "John Doe",
    "tenant_id": "tenant_123",
    "created_at": "2023-05-15T14:30:00.000Z",
    "updated_at": "2023-05-15T14:30:00.000Z"
  }
}
```

### Record Vendor Payment

```
POST /api/v1/payments/vendor
```

Records a payment made to a vendor.

#### Request Body

```json
{
  "vendor_id": "ven_789",
  "payment_date": "2023-05-14T11:15:00.000Z",
  "payment_method": "BANK_TRANSFER",
  "amount": 5680.75,
  "currency": "USD",
  "payment_reference": "WIRE98765432",
  "notes": "Payment for PO-20230510-003",
  "items": [
    {
      "purchase_order_id": "po_4567",
      "amount_applied": 5680.75
    }
  ]
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "pay_123457",
    "payment_date": "2023-05-14T11:15:00.000Z",
    "payment_type": "VENDOR",
    "payment_method": "BANK_TRANSFER",
    "amount": 5680.75,
    "currency": "USD",
    "status": "COMPLETED",
    "reference_type": "PURCHASE_ORDER",
    "reference_id": "po_4567",
    "reference_number": "PO-20230510-003",
    "entity_id": "ven_789",
    "entity_name": "ABC Suppliers Inc.",
    "payment_reference": "WIRE98765432",
    "notes": "Payment for PO-20230510-003",
    "items": [
      {
        "purchase_order_id": "po_4567",
        "purchase_order_number": "PO-20230510-003",
        "amount_applied": 5680.75,
        "original_amount": 5680.75,
        "balance_after": 0
      }
    ],
    "created_by": "user_123",
    "created_by_name": "John Doe",
    "tenant_id": "tenant_123",
    "created_at": "2023-05-14T11:15:00.000Z",
    "updated_at": "2023-05-14T11:15:00.000Z"
  }
}
```

### Process Payment with Gateway

```
POST /api/v1/payments/process
```

Processes a payment through an integrated payment gateway.

#### Request Body

```json
{
  "customer_id": "cust_12345",
  "invoice_id": "inv_7890",
  "amount": 1299.99,
  "currency": "USD",
  "payment_method": "CREDIT_CARD",
  "payment_token": "tok_visa_4242424242424242",
  "billing_address": {
    "line1": "123 Main St",
    "line2": "Suite 500",
    "city": "San Francisco",
    "state": "CA",
    "postal_code": "94103",
    "country": "US"
  },
  "save_payment_method": true,
  "notes": "Payment for May order"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "pay_123456",
    "payment_date": "2023-05-15T14:30:00.000Z",
    "payment_type": "CUSTOMER",
    "payment_method": "CREDIT_CARD",
    "payment_method_details": {
      "card_type": "VISA",
      "last_four": "4242",
      "expiry_month": "12",
      "expiry_year": "2025",
      "cardholder_name": "John Smith"
    },
    "amount": 1299.99,
    "currency": "USD",
    "status": "COMPLETED",
    "reference_type": "INVOICE",
    "reference_id": "inv_7890",
    "reference_number": "INV-20230515-001",
    "entity_id": "cust_12345",
    "entity_name": "Acme Corporation",
    "payment_reference": "TXN48765432",
    "gateway": "STRIPE",
    "gateway_transaction_id": "ch_1NhT5ZGswietty38Qr4rT9Yf",
    "saved_payment_method_id": "pm_98765432",
    "notes": "Payment for May order",
    "items": [
      {
        "invoice_id": "inv_7890",
        "invoice_number": "INV-20230515-001",
        "amount_applied": 1299.99,
        "original_amount": 1299.99,
        "balance_after": 0
      }
    ],
    "created_by": "user_123",
    "created_by_name": "John Doe",
    "tenant_id": "tenant_123",
    "created_at": "2023-05-15T14:30:00.000Z",
    "updated_at": "2023-05-15T14:30:00.000Z"
  }
}
```

### Create Payment Link

```
POST /api/v1/payments/link
```

Creates a payment link that can be sent to a customer.

#### Request Body

```json
{
  "customer_id": "cust_12345",
  "invoice_id": "inv_7890",
  "amount": 1299.99,
  "currency": "USD",
  "description": "Payment for Invoice INV-20230515-001",
  "expiry_date": "2023-05-30T23:59:59.000Z",
  "notify_customer": true,
  "notification_email": "accounting@acmecorp.com",
  "notification_template": "PAYMENT_LINK",
  "return_url": "https://portal.zettaz.com/payments/confirmation"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "paylink_234567",
    "payment_link": "https://pay.zettaz.com/p/234567abc",
    "customer_id": "cust_12345",
    "invoice_id": "inv_7890",
    "amount": 1299.99,
    "currency": "USD",
    "description": "Payment for Invoice INV-20230515-001",
    "status": "ACTIVE",
    "expiry_date": "2023-05-30T23:59:59.000Z",
    "notification_sent": true,
    "notification_email": "accounting@acmecorp.com",
    "return_url": "https://portal.zettaz.com/payments/confirmation",
    "created_by": "user_123",
    "created_by_name": "John Doe",
    "tenant_id": "tenant_123",
    "created_at": "2023-05-15T16:30:00.000Z",
    "updated_at": "2023-05-15T16:30:00.000Z"
  }
}
```

### Process Refund

```
POST /api/v1/payments/:id/refund
```

Processes a refund for a payment.

#### Request Body

```json
{
  "amount": 1299.99,
  "reason": "Customer request",
  "refund_method": "ORIGINAL_METHOD",
  "notes": "Customer no longer needs the product"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "ref_345678",
    "payment_id": "pay_123456",
    "refund_date": "2023-05-16T10:45:00.000Z",
    "amount": 1299.99,
    "reason": "Customer request",
    "refund_method": "ORIGINAL_METHOD",
    "refund_method_details": {
      "card_type": "VISA",
      "last_four": "4242"
    },
    "status": "COMPLETED",
    "gateway": "STRIPE",
    "gateway_refund_id": "re_1NhT5ZGswietty38Qr4rT9Yf",
    "notes": "Customer no longer needs the product",
    "created_by": "user_123",
    "created_by_name": "John Doe",
    "tenant_id": "tenant_123",
    "created_at": "2023-05-16T10:45:00.000Z",
    "updated_at": "2023-05-16T10:45:00.000Z"
  }
}
```

### Void Payment

```
POST /api/v1/payments/:id/void
```

Voids a payment that has not yet been settled.

#### Request Body

```json
{
  "reason": "Duplicate payment",
  "notes": "Customer accidentally submitted payment twice"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "pay_123458",
    "status": "VOIDED",
    "void_reason": "Duplicate payment",
    "void_date": "2023-05-16T11:30:00.000Z",
    "notes": "Customer accidentally submitted payment twice",
    "updated_by": "user_123",
    "updated_by_name": "John Doe",
    "updated_at": "2023-05-16T11:30:00.000Z"
  }
}
```

### Get Customer Payment Methods

```
GET /api/v1/payments/methods/customer/:customer_id
```

Retrieves saved payment methods for a specific customer.

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "pm_98765432",
      "customer_id": "cust_12345",
      "type": "CREDIT_CARD",
      "details": {
        "card_type": "VISA",
        "last_four": "4242",
        "expiry_month": "12",
        "expiry_year": "2025",
        "cardholder_name": "John Smith"
      },
      "billing_address": {
        "line1": "123 Main St",
        "line2": "Suite 500",
        "city": "San Francisco",
        "state": "CA",
        "postal_code": "94103",
        "country": "US"
      },
      "gateway": "STRIPE",
      "gateway_payment_method_id": "pm_1NhT5ZGswietty38Qr4rT9Yf",
      "is_default": true,
      "created_at": "2023-05-15T14:30:00.000Z",
      "updated_at": "2023-05-15T14:30:00.000Z"
    },
    {
      "id": "pm_98765433",
      "customer_id": "cust_12345",
      "type": "BANK_ACCOUNT",
      "details": {
        "account_type": "CHECKING",
        "last_four": "6789",
        "bank_name": "National Bank",
        "account_holder_name": "John Smith"
      },
      "gateway": "STRIPE",
      "gateway_payment_method_id": "ba_1NhT5ZGswietty38Qr4rT9Yf",
      "is_default": false,
      "created_at": "2023-05-10T11:15:00.000Z",
      "updated_at": "2023-05-10T11:15:00.000Z"
    }
  ]
}
```

### Set Default Payment Method

```
PUT /api/v1/payments/methods/:method_id/default
```

Sets a saved payment method as the default for a customer.

#### Response

```json
{
  "success": true,
  "data": {
    "id": "pm_98765433",
    "customer_id": "cust_12345",
    "is_default": true,
    "updated_at": "2023-05-16T12:15:00.000Z"
  }
}
```

### Delete Payment Method

```
DELETE /api/v1/payments/methods/:method_id
```

Deletes a saved payment method.

#### Response

```json
{
  "success": true,
  "data": {
    "message": "Payment method deleted successfully"
  }
}
```

### Get Payment Statistics

```
GET /api/v1/payments/statistics
```

Retrieves payment statistics and summaries.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| start_date | string | Start date for statistics (ISO format) |
| end_date | string | End date for statistics (ISO format) |
| payment_type | string | Filter by payment type ('CUSTOMER', 'VENDOR') |
| group_by | string | Group results by ('day', 'week', 'month') |

#### Response

```json
{
  "success": true,
  "data": {
    "summary": {
      "total_amount": 156789.45,
      "total_count": 235,
      "average_amount": 667.19,
      "by_status": {
        "COMPLETED": {
          "amount": 152345.67,
          "count": 220
        },
        "PENDING": {
          "amount": 3500.78,
          "count": 10
        },
        "FAILED": {
          "amount": 943.00,
          "count": 5
        }
      },
      "by_payment_method": {
        "CREDIT_CARD": {
          "amount": 98765.43,
          "count": 150
        },
        "BANK_TRANSFER": {
          "amount": 45678.90,
          "count": 60
        },
        "CASH": {
          "amount": 12345.12,
          "count": 25
        }
      }
    },
    "time_series": [
      {
        "period": "2023-05-01",
        "amount": 23456.78,
        "count": 35
      },
      {
        "period": "2023-05-08",
        "amount": 34567.89,
        "count": 50
      },
      {
        "period": "2023-05-15",
        "amount": 45678.90,
        "count": 65
      },
      {
        "period": "2023-05-22",
        "amount": 53085.88,
        "count": 85
      }
    ]
  }
}
```

## Error Responses

### Not Found

```json
{
  "success": false,
  "error": {
    "message": "Payment not found",
    "code": "NOT_FOUND"
  }
}
```

### Payment Gateway Error

```json
{
  "success": false,
  "error": {
    "message": "Payment gateway error",
    "code": "GATEWAY_ERROR",
    "details": {
      "gateway_error_code": "insufficient_funds",
      "gateway_message": "The card has insufficient funds to complete the purchase"
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
      "amount": "Amount must be greater than zero",
      "customer_id": "Customer not found",
      "payment_method": "Invalid payment method"
    }
  }
}
```

### Refund Error

```json
{
  "success": false,
  "error": {
    "message": "Refund failed",
    "code": "REFUND_ERROR",
    "details": {
      "reason": "Payment already refunded",
      "amount": "Refund amount exceeds original payment amount"
    }
  }
}
```

## Implementation Notes

### Multi-tenancy Considerations

All payment operations enforce tenant isolation:

```javascript
// Direct payment query
const [payments] = await connection.query(
  'SELECT * FROM payments WHERE tenant_id = ?',
  [tenant_id]
);

// Joined queries for payment data
const [paymentDetails] = await connection.query(`
  SELECT p.*, c.name as entity_name 
  FROM payments p
  LEFT JOIN customers c ON p.entity_id = c.id AND p.entity_type = 'CUSTOMER'
  WHERE p.id = ? AND p.tenant_id = ?
`, [paymentId, tenant_id]);
```

### Payment Processing Flow

The standard payment processing flow includes:

1. **Validation** - Verify payment data, available balance, and authorization
2. **Gateway Processing** - Send payment request to payment gateway
3. **Recording** - Store payment details in the database
4. **Invoice/Order Update** - Update related invoice or order statuses
5. **Notification** - Send confirmation emails or notifications
6. **Accounting Entry** - Create appropriate accounting entries

### Transaction Management

All payment operations use database transactions to ensure data consistency:

```javascript
const connection = await getConnection();
try {
  await connection.beginTransaction();
  
  // Process payment
  const [result] = await connection.query(
    'INSERT INTO payments (customer_id, amount, ...) VALUES (?, ?, ...)',
    [customerId, amount, ...]
  );
  
  // Update invoice status
  await connection.query(
    'UPDATE invoices SET status = ?, balance = balance - ? WHERE id = ? AND tenant_id = ?',
    ['PAID', amount, invoiceId, tenant_id]
  );
  
  // Create accounting entries
  await createAccountingEntries(connection, paymentId, tenant_id);
  
  await connection.commit();
  return result;
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
}
```

### Payment Reconciliation

The system supports reconciliation of payments through:

1. Unique transaction IDs for each payment
2. Payment references for manual matching
3. Gateway transaction IDs for automated reconciliation
4. Status tracking for each payment
5. Detailed audit logs for all payment activities

### Payment Gateway Integration

The system integrates with multiple payment gateways:

1. **Stripe** - For credit card and ACH payments
2. **PayPal** - For online payments and invoicing
3. **Square** - For in-person payments
4. **Authorize.Net** - For traditional credit card processing
5. **Custom Gateway** - For client-specific payment processors

Integration is done through a provider pattern that abstracts gateway-specific details:

```javascript
const processPayment = async (paymentData, gateway) => {
  const gatewayProvider = getGatewayProvider(gateway);
  return await gatewayProvider.processPayment(paymentData);
};

const refundPayment = async (paymentId, refundData, gateway) => {
  const gatewayProvider = getGatewayProvider(gateway);
  return await gatewayProvider.refundPayment(paymentId, refundData);
};
```

### Security Considerations

Payment processing includes several security measures:

1. **PCI Compliance** - Tokenization of payment information
2. **Data Encryption** - Encryption of sensitive payment details
3. **Role-Based Access** - Restricted access to payment processing functions
4. **Audit Logging** - Comprehensive logging of all payment actions
5. **Fraud Detection** - Basic checks for suspicious payment patterns

### Scheduled Payments

The system supports scheduled and recurring payments:

1. **Automated Billing** - For subscription services
2. **Payment Plans** - For installment payments
3. **Recurring Invoices** - For regular billing cycles
4. **Automated Reminders** - For upcoming and overdue payments
5. **Preauthorization** - For future scheduled payments

### Partial Payments

Invoices and orders can receive partial payments:

1. Payments are applied to invoices/orders and tracked individually
2. The system maintains remaining balance on invoices/orders
3. Multiple payments can be applied to a single invoice/order
4. Payment allocation rules determine how payments are applied
5. Payment history is maintained for audit and tracking purposes
