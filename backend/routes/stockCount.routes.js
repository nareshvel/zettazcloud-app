/**
 * Bulk stock count / reconciliation — for non-serialized (quantity-based)
 * products. Cycle Count (product-pieces routes) already covers serialized
 * jewelry/electronics pieces one at a time; this is the equivalent tool for
 * every other vertical (grocery, pharmacy, general retail, apparel,
 * souvenir_gifts) and non-serialized jewelry products too — a cashier counts
 * a shelf/section, enters the counted quantity per product, and submits the
 * whole sheet in one transaction. Not industry-gated: stock adjustment is a
 * universal need (see CLAUDE.md's stock-adjustment audit), it's only the
 * per-piece Cycle Count tool that's jewelry/electronics-specific.
 *
 * Base path: /api/stock-counts  (mounted in routes/index.js)
 *
 *   GET  /products                    list countable products (?search=&category_id=&limit=&offset=)
 *   POST /reconcile                   apply a batch of counted quantities as adjustments
 *   POST /sessions                    create a named count session (+ seed scope items)
 *   GET  /sessions                    list sessions for this store (?status=)
 *   GET  /sessions/:id                session detail + items
 *   PUT  /sessions/:id/items          upsert counted qty / reason per product
 *                                     (also adds out-of-scope products mid-count)
 *   POST /sessions/:id/submit         finish counting — posts immediately when the
 *                                     session needs no approval, else -> submitted
 *   POST /sessions/:id/approve        submitted -> posted (inventory.count_approve)
 *   POST /sessions/:id/cancel         in_progress/submitted -> cancelled
 *
 * Every changed count requires its own reason/note (see POST /reconcile) —
 * a store owner reviewing shrinkage wants to know per product why the
 * number moved, not one blanket note glued onto an entire sheet.
 */

'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool, getConnectionWithTimeZone } = require('../config/db');
const { authenticate, requireTenantId, requireStoreId } = require('../middleware/unifiedAuthMiddleware');
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');

router.use(authenticate);
router.use(requireTenantId);
router.use(requireStoreId);

/**
 * Apply one counted-quantity reconciliation inside an open transaction —
 * shared by POST /reconcile and session posting. Branches shared vs
 * store-owned products exactly like POST /api/stock-adjustments in
 * server.js (see that route's comments for why this matters) and writes
 * the same stock_adjustments + inventory_logs audit pair a single
 * adjustment gets. Returns { applied } or { skipped } — never throws for
 * ordinary business cases (not found / other store / no change).
 */
async function applyCountedQuantity(connection, { tenantId, storeId, userId, productId, countedQuantity, notes, reasonCode }) {
  const [prodRows] = await connection.query(
    'SELECT id, store_id, stock_quantity FROM products WHERE id = ? AND tenant_id = ? FOR UPDATE',
    [productId, tenantId]
  );
  if (!prodRows.length) return { skipped: { productId, reason: 'not found' } };

  const isSharedProduct = prodRows[0].store_id === null;
  let beforeQty;

  if (isSharedProduct) {
    const [listingRows] = await connection.query(
      `SELECT stock_quantity FROM store_product_listings
       WHERE tenant_id = ? AND store_id = ? AND product_id = ? FOR UPDATE`,
      [tenantId, storeId, productId]
    );
    beforeQty = listingRows.length ? parseFloat(listingRows[0].stock_quantity || 0) : 0;
  } else {
    if (prodRows[0].store_id !== storeId) {
      return { skipped: { productId, reason: 'belongs to a different store' } };
    }
    beforeQty = parseFloat(prodRows[0].stock_quantity || 0);
  }

  const delta = countedQuantity - beforeQty;
  if (delta === 0) return { skipped: { productId, reason: 'no change' } };

  if (isSharedProduct) {
    await connection.query(
      `INSERT INTO store_product_listings (id, tenant_id, store_id, product_id, price, cost_price_override, stock_quantity, is_active)
       VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)
       ON DUPLICATE KEY UPDATE stock_quantity = VALUES(stock_quantity)`,
      [uuidv4(), tenantId, storeId, productId, countedQuantity.toFixed(2)]
    );
  } else {
    await connection.query(
      'UPDATE products SET stock_quantity = ?, updated_by_user_id = ? WHERE id = ? AND tenant_id = ?',
      [countedQuantity.toFixed(2), userId, productId, tenantId]
    );
  }

  const logId = uuidv4();
  await connection.query('INSERT INTO inventory_logs SET ?', {
    id: logId,
    tenant_id: tenantId,
    store_id: storeId,
    product_id: productId,
    quantity_change: delta.toFixed(2),
    reason: `Stock count: ${reasonCode} - ${notes}`,
    current_stock_before_change: beforeQty.toFixed(2),
    current_stock_after_change: countedQuantity.toFixed(2),
    created_by: userId,
    reference_id: logId,
    reference_type: 'STOCK_COUNT',
  });

  const stockAdjustmentId = uuidv4();
  await connection.query(
    `INSERT INTO stock_adjustments (
       id, tenant_id, store_id, product_id, user_id,
       adjustment_type, reason_code,
       quantity_adjusted, stock_before_adjustment, stock_after_adjustment,
       notes, adjustment_date
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      stockAdjustmentId, tenantId, storeId, productId, userId,
      delta > 0 ? 'INCREMENT' : 'DECREMENT', reasonCode,
      Math.abs(delta), beforeQty, countedQuantity,
      notes, new Date().toISOString(),
    ]
  );

  return { applied: { productId, before: beforeQty, after: countedQuantity, delta } };
}

/**
 * Post a session: apply every item with a counted_qty against LIVE stock
 * (the stored expected_qty is the display baseline only), then mark the
 * session posted. Caller owns the transaction. Returns { applied, skipped }.
 */
async function postSessionItems(connection, session, userId) {
  const [items] = await connection.query(
    `SELECT product_id, counted_qty, notes FROM stock_count_session_items
     WHERE session_id = ? AND tenant_id = ? AND counted_qty IS NOT NULL`,
    [session.id, session.tenant_id]
  );
  const applied = [];
  const skipped = [];
  for (const item of items) {
    const r = await applyCountedQuantity(connection, {
      tenantId: session.tenant_id,
      storeId: session.store_id,
      userId,
      productId: item.product_id,
      countedQuantity: parseFloat(item.counted_qty),
      notes: item.notes || 'Stock count',
      reasonCode: 'CYCLE_COUNT',
    });
    if (r.applied) applied.push(r.applied); else skipped.push(r.skipped);
  }
  await connection.query(
    `UPDATE stock_count_sessions
     SET status = 'posted', posted_at = NOW(), applied_count = ?, skipped_count = ?
     WHERE id = ? AND tenant_id = ?`,
    [applied.length, skipped.length, session.id, session.tenant_id]
  );
  return { applied, skipped };
}

/**
 * GET /products — countable products for this store: every store-owned
 * product at this store, plus every tenant-wide shared product (with this
 * store's effective stock, defaulting to 0 if it has no listing row yet).
 * Serialized products are excluded — they're counted piece-by-piece via
 * Cycle Count, not by a typed-in quantity.
 */
router.get('/products', requirePermission('inventory.adjust'), async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
    const storeId = req.user?.store_id || req.headers['x-store-id'] || req.query.store_id;
    const search = (req.query.search || '').trim();
    const categoryId = (req.query.category_id || req.query.categoryId || '').trim();
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const offset = parseInt(req.query.offset, 10) || 0;

    // Base WHERE clause shared by both the page query and the total count,
    // so "X of Y products" in the UI is never computed from a different
    // filter than what's actually on screen.
    const whereParts = ['p.tenant_id = ?', 'p.is_serialized = 0', '(p.store_id IS NULL OR p.store_id = ?)'];
    const whereParams = [tenantId, storeId];
    if (categoryId) { whereParts.push('p.category_id = ?'); whereParams.push(categoryId); }
    if (search) {
      whereParts.push('(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)');
      const like = `%${search}%`;
      whereParams.push(like, like, like);
    }
    const whereClause = whereParts.join(' AND ');

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM products p WHERE ${whereClause}`,
      whereParams
    );

    const sql = `
      SELECT
        p.id, p.name, p.sku, p.barcode, p.category_id, p.store_id,
        c.name AS category_name,
        COALESCE(spl.stock_quantity, p.stock_quantity, 0) AS current_stock,
        p.low_stock_threshold,
        lc.last_counted_at
      FROM products p
      LEFT JOIN store_product_listings spl
        ON spl.product_id = p.id AND spl.store_id = ? AND spl.tenant_id = ?
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN (
        SELECT product_id, MAX(adjustment_date) AS last_counted_at
        FROM stock_adjustments
        WHERE tenant_id = ? AND store_id = ? AND reason_code = 'CYCLE_COUNT'
        GROUP BY product_id
      ) lc ON lc.product_id = p.id
      WHERE ${whereClause}
      ORDER BY p.name ASC LIMIT ${limit} OFFSET ${offset}
    `;
    const [rows] = await pool.query(sql, [storeId, tenantId, tenantId, storeId, ...whereParams]);

    // fetchApi (frontend/src/services/api.ts) unwraps { status, data } down
    // to just `data` — a sibling top-level `meta` key would be silently
    // dropped, so the total/limit/offset the UI needs for "showing X of Y"
    // has to travel inside `data` itself.
    res.json({
      status: 'success',
      data: {
        items: rows.map((r) => ({
          id: r.id,
          name: r.name,
          sku: r.sku,
          barcode: r.barcode,
          categoryId: r.category_id,
          categoryName: r.category_name || null,
          isShared: r.store_id === null,
          currentStock: parseFloat(r.current_stock || 0),
          lowStockThreshold: r.low_stock_threshold != null ? parseFloat(r.low_stock_threshold) : null,
          lastCountedAt: r.last_counted_at || null,
        })),
        total,
        limit,
        offset,
      },
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

/**
 * POST /reconcile — body: { counts: [{ productId, countedQuantity, notes }],
 * reasonCode? }. `notes` is required and per-product — a store owner
 * reviewing a discrepancy needs to know why THIS item was off ("box found
 * behind shelf", "3 units damaged in stockroom"), not one note glued onto
 * a whole multi-product sheet. The whole batch is rejected up front if any
 * entry is missing notes, so a reconciliation is never partially applied
 * with some products silently undocumented.
 *
 * For each product whose counted quantity differs from its current
 * effective stock, applies the delta as an adjustment (branching shared vs
 * store-owned exactly like POST /api/stock-adjustments in server.js — see
 * that route's comments for why this branching matters) inside one
 * transaction, and writes a stock_adjustments + inventory_logs row per
 * changed product for the same audit trail a single adjustment gets.
 * Products whose counted quantity matches current stock are skipped — no
 * adjustment row for "no change".
 */
router.post('/reconcile', requirePermission('inventory.adjust'), async (req, res) => {
  const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
  const storeId = req.user?.store_id || req.headers['x-store-id'] || req.body.store_id;
  const userId = req.user?.id || null;
  const { counts, reasonCode } = req.body || {};

  if (!tenantId || !storeId) {
    return res.status(400).json({ status: 'error', message: 'Missing tenant/store context.' });
  }
  if (!Array.isArray(counts) || counts.length === 0) {
    return res.status(400).json({ status: 'error', message: 'counts must be a non-empty array.' });
  }
  if (counts.length > 500) {
    return res.status(400).json({ status: 'error', message: 'A single reconciliation is capped at 500 products — split into batches.' });
  }
  const missingNotes = counts.filter((c) => !((c.notes || '').trim()));
  if (missingNotes.length > 0) {
    return res.status(400).json({
      status: 'error',
      message: `${missingNotes.length} product${missingNotes.length === 1 ? '' : 's'} missing a required note explaining the count change.`,
    });
  }

  const finalReasonCode = reasonCode || 'CYCLE_COUNT';
  const connection = await getConnectionWithTimeZone(req.storeTz);
  const applied = [];
  const skipped = [];

  try {
    await connection.beginTransaction();

    for (const entry of counts) {
      const productId = entry.productId || entry.product_id;
      const countedQuantity = parseFloat(entry.countedQuantity ?? entry.counted_quantity);
      const itemNotes = (entry.notes || '').trim();
      if (!productId || isNaN(countedQuantity) || countedQuantity < 0) {
        skipped.push({ productId, reason: 'invalid counted quantity' });
        continue;
      }
      const r = await applyCountedQuantity(connection, {
        tenantId, storeId, userId, productId, countedQuantity,
        notes: itemNotes, reasonCode: finalReasonCode,
      });
      if (r.applied) applied.push(r.applied); else skipped.push(r.skipped);
    }

    await connection.commit();
    res.status(200).json({ status: 'success', data: { applied, skipped } });
  } catch (err) {
    try { await connection.rollback(); } catch (_) {}
    console.error('Stock count reconciliation failed:', err);
    res.status(500).json({ status: 'error', message: 'Failed to reconcile stock count', error: err.message });
  } finally {
    connection.release();
  }
});

// ============================================================================
// Count sessions — named, resumable counts with an approval gate
// ============================================================================

const SESSION_SEED_LIMIT = 2000; // a full-store count can legitimately exceed the /products 500 cap

/** Load a session scoped to this tenant+store or null. */
async function findSession(tenantId, storeId, id) {
  const [rows] = await pool.query(
    'SELECT * FROM stock_count_sessions WHERE id = ? AND tenant_id = ? AND store_id = ?',
    [id, tenantId, storeId]
  );
  return rows[0] || null;
}

/**
 * POST /sessions — { name?, categoryId?, blind?, requiresApproval? }
 * Creates the session and seeds its items from the same countable-product
 * scope as GET /products (category-scoped when given, otherwise every
 * countable product at the store). expected_qty is snapshotted now — the
 * posted delta is still recomputed against live stock at post time.
 */
router.post('/sessions', requirePermission('inventory.adjust'), async (req, res) => {
  const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
  const storeId = req.user?.store_id || req.headers['x-store-id'] || req.body.store_id;
  const userId = req.user?.id || null;
  const { name, categoryId, blind, requiresApproval } = req.body || {};

  const connection = await getConnectionWithTimeZone(req.storeTz);
  try {
    await connection.beginTransaction();
    const sessionId = uuidv4();

    let categoryName = null;
    if (categoryId) {
      const [cats] = await connection.query(
        'SELECT name FROM categories WHERE id = ? AND tenant_id = ?', [categoryId, tenantId]
      );
      if (!cats.length) {
        await connection.rollback();
        return res.status(400).json({ status: 'error', message: 'Category not found.' });
      }
      categoryName = cats[0].name;
    }

    await connection.query(
      `INSERT INTO stock_count_sessions
        (id, tenant_id, store_id, name, scope_category_id, scope_category_name, blind, requires_approval, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId, tenantId, storeId,
        (name || '').trim() || `Count ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
        categoryId || null, categoryName,
        blind ? 1 : 0, requiresApproval ? 1 : 0, userId,
      ]
    );

    await connection.query(
      `INSERT INTO stock_count_session_items
        (id, tenant_id, store_id, session_id, product_id, product_name, sku, barcode, category_name, expected_qty)
       SELECT UUID(), p.tenant_id, ?, ?, p.id, p.name, p.sku, p.barcode, c.name,
              COALESCE(spl.stock_quantity, p.stock_quantity, 0)
       FROM products p
       LEFT JOIN store_product_listings spl
         ON spl.product_id = p.id AND spl.store_id = ? AND spl.tenant_id = ?
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.tenant_id = ? AND p.is_serialized = 0
         AND (p.store_id IS NULL OR p.store_id = ?)
         ${categoryId ? 'AND p.category_id = ?' : ''}
       ORDER BY p.name ASC
       LIMIT ${SESSION_SEED_LIMIT}`,
      categoryId
        ? [storeId, sessionId, storeId, tenantId, tenantId, storeId, categoryId]
        : [storeId, sessionId, storeId, tenantId, tenantId, storeId]
    );

    await connection.commit();
    const session = await findSession(tenantId, storeId, sessionId);
    res.status(201).json({ status: 'success', data: session });
  } catch (e) {
    try { await connection.rollback(); } catch (_) {}
    res.status(500).json({ status: 'error', message: e.message });
  } finally {
    connection.release();
  }
});

/**
 * GET /sessions?status=&limit= — session history for this store, with
 * progress aggregates so the list can show "14/58 counted · 3 variances"
 * without N+1 queries. in_progress/submitted first, then most recent.
 */
router.get('/sessions', requirePermission('inventory.adjust'), async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
    const storeId = req.user?.store_id || req.headers['x-store-id'] || req.query.store_id;
    const status = (req.query.status || '').trim();
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    const [rows] = await pool.query(
      `SELECT s.*,
         (SELECT COUNT(*) FROM stock_count_session_items i WHERE i.session_id = s.id) AS item_count,
         (SELECT COUNT(*) FROM stock_count_session_items i WHERE i.session_id = s.id AND i.counted_qty IS NOT NULL) AS counted_count,
         (SELECT COUNT(*) FROM stock_count_session_items i WHERE i.session_id = s.id AND i.variance IS NOT NULL AND i.variance <> 0) AS variance_count
       FROM stock_count_sessions s
       WHERE s.tenant_id = ? AND s.store_id = ?
         ${status ? 'AND s.status = ?' : ''}
       ORDER BY FIELD(s.status, 'in_progress', 'submitted', 'posted', 'cancelled'), s.created_at DESC
       LIMIT ${limit}`,
      status ? [tenantId, storeId, status] : [tenantId, storeId]
    );
    res.json({ status: 'success', data: { items: rows } });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

/** GET /sessions/:id — session + its items (count sheet for that session). */
router.get('/sessions/:id', requirePermission('inventory.adjust'), async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
    const storeId = req.user?.store_id || req.headers['x-store-id'] || req.query.store_id;
    const session = await findSession(tenantId, storeId, req.params.id);
    if (!session) return res.status(404).json({ status: 'error', message: 'Count session not found.' });
    const [items] = await pool.query(
      `SELECT * FROM stock_count_session_items
       WHERE session_id = ? AND tenant_id = ?
       ORDER BY added_during_count ASC, product_name ASC`,
      [session.id, tenantId]
    );
    res.json({ status: 'success', data: { session, items } });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

/**
 * PUT /sessions/:id/items — { items: [{ productId, countedQty?, reasonCode?, notes? }] }
 * Saves counts as they happen (multi-device + crash-safe by design).
 *   - countedQty present (incl. null to clear) → updates counted_qty/variance
 *   - reasonCode/notes present → updates the variance reason
 *   - productId not yet in the session → added as an out-of-scope row
 *     (added_during_count=1) with expected_qty snapshotted from live stock
 * Only sessions still in_progress accept counts.
 */
router.put('/sessions/:id/items', requirePermission('inventory.adjust'), async (req, res) => {
  const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
  const storeId = req.user?.store_id || req.headers['x-store-id'] || req.body.store_id;
  const userId = req.user?.id || null;
  const { items } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ status: 'error', message: 'items must be a non-empty array.' });
  }
  if (items.length > 500) {
    return res.status(400).json({ status: 'error', message: 'Batch capped at 500 items.' });
  }

  const session = await findSession(tenantId, storeId, req.params.id);
  if (!session) return res.status(404).json({ status: 'error', message: 'Count session not found.' });
  if (session.status !== 'in_progress') {
    return res.status(409).json({ status: 'error', message: `Session is ${session.status} — counts can only change while in progress.` });
  }

  const connection = await getConnectionWithTimeZone(req.storeTz);
  const added = [];
  const failed = [];
  try {
    await connection.beginTransaction();
    for (const entry of items) {
      const productId = entry.productId || entry.product_id;
      if (!productId) { failed.push({ productId, reason: 'missing productId' }); continue; }

      const hasCount = Object.prototype.hasOwnProperty.call(entry, 'countedQty') || Object.prototype.hasOwnProperty.call(entry, 'counted_qty');
      const rawQty = entry.countedQty ?? entry.counted_qty;
      const countedQty = rawQty === null || rawQty === undefined ? null : parseFloat(rawQty);
      if (hasCount && countedQty !== null && (isNaN(countedQty) || countedQty < 0)) {
        failed.push({ productId, reason: 'invalid counted quantity' });
        continue;
      }
      const reasonCode = entry.reasonCode ?? entry.reason_code ?? null;
      const notes = entry.notes ?? null;

      const [upd] = await connection.query(
        `UPDATE stock_count_session_items SET
           counted_qty = IF(? IS NULL, counted_qty, ?),
           variance    = IF(? IS NULL, variance, ? - expected_qty),
           reason_code = COALESCE(?, reason_code),
           notes       = COALESCE(?, notes),
           counted_by  = IF(? IS NULL, counted_by, ?),
           counted_at  = IF(? IS NULL, counted_at, NOW())
         WHERE session_id = ? AND product_id = ? AND tenant_id = ?`,
        [
          hasCount ? 1 : null, countedQty,
          hasCount ? 1 : null, countedQty,
          reasonCode, notes,
          hasCount ? 1 : null, userId,
          hasCount ? 1 : null,
          session.id, productId, tenantId,
        ]
      );

      if (upd.affectedRows > 0) continue;

      // Not in the session — an out-of-scope scan. Verify it's a countable
      // product for this tenant and add it flagged added_during_count.
      const [prodRows] = await connection.query(
        `SELECT p.id, p.name, p.sku, p.barcode, c.name AS category_name,
                COALESCE(spl.stock_quantity, p.stock_quantity, 0) AS current_stock
         FROM products p
         LEFT JOIN store_product_listings spl
           ON spl.product_id = p.id AND spl.store_id = ? AND spl.tenant_id = ?
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.id = ? AND p.tenant_id = ? AND p.is_serialized = 0
           AND (p.store_id IS NULL OR p.store_id = ?)`,
        [storeId, tenantId, productId, tenantId, storeId]
      );
      if (!prodRows.length) { failed.push({ productId, reason: 'not a countable product' }); continue; }
      const p = prodRows[0];
      const expected = parseFloat(p.current_stock || 0);
      await connection.query(
        `INSERT INTO stock_count_session_items
          (id, tenant_id, store_id, session_id, product_id, product_name, sku, barcode, category_name,
           expected_qty, counted_qty, variance, reason_code, notes, added_during_count, counted_by, counted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, IF(? IS NULL, NULL, NOW()))`,
        [
          uuidv4(), tenantId, storeId, session.id, productId, p.name, p.sku, p.barcode, p.category_name,
          expected, countedQty, countedQty === null ? null : countedQty - expected,
          reasonCode, notes, userId, hasCount ? 1 : null,
        ]
      );
      added.push(productId);
    }
    await connection.commit();
    res.json({ status: 'success', data: { updated: items.length - failed.length, added, failed } });
  } catch (e) {
    try { await connection.rollback(); } catch (_) {}
    res.status(500).json({ status: 'error', message: e.message });
  } finally {
    connection.release();
  }
});

/**
 * POST /sessions/:id/submit — finish counting. Every item whose counted
 * qty differs from its expected baseline needs a reason (same contract as
 * /reconcile). Then: requires_approval → 'submitted' (an approver posts it
 * via /approve); otherwise the session posts immediately and returns the
 * applied/skipped summary.
 */
router.post('/sessions/:id/submit', requirePermission('inventory.adjust'), async (req, res) => {
  const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
  const storeId = req.user?.store_id || req.headers['x-store-id'] || req.body.store_id;
  const userId = req.user?.id || null;

  const session = await findSession(tenantId, storeId, req.params.id);
  if (!session) return res.status(404).json({ status: 'error', message: 'Count session not found.' });
  if (session.status !== 'in_progress') {
    return res.status(409).json({ status: 'error', message: `Session is ${session.status} — only in-progress counts can be submitted.` });
  }

  const [[{ missing }]] = await pool.query(
    `SELECT COUNT(*) AS missing FROM stock_count_session_items
     WHERE session_id = ? AND tenant_id = ? AND counted_qty IS NOT NULL
       AND variance <> 0 AND (notes IS NULL OR notes = '')`,
    [session.id, tenantId]
  );
  if (missing > 0) {
    return res.status(400).json({
      status: 'error',
      message: `${missing} variance${missing === 1 ? '' : 's'} missing a reason — every changed count needs one.`,
    });
  }

  const connection = await getConnectionWithTimeZone(req.storeTz);
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE stock_count_sessions SET submitted_by = ?, submitted_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [userId, session.id, tenantId]
    );

    if (session.requires_approval) {
      await connection.query(
        `UPDATE stock_count_sessions SET status = 'submitted' WHERE id = ? AND tenant_id = ?`,
        [session.id, tenantId]
      );
      await connection.commit();
      return res.json({ status: 'success', data: { status: 'submitted' } });
    }

    const { applied, skipped } = await postSessionItems(connection, session, userId);
    await connection.commit();
    res.json({ status: 'success', data: { status: 'posted', applied, skipped } });
  } catch (e) {
    try { await connection.rollback(); } catch (_) {}
    res.status(500).json({ status: 'error', message: e.message });
  } finally {
    connection.release();
  }
});

/**
 * POST /sessions/:id/approve — reviewer posts a submitted count. Gated by
 * the separate inventory.count_approve permission so a counter without it
 * cannot self-approve; small stores where one person holds both
 * permissions can still run the whole flow.
 */
router.post('/sessions/:id/approve', requirePermission('inventory.count_approve'), async (req, res) => {
  const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
  const storeId = req.user?.store_id || req.headers['x-store-id'] || req.body.store_id;
  const userId = req.user?.id || null;

  const session = await findSession(tenantId, storeId, req.params.id);
  if (!session) return res.status(404).json({ status: 'error', message: 'Count session not found.' });
  if (session.status !== 'submitted') {
    return res.status(409).json({ status: 'error', message: `Session is ${session.status} — only submitted counts can be approved.` });
  }

  const connection = await getConnectionWithTimeZone(req.storeTz);
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE stock_count_sessions SET approved_by = ?, approved_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [userId, session.id, tenantId]
    );
    const { applied, skipped } = await postSessionItems(connection, session, userId);
    await connection.commit();
    res.json({ status: 'success', data: { status: 'posted', applied, skipped } });
  } catch (e) {
    try { await connection.rollback(); } catch (_) {}
    res.status(500).json({ status: 'error', message: e.message });
  } finally {
    connection.release();
  }
});

/** POST /sessions/:id/cancel — abandon an in-progress or submitted count. */
router.post('/sessions/:id/cancel', requirePermission('inventory.adjust'), async (req, res) => {
  const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
  const storeId = req.user?.store_id || req.headers['x-store-id'] || req.body.store_id;
  const session = await findSession(tenantId, storeId, req.params.id);
  if (!session) return res.status(404).json({ status: 'error', message: 'Count session not found.' });
  if (session.status === 'posted' || session.status === 'cancelled') {
    return res.status(409).json({ status: 'error', message: `Session is already ${session.status}.` });
  }
  await pool.query(
    `UPDATE stock_count_sessions SET status = 'cancelled' WHERE id = ? AND tenant_id = ?`,
    [session.id, tenantId]
  );
  res.json({ status: 'success', data: { status: 'cancelled' } });
});

module.exports = router;
