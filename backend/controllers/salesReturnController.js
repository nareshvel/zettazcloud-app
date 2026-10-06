const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { generateReturnNumber } = require('../utils/appHelper');

/**
 * @desc    Get all returnable items for a given sale
 * @route   GET /api/sales/:saleId/returnable-items
 * @access  Private
 */
exports.getReturnableItems = async (req, res, next) => {
  const { saleId } = req.params;
  const tenantId = req.user.tenant_id;

  try {
    const connection = await pool.getConnection();
    
    // Get sale with customer info
    const [sales] = await connection.query(
      `SELECT s.*, CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) as customer_name, c.email as customer_email 
       FROM sales s 
       LEFT JOIN customers c ON s.customer_id = c.id 
       WHERE s.id = ? AND s.tenant_id = ?`,
      [saleId, tenantId]
    );

    if (sales.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Sale not found' });
    }

    const sale = sales[0];

    // Get sale items with category and already-returned quantities
    const [saleItems] = await connection.query(
      `SELECT 
          si.id,
          si.product_id,
          p.name as product_name,
          p.sku as product_sku,
          p.description as product_description,
          c.name as category_name,
          si.quantity as original_quantity,
          si.price as unit_price,
          (si.price * si.quantity) as total_price,
          COALESCE(rt.total_returned, 0) as total_returned
       FROM sale_items si
       JOIN products p ON si.product_id = p.id
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN (
         SELECT sri.original_sale_item_id, SUM(sri.quantity_returned) as total_returned
         FROM sales_return_items sri
         JOIN sales_returns sr ON sr.id = sri.sales_return_id AND sr.status != 'cancelled'
         WHERE sr.original_sale_id = ?
         GROUP BY sri.original_sale_item_id
       ) rt ON rt.original_sale_item_id = si.id
       WHERE si.sale_id = ?`,
      [saleId, saleId]
    );

    connection.release();

    // Create returnable items with proper calculations
    const returnableItems = saleItems.map(item => {
      const unitPrice = parseFloat(item.unit_price);
      const totalPrice = parseFloat(item.total_price);
      
      // Calculate per-unit tax and discount (prorated from sale totals)
      const taxPerUnit = sale.tax > 0 && sale.subtotal > 0 ? 
        (unitPrice / parseFloat(sale.subtotal)) * parseFloat(sale.tax) : 0;
      const discountPerUnit = (sale.discount_amount || sale.discount) > 0 && sale.subtotal > 0 ? 
        (unitPrice / parseFloat(sale.subtotal)) * parseFloat(sale.discount_amount || sale.discount || 0) : 0;
      const finalPricePerUnit = unitPrice - discountPerUnit + taxPerUnit;
      
      const totalReturned = parseInt(item.total_returned || 0);
      const originalQty = parseInt(item.original_quantity || 0);
      const returnableQty = Math.max(originalQty - totalReturned, 0);

      return {
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        product_description: item.product_description,
        category_name: item.category_name || 'Uncategorized',
        original_quantity: originalQty,
        unit_price: unitPrice,
        total_price: totalPrice,
        returnable_quantity: returnableQty,
        total_returned: totalReturned,
        tax_per_unit: taxPerUnit,
        discount_per_unit: discountPerUnit,
        final_price_per_unit: finalPricePerUnit
      };
    });

    // Create saleInfo with explicit values
    const saleInfo = {
      id: sale.id,
      subtotal: parseFloat(sale.subtotal),
      tax_amount: parseFloat(sale.tax),
      discount_amount: parseFloat(sale.discount_amount || sale.discount || 0),
      total_amount: parseFloat(sale.total),
      sale_date: sale.created_at,
      customer_name: (sale.customer_name || '').trim() || 'Walk-in Customer',
      customer_email: sale.customer_email || ''
    };

    const response = {
      data: returnableItems,
      saleInfo: saleInfo
    };

    logger.debug('Returnable items API response:', returnableItems.length, 'items for sale', saleId);
    
    res.status(200).json(response);
  } catch (error) {
    console.error('Error getting returnable items:', error);
    next(error);
  }
};

/**
 * @desc    Create a new sales return
 * @route   POST /api/sales-returns
 * @access  Private
 */
exports.createReturn = async (req, res, next) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const { 
      original_sale_id, customer_id, return_reason, 
      return_reason_notes, refund_method, items
    } = req.body;
    const { tenant_id: tenantId, store_id: storeId, id: userId } = req.user;

    if (!tenantId || !storeId) {
      await connection.rollback();
      connection.release();
      return res.status(401).json({ message: 'Unauthorized: Tenant ID or Store ID is missing.' });
    }

    if (!original_sale_id || !items || items.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Original sale ID and items are required' });
    }

    const [sales] = await connection.query('SELECT * FROM sales WHERE id = ? AND tenant_id = ?', [original_sale_id, tenantId]);
    if (sales.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: 'Original sale not found' });
    }
    const originalSale = sales[0];

    // Handle customer_id properly - use NULL if empty or undefined
    const finalCustomerId = customer_id || originalSale.customer_id || null;
    const customerIdForDB = finalCustomerId && finalCustomerId !== '' ? finalCustomerId : null;
    
    logger.debug(`Customer ID handling: customer_id=${customer_id}, originalSale.customer_id=${originalSale.customer_id}, finalCustomerId=${finalCustomerId}, customerIdForDB=${customerIdForDB}`);
    // Normalize enums to avoid DB enum constraint issues
    const normalizeReturnReason = (val) => {
      if (!val) return 'other';
      const v = String(val).toLowerCase();
      const map = {
        'defective': 'defective',
        'defective product': 'defective',
        'wrong item': 'wrong_item',
        'wrong item received': 'wrong_item',
        'customer changed mind': 'customer_change_mind',
        'customer change mind': 'customer_change_mind',
        'damaged': 'damaged',
        'damaged during shipping': 'damaged',
        'not as described': 'other',
        'other': 'other'
      };
      return map[v] || 'other';
    };
    const normalizeRefundMethod = (val) => {
      if (!val) return 'cash';
      const v = String(val).toLowerCase();
      const map = {
        'cash': 'cash',
        'card': 'card',
        'store credit': 'store_credit',
        'store_credit': 'store_credit',
        'exchange': 'exchange',
        'original payment method': 'cash' // fallback if UI label used
      };
      return map[v] || 'cash';
    };
    const normalizeCondition = (val) => {
      if (!val) return 'new';
      const v = String(val).toLowerCase();
      const map = {
        'new': 'new',
        'used': 'used',
        'damaged': 'damaged',
        'defective': 'defective'
      };
      return map[v] || 'new';
    };

    const normalizedReturnReason = normalizeReturnReason(return_reason);
    const normalizedRefundMethod = normalizeRefundMethod(refund_method);

    const returnNumber = await generateReturnNumber(tenantId, connection);
    const returnId = uuidv4();

    // Fetch remaining quantities per original sale item to prevent over-returns
    const [remainingRows] = await connection.query(
      `SELECT si.id as original_sale_item_id, si.quantity as original_quantity,
              COALESCE(rt.total_returned, 0) as total_returned,
              GREATEST(si.quantity - COALESCE(rt.total_returned, 0), 0) as remaining_quantity
       FROM sale_items si
       LEFT JOIN (
         SELECT sri.original_sale_item_id, SUM(sri.quantity_returned) as total_returned
         FROM sales_return_items sri
         JOIN sales_returns sr ON sr.id = sri.sales_return_id AND sr.status != 'cancelled'
         WHERE sr.original_sale_id = ?
         GROUP BY sri.original_sale_item_id
       ) rt ON rt.original_sale_item_id = si.id
       WHERE si.sale_id = ?`,
      [original_sale_id, original_sale_id]
    );
    const remainingMap = new Map(remainingRows.map(r => [String(r.original_sale_item_id), Number(r.remaining_quantity || 0)]));

    // Accumulators for header totals
    let subtotalAmount = 0;
    let discountAmount = 0;
    let taxAmount = 0;
    let totalReturnAmount = 0;
    for (const item of items) {
      // Handle both camelCase (from frontend) and snake_case field names
      const quantity = parseInt(item.quantity_returned) || 0;
      const originalSaleItemId = String(item.original_sale_item_id || '');
      const remaining = remainingMap.get(originalSaleItemId);
      if (remaining === undefined) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ message: `Invalid original_sale_item_id: ${originalSaleItemId}` });
      }
      if (quantity <= 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ message: 'quantity_returned must be greater than 0' });
      }
      if (quantity > remaining) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ message: `Quantity exceeds remaining for item ${originalSaleItemId}. Remaining: ${remaining}, Requested: ${quantity}` });
      }
      const baseUnitPrice = parseFloat(item.base_unit_price ?? item.baseUnitPrice ?? item.unit_price) || 0;
      const discountPerUnit = parseFloat(item.discount_per_unit ?? item.discountPerUnit ?? 0) || 0;
      const taxPerUnit = parseFloat(item.tax_per_unit ?? item.taxPerUnit ?? 0) || 0;
      const finalUnitPrice = parseFloat(
        item.final_unit_price ?? item.finalUnitPrice ?? item.unit_price
      ) || (baseUnitPrice - discountPerUnit + taxPerUnit) || 0;

      const lineSubtotal = baseUnitPrice * quantity;
      const lineDiscount = discountPerUnit * quantity;
      const lineTax = taxPerUnit * quantity;
      const lineTotal = finalUnitPrice * quantity;

      if (!isNaN(lineSubtotal)) subtotalAmount += lineSubtotal;
      if (!isNaN(lineDiscount)) discountAmount += lineDiscount;
      if (!isNaN(lineTax)) taxAmount += lineTax;
      if (!isNaN(lineTotal)) totalReturnAmount += lineTotal;

      logger.debug(
        `Item calc: qty=${quantity}, base=${baseUnitPrice}, disc=${discountPerUnit}, tax=${taxPerUnit}, final=${finalUnitPrice}, ` +
        `lineSubtotal=${lineSubtotal}, lineDiscount=${lineDiscount}, lineTax=${lineTax}, lineTotal=${lineTotal}`
      );
    }
    
    // Ensure totalReturnAmount is not NaN
    if (isNaN(totalReturnAmount)) {
      totalReturnAmount = 0;
    }

    // --- RBAC Phase 2d: per-role refund cap (opt-in via role_limits) ---
    if (totalReturnAmount > 0) {
      const limitService = require('../services/limitService');
      const check = await limitService.enforceLimit({
        req,
        userId,
        tenantId,
        storeId,
        limitType: 'refund_amount',
        attemptedValue: totalReturnAmount,
        context: { action: 'sales_return', original_sale_id },
      });
      if (!check.ok) {
        await connection.rollback();
        connection.release();
        return res.status(check.status).json(check.body);
      }
    }

    logger.debug(`Final totalReturnAmount: ${totalReturnAmount}`);

    await connection.query(`
      INSERT INTO sales_returns (
        id, return_number, original_sale_id, customer_id, tenant_id, store_id,
        return_date, return_reason, return_reason_notes, subtotal_amount, discount_amount, tax_amount, total_return_amount,
        refund_method, processed_by_user_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
    `, [
      returnId, returnNumber, original_sale_id, customerIdForDB, tenantId, storeId,
      normalizedReturnReason, return_reason_notes, subtotalAmount, discountAmount, taxAmount, totalReturnAmount, normalizedRefundMethod, userId
    ]);

    for (const item of items) {
      const quantityReturned = parseInt(item.quantity_returned) || 0;
      if (quantityReturned > 0) {
        const baseUnitPrice = parseFloat(item.base_unit_price ?? item.baseUnitPrice ?? item.unit_price) || 0;
        const discountPerUnit = parseFloat(item.discount_per_unit ?? item.discountPerUnit ?? 0) || 0;
        const taxPerUnit = parseFloat(item.tax_per_unit ?? item.taxPerUnit ?? 0) || 0;
        const finalUnitPrice = parseFloat(
          item.final_unit_price ?? item.finalUnitPrice ?? item.unit_price
        ) || (baseUnitPrice - discountPerUnit + taxPerUnit) || 0;
        const lineSubtotal = baseUnitPrice * quantityReturned;
        const lineDiscount = discountPerUnit * quantityReturned;
        const lineTax = taxPerUnit * quantityReturned;
        const lineTotal = finalUnitPrice * quantityReturned;

        logger.debug(`Inserting return item: productId=${item.product_id}, qty=${quantityReturned}, base=${baseUnitPrice}, disc=${discountPerUnit}, tax=${taxPerUnit}, final=${finalUnitPrice}`);

        await connection.query(`
          INSERT INTO sales_return_items (
            id, sales_return_id, original_sale_item_id, product_id,
            base_unit_price, discount_per_unit, tax_per_unit, final_unit_price,
            quantity_returned, line_subtotal, line_discount, line_tax, unit_price, total_amount,
            return_condition, restockable
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          uuidv4(), returnId, item.original_sale_item_id, item.product_id,
          baseUnitPrice, discountPerUnit, taxPerUnit, finalUnitPrice,
          quantityReturned, lineSubtotal, lineDiscount, lineTax, finalUnitPrice, lineTotal,
          normalizeCondition(item.return_condition), item.restockable !== false ? 1 : 0
        ]);

        // Check if item is restockable based on frontend data
        const isRestockable = item.restockable !== false;
        if (isRestockable) {
          const [productRows] = await connection.query(
            'SELECT store_id FROM products WHERE id = ? AND tenant_id = ?',
            [item.product_id, tenantId]
          );
          const isSharedProduct = productRows.length && productRows[0].store_id === null;
          if (isSharedProduct) {
            // Shared product — restock lands on this return's own store's
            // listing, not the products row. See
            // docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §3.
            await connection.query(
              `INSERT INTO store_product_listings (id, tenant_id, store_id, product_id, price, cost_price_override, stock_quantity, is_active)
               VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)
               ON DUPLICATE KEY UPDATE stock_quantity = stock_quantity + VALUES(stock_quantity)`,
              [uuidv4(), tenantId, storeId, item.product_id, quantityReturned]
            );
          } else {
            await connection.query('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [quantityReturned, item.product_id]);
          }

          await connection.query(`
            INSERT INTO inventory_logs (
              id, product_id, tenant_id, store_id, created_by, 
              reference_type, quantity_change, reason, reference_id, created_at
            ) VALUES (?, ?, ?, ?, ?, 'SALES_RETURN', ?, 'Sales Return', ?, NOW())
          `, [uuidv4(), item.product_id, tenantId, storeId, userId, quantityReturned, returnId]);
        }
      }
    }

    await connection.commit();
    connection.release();

    res.status(201).json({ 
      status: 'success',
      message: 'Sales return created successfully', 
      data: { id: returnId, return_number: returnNumber, subtotal_amount: subtotalAmount, discount_amount: discountAmount, tax_amount: taxAmount, total_return_amount: totalReturnAmount }
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
        logger.debug('Error creating sales return:', error);
    next(error);
  }
};

/**
 * @desc Get all sales returns with pagination, filtering, and searching
 * @route GET /api/sales-returns
 * @access Private
 */
exports.getAllReturns = async (req, res, next) => {
  const { tenant_id } = req.user;
  const { page = 1, limit = 10, status, sortBy = 'created_at', sortOrder = 'desc', search = '' } = req.query;

  try {
    logger.debug('getAllReturns - tenant_id:', tenant_id, 'query params:', req.query);
    const connection = await pool.getConnection();

    // LEFT JOIN customers so the list can display AND search on the actual
    // customer (sales_returns only stores customer_id, not a name/email/
    // phone snapshot — the earlier "sales table doesn't have customer_name"
    // comment was correct but the fix was a join, not dropping the search).
    let query = `FROM sales_returns sr
      LEFT JOIN sales s ON sr.original_sale_id = s.id
      LEFT JOIN customers cu ON sr.customer_id = cu.id
      WHERE sr.tenant_id = ?`;
    const params = [tenant_id];

    if (status) {
      query += ' AND sr.status = ?';
      params.push(status);
    }

    if (search) {
      query += ` AND (
        sr.return_number LIKE ?
        OR sr.return_reason_notes LIKE ?
        OR CONCAT(COALESCE(cu.first_name, ''), ' ', COALESCE(cu.last_name, '')) LIKE ?
        OR cu.email LIKE ?
        OR cu.phone_number LIKE ?
      )`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Get total count for pagination
    logger.debug('Count query:', `SELECT count(*) as total ${query}`, 'params:', params);
    const [[{ total }]] = await connection.query(`SELECT count(*) as total ${query}`, params);
    logger.debug('Total returns found:', total);

    // Get paginated data with correct column selection
    const offset = (page - 1) * limit;
    const dataQuery = `SELECT sr.*, s.id as original_sale_id,
        TRIM(CONCAT(COALESCE(cu.first_name, ''), ' ', COALESCE(cu.last_name, ''))) as customer_name,
        cu.email as customer_email,
        cu.phone_number as customer_phone
      ${query} ORDER BY sr.${sortBy} ${sortOrder} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    logger.debug('Data query:', dataQuery, 'params:', params);
    const [returns] = await connection.query(dataQuery, params);
    logger.debug('Returns data:', returns.length, 'records found');

    connection.release();

    const response = {
      status: 'success',
      data: returns,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    };
    
    logger.debug('Sending response with', returns.length, 'returns, total:', total);
    res.status(200).json(response);
  } catch (error) {
    logger.error('Error getting all sales returns:', error);
    next(error);
  }
};

/**
 * @desc Get a single sales return by ID
 * @route GET /api/sales-returns/:id
 * @access Private
 */
exports.getReturnById = async (req, res, next) => {
  const { id } = req.params;
  const { tenant_id } = req.user;

  try {
    const connection = await pool.getConnection();

    const [returns] = await connection.query('SELECT * FROM sales_returns WHERE id = ? AND tenant_id = ?', [id, tenant_id]);

    if (returns.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Sales return not found' });
    }

    const salesReturn = returns[0];

    const [items] = await connection.query(
      `SELECT sri.*, p.name as product_name, p.sku as product_sku 
       FROM sales_return_items sri 
       JOIN products p ON sri.product_id = p.id 
       WHERE sri.sales_return_id = ?`,
      [id]
    );

    salesReturn.items = items;

    /*
     * The original sale's issued number, for the return slip.
     *
     * A refund document has to point back at the sale it reverses — that is
     * what makes it auditable. Fetched separately rather than joined because
     * `sales_returns` and `sales` were on different collations until
     * 2026-08-25, and a stray join here is how "Illegal mix of collations"
     * used to surface at the worst moment. A single keyed lookup is also
     * cheaper than a join for one row.
     */
    if (salesReturn.original_sale_id) {
      const [orig] = await connection.query(
        'SELECT document_number FROM sales WHERE id = ? AND tenant_id = ? LIMIT 1',
        [salesReturn.original_sale_id, tenant_id],
      );
      salesReturn.original_document_number = orig.length ? orig[0].document_number : null;
    } else {
      salesReturn.original_document_number = null;
    }

    connection.release();

    res.status(200).json({
      status: 'success',
      data: salesReturn,
    });
  } catch (error) {
    logger.error(`Error getting sales return by ID ${id}:`, error);
    next(error);
  }
};

/**
 * @desc     Complete a sales return
 * @route    PATCH /api/sales-returns/:id/complete
 * @access   Private
 */
exports.completeReturn = async (req, res, next) => {
  const { id } = req.params;
  const { tenant_id } = req.user;

  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query(
      "UPDATE sales_returns SET status = 'completed', updated_at = NOW() WHERE id = ? AND tenant_id = ? AND status != 'completed'",
      [id, tenant_id]
    );
    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Sales return not found or already completed.' });
    }

    res.status(200).json({ status: 'success', message: 'Sales return marked as completed.' });
  } catch (error) {
    logger.error(`Error completing sales return ${id}:`, error);
    next(error);
  }
};

/**
 * @desc     Cancel a sales return
 * @route    PATCH /api/sales-returns/:id/cancel
 * @access   Private
 */
exports.cancelReturn = async (req, res, next) => {
  const { id } = req.params;
  const { tenant_id, store_id, id: userId } = req.user;
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [returns] = await connection.query('SELECT * FROM sales_returns WHERE id = ? AND tenant_id = ?', [id, tenant_id]);
    if (returns.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: 'Sales return not found.' });
    }

    const salesReturn = returns[0];
    if (salesReturn.status === 'cancelled') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Sales return is already cancelled.' });
    }
    
    // Revert stock changes only if the return was 'completed'
    if (salesReturn.status === 'completed') {
        const [items] = await connection.query('SELECT * FROM sales_return_items WHERE sales_return_id = ?', [id]);

        for (const item of items) {
            // Check if item was restockable based on sales_return_items data
            if (item.restockable) {
                const [productRows] = await connection.query(
                  'SELECT store_id FROM products WHERE id = ? AND tenant_id = ?',
                  [item.product_id, tenant_id]
                );
                const isSharedProduct = productRows.length && productRows[0].store_id === null;
                if (isSharedProduct) {
                  // Reverse the restock on the return's own store's listing —
                  // see docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §3.
                  await connection.query(
                    `UPDATE store_product_listings SET stock_quantity = stock_quantity - ?
                     WHERE tenant_id = ? AND store_id = ? AND product_id = ?`,
                    [item.quantity_returned, tenant_id, salesReturn.store_id, item.product_id]
                  );
                } else {
                  await connection.query('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?', [item.quantity_returned, item.product_id]);
                }

                await connection.query(`
                    INSERT INTO inventory_logs (id, product_id, tenant_id, store_id, created_by, reference_type, quantity_change, reason, reference_id, created_at)
                    VALUES (?, ?, ?, ?, ?, 'SALES_RETURN_CANCELLED', ?, 'Sales Return Cancelled', ?, NOW())
                `, [uuidv4(), item.product_id, tenant_id, store_id, userId, -item.quantity_returned, id]);
            }
        }
    }

    await connection.query("UPDATE sales_returns SET status = 'cancelled', updated_at = NOW() WHERE id = ?", [id]);

    await connection.commit();
    connection.release();

    res.status(200).json({ status: 'success', message: 'Sales return has been cancelled.' });

  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    logger.error(`Error cancelling sales return ${id}:`, error);
    next(error);
  }
};

/**
 * @desc     Get sales return statistics
 * @route    GET /api/sales-returns/stats
 * @access   Private
 */
exports.getReturnStats = async (req, res, next) => {
  const { tenant_id } = req.user;

  try {
    const connection = await pool.getConnection();

    const [stats] = await connection.query(
      `SELECT 
        COUNT(*) as total_returns,
        SUM(CASE WHEN status = 'completed' THEN total_return_amount ELSE 0 END) as total_refunded_amount,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_returns,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_returns,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_returns
      FROM sales_returns 
      WHERE tenant_id = ?`,
      [tenant_id]
    );

    connection.release();

    res.status(200).json({
      status: 'success',
      data: stats[0],
    });
  } catch (error) {
    logger.error('Error getting sales return stats:', error);
    next(error);
  }
};

module.exports = {
  getReturnableItems: exports.getReturnableItems,
  createReturn: exports.createReturn,
  getAllReturns: exports.getAllReturns,
  getReturnById: exports.getReturnById,
  completeReturn: exports.completeReturn,
  cancelReturn: exports.cancelReturn,
  getReturnStats: exports.getReturnStats,
};
