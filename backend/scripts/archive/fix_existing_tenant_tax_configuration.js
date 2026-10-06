/**
 * Fix Existing Tenant Tax Configuration Script
 * 
 * This script identifies and fixes tenants that lack proper tax configuration.
 * It creates default tax classes, tax rates, and sets store default tax classes
 * for tenants that are missing this critical setup.
 */

const mysql = require('mysql2/promise');
const TaxProvisioningService = require('../services/taxProvisioningService');

// Database configuration
const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'digitpulse_zcloud',
  port: process.env.MYSQL_PORT || 3306
};

async function main() {
  let connection;
  
  try {
    console.log('🔧 Starting tax configuration fix for existing tenants...');
    
    // Create database connection
    connection = await mysql.createConnection(dbConfig);
    
    // 1. Identify tenants with missing tax configuration
    console.log('\n📊 Analyzing tenant tax configuration status...');
    
    const [tenantsWithIssues] = await connection.execute(`
      SELECT 
        t.id as tenant_id, 
        t.name as tenant_name,
        s.id as store_id, 
        s.name as store_name,
        s.default_tax_class_id,
        COUNT(tc.id) as tax_class_count,
        COUNT(tcr.id) as tax_rate_count
      FROM tenants t
      JOIN stores s ON t.id = s.tenant_id AND s.is_active = 1
      LEFT JOIN tax_classes tc ON t.id = tc.tenant_id AND (tc.store_id = s.id OR tc.store_id IS NULL)
      LEFT JOIN tax_class_rates tcr ON tc.id = tcr.tax_class_id
      WHERE t.setup_completed = 1
      GROUP BY t.id, s.id
      HAVING tax_class_count = 0 OR s.default_tax_class_id IS NULL OR tax_rate_count = 0
      ORDER BY t.name
    `);

    if (tenantsWithIssues.length === 0) {
      console.log('✅ All tenants have proper tax configuration. No fixes needed.');
      return;
    }

    console.log(`\n🚨 Found ${tenantsWithIssues.length} tenants with tax configuration issues:`);
    
    for (const tenant of tenantsWithIssues) {
      console.log(`  - ${tenant.tenant_name} (${tenant.tenant_id})`);
      console.log(`    Store: ${tenant.store_name} (${tenant.store_id})`);
      console.log(`    Tax Classes: ${tenant.tax_class_count}, Default Tax Class: ${tenant.default_tax_class_id || 'NONE'}, Tax Rates: ${tenant.tax_rate_count}`);
    }

    // 2. Fix each tenant's tax configuration
    console.log('\n🔧 Starting tax configuration fixes...\n');
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const tenant of tenantsWithIssues) {
      try {
        console.log(`🔧 Fixing tenant: ${tenant.tenant_name} (${tenant.tenant_id})`);
        
        const result = await TaxProvisioningService.createDefaultTaxConfiguration(
          tenant.tenant_id,
          tenant.store_id,
          { defaultTaxRate: 10.0 }
        );

        if (result.success) {
          console.log(`✅ Successfully fixed ${tenant.tenant_name}:`);
          console.log(`   - Created ${result.created.taxClasses.length} tax classes`);
          console.log(`   - Created ${result.created.taxRates.length} tax rates`);
          console.log(`   - Set store default tax class: ${result.defaultTaxClassId}`);
          successCount++;
        } else {
          console.log(`❌ Failed to fix ${tenant.tenant_name}: ${result.message}`);
          errorCount++;
          errors.push({ tenant: tenant.tenant_name, error: result.message });
        }
        
      } catch (error) {
        console.error(`❌ Error fixing tenant ${tenant.tenant_name}:`, error.message);
        errorCount++;
        errors.push({ tenant: tenant.tenant_name, error: error.message });
      }
      
      console.log(''); // Add spacing between tenants
    }

    // 3. Summary report
    console.log('📊 Tax Configuration Fix Summary:');
    console.log(`   ✅ Successfully fixed: ${successCount} tenants`);
    console.log(`   ❌ Failed to fix: ${errorCount} tenants`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      for (const error of errors) {
        console.log(`   - ${error.tenant}: ${error.error}`);
      }
    }

    // 4. Verification - check that all tenants now have proper tax configuration
    console.log('\n🔍 Verifying fixes...');
    
    const [remainingIssues] = await connection.execute(`
      SELECT 
        t.id as tenant_id, 
        t.name as tenant_name,
        s.id as store_id,
        s.default_tax_class_id,
        COUNT(tc.id) as tax_class_count
      FROM tenants t
      JOIN stores s ON t.id = s.tenant_id AND s.is_active = 1
      LEFT JOIN tax_classes tc ON t.id = tc.tenant_id AND (tc.store_id = s.id OR tc.store_id IS NULL)
      WHERE t.setup_completed = 1
      GROUP BY t.id, s.id
      HAVING tax_class_count = 0 OR s.default_tax_class_id IS NULL
    `);

    if (remainingIssues.length === 0) {
      console.log('✅ All tenants now have proper tax configuration!');
    } else {
      console.log(`⚠️  ${remainingIssues.length} tenants still have tax configuration issues:`);
      for (const issue of remainingIssues) {
        console.log(`   - ${issue.tenant_name}: ${issue.tax_class_count} tax classes, default: ${issue.default_tax_class_id || 'NONE'}`);
      }
    }

    console.log('\n🎉 Tax configuration fix script completed!');

  } catch (error) {
    console.error('❌ Script execution error:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
