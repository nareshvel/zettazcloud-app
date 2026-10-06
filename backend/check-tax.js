require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  let pool;
  try {
    pool = await mysql.createPool({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE
    });
    
    console.log('Connected to database');
    
    // Check tax classes
    const [taxClasses] = await pool.execute('SELECT * FROM tax_classes');
    console.log('Tax Classes:');
    console.log(JSON.stringify(taxClasses, null, 2));
    
    // Look for specific tax class ID
    const specificId = '92bd6f00-36f9-11f0-8297-525400148990';
    const [specificTaxClass] = await pool.execute('SELECT * FROM tax_classes WHERE id = ?', [specificId]);
    console.log(`\nTax Class with ID ${specificId}:`);
    console.log(JSON.stringify(specificTaxClass, null, 2));
    
    // Check tax rates for all classes
    console.log('\nTax Rates by Class:');
    for (const tc of taxClasses) {
      const [rates] = await pool.execute('SELECT * FROM tax_class_rates WHERE tax_class_id = ?', [tc.id]);
      console.log(`\nRates for ${tc.name} (${tc.id}):`);
      console.log(JSON.stringify(rates, null, 2));
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (pool) await pool.end();
  }
}

main().catch(console.error).finally(() => process.exit(0));
