/**
 * Script to check a specific sale and its charge account status
 */

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Database configuration - using MYSQL_ prefix to match the backend .env
const dbConfig = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Sale ID and payment method to check
const targetSaleId = 'cc464a4c-cd6c-47d6-b514-8ca734f7466e';
const targetPaymentMethodId = 'e9ca75b4-35f4-11f0-8297-525400148990';

async function main() {
  console.log('Starting diagnostic check for specific sale...');
  console.log(`Checking sale ID: ${targetSaleId}`);
  console.log(`With payment method ID: ${targetPaymentMethodId}`);
  
  const pool = mysql.createPool(dbConfig);
  
  try {
    // 1. Check if the sale exists
    console.log('\n1. Checking if the sale exists...');
    const [saleResults] = await pool.query(
      'SELECT id, customer_id, tenant_id, total, created_at, payment_method FROM sales WHERE id = ?',
      [targetSaleId]
    );
    
    if (saleResults.length === 0) {
      console.log('❌ Sale not found in the database');
      return;
    }
    
    const sale = saleResults[0];
    console.log('✅ Sale found:', sale);
    
    // 2. Check if payment method matches
    console.log('\n2. Checking payment method...');
    if (sale.payment_method !== targetPaymentMethodId) {
      console.log(`❌ Payment method mismatch. Sale uses '${sale.payment_method}' instead of expected '${targetPaymentMethodId}'`);
    } else {
      console.log('✅ Payment method match confirmed');
    }
    
    // 3. Check payment method details
    console.log('\n3. Checking payment method details...');
    const [paymentMethodResults] = await pool.query(
      'SELECT id, name, code FROM payment_methods WHERE id = ?',
      [sale.payment_method]
    );
    
    if (paymentMethodResults.length === 0) {
      console.log('❌ Payment method not found in database');
    } else {
      const paymentMethod = paymentMethodResults[0];
      console.log('Payment method details:', paymentMethod);
      
      if (paymentMethod.code.toLowerCase() !== 'on_account') {
        console.log(`❌ Payment method code is '${paymentMethod.code}', not 'on_account'`);
      } else {
        console.log('✅ Payment method code correctly set to charge account');
      }
    }
    
    // 4. Check customer details
    console.log('\n4. Checking customer details...');
    if (!sale.customer_id) {
      console.log('❌ No customer associated with this sale');
    } else {
      const [customerResults] = await pool.query(
        'SELECT id, first_name, last_name, outstanding_credit, credit_limit FROM customers WHERE id = ?',
        [sale.customer_id]
      );
      
      if (customerResults.length === 0) {
        console.log('❌ Customer not found in database');
      } else {
        const customer = customerResults[0];
        console.log('Customer details:', customer);
      }
    }
    
    // 5. Check if this sale was included in our script
    console.log('\n5. Checking if this sale would be included in update script...');
    const [scriptCheck] = await pool.query(
      `SELECT s.id, s.customer_id, s.tenant_id, s.total, s.created_at,
              c.first_name, c.last_name, c.outstanding_credit, c.credit_limit
       FROM sales s
       JOIN customers c ON s.customer_id = c.id
       WHERE s.payment_method = ? AND s.id = ?`,
      [targetPaymentMethodId, targetSaleId]
    );
    
    if (scriptCheck.length === 0) {
      console.log('❌ Sale would NOT be included in the update script - check SQL join conditions');
      
      // Additional investigation
      console.log('\n6. Investigating potential issues...');
      
      if (sale.customer_id) {
        const [customerExists] = await pool.query(
          'SELECT COUNT(*) as count FROM customers WHERE id = ?',
          [sale.customer_id]
        );
        
        console.log(`Customer record exists check: ${customerExists[0].count > 0 ? 'YES' : 'NO'}`);
      }
      
      console.log('\nScript SQL would be:');
      console.log(`
SELECT s.id, s.customer_id, s.tenant_id, s.total 
FROM sales s
JOIN customers c ON s.customer_id = c.id
WHERE s.payment_method = '${targetPaymentMethodId}' AND s.customer_id IS NOT NULL
ORDER BY s.customer_id, s.created_at
      `);
      
      // Execute the query to see what results would be
      const [allScriptResults] = await pool.query(
        `SELECT s.id, s.customer_id, c.first_name, c.last_name, s.total 
         FROM sales s
         JOIN customers c ON s.customer_id = c.id
         WHERE s.payment_method = ? AND s.customer_id IS NOT NULL
         ORDER BY s.customer_id, s.created_at`,
        [targetPaymentMethodId]
      );
      
      console.log('\nAll charge account transactions that would be processed:');
      console.table(allScriptResults);
    } else {
      console.log('✅ Sale WOULD be included in the update script');
      console.log('Sale details that would be processed:', scriptCheck[0]);
    }
  } catch (error) {
    console.error('Error in diagnostic script:', error);
  } finally {
    await pool.end();
    console.log('\nDiagnostic check complete.');
  }
}

main().catch(console.error);
