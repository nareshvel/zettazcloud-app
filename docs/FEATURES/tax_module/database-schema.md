# Tax Module Database Schema

## Overview

This document outlines the database tables and relationships that support the tax module in Zettaz Cloud. The schema is designed to handle multi-store tax management, store-specific tax rates, product-specific tax classes, and customer tax exemptions.

## Core Tables

### stores

This table contains store-level tax configuration, including the default tax basis and default tax class.

| Column | Type | Description |
|--------|------|-------------|
| id | CHAR(36) | Primary key |
| name | VARCHAR(255) | Store name |
| default_currency_id | CHAR(36) | Store's default currency |
| is_active | TINYINT(1) | Store active status |
| tax_class_id | CHAR(36) | FK to tax_classes, store's default tax class |
| default_tax_basis | ENUM('INCLUSIVE', 'EXCLUSIVE') | Controls how product prices are interpreted |

#### Indexes
- PRIMARY KEY (`id`)
- FK_stores_tax_classes (`tax_class_id`)

### tax_classes

This table defines categories of taxable items (e.g., "Standard Sales Tax", "Food Items Tax").

| Column | Type | Description |
|--------|------|-------------|
| id | CHAR(36) | Primary key |
| name | VARCHAR(255) | Tax class name |
| description | TEXT | Description of this tax class |
| tenant_id | CHAR(36) | FK to tenants |
| store_id | CHAR(36) | FK to stores, NULL for tenant-wide classes |
| is_active | TINYINT(1) | Class active status |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

#### Indexes
- PRIMARY KEY (`id`)
- FK_tax_classes_tenants (`tenant_id`)
- FK_tax_classes_stores (`store_id`)
- INDEX_tax_classes_name (`name`)

### tax_class_rates

This table defines specific tax rates for each tax class, potentially varying by store.

| Column | Type | Description |
|--------|------|-------------|
| id | CHAR(36) | Primary key |
| tax_class_id | CHAR(36) | FK to tax_classes |
| store_id | CHAR(36) | FK to stores |
| tax_rate_name | VARCHAR(255) | Name of this specific rate |
| rate | DECIMAL(10,4) | Tax rate (e.g., 0.0750 for 7.5%) |
| priority | INT | Rate application priority |
| is_compound | TINYINT(1) | Whether this is applied after other taxes |
| is_active | TINYINT(1) | Rate active status |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

#### Indexes
- PRIMARY KEY (`id`)
- FK_tax_class_rates_tax_classes (`tax_class_id`)
- FK_tax_class_rates_stores (`store_id`)
- INDEX_tax_class_rates_active (`is_active`)

### products

This table includes product-level tax configuration.

| Column | Type | Description |
|--------|------|-------------|
| id | CHAR(36) | Primary key |
| name | VARCHAR(255) | Product name |
| price | DECIMAL(10,2) | Unit price (interpretation depends on store.default_tax_basis) |
| is_taxable | TINYINT(1) | Whether this product is taxable |
| tax_class_id | CHAR(36) | FK to tax_classes, NULL uses store default |
| ... | ... | Other product fields |

#### Indexes
- PRIMARY KEY (`id`)
- FK_products_tax_classes (`tax_class_id`)

### customers

This table includes customer tax exemption details.

| Column | Type | Description |
|--------|------|-------------|
| id | CHAR(36) | Primary key |
| first_name | VARCHAR(255) | First name |
| last_name | VARCHAR(255) | Last name |
| is_tax_exempt | TINYINT(1) | Whether customer is exempt from tax |
| tax_exemption_number | VARCHAR(255) | Tax exemption certificate number |
| ... | ... | Other customer fields |

#### Indexes
- PRIMARY KEY (`id`)
- INDEX_customers_tax_exempt (`is_tax_exempt`)

### orders

This table tracks transaction-level tax information.

| Column | Type | Description |
|--------|------|-------------|
| id | CHAR(36) | Primary key |
| store_id | CHAR(36) | FK to stores |
| customer_id | CHAR(36) | FK to customers, NULL for anonymous |
| subtotal_amount | DECIMAL(10,2) | Subtotal before tax |
| total_tax_amount | DECIMAL(10,2) | Total tax for this order |
| total_amount | DECIMAL(10,2) | Final total including tax |
| tax_basis_at_sale | ENUM('INCLUSIVE', 'EXCLUSIVE') | Store's tax basis at time of order |
| ... | ... | Other order fields |

#### Indexes
- PRIMARY KEY (`id`)
- FK_orders_stores (`store_id`)
- FK_orders_customers (`customer_id`)

### order_items

This table tracks item-level tax calculations.

| Column | Type | Description |
|--------|------|-------------|
| id | CHAR(36) | Primary key |
| order_id | CHAR(36) | FK to orders |
| product_id | CHAR(36) | FK to products |
| quantity | INT | Quantity purchased |
| price | DECIMAL(10,2) | Unit price at time of sale |
| tax_amount | DECIMAL(10,2) | Tax amount for this line item |
| item_total_before_tax | DECIMAL(10,2) | Line total before tax |
| item_total_after_tax | DECIMAL(10,2) | Line total after tax |
| applicable_tax_class_rate_id | CHAR(36) | FK to tax_class_rates applied |
| ... | ... | Other order item fields |

#### Indexes
- PRIMARY KEY (`id`)
- FK_order_items_orders (`order_id`)
- FK_order_items_products (`product_id`)
- FK_order_items_tax_class_rates (`applicable_tax_class_rate_id`)

## Entity Relationship Diagram

```
+-------------+       +--------------+       +----------------+
|   tenants   |<------|  tax_classes |------>|     stores     |
+-------------+       +--------------+       +----------------+
                            ^                       ^
                            |                       |
                            v                       v
                     +----------------+      +----------------+
                     | tax_class_rates|<---->|    products    |
                     +----------------+      +----------------+
                            ^                       ^
                            |                       |
                            v                       v
                     +----------------+      +----------------+
                     |     orders     |----->|  order_items   |
                     +----------------+      +----------------+
                            ^
                            |
                            v
                     +----------------+
                     |   customers    |
                     +----------------+
```

## Migration History

The tax module schema has evolved through several migrations:

1. **Initial Tax Schema**: Created tax_classes and tax_class_rates tables
2. **Store Tax Basis**: Added default_tax_basis to stores table
3. **Product Tax Classes**: Added tax_class_id to products table
4. **Customer Tax Exemption**: Added tax exemption fields to customers
5. **Order Tax Storage**: Enhanced orders and order_items tables with tax fields

The most recent migration removed the `is_inclusive` flag from the `tax_class_rates` table, moving tax basis determination entirely to the store level.

## Important Constraints

1. A tax class rate must be linked to both a tax class and a store
2. Products with NULL tax_class_id use the store's default tax class
3. Tax basis is determined at the store level, not per tax class or rate

## Design Decisions

1. **Item-Wise Taxation**: Each order item stores its own tax amount for granular reporting and accurate returns/refunds
2. **Store-Specific Tax Basis**: The tax basis (inclusive/exclusive) is defined at the store level
3. **Tax Basis at Sale**: The store's tax basis is recorded with each order to preserve historical context
4. **Tax Rate Record**: Each order item records which specific tax rate was applied
5. **Tax Class Hierarchy**: Products can override store tax classes when needed
