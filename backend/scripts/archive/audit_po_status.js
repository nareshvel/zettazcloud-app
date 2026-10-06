#!/usr/bin/env node

/**
 * PO Status Audit Script
 * Systematically audits PO and PO item status updates after GRN actions
 */

const { pool } = require('../config/db');

const auditPoStatus = async () => {
    let connection;
    
    try {
        console.log('🔍 Starting PO Status Audit...\n');
        
        connection = await pool.getConnection();
        
        const tenantId = 'd7f267da-d5d9-4a15-b0d3-31ca710a4492';
        
        // Step 1: Check all POs and their current status
        console.log('📋 Step 1: Current PO Status Overview');
        console.log('=====================================');
        
        const [poOverview] = await connection.query(`
            SELECT 
                po.id,
                po.purchase_order_number,
                po.status as po_status,
                po.received_status,
                po.last_grn_date,
                s.supplier_name,
                COUNT(poi.id) as total_items,
                SUM(CASE WHEN poi.status = 'FULLY_RECEIVED' THEN 1 ELSE 0 END) as fully_received_items,
                SUM(CASE WHEN poi.status = 'PARTIALLY_RECEIVED' THEN 1 ELSE 0 END) as partially_received_items,
                SUM(CASE WHEN poi.status = 'NOT_RECEIVED' THEN 1 ELSE 0 END) as not_received_items
            FROM purchase_orders po
            LEFT JOIN suppliers s ON po.supplier_id = s.id
            LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
            WHERE po.tenant_id = ?
            GROUP BY po.id
            ORDER BY po.created_at DESC
            LIMIT 10
        `, [tenantId]);
        
        console.log('Recent Purchase Orders:');
        poOverview.forEach(po => {
            console.log(`PO ${po.purchase_order_number}:`);
            console.log(`  - Status: ${po.po_status} | Received Status: ${po.received_status}`);
            console.log(`  - Supplier: ${po.supplier_name}`);
            console.log(`  - Items: ${po.total_items} total, ${po.fully_received_items} fully received, ${po.partially_received_items} partial, ${po.not_received_items} not received`);
            console.log(`  - Last GRN Date: ${po.last_grn_date || 'None'}`);
            console.log('');
        });
        
        // Step 2: Check GRNs and their associated POs
        console.log('📄 Step 2: GRN to PO Relationship Analysis');
        console.log('==========================================');
        
        const [grnPoRelation] = await connection.query(`
            SELECT 
                grn.id as grn_id,
                grn.grn_number,
                grn.status as grn_status,
                grn.purchase_order_id,
                po.purchase_order_number,
                po.status as po_status_before_grn,
                po.received_status as po_received_status,
                COUNT(gi.id) as grn_items_count,
                SUM(gi.quantity_received) as total_qty_received
            FROM goods_received_notes grn
            LEFT JOIN purchase_orders po ON grn.purchase_order_id = po.id
            LEFT JOIN grn_items gi ON grn.id = gi.grn_id
            WHERE grn.tenant_id = ?
            GROUP BY grn.id
            ORDER BY grn.created_at DESC
            LIMIT 5
        `, [tenantId]);
        
        console.log('Recent GRNs and their PO impact:');
        grnPoRelation.forEach(grn => {
            console.log(`GRN ${grn.grn_number} (${grn.grn_status}):`);
            console.log(`  - Associated PO: ${grn.purchase_order_number || 'None'}`);
            console.log(`  - PO Status: ${grn.po_status_before_grn || 'N/A'} | Received Status: ${grn.po_received_status || 'N/A'}`);
            console.log(`  - GRN Items: ${grn.grn_items_count}, Total Qty: ${grn.total_qty_received}`);
            console.log('');
        });
        
        // Step 3: Detailed PO Item Status Analysis
        console.log('🔍 Step 3: PO Item Status Analysis');
        console.log('==================================');
        
        const [poItemAnalysis] = await connection.query(`
            SELECT 
                po.purchase_order_number,
                poi.id as item_id,
                p.name as product_name,
                poi.quantity_ordered,
                poi.quantity_received,
                poi.status as item_status,
                poi.item_received_status,
                CASE 
                    WHEN poi.quantity_received >= poi.quantity_ordered THEN 'SHOULD_BE_FULLY_RECEIVED'
                    WHEN poi.quantity_received > 0 THEN 'SHOULD_BE_PARTIALLY_RECEIVED'
                    ELSE 'SHOULD_BE_NOT_RECEIVED'
                END as expected_status
            FROM purchase_order_items poi
            JOIN purchase_orders po ON poi.purchase_order_id = po.id
            LEFT JOIN products p ON poi.product_id = p.id
            WHERE po.tenant_id = ?
            AND poi.quantity_received > 0
            ORDER BY po.purchase_order_number, poi.id
            LIMIT 20
        `, [tenantId]);
        
        console.log('PO Items with received quantities:');
        let statusMismatches = 0;
        poItemAnalysis.forEach(item => {
            const statusMatch = item.item_status === item.expected_status.replace('SHOULD_BE_', '');
            if (!statusMatch) statusMismatches++;
            
            console.log(`${item.purchase_order_number} - ${item.product_name}:`);
            console.log(`  - Ordered: ${item.quantity_ordered}, Received: ${item.quantity_received}`);
            console.log(`  - Current Status: ${item.item_status} | Received Status: ${item.item_received_status}`);
            console.log(`  - Expected Status: ${item.expected_status.replace('SHOULD_BE_', '')} ${statusMatch ? '✅' : '❌'}`);
            console.log('');
        });
        
        console.log(`Status Mismatches Found: ${statusMismatches}`);
        
        // Step 4: Check for orphaned GRN items (not linked to PO items)
        console.log('🔗 Step 4: GRN Item Linkage Analysis');
        console.log('====================================');
        
        const [grnItemLinkage] = await connection.query(`
            SELECT 
                gi.id as grn_item_id,
                gi.grn_id,
                grn.grn_number,
                gi.product_id,
                p.name as product_name,
                gi.quantity_received,
                gi.purchase_order_item_id,
                CASE WHEN gi.purchase_order_item_id IS NULL THEN 'ORPHANED' ELSE 'LINKED' END as linkage_status
            FROM grn_items gi
            JOIN goods_received_notes grn ON gi.grn_id = grn.id
            LEFT JOIN products p ON gi.product_id = p.id
            WHERE grn.tenant_id = ?
            ORDER BY grn.created_at DESC, gi.id
            LIMIT 15
        `, [tenantId]);
        
        console.log('GRN Item Linkage Status:');
        let orphanedItems = 0;
        grnItemLinkage.forEach(item => {
            if (item.linkage_status === 'ORPHANED') orphanedItems++;
            
            console.log(`${item.grn_number} - ${item.product_name}:`);
            console.log(`  - Qty Received: ${item.quantity_received}`);
            console.log(`  - PO Item Link: ${item.purchase_order_item_id || 'None'} (${item.linkage_status}) ${item.linkage_status === 'ORPHANED' ? '⚠️' : '✅'}`);
            console.log('');
        });
        
        console.log(`Orphaned GRN Items Found: ${orphanedItems}`);
        
        // Step 5: Summary and Recommendations
        console.log('📊 Step 5: Audit Summary');
        console.log('========================');
        console.log(`- PO Item Status Mismatches: ${statusMismatches}`);
        console.log(`- Orphaned GRN Items: ${orphanedItems}`);
        
        if (statusMismatches > 0) {
            console.log('\n❌ ISSUE IDENTIFIED: PO item statuses are not being updated correctly after GRN actions');
        }
        
        if (orphanedItems > 0) {
            console.log('\n⚠️  WARNING: Some GRN items are not linked to PO items, which may prevent PO status updates');
        }
        
        if (statusMismatches === 0 && orphanedItems === 0) {
            console.log('\n✅ All PO statuses appear to be correctly maintained');
        }
        
    } catch (error) {
        console.error('❌ Audit failed:', error.message);
        console.error('Stack trace:', error.stack);
    } finally {
        if (connection) {
            connection.release();
        }
        await pool.end();
    }
};

// Execute audit
if (require.main === module) {
    auditPoStatus()
        .then(() => {
            console.log('\n✅ PO Status audit completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ PO Status audit failed:', error);
            process.exit(1);
        });
}

module.exports = { auditPoStatus };
