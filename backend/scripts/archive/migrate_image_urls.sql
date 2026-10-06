-- =====================================================
-- Image URL Standardization Migration Script
-- =====================================================
-- This script normalizes all image_url values in products and categories tables
-- to follow the standardized format: /uploads/{tenant_id}/{resource_type}/{filename}

-- Start transaction for safety
START TRANSACTION;

-- =====================================================
-- STEP 1: Backup current data for rollback safety
-- =====================================================
CREATE TABLE IF NOT EXISTS migration_backup_products AS 
SELECT id, tenant_id, name, image_url as original_image_url 
FROM products 
WHERE image_url IS NOT NULL;

CREATE TABLE IF NOT EXISTS migration_backup_categories AS 
SELECT id, tenant_id, name, image_url as original_image_url 
FROM categories 
WHERE image_url IS NOT NULL;

-- =====================================================
-- STEP 2: Fix Categories with missing /uploads/ prefix
-- =====================================================
-- Pattern: tenant_id/categories/filename.ext -> /uploads/tenant_id/categories/filename.ext
UPDATE categories 
SET image_url = CONCAT('/uploads/', image_url)
WHERE image_url IS NOT NULL 
  AND image_url NOT LIKE '/uploads/%'
  AND image_url LIKE '%/categories/%'
  AND tenant_id IS NOT NULL;

-- =====================================================
-- STEP 3: Fix Categories with missing tenant_id
-- =====================================================
-- Pattern: /uploads/categories/filename.ext -> /uploads/tenant_id/categories/filename.ext
UPDATE categories 
SET image_url = CONCAT('/uploads/', tenant_id, '/categories/', SUBSTRING_INDEX(image_url, '/', -1))
WHERE image_url IS NOT NULL 
  AND image_url LIKE '/uploads/categories/%'
  AND tenant_id IS NOT NULL;

-- =====================================================
-- STEP 4: Fix Products with store_id in path
-- =====================================================
-- Pattern: /uploads/tenant_id/store_id/timestamp_filename.ext -> /uploads/tenant_id/products/timestamp_filename.ext
UPDATE products 
SET image_url = CONCAT('/uploads/', tenant_id, '/products/', SUBSTRING_INDEX(image_url, '/', -1))
WHERE image_url IS NOT NULL 
  AND image_url LIKE '/uploads/%'
  AND image_url NOT LIKE CONCAT('/uploads/', tenant_id, '/products/%')
  AND tenant_id IS NOT NULL;

-- =====================================================
-- STEP 5: Fix Products with legacy /images/ path
-- =====================================================
-- Pattern: /images/products/product-uuid-timestamp.ext -> /uploads/tenant_id/products/product-uuid-timestamp.ext
UPDATE products 
SET image_url = CONCAT('/uploads/', tenant_id, '/products/', SUBSTRING_INDEX(image_url, '/', -1))
WHERE image_url IS NOT NULL 
  AND image_url LIKE '/images/products/%'
  AND tenant_id IS NOT NULL;

-- =====================================================
-- STEP 6: Handle any remaining malformed paths
-- =====================================================
-- Fix any paths that still don't follow the standard format
UPDATE products 
SET image_url = CONCAT('/uploads/', tenant_id, '/products/', SUBSTRING_INDEX(image_url, '/', -1))
WHERE image_url IS NOT NULL 
  AND image_url NOT LIKE CONCAT('/uploads/', tenant_id, '/products/%')
  AND tenant_id IS NOT NULL
  AND SUBSTRING_INDEX(image_url, '/', -1) != '';

UPDATE categories 
SET image_url = CONCAT('/uploads/', tenant_id, '/categories/', SUBSTRING_INDEX(image_url, '/', -1))
WHERE image_url IS NOT NULL 
  AND image_url NOT LIKE CONCAT('/uploads/', tenant_id, '/categories/%')
  AND tenant_id IS NOT NULL
  AND SUBSTRING_INDEX(image_url, '/', -1) != '';

-- =====================================================
-- STEP 7: Validation and Reporting
-- =====================================================

-- Count records that were migrated
SELECT 'PRODUCTS MIGRATION SUMMARY' as report_type;
SELECT 
  COUNT(*) as total_products_with_images,
  SUM(CASE WHEN image_url LIKE CONCAT('/uploads/', tenant_id, '/products/%') THEN 1 ELSE 0 END) as standardized_products,
  SUM(CASE WHEN image_url NOT LIKE CONCAT('/uploads/', tenant_id, '/products/%') THEN 1 ELSE 0 END) as non_standardized_products
FROM products 
WHERE image_url IS NOT NULL;

SELECT 'CATEGORIES MIGRATION SUMMARY' as report_type;
SELECT 
  COUNT(*) as total_categories_with_images,
  SUM(CASE WHEN image_url LIKE CONCAT('/uploads/', tenant_id, '/categories/%') THEN 1 ELSE 0 END) as standardized_categories,
  SUM(CASE WHEN image_url NOT LIKE CONCAT('/uploads/', tenant_id, '/categories/%') THEN 1 ELSE 0 END) as non_standardized_categories
FROM categories 
WHERE image_url IS NOT NULL;

-- Show any remaining non-standard paths for manual review
SELECT 'NON-STANDARD PRODUCT PATHS' as report_type;
SELECT id, tenant_id, name, image_url 
FROM products 
WHERE image_url IS NOT NULL 
  AND image_url NOT LIKE CONCAT('/uploads/', tenant_id, '/products/%')
LIMIT 10;

SELECT 'NON-STANDARD CATEGORY PATHS' as report_type;
SELECT id, tenant_id, name, image_url 
FROM categories 
WHERE image_url IS NOT NULL 
  AND image_url NOT LIKE CONCAT('/uploads/', tenant_id, '/categories/%')
LIMIT 10;

-- =====================================================
-- COMMIT TRANSACTION
-- =====================================================
-- Uncomment the next line to commit changes (comment out for dry run)
COMMIT;

-- To rollback if needed (run separately):
-- ROLLBACK;

-- To restore from backup if needed (run separately):
-- UPDATE products p 
-- JOIN migration_backup_products b ON p.id = b.id 
-- SET p.image_url = b.original_image_url;
-- 
-- UPDATE categories c 
-- JOIN migration_backup_categories b ON c.id = b.id 
-- SET c.image_url = b.original_image_url;
