# Promotional Offers Database Schema

This document outlines the database schema used for the promotional offers system in Zettaz Cloud.

## Table Structure

### promotional_offers

Central table that stores all promotional offers configurations.

| Column                  | Type                    | Description                                      |
|-------------------------|--------------------------|-------------------------------------------------|
| id                      | CHAR(36)                 | Primary key (UUID)                              |
| tenant_id               | CHAR(36)                 | Tenant identifier                               |
| store_id                | CHAR(36)                 | Store identifier                                |
| name                    | VARCHAR(255)             | Name of the offer                               |
| description             | TEXT                     | Detailed description (optional)                 |
| offer_type              | ENUM                     | Type of offer (see below)                       |
| discount_value          | DECIMAL(10,2)            | Discount amount or percentage                   |
| start_date              | DATETIME                 | When the offer becomes active                   |
| end_date                | DATETIME                 | When the offer expires (optional)               |
| is_active               | BOOLEAN                  | Whether the offer is currently active           |
| priority                | INT                      | Order of application when multiple offers apply |
| max_uses_per_customer   | INT                      | Limit per customer (optional)                   |
| max_total_uses          | INT                      | Total usage limit (optional)                    |
| minimum_quantity        | INT                      | Minimum purchase quantity                       |
| minimum_purchase_amount | DECIMAL(10,2)            | Minimum purchase amount (optional)              |
| created_by_user_id      | CHAR(36)                 | User who created the offer                      |
| updated_by_user_id      | CHAR(36)                 | User who last updated the offer                 |
| created_at              | TIMESTAMP                | Creation timestamp                              |
| updated_at              | TIMESTAMP                | Last update timestamp                           |

**Offer Types:**
- `percentage_discount`: Percentage off regular price
- `fixed_discount`: Fixed amount off regular price
- `buy_x_get_y`: Buy X items, get Y items free
- `bundle_price`: Special price for bundled items
- `tiered_pricing`: Volume-based pricing (price decreases as quantity increases)

**Indexes:**
- Primary Key: `id`
- `idx_promotional_offers_tenant` on `tenant_id`
- `idx_promotional_offers_store` on `store_id`

### offer_rules

Defines which products or categories an offer applies to.

| Column     | Type                    | Description                                      |
|------------|--------------------------|-------------------------------------------------|
| id         | CHAR(36)                 | Primary key (UUID)                              |
| tenant_id  | CHAR(36)                 | Tenant identifier                               |
| store_id   | CHAR(36)                 | Store identifier                                |
| offer_id   | CHAR(36)                 | Foreign key to promotional_offers.id            |
| rule_type  | ENUM                     | Type of rule (product, category, all_products)  |
| entity_id  | CHAR(36)                 | Product or category ID (null for all_products)  |
| quantity   | INT                      | Required quantity for this rule                 |
| created_at | TIMESTAMP                | Creation timestamp                              |
| updated_at | TIMESTAMP                | Last update timestamp                           |

**Rule Types:**
- `product`: Rule applies to a specific product
- `category`: Rule applies to all products in a category
- `all_products`: Rule applies to all products in the store

**Indexes:**
- Primary Key: `id`
- `idx_offer_rule` on `(offer_id, rule_type)`
- `idx_offer_rule_store` on `store_id`
- Foreign Key: `offer_id` references `promotional_offers(id)`

### offer_usage

Tracks when offers are used by customers.

| Column      | Type                    | Description                                      |
|-------------|--------------------------|-------------------------------------------------|
| id          | CHAR(36)                 | Primary key (UUID)                              |
| tenant_id   | CHAR(36)                 | Tenant identifier                               |
| store_id    | CHAR(36)                 | Store identifier                                |
| offer_id    | CHAR(36)                 | Foreign key to promotional_offers.id            |
| customer_id | CHAR(36)                 | Customer who used the offer                     |
| order_id    | CHAR(36)                 | Order where offer was applied                   |
| used_at     | TIMESTAMP                | When the offer was used                         |

**Indexes:**
- Primary Key: `id`
- `idx_offer_customer` on `(offer_id, customer_id)`
- `idx_offer_usage_store` on `store_id`
- Foreign Key: `offer_id` references `promotional_offers(id)`

### price_tiers (Pending Implementation)

Stores tiered pricing information for volume-based discounts.

| Column     | Type                    | Description                                      |
|------------|--------------------------|-------------------------------------------------|
| id         | CHAR(36)                 | Primary key (UUID)                              |
| tenant_id  | CHAR(36)                 | Tenant identifier                               |
| store_id   | CHAR(36)                 | Store identifier                                |
| offer_id   | CHAR(36)                 | Foreign key to promotional_offers.id            |
| quantity   | INT                      | Minimum quantity for this tier                  |
| price      | DECIMAL(10,2)            | Price per unit at this tier                     |
| created_at | TIMESTAMP                | Creation timestamp                              |
| updated_at | TIMESTAMP                | Last update timestamp                           |

**Indexes:**
- Primary Key: `id`
- Unique Key: `unique_offer_quantity` on `(offer_id, quantity)`
- Foreign Key: `offer_id` references `promotional_offers(id)`

## Relationships

- One promotional offer can have multiple rules (one-to-many)
- One promotional offer can have multiple usage records (one-to-many)
- One promotional offer can have multiple price tiers (one-to-many)
- Products can reference promotional offers (products.promotional_offer_id)

## Database Migrations

The main tables were created in `item_wise_tax_discount_migration.sql` with additional column for products in `add_promotional_offer_id_to_products.sql`.

Migration for the price_tiers table is pending implementation.
