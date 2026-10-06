# Settings API

This document details the endpoints for managing system and tenant settings in the Zettaz Cloud Enterprise API.

## Overview

The Settings API provides endpoints for retrieving and updating various configuration settings for the application. Settings are organized into categories such as general, inventory, sales, purchase orders, users, and notifications.

## Endpoints

### List Settings Categories

```
GET /api/v1/settings/categories
```

Retrieves a list of all available settings categories.

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "general",
      "name": "General Settings",
      "description": "Basic system configuration settings",
      "icon": "cog"
    },
    {
      "id": "company",
      "name": "Company Information",
      "description": "Company details and branding",
      "icon": "building"
    },
    {
      "id": "inventory",
      "name": "Inventory Settings",
      "description": "Inventory management configuration",
      "icon": "box"
    },
    {
      "id": "sales",
      "name": "Sales Settings",
      "description": "Sales and invoicing configuration",
      "icon": "shopping-cart"
    },
    {
      "id": "purchase",
      "name": "Purchase Settings",
      "description": "Purchase order configuration",
      "icon": "truck"
    },
    {
      "id": "users",
      "name": "User Settings",
      "description": "User management and security settings",
      "icon": "users"
    },
    {
      "id": "notifications",
      "name": "Notification Settings",
      "description": "Email and notification configuration",
      "icon": "bell"
    },
    {
      "id": "integrations",
      "name": "Integrations",
      "description": "Third-party service integrations",
      "icon": "plug"
    }
  ]
}
```

### Get Settings by Category

```
GET /api/v1/settings/:category
```

Retrieves all settings for a specific category.

#### Response (Example for "general" category)

```json
{
  "success": true,
  "data": {
    "category": {
      "id": "general",
      "name": "General Settings",
      "description": "Basic system configuration settings"
    },
    "settings": [
      {
        "id": "company_name",
        "name": "Company Name",
        "description": "Legal name of the company",
        "value": "Acme Corporation",
        "type": "string",
        "is_tenant_specific": true,
        "is_required": true,
        "is_sensitive": false,
        "updated_at": "2023-01-15T10:00:00.000Z"
      },
      {
        "id": "default_currency",
        "name": "Default Currency",
        "description": "Default currency for the system",
        "value": "USD",
        "type": "select",
        "options": ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"],
        "is_tenant_specific": true,
        "is_required": true,
        "is_sensitive": false,
        "updated_at": "2023-01-15T10:00:00.000Z"
      },
      {
        "id": "timezone",
        "name": "Timezone",
        "description": "Default timezone for the system",
        "value": "America/New_York",
        "type": "timezone",
        "is_tenant_specific": true,
        "is_required": true,
        "is_sensitive": false,
        "updated_at": "2023-01-15T10:00:00.000Z"
      },
      {
        "id": "date_format",
        "name": "Date Format",
        "description": "Format for displaying dates",
        "value": "MM/DD/YYYY",
        "type": "select",
        "options": ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"],
        "is_tenant_specific": true,
        "is_required": true,
        "is_sensitive": false,
        "updated_at": "2023-01-15T10:00:00.000Z"
      }
    ]
  }
}
```

#### Response (Example for "inventory" category)

```json
{
  "success": true,
  "data": {
    "category": {
      "id": "inventory",
      "name": "Inventory Settings",
      "description": "Inventory management configuration"
    },
    "settings": [
      {
        "id": "inventory_valuation_method",
        "name": "Inventory Valuation Method",
        "description": "Method used for valuing inventory",
        "value": "FIFO",
        "type": "select",
        "options": ["FIFO", "LIFO", "AVERAGE"],
        "is_tenant_specific": true,
        "is_required": true,
        "is_sensitive": false,
        "updated_at": "2023-01-15T10:00:00.000Z"
      },
      {
        "id": "default_reorder_point",
        "name": "Default Reorder Point",
        "description": "Default quantity at which products should be reordered",
        "value": "10",
        "type": "number",
        "is_tenant_specific": true,
        "is_required": true,
        "is_sensitive": false,
        "updated_at": "2023-01-15T10:00:00.000Z"
      },
      {
        "id": "enable_low_stock_alerts",
        "name": "Enable Low Stock Alerts",
        "description": "Whether to send alerts when inventory levels are low",
        "value": "true",
        "type": "boolean",
        "is_tenant_specific": true,
        "is_required": false,
        "is_sensitive": false,
        "updated_at": "2023-01-15T10:00:00.000Z"
      }
    ]
  }
}
```

### Update Settings

```
PUT /api/v1/settings/:category
```

Updates settings for a specific category.

#### Request Body

```json
{
  "settings": [
    {
      "id": "company_name",
      "value": "Acme International Corporation"
    },
    {
      "id": "default_currency",
      "value": "EUR"
    }
  ]
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "category": "general",
    "updated": [
      {
        "id": "company_name",
        "name": "Company Name",
        "previous_value": "Acme Corporation",
        "new_value": "Acme International Corporation",
        "updated_at": "2023-06-02T15:30:00.000Z"
      },
      {
        "id": "default_currency",
        "name": "Default Currency",
        "previous_value": "USD",
        "new_value": "EUR",
        "updated_at": "2023-06-02T15:30:00.000Z"
      }
    ]
  }
}
```

### Get Company Information

```
GET /api/v1/settings/company
```

Retrieves detailed company information.

#### Response

```json
{
  "success": true,
  "data": {
    "company_name": "Acme International Corporation",
    "legal_name": "Acme International Corporation LLC",
    "tax_id": "12-3456789",
    "contact_email": "info@acme.com",
    "contact_phone": "+1234567890",
    "website": "https://www.acme.com",
    "logo_url": "https://assets.zettaz.com/tenants/tenant_123/logo.png",
    "address": {
      "line1": "123 Corporate Drive",
      "line2": "Suite 100",
      "city": "Business City",
      "state": "NY",
      "postal_code": "10001",
      "country": "USA"
    },
    "social_media": {
      "facebook": "https://www.facebook.com/acmecorp",
      "twitter": "https://www.twitter.com/acmecorp",
      "linkedin": "https://www.linkedin.com/company/acmecorp"
    },
    "business_hours": {
      "monday": "9:00-17:00",
      "tuesday": "9:00-17:00",
      "wednesday": "9:00-17:00",
      "thursday": "9:00-17:00",
      "friday": "9:00-17:00",
      "saturday": "Closed",
      "sunday": "Closed"
    }
  }
}
```

### Update Company Information

```
PUT /api/v1/settings/company
```

Updates company information.

#### Request Body

```json
{
  "company_name": "Acme Global Corporation",
  "contact_email": "info@acmeglobal.com",
  "website": "https://www.acmeglobal.com",
  "address": {
    "line1": "456 Global Tower",
    "line2": "Floor 20",
    "city": "Metropolis",
    "state": "NY",
    "postal_code": "10002",
    "country": "USA"
  }
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "company_name": "Acme Global Corporation",
    "legal_name": "Acme International Corporation LLC",
    "tax_id": "12-3456789",
    "contact_email": "info@acmeglobal.com",
    "contact_phone": "+1234567890",
    "website": "https://www.acmeglobal.com",
    "logo_url": "https://assets.zettaz.com/tenants/tenant_123/logo.png",
    "address": {
      "line1": "456 Global Tower",
      "line2": "Floor 20",
      "city": "Metropolis",
      "state": "NY",
      "postal_code": "10002",
      "country": "USA"
    },
    "updated_at": "2023-06-02T16:30:00.000Z"
  }
}
```

### Upload Company Logo

```
POST /api/v1/settings/company/logo
```

Uploads a new company logo.

#### Request

Multipart form data with 'logo' field containing the image file.

#### Response

```json
{
  "success": true,
  "data": {
    "logo_url": "https://assets.zettaz.com/tenants/tenant_123/logo.png",
    "updated_at": "2023-06-02T17:00:00.000Z"
  }
}
```

### Get Email Templates

```
GET /api/v1/settings/email-templates
```

Retrieves available email templates.

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "purchase_order_confirmation",
      "name": "Purchase Order Confirmation",
      "description": "Sent to suppliers when a purchase order is confirmed",
      "subject": "Purchase Order {{po_number}} from {{company_name}}",
      "variables": ["po_number", "company_name", "order_date", "expected_delivery_date", "total_amount", "supplier_name"],
      "is_customizable": true,
      "last_updated": "2023-01-15T10:00:00.000Z"
    },
    {
      "id": "invoice",
      "name": "Invoice Email",
      "description": "Sent to customers with invoice details",
      "subject": "Invoice {{invoice_number}} from {{company_name}}",
      "variables": ["invoice_number", "company_name", "issue_date", "due_date", "total_amount", "customer_name"],
      "is_customizable": true,
      "last_updated": "2023-01-15T10:00:00.000Z"
    },
    {
      "id": "low_stock_alert",
      "name": "Low Stock Alert",
      "description": "Internal notification for low stock levels",
      "subject": "Low Stock Alert: {{product_name}}",
      "variables": ["product_name", "product_sku", "current_stock_quantity", "reorder_level"],
      "is_customizable": true,
      "last_updated": "2023-01-15T10:00:00.000Z"
    }
  ]
}
```

### Get Email Template

```
GET /api/v1/settings/email-templates/:id
```

Retrieves a specific email template.

#### Response

```json
{
  "success": true,
  "data": {
    "id": "purchase_order_confirmation",
    "name": "Purchase Order Confirmation",
    "description": "Sent to suppliers when a purchase order is confirmed",
    "subject": "Purchase Order {{po_number}} from {{company_name}}",
    "body_html": "<html><body><p>Dear {{supplier_name}},</p><p>We are pleased to confirm the following purchase order:</p><p><strong>Purchase Order Number:</strong> {{po_number}}<br><strong>Order Date:</strong> {{order_date}}<br><strong>Expected Delivery Date:</strong> {{expected_delivery_date}}<br><strong>Total Amount:</strong> {{total_amount}}</p><p>Please find the attached purchase order for details.</p><p>Best regards,<br>{{company_name}}</p></body></html>",
    "body_text": "Dear {{supplier_name}},\n\nWe are pleased to confirm the following purchase order:\n\nPurchase Order Number: {{po_number}}\nOrder Date: {{order_date}}\nExpected Delivery Date: {{expected_delivery_date}}\nTotal Amount: {{total_amount}}\n\nPlease find the attached purchase order for details.\n\nBest regards,\n{{company_name}}",
    "variables": ["po_number", "company_name", "order_date", "expected_delivery_date", "total_amount", "supplier_name"],
    "is_customizable": true,
    "last_updated": "2023-01-15T10:00:00.000Z"
  }
}
```

### Update Email Template

```
PUT /api/v1/settings/email-templates/:id
```

Updates a specific email template.

#### Request Body

```json
{
  "subject": "New PO {{po_number}} from {{company_name}}",
  "body_html": "<html><body><p>Dear {{supplier_name}},</p><p>We are pleased to place the following purchase order:</p><p><strong>Purchase Order Number:</strong> {{po_number}}<br><strong>Order Date:</strong> {{order_date}}<br><strong>Expected Delivery Date:</strong> {{expected_delivery_date}}<br><strong>Total Amount:</strong> {{total_amount}}</p><p>Please find the attached purchase order for details. Kindly confirm receipt.</p><p>Best regards,<br>{{company_name}} Procurement Team</p></body></html>",
  "body_text": "Dear {{supplier_name}},\n\nWe are pleased to place the following purchase order:\n\nPurchase Order Number: {{po_number}}\nOrder Date: {{order_date}}\nExpected Delivery Date: {{expected_delivery_date}}\nTotal Amount: {{total_amount}}\n\nPlease find the attached purchase order for details. Kindly confirm receipt.\n\nBest regards,\n{{company_name}} Procurement Team"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "purchase_order_confirmation",
    "name": "Purchase Order Confirmation",
    "subject": "New PO {{po_number}} from {{company_name}}",
    "body_html": "<html><body><p>Dear {{supplier_name}},</p><p>We are pleased to place the following purchase order:</p><p><strong>Purchase Order Number:</strong> {{po_number}}<br><strong>Order Date:</strong> {{order_date}}<br><strong>Expected Delivery Date:</strong> {{expected_delivery_date}}<br><strong>Total Amount:</strong> {{total_amount}}</p><p>Please find the attached purchase order for details. Kindly confirm receipt.</p><p>Best regards,<br>{{company_name}} Procurement Team</p></body></html>",
    "updated_at": "2023-06-02T17:30:00.000Z"
  }
}
```

### Reset Email Template

```
POST /api/v1/settings/email-templates/:id/reset
```

Resets an email template to its default version.

#### Response

```json
{
  "success": true,
  "data": {
    "id": "purchase_order_confirmation",
    "message": "Email template has been reset to default",
    "updated_at": "2023-06-02T17:45:00.000Z"
  }
}
```

### Get Integration Settings

```
GET /api/v1/settings/integrations/:integration_id
```

Retrieves settings for a specific integration.

#### Response (Example for "payment_gateway")

```json
{
  "success": true,
  "data": {
    "id": "payment_gateway",
    "name": "Payment Gateway",
    "description": "Payment processing integration",
    "is_enabled": true,
    "provider": "stripe",
    "settings": [
      {
        "id": "api_key",
        "name": "API Key",
        "value": "sk_test_••••••••••••••••••••••••",
        "is_sensitive": true,
        "is_required": true
      },
      {
        "id": "webhook_secret",
        "name": "Webhook Secret",
        "value": "whsec_••••••••••••••••••••••••",
        "is_sensitive": true,
        "is_required": true
      },
      {
        "id": "sandbox_mode",
        "name": "Sandbox Mode",
        "value": "true",
        "type": "boolean",
        "is_sensitive": false,
        "is_required": false
      }
    ],
    "status": {
      "is_connected": true,
      "last_checked": "2023-06-02T12:00:00.000Z",
      "message": "Connected to Stripe API"
    },
    "updated_at": "2023-05-15T10:00:00.000Z"
  }
}
```

### Update Integration Settings

```
PUT /api/v1/settings/integrations/:integration_id
```

Updates settings for a specific integration.

#### Request Body

```json
{
  "is_enabled": true,
  "provider": "stripe",
  "settings": [
    {
      "id": "api_key",
      "value": "<your-stripe-secret-key>"
    },
    {
      "id": "webhook_secret",
      "value": "<your-webhook-secret>"
    },
    {
      "id": "sandbox_mode",
      "value": "false"
    }
  ]
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "payment_gateway",
    "name": "Payment Gateway",
    "is_enabled": true,
    "provider": "stripe",
    "settings": [
      {
        "id": "api_key",
        "name": "API Key",
        "is_updated": true
      },
      {
        "id": "webhook_secret",
        "name": "Webhook Secret",
        "is_updated": true
      },
      {
        "id": "sandbox_mode",
        "name": "Sandbox Mode",
        "value": "false",
        "is_updated": true
      }
    ],
    "status": {
      "is_connected": true,
      "last_checked": "2023-06-02T18:00:00.000Z",
      "message": "Connected to Stripe API"
    },
    "updated_at": "2023-06-02T18:00:00.000Z"
  }
}
```

### Test Integration Connection

```
POST /api/v1/settings/integrations/:integration_id/test
```

Tests the connection to an integration service.

#### Response

```json
{
  "success": true,
  "data": {
    "id": "payment_gateway",
    "name": "Payment Gateway",
    "is_connected": true,
    "message": "Successfully connected to Stripe API",
    "details": {
      "account_name": "Acme Corporation",
      "account_status": "active",
      "api_version": "2022-11-15"
    },
    "tested_at": "2023-06-02T18:15:00.000Z"
  }
}
```

## Error Responses

### Not Found

```json
{
  "success": false,
  "error": {
    "message": "Settings category not found",
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
      "company_name": "Company name is required",
      "default_currency": "Invalid currency code"
    }
  }
}
```

### Integration Error

```json
{
  "success": false,
  "error": {
    "message": "Integration connection failed",
    "code": "INTEGRATION_ERROR",
    "details": "Invalid API key or insufficient permissions"
  }
}
```

## Implementation Notes

### Multi-tenancy Considerations

Settings are scoped to tenants where appropriate:

```javascript
// Retrieve tenant-specific settings
const [settings] = await connection.query(`
  SELECT s.id, s.name, s.description, ts.value, s.type, s.is_tenant_specific
  FROM settings s
  LEFT JOIN tenant_settings ts ON s.id = ts.setting_id AND ts.tenant_id = ?
  WHERE s.category = ?
  ORDER BY s.display_order
`, [tenant_id, category]);

// Update tenant-specific settings
const updateQuery = `
  INSERT INTO tenant_settings (tenant_id, setting_id, value, updated_by, updated_at)
  VALUES (?, ?, ?, ?, NOW())
  ON DUPLICATE KEY UPDATE value = VALUES(value), updated_by = VALUES(updated_by), updated_at = VALUES(updated_at)
`;

await connection.query(updateQuery, [tenant_id, settingId, value, userId]);
```

### Settings Types and Validation

Settings are validated based on their type:

1. String settings may have min/max length requirements
2. Number settings may have min/max value constraints
3. Select settings validate against allowed options
4. Boolean settings are stored as 'true' or 'false' strings
5. Date/time settings use ISO format
6. Complex settings (JSON objects) are validated against schemas
7. Sensitive settings (passwords, API keys) are encrypted in the database

### Default Settings

Default settings are created for each tenant upon provisioning:

1. System-wide defaults are defined in code
2. Default values can be overridden by tenant administrators
3. Some settings cannot be changed by tenants (enforced by is_tenant_specific flag)
4. Settings can be reset to defaults via API endpoints

### Email Template System

The email template system uses a combination of:

1. Template variables for dynamic content
2. HTML and plain text versions of each template
3. Customizable subject lines
4. Template version control to track changes
5. Reset functionality to revert to system defaults

### Integration Management

Integration settings include:

1. Configuration for third-party services
2. Secure storage of API keys and secrets
3. Connection testing functionality
4. Status monitoring and reporting
5. Provider-specific configuration options

### Audit and Change Tracking

All settings changes are logged for audit purposes:

1. Who made the change
2. When the change was made
3. Previous and new values
4. Reason for change (optional)

This audit trail helps with troubleshooting and compliance.
