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
 *   GET  /products         list countable products for the sheet (?search=&category_id=&limit=&offset=)
 *   POST /reconcile         apply a batch of counted quantities as adjustments
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

      const [prodRows] = await connection.query(
        'SELECT id, store_id, stock_quantity FROM products WHERE id = ? AND tenant_id = ? FOR UPDATE',
        [productId, tenantId]
      );
      if (!prodRows.length) {
        skipped.push({ productId, reason: 'not found' });
        continue;
      }

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
          skipped.push({ productId, reason: 'belongs to a different store' });
          continue;
        }
        beforeQty = parseFloat(prodRows[0].stock_quantity || 0);
      }

      const delta = countedQuantity - beforeQty;
      if (delta === 0) {
        skipped.push({ productId, reason: 'no change' });
        continue;
      }

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
        reason: `Stock count: ${finalReasonCode} - ${itemNotes}`,
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
          delta > 0 ? 'INCREMENT' : 'DECREMENT', finalReasonCode,
          Math.abs(delta), beforeQty, countedQuantity,
          itemNotes, new Date().toISOString(),
        ]
      );

      applied.push({ productId, before: beforeQty, after: countedQuantity, delta });
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

module.exports = router;
