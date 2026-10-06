// COMPREHENSIVE FIXES FOR ALL 5 CRITICAL PO/GRN INTEGRATION ISSUES
// Based on end-to-end testing findings

const { pool } = require('../config/db');

async function fixAllCriticalIssues() {
  console.log('🔴 Starting comprehensive fixes for all 5 critical PO/GRN issues...');
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // =====================================================
    // ISSUE 1: Fix PO Item Status Empty Instead of NOT_RECEIVED
    // =====================================================
    console.log('🔧 Issue 1: Fixing empty PO item status values...');
    
    const [emptyStatusItems] = await connection.query(
      'SELECT COUNT(*) as count FROM purchase_order_items WHERE status IS NULL OR status = ""'
    );
    
    if (emptyStatusItems[0].count > 0) {
      await connection.query(
        'UPDATE purchase_order_items SET status = "NOT_RECEIVED" WHERE status IS NULL OR status = ""'
      );
      console.log(`✅ Fixed ${emptyStatusItems[0].count} PO items with empty status`);
    } else {
      console.log('✅ No PO items with empty status found');
    }
    
    // =====================================================
    // ISSUE 2: Fix GRN Header purchase_order_id Population
    // =====================================================
    console.log('🔧 Issue 2: Fixing GRN header purchase_order_id population...');
    
    // Update GRN headers where purchase_order_id is NULL but all items are from same PO
    const [grnsToFix] = await connection.query(`
      SELECT 
        grn.id as grn_id,
        COUNT(DISTINCT gi.purchase_order_id) as unique_po_count,
        MAX(gi.purchase_order_id) as single_po_id
      FROM goods_received_notes grn
      JOIN grn_items gi ON grn.id = gi.grn_id
      WHERE grn.purchase_order_id IS NULL 
        AND gi.purchase_order_id IS NOT NULL
      GROUP BY grn.id
      HAVING COUNT(DISTINCT gi.purchase_order_id) = 1
    `);
    
    for (const grn of grnsToFix) {
      await connection.query(
        'UPDATE goods_received_notes SET purchase_order_id = ? WHERE id = ?',
        [grn.single_po_id, grn.grn_id]
      );
    }
    console.log(`✅ Fixed ${grnsToFix.length} GRN headers with missing purchase_order_id`);
    
    // =====================================================
    // ISSUE 3: Fix GRN Items Losing PO IDs After Status Change
    // =====================================================
    console.log('🔧 Issue 3: Checking for GRN items with missing PO IDs...');
    
    // Restore missing purchase_order_id in grn_items from purchase_order_items
    const [itemsToFix] = await connection.query(`
      UPDATE grn_items gi
      JOIN purchase_order_items poi ON gi.purchase_order_item_id = poi.id
      SET gi.purchase_order_id = poi.purchase_order_id
      WHERE gi.purchase_order_item_id IS NOT NULL 
        AND (gi.purchase_order_id IS NULL OR gi.purchase_order_id != poi.purchase_order_id)
    `);
    console.log(`✅ Fixed ${itemsToFix.affectedRows} GRN items with missing/incorrect purchase_order_id`);
    
    // =====================================================
    // ISSUE 4: Fix products.total_quantity_received
    // =====================================================
    console.log('🔧 Issue 4: Recalculating products.total_quantity_received...');
    
    // Recalculate total_quantity_received for all products based on completed GRNs
    await connection.query(`
      UPDATE products p
      SET total_quantity_received = COALESCE((
        SELECT SUM(gi.quantity_received)
        FROM grn_items gi
        JOIN goods_received_notes grn ON gi.grn_id = grn.id
        WHERE gi.product_id = p.id 
          AND grn.status = 'COMPLETED'
          AND grn.tenant_id = p.tenant_id
      ), 0)
      WHERE p.tenant_id = 'd7f267da-d5d9-4a15-b0d3-31ca710a4492'
    `);
    console.log('✅ Recalculated total_quantity_received for all products');
    
    // =====================================================
    // ISSUE 5: Fix PO Status and Quantity Updates
    // =====================================================
    console.log('🔧 Issue 5: Fixing PO status and quantity updates...');
    
    // Update PO item quantities and status based on completed GRNs
    await connection.query(`
      UPDATE purchase_order_items poi
      SET 
        quantity_received = COALESCE((
          SELECT SUM(gi.quantity_received)
          FROM grn_items gi
          JOIN goods_received_notes grn ON gi.grn_id = grn.id
          WHERE gi.purchase_order_item_id = poi.id 
            AND grn.status = 'COMPLETED'
        ), 0),
        status = CASE
          WHEN COALESCE((
            SELECT SUM(gi.quantity_received)
            FROM grn_items gi
            JOIN goods_received_notes grn ON gi.grn_id = grn.id
            WHERE gi.purchase_order_item_id = poi.id 
              AND grn.status = 'COMPLETED'
          ), 0) = 0 THEN 'NOT_RECEIVED'
          WHEN COALESCE((
            SELECT SUM(gi.quantity_received)
            FROM grn_items gi
            JOIN goods_received_notes grn ON gi.grn_id = grn.id
            WHERE gi.purchase_order_item_id = poi.id 
              AND grn.status = 'COMPLETED'
          ), 0) >= poi.quantity_ordered THEN 'FULLY_RECEIVED'
          ELSE 'PARTIALLY_RECEIVED'
        END
      WHERE EXISTS (
        SELECT 1 FROM grn_items gi 
        WHERE gi.purchase_order_item_id = poi.id
      )
    `);
    console.log('✅ Updated PO item quantities and status');
    
    // Update PO status based on item status
    await connection.query(`
      UPDATE purchase_orders po
      SET status = CASE
        WHEN NOT EXISTS (
          SELECT 1 FROM purchase_order_items poi 
          WHERE poi.purchase_order_id = po.id
        ) THEN po.status
        WHEN (
          SELECT COUNT(*) FROM purchase_order_items poi 
          WHERE poi.purchase_order_id = po.id AND poi.status = 'FULLY_RECEIVED'
        ) = (
          SELECT COUNT(*) FROM purchase_order_items poi 
          WHERE poi.purchase_order_id = po.id
        ) THEN 'RECEIVED'
        WHEN EXISTS (
          SELECT 1 FROM purchase_order_items poi 
          WHERE poi.purchase_order_id = po.id 
            AND poi.status IN ('PARTIALLY_RECEIVED', 'FULLY_RECEIVED')
        ) THEN 'PARTIALLY_RECEIVED'
        ELSE po.status
      END
      WHERE po.tenant_id = 'd7f267da-d5d9-4a15-b0d3-31ca710a4492'
        AND po.status IN ('ORDERED', 'PARTIALLY_RECEIVED')
    `);
    console.log('✅ Updated PO status based on item completion');
    
    await connection.commit();
    console.log('🎉 All 5 critical issues have been systematically fixed!');
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error fixing critical issues:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Export for use in other scripts
module.exports = { fixAllCriticalIssues };

// Run if called directly
if (require.main === module) {
  fixAllCriticalIssues()
    .then(() => {
      console.log('✅ Critical fixes completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Critical fixes failed:', error);
      process.exit(1);
    });
}
