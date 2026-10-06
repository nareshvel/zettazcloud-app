# Analytics API

This document details the endpoints for accessing analytics and business intelligence data in the Zettaz Cloud Enterprise API.

## Overview

The Analytics API provides endpoints for retrieving aggregated data, key performance indicators (KPIs), trends, and insights across various modules of the application. This data can be used for dashboards, reporting, and data-driven decision-making.

## Endpoints

### 1. Dashboard Metrics

#### Get Main Dashboard Metrics

```
GET /api/v1/analytics/dashboard/main
```

Retrieves key metrics for the main dashboard.

##### Query Parameters

| Parameter | Type   | Description                                                                 |
|-----------|--------|-----------------------------------------------------------------------------|
| period    | string | Time period for metrics (e.g., 'today', 'week', 'month', 'quarter', 'year') |
| compare_to| string | Comparison period (e.g., 'previous_period', 'previous_year') (optional)   |

##### Response

```json
{
  "success": true,
  "data": {
    "total_sales": {
      "current": 125670.50,
      "previous": 118900.75,
      "change_percent": 5.69
    },
    "total_orders": {
      "current": 850,
      "previous": 820,
      "change_percent": 3.66
    },
    "average_order_value": {
      "current": 147.85,
      "previous": 145.00,
      "change_percent": 1.97
    },
    "new_customers": {
      "current": 75,
      "previous": 60,
      "change_percent": 25.00
    },
    "active_users": {
      "current": 230,
      "previous": 215,
      "change_percent": 6.98
    },
    "inventory_value": {
      "current": 578900.00,
      "previous": 570000.00,
      "change_percent": 1.56
    },
    "open_purchase_orders": {
      "current": 45,
      "value": 95600.00
    },
    "pending_shipments": {
      "current": 62,
      "value": 88750.00
    },
    "updated_at": "2023-05-16T10:00:00.000Z"
  }
}
```

### 2. Sales Analytics

#### Get Sales Overview

```
GET /api/v1/analytics/sales/overview
```

Retrieves an overview of sales performance.

##### Query Parameters

| Parameter      | Type   | Description                                                                                                |
|----------------|--------|------------------------------------------------------------------------------------------------------------|
| start_date     | string | Start date for the analysis period (ISO format)                                                            |
| end_date       | string | End date for the analysis period (ISO format)                                                              |
| group_by       | string | Group results by ('day', 'week', 'month', 'quarter', 'year', 'product', 'category', 'customer', 'region') |
| product_id     | string | Filter by specific product ID (optional)                                                                   |
| category_id    | string | Filter by specific category ID (optional)                                                                  |
| customer_id    | string | Filter by specific customer ID (optional)                                                                  |
| sales_channel  | string | Filter by sales channel (e.g., 'ONLINE', 'POS', 'WHOLESALE') (optional)                                   |

##### Response (Example: Grouped by month)

```json
{
  "success": true,
  "data": {
    "summary": {
      "total_revenue": 125670.50,
      "total_orders": 850,
      "average_order_value": 147.85,
      "total_profit": 45890.20,
      "profit_margin": 36.52,
      "items_sold": 2340,
      "start_date": "2023-01-01T00:00:00.000Z",
      "end_date": "2023-03-31T23:59:59.000Z"
    },
    "time_series": [
      {
        "period": "2023-01",
        "revenue": 38500.75,
        "orders": 280,
        "profit": 14200.50
      },
      {
        "period": "2023-02",
        "revenue": 42100.25,
        "orders": 295,
        "profit": 15600.70
      },
      {
        "period": "2023-03",
        "revenue": 45069.50,
        "orders": 275,
        "profit": 16089.00
      }
    ],
    "top_products": [
      {
        "product_id": "prod_101",
        "product_name": "Business Laptop Pro",
        "revenue": 15800.00,
        "units_sold": 16
      },
      {
        "product_id": "prod_205",
        "product_name": "Wireless Mouse X",
        "revenue": 9500.00,
        "units_sold": 380
      }
    ]
  }
}
```

#### Get Sales Trends

```
GET /api/v1/analytics/sales/trends
```

Retrieves sales trends over time, potentially with forecasts.

##### Query Parameters

| Parameter      | Type    | Description                                                                    |
|----------------|---------|--------------------------------------------------------------------------------|
| metric         | string  | Metric to analyze ('revenue', 'orders', 'profit', 'units_sold')                |
| period_type    | string  | Type of period ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')           |
| periods_count  | number  | Number of past periods to include                                              |
| forecast_periods| number | Number of future periods to forecast (optional)                                |
| product_id     | string  | Filter by specific product ID (optional)                                       |
| category_id    | string  | Filter by specific category ID (optional)                                      |

##### Response

```json
{
  "success": true,
  "data": {
    "metric": "revenue",
    "period_type": "monthly",
    "historical_data": [
      {"period": "2022-11", "value": 35000.00},
      {"period": "2022-12", "value": 40000.00},
      {"period": "2023-01", "value": 38500.75},
      {"period": "2023-02", "value": 42100.25},
      {"period": "2023-03", "value": 45069.50}
    ],
    "forecast_data": [
      {"period": "2023-04", "value": 47500.00, "confidence_lower": 45000.00, "confidence_upper": 50000.00},
      {"period": "2023-05", "value": 49000.00, "confidence_lower": 46000.00, "confidence_upper": 52000.00}
    ],
    "trend_analysis": {
      "slope": 2500.50,
      "r_squared": 0.85,
      "interpretation": "Strong positive trend in monthly revenue."
    }
  }
}
```

### 3. Inventory Analytics

#### Get Inventory Overview

```
GET /api/v1/analytics/inventory/overview
```

Retrieves an overview of inventory status and performance.

##### Query Parameters

| Parameter      | Type   | Description                                                                                                |
|----------------|--------|------------------------------------------------------------------------------------------------------------|
| start_date     | string | Start date for the analysis period (ISO format) (optional)                                                 |
| end_date       | string | End date for the analysis period (ISO format) (optional, defaults to now)                                |
| group_by       | string | Group results by ('product', 'category', 'warehouse', 'supplier') (optional)                               |
| product_id     | string | Filter by specific product ID (optional)                                                                   |
| category_id    | string | Filter by specific category ID (optional)                                                                  |
| warehouse_id   | string | Filter by specific warehouse ID (optional)                                                                 |

##### Response (Example: General Overview)

```json
{
  "success": true,
  "data": {
    "summary": {
      "total_inventory_value": 578900.00,
      "total_units_on_hand": 12500,
      "inventory_turnover_rate": 4.5,
      "average_days_in_stock": 81.1,
      "stockout_events_period": 15,
      "low_stock_items_count": 45,
      "overstock_items_count": 22,
      "valuation_date": "2023-05-16T00:00:00.000Z"
    },
    "by_category": [
      {
        "category_id": "cat_123",
        "category_name": "Electronics",
        "value": 250000.00,
        "units": 3500,
        "turnover_rate": 3.8
      },
      {
        "category_id": "cat_456",
        "category_name": "Appliances",
        "value": 180000.00,
        "units": 1200,
        "turnover_rate": 5.2
      }
    ],
    "slow_moving_items": [
      {
        "product_id": "prod_789",
        "product_name": "Vintage Radio",
        "units_on_hand": 50,
        "days_since_last_sale": 180,
        "value": 2500.00
      }
    ],
    "updated_at": "2023-05-16T10:30:00.000Z"
  }
}
```

#### Get Stock Levels & Aging

```
GET /api/v1/analytics/inventory/stock-levels
```

Retrieves detailed stock levels, including aging information.

##### Query Parameters

| Parameter      | Type   | Description                                                                                                |
|----------------|--------|------------------------------------------------------------------------------------------------------------|
| product_id     | string | Filter by specific product ID (optional)                                                                   |
| category_id    | string | Filter by specific category ID (optional)                                                                  |
| warehouse_id   | string | Filter by specific warehouse ID (optional)                                                                 |
| status_filter  | string | Filter by stock status ('low_stock', 'over_stock', 'optimal_stock', 'near_expiry') (optional)            |
| aging_threshold_days | number | Highlight items older than this many days (optional, e.g., 90)                                         |

##### Response

```json
{
  "success": true,
  "data": [
    {
      "product_id": "prod_101",
      "product_name": "Business Laptop Pro",
      "sku": "BLP-001",
      "warehouse_id": "wh_01",
      "warehouse_name": "Main Warehouse",
      "current_stock": 25,
      "minimum_stock_level": 10,
      "maximum_stock_level": 50,
      "reorder_point": 15,
      "days_of_supply": 45.5,
      "stock_status": "optimal_stock",
      "average_age_days": 60,
      "oldest_batch_age_days": 85,
      "value_on_hand": 24999.75
    },
    {
      "product_id": "prod_303",
      "product_name": "Organic Green Tea",
      "sku": "OGT-001",
      "warehouse_id": "wh_02",
      "warehouse_name": "Cold Storage",
      "current_stock": 150,
      "minimum_stock_level": 50,
      "maximum_stock_level": 300,
      "reorder_point": 75,
      "days_of_supply": 30.0,
      "stock_status": "optimal_stock",
      "average_age_days": 25,
      "oldest_batch_age_days": 40,
      "expiry_date": "2023-09-30T00:00:00.000Z",
      "value_on_hand": 750.00
    }
    // Additional items...
  ],
  "pagination": {
    "totalItems": 120,
    "totalPages": 6,
    "currentPage": 1,
    "pageSize": 20
  }
}
```

### 4. Customer Analytics

#### Get Customer Overview

```
GET /api/v1/analytics/customers/overview
```

Retrieves an overview of customer metrics and segments.

##### Query Parameters

| Parameter      | Type   | Description                                                                                                |
|----------------|--------|------------------------------------------------------------------------------------------------------------|
| start_date     | string | Start date for the analysis period (ISO format)                                                            |
| end_date       | string | End date for the analysis period (ISO format)                                                              |
| group_by       | string | Group results by ('month', 'region', 'segment', 'acquisition_source') (optional)                         |
| segment_id     | string | Filter by specific customer segment ID (optional)                                                          |

##### Response (Example: General Overview)

```json
{
  "success": true,
  "data": {
    "summary": {
      "total_customers": 1250,
      "new_customers_period": 75,
      "active_customers_period": 850,
      "churn_rate_period": 2.5,
      "average_customer_lifetime_value": 450.75,
      "average_purchase_frequency": 3.2,
      "average_order_value": 147.85
    },
    "by_segment": [
      {
        "segment_id": "seg_01",
        "segment_name": "High Value",
        "customer_count": 150,
        "total_revenue": 85000.00,
        "average_ltv": 1200.50
      },
      {
        "segment_id": "seg_02",
        "segment_name": "New Customers",
        "customer_count": 75,
        "total_revenue": 9500.00,
        "average_ltv": 126.67
      }
    ],
    "acquisition_source_breakdown": [
      {
        "source": "Organic Search",
        "new_customers": 30,
        "conversion_rate": 5.2
      },
      {
        "source": "Paid Campaign",
        "new_customers": 25,
        "conversion_rate": 8.1
      }
    ],
    "updated_at": "2023-05-16T11:00:00.000Z"
  }
}
```

#### Get Customer Purchase Patterns (RFM)

```
GET /api/v1/analytics/customers/rfm
```

Retrieves RFM (Recency, Frequency, Monetary) analysis for customers.

##### Query Parameters

| Parameter      | Type   | Description                                                                                                |
|----------------|--------|------------------------------------------------------------------------------------------------------------|
| recency_score  | number | Filter by recency score (1-5) (optional)                                                                   |
| frequency_score| number | Filter by frequency score (1-5) (optional)                                                                 |
| monetary_score | number | Filter by monetary score (1-5) (optional)                                                                  |
| segment_name   | string | Filter by RFM segment name (e.g., 'Champions', 'Loyal Customers', 'At Risk') (optional)                  |

##### Response

```json
{
  "success": true,
  "data": [
    {
      "customer_id": "cust_123",
      "customer_name": "Alice Wonderland",
      "recency_days": 15,
      "frequency_count": 12,
      "monetary_value": 1850.75,
      "recency_score": 5,
      "frequency_score": 4,
      "monetary_score": 5,
      "rfm_score": "545",
      "segment": "Champions"
    },
    {
      "customer_id": "cust_456",
      "customer_name": "Bob The Builder",
      "recency_days": 120,
      "frequency_count": 2,
      "monetary_value": 150.00,
      "recency_score": 2,
      "frequency_score": 2,
      "monetary_score": 2,
      "rfm_score": "222",
      "segment": "Hibernating"
    }
    // Additional customers...
  ],
  "segment_summary": {
    "Champions": {"count": 50, "avg_monetary": 2100.00},
    "Loyal Customers": {"count": 120, "avg_monetary": 850.00},
    "At Risk": {"count": 80, "avg_monetary": 300.00}
    // ... other segments
  },
  "pagination": {
    "totalItems": 1250,
    "totalPages": 63,
    "currentPage": 1,
    "pageSize": 20
  }
}
```

## Error Responses

### Not Found

Standard `404 Not Found` if a specific resource for filtering (e.g., `product_id`) does not exist.

```json
{
  "success": false,
  "error": {
    "message": "Resource not found. For example, Product with ID 'prod_invalid' not found.",
    "code": "NOT_FOUND"
  }
}
```

### Validation Error

Standard `400 Bad Request` for invalid query parameters.

```json
{
  "success": false,
  "error": {
    "message": "Validation failed for query parameters.",
    "code": "VALIDATION_ERROR",
    "details": {
      "start_date": "start_date must be a valid ISO date string and before end_date.",
      "group_by": "Invalid group_by value. Allowed values are: 'day', 'week', 'month'."
    }
  }
}
```

### Data Unavailable

`404 Not Found` or a specific error code if data is insufficient for the requested analysis (e.g., forecasting with too little historical data).

```json
{
  "success": false,
  "error": {
    "message": "Insufficient historical data to generate a forecast for the selected metric and period.",
    "code": "DATA_UNAVAILABLE_FOR_FORECAST"
  }
}
```

## Implementation Notes

### Multi-tenancy Considerations

All analytics queries are strictly isolated by `tenant_id`. The `tenant_id` is derived from the authenticated user's session and automatically applied to all database queries.

```javascript
// Example: Scoping an analytics query by tenant_id
const [results] = await connection.query(
  'SELECT SUM(amount) as total_revenue FROM sales_orders WHERE tenant_id = ? AND order_date BETWEEN ? AND ?',
  [tenant_id, startDate, endDate]
);
```

### Data Aggregation & Performance

- **Pre-aggregated Data:** For frequently accessed analytics and dashboard metrics, data may be pre-aggregated into summary tables or materialized views. These are updated periodically (e.g., hourly or nightly) via background jobs.
- **Optimized Queries:** Complex analytical queries are optimized for performance, utilizing database indexing, appropriate join strategies, and minimizing full table scans.
- **Data Warehousing (Future):** For more advanced analytics, a separate data warehouse or data lake solution might be employed to offload analytical workloads from the primary operational database.

### Caching Strategies

- **API-Level Caching:** Results from common analytics endpoints (especially for dashboards) may be cached at the API gateway or application level for short durations (e.g., 5-15 minutes) to reduce database load.
- **Client-Side Caching:** Clients consuming the API are encouraged to implement their own caching strategies based on the `Cache-Control` headers provided by the API.

### Asynchronous Report Generation

For very large datasets or computationally intensive custom reports, the API might support asynchronous generation:
1. User requests a report.
2. API returns a `202 Accepted` with a job ID and a status URL.
3. User polls the status URL.
4. Once complete, the status URL provides a link to download the generated report.
(Note: Specific endpoints for async operations would be detailed if implemented.)

### Data Latency

While most analytics aim for near real-time data, some complex aggregations or metrics derived from batch processes might have a certain latency. This should be communicated to users where applicable.

<!-- Further implementation notes on security, rate limiting, and versioning as needed -->

