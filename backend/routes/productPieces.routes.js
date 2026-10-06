/**
 * Serialized inventory (product pieces) routes
 * Base path: /api/product-pieces   (mounted in routes/index.js)
 *
 *   GET    /all                     cross-product list (?status=&product_id=&q=&limit=&offset=)
 *   GET    /product/:productId      list pieces for one product (?status=&q=)
 *   GET    /lookup                  find by barcode or piece_code (POS scan)
 *   GET    /:id                     single piece with product name
 *   POST   /                        create one piece (auto code)
 *   POST   /bulk                    create N pieces
 *   PUT    /:id                     update a piece (weight, price, purity, notes…)
 *   POST   /:id/status              change status  (available/hold/sold/returned/melted/lost/damaged)
 *
 * Note: literal-path routes (/all, /product/:x, /lookup, /bulk) MUST come before
 * the wildcard /:id handler to avoid shadowing.
 */

'use strict';

const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool }       = require('../config/db');
const { authenticate, requireTenantId } = require('../middleware/unifiedAuthMiddleware');
const requireIndustry = require('../middleware/requireIndustry');
const costCode = require('../services/costCodeService');

const tid = (req) => req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'];
const uid = (req) => req.user?.id || null;

router.use(authenticate);
router.use(requireTenantId);
router.use(requireIndustry(['jewelry', 'electronics']));

/* ─── helpers ───────────────────────────────────────────────────────────────── */

async function nextPieceCode(conn, tenantId) {
  await conn.query(
    'INSERT INTO product_piece_sequences (tenant_id, `last_value`) VALUES (?, 1) '
    + 'ON DUPLICATE KEY UPDATE `last_value` = `last_value` + 1',
    [tenantId]
  );
  const [[row]] = await conn.query(
    'SELECT `last_value` FROM product_piece_sequences WHERE tenant_id = ?', [tenantId]
  );
  return `PC-${String(row.last_value).padStart(6, '0')}`;
}

async function syncAvailableCount(conn, tenantId, productId) {
  const [[c]] = await conn.query(
    "SELECT COUNT(*) AS n FROM product_pieces WHERE tenant_id = ? AND product_id = ? AND status = 'available'",
    [tenantId, productId]
  );
  await conn.query(
    'UPDATE products SET stock_quantity = ?, is_serialized = 1 WHERE id = ? AND tenant_id = ?',
    [c.n, productId, tenantId]
  );
  return c.n;
}

async function maybeCostCode(conn, tenantId, amount) {
  if (amount == null) return null;
  try {
    const [rows] = await conn.query('SELECT * FROM tenant_cost_code_settings WHERE tenant_id = ?', [tenantId]);
    if (!rows.length || !rows[0].enabled) return null;
    const r = rows[0];
    return costCode.encode(amount, {
      enabled: true, prefix: r.prefix_char, suffix: r.suffix_char, decimalChar: r.decimal_char,
      repeatChar: r.repeat_char || '',
      digitMap: typeof r.digit_map === 'string' ? JSON.parse(r.digit_map) : r.digit_map,
    });
  } catch (_) { return null; }
}

async function insertPiece(conn, tenantId, userId, b) {
  const id        = uuidv4();
  const pieceCode = (b.piece_code && String(b.piece_code).trim()) || await nextPieceCode(conn, tenantId);
  const costPrice = b.cost_price ?? null;
  const cc        = b.cost_code  || await maybeCostCode(conn, tenantId, costPrice);
  await conn.query(
    `INSERT INTO product_pieces
      (id, tenant_id, store_id, product_id, piece_code, barcode, status,
       gross_weight, net_weight, purity,
       purchase_price, cost_price, selling_price, cost_code,
       attributes, grn_id, notes, created_by_user_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, tenantId, b.store_id ?? null, b.product_id, pieceCode,
      b.barcode ?? null, b.status || 'available',
      b.gross_weight ?? null, b.net_weight ?? null, b.purity ?? null,
      b.purchase_price ?? null, costPrice, b.selling_price ?? null, cc,
      b.attributes ? JSON.stringify(b.attributes) : null,
      b.grn_id ?? null, b.notes ?? null, userId,
    ]
  );
  return { id, piece_code: pieceCode, cost_code: cc };
}

/* ════════════════════════════════════════════════════════════════════════════════
   LITERAL ROUTES  (must come before /:id wildcard)
════════════════════════════════════════════════════════════════════════════════ */

/* GET /all — cross-product listing (used by CycleCount + main inventory page) */
router.get('/all', async (req, res) => {
  try {
    const params = [tid(req)];
    let sql = `
      SELECT pp.*,
             p.name  AS product_name,
             p.sku   AS product_sku
        FROM product_pieces pp
        JOIN products p ON p.id = pp.product_id
       WHERE pp.tenant_id = ?`;

    if (req.query.status)     { sql += ' AND pp.status = ?';     params.push(req.query.status); }
    if (req.query.product_id) { sql += ' AND pp.product_id = ?'; params.push(req.query.product_id); }
    if (req.query.q) {
      const like = `%${req.query.q}%`;
      sql += ' AND (pp.piece_code LIKE ? OR pp.barcode LIKE ? OR p.name LIKE ? OR pp.purity LIKE ?)';
      params.push(like, like, like, like);
    }
    sql += ' ORDER BY pp.created_at DESC';

    const limit  = Math.min(parseInt(req.query.limit, 10)  || 200, 500);
    const offset = parseInt(req.query.offset, 10) || 0;
    sql += ` LIMIT ${limit} OFFSET ${offset}`;

    const [rows] = await pool.execute(sql, params);
    res.json({ status: 'success', data: rows });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

/* GET /product/:productId */
router.get('/product/:productId', async (req, res) => {
  try {
    const params = [tid(req), req.params.productId];
    let sql = `
      SELECT pp.*, p.name AS product_name, p.sku AS product_sku
        FROM product_pieces pp
        JOIN products p ON p.id = pp.product_id
       WHERE pp.tenant_id = ? AND pp.product_id = ?`;
    if (req.query.status) { sql += ' AND pp.status = ?'; params.push(req.query.status); }
    if (req.query.q) {
      const like = `%${req.query.q}%`;
      sql += ' AND (pp.piece_code LIKE ? OR pp.barcode LIKE ? OR pp.purity LIKE ?)';
      params.push(like, like, like);
    }
    sql += ' ORDER BY pp.created_at DESC';
    const [rows] = await pool.execute(sql, params);
    res.json({ status: 'success', data: rows });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

/* GET /lookup?barcode=|code= */
router.get('/lookup', async (req, res) => {
  try {
    const { barcode, code } = req.query;
    if (!barcode && !code) return res.status(400).json({ status: 'error', message: 'barcode or code required' });
    const [rows] = await pool.execute(
      `SELECT pp.*, p.name AS product_name, p.sku AS product_sku
         FROM product_pieces pp
         JOIN products p ON p.id = pp.product_id
        WHERE pp.tenant_id = ? AND (${barcode ? 'pp.barcode = ?' : 'pp.piece_code = ?'}) LIMIT 1`,
      [tid(req), barcode || code]
    );
    if (!rows.length) return res.status(404).json({ status: 'error', message: 'piece not found' });
    res.json({ status: 'success', data: rows[0] });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

/* POST /bulk */
router.post('/bulk', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const b     = req.body || {};
    const count = Math.min(parseInt(b.count, 10) || 0, 500);
    if (!b.product_id || count < 1) {
      await conn.rollback();
      return res.status(400).json({ status: 'error', message: 'product_id and count (>=1) required' });
    }
    const created = [];
    for (let i = 0; i < count; i++) {
      created.push(await insertPiece(conn, tid(req), uid(req), { ...b, piece_code: null, barcode: null }));
    }
    const available = await syncAvailableCount(conn, tid(req), b.product_id);
    await conn.commit();
    res.status(201).json({ status: 'success', data: { created, available } });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ status: 'error', message: e.message });
  } finally { conn.release(); }
});

/* ════════════════════════════════════════════════════════════════════════════════
   WILDCARD /:id  (must come after all literal routes)
════════════════════════════════════════════════════════════════════════════════ */

/* GET /:id */
router.get('/:id', async (req, res) => {
  try {
    const [[row]] = await pool.query(
      `SELECT pp.*, p.name AS product_name, p.sku AS product_sku
         FROM product_pieces pp
         JOIN products p ON p.id = pp.product_id
        WHERE pp.id = ? AND pp.tenant_id = ?`,
      [req.params.id, tid(req)]
    );
    if (!row) return res.status(404).json({ status: 'error', message: 'not found' });
    res.json({ status: 'success', data: row });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

/* POST / — create one piece */
router.post('/', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const b = req.body || {};
    if (!b.product_id) {
      await conn.rollback();
      return res.status(400).json({ status: 'error', message: 'product_id required' });
    }
    const piece     = await insertPiece(conn, tid(req), uid(req), b);
    const available = await syncAvailableCount(conn, tid(req), b.product_id);
    await conn.commit();
    res.status(201).json({ status: 'success', data: { ...piece, available } });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ status: 'error', message: e.message });
  } finally { conn.release(); }
});

/* PUT /:id */
router.put('/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const fields = [
      'store_id', 'barcode', 'gross_weight', 'net_weight', 'purity',
      'purchase_price', 'cost_price', 'selling_price', 'cost_code', 'notes',
    ];
    const sets = [], vals = [];
    for (const f of fields) if (b[f] !== undefined) { sets.push(`${f} = ?`); vals.push(b[f]); }
    if (b.attributes !== undefined) { sets.push('attributes = ?'); vals.push(JSON.stringify(b.attributes)); }
    if (!sets.length) return res.status(400).json({ status: 'error', message: 'no fields to update' });
    vals.push(req.params.id, tid(req));
    await pool.execute(
      `UPDATE product_pieces SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, vals
    );
    res.json({ status: 'success' });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

/* POST /:id/status */
router.post('/:id/status', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { status, sale_id, sale_item_id, notes } = req.body || {};
    const valid = ['available', 'hold', 'sold', 'returned', 'melted', 'lost', 'damaged'];
    if (!valid.includes(status)) {
      await conn.rollback();
      return res.status(400).json({ status: 'error', message: 'invalid status' });
    }
    const [[piece]] = await conn.query(
      'SELECT product_id, status AS previous_status FROM product_pieces WHERE id = ? AND tenant_id = ?',
      [req.params.id, tid(req)]
    );
    if (!piece) { await conn.rollback(); return res.status(404).json({ status: 'error', message: 'not found' }); }

    const sets = ['status = ?']; const vals = [status];
    if (status === 'sold') { sets.push('sale_id = ?', 'sale_item_id = ?'); vals.push(sale_id ?? null, sale_item_id ?? null); }
    if (notes !== undefined) { sets.push('notes = ?'); vals.push(notes); }
    vals.push(req.params.id, tid(req));
    await conn.query(`UPDATE product_pieces SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, vals);

    const available = await syncAvailableCount(conn, tid(req), piece.product_id);

    // 'lost'/'damaged' write off a piece from sellable stock outside a sale
    // or GRN reversal — e.g. a Cycle Count reconciliation. Give it the same
    // inventory_logs trail every other stock-affecting event gets, so it
    // shows up in inventory history/reports rather than only being visible
    // as a silent status flip on the piece itself.
    if ((status === 'lost' || status === 'damaged') && piece.previous_status === 'available') {
      const logId = uuidv4();
      await conn.query('INSERT INTO inventory_logs SET ?', {
        id: logId,
        tenant_id: tid(req),
        store_id: req.body.store_id || req.headers['x-store-id'] || null,
        product_id: piece.product_id,
        quantity_change: '-1.00',
        reason: `Piece marked ${status}${notes ? `: ${notes}` : ''}`,
        current_stock_before_change: null,
        current_stock_after_change: available,
        created_by: uid(req),
        reference_id: req.params.id,
        reference_type: 'PRODUCT_PIECE_STATUS',
      });
    }

    await conn.commit();
    res.json({ status: 'success', data: { available } });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ status: 'error', message: e.message });
  } finally { conn.release(); }
});

module.exports = router;
