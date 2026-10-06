const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'digitpulse_zcloud',
  password: process.env.DB_PASSWORD || 'Zettaz@2025',
  database: process.env.DB_NAME || 'digitpulse_zcloud',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function analyzeSalesPaymentMethods() {
  try {
    console.log('🔍 Analyzing Sales Table Payment Method Data Inconsistency...\n');

    // 1. Get payment method distribution
    console.log('📊 Payment Method Distribution:');
    const [paymentDistribution] = await pool.query(`
      SELECT 
        payment_method, 
        COUNT(*) as count,
        MIN(created_at) as earliest_transaction,
        MAX(created_at) as latest_transaction
      FROM sales 
      GROUP BY payment_method 
      ORDER BY count DESC
    `);

    paymentDistribution.forEach(row => {
      console.log(`  ${row.payment_method}: ${row.count} transactions (${row.earliest_transaction} to ${row.latest_transaction})`);
    });

    // 2. Check if payment_method values are UUIDs or strings
    console.log('\n🔍 Payment Method Value Analysis:');
    const [sampleData] = await pool.query(`
      SELECT 
        payment_method,
        LENGTH(payment_method) as length,
        CASE 
          WHEN payment_method REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 'UUID'
          WHEN payment_method IN ('cash', 'card', 'upi', 'charge', 'phone') THEN 'STRING'
          ELSE 'OTHER'
        END as type
      FROM sales 
      GROUP BY payment_method
      ORDER BY COUNT(*) DESC
    `);

    sampleData.forEach(row => {
      console.log(`  "${row.payment_method}" (length: ${row.length}, type: ${row.type})`);
    });

    // 3. Check payment_methods table for reference
    console.log('\n📋 Payment Methods Table Reference:');
    const [paymentMethods] = await pool.query(`
      SELECT id, code, name, enabled 
      FROM payment_methods 
      ORDER BY sort_order, name
    `);

    paymentMethods.forEach(row => {
      console.log(`  ID: ${row.id} | Code: ${row.code} | Name: ${row.name} | Enabled: ${row.enabled}`);
    });

    // 4. Check for orphaned payment methods (sales with payment_method not in payment_methods table)
    console.log('\n⚠️  Orphaned Payment Method Analysis:');
    const [orphanedCheck] = await pool.query(`
      SELECT 
        s.payment_method,
        COUNT(*) as transaction_count,
        CASE 
          WHEN pm.id IS NOT NULL THEN 'FOUND_BY_ID'
          WHEN pm2.code IS NOT NULL THEN 'FOUND_BY_CODE'
          ELSE 'ORPHANED'
        END as status
      FROM sales s
      LEFT JOIN payment_methods pm ON s.payment_method = pm.id
      LEFT JOIN payment_methods pm2 ON s.payment_method = pm2.code
      GROUP BY s.payment_method
      ORDER BY transaction_count DESC
    `);

    orphanedCheck.forEach(row => {
      console.log(`  "${row.payment_method}": ${row.transaction_count} transactions (${row.status})`);
    });

    // 5. Recent transactions analysis
    console.log('\n📅 Recent Transactions Payment Method Analysis:');
    const [recentTransactions] = await pool.query(`
      SELECT 
        id,
        payment_method,
        created_at,
        total
      FROM sales 
      ORDER BY created_at DESC 
      LIMIT 10
    `);

    recentTransactions.forEach(row => {
      console.log(`  ${row.id}: "${row.payment_method}" (${row.created_at}) - $${row.total}`);
    });

    console.log('\n✅ Analysis Complete!');

  } catch (error) {
    console.error('❌ Error analyzing sales payment methods:', error);
  } finally {
    await pool.end();
  }
}

// Run the analysis
analyzeSalesPaymentMethods();
