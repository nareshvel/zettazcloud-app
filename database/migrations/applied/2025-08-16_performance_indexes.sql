-- Performance Optimization Indexes for Zettaz Cloud Database
-- This script adds indexes to frequently queried tables to improve query performance
-- Run this script after database setup to optimize performance

-- ============================================================================
-- SALES TABLE INDEXES
-- ============================================================================

-- Index for tenant and store filtering (most common query pattern)
CREATE INDEX idx_sales_tenant_store ON sales (tenant_id, store_id);

-- Index for date-based queries (dashboard, reports)
CREATE INDEX idx_sales_created_at ON sales (created_at);

-- Composite index for tenant + date queries (common in dashboard)
CREATE INDEX idx_sales_tenant_date ON sales (tenant_id, created_at);

-- Index for store + date queries (store-specific reports)
CREATE INDEX idx_sales_store_date ON sales (store_id, created_at);

-- Index for payment method analysis
CREATE INDEX idx_sales_payment_method ON sales (payment_method);

-- Index for cashier performance tracking
CREATE INDEX idx_sales_cashier ON sales (cashier_id);

-- ============================================================================
-- SALE_ITEMS TABLE INDEXES
-- ============================================================================

-- Index for sale lookup (most common join)
CREATE INDEX  idx_sale_items_sale_id ON sale_items (sale_id);

-- Index for product analysis
CREATE INDEX  idx_sale_items_product_id ON sale_items (product_id);

-- Composite index for product sales analysis
CREATE INDEX  idx_sale_items_product_sale ON sale_items (product_id, sale_id);

-- ============================================================================
-- PRODUCTS TABLE INDEXES
-- ============================================================================

-- Index for tenant and store filtering
CREATE INDEX  idx_products_tenant_store ON products (tenant_id, store_id);

-- Index for category-based queries
CREATE INDEX  idx_products_category ON products (category_id);

-- Index for barcode lookups (POS operations)
CREATE INDEX  idx_products_barcode ON products (barcode);

-- Index for SKU lookups
CREATE INDEX  idx_products_sku ON products (sku);

-- Index for active products filtering
CREATE INDEX  idx_products_active ON products (is_active);

-- Composite index for tenant + active products
CREATE INDEX  idx_products_tenant_active ON products (tenant_id, is_active);

-- Index for low stock alerts
CREATE INDEX  idx_products_stock_level ON products (stock_level);

-- ============================================================================
-- CUSTOMERS TABLE INDEXES
-- ============================================================================

-- Index for tenant and store filtering
CREATE INDEX  idx_customers_tenant_store ON customers (tenant_id, store_id);

-- Index for email lookups
CREATE INDEX  idx_customers_email ON customers (email);

-- Index for phone lookups
CREATE INDEX  idx_customers_phone ON customers (phone);

-- Index for name searches
CREATE INDEX  idx_customers_name ON customers (first_name, last_name);

-- ============================================================================
-- PAYMENT_TRANSACTIONS TABLE INDEXES
-- ============================================================================

-- Index for sale lookup
CREATE INDEX  idx_payment_transactions_sale_id ON payment_transactions (sale_id);

-- Index for tenant filtering
CREATE INDEX  idx_payment_transactions_tenant ON payment_transactions (tenant_id);

-- Index for date-based queries
CREATE INDEX  idx_payment_transactions_created_at ON payment_transactions (created_at);

-- Index for payment method analysis
CREATE INDEX  idx_payment_transactions_method ON payment_transactions (payment_method_id);

-- ============================================================================
-- INVENTORY_LOGS TABLE INDEXES
-- ============================================================================

-- Index for product tracking
CREATE INDEX  idx_inventory_logs_product ON inventory_logs (product_id);

-- Index for tenant filtering
CREATE INDEX  idx_inventory_logs_tenant ON inventory_logs (tenant_id);

-- Index for date-based queries
CREATE INDEX  idx_inventory_logs_created_at ON inventory_logs (created_at);

-- Composite index for product + date queries
CREATE INDEX  idx_inventory_logs_product_date ON inventory_logs (product_id, created_at);

-- ============================================================================
-- USERS TABLE INDEXES
-- ============================================================================

-- Index for tenant filtering
CREATE INDEX  idx_users_tenant ON users (tenant_id);

-- Index for store filtering
CREATE INDEX  idx_users_store ON users (store_id);

-- Index for email lookups (authentication)
CREATE INDEX  idx_users_email ON users (email);

-- Index for role-based queries
CREATE INDEX  idx_users_role ON users (role_id);

-- Index for active users
CREATE INDEX  idx_users_active ON users (is_active);

-- ============================================================================
-- CATEGORIES TABLE INDEXES
-- ============================================================================

-- Index for tenant filtering
CREATE INDEX  idx_categories_tenant ON categories (tenant_id);

-- Index for active categories
CREATE INDEX  idx_categories_active ON categories (is_active);

-- Composite index for tenant + active categories
CREATE INDEX  idx_categories_tenant_active ON categories (tenant_id, is_active);

-- ============================================================================
-- PURCHASE_ORDERS TABLE INDEXES
-- ============================================================================

-- Index for tenant and store filtering
CREATE INDEX  idx_purchase_orders_tenant_store ON purchase_orders (tenant_id, store_id);

-- Index for supplier filtering
CREATE INDEX  idx_purchase_orders_supplier ON purchase_orders (supplier_id);

-- Index for status filtering
CREATE INDEX  idx_purchase_orders_status ON purchase_orders (status);

-- Index for date-based queries
CREATE INDEX  idx_purchase_orders_created_at ON purchase_orders (created_at);

-- ============================================================================
-- PURCHASE_ORDER_ITEMS TABLE INDEXES
-- ============================================================================

-- Index for purchase order lookup
CREATE INDEX  idx_purchase_order_items_po_id ON purchase_order_items (purchase_order_id);

-- Index for product analysis
CREATE INDEX  idx_purchase_order_items_product ON purchase_order_items (product_id);

-- ============================================================================
-- GOODS_RECEIVED_NOTES TABLE INDEXES
-- ============================================================================

-- Index for tenant and store filtering
CREATE INDEX  idx_grn_tenant_store ON goods_received_notes (tenant_id, store_id);

-- Index for purchase order reference
CREATE INDEX  idx_grn_purchase_order ON goods_received_notes (purchase_order_id);

-- Index for date-based queries
CREATE INDEX  idx_grn_created_at ON goods_received_notes (created_at);

-- ============================================================================
-- GRN_ITEMS TABLE INDEXES
-- ============================================================================

-- Index for GRN lookup
CREATE INDEX  idx_grn_items_grn_id ON grn_items (grn_id);

-- Index for product tracking
CREATE INDEX  idx_grn_items_product ON grn_items (product_id);

-- ============================================================================
-- ROLES AND PERMISSIONS INDEXES
-- ============================================================================

-- Index for tenant-specific roles
CREATE INDEX  idx_roles_tenant ON roles (tenant_id);

-- Index for role permissions lookup
CREATE INDEX  idx_role_permissions_role ON role_permissions (role_id);

-- Index for permission lookup
CREATE INDEX  idx_role_permissions_permission ON role_permissions (permission_id);

-- ============================================================================
-- STORES TABLE INDEXES
-- ============================================================================

-- Index for tenant filtering
CREATE INDEX  idx_stores_tenant ON stores (tenant_id);

-- Index for active stores
CREATE INDEX  idx_stores_active ON stores (is_active);

-- ============================================================================
-- HELD_ORDERS TABLE INDEXES
-- ============================================================================

-- Index for tenant and store filtering
CREATE INDEX  idx_held_orders_tenant_store ON held_orders (tenant_id, store_id);

-- Index for cashier lookup
CREATE INDEX  idx_held_orders_cashier ON held_orders (cashier_id);

-- Index for date-based cleanup
CREATE INDEX  idx_held_orders_created_at ON held_orders (created_at);

-- ============================================================================
-- PROMOTIONAL_OFFERS TABLE INDEXES
-- ============================================================================

-- Index for tenant and store filtering
CREATE INDEX  idx_promotional_offers_tenant_store ON promotional_offers (tenant_id, store_id);

-- Index for active offers
CREATE INDEX  idx_promotional_offers_active ON promotional_offers (is_active);

-- Index for date-based queries (current offers)
CREATE INDEX  idx_promotional_offers_dates ON promotional_offers (start_date, end_date);

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
