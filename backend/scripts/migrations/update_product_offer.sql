-- Step 1: Create promotional offers for products with specific discounts
INSERT INTO promotional_offers (
    id, 
    tenant_id,
    store_id,
    name, 
    description, 
    offer_type,
    discount_value, 
    is_active, 
    start_date, 
    end_date,
    minimum_quantity,
    created_at, 
    updated_at
)
SELECT 
    UUID() as id,
    tenant_id,
    store_id,
    CONCAT(name, ' - Product Specific Discount') as name,
    CONCAT('Auto-created from product-specific discount for ', name) as description,
    CASE specific_discount_type
        WHEN 'percentage' THEN 'percentage_discount'
        WHEN 'fixed' THEN 'fixed_discount'
        ELSE 'fixed_discount'
    END as offer_type,
    specific_discount_value as discount_value,
    1 as is_active,
    CURRENT_DATE() as start_date,
    DATE_ADD(CURRENT_DATE(), INTERVAL 1 YEAR) as end_date,
    1 as minimum_quantity,
    NOW() as created_at,
    NOW() as updated_at
FROM products
WHERE specific_discount_type IS NOT NULL 
  AND specific_discount_value IS NOT NULL
  AND specific_discount_value > 0;

-- Step 2: Create a temporary table to store the mapping between products and their new offers
CREATE TEMPORARY TABLE product_offer_mapping AS
SELECT 
    p.id AS product_id,
    po.id AS offer_id
FROM 
    products p
JOIN 
    promotional_offers po ON 
    po.tenant_id = p.tenant_id AND
    po.store_id = p.store_id AND
    po.description = CONCAT('Auto-created from product-specific discount for ', p.name) AND
    ((p.specific_discount_type = 'percentage' AND po.offer_type = 'percentage_discount') OR
     (p.specific_discount_type = 'fixed' AND po.offer_type = 'fixed_discount')) AND
    po.discount_value = p.specific_discount_value
WHERE 
    p.specific_discount_type IS NOT NULL 
    AND p.specific_discount_value IS NOT NULL
    AND p.specific_discount_value > 0;

-- Step 3: Update products with their corresponding promotional offer IDs
UPDATE products p
JOIN product_offer_mapping m ON p.id = m.product_id
SET 
    p.promotional_offer_id = m.offer_id,
    p.updated_at = NOW()
WHERE 
    p.specific_discount_type IS NOT NULL 
    AND p.specific_discount_value IS NOT NULL
    AND p.specific_discount_value > 0;

-- Step 4: Show the results of the migration
SELECT 
    p.id AS product_id,
    p.name AS product_name,
    p.specific_discount_type,
    p.specific_discount_value,
    p.promotional_offer_id,
    po.name AS offer_name,
    po.offer_type,
    po.discount_value
FROM 
    products p
LEFT JOIN 
    promotional_offers po ON p.promotional_offer_id = po.id
WHERE 
    p.promotional_offer_id IS NOT NULL;

-- Drop the temporary table
DROP TEMPORARY TABLE IF EXISTS product_offer_mapping;