#!/usr/bin/env node

/**
 * Complete RBAC Permissions Update Script
 * 
 * This script:
 * 1. Adds all missing permissions (31 new permissions)
 * 2. Standardizes role-permission mappings across all tenants
 * 3. Ensures consistent permission counts per role
 * 4. Updates existing tenants to match new tenant onboarding
 * 
 * Run with: node scripts/update_complete_rbac_permissions.js
 */

const mysql = require('mysql2/promise');
const PermissionSeedingService = require('../services/permissionSeedingService');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'mysql.us.cloudlogin.co',
  user: process.env.DB_USER || 'zettaz_user',
  password: process.env.DB_PASSWORD || 'zettaz_password_2024',
  database: process.env.DB_NAME || 'digitpulse_zcloud',
  port: process.env.DB_PORT || 3306,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

class RBACUpdateScript {
  constructor() {
    this.connection = null;
    this.stats = {
      permissionsAdded: 0,
      rolesUpdated: 0,
      tenantsProcessed: 0,
      permissionAssignments: 0
    };
  }

  async run() {
    try {
      console.log('🚀 Starting Complete RBAC Permissions Update...\n');
      
      // Connect to database
      this.connection = await mysql.createConnection(dbConfig);
      console.log('✅ Connected to database\n');

      // Start transaction
      await this.connection.beginTransaction();

      // Step 1: Add all missing permissions
      await this.addMissingPermissions();

      // Step 2: Get all tenants
      const tenants = await this.getAllTenants();
      console.log(`📊 Found ${tenants.length} tenants to process\n`);

      // Step 3: Process each tenant
      for (const tenant of tenants) {
        await this.processTenant(tenant);
      }

      // Step 4: Verify results
      await this.verifyResults();

      // Commit transaction
      await this.connection.commit();
      console.log('✅ Transaction committed successfully\n');

      // Display final statistics
      this.displayStats();

    } catch (error) {
      console.error('❌ Error during RBAC update:', error);
      if (this.connection) {
        await this.connection.rollback();
        console.log('🔄 Transaction rolled back');
      }
      throw error;
    } finally {
      if (this.connection) {
        await this.connection.end();
        console.log('🔌 Database connection closed');
      }
    }
  }

  async addMissingPermissions() {
    console.log('📝 Step 1: Adding missing permissions...');
    
    // Use the PermissionSeedingService to ensure all permissions exist
    await PermissionSeedingService.ensurePermissionsExist(null, this.connection);
    
    // Count total permissions
    const [permissionCount] = await this.connection.execute(
      'SELECT COUNT(*) as count FROM permissions'
    );
    
    console.log(`✅ Total permissions in database: ${permissionCount[0].count}`);
    this.stats.permissionsAdded = permissionCount[0].count;
    console.log('');
  }

  async getAllTenants() {
    const [tenants] = await this.connection.execute(`
      SELECT id, name, setup_completed 
      FROM tenants 
      WHERE setup_completed = 1
      ORDER BY name
    `);
    return tenants;
  }

  async processTenant(tenant) {
    console.log(`🏢 Processing tenant: ${tenant.name} (${tenant.id})`);
    
    // Get all roles for this tenant
    const [roles] = await this.connection.execute(`
      SELECT id, name, description 
      FROM roles 
      WHERE tenant_id = ? 
      AND name IN ('Tenant Admin', 'Store Manager', 'Cashier', 'Inventory Manager', 'Reports Viewer')
      ORDER BY name
    `, [tenant.id]);

    console.log(`   Found ${roles.length} roles to update`);

    for (const role of roles) {
      await this.updateRolePermissions(tenant.id, role);
    }

    this.stats.tenantsProcessed++;
    console.log(`   ✅ Completed tenant: ${tenant.name}\n`);
  }

  async updateRolePermissions(tenantId, role) {
    // Clear existing permissions for this role
    await this.connection.execute(`
      DELETE FROM role_permissions WHERE role_id = ?
    `, [role.id]);

    // Get expected permissions for this role from PermissionSeedingService
    const expectedPermissions = PermissionSeedingService.ROLE_PERMISSIONS[role.name];
    
    if (!expectedPermissions || expectedPermissions.length === 0) {
      console.log(`   ⚠️  No permissions defined for role: ${role.name}`);
      return;
    }

    // Assign new permissions
    const assignedCount = await PermissionSeedingService.assignPermissionsToRole(
      role.id, 
      role.name, 
      tenantId, 
      this.connection
    );

    console.log(`   📋 ${role.name}: ${assignedCount} permissions assigned`);
    this.stats.rolesUpdated++;
    this.stats.permissionAssignments += assignedCount;
  }

  async verifyResults() {
    console.log('🔍 Step 4: Verifying results...\n');

    // Get permission counts per role per tenant
    const [results] = await this.connection.execute(`
      SELECT 
        t.name as tenant_name,
        r.name as role_name,
        COUNT(rp.permission_id) as permission_count
      FROM tenants t
      JOIN roles r ON t.id = r.tenant_id
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      WHERE t.setup_completed = 1
      AND r.name IN ('Tenant Admin', 'Store Manager', 'Cashier', 'Inventory Manager', 'Reports Viewer')
      GROUP BY t.id, t.name, r.name
      ORDER BY t.name, r.name
    `);

    // Expected counts
    const expectedCounts = {
      'Tenant Admin': 81,
      'Store Manager': 58,
      'Cashier': 18,
      'Inventory Manager': 28,
      'Reports Viewer': 12
    };

    console.log('📊 Permission Count Verification:');
    console.log('Role Name'.padEnd(20) + 'Expected'.padEnd(12) + 'Actual'.padEnd(12) + 'Status');
    console.log('-'.repeat(50));

    let allCorrect = true;
    const tenantGroups = {};

    // Group by tenant
    results.forEach(row => {
      if (!tenantGroups[row.tenant_name]) {
        tenantGroups[row.tenant_name] = {};
      }
      tenantGroups[row.tenant_name][row.role_name] = row.permission_count;
    });

    // Verify each tenant
    Object.keys(tenantGroups).forEach(tenantName => {
      console.log(`\n🏢 ${tenantName}:`);
      
      Object.keys(expectedCounts).forEach(roleName => {
        const expected = expectedCounts[roleName];
        const actual = tenantGroups[tenantName][roleName] || 0;
        const status = actual === expected ? '✅' : '❌';
        
        if (actual !== expected) allCorrect = false;
        
        console.log(`   ${roleName.padEnd(18)} ${expected.toString().padEnd(10)} ${actual.toString().padEnd(10)} ${status}`);
      });
    });

    console.log('\n' + '='.repeat(50));
    if (allCorrect) {
      console.log('✅ All role permission counts are correct!');
    } else {
      console.log('❌ Some role permission counts are incorrect');
    }
    console.log('');
  }

  displayStats() {
    console.log('📈 Final Statistics:');
    console.log('='.repeat(40));
    console.log(`Total Permissions Available: ${this.stats.permissionsAdded}`);
    console.log(`Tenants Processed: ${this.stats.tenantsProcessed}`);
    console.log(`Roles Updated: ${this.stats.rolesUpdated}`);
    console.log(`Permission Assignments: ${this.stats.permissionAssignments}`);
    console.log('='.repeat(40));
    console.log('🎉 RBAC Permissions Update Complete!');
  }
}

// Run the script
async function main() {
  const script = new RBACUpdateScript();
  
  try {
    await script.run();
    process.exit(0);
  } catch (error) {
    console.error('💥 Script failed:', error.message);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

module.exports = RBACUpdateScript;
