/**
 * Direct Node.js script to fix payment methods for your tenant
 * This bypasses SQL collation issues by using the existing DB connection
 */

const { pool } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

async function fixPaymentMethodsForTenant() {
  const connection = await pool.getConnection();
  
  try {
    const tenantId = '2d63688f-d18b-4138-b0e1-49146ec63fcb';
    
    console.log('🔍 Checking current payment methods for tenant:', tenantId);
    
    // Check current payment methods
    const [currentMethods] = await connection.execute(
      'SELECT id, name, code, is_active FROM payment_methods WHERE tenant_id = ?',
      [tenantId]
    );
    
    console.log('📋 Current payment methods:', currentMethods.length);
    currentMethods.forEach(method => {
      console.log(`  - ${method.name} (${method.code}) - Active: ${method.is_active}`);
    });
    
    await connection.beginTransaction();
    
    // Define all required payment methods
    const requiredMethods = [
      {
        name: 'Cash',
        code: 'cash',
        requiresTerminal: false,
        icon: 'cash',
        sortOrder: 1
      },
      {
        name: 'Credit/Debit Card',
        code: 'card',
        requiresTerminal: true,
        icon: 'credit-card',
        sortOrder: 2
      },
      {
        name: 'UPI',
        code: 'upi',
        requiresTerminal: true,
        icon: 'phone',
        sortOrder: 3
      },
      {
        name: 'Charge',
        code: 'ON_ACCOUNT',
        requiresTerminal: false,
        icon: 'user',
        sortOrder: 4
      },
      {
        name: 'No Payment Required',
        code: 'none',
        requiresTerminal: false,
        icon: 'check-circle',
        sortOrder: 99
      }
    ];
    
    // Check which methods are missing and add them
    for (const method of requiredMethods) {
      const exists = currentMethods.find(m => m.code === method.code);
      
      if (!exists) {
        console.log(`➕ Adding missing payment method: ${method.name}`);
        
        await connection.execute(`
          INSERT INTO payment_methods (
            id, tenant_id, name, code, is_active, requires_terminal, 
            icon, sort_order, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, [
          uuidv4(),
          tenantId,
          method.name,
          method.code,
          1, // is_active
          method.requiresTerminal ? 1 : 0,
          method.icon,
          method.sortOrder
        ]);
      } else {
        console.log(`✅ Payment method exists: ${method.name}`);
        
        // Ensure it's active
        if (!exists.is_active) {
          console.log(`🔄 Activating payment method: ${method.name}`);
          await connection.execute(
            'UPDATE payment_methods SET is_active = 1 WHERE id = ?',
            [exists.id]
          );
        }
      }
    }
    
    // Create payment settings if missing
    const [existingSettings] = await connection.execute(
      'SELECT tenant_id FROM tenant_payment_settings WHERE tenant_id = ?',
      [tenantId]
    );
    
    if (existingSettings.length === 0) {
      console.log('➕ Creating payment settings for tenant');
      await connection.execute(`
        INSERT INTO tenant_payment_settings (
          tenant_id, default_currency, allow_partial_payments, 
          created_at, updated_at
        ) VALUES (?, ?, ?, NOW(), NOW())
      `, [tenantId, 'USD', 1]);
    }
    
    await connection.commit();
    
    // Verify final state
    const [finalMethods] = await connection.execute(
      'SELECT name, code, is_active, sort_order FROM payment_methods WHERE tenant_id = ? ORDER BY sort_order',
      [tenantId]
    );
    
    console.log('\n🎉 FINAL PAYMENT METHODS:');
    finalMethods.forEach(method => {
      console.log(`  ✅ ${method.name} (${method.code}) - Active: ${method.is_active} - Order: ${method.sort_order}`);
    });
    
    console.log(`\n✅ Successfully fixed payment methods! Total: ${finalMethods.length}`);
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error fixing payment methods:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run the script if called directly
if (require.main === module) {
  fixPaymentMethodsForTenant()
    .then(() => {
      console.log('✅ Payment methods fix completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Payment methods fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixPaymentMethodsForTenant };
