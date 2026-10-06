const { query } = require('../config/db');

/**
 * Get sales transactions for reports
 */
const getSalesTransactions = async (tenant_id, store_id, options = {}) => {
  try {
    if (!tenant_id || !store_id) {
      throw new Error('getSalesTransactions requires tenant_id and store_id');
    }

    const {
      limit = 10,
      offset = 0,
      start_date = null,
      end_date = null,
      status = null,
      // accept camelCase fallbacks
      startDate = null,
      endDate = null
    } = options || {};

    const fromDate = start_date || startDate;
    const toDate = end_date || endDate;

    let sql = `
      SELECT 
        s.id,
        s.id as sale_number,
        s.total,
        s.tax,
        s.discount_amount,
        s.status,
        s.payment_method,
        s.created_at,
        CONCAT(c.first_name, ' ', COALESCE(c.last_name, '')) as customer_name,
        c.phone_number as customer_phone,
        u.name as cashier_name,
        (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) as total_items
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.cashier_id = u.id
      WHERE s.tenant_id = ? AND s.store_id = ?
    `;

    const params = [tenant_id, store_id];

    if (fromDate) {
      sql += ` AND DATE(s.created_at) >= ?`;
      params.push(fromDate);
    }

    if (toDate) {
      sql += ` AND DATE(s.created_at) <= ?`;
      params.push(toDate);
    }

    if (status) {
      sql += ` AND s.status = ?`;
      params.push(status);
    }

    // Use string interpolation for LIMIT and OFFSET to avoid parameter binding issues
    const limitNum = parseInt(limit) || 10;
    const offsetNum = parseInt(offset) || 0;
    sql += ` ORDER BY s.created_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;

    const results = await query(sql, params);
    const data = Array.isArray(results) ? results.map(r => ({
      id: r.id,
      saleNumber: r.sale_number,
      totalAmount: r.total,
      taxAmount: r.tax,
      discountAmount: r.discount_amount,
      status: r.status,
      paymentMethod: r.payment_method,
      transactionDate: r.created_at,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      cashierName: r.cashier_name,
      totalItems: r.total_items ?? 0
    })) : [];
    return { status: 'success', data };
  } catch (error) {
    console.error('Error getting sales transactions:', error);
    throw error;
  }
};

/**
 * Get payment summary
 */
const getPaymentSummary = async (tenant_id, store_id, period = '30') => {
  try {
    const sql = `
      SELECT 
        payment_method,
        COUNT(*) as transaction_count,
        SUM(total) as total_amount
      FROM sales 
      WHERE tenant_id = ? 
        AND store_id = ? 
        AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND status = 'completed'
      GROUP BY payment_method
      ORDER BY total_amount DESC
    `;
    
    const [results] = await query(sql, [tenant_id, store_id, period]);
    return results || [];
  } catch (error) {
    console.error('Error getting payment summary:', error);
    throw error;
  }
};

/**
 * Get sales by category
 */
const getSalesByCategory = async (tenant_id, store_id, period = '30') => {
  try {
    const sql = `
      SELECT 
        c.name as category_name,
        COUNT(DISTINCT s.id) as sales_count,
        SUM(si.quantity) as items_sold,
        SUM(si.quantity * si.price) as revenue
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      WHERE s.tenant_id = ? 
        AND s.store_id = ?
        AND s.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND s.status != 'cancelled'
      GROUP BY c.id, c.name
      ORDER BY revenue DESC
    `;
    
    const [results] = await query(sql, [tenant_id, store_id, period]);
    return results || [];
  } catch (error) {
    console.error('Error getting sales by category:', error);
    throw error;
  }
};

module.exports = {
  getSalesTransactions,
  getPaymentSummary,
  getSalesByCategory
};
