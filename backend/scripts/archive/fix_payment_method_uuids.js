const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: 3306,
  ssl: false
};

async function fixPaymentMethodUUIDs() {
  let connection;
  
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    
    // Get all tenants
    const [tenants] = await connection.execute('SELECT id FROM tenants');
    console.log(`Found ${tenants.length} tenants`);
    
    for (const tenant of tenants) {
      const tenantId = tenant.id;
      console.log(`\nProcessing tenant: ${tenantId}`);
      
      // Delete existing payment methods for this tenant
      const [deleteResult] = await connection.execute(
        'DELETE FROM payment_methods WHERE tenant_id = ?',
        [tenantId]
      );
      console.log(`Deleted ${deleteResult.affectedRows} existing payment methods`);
      
      // Insert fixed payment methods with consistent UUIDs
      const defaultMethods = [
        {
          id: 'e9ca7524-35f4-11f0-8297-525400148990', // Fixed UUID for Cash
          name: 'Cash',
          code: 'cash',
          icon: 'cash',
          sortOrder: 1,
          requiresTerminal: false
        },
        {
          id: 'e9ca7670-35f4-11f0-8297-525400148990', // Fixed UUID for Card
          name: 'Card',
          code: 'card',
          icon: 'credit-card',
          sortOrder: 2,
          requiresTerminal: true
        },
        {
          id: 'e9ca76b3-35f4-11f0-8297-525400148990', // Fixed UUID for Phone
          name: 'Phone',
          code: 'phone',
          icon: 'phone',
          sortOrder: 3,
          requiresTerminal: true
        },
        {
          id: 'e9ca75b4-35f4-11f0-8297-525400148990', // Fixed UUID for Charge
          name: 'Charge',
          code: 'on_account',
          icon: 'user',
          sortOrder: 4,
          requiresTerminal: false
        },
        {
          id: '00000000-0000-0000-0000-000000000000', // Fixed UUID for None
          name: 'No Payment Required',
          code: 'none',
          icon: 'check-circle',
          sortOrder: 99,
          requiresTerminal: false
        }
      ];

      // Insert new payment methods with fixed UUIDs
      for (const method of defaultMethods) {
        await connection.execute(
          `INSERT INTO payment_methods 
           (id, tenant_id, name, code, is_active, requires_terminal, icon, sort_order, created_at, updated_at) 
           VALUES (?, ?, ?, ?, 1, ?, ?, ?, NOW(), NOW())`,
          [method.id, tenantId, method.name, method.code, method.requiresTerminal ? 1 : 0, method.icon, method.sortOrder]
        );
        console.log(`Created: ${method.name} (${method.code}) with UUID: ${method.id}`);
      }
      
      console.log(`Successfully created ${defaultMethods.length} payment methods for tenant ${tenantId}`);
    }
    
    console.log('\n✅ Payment method UUID fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing payment method UUIDs:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the fix
fixPaymentMethodUUIDs();
