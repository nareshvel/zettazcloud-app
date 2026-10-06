/**
 * Test Routes
 * Temporary routes for debugging and testing
 */
const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

/**
 * @route GET /api/test/permissions
 * @desc Test endpoint to check permissions table
 * @access Public (for testing only)
 */
router.get('/permissions', async (req, res) => {
  try {
    // Check if permissions table exists
    const [tables] = await pool.query(
      "SHOW TABLES LIKE 'permissions'"
    );
    
    if (tables.length === 0) {
      return res.status(404).json({ 
        error: 'Permissions table does not exist',
        tables: await pool.query('SHOW TABLES')
      });
    }
    
    // Get all permissions
    const [permissions] = await pool.query('SELECT * FROM permissions LIMIT 10');
    
    res.json({
      success: true,
      permissions,
      count: permissions.length
    });
  } catch (error) {
    console.error('Error in test permissions endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
