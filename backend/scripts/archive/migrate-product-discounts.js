/**
 * Migration script to convert legacy product-specific discounts to promotional offers
 * 
 * This script:
 * 1. Finds all products with specific_discount_type and specific_discount_value
 * 2. Creates a promotional offer for each product
 * 3. Updates the product to use the new promotional offer
 * 4. Logs the migration results
 * 
 * Usage:
 * node migrate-product-discounts.js
 */

require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

// Simple logger replacement
const logger = {
  info: (message) => console.log(`[INFO] ${message}`),
  error: (message, error) => console.error(`[ERROR] ${message}`, error)
};

async function migrateProductDiscounts() {
  let transaction;
  
  try {
    transaction = await db.beginTransaction();
    
    logger.info('Starting migration of product-specific discounts to promotional offers');
    
    // Find all products with specific discounts
    const products = await db.query(`
      SELECT 
        id, 
        tenant_id, 
        store_id,
        name, 
        specific_discount_type, 
        specific_discount_value 
      FROM 
        products 
      WHERE 
        specific_discount_type IS NOT NULL 
        AND specific_discount_value IS NOT NULL 
        AND specific_discount_value > 0
    `);
    
    logger.info(`Found ${products.length} products with specific discounts to migrate`);
    
    if (products.length === 0) {
      logger.info('No products to migrate. Exiting.');
      await transaction.commit();
      return;
    }
    
    // Process each product
    for (const product of products) {
      const offerId = uuidv4();
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
      const endDate = oneYearFromNow.toISOString().slice(0, 19).replace('T', ' ');
      
      // Create a promotional offer for this product
      await transaction.query(`
        INSERT INTO promotional_offers (
          id, 
          tenant_id,
          store_id,
          name, 
          description, 
          discount_type, 
          discount_value, 
          is_active, 
          start_date, 
          end_date, 
          created_at, 
          updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?
        )
      `, [
        offerId,
        product.tenant_id,
        product.store_id,
        `${product.name} - Product Specific Discount`,
        `Auto-created from product-specific discount for ${product.name}`,
        product.specific_discount_type,
        product.specific_discount_value,
        now,
        endDate,
        now,
        now
      ]);
      
      // Update the product to use the new promotional offer
      await transaction.query(`
        UPDATE products 
        SET 
          promotional_offer_id = ?,
          updated_at = ?
        WHERE 
          id = ?
      `, [offerId, now, product.id]);
      
      logger.info(`Migrated product ${product.name} (${product.id}) with ${product.specific_discount_type} discount of ${product.specific_discount_value} to promotional offer ${offerId}`);
    }
    
    logger.info('Migration completed successfully. Committing transaction.');
    await transaction.commit();
    
    logger.info('Consider running the following SQL to clear the legacy discount fields after verification:');
    logger.info(`
      UPDATE products 
      SET 
        specific_discount_type = NULL,
        specific_discount_value = NULL 
      WHERE 
        promotional_offer_id IS NOT NULL;
    `);
    
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    logger.error('Error during migration:', error);
    throw error;
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  migrateProductDiscounts()
    .then(() => {
      logger.info('Migration script completed');
      process.exit(0);
    })
    .catch(err => {
      logger.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { migrateProductDiscounts };
