/**
 * Get payment report items
 * @route GET /api/reports/payments/items
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 * @returns {object} Payment report data
 */
const getPaymentReportItems = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id;
    const { startDate, endDate, storeId, paymentMethod } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        status: 'error',
        message: 'Start date and end date are required'
      });
    }
    
    // Create date objects and set time to start and end of day
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    // Start building the query
    let queryParams = [tenantId, start, end];
    let additionalFilters = '';
    
    // Add store filter if provided
    if (storeId) {
      additionalFilters += ' AND s.store_id = ? ';
      queryParams.push(storeId);
    }
    
    // Add payment method filter if provided
    if (paymentMethod) {
      additionalFilters += ' AND s.payment_method = ? ';
      queryParams.push(paymentMethod);
    }
    
    const sql = `
      SELECT 
        s.id,
        s.created_at AS date,
        s.id AS invoice_id,
        CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) AS customer_name,
        s.payment_method,
        s.total_amount AS amount,
        s.status,
        CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS processed_by
      FROM 
        sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN users u ON s.cashier_id = u.id
      WHERE 
        s.tenant_id = ?
        AND s.created_at BETWEEN ? AND ?
        ${additionalFilters}
      ORDER BY
        s.created_at DESC
    `;
    
    const [rows] = await pool.query(sql, queryParams);
    
    // Format the data for frontend
    const paymentReports = rows.map(row => ({
      id: row.id,
      date: row.date,
      invoiceId: row.invoice_id,
      customerName: row.customer_name || 'Walk-in Customer',
      paymentMethod: row.payment_method,
      amount: parseFloat(row.amount) || 0,
      status: row.status === 'completed' ? 'Completed' : 
              row.status === 'refunded' ? 'Refunded' : 
              row.status === 'voided' ? 'Failed' : row.status,
      processedBy: row.processed_by || 'Unknown'
    }));
    
    res.json({
      status: 'success',
      data: paymentReports
    });
    
  } catch (error) {
    console.error('Error in getPaymentReportItems:', error);
    next(error);
  }
};

/**
 * Get payment summary metrics
 * @route GET /api/reports/payments/summary
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 * @returns {object} Payment summary metrics
 */
const getPaymentSummaryMetrics = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id;
    const { startDate, endDate, storeId } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        status: 'error',
        message: 'Start date and end date are required'
      });
    }
    
    // Create date objects and set time to start and end of day
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    // Start building the query
    let queryParams = [tenantId, start, end];
    let storeFilter = '';
    
    // Add store filter if provided
    if (storeId) {
      storeFilter = ' AND store_id = ? ';
      queryParams.push(storeId);
    }
    
    // Query for total revenue, transactions count, and refunds
    const totalMetricsQuery = `
      SELECT 
        SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END) AS total_revenue,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) AS total_transactions,
        SUM(CASE WHEN status = 'refunded' THEN total_amount ELSE 0 END) AS total_refunds
      FROM 
        sales
      WHERE 
        tenant_id = ?
        AND created_at BETWEEN ? AND ?
        ${storeFilter}
    `;
    
    // Query for payment method breakdown
    const paymentMethodsQuery = `
      SELECT 
        payment_method,
        COUNT(*) AS count,
        SUM(total_amount) AS total_amount
      FROM 
        sales
      WHERE 
        tenant_id = ?
        AND status = 'completed'
        AND created_at BETWEEN ? AND ?
        ${storeFilter}
      GROUP BY
        payment_method
    `;
    
    const [totalMetricsRows] = await pool.query(totalMetricsQuery, queryParams);
    const [paymentMethodsRows] = await pool.query(paymentMethodsQuery, queryParams);
    
    const totalRevenue = parseFloat(totalMetricsRows[0]?.total_revenue || 0);
    const totalTransactions = parseInt(totalMetricsRows[0]?.total_transactions || 0);
    const totalRefunds = parseFloat(totalMetricsRows[0]?.total_refunds || 0);
    const netRevenue = totalRevenue - totalRefunds;
    
    const paymentsByMethod = paymentMethodsRows.map(row => ({
      method: row.payment_method,
      count: parseInt(row.count),
      totalAmount: parseFloat(row.total_amount || 0)
    }));
    
    const averageTransactionValue = totalTransactions > 0 
      ? totalRevenue / totalTransactions 
      : 0;
    
    res.json({
      status: 'success',
      data: {
        totalRevenue,
        totalTransactions,
        averageTransactionValue,
        paymentsByMethod,
        totalRefunds,
        netRevenue
      }
    });
    
  } catch (error) {
    console.error('Error in getPaymentSummaryMetrics:', error);
    next(error);
  }
};

module.exports = {
  getCustomerValueReport,
  getCustomerValueSummaryMetrics,
  getChargeAccountReport,
  getChargeAccountSummaryMetrics,
  getSalesTransactions,
  getSalesChartData,
  getInventoryReportItems,
  getInventorySummaryMetrics,
  getPaymentReportItems,
  getPaymentSummaryMetrics
};
