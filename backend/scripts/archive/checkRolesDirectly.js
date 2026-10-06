/**
 * Direct database check for roles - bypasses all middleware and service layers
 * Run with: node scripts/checkRolesDirectly.js [tenant_id]
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Get tenant ID from command line argument or use a default
const tenantId = process.argv[2] || 'd7f267da-d5d9-4a15-b0d3-31ca710a4492'; // Replace with an actual tenant ID if no arg provided

// Database connection using the same config as the main app
const dbConfig = {
  host: process.env.DB_HOST || 'mysql.us.cloudlogin.co',
  user: process.env.DB_USER || 'digitpulse_zcloud',
  password: process.env.DB_PASSWORD, // Will be taken from .env
  database: process.env.DB_NAME || 'digitpulse_zcloud',
};

// Main function to check roles
async function checkRolesDirectly() {
  console.log(`Checking roles directly in database for tenant: ${tenantId}`);
  
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection(dbConfig);
    console.log('Database connection established successfully');
    
    // Query 1: Count roles in the tenant
    const [countResults] = await connection.execute(
      'SELECT COUNT(*) as roleCount FROM roles WHERE tenant_id = ?',
      [tenantId]
    );
    
    console.log(`Total roles found for tenant: ${countResults[0].roleCount}`);
    
    // Query 2: Get all roles for the tenant with details
    const [roles] = await connection.execute(
      'SELECT id, tenant_id, name, description, scope, scope_id, is_system_role, created_at, updated_at FROM roles WHERE tenant_id = ?',
      [tenantId]
    );
    
    console.log('\n========== ROLES IN DATABASE ==========');
    if (roles.length === 0) {
      console.log('NO ROLES FOUND FOR THIS TENANT!');
    } else {
      roles.forEach(role => {
        console.log(`\nID: ${role.id}`);
        console.log(`Name: ${role.name}`);
        console.log(`Description: ${role.description || 'N/A'}`);
        console.log(`System Role: ${role.is_system_role ? 'Yes' : 'No'}`);
        console.log(`Scope: ${role.scope} (${role.scope_id || 'N/A'})`);
        console.log(`Created: ${role.created_at}`);
      });
      
      // Query 3: Get role permissions
      console.log('\n========== ROLE PERMISSIONS ==========');
      for (const role of roles) {
        const [permissions] = await connection.execute(
          `SELECT p.id, p.name, p.description, p.category 
           FROM permissions p 
           JOIN role_permissions rp ON p.id = rp.permission_id 
           WHERE rp.role_id = ?`,
          [role.id]
        );
        
        console.log(`\nPermissions for role "${role.name}" (${role.id}):`);
        if (permissions.length === 0) {
          console.log('  No permissions assigned');
        } else {
          permissions.forEach(perm => {
            console.log(`  - ${perm.name} (${perm.category}): ${perm.description || 'N/A'}`);
          });
        }
      }
    }
    
  } catch (err) {
    console.error('Error querying database:', err);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nDatabase connection closed');
    }
  }
}

// Run the check
checkRolesDirectly().catch(console.error);
