const pool = require('./db');

async function testReturnableItems() {
  try {
    const saleId = '0f1b6715-262a-4c40-9134-86c6016f589f';
    const tenantId = 'd7f267da-d5d9-4a15-b0d3-31ca710a4492';
    
    console.log('Testing returnable items API...');
    
    const connection = await pool.getConnection();
    
    // Test the exact query from the controller
    const [sales] = await connection.query(
      `SELECT s.*, CONCAT(c.first_name, ' ', COALESCE(c.last_name, '')) as customer_name, c.email as customer_email 
       FROM sales s 
       LEFT JOIN customers c ON s.customer_id = c.id 
       WHERE s.id = ? AND s.tenant_id = ?`,
      [saleId, tenantId]
    );
    
    if (sales.length === 0) {
      console.log('❌ No sale found');
      connection.release();
      return;
    }
    
    const sale = sales[0];
    console.log('✅ Sale data:', JSON.stringify(sale, null, 2));
    
    // Test sale items query
    const [saleItems] = await connection.query(
      `SELECT si.id, si.product_id, p.name as product_name, p.sku as product_sku, p.description as product_description, c.name as category_name, si.quantity as original_quantity, si.price as unit_price, (si.price * si.quantity) as total_price
       FROM sale_items si
       JOIN products p ON si.product_id = p.id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE si.sale_id = ?`,
      [saleId]
    );
    
    console.log('✅ Sale items:', JSON.stringify(saleItems, null, 2));
    
    // Create the saleInfo object exactly as the controller does
    const saleInfo = {
      id: sale.id,
      subtotal: parseFloat(sale.subtotal) || 0,
      tax_amount: parseFloat(sale.tax) || 0,
      discount_amount: parseFloat(sale.discount_amount || sale.discount || 0),
      total_amount: parseFloat(sale.total) || 0,
      sale_date: sale.created_at,
      customer_name: sale.customer_name || 'Walk-in Customer', 
      customer_email: sale.customer_email || '',
    };
    
    console.log('✅ Final saleInfo:', JSON.stringify(saleInfo, null, 2));
    
    const response = {
      data: saleItems,
      saleInfo: saleInfo
    };
    
    console.log('✅ Complete API response:', JSON.stringify(response, null, 2));
    
    connection.release();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
}

testReturnableItems();
