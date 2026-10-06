const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function fixIds() {
  let connection;
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      multipleStatements: true
    });

    await connection.beginTransaction();

    try {
      console.log('Starting ID migration...');
      
      // 1. Fix categories
      console.log('\n=== Processing Categories ===');
      const [categories] = await connection.execute(
        "SELECT * FROM categories WHERE id NOT REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'"
      );

      console.log(`Found ${categories.length} categories to update`);
      
      // Create new categories with UUIDs and update product references
      for (const category of categories) {
        const newId = uuidv4();
        console.log(`Updating category: ${category.name} (${category.id} -> ${newId})`);
        
        // Create new category with UUID
        await connection.execute(
          `INSERT INTO categories (id, tenant_id, name, description, image_url, created_at, updated_at)
           SELECT ?, tenant_id, name, description, image_url, created_at, updated_at
           FROM categories WHERE id = ?`,
          [newId, category.id]
        );
        
        // Update product references
        await connection.execute(
          'UPDATE products SET category_id = ? WHERE category_id = ?',
          [newId, category.id]
        );
        
        // Delete old category
        await connection.execute(
          'DELETE FROM categories WHERE id = ?',
          [category.id]
        );
      }

      // 2. Fix products
      console.log('\n=== Processing Products ===');
      const [products] = await connection.execute(
        "SELECT * FROM products WHERE id NOT REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'"
      );

      console.log(`Found ${products.length} products to update`);
      
      // Create new products with UUIDs and update sale_items references
      for (const product of products) {
        const newId = uuidv4();
        console.log(`Updating product: ${product.name} (${product.id} -> ${newId})`);
        
        // Create new product with UUID and update SKU/barcode to be unique
        await connection.execute(
          `INSERT INTO products (
            id, tenant_id, category_id, name, description, price, 
            sku, barcode, stock_quantity, image_url, is_active, created_at, updated_at
          )
          SELECT 
            ?, 
            tenant_id, 
            category_id, 
            name, 
            description, 
            price, 
            CONCAT(IFNULL(sku, CONCAT('SKU-', id)), '-migrated-', UUID_SHORT()) as sku, 
            CONCAT(IFNULL(barcode, CONCAT('BC-', id)), '-migrated-', UUID_SHORT()) as barcode, 
            stock_quantity, 
            image_url, 
            is_active, 
            created_at, 
            updated_at
          FROM products WHERE id = ?`,
          [newId, product.id]
        );
        
        console.log(`Migrated product: ${product.name}`);
        
        // Update sale_items references
        await connection.execute(
          'UPDATE sale_items SET product_id = ? WHERE product_id = ?',
          [newId, product.id]
        );
        
        // Delete old product
        await connection.execute(
          'DELETE FROM products WHERE id = ?',
          [product.id]
        );
      }

      await connection.commit();
      console.log('\nMigration completed successfully!');

    } catch (error) {
      await connection.rollback();
      console.error('Error during migration:', error);
      throw error;
    }

  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
    process.exit(0);
  }
}

// Run the migration
fixIds().catch(console.error);
