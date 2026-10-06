#!/usr/bin/env node

/**
 * Apply Performance Indexes Script
 * This script applies database performance indexes to improve query performance
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'digitpulse_zcloud',
  port: process.env.MYSQL_PORT || 3306,
  multipleStatements: true
};

async function applyPerformanceIndexes() {
  let connection;
  
  try {
    console.log('🔗 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('📖 Reading performance indexes SQL file...');
    const sqlFilePath = path.join(__dirname, '..', '..', 'database', 'performance_indexes.sql');
    const sqlContent = await fs.readFile(sqlFilePath, 'utf8');
    
    console.log('⚡ Applying performance indexes...');
    const startTime = Date.now();
    
    // Extract CREATE INDEX statements from SQL content
    const createIndexRegex = /CREATE INDEX[^;]+;/gi;
    const indexStatements = sqlContent.match(createIndexRegex) || [];
    
    let successCount = 0;
    let skipCount = 0;
    
    console.log(`Found ${indexStatements.length} CREATE INDEX statements to execute...`);
    
    for (const statement of indexStatements) {
      const cleanStatement = statement.trim();
      if (cleanStatement) {
        try {
          await connection.execute(cleanStatement);
          const indexName = cleanStatement.match(/idx_\w+/)?.[0] || 'unknown';
          console.log(`✅ Created index: ${indexName}`);
          successCount++;
        } catch (error) {
          if (error.code === 'ER_DUP_KEYNAME') {
            const indexName = cleanStatement.match(/idx_\w+/)?.[0] || 'unknown';
            console.log(`⏭️  Index already exists: ${indexName}`);
            skipCount++;
          } else {
            console.error(`❌ Error creating index: ${error.message}`);
            console.error(`Statement: ${cleanStatement.substring(0, 100)}...`);
          }
        }
      }
    }
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log('\n📊 Performance Index Application Summary:');
    console.log(`✅ Successfully created: ${successCount} indexes`);
    console.log(`⏭️  Already existed: ${skipCount} indexes`);
    console.log(`⏱️  Total time: ${duration.toFixed(2)} seconds`);
    
    // Analyze tables to update statistics
    console.log('\n📈 Updating table statistics...');
    const tables = [
      'sales', 'sale_items', 'products', 'customers', 'payment_transactions',
      'inventory_logs', 'users', 'categories', 'purchase_orders', 'purchase_order_items',
      'goods_received_notes', 'grn_items', 'roles', 'role_permissions', 'stores',
      'held_orders', 'promotional_offers'
    ];
    
    for (const table of tables) {
      try {
        await connection.execute(`ANALYZE TABLE ${table}`);
        console.log(`📊 Updated statistics for: ${table}`);
      } catch (error) {
        console.log(`⚠️  Could not analyze table ${table}: ${error.message}`);
      }
    }
    
    console.log('\n🎉 Performance optimization completed successfully!');
    console.log('\n💡 Recommendations:');
    console.log('1. Monitor query performance using EXPLAIN on frequent queries');
    console.log('2. Check slow query log for queries that still need optimization');
    console.log('3. Run ANALYZE TABLE periodically to keep statistics updated');
    console.log('4. Consider additional indexes based on actual query patterns');
    
  } catch (error) {
    console.error('❌ Error applying performance indexes:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the script
if (require.main === module) {
  applyPerformanceIndexes()
    .then(() => {
      console.log('✨ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { applyPerformanceIndexes };
