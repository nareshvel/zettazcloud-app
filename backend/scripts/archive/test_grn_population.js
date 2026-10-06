const { pool } = require('../config/db');

async function checkAndPopulateGRNs() {
  try {
    const [rows] = await pool.execute('SELECT COUNT(*) as count FROM goods_received_notes');
    console.log('Current GRN count:', rows[0].count);

    if (rows[0].count === 0) {
      console.log('No GRNs found. Creating test GRNs...');
      
      // Insert test GRNs
      const testGRNs = [
        {
          id: 'test-grn-001',
          grn_number: 'GRN-2025-001',
          tenant_id: 'test-tenant-001',
          store_id: 'test-store-001',
          purchase_order_id: 'test-po-001',
          supplier_id: 'test-supplier-001',
          received_date: new Date(),
          status: 'DRAFT',
          total_amount: 1000.00,
          notes: 'Test GRN 1',
          created_by: 'test-user-001',
          updated_by: 'test-user-001'
        },
        {
          id: 'test-grn-002',
          grn_number: 'GRN-2025-002',
          tenant_id: 'test-tenant-001',
          store_id: 'test-store-001',
          purchase_order_id: 'test-po-002',
          supplier_id: 'test-supplier-002',
          received_date: new Date(),
          status: 'COMPLETED',
          total_amount: 2500.00,
          notes: 'Test GRN 2',
          created_by: 'test-user-001',
          updated_by: 'test-user-001'
        }
      ];

      for (const grn of testGRNs) {
        await pool.execute(`
          INSERT INTO goods_received_notes 
          (id, grn_number, tenant_id, store_id, purchase_order_id, supplier_id, received_date, status, total_amount, notes, created_by, updated_by) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          grn.id, grn.grn_number, grn.tenant_id, grn.store_id, grn.purchase_order_id,
          grn.supplier_id, grn.received_date, grn.status, grn.total_amount, grn.notes,
          grn.created_by, grn.updated_by
        ]);
      }
      
      console.log('Test GRNs created successfully!');
    } else {
      console.log('GRNs already exist. Showing latest:');
      const [latest] = await pool.execute('SELECT * FROM goods_received_notes ORDER BY created_at DESC LIMIT 5');
      console.log(latest);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkAndPopulateGRNs();
