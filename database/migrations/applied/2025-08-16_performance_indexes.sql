-- Performance Optimization Indexes for Zettaz Cloud Database
-- This script adds indexes to frequently queried tables to improve query performance
-- Run this script after database setup to optimize performance

-- ============================================================================
-- SALES TABLE INDEXES
-- ============================================================================

-- Index for tenant and store filtering (most common query pattern)
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sales' AND INDEX_NAME='idx_sales_tenant_store');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_sales_tenant_store` ON sales (tenant_id, store_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for date-based queries (dashboard, reports)
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sales' AND INDEX_NAME='idx_sales_created_at');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_sales_created_at` ON sales (created_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Composite index for tenant + date queries (common in dashboard)
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sales' AND INDEX_NAME='idx_sales_tenant_date');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_sales_tenant_date` ON sales (tenant_id, created_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for store + date queries (store-specific reports)
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sales' AND INDEX_NAME='idx_sales_store_date');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_sales_store_date` ON sales (store_id, created_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for payment method analysis
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sales' AND INDEX_NAME='idx_sales_payment_method');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_sales_payment_method` ON sales (payment_method)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for cashier performance tracking
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sales' AND INDEX_NAME='idx_sales_cashier');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_sales_cashier` ON sales (cashier_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================================
-- SALE_ITEMS TABLE INDEXES
-- ============================================================================

-- Index for sale lookup (most common join)
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sale_items' AND INDEX_NAME='idx_sale_items_sale_id');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_sale_items_sale_id` ON sale_items (sale_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for product analysis
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sale_items' AND INDEX_NAME='idx_sale_items_product_id');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_sale_items_product_id` ON sale_items (product_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Composite index for product sales analysis
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sale_items' AND INDEX_NAME='idx_sale_items_product_sale');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_sale_items_product_sale` ON sale_items (product_id, sale_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================================
-- PRODUCTS TABLE INDEXES
-- ============================================================================

-- Index for tenant and store filtering
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='products' AND INDEX_NAME='idx_products_tenant_store');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_products_tenant_store` ON products (tenant_id, store_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for category-based queries
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='products' AND INDEX_NAME='idx_products_category');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_products_category` ON products (category_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for barcode lookups (POS operations)
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='products' AND INDEX_NAME='idx_products_barcode');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_products_barcode` ON products (barcode)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for SKU lookups
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='products' AND INDEX_NAME='idx_products_sku');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_products_sku` ON products (sku)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for active products filtering
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='products' AND INDEX_NAME='idx_products_active');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_products_active` ON products (is_active)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Composite index for tenant + active products
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='products' AND INDEX_NAME='idx_products_tenant_active');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_products_tenant_active` ON products (tenant_id, is_active)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for low stock alerts
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='products' AND INDEX_NAME='idx_products_stock_level');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_products_stock_level` ON products (stock_quantity)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================================
-- CUSTOMERS TABLE INDEXES
-- ============================================================================

-- Index for tenant and store filtering
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customers' AND INDEX_NAME='idx_customers_tenant_store');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_customers_tenant_store` ON customers (tenant_id, store_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for email lookups
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customers' AND INDEX_NAME='idx_customers_email');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_customers_email` ON customers (email)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for phone lookups
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customers' AND INDEX_NAME='idx_customers_phone');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_customers_phone` ON customers (phone_number)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for name searches
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customers' AND INDEX_NAME='idx_customers_name');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_customers_name` ON customers (first_name, last_name)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================================
-- PAYMENT_TRANSACTIONS TABLE INDEXES
-- ============================================================================

-- Index for sale lookup
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_transactions' AND INDEX_NAME='idx_payment_transactions_sale_id');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_payment_transactions_sale_id` ON payment_transactions (sale_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for tenant filtering
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_transactions' AND INDEX_NAME='idx_payment_transactions_tenant');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_payment_transactions_tenant` ON payment_transactions (tenant_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for date-based queries
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_transactions' AND INDEX_NAME='idx_payment_transactions_created_at');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_payment_transactions_created_at` ON payment_transactions (created_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for payment method analysis
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_transactions' AND INDEX_NAME='idx_payment_transactions_method');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_payment_transactions_method` ON payment_transactions (payment_method_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================================
-- INVENTORY_LOGS TABLE INDEXES
-- ============================================================================

-- Index for product tracking
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inventory_logs' AND INDEX_NAME='idx_inventory_logs_product');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_inventory_logs_product` ON inventory_logs (product_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for tenant filtering
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inventory_logs' AND INDEX_NAME='idx_inventory_logs_tenant');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_inventory_logs_tenant` ON inventory_logs (tenant_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for date-based queries
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inventory_logs' AND INDEX_NAME='idx_inventory_logs_created_at');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_inventory_logs_created_at` ON inventory_logs (created_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Composite index for product + date queries
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inventory_logs' AND INDEX_NAME='idx_inventory_logs_product_date');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_inventory_logs_product_date` ON inventory_logs (product_id, created_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================================
-- USERS TABLE INDEXES
-- ============================================================================

-- Index for tenant filtering
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND INDEX_NAME='idx_users_tenant');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_users_tenant` ON users (tenant_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for store filtering
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND INDEX_NAME='idx_users_store');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_users_store` ON users (store_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for email lookups (authentication)
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND INDEX_NAME='idx_users_email');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_users_email` ON users (email)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for role-based queries
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='user_roles' AND INDEX_NAME='idx_users_role');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_users_role` ON user_roles (role_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for active users
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND INDEX_NAME='idx_users_active');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_users_active` ON users (is_active)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================================
-- CATEGORIES TABLE INDEXES
-- ============================================================================

-- Index for tenant filtering
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='categories' AND INDEX_NAME='idx_categories_tenant');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_categories_tenant` ON categories (tenant_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for active categories
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='categories' AND INDEX_NAME='idx_categories_active');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_categories_active` ON categories (is_active)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Composite index for tenant + active categories
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='categories' AND INDEX_NAME='idx_categories_tenant_active');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_categories_tenant_active` ON categories (tenant_id, is_active)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================================
-- PURCHASE_ORDERS TABLE INDEXES
-- ============================================================================

-- Index for tenant and store filtering
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='purchase_orders' AND INDEX_NAME='idx_purchase_orders_tenant_store');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_purchase_orders_tenant_store` ON purchase_orders (tenant_id, store_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for supplier filtering
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='purchase_orders' AND INDEX_NAME='idx_purchase_orders_supplier');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_purchase_orders_supplier` ON purchase_orders (supplier_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for status filtering
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='purchase_orders' AND INDEX_NAME='idx_purchase_orders_status');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_purchase_orders_status` ON purchase_orders (status)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for date-based queries
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='purchase_orders' AND INDEX_NAME='idx_purchase_orders_created_at');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_purchase_orders_created_at` ON purchase_orders (created_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================================
-- PURCHASE_ORDER_ITEMS TABLE INDEXES
-- ============================================================================

-- Index for purchase order lookup
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='purchase_order_items' AND INDEX_NAME='idx_purchase_order_items_po_id');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_purchase_order_items_po_id` ON purchase_order_items (purchase_order_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for product analysis
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='purchase_order_items' AND INDEX_NAME='idx_purchase_order_items_product');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_purchase_order_items_product` ON purchase_order_items (product_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================================
-- GOODS_RECEIVED_NOTES TABLE INDEXES
-- ============================================================================

-- Index for tenant and store filtering
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='goods_received_notes' AND INDEX_NAME='idx_grn_tenant_store');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_grn_tenant_store` ON goods_received_notes (tenant_id, store_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for purchase order reference
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='goods_received_notes' AND INDEX_NAME='idx_grn_purchase_order');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_grn_purchase_order` ON goods_received_notes (purchase_order_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for date-based queries
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='goods_received_notes' AND INDEX_NAME='idx_grn_created_at');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_grn_created_at` ON goods_received_notes (created_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================================
-- GRN_ITEMS TABLE INDEXES
-- ============================================================================

-- Index for GRN lookup
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='grn_items' AND INDEX_NAME='idx_grn_items_grn_id');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_grn_items_grn_id` ON grn_items (grn_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for product tracking
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='grn_items' AND INDEX_NAME='idx_grn_items_product');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_grn_items_product` ON grn_items (product_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================================
-- ROLES AND PERMISSIONS INDEXES
-- ============================================================================

-- Index for tenant-specific roles
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='roles' AND INDEX_NAME='idx_roles_tenant');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_roles_tenant` ON roles (tenant_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for role permissions lookup
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='role_permissions' AND INDEX_NAME='idx_role_permissions_role');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_role_permissions_role` ON role_permissions (role_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for permission lookup
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='role_permissions' AND INDEX_NAME='idx_role_permissions_permission');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_role_permissions_permission` ON role_permissions (permission_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================================
-- STORES TABLE INDEXES
-- ============================================================================

-- Index for tenant filtering
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stores' AND INDEX_NAME='idx_stores_tenant');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_stores_tenant` ON stores (tenant_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for active stores
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stores' AND INDEX_NAME='idx_stores_active');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_stores_active` ON stores (is_active)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================================
-- HELD_ORDERS TABLE INDEXES
-- ============================================================================

-- Index for tenant and store filtering
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='held_orders' AND INDEX_NAME='idx_held_orders_tenant_store');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_held_orders_tenant_store` ON held_orders (tenant_id, store_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for cashier lookup
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='held_orders' AND INDEX_NAME='idx_held_orders_cashier');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_held_orders_cashier` ON held_orders (cashier_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for date-based cleanup
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='held_orders' AND INDEX_NAME='idx_held_orders_created_at');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_held_orders_created_at` ON held_orders (created_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================================
-- PROMOTIONAL_OFFERS TABLE INDEXES
-- ============================================================================

-- Index for tenant and store filtering
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='promotional_offers' AND INDEX_NAME='idx_promotional_offers_tenant_store');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_promotional_offers_tenant_store` ON promotional_offers (tenant_id, store_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for active offers
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='promotional_offers' AND INDEX_NAME='idx_promotional_offers_active');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_promotional_offers_active` ON promotional_offers (is_active)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for date-based queries (current offers)
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='promotional_offers' AND INDEX_NAME='idx_promotional_offers_dates');
SET @sql := IF(@idx=0, 'CREATE INDEX `idx_promotional_offers_dates` ON promotional_offers (start_date, end_date)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================================
-- PERFORMANCE MONITORING QUERIES
-- ============================================================================

-- Use these queries to monitor index usage and performance:

-- Check index usage:
-- SELECT 
--   TABLE_NAME,
--   INDEX_NAME,
--   CARDINALITY,
--   NULLABLE
-- FROM INFORMATION_SCHEMA.STATISTICS 
-- WHERE TABLE_SCHEMA = 'digitpulse_zcloud'
-- ORDER BY TABLE_NAME, INDEX_NAME;

-- Check slow queries:
-- SELECT 
--   query_time,
--   lock_time,
--   rows_sent,
--   rows_examined,
--   sql_text
-- FROM mysql.slow_log 
-- ORDER BY query_time DESC 
-- LIMIT 10;

-- ============================================================================
-- MAINTENANCE NOTES
-- ============================================================================

-- 1. Monitor index usage regularly using EXPLAIN on frequent queries
-- 2. Consider removing unused indexes to improve write performance
-- 3. Update statistics regularly: ANALYZE TABLE table_name;
-- 4. Monitor index fragmentation and rebuild if necessary
-- 5. Test query performance before and after index changes

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

SELECT 'Performance indexes have been created successfully!' as message;
