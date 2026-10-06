-- =====================================================
-- Performance Analysis - Identify Slow Queries and Data Issues
-- =====================================================

-- Step 1: Check database connection and basic performance
SELECT 'DATABASE_STATUS' as check_type, 
       CONNECTION_ID() as connection_id,
       NOW() as current_time,
       @@version as mysql_version;

-- Step 2: Analyze table sizes and row counts
SELECT 'TABLE_SIZES' as check_type,
       table_name,
       table_rows,
       ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb,
       ROUND((data_length / 1024 / 1024), 2) AS data_mb,
       ROUND((index_length / 1024 / 1024), 2) AS index_mb
FROM information_schema.tables 
WHERE table_schema = DATABASE()
ORDER BY (data_length + index_length) DESC;

-- Step 3: Check for missing indexes on foreign keys
SELECT 'MISSING_INDEXES' as check_type,
       t.table_name,
       c.column_name,
       c.referenced_table_name,
       c.referenced_column_name
FROM information_schema.table_constraints t
JOIN information_schema.key_column_usage c ON t.constraint_name = c.constraint_name
WHERE t.constraint_type = 'FOREIGN KEY'
AND t.table_schema = DATABASE()
AND NOT EXISTS (
    SELECT 1 FROM information_schema.statistics s
    WHERE s.table_schema = DATABASE()
    AND s.table_name = c.table_name
    AND s.column_name = c.column_name
    AND s.seq_in_index = 1
);

-- Step 4: Check for large tables without proper pagination
SELECT 'LARGE_TABLES_ANALYSIS' as check_type,
       table_name,
       table_rows,
       CASE 
         WHEN table_rows > 100000 THEN '❌ VERY LARGE - Needs pagination'
         WHEN table_rows > 10000 THEN '⚠️ LARGE - Consider pagination'
         WHEN table_rows > 1000 THEN '✅ MEDIUM - OK'
         ELSE '✅ SMALL - OK'
       END as performance_status
FROM information_schema.tables 
WHERE table_schema = DATABASE()
AND table_type = 'BASE TABLE'
ORDER BY table_rows DESC;

-- Step 5: Analyze recent sales data volume (potential performance bottleneck)
SELECT 'SALES_DATA_VOLUME' as check_type,
       DATE(created_at) as date,
       COUNT(*) as daily_sales_count,
       CASE 
         WHEN COUNT(*) > 1000 THEN '❌ HIGH VOLUME - May cause slow loading'
         WHEN COUNT(*) > 100 THEN '⚠️ MEDIUM VOLUME - Monitor performance'
         ELSE '✅ LOW VOLUME - OK'
       END as performance_impact
FROM sales 
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 10;

-- Step 6: Check for slow permission queries (RBAC performance)
SELECT 'PERMISSION_QUERY_ANALYSIS' as check_type,
       COUNT(DISTINCT p.id) as total_permissions,
       COUNT(DISTINCT r.id) as total_roles,
       COUNT(rp.id) as total_role_permissions,
       CASE 
         WHEN COUNT(rp.id) > 1000 THEN '❌ HIGH - May cause slow auth checks'
         WHEN COUNT(rp.id) > 500 THEN '⚠️ MEDIUM - Monitor auth performance'
         ELSE '✅ LOW - OK'
       END as auth_performance_status
FROM permissions p
LEFT JOIN role_permissions rp ON p.id = rp.permission_id
LEFT JOIN roles r ON rp.role_id = r.id;

-- Step 7: Check for duplicate or orphaned data
SELECT 'DATA_INTEGRITY_CHECK' as check_type,
       'Orphaned role_permissions' as issue_type,
       COUNT(*) as count
FROM role_permissions rp
LEFT JOIN roles r ON rp.role_id = r.id
WHERE r.id IS NULL

UNION ALL

SELECT 'DATA_INTEGRITY_CHECK' as check_type,
       'Orphaned role_permissions (permissions)' as issue_type,
       COUNT(*) as count
FROM role_permissions rp
LEFT JOIN permissions p ON rp.permission_id = p.id
WHERE p.id IS NULL;

-- =====================================================
-- This analysis will help identify performance bottlenecks
-- =====================================================
