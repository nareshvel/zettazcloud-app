const { pool } = require('../db');

async function diagnoseReceiptDataMapping() {
  try {
    console.log('🔍 Frontend Receipt Data Mapping Diagnostic Report\n');
    console.log('=' .repeat(60));

    // 1. Analyze backend API response structure for /api/sales/:id
    console.log('📊 BACKEND API ANALYSIS (/api/sales/:id)');
    console.log('=' .repeat(60));

    // Get a recent sale for analysis
    const [recentSales] = await pool.query(`
      SELECT id, created_at, cashier_id, customer_id, payment_method, total
      FROM sales 
      WHERE created_at >= '2025-07-28 00:00:00'
      ORDER BY created_at DESC 
      LIMIT 5
    `);

    if (recentSales.length === 0) {
      console.log('❌ No recent sales found (after July 28, 2025)');
      return;
    }

    console.log(`Found ${recentSales.length} recent sales for analysis:\n`);

    for (const sale of recentSales.slice(0, 2)) { // Analyze top 2 sales
      console.log(`🧾 SALE ID: ${sale.id}`);
      console.log(`   Created: ${sale.created_at}`);
      console.log(`   Total: $${sale.total}`);
      console.log(`   Payment Method: ${sale.payment_method}`);
      console.log('');

      // Simulate the backend API query for this sale (from sales controller)
      const [saleDetails] = await pool.query(`
        SELECT 
          s.id,
          s.created_at,
          s.subtotal,
          s.discount_amount,
          s.tax,
          s.total,
          s.payment_method,
          s.status,
          s.cashier_id,
          s.customer_id,
          u.name as cashier_name,
          c.first_name as customer_first_name,
          c.last_name as customer_last_name,
          CONCAT(IFNULL(c.first_name, ''), ' ', IFNULL(c.last_name, '')) as customer_name,
          pm.name as payment_method_name,
          pm.code as payment_method_code
        FROM sales s
        LEFT JOIN users u ON s.cashier_id = u.id
        LEFT JOIN customers c ON s.customer_id = c.id  
        LEFT JOIN payment_methods pm ON s.payment_method = pm.code
        WHERE s.id = ?
      `, [sale.id]);

      if (saleDetails.length > 0) {
        const details = saleDetails[0];
        console.log('   📋 BACKEND RESPONSE FIELDS:');
        console.log(`      id: ${details.id}`);
        console.log(`      created_at: ${details.created_at}`);
        console.log(`      subtotal: ${details.subtotal}`);
        console.log(`      discount_amount: ${details.discount_amount}`);
        console.log(`      tax: ${details.tax}`);
        console.log(`      total: ${details.total}`);
        console.log(`      payment_method: ${details.payment_method}`);
        console.log(`      payment_method_name: ${details.payment_method_name}`);
        console.log(`      payment_method_code: ${details.payment_method_code}`);
        console.log(`      cashier_id: ${details.cashier_id}`);
        console.log(`      cashier_name: ${details.cashier_name}`);
        console.log(`      customer_id: ${details.customer_id}`);
        console.log(`      customer_first_name: ${details.customer_first_name}`);
        console.log(`      customer_last_name: ${details.customer_last_name}`);
        console.log(`      customer_name: ${details.customer_name}`);
        console.log(`      status: ${details.status}`);
        console.log('');

        // Check for missing critical fields
        console.log('   🔍 FIELD VALIDATION:');
        console.log(`      ✅ Sale ID: ${details.id ? 'Present' : '❌ Missing'}`);
        console.log(`      ✅ Created At: ${details.created_at ? 'Present' : '❌ Missing'}`);
        console.log(`      ✅ Total: ${details.total ? 'Present' : '❌ Missing'}`);
        console.log(`      ${details.cashier_name ? '✅' : '⚠️ '} Cashier Name: ${details.cashier_name || 'Missing/Null'}`);
        console.log(`      ${details.customer_name && details.customer_name.trim() !== ' ' ? '✅' : '⚠️ '} Customer Name: ${details.customer_name && details.customer_name.trim() !== ' ' ? details.customer_name : 'Missing/Null'}`);
        console.log(`      ${details.payment_method ? '✅' : '⚠️ '} Payment Method: ${details.payment_method || 'Missing/Null'}`);
        console.log(`      ${details.payment_method_name ? '✅' : '⚠️ '} Payment Method Name: ${details.payment_method_name || 'Missing/Null'}`);
        console.log('');
      }

      // Get sale items for this sale
      const [saleItems] = await pool.query(`
        SELECT 
          si.product_id,
          si.quantity,
          si.unit_price,
          si.total_price,
          p.name as product_name,
          p.sku
        FROM sale_items si
        LEFT JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ?
      `, [sale.id]);

      console.log(`   📦 SALE ITEMS (${saleItems.length} items):`);
      saleItems.forEach((item, index) => {
        console.log(`      ${index + 1}. ${item.product_name || 'Unknown Product'} (SKU: ${item.sku || 'N/A'})`);
        console.log(`         Quantity: ${item.quantity}, Unit Price: $${item.unit_price}, Total: $${item.total_price}`);
      });
      console.log('');
      console.log('-'.repeat(50));
      console.log('');
    }

    // 2. Analyze payment method mapping issues
    console.log('💳 PAYMENT METHOD MAPPING ANALYSIS');
    console.log('=' .repeat(60));

    const [paymentMethodMappingIssues] = await pool.query(`
      SELECT 
        s.payment_method,
        COUNT(*) as transaction_count,
        pm_by_code.name as matched_by_code,
        pm_by_id.name as matched_by_id,
        CASE 
          WHEN pm_by_code.name IS NOT NULL THEN 'MATCHED_BY_CODE'
          WHEN pm_by_id.name IS NOT NULL THEN 'MATCHED_BY_ID'
          ELSE 'NO_MATCH'
        END as mapping_status
      FROM sales s
      LEFT JOIN payment_methods pm_by_code ON s.payment_method = pm_by_code.code
      LEFT JOIN payment_methods pm_by_id ON s.payment_method = pm_by_id.id
      WHERE s.created_at >= '2025-07-28 00:00:00'
      GROUP BY s.payment_method
      ORDER BY transaction_count DESC
    `);

    console.log('Recent payment method mapping results:');
    paymentMethodMappingIssues.forEach(row => {
      console.log(`  ${row.payment_method}: ${row.transaction_count} transactions`);
      console.log(`    Status: ${row.mapping_status}`);
      console.log(`    Matched by Code: ${row.matched_by_code || 'None'}`);
      console.log(`    Matched by ID: ${row.matched_by_id || 'None'}`);
      console.log('');
    });

    // 3. Analyze cashier and customer data availability
    console.log('👥 CASHIER & CUSTOMER DATA ANALYSIS');
    console.log('=' .repeat(60));

    const [userCashierAnalysis] = await pool.query(`
      SELECT 
        COUNT(DISTINCT s.cashier_id) as unique_cashiers,
        COUNT(DISTINCT CASE WHEN u.name IS NOT NULL THEN s.cashier_id END) as cashiers_with_names,
        COUNT(DISTINCT s.customer_id) as unique_customers,
        COUNT(DISTINCT CASE WHEN c.first_name IS NOT NULL OR c.last_name IS NOT NULL THEN s.customer_id END) as customers_with_names
      FROM sales s
      LEFT JOIN users u ON s.cashier_id = u.id
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.created_at >= '2025-07-28 00:00:00'
    `);

    const analysis = userCashierAnalysis[0];
    console.log('Recent sales data completeness:');
    console.log(`  Unique Cashiers: ${analysis.unique_cashiers}`);
    console.log(`  Cashiers with Names: ${analysis.cashiers_with_names} (${((analysis.cashiers_with_names / analysis.unique_cashiers) * 100).toFixed(1)}%)`);
    console.log(`  Unique Customers: ${analysis.unique_customers}`);
    console.log(`  Customers with Names: ${analysis.customers_with_names} (${analysis.unique_customers > 0 ? ((analysis.customers_with_names / analysis.unique_customers) * 100).toFixed(1) : 0}%)`);
    console.log('');

    // 4. Frontend mapping expectations analysis
    console.log('🎯 FRONTEND MAPPING EXPECTATIONS');
    console.log('=' .repeat(60));
    console.log('Based on receiptService.ts, frontend expects these fields:');
    console.log('');
    console.log('📋 EXPECTED BACKEND RESPONSE STRUCTURE:');
    console.log('  {');
    console.log('    id: string,');
    console.log('    createdAt: string (or created_at),');
    console.log('    subtotal: number,');
    console.log('    discountAmount: number (or discount_amount),');
    console.log('    tax: number,');
    console.log('    total: number,');
    console.log('    paymentMethod: string (or payment_method),');
    console.log('    cashierName: string (or cashier_name),');
    console.log('    customerName: string (or customer_name),');
    console.log('    items: Array<SaleItem>');
    console.log('  }');
    console.log('');

    // 5. Summary and recommendations
    console.log('📝 DIAGNOSTIC SUMMARY');
    console.log('=' .repeat(60));
    
    const hasPaymentMethodIssues = paymentMethodMappingIssues.some(row => row.mapping_status === 'NO_MATCH');
    const hasCashierIssues = analysis.cashiers_with_names < analysis.unique_cashiers;
    const hasCustomerIssues = analysis.customers_with_names < analysis.unique_customers;

    console.log('🔍 IDENTIFIED ISSUES:');
    console.log(`  Payment Method Mapping: ${hasPaymentMethodIssues ? '⚠️  Issues Found' : '✅ Working Correctly'}`);
    console.log(`  Cashier Name Resolution: ${hasCashierIssues ? '⚠️  Some Missing' : '✅ All Present'}`);
    console.log(`  Customer Name Resolution: ${hasCustomerIssues ? '⚠️  Some Missing' : '✅ All Present'}`);
    console.log('');

    console.log('🎯 RECOMMENDATIONS:');
    if (hasPaymentMethodIssues) {
      console.log('  1. Fix payment method JOIN condition in backend API');
    }
    if (hasCashierIssues) {
      console.log('  2. Investigate cashier_id foreign key relationships');
    }
    if (hasCustomerIssues) {
      console.log('  3. Review customer data completeness (may be expected for walk-in customers)');
    }
    if (!hasPaymentMethodIssues && !hasCashierIssues && !hasCustomerIssues) {
      console.log('  ✅ No critical issues found - frontend mapping should work correctly');
    }

    console.log('\n✅ Diagnostic complete!');

  } catch (error) {
    console.error('❌ Error during diagnostic:', error);
  } finally {
    await pool.end();
  }
}

diagnoseReceiptDataMapping();
