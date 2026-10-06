const { query } = require('../config/db');

/**
 * Get category sales summary for dashboard
 */
const getCategorySalesSummary = async (tenant_id, store_id, period = '30') => {
  try {
    const sql = `
      SELECT 
        c.id,
        c.name as category_name,
        COUNT(DISTINCT s.id) as sales_count,
        SUM(si.quantity) as items_sold,
        SUM(
          (si.quantity * si.price) + 
          (
            (si.quantity * si.price) / s.subtotal * COALESCE(s.tax, 0)
          )
        ) as revenue,
        AVG(si.price) as avg_price
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id
      LEFT JOIN sale_items si ON p.id = si.product_id
      LEFT JOIN sales s ON si.sale_id = s.id
      WHERE c.tenant_id = ?
        AND s.tenant_id = ? 
        AND s.store_id = ?
        AND s.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND s.status = 'completed'
      GROUP BY c.id, c.name
      HAVING revenue > 0
      ORDER BY revenue DESC
    `;
    
    const results = await query(sql, [tenant_id, tenant_id, store_id, period]);
    return results || [];
  } catch (error) {
    console.error('Error getting category sales summary:', error);
    throw error;
  }
};

/**
 * Get recent activities for dashboard
 */
const getRecentActivities = async (tenant_id, store_id, limit = 10) => {
  try {
    const sql = `
      SELECT 
        'sale' as activity_type,
        s.id as reference_id,
        s.sale_number as reference,
        s.total_amount as amount,
        s.created_at,
        u.name as user_name,
        c.name as customer_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.tenant_id = ? AND s.store_id = ?
      ORDER BY s.created_at DESC
      LIMIT ?
    `;
    
    const [results] = await query(sql, [tenant_id, store_id, limit]);
    return results || [];
  } catch (error) {
    console.error('Error getting recent activities:', error);
    throw error;
  }
};

module.exports = {
  getCategorySalesSummary,
  getRecentActivities
};
