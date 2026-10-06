# Database Migrations

This directory contains SQL migration scripts for database schema changes.

## Available Migrations

### Add Promotional Offer ID to Products Table

**File:** `add_promotional_offer_id_to_products.sql`

**Purpose:** Adds a `promotional_offer_id` column to the products table to support product-specific discounts.

**How to run:**

```bash
# Connect to your MySQL database
mysql -u [username] -p [database_name] < migrations/add_promotional_offer_id_to_products.sql

# Example:
# mysql -u root -p zettaz_cloud < migrations/add_promotional_offer_id_to_products.sql
```

**What it does:**
1. Adds a `promotional_offer_id` CHAR(36) column to the products table
2. Creates a foreign key constraint to ensure referential integrity
3. Creates an index on this column for better query performance

## Migration Strategy for Existing Product Discounts

The products table currently has `specific_discount_type` and `specific_discount_value` fields that will eventually be replaced by the promotional offers system. The migration script includes commented SQL that demonstrates how to:

1. Create promotional offers for products with existing specific discounts
2. Link products to their newly created promotional offers

**To migrate existing product-specific discounts:**

1. Review the commented SQL in the migration script
2. Execute the migration in a test environment first
3. After verification, run in production
4. Consider removing the old discount fields after a transition period

**Note:** The migration from old discount fields to promotional offers should be done carefully, preferably during a maintenance window when the system is not in active use.
