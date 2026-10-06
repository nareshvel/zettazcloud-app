const { pool } = require('../db');
const logger = require('../utils/logger');

async function checkReceipt(saleId) {
  const connection = await pool.getConnection();
  try {
    // Start transaction
    await connection.beginTransaction();

    logger.log(`Fetching receipt details for sale ID: ${saleId}`);
    
    // 1. Get basic sale details first
    const [sale] = await connection.query(
      `SELECT * FROM sales WHERE id = ?`,
      [saleId]
    );
    
    if (sale.length === 0) {
      throw new Error(`No sale found with ID: ${saleId}`);
    }
    
    // 2. Get cashier details if cashier_id exists
    if (sale[0].cashier_id) {
      const [cashier] = await connection.query(
        `SELECT name FROM users WHERE id = ?`,
        [sale[0].cashier_id]
      );
      if (cashier.length > 0) {
        sale[0].cashier_name = cashier[0].name;
      }
    }
    
    // 3. Get customer details if customer_id exists
    if (sale[0].customer_id) {
      const [customer] = await connection.query(
        `SELECT first_name, last_name, email, phone_number 
         FROM customers WHERE id = ?`,
        [sale[0].customer_id]
      );
      if (customer.length > 0) {
        sale[0].customer = customer[0];
      }
    }
    
    // 4. Get payment method name
    if (sale[0].payment_method) {
      const [paymentMethod] = await connection.query(
        `SELECT name FROM payment_methods WHERE id = ?`,
        [sale[0].payment_method]
      );
      if (paymentMethod.length > 0) {
        sale[0].payment_method_name = paymentMethod[0].name;
      }
    }

    // 2. Get sale items with error handling
    let items = [];
    try {
      const [saleItems] = await connection.query(
        `SELECT si.*, p.name as product_name, p.sku
         FROM sale_items si
         LEFT JOIN products p ON si.product_id = p.id
         WHERE si.sale_id = ?`,
        [saleId]
      );
      items = saleItems;
    } catch (error) {
      logger.warn('Could not fetch sale items:', error.message);
    }
    
    // 3. Try to get any applied discounts
    let discounts = [];
    try {
      // First try the sale_discounts table
      const [saleDiscounts] = await connection.query(
        `SELECT * FROM sale_discounts WHERE sale_id = ?`,
        [saleId]
      );
      discounts = saleDiscounts;
    } catch (error) {
      // If table doesn't exist, check for discounts in the sale record
      logger.warn('Could not fetch discounts from sale_discounts table, checking sale record...');
      
      if (sale[0].discount_amount > 0) {
        discounts = [{
          id: sale[0].id,
          amount: sale[0].discount_amount,
          type: sale[0].discount_type || 'fixed',
          name: 'Discount',
          description: 'Discount applied to sale'
        }];
      }
    }
    
    // 4. Get receipt HTML if it exists
    let receipt = null;
    try {
      const [receipts] = await connection.query(
        `SELECT * FROM receipt_data WHERE sale_id = ?`,
        [saleId]
      );
      receipt = receipts[0] || null;
    } catch (error) {
      logger.warn('Could not fetch receipt data:', error.message);
    }
    
    // 5. Commit transaction
    await connection.commit();
    
    // 6. Format the results
    const result = {
      sale: {
        ...sale[0],
        customer: sale[0].customer || null,
        cashier: sale[0].cashier_name ? {
          id: sale[0].cashier_id,
          name: sale[0].cashier_name
        } : null
      },
      items: items || [],
      discounts: discounts || [],
      receipt: receipt,
      summary: {
        has_cashier: !!sale[0].cashier_name,
        has_discounts: (discounts && discounts.length > 0) || false,
        has_receipt: !!receipt,
        cashier_id: sale[0].cashier_id || null,
        cashier_name: sale[0].cashier_name || null,
        discount_amount: sale[0].discount_amount || 0,
        discount_type: sale[0].discount_type || null,
        payment_method: sale[0].payment_method_name || null,
        discount_value: sale[0].discount_value
      }
    };

    logger.log('Receipt check completed successfully');
    return result;
  } catch (error) {
    await connection.rollback();
    logger.error('Error checking receipt:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Get sale ID from command line argument or use the provided one
const saleId = process.argv[2] || '0040f320-8ede-439c-9a42-036c454d996c';

checkReceipt(saleId)
  .then(result => {
    console.log('\n=== RECEIPT DETAILS ===');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n=== SUMMARY ===');
    console.log(JSON.stringify(result.summary, null, 2));
    console.log('\n=== SALE ITEMS ===');
    console.log(JSON.stringify(result.items, null, 2));
    if (result.discounts.length > 0) {
      console.log('\n=== DISCOUNTS ===');
      console.log(JSON.stringify(result.discounts, null, 2));
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
