/**
 * Utility script to create default payment methods for existing tenants
 * Run this script to ensure all tenants have default payment methods
 */

const { pool } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

async function createDefaultPaymentMethods() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🔍 Checking tenants without payment methods...');
    
    // Find tenants that don't have any payment methods
    const [tenantsWithoutPaymentMethods] = await connection.execute(`
      SELECT t.id, t.name 
      FROM tenants t 
      LEFT JOIN payment_methods pm ON t.id = pm.tenant_id 
      WHERE pm.tenant_id IS NULL
    `);
    
    if (tenantsWithoutPaymentMethods.length === 0) {
      console.log('✅ All tenants already have payment methods');
      return;
    }
    
    console.log(`📋 Found ${tenantsWithoutPaymentMethods.length} tenants without payment methods`);
    
    // Default payment methods template
    const defaultPaymentMethods = [
      {
        name: 'Cash',
        code: 'cash',
        isActive: true,
        requiresTerminal: false,
        icon: 'cash',
        sortOrder: 1
      },
      {
        name: 'Credit/Debit Card',
        code: 'card',
        isActive: true,
        requiresTerminal: true,
        icon: 'credit-card',
        sortOrder: 2
      },
      {
        name: 'UPI',
        code: 'upi',
        isActive: true,
        requiresTerminal: true,
        icon: 'phone',
        sortOrder: 3
      },
      {
        name: 'No Payment Required',
        code: 'none',
        isActive: true,
        requiresTerminal: false,
        icon: 'check-circle',
        sortOrder: 99
      }
    ];
    
    await connection.beginTransaction();
    
    // Create payment methods for each tenant
    for (const tenant of tenantsWithoutPaymentMethods) {
      console.log(`💳 Creating payment methods for tenant: ${tenant.name} (${tenant.id})`);
      
      for (const method of defaultPaymentMethods) {
        const methodId = method.code === 'none' 
          ? '00000000-0000-0000-0000-000000000000' 
          : uuidv4();
          
        await connection.execute(`
          INSERT INTO payment_methods (
            id, tenant_id, name, code, is_active, requires_terminal, 
            icon, sort_order, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, [
          methodId,
          tenant.id,
          method.name,
          method.code,
          method.isActive,
          method.requiresTerminal,
          method.icon,
          method.sortOrder
        ]);
      }
      
      // Create payment settings if they don't exist
      const [existingSettings] = await connection.execute(
        'SELECT tenant_id FROM tenant_payment_settings WHERE tenant_id = ?',
        [tenant.id]
      );
      
      if (existingSettings.length === 0) {
        await connection.execute(`
          INSERT INTO tenant_payment_settings (
            tenant_id, default_currency, allow_partial_payments, 
            created_at, updated_at
          ) VALUES (?, ?, ?, NOW(), NOW())
        `, [tenant.id, 'USD', true]);
        
        console.log(`⚙️ Created payment settings for tenant: ${tenant.name}`);
      }
      
      console.log(`✅ Created payment methods for tenant: ${tenant.name}`);
    }
    
    await connection.commit();
    console.log(`🎉 Successfully created payment methods for ${tenantsWithoutPaymentMethods.length} tenants`);
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error creating default payment methods:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run the script if called directly
if (require.main === module) {
  createDefaultPaymentMethods()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { createDefaultPaymentMethods };
