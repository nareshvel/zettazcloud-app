const { pool } = require('../config/db');

async function checkGRNs() {
  try {
    // Check if GRNs exist
    const [countRows] = await pool.execute('SELECT COUNT(*) as count FROM goods_received_notes');
    console.log('Total GRNs in database:', countRows[0].count);

    if (countRows[0].count > 0) {
      console.log('Existing GRNs:');
      const [grns] = await pool.execute('SELECT id, grn_number, status, tenant_id, store_id, created_at FROM goods_received_notes ORDER BY created_at DESC LIMIT 10');
      console.table(grns);
    } else {
      console.log('No GRNs found in database');
    }

    // Check if there are any purchase orders to create GRNs from
    const [poCount] = await pool.execute('SELECT COUNT(*) as count FROM purchase_orders');
    console.log('Total Purchase Orders:', poCount[0].count);

    if (poCount[0].count > 0) {
      const [pos] = await pool.execute('SELECT id, order_number, status, tenant_id, store_id FROM purchase_orders ORDER BY created_at DESC LIMIT 5');
      console.log('Available Purchase Orders:');
      console.table(pos);
    }

  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await pool.end();
  }
}

checkGRNs();
