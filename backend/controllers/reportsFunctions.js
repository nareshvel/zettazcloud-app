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
        CONCAT(c.first_name, ' ', IFNULL(c.last_name, '')) AS customer_name,
        (
          SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id
        ) AS total_items,
        s.subtotal AS subtotal_amount,
        s.discount_amount,
        s.tax AS tax_amount,
        s.total AS total_amount,
        pm.name AS payment_method,
        pm.code AS payment_method_code,
        s.status,
        CONCAT(u.first_name, ' ', IFNULL(u.last_name, '')) AS cashier_name,
        st.name AS store_name
      FROM 
        sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN payment_methods pm ON s.payment_method_id = pm.id
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
      paymentMethodCode: row.payment_method_code,
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

// GET /api/reports/sales/chart
exports.getSalesChartData = async (req, res, next) => {
  try {
    let { startDate, endDate, storeId } = req.query;
    const { tenant_id } = req.user;

    if (!tenant_id) {
      return res.status(403).json({ status: 'error', message: 'Tenant ID is missing.' });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ status: 'error', message: 'Start and end dates are required.' });
    }

    // Adjust dates
    const adjustedEndDate = `${endDate}T23:59:59.999Z`;
    const adjustedStartDate = `${startDate}T00:00:00.000Z`;
    
    const queryParams = [tenant_id, adjustedStartDate, adjustedEndDate];

    let storeFilter = '';
    if (storeId) {
      storeFilter = ' AND s.store_id = ? ';
      queryParams.push(storeId);
    }

    // SQL to group sales by date
    const sql = `
      SELECT 
        DATE(s.created_at) AS date,
        SUM(s.total) AS total_sales,
        COUNT(s.id) AS transactions
      FROM 
        sales s
      WHERE 
        s.tenant_id = ?
        AND s.created_at >= ? 
        AND s.created_at <= ?
        AND s.status = 'completed'
        ${storeFilter}
      GROUP BY 
        DATE(s.created_at)
      ORDER BY 
        date ASC
    `;

    const [rows] = await pool.query(sql, queryParams);

    // Format data for frontend chart
    const formattedData = rows.map(row => ({
      date: row.date.toISOString().split('T')[0], // Format as YYYY-MM-DD
      totalSales: parseFloat(row.total_sales) || 0,
      transactions: parseInt(row.transactions) || 0
    }));

    res.status(200).json({
      status: 'success',
      data: formattedData
    });
  } catch (error) {
    console.error('Error in getSalesChartData:', error);
    next(error);
  }
};

// GET /api/reports/inventory/items
exports.getInventoryReportItems = async (req, res, next) => {
  try {
    const { tenant_id } = req.user;
    let { categoryId, supplierId, lowStock, outOfStock, storeId } = req.query;

    if (!tenant_id) {
      return res.status(403).json({ status: 'error', message: 'Tenant ID is missing.' });
    }

    const queryParams = [tenant_id];
    let additionalFilters = '';

    if (categoryId) {
      additionalFilters += ' AND p.category_id = ? ';
      queryParams.push(categoryId);
    }

    if (supplierId) {
      additionalFilters += ' AND p.supplier_id = ? ';
      queryParams.push(supplierId);
    }

    if (lowStock === 'true') {
      additionalFilters += ' AND i.current_stock <= p.reorder_level AND i.current_stock > 0 ';
    }

    if (outOfStock === 'true') {
      additionalFilters += ' AND i.current_stock = 0 ';
    }

    let storeJoin = '';
    if (storeId) {
      storeJoin = ' AND i.store_id = ? ';
      queryParams.push(storeId);
    }

    // Query to get inventory items with related data
    const sql = `
      SELECT 
        p.id AS product_id,
        p.name AS product_name,
        p.sku,
        c.name AS category_name,
        s.name AS supplier_name,
        i.current_stock,
        p.cost_price,
        (i.current_stock * p.cost_price) AS stock_value,
        p.reorder_level,
        (
          SELECT MAX(si.created_at)
          FROM sale_items si 
          JOIN sales sa ON si.sale_id = sa.id
          WHERE si.product_id = p.id AND sa.tenant_id = p.tenant_id AND sa.status = 'completed'
        ) AS last_sold_date,
        (
          SELECT MAX(ir.created_at)
          FROM inventory_receipts ir
          WHERE ir.product_id = p.id AND ir.tenant_id = p.tenant_id
        ) AS last_received_date
      FROM 
        products p
        LEFT JOIN inventory i ON p.id = i.product_id AND p.tenant_id = i.tenant_id ${storeJoin}
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE 
        p.tenant_id = ?
        AND p.status = 'active'
        ${additionalFilters}
      ORDER BY
        p.name ASC
    `;

    const [rows] = await pool.query(sql, queryParams);

    // Format data for frontend
    const formattedData = rows.map(row => ({
      productId: row.product_id,
      productName: row.product_name,
      sku: row.sku,
      categoryName: row.category_name || 'Uncategorized',
      supplierName: row.supplier_name || 'Unknown Supplier',
      currentStock: parseInt(row.current_stock) || 0,
      costPrice: parseFloat(row.cost_price) || 0,
      stockValue: parseFloat(row.stock_value) || 0,
      reorderLevel: parseInt(row.reorder_level) || 0,
      lastSoldDate: row.last_sold_date ? new Date(row.last_sold_date).toISOString() : null,
      lastReceivedDate: row.last_received_date ? new Date(row.last_received_date).toISOString() : null
    }));

    res.status(200).json({
      status: 'success',
      data: formattedData
    });
    
  } catch (error) {
    console.error('Error in getInventoryReportItems:', error);
    next(error);
  }
};

// GET /api/reports/inventory/summary
exports.getInventorySummaryMetrics = async (req, res, next) => {
  try {
    const { tenant_id } = req.user;
    const { storeId } = req.query;

    if (!tenant_id) {
      return res.status(403).json({ status: 'error', message: 'Tenant ID is missing.' });
    }

    const queryParams = [tenant_id];
    let storeFilter = '';

    if (storeId) {
      storeFilter = ' AND i.store_id = ? ';
      queryParams.push(storeId);
    }

    // First get total unique items
    const uniqueItemsQuery = `
      SELECT COUNT(DISTINCT p.id) AS total_unique_items
      FROM products p
      WHERE p.tenant_id = ?
      AND p.status = 'active'
    `;

    // Get items in stock and total value
    const stockQuery = `
      SELECT 
        SUM(CASE WHEN i.current_stock > 0 THEN 1 ELSE 0 END) AS items_in_stock,
        SUM(CASE WHEN i.current_stock > 0 THEN i.current_stock ELSE 0 END) AS total_items_count,
        SUM(i.current_stock * p.cost_price) AS total_stock_value,
        SUM(CASE WHEN i.current_stock <= p.reorder_level AND i.current_stock > 0 THEN 1 ELSE 0 END) AS low_stock_items,
        SUM(CASE WHEN i.current_stock = 0 THEN 1 ELSE 0 END) AS out_of_stock_items
      FROM 
        products p
        LEFT JOIN inventory i ON p.id = i.product_id AND p.tenant_id = i.tenant_id ${storeFilter}
      WHERE 
        p.tenant_id = ?
        AND p.status = 'active'
    `;

    const [uniqueItemsResult] = await pool.query(uniqueItemsQuery, [tenant_id]);
    const [stockResult] = await pool.query(stockQuery, queryParams);

    const result = {
      totalUniqueItems: parseInt(uniqueItemsResult[0]?.total_unique_items) || 0,
      totalItemsInStock: parseInt(stockResult[0]?.items_in_stock) || 0,
      totalStockValue: parseFloat(stockResult[0]?.total_stock_value) || 0,
      lowStockItemsCount: parseInt(stockResult[0]?.low_stock_items) || 0,
      outOfStockItemsCount: parseInt(stockResult[0]?.out_of_stock_items) || 0
    };

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    console.error('Error in getInventorySummaryMetrics:', error);
    next(error);
  }
};
