// GET /api/reports/sales/transactions
exports.getSalesTransactions = async (req, res, next) => {
  try {
    let { startDate, endDate, storeId } = req.query;
    const { tenant_id } = req.user;

    if (!tenant_id) {
      return res.status(403).json({ status: 'error', message: 'Tenant ID is missing.' });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ status: 'error', message: 'Start and end dates are required.' });
    }

    // Adjust dates to include full day range
    const adjustedEndDate = `${endDate}T23:59:59.999Z`;
    const adjustedStartDate = `${startDate}T00:00:00.000Z`;
    
    const queryParams = [tenant_id, adjustedStartDate, adjustedEndDate];

    let sql = `
      SELECT 
        s.id,
        s.created_at AS transaction_date,
        c.name AS customer_name,
        (
          SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id
        ) AS total_items,
        s.subtotal AS subtotal_amount,
        s.discount AS discount_amount,
        s.tax AS tax_amount,
        s.total_amount AS total_amount,
        s.payment_method,
        s.status,
        u.name AS cashier_name,
        st.name AS store_name
      FROM 
        sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN users u ON s.cashier_id = u.id
        LEFT JOIN stores st ON s.store_id = st.id
      WHERE 
        s.tenant_id = ?
        AND s.created_at >= ? 
        AND s.created_at <= ?
    `;

    if (storeId) {
      sql += ' AND s.store_id = ? ';
      queryParams.push(storeId);
    }

    sql += ' ORDER BY s.created_at DESC';

    const [rows] = await pool.query(sql, queryParams);

    // Format data for frontend
    const formattedData = rows.map(row => ({
      id: row.id,
      transactionDate: row.transaction_date,
      customerName: row.customer_name || 'Guest',
      totalItems: row.total_items || 0,
      subtotalAmount: parseFloat(row.subtotal_amount) || 0,
      discountAmount: parseFloat(row.discount_amount) || 0,
      taxAmount: parseFloat(row.tax_amount) || 0,
      totalAmount: parseFloat(row.total_amount) || 0, 
      paymentMethod: row.payment_method || 'Unknown',
      status: row.status || 'unknown',
      cashierName: row.cashier_name || 'System',
      storeName: row.store_name || 'Main Store'
    }));

    res.status(200).json({
      status: 'success',
      data: formattedData
    });
  } catch (error) {
    console.error('Error in getSalesTransactions:', error);
    next(error);
  }
};
