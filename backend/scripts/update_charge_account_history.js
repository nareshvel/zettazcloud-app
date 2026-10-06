/**
 * Script to update historical charge account transactions and fix customer credit balances
 * 
 * This script:
 * 1. Finds all historical charge-to-account transactions
 * 2. Recalculates customer outstanding credit balances
 * 3. Updates the customer records with correct values
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
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

// Log the configuration being used (without password)
console.log('Database configuration:', {
  host: dbConfig.host,
  user: dbConfig.user,
  database: dbConfig.database
});

// Validate database connection parameters
if (!dbConfig.host || !dbConfig.user || !dbConfig.database) {
  console.error('Error: Missing database configuration parameters.');
  console.log('Please check your .env file and ensure MYSQL_HOST, MYSQL_USER, and MYSQL_DATABASE are properly configured.');
  process.exit(1);
}

// Create connection pool
const pool = mysql.createPool(dbConfig);

async function main() {
  console.log('Starting charge account history update...');
  
  try {
    // 1. Find the payment method ID for 'on_account' type payments
    const [paymentMethods] = await pool.query(
      `SELECT id, name, code FROM payment_methods 
       WHERE code = 'on_account' OR code = 'ON_ACCOUNT'`
    );
    
    if (paymentMethods.length === 0) {
      console.error('No charge account payment method found. Cannot proceed.');
      return;
    }
    
    const onAccountPaymentIds = paymentMethods.map(pm => pm.id);
    console.log(`Found ${onAccountPaymentIds.length} charge account payment method(s):`, paymentMethods);
    
    // 2. Get all sales that used charge account payment
    const [sales] = await pool.query(
      `SELECT s.id, s.customer_id, s.tenant_id, s.total, s.created_at,
              c.first_name, c.last_name, c.outstanding_credit, c.credit_limit
       FROM sales s
       JOIN customers c ON s.customer_id = c.id
       WHERE s.payment_method IN (?) AND s.customer_id IS NOT NULL
       ORDER BY s.customer_id, s.created_at`,
      [onAccountPaymentIds]
    );
    
    console.log(`Found ${sales.length} historical charge account transactions.`);
    
    if (sales.length === 0) {
      console.log('No historical charge account transactions found. Nothing to update.');
      return;
    }
    
    // 3. Group sales by customer to recalculate balances
    const customerSales = {};
    sales.forEach(sale => {
      if (!customerSales[sale.customer_id]) {
        customerSales[sale.customer_id] = {
          customerId: sale.customer_id,
          tenantId: sale.tenant_id,
          name: `${sale.first_name} ${sale.last_name || ''}`.trim(),
          creditLimit: sale.credit_limit,
          currentOutstandingCredit: sale.outstanding_credit,
          transactions: [],
          calculatedTotal: 0
        };
      }
      
      customerSales[sale.customer_id].transactions.push({
        saleId: sale.id,
        amount: sale.total,
        date: sale.created_at
      });
      
      customerSales[sale.customer_id].calculatedTotal += parseFloat(sale.total);
    });
    
    // 4. Compare and update customer balances as needed
    console.log('\n=== Customer Credit Balance Analysis ===');
    const customerUpdatePromises = [];
    
    for (const customerId in customerSales) {
      const customer = customerSales[customerId];
      const currentCredit = parseFloat(customer.currentOutstandingCredit || 0);
      const calculatedCredit = parseFloat(customer.calculatedTotal || 0);
      const creditDiff = Math.abs(currentCredit - calculatedCredit);
      
      console.log(`\nCustomer: ${customer.name} (ID: ${customer.customerId})`);
      console.log(`Current outstanding credit: ${currentCredit.toFixed(2)}`);
      console.log(`Calculated from transactions: ${calculatedCredit.toFixed(2)}`);
      console.log(`Found ${customer.transactions.length} charge account transaction(s)`);
      
      if (creditDiff > 0.01) { // Using a small threshold to account for floating-point precision
        console.log(`❌ Discrepancy detected: ${creditDiff.toFixed(2)}`);
        console.log(`Updating customer record...`);
        
        // Update customer record with corrected value
        customerUpdatePromises.push(
          pool.query(
            'UPDATE customers SET outstanding_credit = ? WHERE id = ? AND tenant_id = ?',
            [calculatedCredit, customer.customerId, customer.tenantId]
          )
          .then(([result]) => {
            return {
              customerId: customer.customerId,
              name: customer.name,
              updated: result.affectedRows > 0,
              oldValue: currentCredit,
              newValue: calculatedCredit
            };
          })
        );
      } else {
        console.log('✓ Credit balance is correct');
      }
    }
    
    // 5. Execute updates and report results
    if (customerUpdatePromises.length > 0) {
      console.log(`\nUpdating ${customerUpdatePromises.length} customer record(s)...`);
      const results = await Promise.all(customerUpdatePromises);
      
      console.log('\n=== Update Results ===');
      results.forEach(result => {
        if (result.updated) {
          console.log(`✅ Customer ${result.name} (${result.customerId}): ${result.oldValue.toFixed(2)} → ${result.newValue.toFixed(2)}`);
        } else {
          console.log(`❌ Failed to update ${result.name} (${result.customerId})`);
        }
      });
      
      console.log(`\nCompleted updates. ${results.filter(r => r.updated).length} customer(s) updated.`);
    } else {
      console.log('\nNo customer records need updating. All balances are correct.');
    }
    
  } catch (error) {
    console.error('Error updating charge account history:', error);
  } finally {
    await pool.end();
    console.log('\nCharge account history update complete.');
  }
}

main().catch(console.error);
