-- Promotional Offers Seed Data
-- This script inserts sample promotional offers and their rules for testing

-- Get the default tenant and store IDs
SET @tenant_id = (SELECT id FROM tenants LIMIT 1);
SET @store_id = (SELECT id FROM stores LIMIT 1);

-- Insert promotional offers
INSERT INTO promotional_offers 
(id, tenant_id, store_id, name, description, offer_type, is_active, start_date, end_date, 
priority, minimum_quantity, discount_value, created_at, updated_at)
VALUES
-- Percentage discount offer
(UUID(), @tenant_id, @store_id, 'Summer Sale 20% Off', '20% discount on selected items', 
'percentage_discount', 1, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 
10, 1, 20.00, NOW(), NOW()),

-- Fixed discount offer
(UUID(), @tenant_id, @store_id, 'Fixed $5 Discount', '$5 off on any item', 
'fixed_discount', 1, NOW(), DATE_ADD(NOW(), INTERVAL 15 DAY), 
20, 1, 5.00, NOW(), NOW()),

-- Weekend special
(UUID(), @tenant_id, @store_id, 'Weekend Special 10% Off', '10% discount on weekend purchases', 
'percentage_discount', 1, NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY), 
30, 1, 10.00, NOW(), NOW());

-- Store the IDs of the offers we just created for use in the rules
SET @offer1_id = (SELECT id FROM promotional_offers WHERE name = 'Summer Sale 20% Off' LIMIT 1);
SET @offer2_id = (SELECT id FROM promotional_offers WHERE name = 'Fixed $5 Discount' LIMIT 1);
SET @offer3_id = (SELECT id FROM promotional_offers WHERE name = 'Weekend Special 10% Off' LIMIT 1);

-- Get some product and category IDs to use in rules
SET @product1_id = (SELECT id FROM products LIMIT 1);
SET @product2_id = (SELECT id FROM products ORDER BY id LIMIT 1,1);
SET @category1_id = (SELECT id FROM product_categories LIMIT 1);

-- Insert offer rules
INSERT INTO offer_rules
(id, tenant_id, store_id, offer_id, rule_type, entity_id, quantity)
VALUES
-- Summer Sale applies to a specific product
(UUID(), @tenant_id, @store_id, @offer1_id, 'product', @product1_id, 1),

-- Fixed discount applies to all products
(UUID(), @tenant_id, @store_id, @offer2_id, 'all_products', NULL, 1),

-- Weekend special applies to a specific category
(UUID(), @tenant_id, @store_id, @offer3_id, 'category', @category1_id, 1);

-- Show the inserted data for confirmation
SELECT 'Promotional Offers:' AS '';
SELECT * FROM promotional_offers;

SELECT 'Offer Rules:' AS '';
SELECT * FROM offer_rules;
