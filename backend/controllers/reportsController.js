const { pool } = require('../db'); // Assuming db.js exports pool

// Set to true to enable debug logs for reports controller
const DEBUG_REPORTS = process.env.DEBUG_REPORTS === 'true' || false;

// Conditional debug logging helper
const debugLog = (...args) => {
  if (DEBUG_REPORTS) {
    console.log('[REPORTS]', ...args);
  }
};

// GET /api/reports/customer-value
exports.getCustomerValueReport = async (req, res, next) => {
  try {
    let { startDate, endDate, storeId } = req.query;
    const tenant_id = req.headers["x-tenant-id"] || req.user?.tenant_id || req.query?.tenant_id || null;
      // Debug log the tenant_id extraction
      debugLog('Using tenant_id:', tenant_id); // From authenticate middleware

    if (!tenant_id) {
      return res.status(403).json({ status: 'error', message: 'Tenant ID is missing or user is not authenticated properly.' });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ status: 'error', message: 'startDate and endDate are required query parameters.' });
    }

    // Adjust endDate to include the whole day
    endDate = `${endDate}T23:59:59.999Z`;
    startDate = `${startDate}T00:00:00.000Z`;

    const queryParams = [tenant_id, startDate, endDate];

    let sql = `
      SELECT
        s.customer_id,
        CONCAT(c.first_name, ' ', IFNULL(c.last_name, '')) AS customer_name,
        SUM(s.total) AS total_spent,
        COUNT(DISTINCT s.id) AS transaction_count,
        (SUM(s.total) / COUNT(DISTINCT s.id)) AS average_purchase_value,
        MIN(s.created_at) AS first_purchase_date,
        MAX(s.created_at) AS last_purchase_date
        -- customer_segment can be added later based on business logic
      FROM
        sales s
      JOIN
        customers c ON s.customer_id = c.id AND s.tenant_id = c.tenant_id
      WHERE
        s.tenant_id = ?
        AND s.customer_id IS NOT NULL
        AND s.status = 'completed' -- Only consider completed sales
        AND s.created_at >= ? 
        AND s.created_at <= ? 
    `;

    if (storeId) {
      sql += ' AND s.store_id = ? ';
      queryParams.push(storeId);
    }

    sql += `
      GROUP BY
        s.customer_id, customer_name 
      ORDER BY
        total_spent DESC;
    `;

    const [rows] = await pool.query(sql, queryParams);

    // Frontend expects snake_case, but our query aliases are already snake_case or will be converted by fetchApi if not.
    // The SQL query already produces most fields in snake_case as needed by frontend's CustomerValueReportItem (after camelCase conversion by fetchApi)
    // e.g. customer_id, total_spent, transaction_count, average_purchase_value, first_purchase_date, last_purchase_date
    // customer_name is also fine.
    // customer_segment is not yet implemented.
    
    // The SQL query aliases are already in snake_case, which is what fetchApi expects.
    // We just need to ensure correct types (numbers, ISO strings for dates).
    const reportData = rows.map(row => ({
      customer_id: row.customer_id,
      customer_name: row.customer_name, // This alias is fine
      total_spent: parseFloat(row.total_spent) || 0,
      transaction_count: parseInt(row.transaction_count, 10) || 0,
      average_purchase_value: parseFloat(row.average_purchase_value) || 0,
      first_purchase_date: row.first_purchase_date ? new Date(row.first_purchase_date).toISOString() : null,
      last_purchase_date: row.last_purchase_date ? new Date(row.last_purchase_date).toISOString() : null,
      // customer_segment: 'todo' // Placeholder for now, ensure snake_case if added
    }));

    res.status(200).json({
      status: 'success',
      data: reportData // This data array now contains objects with snake_case keys
    });
  } catch (error) {
    console.error('Error in getCustomerValueReport:', error);
    next(error); // Pass to global error handler
  }
};

// GET /api/reports/customer-value/summary
exports.getCustomerValueSummaryMetrics = async (req, res, next) => {
  try {
    let { startDate, endDate, storeId } = req.query;
    const tenant_id = req.headers["x-tenant-id"] || req.user?.tenant_id || req.query?.tenant_id || null;
      // Debug log the tenant_id extraction
      debugLog('Using tenant_id:', tenant_id);

    if (!tenant_id) {
      return res.status(403).json({ status: 'error', message: 'Tenant ID is missing.' });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ status: 'error', message: 'startDate and endDate are required.' });
    }

    const originalEndDate = endDate;
    endDate = `${endDate}T23:59:59.999Z`;
    startDate = `${startDate}T00:00:00.000Z`;

    const baseParams = [tenant_id, startDate, endDate];
    const storeFilterSql = storeId ? ' AND s.store_id = ? ' : '';
    const storeParams = storeId ? [storeId] : [];

    // Query 1: Aggregates
    const aggSql = `
      SELECT
        COUNT(DISTINCT s.customer_id) AS total_unique_customers,
        SUM(s.total) / COUNT(DISTINCT s.customer_id) AS average_value_per_customer
      FROM sales s
      WHERE s.tenant_id = ? AND s.customer_id IS NOT NULL AND s.status = 'completed'
        AND s.created_at >= ? AND s.created_at <= ? ${storeFilterSql};
    `;
    const [aggResult] = await pool.query(aggSql, [...baseParams, ...storeParams]);
    const aggregates = aggResult[0] || { total_unique_customers: 0, average_value_per_customer: 0 }; 

    // Query 2: Top Customer by Spending
    const topSpendingSql = `
      SELECT s.customer_id, CONCAT(c.first_name, ' ', IFNULL(c.last_name, '')) AS name, SUM(s.total) AS amount
      FROM sales s JOIN customers c ON s.customer_id = c.id AND s.tenant_id = c.tenant_id
      WHERE s.tenant_id = ? AND s.customer_id IS NOT NULL AND s.status = 'completed'
        AND s.created_at >= ? AND s.created_at <= ? ${storeFilterSql}
      GROUP BY s.customer_id, name ORDER BY amount DESC LIMIT 1;
    `;
    const [topSpendingResult] = await pool.query(topSpendingSql, [...baseParams, ...storeParams]);
    const topCustomerBySpending = topSpendingResult[0] || null;

    // Query 3: Top Customer by Frequency
    const topFrequencySql = `
      SELECT s.customer_id, CONCAT(c.first_name, ' ', IFNULL(c.last_name, '')) AS name, COUNT(DISTINCT s.id) AS count
      FROM sales s JOIN customers c ON s.customer_id = c.id AND s.tenant_id = c.tenant_id
      WHERE s.tenant_id = ? AND s.customer_id IS NOT NULL AND s.status = 'completed'
        AND s.created_at >= ? AND s.created_at <= ? ${storeFilterSql}
      GROUP BY s.customer_id, name ORDER BY count DESC LIMIT 1;
    `;
    const [topFrequencyResult] = await pool.query(topFrequencySql, [...baseParams, ...storeParams]);
    const topCustomerByFrequency = topFrequencyResult[0] || null;

    // Query 4: New Customers This Period
    // Uses originalEndDate for the outer WHERE clause to match the period precisely for first_sale_date
    const newCustomersSql = `
      SELECT COUNT(DISTINCT customer_id) as new_customers_this_period
      FROM (
          SELECT s.customer_id, MIN(s.created_at) AS first_sale_date
          FROM sales s
          WHERE s.tenant_id = ? AND s.customer_id IS NOT NULL AND s.status = 'completed'
            ${storeId ? ' AND s.store_id = ? ' : ''} 
          GROUP BY s.customer_id
      ) AS customer_first_sales
      WHERE first_sale_date >= ? AND first_sale_date <= ?;
    `;
    // Parameters for newCustomersSql: [tenant_id, (storeId if present), startDate, endDate]
    const newCustomersParams = [tenant_id];
    if (storeId) newCustomersParams.push(storeId);
    newCustomersParams.push(startDate, endDate); // Use adjusted full-day startDate and endDate for comparison with first_sale_date
    const [newCustomersResult] = await pool.query(newCustomersSql, newCustomersParams);
    const newCustomersCount = newCustomersResult[0]?.new_customers_this_period || 0;

    const summaryData = {
      total_unique_customers: parseInt(aggregates.total_unique_customers, 10) || 0,
      average_lifetime_value: parseFloat(aggregates.average_value_per_customer) || 0, // Renamed from average_value_per_customer for consistency with frontend type
      top_customer_by_spending: topCustomerBySpending ? {
        customer_id: topCustomerBySpending.customer_id,
        name: topCustomerBySpending.name,
        amount: parseFloat(topCustomerBySpending.amount) || 0
      } : null,
      top_customer_by_frequency: topCustomerByFrequency ? {
        customer_id: topCustomerByFrequency.customer_id,
        name: topCustomerByFrequency.name,
        count: parseInt(topCustomerByFrequency.count, 10) || 0
      } : null,
      new_customers_this_period: parseInt(newCustomersCount, 10) || 0
    };

    res.status(200).json({
      status: 'success',
      data: summaryData
    });
  } catch (error) {
    console.error('Error in getCustomerValueSummaryMetrics:', error);
    next(error);
  }
};

// GET /api/reports/charge-account
exports.getChargeAccountReport = async (req, res, next) => {
  try {
    let { startDate, endDate, storeId, accountStatus } = req.query; // Dates might be for last_purchase_date range
    const tenant_id = req.headers["x-tenant-id"] || req.user?.tenant_id || req.query?.tenant_id || null;
      // Debug log the tenant_id extraction
      debugLog('Using tenant_id:', tenant_id);

    if (!tenant_id) {
      return res.status(403).json({ status: 'error', message: 'Tenant ID is missing.' });
    }

    // Dates are optional for this report, but if provided, they filter last_purchase_date
    let dateFilterSql = '';
    const queryParams = [tenant_id];

    if (startDate && endDate) {
      const adjustedEndDate = endDate;
      const adjustedStartDate = startDate;
      // This date filter will apply to the MAX(s.created_at) in a HAVING clause or subquery
      // For simplicity, let's apply it in HAVING clause if dates are provided
      // queryParams.push(adjustedStartDate, adjustedEndDate);
      // dateFilterSql = ' HAVING last_purchase_date >= ? AND last_purchase_date <= ? ';
      // Simpler: filter sales by date range before MAX aggregation
    }

    let statusFilterSql = '';
    if (accountStatus) {
      switch (accountStatus.toLowerCase()) {
        case 'active': // Has balance, not over limit
          statusFilterSql = ' AND IFNULL(c.outstanding_credit, 0) > 0 AND (c.credit_limit IS NULL OR IFNULL(c.outstanding_credit, 0) <= c.credit_limit) ';
          break;
        case 'over_limit': // Over credit limit
          statusFilterSql = ' AND c.credit_limit IS NOT NULL AND IFNULL(c.outstanding_credit, 0) > c.credit_limit ';
          break;
        case 'zero_balance': // Zero or negative balance (paid off / credit)
          statusFilterSql = ' AND IFNULL(c.outstanding_credit, 0) <= 0 ';
          break;
        // 'delinquent' and 'inactive' would require more complex logic (e.g., payment due dates, last activity date)
      }
    }

    let storeFilterForSales = '';
    if (storeId) {
      // This applies if we want last_purchase_date to be store-specific
      storeFilterForSales = ' AND s_lp.store_id = ? ';
      queryParams.push(storeId);
    }

    // Main query
    // We use a subquery for last_purchase_date to correctly apply date filters if provided
    let sql = `
      SELECT
        c.id AS customer_id,
        CONCAT(c.first_name, ' ', IFNULL(c.last_name, '')) AS customer_name,
        IFNULL(c.customer_type, 'INDIVIDUAL') AS account_type, -- Use customer's actual type
        IFNULL(c.outstanding_credit, 0) AS current_balance,
        c.credit_limit,
        (
          SELECT MAX(s_lp.created_at) 
          FROM sales s_lp 
          WHERE s_lp.customer_id = c.id AND s_lp.tenant_id = c.tenant_id AND s_lp.status = 'completed'
          ${storeFilterForSales}
          ${(startDate && endDate) ? `AND s_lp.created_at >= '${startDate}T00:00:00.000Z' AND s_lp.created_at <= '${endDate}T23:59:59.999Z'` : ''}
        ) AS last_purchase_date,
        CASE
          WHEN IFNULL(c.outstanding_credit, 0) > 0 THEN
            CASE WHEN
              DATE_ADD(
                (
                  SELECT MAX(s_lp.created_at) 
                  FROM sales s_lp 
                  WHERE s_lp.customer_id = c.id 
                    AND s_lp.tenant_id = c.tenant_id 
                    AND s_lp.status = 'completed'
                ),
                INTERVAL IFNULL(c.payment_terms_days, 30) DAY
              ) < CURRENT_DATE()
            THEN
              DATEDIFF(
                CURRENT_DATE(),
                DATE_ADD(
                  (
                    SELECT MAX(s_lp.created_at) 
                    FROM sales s_lp 
                    WHERE s_lp.customer_id = c.id 
                      AND s_lp.tenant_id = c.tenant_id 
                      AND s_lp.status = 'completed'
                  ),
                  INTERVAL IFNULL(c.payment_terms_days, 30) DAY
                )
              )
            ELSE
              NULL
            END
          ELSE NULL
        END AS days_overdue
      FROM
        customers c
      WHERE
        c.tenant_id = ? ${statusFilterSql}
      GROUP BY
        c.id, customer_name, c.outstanding_credit, c.credit_limit 
      ORDER BY
        customer_name;
    `;
    
    // Note: queryParams for the main query only contains tenant_id at index 0 if storeId is not used for sales subquery's store_id.
    // If storeId is used in storeFilterForSales, it's already added to queryParams.
    // The tenant_id for the main query is the first param.

    const [rows] = await pool.query(sql, queryParams);

    const reportData = rows.map(row => {
      let derivedAccountStatus = 'Inactive'; // Default
      const balance = parseFloat(row.current_balance) || 0;
      const limit = row.credit_limit ? parseFloat(row.credit_limit) : null;

      if (limit !== null && balance > limit) {
        derivedAccountStatus = 'Over Limit';
      } else if (balance > 0) {
        derivedAccountStatus = 'Active';
      } else if (balance <= 0) {
        derivedAccountStatus = 'Zero Balance';
      }
      // More complex statuses like 'Delinquent' or truly 'Inactive' (no activity for X time) would need more logic/data

      return {
        customer_id: row.customer_id,
        customer_name: row.customer_name,
        account_type: row.account_type || 'Standard',
        current_balance: balance,
        credit_limit: limit,
        last_purchase_date: row.last_purchase_date ? new Date(row.last_purchase_date).toISOString() : null,
        account_status: derivedAccountStatus,
        days_overdue: row.days_overdue > 0 ? parseInt(row.days_overdue, 10) : null
      };
    });

    res.status(200).json({
      status: 'success',
      data: reportData
    });
  } catch (error) {
    console.error('Error in getChargeAccountReport:', error);
    next(error);
  }
};

// GET /api/reports/charge-account/summary
exports.getChargeAccountSummaryMetrics = async (req, res, next) => {
  try {
    const tenant_id = req.headers["x-tenant-id"] || req.user?.tenant_id || req.query?.tenant_id || null;
      // Debug log the tenant_id extraction
      debugLog('Using tenant_id:', tenant_id);
    // const { accountStatus } = req.query; // accountStatus filter not implemented for summary yet

    if (!tenant_id) {
      return res.status(403).json({ status: 'error', message: 'Tenant ID is missing.' });
    }

    const queryParams = [tenant_id];

    // Query 1: Main Aggregates
    const aggSql = `
      SELECT
        COUNT(c.id) AS total_accounts,
        SUM(IFNULL(c.outstanding_credit, 0)) AS total_outstanding_balance,
        SUM(c.credit_limit) AS total_credit_limit,
        AVG(IFNULL(c.outstanding_credit, 0)) AS average_balance_per_account_calc -- Use AVG for direct DB calculation
      FROM customers c
      WHERE c.tenant_id = ?
        AND (c.outstanding_credit IS NOT NULL AND c.outstanding_credit != 0 OR c.credit_limit IS NOT NULL); -- Consider accounts with balance or limit
    `;
    const [aggResult] = await pool.query(aggSql, queryParams);
    const aggregates = aggResult[0] || {
      total_accounts: 0,
      total_outstanding_balance: 0,
      total_credit_limit: 0,
      average_balance_per_account_calc: 0
    };

    // Query 2: Accounts Over Limit
    const overLimitSql = `
      SELECT COUNT(c.id) AS accounts_over_limit
      FROM customers c
      WHERE c.tenant_id = ?
        AND c.credit_limit IS NOT NULL
        AND IFNULL(c.outstanding_credit, 0) > c.credit_limit;
    `;
    const [overLimitResult] = await pool.query(overLimitSql, queryParams);
    const accountsOverLimit = overLimitResult[0]?.accounts_over_limit || 0;
    
    const totalOutstanding = parseFloat(aggregates.total_outstanding_balance) || 0;
    const totalCredit = parseFloat(aggregates.total_credit_limit) || 0;
    const utilizationRate = totalCredit > 0 ? (totalOutstanding / totalCredit) : 0;

    const summaryData = {
      total_accounts: parseInt(aggregates.total_accounts, 10) || 0,
      total_outstanding_balance: totalOutstanding,
      total_credit_limit: totalCredit,
      average_balance_per_account: parseFloat(aggregates.average_balance_per_account_calc) || 0,
      accounts_over_limit: parseInt(accountsOverLimit, 10) || 0,
      utilization_rate: parseFloat(utilizationRate.toFixed(4)) // Store as a decimal, e.g., 0.25 for 25%
    };

    res.status(200).json({
      status: 'success',
      data: summaryData
    });
  } catch (error) {
    console.error('Error in getChargeAccountSummaryMetrics:', error);
    next(error);
  }
};
  // GET /api/reports/sales/transactions
exports.getSalesTransactions = async (req, res, next) => {
  try {
    let { startDate, endDate, storeId } = req.query;
    const tenant_id = req.headers["x-tenant-id"] || req.user?.tenant_id || req.query?.tenant_id || null;
      // Debug log the tenant_id extraction
      debugLog('Using tenant_id:', tenant_id);

    if (!tenant_id) {
      return res.status(403).json({ status: 'error', message: 'Tenant ID is missing.' });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ status: 'error', message: 'Start and end dates are required.' });
    }

    // Adjust dates to include full day range
    const adjustedEndDate = endDate;
    const adjustedStartDate = startDate;
    
    const queryParams = [tenant_id, adjustedStartDate, adjustedEndDate];

    let sql = `
      SELECT 
        s.id,
        s.created_at AS transaction_date,
        CONCAT(IFNULL(c.first_name, ''), ' ', IFNULL(c.last_name, '')) AS customer_name,
        (
          SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id
        ) AS total_items,
        s.subtotal AS subtotal_amount,
        s.discount_amount,
        s.tax AS tax_amount,
        s.total AS total_amount,
        s.payment_method,
        pm.name AS payment_method_name,
        s.status,
        u.name AS cashier_name,
        st.name AS store_name
      FROM 
        sales s
        LEFT JOIN customers c ON s.customer_id = c.id COLLATE utf8mb4_unicode_ci
        LEFT JOIN users u ON s.cashier_id = u.id COLLATE utf8mb4_unicode_ci
        LEFT JOIN stores st ON s.store_id = st.id COLLATE utf8mb4_unicode_ci
        LEFT JOIN payment_methods pm ON s.payment_method = pm.id COLLATE utf8mb4_unicode_ci
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
      customerName: row.customer_name.trim() || 'Guest',
      totalItems: row.total_items || 0,
      subtotalAmount: parseFloat(row.subtotal_amount) || 0,
      discountAmount: parseFloat(row.discount_amount) || 0,
      taxAmount: parseFloat(row.tax_amount) || 0,
      totalAmount: parseFloat(row.total_amount) || 0, 
      paymentMethod: row.payment_method_name || row.payment_method || 'Cash', // Use payment method name, fallback to raw payment method, then Cash
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
    const tenant_id = req.headers["x-tenant-id"] || req.user?.tenant_id || req.query?.tenant_id || null;
      // Debug log the tenant_id extraction
      debugLog('Using tenant_id:', tenant_id);

    if (!tenant_id) {
      return res.status(403).json({ status: 'error', message: 'Tenant ID is missing.' });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ status: 'error', message: 'Start and end dates are required.' });
    }

    // Adjust dates
    const adjustedEndDate = endDate;
    const adjustedStartDate = startDate;
    
    // Removed excessive debug log for chart data fetching
    
    const sql = `
      WITH RECURSIVE date_range AS (
        SELECT DATE(?) AS date
        UNION ALL
        SELECT DATE_ADD(date, INTERVAL 1 DAY)
        FROM date_range
        WHERE date < DATE(?)
      )
      SELECT 
        dr.date,
        COALESCE(SUM(s.total), 0) AS total_sales,
        COALESCE(COUNT(s.id), 0) AS transactions
      FROM 
        date_range dr
        LEFT JOIN sales s ON DATE(s.created_at) = dr.date COLLATE utf8mb4_unicode_ci
          AND s.tenant_id = ? COLLATE utf8mb4_unicode_ci
          AND s.status = 'completed' 
          ${storeId ? 'AND s.store_id = ? COLLATE utf8mb4_unicode_ci' : ''}
      GROUP BY 
        dr.date
      ORDER BY 
        dr.date ASC
      LIMIT 366
    `;

    // Adjust params for the recursive CTE query
    const cteQueryParams = [
      adjustedStartDate, 
      adjustedEndDate, 
      tenant_id
    ];
    
    if (storeId) {
      cteQueryParams.push(storeId);
    }

    const [rows] = await pool.query(sql, cteQueryParams);

    // Removed excessive debug log for row count
    
    // Format data for frontend chart
    const formattedData = rows.map(row => {
      const result = {
        date: row.date.toISOString().split('T')[0], // Format as YYYY-MM-DD
        totalSales: parseFloat(row.total_sales) || 0,
        transactions: parseInt(row.transactions) || 0
      };
      return result;
    });

    // Removed excessive debug log for formatted data sample

    res.status(200).json({
      status: 'success',
      data: formattedData
    });
  } catch (error) {
    console.error('Error in getSalesChartData:', error);
    next(error);
  }
};

// GET /api/reports/sales/categories
exports.getSalesCategorySummary = async (req, res, next) => {
  try {
    let { startDate, endDate, storeId } = req.query;
    const tenant_id = req.headers["x-tenant-id"] || req.user?.tenant_id || req.query?.tenant_id || null;
    
    debugLog('Using tenant_id:', tenant_id);

    if (!tenant_id) {
      return res.status(403).json({ status: 'error', message: 'Tenant ID is missing.' });
    }

    // If no date range provided, use last 30 days
    if (!startDate || !endDate) {
      const now = new Date();
      endDate = now.toISOString().split('T')[0];
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      startDate = thirtyDaysAgo.toISOString().split('T')[0];
    }

    // Adjust dates
    const adjustedEndDate = endDate;
    const adjustedStartDate = startDate;
    
    debugLog('Fetching sales categories data for tenant:', tenant_id, 'from', adjustedStartDate, 'to', adjustedEndDate);
    
    const sql = `
      SELECT 
        COALESCE(c.name, 'Uncategorized') AS category_name,
        COUNT(si.id) AS items_sold,
        SUM(si.quantity) AS total_quantity,
        SUM(
          (si.price * si.quantity) + 
          (
            (si.price * si.quantity) / s.subtotal * COALESCE(s.tax, 0)
          )
        ) AS total_revenue,
        AVG(si.price) AS avg_item_value
      FROM 
        sales s
        JOIN sale_items si ON s.id = si.sale_id
        LEFT JOIN products p ON si.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
      WHERE 
        s.tenant_id = ? COLLATE utf8mb4_unicode_ci
        AND s.status = 'completed'
        AND s.created_at >= ?
        AND s.created_at <= ?
        ${storeId ? 'AND s.store_id = ? COLLATE utf8mb4_unicode_ci' : ''}
      GROUP BY 
        c.id, c.name
      ORDER BY 
        total_revenue DESC
    `;
    
    const params = storeId 
      ? [tenant_id, adjustedStartDate, adjustedEndDate, storeId]
      : [tenant_id, adjustedStartDate, adjustedEndDate];
    
    const [results] = await pool.execute(sql, params);
    
    // Format the results
    const formattedData = results.map(row => ({
      categoryName: row.category_name,
      itemsSold: parseInt(row.items_sold),
      totalQuantity: parseInt(row.total_quantity),
      totalRevenue: parseFloat(row.total_revenue || 0),
      avgItemValue: parseFloat(row.avg_item_value || 0)
    }));
    
    debugLog('Sales categories data fetched successfully:', formattedData.length, 'categories');
    
    res.json({
      status: 'success',
      data: formattedData
    });
  } catch (error) {
    console.error('Error in getSalesCategorySummary:', error);
    // Return empty data instead of error to prevent dashboard crashes
    res.json({
      status: 'success',
      data: []
    });
  }
};

// GET /api/reports/inventory/items
exports.getInventoryReportItems = async (req, res, next) => {
  try {
    const tenant_id = req.headers["x-tenant-id"] || req.user?.tenant_id || req.query?.tenant_id || null;
      // Debug log the tenant_id extraction
      debugLog('Using tenant_id:', tenant_id);
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

    // Disabling supplier filter since products don't have direct supplier_id column
    if (supplierId) {
      // Filter removed as products table doesn't have supplier_id column
      console.log('Warning: Supplier filtering requested but not supported in the current schema');
    }

    // lowStock/outOfStock used to be raw SQL predicates against
    // p.stock_quantity, which is always 0 for a shared product (its real
    // stock lives per-store in store_product_listings). They're now applied
    // in JS below, against each row's resolved effective stock, after the
    // query runs. See docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §3.

    // A store's inventory report is its own products PLUS every tenant-wide
    // shared product, resolved through that store's own listing — same
    // convention as the product list/inventory endpoints. Without a store
    // filter (tenant-wide view), a shared product's stock is summed across
    // every store's listing and its cost uses the base product's cost_price
    // (there is no single per-store cost to show in an all-stores view).
    let storeFilter = '';
    let listingJoin = '';
    if (storeId) {
      storeFilter = ' AND (p.store_id = ? OR p.store_id IS NULL) ';
      queryParams.push(storeId);
      listingJoin = 'LEFT JOIN store_product_listings spl ON spl.product_id = p.id AND spl.tenant_id = p.tenant_id AND spl.store_id = ?';
    } else {
      listingJoin = `LEFT JOIN (
        SELECT product_id, SUM(stock_quantity) AS stock_quantity
        FROM store_product_listings
        WHERE tenant_id = ?
        GROUP BY product_id
      ) spl ON spl.product_id = p.id`;
    }

    // Query to get inventory items with related data
    const sql = `
      SELECT
        p.id AS product_id,
        p.store_id,
        p.name AS product_name,
        p.sku,
        c.name AS category_name,
        'N/A' AS supplier_name, -- Hardcoded since products don't have a direct supplier relationship
        p.stock_quantity AS product_stock_quantity,
        spl.stock_quantity AS listing_stock_quantity,
        ${storeId ? 'spl.weighted_average_cost AS listing_weighted_average_cost,' : ''}
        p.cost_price,
        p.low_stock_threshold AS reorder_level,
        p.attributes,
        (
          SELECT MAX(si.created_at)
          FROM sale_items si
          JOIN sales sa ON si.sale_id = sa.id
          WHERE si.product_id = p.id AND sa.tenant_id = p.tenant_id AND sa.status = 'completed'
        ) AS last_sold_date,
        p.last_received_date
      FROM
        products p
        LEFT JOIN categories c ON p.category_id = c.id
        ${listingJoin}
        -- Removing incorrect supplier join as there's no direct supplier_id column in products table
      WHERE
        p.tenant_id = ?
        AND p.is_active = 1
        ${storeFilter}
        ${additionalFilters}
      ORDER BY
        p.name ASC
    `;
    // listingJoin's own `?` (tenant_id or storeId) goes right before the
    // join clause is used, i.e. before the rest of queryParams (which
    // already starts with tenant_id, then optional category/store filters).
    const finalParams = storeId
      ? [storeId, ...queryParams]
      : [tenant_id, ...queryParams];

    const [rows] = await pool.query(sql, finalParams);

    // Resolve effective stock/cost per row, then apply the lowStock/
    // outOfStock filters against those resolved values.
    let formattedData = rows.map(row => {
      const isSharedRow = row.store_id === null;
      const currentStock = isSharedRow
        ? (parseInt(row.listing_stock_quantity) || 0)
        : (parseInt(row.product_stock_quantity) || 0);
      const costPrice = (isSharedRow && storeId && row.listing_weighted_average_cost != null)
        ? parseFloat(row.listing_weighted_average_cost)
        : (parseFloat(row.cost_price) || 0);
      const reorderLevel = parseInt(row.reorder_level) || 0;
      return {
        productId: row.product_id,
        productName: row.product_name,
        sku: row.sku,
        categoryName: row.category_name || 'Uncategorized',
        supplierName: 'N/A', // No direct supplier relationship in products table
        isSharedProduct: isSharedRow,
        currentStock,
        costPrice,
        stockValue: currentStock * costPrice,
        reorderLevel,
        lastSoldDate: row.last_sold_date ? new Date(row.last_sold_date).toISOString() : null,
        lastReceivedDate: row.last_received_date ? new Date(row.last_received_date).toISOString() : null,
        attributes: (() => {
          try { return row.attributes ? JSON.parse(row.attributes) : null; } catch { return null; }
        })(),
      };
    });

    if (lowStock === 'true') {
      formattedData = formattedData.filter(item => item.currentStock > 0 && item.currentStock <= item.reorderLevel);
    }
    if (outOfStock === 'true') {
      formattedData = formattedData.filter(item => item.currentStock === 0);
    }

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
    const tenant_id = req.headers["x-tenant-id"] || req.user?.tenant_id || req.query?.tenant_id || null;
      // Debug log the tenant_id extraction
      debugLog('Using tenant_id:', tenant_id);
    const { storeId } = req.query;

    if (!tenant_id) {
      return res.status(403).json({ status: 'error', message: 'Tenant ID is missing.' });
    }

    // A shared product's real stock lives per-store in
    // store_product_listings, not products.stock_quantity (always 0 once
    // listings exist) — the previous SQL-only aggregation read that column
    // directly and undercounted every shared product. Resolved here by
    // pulling each product's own columns plus its listing (specific store,
    // or summed across stores for a tenant-wide view) and aggregating in JS
    // instead. See docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §3.
    let storeFilter = '';
    let listingJoin = '';
    const rowsParams = [];
    if (storeId) {
      storeFilter = ' AND (p.store_id = ? OR p.store_id IS NULL) ';
      listingJoin = 'LEFT JOIN store_product_listings spl ON spl.product_id = p.id AND spl.tenant_id = p.tenant_id AND spl.store_id = ?';
      rowsParams.push(storeId);
    } else {
      listingJoin = `LEFT JOIN (
        SELECT product_id, SUM(stock_quantity) AS stock_quantity
        FROM store_product_listings
        WHERE tenant_id = ?
        GROUP BY product_id
      ) spl ON spl.product_id = p.id`;
      rowsParams.push(tenant_id);
    }
    rowsParams.push(tenant_id);
    if (storeId) rowsParams.push(storeId);

    const rowsQuery = `
      SELECT
        p.id, p.store_id, p.stock_quantity AS product_stock_quantity,
        spl.stock_quantity AS listing_stock_quantity,
        p.cost_price, p.low_stock_threshold
      FROM products p
      ${listingJoin}
      WHERE p.tenant_id = ? AND p.is_active = 1 ${storeFilter}
    `;

    const [rows] = await pool.query(rowsQuery, rowsParams);

    let totalItemsInStock = 0;
    let totalStockValue = 0;
    let lowStockItemsCount = 0;
    let outOfStockItemsCount = 0;

    for (const row of rows) {
      const isSharedRow = row.store_id === null;
      const currentStock = isSharedRow
        ? (parseInt(row.listing_stock_quantity) || 0)
        : (parseInt(row.product_stock_quantity) || 0);
      const costPrice = parseFloat(row.cost_price) || 0;
      const reorderLevel = parseInt(row.low_stock_threshold) || 0;

      if (currentStock > 0) {
        totalItemsInStock += 1;
        totalStockValue += currentStock * costPrice;
        if (currentStock <= reorderLevel) lowStockItemsCount += 1;
      } else {
        outOfStockItemsCount += 1;
      }
    }

    const result = {
      totalUniqueItems: rows.length,
      totalItemsInStock,
      totalStockValue,
      lowStockItemsCount,
      outOfStockItemsCount
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
/**
 * Get payment report items
 * @route GET /api/reports/payments/items
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 * @returns {object} Payment report data
 */
exports.getPaymentReportItems = async (req, res, next) => {
  try {
    const tenantId = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"];
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
        pm.name AS payment_method_name,
        s.total AS amount,
        s.status,
        u.name AS processed_by
      FROM 
        sales s
        LEFT JOIN customers c ON s.customer_id = c.id COLLATE utf8mb4_unicode_ci
        LEFT JOIN users u ON s.cashier_id = u.id COLLATE utf8mb4_unicode_ci
        LEFT JOIN payment_methods pm ON s.payment_method = pm.id COLLATE utf8mb4_unicode_ci
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
      paymentMethod: row.payment_method_name || 'Cash',
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
exports.getPaymentSummaryMetrics = async (req, res, next) => {
  try {
    const tenantId = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"];
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
        SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END) AS total_revenue,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) AS total_transactions,
        SUM(CASE WHEN status = 'refunded' THEN total ELSE 0 END) AS total_refunds
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
        CASE 
          WHEN s.payment_method COLLATE utf8mb4_unicode_ci = '00000000-0000-0000-0000-000000000000' THEN 'No Payment Required'
          ELSE pm.name 
        END AS payment_method_name,
        COUNT(*) AS count,
        SUM(s.total) AS total_amount
      FROM 
        sales s
      LEFT JOIN 
        payment_methods pm ON s.payment_method COLLATE utf8mb4_unicode_ci = pm.id
      WHERE 
        s.tenant_id = ?
        AND s.status = 'completed'
        AND s.created_at BETWEEN ? AND ?
        ${storeFilter} /* Ensure storeFilter correctly refers to s.store_id if applicable */
      GROUP BY
        payment_method_name
      ORDER BY
        payment_method_name
    `;
    
    const [totalMetricsRows] = await pool.query(totalMetricsQuery, queryParams);
    const [paymentMethodsRows] = await pool.query(paymentMethodsQuery, queryParams);
    
    const totalRevenue = parseFloat(totalMetricsRows[0]?.total_revenue || 0);
    const totalTransactions = parseInt(totalMetricsRows[0]?.total_transactions || 0);
    const totalRefunds = parseFloat(totalMetricsRows[0]?.total_refunds || 0);
    const netRevenue = totalRevenue - totalRefunds;
    
    const paymentsByMethod = paymentMethodsRows.map(row => ({
      method: row.payment_method_name, // Use the alias from the updated query
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
