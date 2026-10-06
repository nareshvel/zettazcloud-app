const { pool } = require('../db');
const logger = require('../utils/logger');
const { convertHtmlToEscpos } = require('../utils/printerUtils');

async function testPrintReceipt(saleId) {
  try {
    logger.log(`Testing receipt printing for sale ID: ${saleId}`);
    
    // Get complete sale information with items
    const connection = await pool.getConnection();
    const [saleData] = await connection.query(
      `SELECT u.name as cashier_name, s.discount_type, s.discount_value, s.discount_amount,
              s.subtotal, s.tax, s.total,
              CONCAT(c.first_name, ' ', c.last_name) as customer_name,
              p.name as payment_method_name
       FROM sales s 
       LEFT JOIN users u ON s.cashier_id = u.id
       LEFT JOIN customers c ON s.customer_id = c.id
       LEFT JOIN payment_methods p ON s.payment_method = p.id
       WHERE s.id = ?`,
      [saleId]
    );
    
    // Get sale items
    const [saleItems] = await connection.query(
      `SELECT si.product_name, si.quantity, si.price
       FROM sale_items si
       WHERE si.sale_id = ?`,
      [saleId]
    );
    
    connection.release();
    
    if (saleData.length === 0) {
      logger.log('No sale data found');
      return;
    }
    
    // Create simulated HTML content with more receipt details
    const saleInfo = saleData[0];
    const currentDate = new Date().toLocaleString();
    
    // Build an HTML receipt similar to what would be generated in a real sale
    let htmlContent = `
      <div data-sale-id="${saleId}" class="receipt-container">
        <div class="receipt-header">
          <h1>ZETTAZ STORE</h1>
          <p>Receipt: ${saleId.substring(0, 8)}</p>
          <p>Date: ${currentDate}</p>
        </div>
        <div class="receipt-info">
          <p class="cashier">Cashier: ${saleInfo.cashier_name || 'N/A'}</p>
          <p class="customer">Customer: ${saleInfo.customer_name || 'Walk-in Customer'}</p>
        </div>
        <div class="receipt-items">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
    `;
    
    // Add items
    saleItems.forEach(item => {
      const lineTotal = item.quantity * item.price;
      htmlContent += `
              <tr>
                <td>${item.product_name}</td>
                <td>${item.quantity}</td>
                <td>$${item.price.toFixed(2)}</td>
                <td>$${lineTotal.toFixed(2)}</td>
              </tr>
      `;
    });
    
    // Add totals
    htmlContent += `
            </tbody>
          </table>
        </div>
        <div class="receipt-totals">
          <p class="subtotal">Subtotal: $${saleInfo.subtotal.toFixed(2)}</p>
    `;
    
    // Add discount if present
    if (saleInfo.discount_amount > 0) {
      htmlContent += `
          <p class="discount">Discount${saleInfo.discount_type === 'percentage' ? ` (${saleInfo.discount_value}%)` : ''}: -$${saleInfo.discount_amount.toFixed(2)}</p>
      `;
    }
    
    // Add tax and total
    htmlContent += `
          <p class="tax">Tax: $${saleInfo.tax.toFixed(2)}</p>
          <p class="total">Total: $${saleInfo.total.toFixed(2)}</p>
          <p class="payment">Payment Method: ${saleInfo.payment_method_name || 'Cash'}</p>
        </div>
        <div class="receipt-footer">
          <p>Thank you for shopping with us!</p>
          <p>Please come again!</p>
        </div>
      </div>
    `;
    
    // Prepare additional data
    const additionalData = {
      cashierName: saleInfo.cashier_name,
      customerName: saleInfo.customer_name,
      discount: saleInfo.discount_amount,
      discountType: saleInfo.discount_type,
      discountValue: saleInfo.discount_value
    };
    
    logger.log('Sale data:', JSON.stringify(saleInfo));
    logger.log('Sale items:', JSON.stringify(saleItems));
    logger.log('Passing additional data:', JSON.stringify(additionalData));
    
    // Convert to ESC/POS and print the receipt content to console
    const escposData = await convertHtmlToEscpos(htmlContent, '80mm', null, additionalData);
    console.log('\n=== RECEIPT PREVIEW ===\n');
    console.log(escposData.toString('utf8'));
    console.log('\n=== END OF RECEIPT ===\n');
    
  } catch (error) {
    logger.error('Error testing receipt printing:', error);
  }
}

// Get sale ID from command line argument or use the provided one
const saleId = process.argv[2] || '01bc04ac-c63f-484f-8488-4c4ab978e2af';

testPrintReceipt(saleId)
  .then(() => {
    logger.log('Test completed');
    process.exit(0);
  })
  .catch(error => {
    logger.error('Test failed:', error);
    process.exit(1);
  });
