# Reports API

This document details the endpoints for generating and retrieving reports in the Zettaz Cloud Enterprise API.

## Overview

The Reports API provides endpoints for generating various business reports, including sales reports, inventory reports, financial reports, and custom reports. It supports both on-demand report generation and scheduled reports.

## Endpoints

### List Available Reports

```
GET /api/v1/reports
```

Retrieves a list of all available report types.

#### Response

```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "name": "Sales",
        "reports": [
          {
            "id": "sales_summary",
            "name": "Sales Summary",
            "description": "Summary of sales over a specified period",
            "formats": ["pdf", "csv", "xlsx", "json"],
            "parameters": [
              {
                "name": "start_date",
                "type": "date",
                "required": true,
                "description": "Start date for report period (ISO format)"
              },
              {
                "name": "end_date",
                "type": "date",
                "required": true,
                "description": "End date for report period (ISO format)"
              },
              {
                "name": "group_by",
                "type": "string",
                "required": false,
                "options": ["day", "week", "month", "product", "category", "customer"],
                "description": "How to group the sales data"
              }
            ]
          },
          {
            "id": "product_sales",
            "name": "Product Sales Report",
            "description": "Sales broken down by product",
            "formats": ["pdf", "csv", "xlsx", "json"],
            "parameters": [
              {
                "name": "start_date",
                "type": "date",
                "required": true,
                "description": "Start date for report period (ISO format)"
              },
              {
                "name": "end_date",
                "type": "date",
                "required": true,
                "description": "End date for report period (ISO format)"
              },
              {
                "name": "category_id",
                "type": "string",
                "required": false,
                "description": "Filter by product category"
              }
            ]
          }
        ]
      },
      {
        "name": "Inventory",
        "reports": [
          {
            "id": "inventory_status",
            "name": "Inventory Status",
            "description": "Current inventory levels and status",
            "formats": ["pdf", "csv", "xlsx", "json"],
            "parameters": [
              {
                "name": "location_id",
                "type": "string",
                "required": false,
                "description": "Filter by location"
              },
              {
                "name": "category_id",
                "type": "string",
                "required": false,
                "description": "Filter by product category"
              },
              {
                "name": "include_zero_stock",
                "type": "boolean",
                "required": false,
                "description": "Include products with zero stock"
              }
            ]
          },
          {
            "id": "low_stock",
            "name": "Low Stock Report",
            "description": "Products with stock below reorder level",
            "formats": ["pdf", "csv", "xlsx", "json"],
            "parameters": [
              {
                "name": "location_id",
                "type": "string",
                "required": false,
                "description": "Filter by location"
              },
              {
                "name": "category_id",
                "type": "string",
                "required": false,
                "description": "Filter by product category"
              }
            ]
          }
        ]
      },
      {
        "name": "Financial",
        "reports": [
          {
            "id": "profit_loss",
            "name": "Profit & Loss",
            "description": "Profit and loss statement for a specific period",
            "formats": ["pdf", "xlsx", "json"],
            "parameters": [
              {
                "name": "start_date",
                "type": "date",
                "required": true,
                "description": "Start date for report period (ISO format)"
              },
              {
                "name": "end_date",
                "type": "date",
                "required": true,
                "description": "End date for report period (ISO format)"
              },
              {
                "name": "compare_previous",
                "type": "boolean",
                "required": false,
                "description": "Compare with previous period"
              }
            ]
          },
          {
            "id": "accounts_receivable",
            "name": "Accounts Receivable",
            "description": "Outstanding customer invoices",
            "formats": ["pdf", "csv", "xlsx", "json"],
            "parameters": [
              {
                "name": "as_of_date",
                "type": "date",
                "required": false,
                "description": "Report as of date (default: current date)"
              },
              {
                "name": "age_buckets",
                "type": "string",
                "required": false,
                "description": "Age buckets in days (comma separated)",
                "default": "30,60,90,120"
              }
            ]
          }
        ]
      },
      {
        "name": "Operational",
        "reports": [
          {
            "id": "purchase_orders",
            "name": "Purchase Orders Report",
            "description": "Status and details of purchase orders",
            "formats": ["pdf", "csv", "xlsx", "json"],
            "parameters": [
              {
                "name": "start_date",
                "type": "date",
                "required": false,
                "description": "Start date for report period (ISO format)"
              },
              {
                "name": "end_date",
                "type": "date",
                "required": false,
                "description": "End date for report period (ISO format)"
              },
              {
                "name": "status",
                "type": "string",
                "required": false,
                "options": ["DRAFT", "ORDERED", "PARTIALLY_RECEIVED", "COMPLETED", "CANCELLED"],
                "description": "Filter by status"
              },
              {
                "name": "supplier_id",
                "type": "string",
                "required": false,
                "description": "Filter by supplier"
              }
            ]
          },
          {
            "id": "grn_report",
            "name": "Goods Received Notes Report",
            "description": "Goods received over a specified period",
            "formats": ["pdf", "csv", "xlsx", "json"],
            "parameters": [
              {
                "name": "start_date",
                "type": "date",
                "required": true,
                "description": "Start date for report period (ISO format)"
              },
              {
                "name": "end_date",
                "type": "date",
                "required": true,
                "description": "End date for report period (ISO format)"
              },
              {
                "name": "supplier_id",
                "type": "string",
                "required": false,
                "description": "Filter by supplier"
              },
              {
                "name": "purchase_order_id",
                "type": "string",
                "required": false,
                "description": "Filter by purchase order"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

### Generate Report

```
POST /api/v1/reports/generate
```

Generates a report based on the specified type and parameters.

#### Request Body

```json
{
  "report_id": "sales_summary",
  "format": "pdf",
  "parameters": {
    "start_date": "2023-05-01T00:00:00.000Z",
    "end_date": "2023-05-31T23:59:59.999Z",
    "group_by": "day"
  }
}
```

#### Response (For Synchronous Generation)

```json
{
  "success": true,
  "data": {
    "report_id": "report_123",
    "report_name": "Sales Summary",
    "format": "pdf",
    "generated_at": "2023-06-02T14:30:00.000Z",
    "parameters": {
      "start_date": "2023-05-01T00:00:00.000Z",
      "end_date": "2023-05-31T23:59:59.999Z",
      "group_by": "day"
    },
    "download_url": "https://api.zettaz.com/reports/downloads/report_123.pdf",
    "expires_at": "2023-06-09T14:30:00.000Z"
  }
}
```

#### Response (For Asynchronous Generation)

```json
{
  "success": true,
  "data": {
    "report_id": "report_123",
    "report_name": "Sales Summary",
    "format": "pdf",
    "status": "PROCESSING",
    "requested_at": "2023-06-02T14:30:00.000Z",
    "parameters": {
      "start_date": "2023-05-01T00:00:00.000Z",
      "end_date": "2023-05-31T23:59:59.999Z",
      "group_by": "day"
    },
    "estimated_completion_time": "2023-06-02T14:32:00.000Z",
    "status_url": "https://api.zettaz.com/reports/status/report_123"
  }
}
```

### Check Report Status

```
GET /api/v1/reports/status/:id
```

Checks the status of an asynchronously generated report.

#### Response

```json
{
  "success": true,
  "data": {
    "report_id": "report_123",
    "report_name": "Sales Summary",
    "format": "pdf",
    "status": "COMPLETED",
    "requested_at": "2023-06-02T14:30:00.000Z",
    "completed_at": "2023-06-02T14:31:45.000Z",
    "parameters": {
      "start_date": "2023-05-01T00:00:00.000Z",
      "end_date": "2023-05-31T23:59:59.999Z",
      "group_by": "day"
    },
    "download_url": "https://api.zettaz.com/reports/downloads/report_123.pdf",
    "expires_at": "2023-06-09T14:31:45.000Z"
  }
}
```

### List Report History

```
GET /api/v1/reports/history
```

Retrieves a paginated list of previously generated reports.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20, max: 100) |
| report_id | string | Filter by report type ID |
| start_date | date | Filter by generation date range start (ISO format) |
| end_date | date | Filter by generation date range end (ISO format) |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "report_123",
      "report_id": "sales_summary",
      "report_name": "Sales Summary",
      "format": "pdf",
      "status": "COMPLETED",
      "parameters": {
        "start_date": "2023-05-01T00:00:00.000Z",
        "end_date": "2023-05-31T23:59:59.999Z",
        "group_by": "day"
      },
      "requested_at": "2023-06-02T14:30:00.000Z",
      "completed_at": "2023-06-02T14:31:45.000Z",
      "requested_by": "user_123",
      "requested_by_name": "John Doe",
      "download_url": "https://api.zettaz.com/reports/downloads/report_123.pdf",
      "expires_at": "2023-06-09T14:31:45.000Z"
    },
    {
      "id": "report_124",
      "report_id": "inventory_status",
      "report_name": "Inventory Status",
      "format": "xlsx",
      "status": "COMPLETED",
      "parameters": {
        "location_id": "loc_1",
        "include_zero_stock": false
      },
      "requested_at": "2023-06-01T10:15:00.000Z",
      "completed_at": "2023-06-01T10:15:30.000Z",
      "requested_by": "user_123",
      "requested_by_name": "John Doe",
      "download_url": "https://api.zettaz.com/reports/downloads/report_124.xlsx",
      "expires_at": "2023-06-08T10:15:30.000Z"
    }
    // Additional reports...
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

### Create Scheduled Report

```
POST /api/v1/reports/schedules
```

Creates a new scheduled report.

#### Request Body

```json
{
  "name": "Weekly Sales Report",
  "report_id": "sales_summary",
  "format": "pdf",
  "parameters": {
    "group_by": "day"
  },
  "schedule": {
    "frequency": "WEEKLY",
    "day_of_week": 1,
    "time": "08:00",
    "timezone": "America/New_York"
  },
  "date_range_type": "PREVIOUS_WEEK",
  "recipients": [
    {
      "type": "EMAIL",
      "address": "john.doe@example.com"
    },
    {
      "type": "EMAIL",
      "address": "jane.smith@example.com"
    }
  ],
  "active": true,
  "description": "Weekly sales summary sent every Monday morning"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "sched_123",
    "name": "Weekly Sales Report",
    "report_id": "sales_summary",
    "report_name": "Sales Summary",
    "format": "pdf",
    "parameters": {
      "group_by": "day"
    },
    "schedule": {
      "frequency": "WEEKLY",
      "day_of_week": 1,
      "time": "08:00",
      "timezone": "America/New_York"
    },
    "date_range_type": "PREVIOUS_WEEK",
    "recipients": [
      {
        "type": "EMAIL",
        "address": "john.doe@example.com"
      },
      {
        "type": "EMAIL",
        "address": "jane.smith@example.com"
      }
    ],
    "active": true,
    "description": "Weekly sales summary sent every Monday morning",
    "next_run": "2023-06-05T08:00:00.000-04:00",
    "created_by": "user_123",
    "created_by_name": "John Doe",
    "created_at": "2023-06-02T15:30:00.000Z",
    "updated_at": "2023-06-02T15:30:00.000Z"
  }
}
```

#### Notes
- Frequency options: "DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"
- Date range types: "PREVIOUS_DAY", "PREVIOUS_WEEK", "PREVIOUS_MONTH", "PREVIOUS_QUARTER", "PREVIOUS_YEAR", "CURRENT_MONTH_TO_DATE", "CURRENT_QUARTER_TO_DATE", "CURRENT_YEAR_TO_DATE", "CUSTOM"
- For CUSTOM date range type, additional parameters start_date_offset and end_date_offset should be provided

### List Scheduled Reports

```
GET /api/v1/reports/schedules
```

Retrieves a list of scheduled reports.

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "sched_123",
      "name": "Weekly Sales Report",
      "report_id": "sales_summary",
      "report_name": "Sales Summary",
      "format": "pdf",
      "schedule": {
        "frequency": "WEEKLY",
        "day_of_week": 1,
        "time": "08:00",
        "timezone": "America/New_York"
      },
      "date_range_type": "PREVIOUS_WEEK",
      "active": true,
      "next_run": "2023-06-05T08:00:00.000-04:00",
      "last_run": null,
      "recipient_count": 2,
      "created_by": "user_123",
      "created_by_name": "John Doe",
      "created_at": "2023-06-02T15:30:00.000Z",
      "updated_at": "2023-06-02T15:30:00.000Z"
    },
    {
      "id": "sched_124",
      "name": "Monthly Inventory Report",
      "report_id": "inventory_status",
      "report_name": "Inventory Status",
      "format": "xlsx",
      "schedule": {
        "frequency": "MONTHLY",
        "day_of_month": 1,
        "time": "06:00",
        "timezone": "America/New_York"
      },
      "date_range_type": "PREVIOUS_MONTH",
      "active": true,
      "next_run": "2023-07-01T06:00:00.000-04:00",
      "last_run": "2023-06-01T06:00:00.000-04:00",
      "recipient_count": 3,
      "created_by": "user_123",
      "created_by_name": "John Doe",
      "created_at": "2023-05-15T11:30:00.000Z",
      "updated_at": "2023-06-01T06:00:30.000Z"
    }
    // Additional scheduled reports...
  ]
}
```

### Update Scheduled Report

```
PUT /api/v1/reports/schedules/:id
```

Updates an existing scheduled report.

#### Request Body

Similar to create with relevant modifications.

### Delete Scheduled Report

```
DELETE /api/v1/reports/schedules/:id
```

Deletes a scheduled report.

#### Response

```json
{
  "success": true,
  "data": {
    "message": "Scheduled report deleted successfully"
  }
}
```

### Dashboard Data

```
GET /api/v1/reports/dashboard
```

Retrieves data for the dashboard.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| period | string | Time period ('today', 'week', 'month', 'quarter', 'year', default: 'week') |
| compare | boolean | Whether to include comparison with previous period (default: true) |

#### Response

```json
{
  "success": true,
  "data": {
    "period": "week",
    "current_period": {
      "start_date": "2023-05-28T00:00:00.000Z",
      "end_date": "2023-06-03T23:59:59.999Z"
    },
    "previous_period": {
      "start_date": "2023-05-21T00:00:00.000Z",
      "end_date": "2023-05-27T23:59:59.999Z"
    },
    "metrics": {
      "sales": {
        "current": 15250.75,
        "previous": 14320.50,
        "change_percentage": 6.5,
        "trend": "up"
      },
      "orders": {
        "current": 87,
        "previous": 82,
        "change_percentage": 6.1,
        "trend": "up"
      },
      "average_order_value": {
        "current": 175.29,
        "previous": 174.64,
        "change_percentage": 0.4,
        "trend": "up"
      },
      "new_customers": {
        "current": 12,
        "previous": 15,
        "change_percentage": -20.0,
        "trend": "down"
      }
    },
    "charts": {
      "sales_by_day": {
        "labels": ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        "current": [1200.50, 2300.25, 2450.75, 2100.00, 2500.25, 2700.00, 2000.00],
        "previous": [1150.25, 2200.50, 2300.25, 2000.50, 2400.00, 2570.00, 1700.00]
      },
      "sales_by_category": {
        "labels": ["Electronics", "Furniture", "Clothing", "Accessories", "Other"],
        "values": [5250.25, 4200.50, 3000.00, 1800.00, 1000.00],
        "percentages": [34.4, 27.5, 19.7, 11.8, 6.6]
      },
      "top_products": {
        "labels": ["Product A", "Product B", "Product C", "Product D", "Product E"],
        "values": [3200.50, 2500.25, 1800.00, 1500.00, 1200.00]
      }
    },
    "recent_activity": {
      "orders": [
        {
          "id": "order_123",
          "order_number": "SO-001",
          "customer_name": "ABC Corporation",
          "total_amount": 1250.00,
          "created_at": "2023-06-02T10:30:00.000Z"
        },
        {
          "id": "order_124",
          "order_number": "SO-002",
          "customer_name": "XYZ Ltd",
          "total_amount": 750.00,
          "created_at": "2023-06-01T11:15:00.000Z"
        }
        // Additional recent orders...
      ],
      "inventory_alerts": [
        {
          "product_id": "prod_1",
          "product_name": "Product A",
          "product_sku": "SKU-001",
          "current_stock_quantity": 5,
          "reorder_level": 20,
          "alert_type": "LOW_STOCK"
        },
        {
          "product_id": "prod_2",
          "product_name": "Product B",
          "product_sku": "SKU-002",
          "current_stock_quantity": 0,
          "reorder_level": 15,
          "alert_type": "OUT_OF_STOCK"
        }
        // Additional inventory alerts...
      ]
    }
  }
}
```

## Error Responses

### Invalid Report Type

```json
{
  "success": false,
  "error": {
    "message": "Invalid report type",
    "code": "INVALID_REPORT_TYPE"
  }
}
```

### Missing Parameters

```json
{
  "success": false,
  "error": {
    "message": "Missing required parameters",
    "code": "MISSING_PARAMETERS",
    "details": {
      "start_date": "Start date is required",
      "end_date": "End date is required"
    }
  }
}
```

### Report Generation Error

```json
{
  "success": false,
  "error": {
    "message": "Error generating report",
    "code": "REPORT_GENERATION_ERROR",
    "details": "No data found for the specified parameters"
  }
}
```

### Report Not Found

```json
{
  "success": false,
  "error": {
    "message": "Report not found",
    "code": "NOT_FOUND"
  }
}
```

## Implementation Notes

### Multi-tenancy Considerations

All report data is filtered by tenant:

```javascript
// Direct query for report data
const [salesData] = await connection.query(`
  SELECT 
    DATE(created_at) as sale_date, 
    SUM(total_amount) as daily_total 
  FROM sales_orders 
  WHERE 
    tenant_id = ? AND 
    created_at BETWEEN ? AND ?
  GROUP BY DATE(created_at)
  ORDER BY sale_date
`, [tenant_id, startDate, endDate]);

// Joined queries for product sales
const [productSales] = await connection.query(`
  SELECT 
    p.id as product_id,
    p.name as product_name,
    p.sku as product_sku,
    SUM(soi.quantity) as quantity_sold,
    SUM(soi.line_total) as total_sales
  FROM sales_order_items soi
  JOIN sales_orders so ON soi.sales_order_id = so.id
  JOIN products p ON soi.product_id = p.id
  WHERE 
    so.tenant_id = ? AND 
    so.created_at BETWEEN ? AND ?
  GROUP BY p.id, p.name, p.sku
  ORDER BY total_sales DESC
`, [tenant_id, startDate, endDate]);
```

### Report Generation Process

The report generation process follows these steps:

1. Validate the report type and parameters
2. Determine if synchronous or asynchronous generation is appropriate
3. For synchronous generation:
   - Query the database for report data
   - Format the data according to the requested output format
   - Generate the report file
   - Store the file and return the download URL
4. For asynchronous generation:
   - Create a report generation job
   - Add the job to the processing queue
   - Return a job ID for status checking
   - Process the job in the background
   - Update the job status when complete

### Scheduled Reports

Scheduled reports are processed by a background job that:

1. Identifies scheduled reports due to run
2. Determines the appropriate date range based on the schedule configuration
3. Generates the report with the specified parameters
4. Distributes the report to the configured recipients
5. Updates the scheduled report with the last run date and next run date

### Dashboard Data

Dashboard data is generated using:

1. Aggregation queries for metrics
2. Time-series data for trends
3. Caching to improve performance
4. Incremental updates for real-time data

### Data Export Formats

The system supports multiple export formats:

1. PDF: For formatted reports with charts and analysis
2. CSV: For raw data that can be imported into spreadsheet applications
3. XLSX: For formatted spreadsheets with multiple tabs and formulas
4. JSON: For programmatic access to report data

### Security Considerations

Report access is controlled through:

1. Role-based access control for report types
2. Data filtering based on user permissions
3. Secure download URLs with expiration
4. Audit logging of report generation and access
