/**
 * Debug Routes
 * 
 * Development-only routes for debugging and configuration.
 * These routes should be disabled in production.
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { JWT_SECRET } = require('../config/constants');

// This route is for development only and will be disabled in production
router.get('/auth-config', (req, res) => {
  // Only available in development mode
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({
      status: 'error',
      message: 'This endpoint is only available in development mode'
    });
  }
  
  // Return configuration for frontend JWT handling
  return res.json({
    status: 'success',
    environment: process.env.NODE_ENV,
    authConfig: {
      // Only send a hash of the secret, never the actual secret
      secretHash: require('crypto').createHash('sha256').update(JWT_SECRET).digest('hex').substring(0, 8),
      useStrictVerification: true
    }
  });
});

// Token verification debug endpoint - helps identify which secret works
router.post('/verify-token', (req, res) => {
  // Only available in development mode
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({
      status: 'error',
      message: 'This endpoint is only available in development mode'
    });
  }
  
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({
      status: 'error',
      message: 'Token is required'
    });
  }
  
  // Try with our current JWT_SECRET
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.json({
      status: 'success',
      message: 'Token verified with current JWT_SECRET',
      tokenInfo: {
        subject: decoded.sub,
        email: decoded.email,
        expiresAt: new Date(decoded.exp * 1000).toISOString(),
        roles: decoded.systemRoles || [],
        isExpired: Date.now() > decoded.exp * 1000
      }
    });
  } catch (mainError) {
    // Try with fallback secrets
    const fallbackSecrets = [
      'your-secret-key',
      'your-secret-key-for-development-only',
      'your_jwt_secret'
    ];
    
    for (const secret of fallbackSecrets) {
      try {
        const decoded = jwt.verify(token, secret);
        return res.json({
          status: 'warning',
          message: `Token verified with fallback secret: '${secret}'`,
          recommendedAction: 'Update frontend to use the same JWT_SECRET as backend, or update backend JWT_SECRET to match frontend',
          tokenInfo: {
            subject: decoded.sub,
            email: decoded.email,
            expiresAt: new Date(decoded.exp * 1000).toISOString(),
            roles: decoded.systemRoles || [],
            isExpired: Date.now() > decoded.exp * 1000
          }
        });
      } catch (fallbackError) {
        // Continue to next secret
      }
    }
    
    // If we get here, none of the secrets worked
    return res.status(401).json({
      status: 'error',
      message: 'Token verification failed with all known secrets',
      error: mainError.message
    });
  }
});

// Route to check if both frontend and backend have synchronized JWT settings
router.post('/sync-check', (req, res) => {
  // Only available in development mode
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({
      status: 'error',
      message: 'This endpoint is only available in development mode'
    });
  }

  const { secretHash } = req.body;
  if (!secretHash) {
    return res.status(400).json({
      status: 'error',
      message: 'secretHash is required'
    });
  }

  // Calculate our secret hash
  const ourSecretHash = require('crypto').createHash('sha256').update(JWT_SECRET).digest('hex').substring(0, 8);
  
  // Check if the frontend's secret hash matches our backend secret hash
  const isInSync = secretHash === ourSecretHash;
  
  return res.json({
    status: isInSync ? 'success' : 'warning',
    isInSync,
    message: isInSync ? 
      'Frontend and backend JWT secrets are in sync' : 
      'Frontend and backend JWT secrets do not match'
  });
});

// Sales payment method analysis endpoint
router.get('/sales-payment-methods', async (req, res) => {
  try {
    const { pool } = require('../db');
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
      SELECT id, code, name, is_active, requires_terminal, sort_order
      FROM payment_methods 
      ORDER BY sort_order, name
    `);

    analysis.paymentMethodsTable = paymentMethods;

    // 4. Simple payment method validation (avoiding collation issues)
    const [paymentMethodValidation] = await pool.query(`
      SELECT 
        payment_method,
        COUNT(*) as transaction_count,
        DATE(created_at) as transaction_date,
        CASE 
          WHEN payment_method REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 'UUID_FORMAT'
          WHEN payment_method IN ('cash', 'card', 'phone', 'charge') THEN 'STRING_FORMAT'
          ELSE 'OTHER_FORMAT'
        END as format_type
      FROM sales 
      GROUP BY payment_method, DATE(created_at)
      ORDER BY transaction_date DESC, transaction_count DESC
    `);

    analysis.paymentMethodValidation = paymentMethodValidation;

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
    
    // Analyze transition date (July 28, 2025)
    const july28Cutoff = new Date('2025-07-28');
    const recentValidationData = paymentMethodValidation.filter(row => 
      new Date(row.transaction_date) >= july28Cutoff
    );
    const oldValidationData = paymentMethodValidation.filter(row => 
      new Date(row.transaction_date) < july28Cutoff
    );

    analysis.summary = {
      totalTransactions,
      uniquePaymentMethods: paymentDistribution.length,
      stringMethods,
      uuidMethods,
      otherMethods,
      hasInconsistency: stringMethods > 0 && uuidMethods > 0,
      transactionsSinceJuly28: recentValidationData.reduce((sum, row) => sum + row.transaction_count, 0),
      transactionsBeforeJuly28: oldValidationData.reduce((sum, row) => sum + row.transaction_count, 0),
      paymentMethodsTable: paymentMethods.length
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
