const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Order numbers follow the same "MAX + 1, zero-padded" pattern as
// generateReturnNumber in utils/appHelper.js (RTN-00001) — kept local here
// since it's the only caller and the prefix differs (SO- vs RTN-).
const generateOrderNumber = async (tenantId, connection) => {
  const db = connection || pool;
  const [maxNumRow] = await db.query(
    "SELECT MAX(CAST(SUBSTRING(order_number, 4) AS UNSIGNED)) as max_num FROM sales_orders WHERE tenant_id = ? AND order_number LIKE 'SO-%'",
    [tenantId]
  );
  let nextNum = 1;
  if (maxNumRow && maxNumRow.length > 0 && maxNumRow[0].max_num) {
    nextNum = parseInt(maxNumRow[0].max_num, 10) + 1;
  }
  return `SO-${String(nextNum).padStart(5, '0')}`;
};

/**
 * @desc    Get all sales orders with pagination/search/status filter
 * @route   GET /api/sales-orders
 * @access  Private
 */
exports.getAllOrders = async (req, res, next) => {
  const { tenant_id: tenantId } = req.user;
  const { page = 1, limit = 20, status, search = '' } = req.query;

  try {
    const connection = await pool.getConnection();

    let query = `FROM sales_orders so
      LEFT JOIN customers cu ON so.customer_id = cu.id
      WHERE so.tenant_id = ?`;
    const params = [tenantId];

    if (status) {
      query += ' AND so.status = ?';
      params.push(status);
    }

    if (search) {
      query += ` AND (
        so.order_number LIKE ?
        OR CONCAT(COALESCE(cu.first_name, ''), ' ', COALESCE(cu.last_name, '')) LIKE ?
        OR cu.email LIKE ?
        OR cu.phone_number LIKE ?
      )`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const [[{ total }]] = await connection.query(`SELECT COUNT(*) as total ${query}`, params);

    const offset = (page - 1) * limit;
    const dataQuery = `SELECT so.*,
        TRIM(CONCAT(COALESCE(cu.first_name, ''), ' ', COALESCE(cu.last_name, ''))) as customer_name,
        cu.email as customer_email,
        cu.phone_number as customer_phone
      ${query} ORDER BY so.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const [orders] = await connection.query(dataQuery, params);
    connection.release();

    res.status(200).json({
      status: 'success',
      data: orders,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error getting all sales orders:', error);
    next(error);
  }
};

/**
 * @desc    Get sales order status counts for KPI strip
 * @route   GET /api/sales-orders/stats
 * @access  Private
 */
exports.getOrderStats = async (req, res, next) => {
  const { tenant_id: tenantId } = req.user;
  try {
    const connection = await pool.getConnection();
    const [stats] = await connection.query(
      `SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_orders,
        SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) as shipped_orders,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_orders,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
      FROM sales_orders WHERE tenant_id = ?`,
      [tenantId]
    );
    connection.release();
    res.status(200).json({ status: 'success', data: stats[0] });
  } catch (error) {
    logger.error('Error getting sales order stats:', error);
    next(error);
  }
};

/**
 * @desc    Get a single sales order by id
 * @route   GET /api/sales-orders/:id
 * @access  Private
 */
exports.getOrderById = async (req, res, next) => {
  const { id } = req.params;
  const { tenant_id: tenantId } = req.user;
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT so.*,
          TRIM(CONCAT(COALESCE(cu.first_name, ''), ' ', COALESCE(cu.last_name, ''))) as customer_name,
          cu.email as customer_email,
          cu.phone_number as customer_phone
       FROM sales_orders so
       LEFT JOIN customers cu ON so.customer_id = cu.id
       WHERE so.id = ? AND so.tenant_id = ?`,
      [id, tenantId]
    );
    connection.release();
    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Sales order not found' });
    }
    res.status(200).json({ status: 'success', data: rows[0] });
  } catch (error) {
    logger.error('Error getting sales order:', error);
    next(error);
  }
};

/**
 * @desc    Create a new sales order
 * @route   POST /api/sales-orders
 * @access  Private
 */
exports.createOrder = async (req, res, next) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const { tenant_id: tenantId, store_id: storeId, id: userId } = req.user;
    if (!tenantId || !storeId) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ status: 'error', message: 'Missing tenant/store context' });
    }

    const {
      customer_id: customerId = null,
      items = [],
      subtotal = 0,
      tax = 0,
      total = 0,
      notes = null,
      status = 'pending',
    } = req.body;

    const orderNumber = await generateOrderNumber(tenantId, connection);
    const orderId = uuidv4();

    await connection.query(
      `INSERT INTO sales_orders
        (id, tenant_id, store_id, customer_id, order_number, status, items, subtotal, tax, total, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        tenantId,
        storeId,
        customerId,
        orderNumber,
        status,
        JSON.stringify(items || []),
        subtotal,
        tax,
        total,
        notes,
        userId || null,
      ]
    );

    await connection.commit();
    connection.release();

    res.status(201).json({
      status: 'success',
      data: { id: orderId, order_number: orderNumber, status, total },
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (_) {}
      connection.release();
    }
    logger.error('Error creating sales order:', error);
    next(error);
  }
};

/**
 * @desc    Update a sales order's status
 * @route   PATCH /api/sales-orders/:id/status
 * @access  Private
 */
exports.updateOrderStatus = async (req, res, next) => {
  const { id } = req.params;
  const { tenant_id: tenantId } = req.user;
  const { status } = req.body;

  const allowed = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ status: 'error', message: `status must be one of: ${allowed.join(', ')}` });
  }

  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query(
      'UPDATE sales_orders SET status = ? WHERE id = ? AND tenant_id = ?',
      [status, id, tenantId]
    );
    connection.release();
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Sales order not found' });
    }
    res.status(200).json({ status: 'success', data: { id, status } });
  } catch (error) {
    logger.error('Error updating sales order status:', error);
    next(error);
  }
};

module.exports = {
  getAllOrders: exports.getAllOrders,
  getOrderStats: exports.getOrderStats,
  getOrderById: exports.getOrderById,
  createOrder: exports.createOrder,
  updateOrderStatus: exports.updateOrderStatus,
};
