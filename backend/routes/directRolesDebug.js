/**
 * Direct debug endpoint for roles
 */
const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/unifiedAuthMiddleware');

/**
 * @route GET /api/direct-debug/roles
 * @desc Get all roles directly from the database
 * @access Private - Requires authentication
 */
router.get('/roles', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    console.log('[DEBUG] Getting roles for tenant:', tenantId);
    
    // Direct database query
    const [roles] = await pool.query(
      'SELECT id, tenant_id, name, description, is_system_role FROM roles WHERE tenant_id = ?', 
      [tenantId]
    );
    
    console.log('[DEBUG] Found roles:', roles);
    
    // Format the response exactly as the frontend expects it
    res.json({ roles: roles });
  } catch (error) {
    console.error('Error debugging roles:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Error debugging roles', 
      error: error.message 
    });
  }
});

module.exports = router;
