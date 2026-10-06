# Financials & Accounting API

This document details the endpoints for managing financial data and accounting processes in the Zettaz Cloud Enterprise API.

## Overview

The Financials & Accounting API provides a comprehensive suite of endpoints for managing the chart of accounts, recording journal entries, handling accounts payable and receivable, generating financial statements, and managing fiscal periods. It ensures data integrity, supports multi-currency transactions, and integrates with other modules like Sales, Purchases, and Inventory.

## Endpoints

### 1. Chart of Accounts (COA)

#### List Accounts

```
GET /api/v1/financials/accounts
```

Retrieves a list of all accounts in the Chart of Accounts.

##### Query Parameters

| Parameter     | Type    | Description                                                                                                |
|---------------|---------|------------------------------------------------------------------------------------------------------------|
| page          | number  | Page number (default: 1)                                                                                   |
| limit         | number  | Items per page (default: 20, max: 100)                                                                     |
| sort          | string  | Field to sort by (default: 'account_code')                                                                 |
| order         | string  | Sort order ('asc' or 'desc', default: 'asc')                                                               |
| account_type  | string  | Filter by account type (e.g., 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE') (optional)             |
| account_class | string  | Filter by account class (e.g., 'CURRENT_ASSET', 'NON_CURRENT_ASSET', 'COST_OF_GOODS_SOLD') (optional)      |
| status        | string  | Filter by account status ('ACTIVE', 'INACTIVE') (optional)                                                 |
| search        | string  | Search by account code or name (optional)                                                                  |
| parent_id     | string  | Filter by parent account ID to get child accounts (optional)                                               |
| include_balance| boolean| Whether to include current balance for each account (default: false, can be performance intensive)       |

##### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "acc_123",
      "account_code": "1010",
      "account_name": "Cash on Hand",
      "account_type": "ASSET",
      "account_class": "CURRENT_ASSET",
      "description": "Physical cash held by the company",
      "currency": "USD",
      "status": "ACTIVE",
      "is_control_account": false,
      "allow_manual_entries": true,
      "parent_id": "acc_parent_1000",
      "level": 2,
      "balance": 15250.75, // if include_balance=true
      "created_at": "2023-01-10T09:00:00.000Z",
      "updated_at": "2023-04-15T11:30:00.000Z"
    },
    {
      "id": "acc_124",
      "account_code": "4010",
      "account_name": "Product Sales Revenue",
      "account_type": "REVENUE",
      "account_class": "OPERATING_REVENUE",
      "description": "Revenue generated from product sales",
      "currency": "USD",
      "status": "ACTIVE",
      "is_control_account": true,
      "allow_manual_entries": false,
      "parent_id": null,
      "level": 1,
      "balance": 125670.50, // if include_balance=true
      "created_at": "2023-01-10T09:05:00.000Z",
      "updated_at": "2023-05-01T10:00:00.000Z"
    }
    // Additional accounts...
  ],
  "pagination": {
    "totalItems": 150,
    "totalPages": 8,
    "currentPage": 1,
    "pageSize": 20
  }
}
```

#### Get Account Details

```
GET /api/v1/financials/accounts/:id
```

Retrieves detailed information for a specific account.

##### Response

```json
{
  "success": true,
  "data": {
    "id": "acc_123",
    "account_code": "1010",
    "account_name": "Cash on Hand",
    "account_type": "ASSET",
    "account_class": "CURRENT_ASSET",
    "description": "Physical cash held by the company",
    "currency": "USD",
    "status": "ACTIVE",
    "is_control_account": false,
    "allow_manual_entries": true,
    "parent_id": "acc_parent_1000",
    "level": 2,
    "current_balance": 15250.75,
    "opening_balance": 10000.00,
    "opening_balance_date": "2023-01-01T00:00:00.000Z",
    "created_by": "user_admin",
    "created_at": "2023-01-10T09:00:00.000Z",
    "updated_at": "2023-04-15T11:30:00.000Z"
  }
}
```

#### Create Account

```
POST /api/v1/financials/accounts
```

Creates a new account in the Chart of Accounts.

##### Request Body

```json
{
  "account_code": "1011",
  "account_name": "Petty Cash",
  "account_type": "ASSET",
  "account_class": "CURRENT_ASSET",
  "description": "Small amount of discretionary cash",
  "currency": "USD",
  "status": "ACTIVE",
  "is_control_account": false,
  "allow_manual_entries": true,
  "parent_id": "acc_123",
  "opening_balance": 500.00,
  "opening_balance_date": "2023-06-01T00:00:00.000Z"
}
```

##### Response

```json
{
  "success": true,
  "data": {
    "id": "acc_125",
    "account_code": "1011",
    "account_name": "Petty Cash",
    // ... other fields ...
    "created_at": "2023-06-02T10:00:00.000Z",
    "updated_at": "2023-06-02T10:00:00.000Z"
  }
}
```

#### Update Account

```
PUT /api/v1/financials/accounts/:id
```

Updates an existing account.

##### Request Body

```json
{
  "account_name": "Petty Cash Fund",
  "description": "Small amount of discretionary cash for minor expenses",
  "status": "ACTIVE",
  "allow_manual_entries": false // Example change
}
```

##### Response

```json
{
  "success": true,
  "data": {
    "id": "acc_125",
    "account_name": "Petty Cash Fund",
    // ... other fields ...
    "updated_at": "2023-06-02T11:00:00.000Z"
  }
}
```

#### Delete Account

```
DELETE /api/v1/financials/accounts/:id
```

Deletes an account (typically marks as inactive if it has transactions).

##### Response

```json
{
  "success": true,
  "data": {
    "message": "Account 'acc_125' marked as inactive."
    // or "Account 'acc_125' deleted successfully." if no transactions
  }
}
```

### 2. Journal Entries

#### List Journal Entries

```
GET /api/v1/financials/journal-entries
```

Retrieves a list of journal entries.

##### Query Parameters

| Parameter     | Type   | Description                                                                                                |
|---------------|--------|------------------------------------------------------------------------------------------------------------|
| page          | number | Page number (default: 1)                                                                                   |
| limit         | number | Items per page (default: 20, max: 100)                                                                     |
| sort          | string | Field to sort by (default: 'entry_date')                                                                   |
| order         | string | Sort order ('asc' or 'desc', default: 'desc')                                                              |
| start_date    | string | Filter by entry date range start (ISO format)                                                              |
| end_date      | string | Filter by entry date range end (ISO format)                                                                |
| status        | string | Filter by status ('DRAFT', 'POSTED', 'VOIDED') (optional)                                                  |
| reference_type| string | Filter by reference type (e.g., 'SALES_INVOICE', 'PURCHASE_BILL', 'MANUAL') (optional)                    |
| reference_id  | string | Filter by reference ID (e.g., invoice ID, bill ID) (optional)                                              |
| created_by    | string | Filter by user ID who created the entry (optional)                                                         |

##### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "je_789",
      "entry_number": "JE-202305-001",
      "entry_date": "2023-05-15T00:00:00.000Z",
      "description": "To record May sales revenue",
      "status": "POSTED",
      "total_debit": 125670.50,
      "total_credit": 125670.50,
      "currency": "USD",
      "reference_type": "SALES_SUMMARY",
      "posted_by": "user_accountant",
      "posted_at": "2023-05-16T09:00:00.000Z",
      "created_by": "system_batch_process",
      "created_at": "2023-05-16T08:00:00.000Z",
      "updated_at": "2023-05-16T09:00:00.000Z"
    }
    // Additional journal entries...
  ],
  "pagination": {
    "totalItems": 85,
    "totalPages": 5,
    "currentPage": 1,
    "pageSize": 20
  }
}
```

#### Get Journal Entry Details

```
GET /api/v1/financials/journal-entries/:id
```

Retrieves detailed information for a specific journal entry, including its lines.

##### Response

```json
{
  "success": true,
  "data": {
    "id": "je_789",
    "entry_number": "JE-202305-001",
    "entry_date": "2023-05-15T00:00:00.000Z",
    "description": "To record May sales revenue",
    "status": "POSTED",
    "total_debit": 125670.50,
    "total_credit": 125670.50,
    "currency": "USD",
    "reference_type": "SALES_SUMMARY",
    "reference_id": "SALES-MAY-2023",
    "notes": "Monthly sales revenue posting from automated sales module.",
    "posted_by": "user_accountant",
    "posted_at": "2023-05-16T09:00:00.000Z",
    "created_by": "system_batch_process",
    "created_at": "2023-05-16T08:00:00.000Z",
    "updated_at": "2023-05-16T09:00:00.000Z",
    "lines": [
      {
        "id": "jel_1001",
        "account_id": "acc_ar_control", // Accounts Receivable Control
        "account_code": "1200",
        "account_name": "Accounts Receivable",
        "debit_amount": 125670.50,
        "credit_amount": 0.00,
        "description": "May sales on account"
      },
      {
        "id": "jel_1002",
        "account_id": "acc_sales_rev", // Sales Revenue
        "account_code": "4010",
        "account_name": "Product Sales Revenue",
        "debit_amount": 0.00,
        "credit_amount": 115670.50,
        "description": "May product sales"
      },
      {
        "id": "jel_1003",
        "account_id": "acc_sales_tax", // Sales Tax Payable
        "account_code": "2210",
        "account_name": "Sales Tax Payable",
        "debit_amount": 0.00,
        "credit_amount": 10000.00,
        "description": "May sales tax collected"
      }
    ]
  }
}
```

#### Create Journal Entry

```
POST /api/v1/financials/journal-entries
```

Creates a new journal entry.

##### Request Body

```json
{
  "entry_date": "2023-06-02T00:00:00.000Z",
  "description": "To record office supplies purchase",
  "currency": "USD",
  "reference_type": "MANUAL_ENTRY",
  "notes": "Purchased stationery and printer ink.",
  "lines": [
    {
      "account_id": "acc_office_supplies_exp", // Office Supplies Expense
      "debit_amount": 150.00,
      "credit_amount": 0.00,
      "description": "Stationery and ink"
    },
    {
      "account_id": "acc_cash_on_hand", // Cash on Hand
      "debit_amount": 0.00,
      "credit_amount": 150.00,
      "description": "Paid from petty cash"
    }
  ]
}
```

##### Response

```json
{
  "success": true,
  "data": {
    "id": "je_790",
    "entry_number": "JE-202306-001", // System-generated
    "status": "DRAFT", // New entries are typically drafts until posted
    "total_debit": 150.00,
    "total_credit": 150.00,
    // ... other fields and lines ...
    "created_at": "2023-06-02T14:00:00.000Z"
  }
}
```

#### Update Journal Entry

```
PUT /api/v1/financials/journal-entries/:id
```

Updates an existing journal entry (only if in 'DRAFT' status).

##### Request Body

(Similar to create, but with potentially modified fields or lines)

```json
{
  "description": "To record office supplies and coffee purchase",
  "notes": "Purchased stationery, printer ink, and coffee for the office.",
  "lines": [
    {
      "id": "jel_existing_1", // ID for existing line to update
      "account_id": "acc_office_supplies_exp",
      "debit_amount": 175.00, // Updated amount
      "credit_amount": 0.00,
      "description": "Stationery, ink, and coffee"
    },
    {
      "id": "jel_existing_2",
      "account_id": "acc_cash_on_hand",
      "debit_amount": 0.00,
      "credit_amount": 175.00,
      "description": "Paid from petty cash"
    }
    // Can also include new lines without an 'id'
  ]
}
```

##### Response

```json
{
  "success": true,
  "data": {
    "id": "je_790",
    "status": "DRAFT",
    "total_debit": 175.00,
    "total_credit": 175.00,
    // ... other fields ...
    "updated_at": "2023-06-02T15:00:00.000Z"
  }
}
```

#### Post Journal Entry

```
POST /api/v1/financials/journal-entries/:id/post
```

Posts a journal entry, making it official and updating account balances.

##### Request Body (Optional)

```json
{
  "posting_date": "2023-06-02T00:00:00.000Z" // Optional, defaults to entry_date or current date
}
```

##### Response

```json
{
  "success": true,
  "data": {
    "id": "je_790",
    "status": "POSTED",
    "posted_by": "user_current_accountant",
    "posted_at": "2023-06-02T16:00:00.000Z",
    "updated_at": "2023-06-02T16:00:00.000Z"
  }
}
```

#### Void Journal Entry

```
POST /api/v1/financials/journal-entries/:id/void
```

Voids a posted journal entry. This typically creates a reversing entry.

##### Request Body

```json
{
  "void_reason": "Incorrect entry, duplicated transaction.",
  "void_date": "2023-06-03T00:00:00.000Z" // Date for the reversing entry
}
```

##### Response

```json
{
  "success": true,
  "data": {
    "original_entry_id": "je_790",
    "status": "VOIDED",
    "reversing_entry_id": "je_791", // ID of the new reversing journal entry
    "message": "Journal entry voided successfully. Reversing entry JE-791 created."
  }
}
```

### 3. Accounts Payable (AP)

Manages supplier bills, payments, and vendor credits.

#### List Bills

```
GET /api/v1/financials/ap/bills
```

Retrieves a list of supplier bills.

##### Query Parameters

| Parameter     | Type   | Description                                                                                                |
|---------------|--------|------------------------------------------------------------------------------------------------------------|
| page          | number | Page number (default: 1)                                                                                   |
| limit         | number | Items per page (default: 20, max: 100)                                                                     |
| sort          | string | Field to sort by (default: 'due_date')                                                                     |
| order         | string | Sort order ('asc' or 'desc', default: 'asc')                                                               |
| supplier_id   | string | Filter by supplier ID (optional)                                                                           |
| status        | string | Filter by bill status ('DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_PAID', 'PAID', 'VOIDED') (optional)     |
| due_date_from | string | Filter by due date range start (ISO format) (optional)                                                     |
| due_date_to   | string | Filter by due date range end (ISO format) (optional)                                                       |
| bill_number   | string | Search by bill number (optional)                                                                           |

##### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "bill_101",
      "bill_number": "INV-SUP-00123",
      "supplier_id": "sup_567",
      "supplier_name": "Office Supplies Inc.",
      "bill_date": "2023-05-20T00:00:00.000Z",
      "due_date": "2023-06-19T00:00:00.000Z",
      "total_amount": 250.00,
      "amount_due": 100.00,
      "currency": "USD",
      "status": "PARTIALLY_PAID",
      "purchase_order_id": "po_999",
      "created_at": "2023-05-20T10:00:00.000Z",
      "updated_at": "2023-05-28T11:00:00.000Z"
    }
    // Additional bills...
  ],
  "pagination": {
    "totalItems": 45,
    "totalPages": 3,
    "currentPage": 1,
    "pageSize": 20
  }
}
```

#### Get Bill Details

```
GET /api/v1/financials/ap/bills/:id
```

Retrieves detailed information for a specific bill, including line items.

##### Response

```json
{
  "success": true,
  "data": {
    "id": "bill_101",
    "bill_number": "INV-SUP-00123",
    "supplier_id": "sup_567",
    "supplier_name": "Office Supplies Inc.",
    "bill_date": "2023-05-20T00:00:00.000Z",
    "due_date": "2023-06-19T00:00:00.000Z",
    "terms": "Net 30",
    "total_amount": 250.00,
    "amount_paid": 150.00,
    "amount_due": 100.00,
    "currency": "USD",
    "status": "PARTIALLY_PAID",
    "purchase_order_id": "po_999",
    "notes": "Partial payment made on 2023-05-28.",
    "attachments": [
      {"file_id": "file_abc", "file_name": "supplier_invoice.pdf"}
    ],
    "lines": [
      {
        "id": "bill_line_1",
        "product_id": "prod_office_paper",
        "description": "A4 Printer Paper Ream",
        "quantity": 10,
        "unit_price": 5.00,
        "tax_rate": 0.08,
        "line_total": 54.00,
        "account_id": "acc_cogs_supplies" // Expense account
      },
      {
        "id": "bill_line_2",
        "description": "Shipping Charges",
        "quantity": 1,
        "unit_price": 10.00,
        "tax_rate": 0.00,
        "line_total": 10.00,
        "account_id": "acc_shipping_exp"
      }
    ],
    "payments": [
      {
        "payment_id": "pay_sup_001",
        "payment_date": "2023-05-28T00:00:00.000Z",
        "amount_paid": 150.00,
        "payment_method": "Bank Transfer"
      }
    ],
    "created_at": "2023-05-20T10:00:00.000Z",
    "updated_at": "2023-05-28T11:00:00.000Z"
  }
}
```

#### Create Bill

```
POST /api/v1/financials/ap/bills
```

Creates a new supplier bill.

##### Request Body

```json
{
  "supplier_id": "sup_567",
  "bill_number": "INV-SUP-00124",
  "bill_date": "2023-06-01T00:00:00.000Z",
  "due_date": "2023-07-01T00:00:00.000Z",
  "terms": "Net 30",
  "currency": "USD",
  "purchase_order_id": "po_1000",
  "notes": "New order for office stationery.",
  "lines": [
    {
      "product_id": "prod_pens_bulk",
      "description": "Ballpoint Pens (Box of 100)",
      "quantity": 5,
      "unit_price": 20.00,
      "tax_rate_id": "tax_std_8_percent", // or direct tax_rate: 0.08
      "line_total": 108.00, // Server can recalculate if needed
      "account_id": "acc_office_supplies_exp"
    }
  ]
}
```

##### Response

```json
{
  "success": true,
  "data": {
    "id": "bill_102",
    "status": "SUBMITTED", // Or DRAFT depending on workflow
    "total_amount": 108.00,
    "amount_due": 108.00,
    // ... other fields ...
    "created_at": "2023-06-02T17:00:00.000Z"
  }
}
```

#### Update Bill

```
PUT /api/v1/financials/ap/bills/:id
```

Updates an existing bill (typically if in 'DRAFT' or 'SUBMITTED' status).

##### Request Body

(Similar to create, with fields to update)

##### Response

(Similar to get bill details)

#### Record Bill Payment

```
POST /api/v1/financials/ap/bills/:id/payments
```

Records a payment made against a supplier bill.

##### Request Body

```json
{
  "payment_date": "2023-06-05T00:00:00.000Z",
  "amount_paid": 108.00,
  "payment_method_id": "pm_bank_transfer_01",
  "payment_account_id": "acc_bank_checking", // Cash/Bank account debited
  "reference_number": "TRN-BANK-00567",
  "notes": "Full payment for INV-SUP-00124"
}
```

##### Response

```json
{
  "success": true,
  "data": {
    "payment_id": "pay_sup_002",
    "bill_id": "bill_102",
    "status": "PAID", // Bill status updated
    "amount_due": 0.00,
    "message": "Payment recorded successfully."
  }
}
```

### 4. Accounts Receivable (AR)

Manages customer invoices, payments, and credit notes.

#### List Invoices

```
GET /api/v1/financials/ar/invoices
```

Retrieves a list of customer invoices.

##### Query Parameters

| Parameter     | Type   | Description                                                                                                    |
|---------------|--------|----------------------------------------------------------------------------------------------------------------|
| page          | number | Page number (default: 1)                                                                                       |
| limit         | number | Items per page (default: 20, max: 100)                                                                         |
| sort          | string | Field to sort by (default: 'due_date')                                                                         |
| order         | string | Sort order ('asc' or 'desc', default: 'asc')                                                                   |
| customer_id   | string | Filter by customer ID (optional)                                                                               |
| status        | string | Filter by invoice status ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'VOIDED', 'OVERDUE') (optional)          |
| due_date_from | string | Filter by due date range start (ISO format) (optional)                                                         |
| due_date_to   | string | Filter by due date range end (ISO format) (optional)                                                           |
| invoice_number| string | Search by invoice number (optional)                                                                            |

##### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "inv_789",
      "invoice_number": "INV-2023-0056",
      "customer_id": "cust_abc",
      "customer_name": "Client Corp.",
      "invoice_date": "2023-05-10T00:00:00.000Z",
      "due_date": "2023-06-09T00:00:00.000Z",
      "total_amount": 1250.00,
      "amount_due": 1250.00,
      "currency": "USD",
      "status": "SENT",
      "sales_order_id": "so_12345",
      "created_at": "2023-05-10T14:00:00.000Z",
      "updated_at": "2023-05-10T14:05:00.000Z"
    }
    // Additional invoices...
  ],
  "pagination": {
    "totalItems": 112,
    "totalPages": 6,
    "currentPage": 1,
    "pageSize": 20
  }
}
```

#### Get Invoice Details

```
GET /api/v1/financials/ar/invoices/:id
```

Retrieves detailed information for a specific invoice, including line items.

##### Response

```json
{
  "success": true,
  "data": {
    "id": "inv_789",
    "invoice_number": "INV-2023-0056",
    "customer_id": "cust_abc",
    "customer_name": "Client Corp.",
    "billing_address": {
      "street": "123 Main St",
      "city": "Anytown",
      "state": "CA",
      "zip_code": "90210",
      "country": "USA"
    },
    "invoice_date": "2023-05-10T00:00:00.000Z",
    "due_date": "2023-06-09T00:00:00.000Z",
    "terms": "Net 30",
    "total_amount": 1250.00,
    "amount_paid": 0.00,
    "amount_due": 1250.00,
    "currency": "USD",
    "status": "SENT",
    "sales_order_id": "so_12345",
    "notes_to_customer": "Thank you for your business!",
    "lines": [
      {
        "id": "inv_line_1",
        "product_id": "prod_consult_hr",
        "description": "Consulting Services - 10 hours",
        "quantity": 10,
        "unit_price": 120.00,
        "tax_rate": 0.00,
        "line_total": 1200.00,
        "revenue_account_id": "acc_rev_services"
      },
      {
        "id": "inv_line_2",
        "description": "Project Expenses Reimbursement",
        "quantity": 1,
        "unit_price": 50.00,
        "tax_rate": 0.00,
        "line_total": 50.00,
        "revenue_account_id": "acc_rev_reimbursements"
      }
    ],
    "payments_received": [],
    "created_at": "2023-05-10T14:00:00.000Z",
    "updated_at": "2023-05-10T14:05:00.000Z"
  }
}
```

#### Create Invoice

```
POST /api/v1/financials/ar/invoices
```

Creates a new customer invoice.

##### Request Body

```json
{
  "customer_id": "cust_xyz",
  "invoice_date": "2023-06-02T00:00:00.000Z",
  "due_date": "2023-07-02T00:00:00.000Z",
  "terms": "Net 30",
  "currency": "USD",
  "sales_order_id": "so_67890",
  "notes_to_customer": "Project Alpha - Phase 1 completion.",
  "lines": [
    {
      "product_id": "prod_software_license",
      "description": "Software License - Annual Subscription",
      "quantity": 1,
      "unit_price": 500.00,
      "tax_rate_id": "tax_std_sales_tax",
      "revenue_account_id": "acc_rev_software"
    },
    {
      "description": "Implementation Support",
      "quantity": 5, // Hours
      "unit_price": 100.00,
      "revenue_account_id": "acc_rev_services"
    }
  ]
}
```

##### Response

```json
{
  "success": true,
  "data": {
    "id": "inv_790",
    "invoice_number": "INV-2023-0057", // System-generated
    "status": "DRAFT", // Or SENT if auto-send is configured
    "total_amount": 1040.00, // Assuming 8% tax on 500 = 40
    "amount_due": 1040.00,
    // ... other fields ...
    "created_at": "2023-06-02T18:00:00.000Z"
  }
}
```

#### Update Invoice

```
PUT /api/v1/financials/ar/invoices/:id
```

Updates an existing invoice (typically if in 'DRAFT' status).

##### Request Body

(Similar to create, with fields to update)

##### Response

(Similar to get invoice details)

#### Send Invoice to Customer

```
POST /api/v1/financials/ar/invoices/:id/send
```

Marks an invoice as 'SENT' and typically triggers an email to the customer.

##### Request Body (Optional)

```json
{
  "recipient_email": "customer@example.com", // Override default customer email
  "email_template_id": "template_invoice_default"
}
```

##### Response

```json
{
  "success": true,
  "data": {
    "id": "inv_790",
    "status": "SENT",
    "sent_at": "2023-06-02T18:30:00.000Z",
    "message": "Invoice INV-2023-0057 sent to customer."
  }
}
```

#### Record Invoice Payment

```
POST /api/v1/financials/ar/invoices/:id/payments
```

Records a payment received against a customer invoice.

##### Request Body

```json
{
  "payment_date": "2023-06-10T00:00:00.000Z",
  "amount_received": 1040.00,
  "payment_method_id": "pm_credit_card_online",
  "deposit_to_account_id": "acc_bank_main", // Bank account credited
  "transaction_reference": "CH_123ABC456DEF",
  "notes": "Full payment received via online portal."
}
```

##### Response

```json
{
  "success": true,
  "data": {
    "payment_id": "pay_cust_001",
    "invoice_id": "inv_790",
    "status": "PAID", // Invoice status updated
    "amount_due": 0.00,
    "message": "Payment received and applied to invoice INV-2023-0057."
  }
}
```

### 5. Financial Statements

Endpoints for generating standard financial reports.

#### Generate Balance Sheet

```
GET /api/v1/financials/reports/balance-sheet
```

Generates a Balance Sheet report for a specific date.

##### Query Parameters

| Parameter     | Type   | Description                                                                                                |
|---------------|--------|------------------------------------------------------------------------------------------------------------|
| as_of_date    | string | The date for which the balance sheet is generated (ISO format, e.g., '2023-12-31') (required)              |
| comparison_date| string| A previous date for comparison (ISO format) (optional)                                                     |
| subsidiary_id | string | Filter by a specific subsidiary/entity ID (if applicable) (optional)                                       |
| output_format | string | Desired output format ('json', 'pdf', 'csv') (default: 'json')                                             |

##### Response (Example: JSON)

```json
{
  "success": true,
  "data": {
    "report_name": "Balance Sheet",
    "as_of_date": "2023-12-31T00:00:00.000Z",
    "currency": "USD",
    "assets": {
      "current_assets": {
        "cash_and_equivalents": 150000.00,
        "accounts_receivable_net": 75000.00,
        "inventory": 120000.00,
        "prepaid_expenses": 10000.00,
        "total_current_assets": 355000.00
      },
      "non_current_assets": {
        "property_plant_equipment_net": 500000.00,
        "intangible_assets_net": 50000.00,
        "total_non_current_assets": 550000.00
      },
      "total_assets": 905000.00
    },
    "liabilities": {
      "current_liabilities": {
        "accounts_payable": 60000.00,
        "accrued_expenses": 25000.00,
        "short_term_debt": 50000.00,
        "total_current_liabilities": 135000.00
      },
      "non_current_liabilities": {
        "long_term_debt": 200000.00,
        "total_non_current_liabilities": 200000.00
      },
      "total_liabilities": 335000.00
    },
    "equity": {
      "common_stock": 300000.00,
      "retained_earnings": 270000.00,
      "total_equity": 570000.00
    },
    "total_liabilities_and_equity": 905000.00,
    "generated_at": "2024-01-05T10:00:00.000Z"
  }
}
```

#### Generate Income Statement (Profit & Loss)

```
GET /api/v1/financials/reports/income-statement
```

Generates an Income Statement for a specified period.

##### Query Parameters

| Parameter     | Type   | Description                                                                                                |
|---------------|--------|------------------------------------------------------------------------------------------------------------|
| start_date    | string | Start date for the reporting period (ISO format) (required)                                                |
| end_date      | string | End date for the reporting period (ISO format) (required)                                                  |
| comparison_start_date | string | Start date for a comparison period (optional)                                                          |
| comparison_end_date   | string | End date for a comparison period (optional)                                                            |
| subsidiary_id | string | Filter by a specific subsidiary/entity ID (if applicable) (optional)                                       |
| output_format | string | Desired output format ('json', 'pdf', 'csv') (default: 'json')                                             |

##### Response (Example: JSON)

```json
{
  "success": true,
  "data": {
    "report_name": "Income Statement",
    "period_start_date": "2023-01-01T00:00:00.000Z",
    "period_end_date": "2023-12-31T00:00:00.000Z",
    "currency": "USD",
    "revenue": {
      "product_sales": 1200000.00,
      "service_revenue": 300000.00,
      "total_revenue": 1500000.00
    },
    "cost_of_goods_sold": 700000.00,
    "gross_profit": 800000.00,
    "operating_expenses": {
      "sales_and_marketing": 150000.00,
      "research_and_development": 100000.00,
      "general_and_administrative": 200000.00,
      "total_operating_expenses": 450000.00
    },
    "operating_income_ebit": 350000.00,
    "interest_expense": 20000.00,
    "income_before_tax": 330000.00,
    "income_tax_expense": 66000.00,
    "net_income": 264000.00,
    "generated_at": "2024-01-05T10:05:00.000Z"
  }
}
```

#### Generate Cash Flow Statement

```
GET /api/v1/financials/reports/cash-flow-statement
```

Generates a Cash Flow Statement for a specified period.

##### Query Parameters

(Similar to Income Statement: `start_date`, `end_date`, `comparison_start_date`, `comparison_end_date`, `subsidiary_id`, `output_format`)

##### Response (Example: JSON)

```json
{
  "success": true,
  "data": {
    "report_name": "Cash Flow Statement",
    "period_start_date": "2023-01-01T00:00:00.000Z",
    "period_end_date": "2023-12-31T00:00:00.000Z",
    "currency": "USD",
    "operating_activities": {
      "net_income": 264000.00,
      "depreciation_amortization": 50000.00,
      "changes_in_working_capital": -30000.00, // (e.g., increase in AR)
      "net_cash_from_operating": 284000.00
    },
    "investing_activities": {
      "purchase_of_ppe": -100000.00,
      "proceeds_from_sale_of_assets": 10000.00,
      "net_cash_from_investing": -90000.00
    },
    "financing_activities": {
      "proceeds_from_debt": 50000.00,
      "repayment_of_debt": -25000.00,
      "dividends_paid": -40000.00,
      "net_cash_from_financing": -15000.00
    },
    "net_increase_in_cash": 179000.00,
    "cash_at_beginning_of_period": 80000.00,
    "cash_at_end_of_period": 259000.00,
    "generated_at": "2024-01-05T10:10:00.000Z"
  }
}
```

### 6. Fiscal Periods & Settings

Endpoints for managing fiscal years, periods, and general financial settings.

#### List Fiscal Years

```
GET /api/v1/financials/fiscal-years
```

Retrieves a list of defined fiscal years.

##### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "fy_2023",
      "name": "Fiscal Year 2023",
      "start_date": "2023-01-01T00:00:00.000Z",
      "end_date": "2023-12-31T00:00:00.000Z",
      "status": "CLOSED"
    },
    {
      "id": "fy_2024",
      "name": "Fiscal Year 2024",
      "start_date": "2024-01-01T00:00:00.000Z",
      "end_date": "2024-12-31T00:00:00.000Z",
      "status": "OPEN"
    }
  ]
}
```

#### Get Fiscal Year Details

```
GET /api/v1/financials/fiscal-years/:id
```

Retrieves details for a specific fiscal year, including its periods.

##### Response

```json
{
  "success": true,
  "data": {
    "id": "fy_2024",
    "name": "Fiscal Year 2024",
    "start_date": "2024-01-01T00:00:00.000Z",
    "end_date": "2024-12-31T00:00:00.000Z",
    "status": "OPEN",
    "periods": [
      {
        "id": "fp_2024_01",
        "name": "January 2024",
        "start_date": "2024-01-01T00:00:00.000Z",
        "end_date": "2024-01-31T00:00:00.000Z",
        "status": "OPEN"
      },
      {
        "id": "fp_2024_02",
        "name": "February 2024",
        "start_date": "2024-02-01T00:00:00.000Z",
        "end_date": "2024-02-29T00:00:00.000Z",
        "status": "OPEN"
      }
      // ... other periods
    ]
  }
}
```

#### Close Fiscal Period

```
POST /api/v1/financials/fiscal-periods/:id/close
```

Closes a fiscal period, preventing further transactions in that period.

##### Request Body (Optional)

```json
{
  "notes": "All month-end adjustments completed."
}
```

##### Response

```json
{
  "success": true,
  "data": {
    "id": "fp_2024_01",
    "status": "CLOSED",
    "closed_by": "user_controller",
    "closed_at": "2024-02-05T17:00:00.000Z",
    "message": "Fiscal period 'January 2024' closed successfully."
  }
}
```

#### Get Financial Settings

```
GET /api/v1/financials/settings
```

Retrieves general financial settings for the tenant.

##### Response

```json
{
  "success": true,
  "data": {
    "base_currency": "USD",
    "multi_currency_enabled": true,
    "default_fiscal_year_start_month": "January",
    "default_fiscal_year_start_day": 1,
    "tax_settings": {
      "default_tax_rate_id": "tax_std_sales_tax",
      "prices_include_tax": false
    },
    "invoice_numbering_format": "INV-{YYYY}-{NNNN}",
    "bill_numbering_format": "BILL-{YYYY}-{NNNN}",
    "journal_entry_numbering_format": "JE-{YYYYMM}-{NNN}"
  }
}
```

#### Update Financial Settings

```
PUT /api/v1/financials/settings
```

Updates general financial settings.

##### Request Body

(Subset of fields from GET response)

```json
{
  "multi_currency_enabled": false,
  "tax_settings": {
    "prices_include_tax": true
  }
}
```

##### Response

(Returns the updated settings object)

## Error Responses

Common error responses for the Financials API.

### Not Found

Standard `404 Not Found` if a specific resource (e.g., account, journal entry, bill, invoice) does not exist.

```json
{
  "success": false,
  "error": {
    "message": "Resource not found. For example, Account with ID 'acc_invalid' not found.",
    "code": "NOT_FOUND"
  }
}
```

### Validation Error

Standard `400 Bad Request` for invalid request body or query parameters.

```json
{
  "success": false,
  "error": {
    "message": "Validation failed for request data.",
    "code": "VALIDATION_ERROR",
    "details": {
      "account_code": "Account code is required and must be unique.",
      "lines[0].debit_amount": "Debit amount must be a non-negative number."
    }
  }
}
```

### Unbalanced Journal Entry

`400 Bad Request` when creating or updating a journal entry where debits do not equal credits.

```json
{
  "success": false,
  "error": {
    "message": "Journal entry is unbalanced. Total debits must equal total credits.",
    "code": "UNBALANCED_JOURNAL_ENTRY",
    "details": {
      "total_debit": 150.00,
      "total_credit": 140.00
    }
  }
}
```

### Period Closed

`403 Forbidden` or `400 Bad Request` when attempting to create or modify transactions in a closed fiscal period.

```json
{
  "success": false,
  "error": {
    "message": "Cannot create/modify transaction. Fiscal period 'January 2023' is closed.",
    "code": "FISCAL_PERIOD_CLOSED"
  }
}
```

### Insufficient Permissions

Standard `403 Forbidden` if the user lacks permissions for the requested action.

```json
{
  "success": false,
  "error": {
    "message": "User does not have permission to post journal entries.",
    "code": "INSUFFICIENT_PERMISSIONS"
  }
}
```

## Implementation Notes

### Multi-tenancy

All Financials API endpoints are strictly multi-tenant. Data is isolated based on the `tenant_id` derived from the authenticated user's session. This `tenant_id` is automatically applied to all database queries and operations.

### Transactional Integrity

- Operations that involve multiple database changes (e.g., posting a journal entry which updates account balances, creating a bill and its lines) are performed within database transactions to ensure atomicity. If any part of the operation fails, the entire transaction is rolled back.
- Double-entry bookkeeping principles are enforced, especially for journal entries.

### Audit Trails

- Comprehensive audit trails are maintained for all financial transactions. This includes tracking who created/modified/posted records and when.
- Changes to sensitive data like account configurations or posted entries may be logged in more detail.

### Currency Management

- The system supports a base currency for reporting and can handle transactions in multiple currencies if `multi_currency_enabled` is true.
- Exchange rates are managed (potentially via a separate set of endpoints or integrations) and applied at the time of transaction.
- Realized and unrealized gains/losses due to currency fluctuations are calculated and journalized, typically at period end.

### Integration with Other Modules

- **Sales & Purchases:** Invoices and bills are often generated from Sales Orders and Purchase Orders. Payments recorded in AP/AR update the status of these documents.
- **Inventory:** Cost of Goods Sold (COGS) and inventory asset values are updated based on sales and purchases, requiring journal entries (often automated).
- **Payroll:** Payroll expenses and liabilities are recorded via journal entries.

### Reporting Performance

- Financial statement generation can be resource-intensive. For large datasets, consider:
    - Optimized queries and database indexing.
    - Pre-calculated summary data or materialized views for faster reporting.
    - Asynchronous report generation for complex or very large reports, where the user is notified when the report is ready for download.

### Security & Access Control

- Role-based access control (RBAC) is critical. Different user roles (e.g., Accountant, AP Clerk, Controller) will have varying permissions for viewing, creating, editing, and posting financial data.
- Sensitive operations like closing fiscal periods or modifying financial settings should be restricted to highly privileged roles.

