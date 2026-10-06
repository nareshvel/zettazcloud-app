/**
 * Debug script to test the RBAC service directly
 */
require('dotenv').config();

// Direct database connection to avoid any middleware issues
const mysql = require('mysql2/promise');
const rbacService = require('../services/rbacService');

// Use credentials from frontend .env
const dbConfig = {
  host: 'mysql.us.cloudlogin.co',
  user: 'digitpulse_zcloud',
  password: 'MyAntigua!2025',
  database: 'digitpulse_zcloud',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create a pool directly
const pool = mysql.createPool(dbConfig);

// Mock the db module used by rbacService
const db = {
  query: async (sql, params) => {
    try {
      const [rows] = await pool.query(sql, params);
      return rows;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }
};

// Replace the db module in rbacService with our mock
rbacService.__db = db;

async function debugRbacService() {
  try {
    console.log('=== RBAC Service Debug ===');

    // Test user ID (from your test)
    const userId = 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f';
    
    // First, find the user in the database
    console.log('\n1. Finding user in database...');
    const users = await db.query('SELECT id, name, email, tenant_id FROM users WHERE id = ?', [userId]);
    
    if (users.length === 0) {
      console.log('❌ User not found');
      return;
    }
    
    const user = users[0];
    console.log('✅ User found:', user);
    
    // Now test the getUserRolesAndPermissions function directly
    console.log('\n2. Testing getUserRolesAndPermissions...');
    try {
      console.time('RBAC data fetch');
      const rbacData = await rbacService.getUserRolesAndPermissions(userId, null, null);
      console.timeEnd('RBAC data fetch');
      
      console.log('RBAC data structure:', Object.keys(rbacData || {}));
      console.log('Roles:', rbacData.roleNames);
      console.log('System Roles:', rbacData.systemRoles);
      console.log('Permissions count:', rbacData.permissions.length);
    } catch (error) {
      console.error('❌ Error in getUserRolesAndPermissions:', error);
      console.error('Stack trace:', error.stack);
    }
    
    // Now simulate the /api/users/me endpoint logic
    console.log('\n3. Simulating /api/users/me endpoint...');
    try {
      // This replicates the endpoint logic
      const rbacData = await rbacService.getUserRolesAndPermissions(userId, null, null);
      
      const userResponse = {
        id: user.id,
        name: user.name,
        email: user.email,
        tenant_id: user.tenant_id,
        permissions: rbacData?.permissions || [],
        roles: rbacData?.roleNames || [],
        systemRoles: rbacData?.systemRoles || [],
        stores: []
      };
      
      console.log('✅ User response successfully created:', userResponse);
    } catch (error) {
      console.error('❌ Error simulating endpoint:', error);
      console.error('Stack trace:', error.stack);
    }
    
  } catch (error) {
    console.error('Debug script error:', error);
  } finally {
    await pool.end();
  }
}

debugRbacService();
