/**
 * CRM routes — wishlists + birthday/anniversary reminders
 * Base path: /api/crm   (mounted in routes/index.js)
 *
 *   GET  /reminders                    upcoming birthdays & anniversaries (next N days)
 *   GET  /customers/:id/wishlist       list wishlist items for a customer
 *   POST /customers/:id/wishlist       add a product to the wishlist
 *   DELETE /customers/:id/wishlist/:itemId  remove an item
 *
 *   GET  /customers/:id/profile-extra  get dob + anniversary_date for a customer
 *   PUT  /customers/:id/profile-extra  update dob + anniversary_date
 */

'use strict';

const express  = require('express');
const router   = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');
const { authenticate, requireTenantId } = require('../middleware/unifiedAuthMiddleware');

const tid = (req) => req.user?.tenant_id || req.headers['x-tenant-id'];

router.use(authenticate);
router.use(requireTenantId);

// ---------------------------------------------------------------------------
// GET /api/crm/reminders?days=7
// Returns customers with a birthday or anniversary within the next N days
// (matches on month + day, ignores year so it works year over year)
// ---------------------------------------------------------------------------
router.get('/reminders', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days || '7', 10), 30);

    // Build a list of (month, day) pairs for the upcoming window
    // We query via DAYOFYEAR with wrapping handled by the window expression
    const [rows] = await pool.execute(
      `SELECT
          c.id, c.first_name, c.last_name, c.phone_number, c.email,
          c.date_of_birth,
          c.anniversary_date,
          CASE
            WHEN c.date_of_birth IS NOT NULL
              AND DAYOFYEAR(DATE_FORMAT(c.date_of_birth, CONCAT(YEAR(CURDATE()), '-%m-%d')))
                BETWEEN DAYOFYEAR(CURDATE()) AND DAYOFYEAR(CURDATE()) + ?
            THEN 'birthday'
            WHEN c.anniversary_date IS NOT NULL
              AND DAYOFYEAR(DATE_FORMAT(c.anniversary_date, CONCAT(YEAR(CURDATE()), '-%m-%d')))
                BETWEEN DAYOFYEAR(CURDATE()) AND DAYOFYEAR(CURDATE()) + ?
            THEN 'anniversary'
          END AS reminder_type,
          LEAST(
            IFNULL(DAYOFYEAR(DATE_FORMAT(c.date_of_birth,    CONCAT(YEAR(CURDATE()), '-%m-%d'))) - DAYOFYEAR(CURDATE()), 999),
            IFNULL(DAYOFYEAR(DATE_FORMAT(c.anniversary_date, CONCAT(YEAR(CURDATE()), '-%m-%d'))) - DAYOFYEAR(CURDATE()), 999)
          ) AS days_away
        FROM customers c
       WHERE c.tenant_id = ?
         AND c.is_active  = 1
         AND (
           (c.date_of_birth IS NOT NULL
            AND DAYOFYEAR(DATE_FORMAT(c.date_of_birth, CONCAT(YEAR(CURDATE()), '-%m-%d')))
              BETWEEN DAYOFYEAR(CURDATE()) AND DAYOFYEAR(CURDATE()) + ?)
           OR
           (c.anniversary_date IS NOT NULL
            AND DAYOFYEAR(DATE_FORMAT(c.anniversary_date, CONCAT(YEAR(CURDATE()), '-%m-%d')))
              BETWEEN DAYOFYEAR(CURDATE()) AND DAYOFYEAR(CURDATE()) + ?)
         )
       ORDER BY days_away ASC, c.first_name ASC`,
      [days, days, tid(req), days, days]
    );

    res.json({ status: 'success', data: rows });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// ---------------------------------------------------------------------------
// GET /api/crm/customers/:id/wishlist
// ---------------------------------------------------------------------------
router.get('/customers/:id/wishlist', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT w.id, w.product_id, w.piece_id, w.notes, w.added_at,
              p.name AS product_name, p.selling_price, p.attributes,
              pp.piece_code, pp.purity, pp.selling_price AS piece_price
         FROM customer_wishlist_items w
         JOIN products p ON p.id = w.product_id
         LEFT JOIN product_pieces pp ON pp.id = w.piece_id
        WHERE w.tenant_id = ? AND w.customer_id = ?
        ORDER BY w.added_at DESC`,
      [tid(req), req.params.id]
    );
    res.json({ status: 'success', data: rows });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// ---------------------------------------------------------------------------
// POST /api/crm/customers/:id/wishlist
// Body: { product_id, piece_id?, notes? }
// ---------------------------------------------------------------------------
router.post('/customers/:id/wishlist', async (req, res) => {
  try {
    const { product_id, piece_id, notes } = req.body || {};
    if (!product_id) return res.status(400).json({ status: 'error', message: 'product_id required' });
    const id = uuidv4();
    await pool.execute(
      'INSERT IGNORE INTO customer_wishlist_items (id, tenant_id, customer_id, product_id, piece_id, notes) VALUES (?,?,?,?,?,?)',
      [id, tid(req), req.params.id, product_id, piece_id ?? null, notes ?? null]
    );
    res.status(201).json({ status: 'success', data: { id } });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// ---------------------------------------------------------------------------
// DELETE /api/crm/customers/:id/wishlist/:itemId
// ---------------------------------------------------------------------------
router.delete('/customers/:id/wishlist/:itemId', async (req, res) => {
  try {
    await pool.execute(
      'DELETE FROM customer_wishlist_items WHERE id = ? AND customer_id = ? AND tenant_id = ?',
      [req.params.itemId, req.params.id, tid(req)]
    );
    res.json({ status: 'success' });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// ---------------------------------------------------------------------------
// GET /api/crm/customers/:id/profile-extra
// Returns dob + anniversary_date
// ---------------------------------------------------------------------------
router.get('/customers/:id/profile-extra', async (req, res) => {
  try {
    const [[row]] = await pool.query(
      'SELECT date_of_birth, anniversary_date FROM customers WHERE id = ? AND tenant_id = ?',
      [req.params.id, tid(req)]
    );
    if (!row) return res.status(404).json({ status: 'error', message: 'Customer not found' });
    res.json({ status: 'success', data: row });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// ---------------------------------------------------------------------------
// PUT /api/crm/customers/:id/profile-extra
// Body: { date_of_birth?, anniversary_date? }
// ---------------------------------------------------------------------------
router.put('/customers/:id/profile-extra', async (req, res) => {
  try {
    const { date_of_birth, anniversary_date } = req.body || {};
    const sets = [], vals = [];
    if (date_of_birth    !== undefined) { sets.push('date_of_birth    = ?'); vals.push(date_of_birth    || null); }
    if (anniversary_date !== undefined) { sets.push('anniversary_date = ?'); vals.push(anniversary_date || null); }
    if (!sets.length) return res.status(400).json({ status: 'error', message: 'No fields to update' });
    vals.push(req.params.id, tid(req));
    await pool.execute(`UPDATE customers SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, vals);
    res.json({ status: 'success' });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

module.exports = router;
