/**
 * Database Query Script - Check Signup Data
 * Examines what data was inserted across all tables for the successful signup
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const userId = 'cb7b62d6-f2e3-4b0b-8cfd-bd13da4a67bf';
const tenantId = '2e70f11c-d825-4997-bb02-077274298ba8';
const userEmail = 'pushpalatha.thanga@gmail.com';

async function checkSignupData() {
  let connection;
  
  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      port: process.env.MYSQL_PORT || 3306
    });

    console.log('🔍 SIGNUP DATA ANALYSIS');
    console.log('='.repeat(60));
    console.log(`User ID: ${userId}`);
    console.log(`Tenant ID: ${tenantId}`);
    console.log(`Email: ${userEmail}`);
    console.log('='.repeat(60));

    // 1. Check users table
    console.log('\n📋 1. USERS TABLE');
    console.log('-'.repeat(40));
    const [userRows] = await connection.execute(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );
    
    if (userRows.length > 0) {
      const user = userRows[0];
      console.log('✅ User Record Found:');
      console.log(`   ID: ${user.id}`);
      console.log(`   Tenant ID: ${user.tenant_id}`);
      console.log(`   Name: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Phone: ${user.phone}`);
      console.log(`   Password Hash: ${user.password_hash ? '[ENCRYPTED]' : 'NULL'}`);
      console.log(`   Role: ${user.role || 'NULL'}`);
      console.log(`   Store ID: ${user.store_id || 'NULL'}`);
      console.log(`   Is Active: ${user.is_active}`);
      console.log(`   Email Verified: ${user.email_verified}`);
      console.log(`   Created At: ${user.created_at}`);
      console.log(`   Updated At: ${user.updated_at}`);
      console.log(`   Last Login: ${user.last_login_at || 'NULL'}`);
    } else {
      console.log('❌ No user record found');
    }

    // 2. Check tenants table
    console.log('\n🏢 2. TENANTS TABLE');
    console.log('-'.repeat(40));
    const [tenantRows] = await connection.execute(
      'SELECT * FROM tenants WHERE id = ?',
      [tenantId]
    );
    
    if (tenantRows.length > 0) {
      const tenant = tenantRows[0];
      console.log('✅ Tenant Record Found:');
      console.log(`   ID: ${tenant.id}`);
      console.log(`   Name: ${tenant.name}`);
      console.log(`   Email: ${tenant.email || 'NULL'}`);
      console.log(`   Phone: ${tenant.phone || 'NULL'}`);
      console.log(`   Address: ${tenant.address || 'NULL'}`);
      console.log(`   City: ${tenant.city || 'NULL'}`);
      console.log(`   State: ${tenant.state || 'NULL'}`);
      console.log(`   Country: ${tenant.country || 'NULL'}`);
      console.log(`   Postal Code: ${tenant.postal_code || 'NULL'}`);
      console.log(`   Tax ID: ${tenant.tax_id || 'NULL'}`);
      console.log(`   Is Active: ${tenant.is_active}`);
      console.log(`   Setup Complete: ${tenant.setup_complete}`);
      console.log(`   Created At: ${tenant.created_at}`);
      console.log(`   Updated At: ${tenant.updated_at}`);
    } else {
      console.log('❌ No tenant record found');
    }

    // 3. Check user_roles table
    console.log('\n👤 3. USER_ROLES TABLE');
    console.log('-'.repeat(40));
    const [userRoleRows] = await connection.execute(
      'SELECT ur.*, r.name as role_name, r.description as role_description FROM user_roles ur LEFT JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ?',
      [userId]
    );
    
    if (userRoleRows.length > 0) {
      console.log('✅ User Role Records Found:');
      userRoleRows.forEach((userRole, index) => {
        console.log(`   Role ${index + 1}:`);
        console.log(`     User ID: ${userRole.user_id}`);
        console.log(`     Role ID: ${userRole.role_id}`);
        console.log(`     Role Name: ${userRole.role_name || 'NULL'}`);
        console.log(`     Role Description: ${userRole.role_description || 'NULL'}`);
        console.log(`     Assigned At: ${userRole.assigned_at}`);
      });
    } else {
      console.log('❌ No user role records found');
    }

    // 4. Check roles table for tenant
    console.log('\n🔐 4. ROLES TABLE (for tenant)');
    console.log('-'.repeat(40));
    const [roleRows] = await connection.execute(
      'SELECT * FROM roles WHERE tenant_id = ? OR tenant_id IS NULL ORDER BY tenant_id, name',
      [tenantId]
    );
    
    if (roleRows.length > 0) {
      console.log('✅ Available Roles:');
      roleRows.forEach((role, index) => {
        console.log(`   Role ${index + 1}:`);
        console.log(`     ID: ${role.id}`);
        console.log(`     Name: ${role.name}`);
        console.log(`     Description: ${role.description || 'NULL'}`);
        console.log(`     Tenant ID: ${role.tenant_id || 'SYSTEM ROLE'}`);
        console.log(`     Is Active: ${role.is_active}`);
        console.log(`     Created At: ${role.created_at}`);
      });
    } else {
      console.log('❌ No roles found');
    }

    // 5. Check stores table
    console.log('\n🏪 5. STORES TABLE');
    console.log('-'.repeat(40));
    const [storeRows] = await connection.execute(
      'SELECT * FROM stores WHERE tenant_id = ?',
      [tenantId]
    );
    
    if (storeRows.length > 0) {
      console.log('✅ Store Records Found:');
      storeRows.forEach((store, index) => {
        console.log(`   Store ${index + 1}:`);
        console.log(`     ID: ${store.id}`);
        console.log(`     Name: ${store.name}`);
        console.log(`     Address: ${store.address || 'NULL'}`);
        console.log(`     Phone: ${store.phone || 'NULL'}`);
        console.log(`     Email: ${store.email || 'NULL'}`);
        console.log(`     Is Active: ${store.is_active}`);
        console.log(`     Created At: ${store.created_at}`);
      });
    } else {
      console.log('❌ No store records found');
    }

    // 6. Check subscriptions table
    console.log('\n💳 6. SUBSCRIPTIONS TABLE');
    console.log('-'.repeat(40));
    try {
      const [subscriptionRows] = await connection.execute(
        'SELECT * FROM subscriptions WHERE tenant_id = ?',
        [tenantId]
      );
      
      if (subscriptionRows.length > 0) {
        console.log('✅ Subscription Records Found:');
        subscriptionRows.forEach((subscription, index) => {
          console.log(`   Subscription ${index + 1}:`);
          console.log(`     ID: ${subscription.id}`);
          console.log(`     Tenant ID: ${subscription.tenant_id}`);
          console.log(`     Plan ID: ${subscription.plan_id || 'NULL'}`);
          console.log(`     Status: ${subscription.status}`);
          console.log(`     Start Date: ${subscription.start_date || 'NULL'}`);
          console.log(`     End Date: ${subscription.end_date || 'NULL'}`);
          console.log(`     Created At: ${subscription.created_at}`);
        });
      } else {
        console.log('❌ No subscription records found');
      }
    } catch (error) {
      console.log('⚠️  Subscriptions table not found or error:', error.message);
    }

    // 7. Check email_verification_tokens table
    console.log('\n📧 7. EMAIL_VERIFICATION_TOKENS TABLE');
    console.log('-'.repeat(40));
    let tokenRows = [];
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM email_verification_tokens WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      );
      tokenRows = rows;
      
      if (tokenRows.length > 0) {
        console.log('✅ Email Verification Token Records Found:');
        tokenRows.forEach((token, index) => {
          console.log(`   Token ${index + 1}:`);
          console.log(`     ID: ${token.id}`);
          console.log(`     User ID: ${token.user_id}`);
          console.log(`     Token: ${token.token ? '[HIDDEN]' : 'NULL'}`);
          console.log(`     Used: ${token.used}`);
          console.log(`     Expires At: ${token.expires_at}`);
          console.log(`     Created At: ${token.created_at}`);
          console.log(`     Used At: ${token.used_at || 'NULL'}`);
        });
      } else {
        console.log('❌ No email verification token records found');
      }
    } catch (error) {
      console.log('⚠️  Email verification tokens table not found or error:', error.message);
    }

    // 8. Check audit_logs table
    console.log('\n📊 8. AUDIT_LOGS TABLE (Recent Activity)');
    console.log('-'.repeat(40));
    let auditRows = [];
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM audit_logs WHERE (user_id = ? OR tenant_id = ?) AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR) ORDER BY created_at DESC LIMIT 10',
        [userId, tenantId]
      );
      auditRows = rows;
      
      if (auditRows.length > 0) {
        console.log('✅ Recent Audit Log Records Found:');
        auditRows.forEach((audit, index) => {
          console.log(`   Log ${index + 1}:`);
          console.log(`     ID: ${audit.id}`);
          console.log(`     User ID: ${audit.user_id || 'NULL'}`);
          console.log(`     Tenant ID: ${audit.tenant_id || 'NULL'}`);
          console.log(`     Action: ${audit.action}`);
          console.log(`     Resource Type: ${audit.resource_type || 'NULL'}`);
          console.log(`     Resource ID: ${audit.resource_id || 'NULL'}`);
          console.log(`     Details: ${audit.details || 'NULL'}`);
          console.log(`     IP Address: ${audit.ip_address || 'NULL'}`);
          console.log(`     User Agent: ${audit.user_agent || 'NULL'}`);
          console.log(`     Created At: ${audit.created_at}`);
        });
      } else {
        console.log('❌ No recent audit log records found');
      }
    } catch (error) {
      console.log('⚠️  Audit logs table not found or error:', error.message);
    }

    // 9. Summary
    console.log('\n📋 SUMMARY');
    console.log('='.repeat(60));
    console.log('✅ Signup Process Analysis Complete');
    console.log(`   • User created: ${userRows.length > 0 ? 'YES' : 'NO'}`);
    console.log(`   • Tenant created: ${tenantRows.length > 0 ? 'YES' : 'NO'}`);
    console.log(`   • User roles assigned: ${userRoleRows.length} role(s)`);
    console.log(`   • Stores created: ${storeRows.length} store(s)`);
    console.log(`   • Subscriptions created: 0 subscription(s) (table not found)`);
    console.log(`   • Email verification tokens: ${tokenRows.length} token(s)`);
    console.log(`   • Audit log entries: ${auditRows.length} entry(s)`);

  } catch (error) {
    console.error('❌ Database query error:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the analysis
checkSignupData();
