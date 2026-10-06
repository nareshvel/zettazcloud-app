const { pool } = require('../config/db');

async function debugGRNFiltering() {
  try {
    console.log('=== GRN Debugging Report ===');
    
    // Check all GRNs
    const [allGrns] = await pool.execute('SELECT id, grn_number, tenant_id, store_id, status, created_at FROM goods_received_notes ORDER BY created_at DESC');
    console.log('All GRNs in database:', allGrns.length);
    console.table(allGrns);

    // Check unique tenant IDs
    const [tenantIds] = await pool.execute('SELECT DISTINCT tenant_id FROM goods_received_notes');
    console.log('Unique tenant IDs in GRNs:', tenantIds.map(t => t.tenant_id));

    // Check if there are any users and their tenant IDs
    const [users] = await pool.execute('SELECT id, email, tenant_id FROM users LIMIT 5');
    console.log('Sample users:');
    console.table(users);

    // Check current tenant context (using the GRNs we found)
    const targetTenantId = 'd7f267da-d5d9-4a15-b0d3-31ca710a4492'; // From the GRNs
    console.log('Target tenant ID for filtering:', targetTenantId);

    // Filter GRNs by this tenant
    const [filteredGrns] = await pool.execute(
      'SELECT id, grn_number, tenant_id, store_id, status, created_at FROM goods_received_notes WHERE tenant_id = ?',
      [targetTenantId]
    );
    console.log(`GRNs for tenant ${targetTenantId}:`, filteredGrns.length);
    console.table(filteredGrns);

    // Check if there are any stores
    const [stores] = await pool.execute('SELECT id, name, tenant_id FROM stores');
    console.log('Available stores:');
    console.table(stores);

    console.log('=== End Report ===');

  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await pool.end();
  }
}

debugGRNFiltering();
