-- =============================================================================
-- 2026-09-05  stores — soft delete + default store
-- =============================================================================
-- Adds the three columns needed for:
--   1. A "default store" per tenant that cannot be deleted through the normal
--      store-delete flow — only by deleting the entire tenant account. The
--      Tenant Admin can change which store is default at any time.
--   2. Soft-delete: deleting a non-default store no longer removes it (or its
--      data) immediately, even if it has products/sales/etc. — it's marked
--      deleted_at/scheduled_purge_at (+30 days) instead, stays out of every
--      normal store list, and can be restored up until the purge date.
--      backend/scripts/purge-expired-stores.js hard-deletes it once that date
--      passes (see that script's header for exactly what it does and does
--      NOT yet cover).
--
-- Idempotent: INFORMATION_SCHEMA.COLUMNS guard + PREPARE/EXECUTE per
-- database/README.md's migration convention. The default-store backfill is
-- also safe to re-run — it only acts on tenants that don't already have a
-- store flagged default.
-- =============================================================================

SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stores' AND COLUMN_NAME = 'is_default_store'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `stores` ADD COLUMN `is_default_store` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_active`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stores' AND COLUMN_NAME = 'deleted_at'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `stores` ADD COLUMN `deleted_at` DATETIME NULL DEFAULT NULL AFTER `is_default_store`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stores' AND COLUMN_NAME = 'scheduled_purge_at'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `stores` ADD COLUMN `scheduled_purge_at` DATETIME NULL DEFAULT NULL AFTER `deleted_at`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill: every tenant with at least one (non-deleted) store but no store
-- yet flagged default gets its oldest store marked default. Safe to re-run —
-- the LEFT JOIN ... IS NULL guard means a tenant that already has a default
-- is left untouched.
--
-- NOTE: an earlier version of this used `WHERE NOT EXISTS (SELECT ... FROM
-- stores s2 ...)` — MySQL rejects that with "You can't specify target table
-- 's' for update in FROM clause" because a correlated subquery referencing
-- the same table being updated isn't allowed, even read-only. Both
-- subqueries below are derived tables (materialized via JOIN), which MySQL
-- does allow.
UPDATE `stores` s
JOIN (
  SELECT tenant_id, MIN(created_at) AS min_created_at
  FROM `stores`
  WHERE deleted_at IS NULL
  GROUP BY tenant_id
) oldest ON s.tenant_id = oldest.tenant_id AND s.created_at = oldest.min_created_at
LEFT JOIN (
  SELECT DISTINCT tenant_id FROM `stores` WHERE is_default_store = 1 AND deleted_at IS NULL
) has_default ON has_default.tenant_id = s.tenant_id
SET s.is_default_store = 1
WHERE s.deleted_at IS NULL
  AND has_default.tenant_id IS NULL;
