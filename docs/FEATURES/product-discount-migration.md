# Product Discount Migration Guide

This document outlines the process of migrating from the legacy product-specific discount fields (`specific_discount_type` and `specific_discount_value`) to the new promotional offers system.

## Overview

The Zettaz Cloud POS system is transitioning from directly storing discount information on product records to using a more flexible promotional offers system. This migration involves:

1. Adding a `promotional_offer_id` column to the products table
2. Creating promotional offers for products with existing specific discounts
3. Updating products to reference these new promotional offers
4. Eventually removing the legacy discount fields

## Migration Steps

### 1. Database Schema Update (Completed)

The migration script `backend/migrations/add_promotional_offer_id_to_products.sql` has been executed to:

- Add the `promotional_offer_id` column to the products table
- Create a foreign key constraint to the promotional_offers table
- Add an index for better query performance

### 2. Data Migration

To migrate existing product-specific discounts to the new promotional offers system, run the migration script:

```bash
node backend/scripts/migrate-product-discounts.js
```

This script will:

- Find all products with specific_discount_type and specific_discount_value set
- Create a promotional offer for each product with the same discount parameters
- Update each product to reference its new promotional offer
- Log the migration results for verification

### 3. Verification

After running the migration script, verify that:

1. New promotional offers have been created for products with specific discounts
2. Products are correctly linked to these offers
3. Discounts are correctly applied when adding products to the cart

### 4. Transition Period

During the transition period, the system will:

- Primarily use the `promotional_offer_id` field for new products
- Fall back to legacy discount fields for products that haven't been migrated
- This behavior is implemented in the `addToCart` function in `CartContext.tsx`

### 5. Cleanup (Optional)

Once all products have been migrated and the new system has been verified, you can clean up the legacy fields:

```sql
UPDATE products 
SET 
  specific_discount_type = NULL,
  specific_discount_value = NULL 
WHERE 
  promotional_offer_id IS NOT NULL;
```

## Technical Implementation

The migration involves changes to:

1. **Database**: 
   - Added `promotional_offer_id` column to products table

2. **Backend**:
   - Updated product routes to handle the new field
   - Created migration script for data conversion

3. **Frontend**:
   - Updated Product type definition to include both field systems
   - Enhanced cart functionality to handle both discount approaches
   - Updated product form to allow selecting promotional offers

## Rollback Plan

If issues are encountered:

1. Continue using the legacy discount fields
2. Set `promotional_offer_id` to NULL for affected products
3. Address any issues in the promotional offers implementation
4. Re-run the migration script after fixes
