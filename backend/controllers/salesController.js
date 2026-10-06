const { pool } = require('../db');
const errorHandler = require('../middleware/error');

// Set to true to enable debug logs for sales controller
const DEBUG_SALES = process.env.DEBUG_SALES === 'true' || false;

// Conditional debug logging helper
const debugLog = (...args) => {
  if (DEBUG_SALES) {
    console.log('[SALES]', ...args);
  }
};

/**
 * Search completed sales by document/receipt number, or customer name,
 * email, or phone — used by the Sales Return flow's "find the original
 * sale" step. That step used to require pasting the raw internal sale UUID,
 * which nobody at a register actually has; this is the lookup that makes
 * "search by name/email/phone" possible instead.
 * @route GET /api/sales/search?q=...
 * @access Private
 */
exports.searchSales = async (req, res, next) => {
  try {
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'] || null;
    const q = (req.query.q || '').trim();

    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized: Tenant ID is missing.' });
    }
    if (!q) {
      return res.json({ status: 'success', data: [] });
    }

    const term = `%${q}%`;
    const [rows] = await pool.query(
      `SELECT
         s.id,
         s.document_number,
         s.total,
         s.created_at,
         s.customer_id,
         TRIM(CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, ''))) AS customer_name,
         c.email AS customer_email,
         c.phone_number AS customer_phone
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.id
       WHERE s.tenant_id = ?
         AND s.status = 'completed'
         AND (
           s.document_number LIKE ?
           OR CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) LIKE ?
           OR c.email LIKE ?
           OR c.phone_number LIKE ?
         )
       ORDER BY s.created_at DESC
       LIMIT 15`,
      [tenantId, term, term, term, term]
    );

    return res.json({ status: 'success', data: rows });
  } catch (error) {
    console.error('Error searching sales:', error);
    return next(error);
  }
};

/**
 * Get a specific sale by ID
 * @route GET /api/sales/:id
 * @access Private
 */
exports.getSaleById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;
    
    // Handle special routes like 'chart' to avoid conflicts with sale IDs.
    // TODO: Refactor this into a dedicated /api/sales/chart route and controller.
    if (id === 'chart') {
      try {
        const tenantId = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;
        const storeId = req.user?.store_id || req.query?.store_id || req.headers["x-store-id"] || null;
        if (!tenantId || !storeId) {
          return res.status(401).json({ message: 'Unauthorized: Tenant ID or Store ID is missing.' });
        }
        
        const query = `
          SELECT
            DATE(created_at) AS date,
            SUM(total) AS totalSales
          FROM sales
          WHERE tenant_id = ? AND store_id = ? AND created_at >= CURDATE() - INTERVAL 30 DAY
          GROUP BY DATE(created_at)
          ORDER BY DATE(created_at) ASC;
        `;
        
        const [rows] = await pool.query(query, [tenantId, storeId]);
        
        return res.status(200).json({
          status: 'success',
          data: rows,
        });
      } catch (error) {
        console.error('Error fetching sales chart data:', error);
        return next(error);
      }
    }

    if (id === 'summary') {
        const tenant_id = req.headers["x-tenant-id"] || req.user?.tenant_id || req.query?.tenant_id || null;
        const store_id = req.headers["x-store-id"] || req.user?.store_id || req.query?.store_id || null;
        
        debugLog('/api/sales/summary - Using tenant_id:', tenant_id, 'store_id:', store_id);

        if (!tenant_id || !store_id) {
            return res.status(401).json({ message: 'Unauthorized: Tenant ID or Store ID is missing for summary.' });
        }

        const summaryQuery = `
            SELECT
                COUNT(CASE WHEN YEAR(created_at) = YEAR(CURDATE()) THEN id ELSE NULL END) AS totalSalesThisYear,
                SUM(CASE WHEN YEAR(created_at) = YEAR(CURDATE()) THEN total ELSE 0 END) AS totalRevenueThisYear,
                SUM(CASE WHEN YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) THEN total ELSE 0 END) AS totalRevenueThisMonth,
                (SELECT SUM(quantity) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.tenant_id = ? AND s.store_id = ?) AS totalItemsSoldAllTime
            FROM sales
            WHERE tenant_id = ? AND store_id = ?;
        `;

        const [rows] = await pool.query(summaryQuery, [tenant_id, store_id, tenant_id, store_id]);
        const summary = rows[0];

        const averageOrderValue = summary.totalSalesThisYear > 0 ? summary.totalRevenueThisYear / summary.totalSalesThisYear : 0;

        return res.json({
            totalSales: parseInt(summary.totalSalesThisYear, 10) || 0,
            totalItems: parseInt(summary.totalItemsSoldAllTime, 10) || 0,
            totalRevenue: parseFloat(summary.totalRevenueThisYear) || 0,
            totalRevenueThisMonth: parseFloat(summary.totalRevenueThisMonth) || 0,
            averageOrderValue: parseFloat(averageOrderValue.toFixed(2)) || 0
        });

    }
    
    debugLog(`Fetching sale with ID: ${id}`);
    
    // Explicitly use SQL_MODE to allow different collations for this query
    await pool.query("SET SESSION sql_mode='';");
    
    // Use a simpler query with explicit collation and avoid complex joins
    const query = `
      SELECT s.*
      FROM sales s WHERE s.id = ?`;
      
    const [saleData] = await pool.query(query, [id]);
    
    if (saleData.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Sale not found'
      });
    }
    
    // Get additional data separately
    let cashierName = null;
    let customerName = null;
    let paymentMethodName = null;
    
    if (saleData[0].cashier_id) {
      const [cashierResult] = await pool.query(
        'SELECT name FROM users WHERE id = ?',
        [saleData[0].cashier_id]
      );
      if (cashierResult.length > 0) {
        cashierName = cashierResult[0].name;
      }
    }
    
    if (saleData[0].customer_id) {
      const [customerResult] = await pool.query(
        'SELECT first_name, last_name FROM customers WHERE id = ?',
        [saleData[0].customer_id]
      );
      if (customerResult.length > 0) {
        customerName = `${customerResult[0].first_name || ''} ${customerResult[0].last_name || ''}`.trim();
      }
    }
    
    if (saleData[0].payment_method) {
      const rawPaymentMethod = saleData[0].payment_method;
      // Recognized system codes (see CLAUDE.md's payment-method-ID
      // conventions) are already human-readable as-is. Anything else is an
      // opaque tenant-scoped payment_methods.id — never print that raw
      // UUID-shaped string on a customer-facing document if the name
      // lookup misses (wrong tenant scope, deleted row, demo data gap,
      // etc.); a printed invoice leaking an internal ID string reads as a
      // real bug to a customer even though checkout itself succeeded.
      const SYSTEM_CODE_LABELS = {
        cash: 'Cash', card: 'Card', phone: 'Phone', on_account: 'On Account',
        none: 'None', stripe: 'Card', paypal: 'PayPal',
      };
      if (SYSTEM_CODE_LABELS[rawPaymentMethod]) {
        paymentMethodName = SYSTEM_CODE_LABELS[rawPaymentMethod];
      } else {
        try {
          const [paymentResult] = await pool.query(
            'SELECT name FROM payment_methods WHERE id = ? AND tenant_id = ?',
            [rawPaymentMethod, req.user.tenant_id]
          );
          paymentMethodName = paymentResult[0]?.name || 'Payment';
        } catch (error) {
          console.error('Error fetching payment method:', error);
          paymentMethodName = 'Payment';
        }
      }
    }
    
    // Create a local_date field that's more readable
    const utcDate = new Date(saleData[0].created_at);
    
    // Format the date to a common format (YYYY-MM-DD HH:MM:SS)
    const formatOptions = { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    };
    
    // Create formatted date string - this will use the server's timezone
    const local_date = utcDate.toLocaleString('en-US', formatOptions);
    
    // Combine the data
    const sales = [{
      ...saleData[0],
      cashier_name: cashierName,
      customer_name: customerName,
      payment_method_name: paymentMethodName || 'Cash', // Ensure we always have a payment method name
      local_date: local_date, // Add local date string
      payment_method_display: paymentMethodName || 'Cash', // Add a display-friendly payment method field
      
      // Ensure discount is properly sent to frontend
      discount: parseFloat(saleData[0].discount || 0),
      discount_amount: parseFloat(saleData[0].discount_amount || saleData[0].discount || 0)
    }];

    return res.json(sales[0]);
  } catch (error) {
    console.error('Error fetching sale by ID:', error);
    return next(error);
  }
};

/**
 * Get category sales summary
 * @route GET /api/sales/category-summary
 * @access Private
 */
exports.getCategorySalesSummary = async (req, res, next) => {
    const { tenant_id, store_id } = req.user;

    if (!tenant_id || !store_id) {
        return res.status(401).json({ message: 'Unauthorized: Tenant ID or Store ID is missing for category sales summary.' });
    }

    try {
        const query = `
            SELECT
                c.id AS categoryId,
                c.name AS categoryName,
                SUM(si.price * si.quantity) AS totalRevenue
            FROM sales s
            JOIN sale_items si ON s.id = si.sale_id
            JOIN products p ON si.product_id = p.id
            JOIN categories c ON p.category_id = c.id
            WHERE
                s.tenant_id = ? AND
                s.store_id = ? AND
                YEAR(s.created_at) = YEAR(CURDATE()) AND
                MONTH(s.created_at) = MONTH(CURDATE())
            GROUP BY c.id, c.name
            ORDER BY totalRevenue DESC;
        `;

        const [rows] = await pool.query(query, [tenant_id, store_id]);
        
        // Ensure that totalRevenue is always a number, defaulting to 0
        res.json(rows.map(row => ({
            categoryId: row.categoryId,
            categoryName: row.categoryName,
            totalRevenue: parseFloat(row.totalRevenue) || 0 
        })));

    } catch (error) {
        console.error('Error fetching category sales summary:', error);
        next(error);
    }
};

/**
 * Get items for a specific sale
 * @route GET /api/sales/:id/items
 * @access Private
 */
exports.getSaleItems = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id;

    // Set SQL mode to avoid collation issues
    await pool.query("SET SESSION sql_mode='';");

    // First verify the sale exists
    const [salesCheck] = await pool.query(
      'SELECT id FROM sales WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (salesCheck.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Sale not found'
      });
    }

    // Get the items with product info using a simpler query to avoid collation issues
    const [items] = await pool.query(
      `SELECT
        si.id,
        si.sale_id,
        si.product_id,
        si.quantity,
        si.price,
        si.purity,
        si.gross_weight AS grossWeight,
        si.net_weight AS netWeight,
        si.making_charge AS makingCharge,
        si.wastage_value AS wastageValue,
        si.metal_value AS metalValue,
        si.hsn_code AS hsnCode,
        si.pricing_snapshot AS pricingSnapshot,
        p.name AS productName,
        p.sku,
        p.description,
        p.attributes,
        (si.price * si.quantity) AS total
      FROM
        sale_items si
        JOIN products p ON BINARY si.product_id = BINARY p.id
      WHERE
        si.sale_id = ?`,
      [id]
    );
    
    // Post-process to add tax and discount info based on cart logic
    // Frontend will handle tax calculations based on the total
    const processedItems = items.map(item => ({
      ...item,
      attributes: (() => {
        try { return item.attributes ? JSON.parse(item.attributes) : null; } catch { return null; }
      })(),
      tax_amount: 0,            // Let frontend calculate based on item total
      discount_amount: 0        // Let frontend handle discounts
    }));

    return res.json(processedItems);
  } catch (error) {
    console.error('Error fetching sale items:', error);
    return next(error);
  }
};
