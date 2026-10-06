const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate, authorize, requireTenantId, requireStoreId } = require('../middleware/unifiedAuthMiddleware');

// Get activity logs for a specific customer
router.get('/customers/:customerId/activities', authenticate, async (req, res) => {
  const { customerId } = req.params;
  
  try {
    const activities = await pool.query(
      `SELECT a.*, u.first_name AS user_first_name, u.last_name AS user_last_name
      FROM customer_activity_log a
      LEFT JOIN users u ON a.user_id = u.id COLLATE utf8mb4_unicode_ci
      WHERE a.customer_id = ?
      ORDER BY a.created_at DESC
      LIMIT 50`,
      [customerId]
    );
    
    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error('Error fetching customer activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer activities',
      error: error.message
    });
  }
});

module.exports = router;
