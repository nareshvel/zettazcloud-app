const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET /api/debug/sales-payment-methods - Analyze payment method data inconsistency
router.get('/sales-payment-methods', async (req, res) => {
  try {
    console.log('🔍 Analyzing Sales Table Payment Method Data Inconsistency...');

    const analysis = {};

    // 1. Get payment method distribution
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

    analysis.paymentDistribution = paymentDistribution;

    // 2. Check if payment_method values are UUIDs or strings
    const [valueAnalysis] = await pool.query(`
      SELECT 
        payment_method,
        LENGTH(payment_method) as length,
        CASE 
          WHEN payment_method REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 'UUID'
          WHEN payment_method IN ('cash', 'card', 'phone', 'charge') THEN 'STRING'
          ELSE 'OTHER'
        END as type
      FROM sales 
      GROUP BY payment_method
      ORDER BY COUNT(*) DESC
    `);

    analysis.valueAnalysis = valueAnalysis;

    // 3. Check payment_methods table for reference
    const [paymentMethods] = await pool.query(`
      SELECT id, code, name, enabled 
      FROM payment_methods 
      ORDER BY sort_order, name
    `);

    analysis.paymentMethodsTable = paymentMethods;

    // 4. Check for orphaned payment methods
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

    analysis.orphanedAnalysis = orphanedCheck;

    // 5. Recent transactions analysis
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

    analysis.recentTransactions = recentTransactions;

    // 6. Summary statistics
    const totalTransactions = paymentDistribution.reduce((sum, row) => sum + row.count, 0);
    const stringMethods = valueAnalysis.filter(row => row.type === 'STRING').length;
    const uuidMethods = valueAnalysis.filter(row => row.type === 'UUID').length;
    const otherMethods = valueAnalysis.filter(row => row.type === 'OTHER').length;
    const orphanedMethods = orphanedCheck.filter(row => row.status === 'ORPHANED').length;

    analysis.summary = {
      totalTransactions,
      uniquePaymentMethods: paymentDistribution.length,
      stringMethods,
      uuidMethods,
      otherMethods,
      orphanedMethods,
      hasInconsistency: stringMethods > 0 && uuidMethods > 0
    };

    console.log('✅ Sales payment method analysis complete');

    res.json({
      status: 'success',
      message: 'Sales payment method analysis complete',
      data: analysis
    });

  } catch (error) {
    console.error('❌ Error analyzing sales payment methods:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to analyze sales payment methods',
      error: error.message
    });
  }
});

module.exports = router;
