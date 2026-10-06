/**
 * Script to assign Tenant Admin role to a specific user
 */
const rbacService = require('../services/rbacService');
const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from backend/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function getConnection() {
  return await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: process.env.MYSQL_PORT || 3306
  });
}

async function getRoleIdByName(roleName) {
  const connection = await getConnection();
  
  try {
    const [roles] = await connection.query('SELECT id FROM roles WHERE name = ?', [roleName]);
    
    if (roles.length === 0) {
      throw new Error(`Role "${roleName}" not found`);
    }
    
    return roles[0].id;
  } finally {
    await connection.end();
  }
}

async function getUserDetails(userId) {
  const connection = await getConnection();
  
  try {
    const [users] = await connection.query('SELECT id, email, tenant_id FROM users WHERE id = ?', [userId]);
    
    if (users.length === 0) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    return users[0];
  } finally {
    await connection.end();
  }
}

async function assignTenantAdmin() {
  try {
    console.log('---------------------------------------------');
    console.log('Assign Tenant Admin Role');
    console.log('---------------------------------------------');
    console.log('Database:', process.env.MYSQL_DATABASE || 'digitpulse_zcloud');
    console.log('---------------------------------------------\n');
    
    // Get user ID from command line or use default
    const userId = process.argv[2] ? parseInt(process.argv[2]) : 1;
    console.log(`Assigning Tenant Admin role to user ID: ${userId}`);
    
    // Get user details
    const user = await getUserDetails(userId);
    console.log(`Found user: ${user.email} (Tenant ID: ${user.tenant_id || 'None'})`);
    
    if (!user.tenant_id) {
      console.error(`⚠️ User ${user.email} has no tenant_id, cannot assign tenant role!`);
      process.exit(1);
    }
    
    // Get role ID for Tenant Admin
    const roleName = 'Tenant Admin';
    const roleId = await getRoleIdByName(roleName);
    console.log(`Found role ID for "${roleName}": ${roleId}`);
    
    // Assign role
    await rbacService.assignTenantRole(
      user.id,
      roleId,
      user.tenant_id,
      'tenant', // scope
      null, // storeId
      'system' // assignedBy
    );
    
    console.log(`✅ Successfully assigned ${roleName} role to ${user.email}`);
    
    // Verify assignments
    const roles = await rbacService.getUserRolesAndPermissions(user.id);
    console.log('\nVerification:');
    console.log('User roles:', roles.roleNames || []);
    console.log('User permissions:', roles.permissions || []);
    
  } catch (error) {
    console.error('\n❌ Failed to assign role:');
    console.error(error);
    process.exit(1);
  }
}

// Run the script
assignTenantAdmin();
