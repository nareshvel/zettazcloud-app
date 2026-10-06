#!/usr/bin/env node
/**
 * Backfill role permissions for existing tenants.
 * Uses PermissionSeedingService.backfillExistingRoles(null) to process all tenants.
 */
const PermissionSeedingService = require('../services/permissionSeedingService');

(async () => {
  try {
    const updated = await PermissionSeedingService.backfillExistingRoles(null);
    console.log(`✅ Backfill complete. Updated roles: ${updated}`);
    process.exit(0);
  } catch (e) {
    console.error('❌ Backfill failed:', e);
    process.exit(1);
  }
})();
