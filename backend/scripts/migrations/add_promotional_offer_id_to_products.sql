-- Add promotional_offer_id column to products table if it doesn't exist
ALTER TABLE products ADD COLUMN promotional_offer_id CHAR(36) DEFAULT NULL;

-- Add foreign key constraint
ALTER TABLE products ADD CONSTRAINT fk_products_promotional_offers
  FOREIGN KEY (promotional_offer_id) REFERENCES promotional_offers(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for better query performance
CREATE INDEX idx_products_promotional_offer_id ON products(promotional_offer_id);

-- NOTE: Migration path for existing product-specific discounts
-- The following procedure can be used to migrate products with specific_discount_type/value
-- to use promotional offers instead. This is provided as a reference and should be
-- executed separately after careful review.

/*
-- Step 1: Create promotional offers for products with specific discounts
INSERT INTO promotional_offers (id, tenant_id, name, description, discount_type, discount_value, is_active, start_date, end_date, created_at, updated_at)
SELECT 
    UUID() as id,
    tenant_id,
    CONCAT(name, ' - Product Specific Discount') as name,
    CONCAT('Auto-created from product-specific discount for ', name) as description,
    specific_discount_type as discount_type,
    specific_discount_value as discount_value,
    1 as is_active,
    CURRENT_DATE() as start_date,
    DATE_ADD(CURRENT_DATE(), INTERVAL 1 YEAR) as end_date,
    NOW() as created_at,
    NOW() as updated_at
FROM products
WHERE specific_discount_type IS NOT NULL 
  AND specific_discount_value IS NOT NULL
  AND specific_discount_value > 0;

-- Step 2: Link products to their newly created promotional offers
-- This requires a more complex procedure with temporary tables or application code
-- to match the products with their corresponding offers

-- Step 3: After migration is complete and verified, consider removing the old fields
-- ALTER TABLE products DROP COLUMN specific_discount_type;
-- ALTER TABLE products DROP COLUMN specific_discount_value;
*/
