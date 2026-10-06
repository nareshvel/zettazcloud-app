const { query } = require('../config/db');

/**
 * Get sales summary data for dashboard
 */
const getSalesSummary = async (tenant_id, store_id, period = '30') => {
  try {
    const sql = `
      SELECT 
        COUNT(*) as total_sales,
        COALESCE(SUM(total), 0) as total_revenue,
        COALESCE(AVG(total), 0) as avg_order_value,
        COUNT(DISTINCT customer_id) as unique_customers
      FROM sales 
      WHERE tenant_id = ? 
        AND store_id = ? 
        AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND status = 'completed'
    `;
    
    const results = await query(sql, [tenant_id, store_id, period]);
    
    if (Array.isArray(results) && results.length > 0) {
      return results[0];
    } else if (results && typeof results === 'object') {
      return results;
    }
    
    return {
      total_sales: 0,
      total_revenue: 0,
      avg_order_value: 0,
      unique_customers: 0
    };
  } catch (error) {
    console.error('Error getting sales summary:', error);
    throw error;
  }
};

/**
 * Get sales chart data for dashboard
 */
const getSalesChartData = async (tenant_id, store_id, period = '7') => {
  try {
    const sql = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as sales_count,
        COALESCE(SUM(total), 0) as revenue
      FROM sales 
      WHERE tenant_id = ? 
        AND store_id = ? 
        AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND status = 'completed'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;
    
    const results = await query(sql, [tenant_id, store_id, period]);
    return results || [];
  } catch (error) {
    console.error('Error getting sales chart data:', error);
    throw error;
  }
};

/**
 * Get top selling products
 */
const getTopSellingProducts = async (tenant_id, store_id, limit = 5) => {
  try {
    const sql = `
      SELECT 
        p.name,
        p.sku,
        SUM(si.quantity) as total_sold,
        SUM(si.quantity * si.price) as total_revenue
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE s.tenant_id = ? 
        AND s.store_id = ?
        AND s.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        AND s.status = 'completed'
      GROUP BY p.id, p.name, p.sku
      ORDER BY total_sold DESC
      LIMIT ?
    `;
    
    const [results] = await query(sql, [tenant_id, store_id, limit]);
    return results || [];
  } catch (error) {
    console.error('Error getting top selling products:', error);
    throw error;
  }
};

module.exports = {
  getSalesSummary,
  getSalesChartData,
  getTopSellingProducts
};
