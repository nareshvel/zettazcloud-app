/**
 * storageUsageService
 * -----------------------------------------------------------------------------
 * Computes a tenant's current upload storage usage in bytes, for the
 * `storage` plan-limit (see backend/utils/storageSize.js and
 * subscriptionMiddleware.js's withinUsageLimits).
 *
 * All tenant uploads — product images, category images, generic attachments,
 * user avatars — already land under a single tenant-scoped subtree:
 *   backend/uploads/<tenantId>/...
 * (see multerConfig.js's productStorage/categoryStorage and
 * storageService.js's buildKey for attachments/avatars). That means a
 * recursive filesystem walk of that one directory gives an exact, complete
 * answer with zero schema changes or backfill — the tradeoff is a disk walk
 * per check rather than a DB SUM(), acceptable here since this only runs on
 * the (relatively rare) write paths that create new uploads, not on every
 * request.
 *
 * If STORAGE_DRIVER=s3 is ever turned on for real, this function's local-disk
 * walk stops being accurate — it would need an equivalent S3
 * ListObjectsV2 + size-sum implementation for that driver instead.
 */

'use strict';

const path = require('path');
const fs = require('fs').promises;
const { UPLOAD_ROOT } = require('./storageService');

/** Recursively sum file sizes under `dir`. Missing directory = 0 bytes. */
async function sumDirectorySize(dir) {
  let total = 0;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return 0; // tenant has no uploads yet
    throw err;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await sumDirectorySize(full);
    } else if (entry.isFile()) {
      try {
        const stat = await fs.stat(full);
        total += stat.size;
      } catch (_) {
        // File removed between readdir and stat — ignore, not worth failing
        // the whole usage check over a race with a concurrent delete.
      }
    }
  }
  return total;
}

/** Current total upload storage used by a tenant, in bytes. */
async function getTenantStorageBytes(tenantId) {
  if (!tenantId) return 0;
  const tenantDir = path.join(UPLOAD_ROOT, String(tenantId));
  return sumDirectorySize(tenantDir);
}

module.exports = { getTenantStorageBytes };
