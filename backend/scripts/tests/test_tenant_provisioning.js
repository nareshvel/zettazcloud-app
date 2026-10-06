#!/usr/bin/env node
/**
 * Simple integration test for TenantProvisioningService.
 * Usage: TENANT_ID=<uuid> node backend/scripts/tests/test_tenant_provisioning.js
 */
const { pool } = require('../../config/db');
const TenantProvisioningService = require('../../services/tenantProvisioningService');

(async () => {
  const tenantId = process.env.TENANT_ID;
  if (!tenantId) {
    console.error('TENANT_ID env var is required');
    process.exit(1);
  }

  try {
    console.log('Starting provisioning test for tenant:', tenantId);
    const result = await TenantProvisioningService.provisionTenant(tenantId, { requestedBy: 'test-script' });
    console.log('Provisioning result:', JSON.stringify(result, null, 2));

    const conn = await pool.getConnection();
    try {
      const [roles] = await conn.execute(
        "SELECT name, COUNT(rp.permission_id) AS perm_count FROM roles r LEFT JOIN role_permissions rp ON r.id = rp.role_id WHERE r.tenant_id = ? AND r.name IN ('Store Manager','Cashier') GROUP BY r.id",
        [tenantId]
      );
      const [stores] = await conn.execute('SELECT id, name FROM stores WHERE tenant_id = ?', [tenantId]);
      console.log('Roles summary:', roles);
      console.log('Stores count:', stores.length);
    } finally {
      pool.releaseConnection(conn);
    }

    console.log('✅ Test completed');
    process.exit(0);
  } catch (e) {
    console.error('❌ Test failed:', e);
    process.exit(2);
  }
})();
