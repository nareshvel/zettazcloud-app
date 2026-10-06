/**
 * Catalog sync / e-commerce routes — /api/catalog
 *
 * Platform-agnostic by design: we expose a normalized product feed and an outbox
 * queue. A platform adapter (Shopify/Woo/custom) consumes the queue and pushes.
 * Adding a platform needs no schema or route change.
 *
 *   GET    /channels                  list channels
 *   POST   /channels                  create a channel
 *   PUT    /channels/:id              update a channel
 *   GET    /channels/:id/products     publish state per product
 *   POST   /channels/:id/publish      publish/unpublish products (queues sync)
 *   GET    /feed                      normalized product feed (JSON, ?format=csv)
 *   GET    /queue                     pending sync jobs
 *   POST   /queue/:id/complete        mark a job done/failed (adapter callback)
 */

'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');
const { authenticate, requireTenantId } = require('../middleware/unifiedAuthMiddleware');

const tid = (req) => req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'];

router.use(authenticate);
router.use(requireTenantId);

// ---- channels ----
router.get('/channels', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM sales_channels WHERE tenant_id = ? ORDER BY name', [tid(req)]);
    // Never leak credential references to the client.
    res.json({ status: 'success', data: rows.map(({ credentials_ref, ...r }) => ({ ...r, has_credentials: !!credentials_ref })) });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

router.post('/channels', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.name) return res.status(400).json({ status: 'error', message: 'name required' });
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO sales_channels (id, tenant_id, name, platform, status, config, credentials_ref, auto_sync)
       VALUES (?,?,?,?,?,?,?,?)`,
      [id, tid(req), b.name, b.platform || 'custom', b.status || 'disconnected',
       b.config ? JSON.stringify(b.config) : null, b.credentials_ref ?? null, b.auto_sync ? 1 : 0]
    );
    res.status(201).json({ status: 'success', data: { id } });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

router.put('/channels/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const sets = [], vals = [];
    ['name', 'platform', 'status', 'credentials_ref', 'auto_sync', 'last_error'].forEach((f) => {
      if (b[f] !== undefined) { sets.push(`${f} = ?`); vals.push(f === 'auto_sync' ? (b[f] ? 1 : 0) : b[f]); }
    });
    if (b.config !== undefined) { sets.push('config = ?'); vals.push(JSON.stringify(b.config)); }
    if (!sets.length) return res.status(400).json({ status: 'error', message: 'no fields to update' });
    vals.push(req.params.id, tid(req));
    await pool.execute(`UPDATE sales_channels SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, vals);
    res.json({ status: 'success' });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

router.get('/channels/:id/products', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT l.*, p.name, p.sku, p.price, p.stock_quantity
         FROM channel_product_links l
         JOIN products p ON p.id = l.product_id
        WHERE l.tenant_id = ? AND l.channel_id = ?
        ORDER BY p.name`,
      [tid(req), req.params.id]
    );
    res.json({ status: 'success', data: rows });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

router.post('/channels/:id/publish', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const productIds = Array.isArray(req.body?.product_ids) ? req.body.product_ids : [];
    const publish = req.body?.publish !== false;
    if (!productIds.length) { await conn.rollback(); return res.status(400).json({ status: 'error', message: 'product_ids required' }); }

    for (const pid of productIds) {
      await conn.query(
        `INSERT INTO channel_product_links (id, tenant_id, channel_id, product_id, is_published, sync_status)
         VALUES (?,?,?,?,?, 'pending')
         ON DUPLICATE KEY UPDATE is_published = VALUES(is_published), sync_status = 'pending'`,
        [uuidv4(), tid(req), req.params.id, pid, publish ? 1 : 0]
      );
      await conn.query(
        `INSERT INTO channel_sync_queue (id, tenant_id, channel_id, entity_type, entity_id, action, status)
         VALUES (?,?,?, 'product', ?, ?, 'queued')`,
        [uuidv4(), tid(req), req.params.id, pid, publish ? 'upsert' : 'delete']
      );
    }
    await conn.commit();
    res.json({ status: 'success', data: { queued: productIds.length, publish } });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ status: 'error', message: e.message });
  } finally { conn.release(); }
});

// ---- normalized feed (any platform can map from this) ----
router.get('/feed', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT p.id, p.name, p.description, p.sku, p.barcode, p.price, p.stock_quantity,
              p.image_url, p.is_active, p.attributes, c.name AS category
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.tenant_id = ? AND p.is_active = 1
        ORDER BY p.name`,
      [tid(req)]
    );

    const feed = rows.map((r) => ({
      id: r.id,
      title: r.name,
      description: r.description || '',
      sku: r.sku || '',
      barcode: r.barcode || '',
      price: Number(r.price),
      availability: Number(r.stock_quantity) > 0 ? 'in stock' : 'out of stock',
      quantity: Number(r.stock_quantity) || 0,
      category: r.category || '',
      image: r.image_url || '',
      attributes: typeof r.attributes === 'string' ? JSON.parse(r.attributes || 'null') : (r.attributes || null),
    }));

    if (String(req.query.format).toLowerCase() === 'csv') {
      const cols = ['id', 'title', 'description', 'sku', 'barcode', 'price', 'availability', 'quantity', 'category', 'image'];
      const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [cols.join(','), ...feed.map((f) => cols.map((c) => esc(f[c])).join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="catalog-feed.csv"');
      return res.send(csv);
    }

    res.json({ status: 'success', data: feed, count: feed.length });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// ---- outbox ----
router.get('/queue', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM channel_sync_queue
        WHERE tenant_id = ? AND status IN ('queued','processing')
        ORDER BY created_at LIMIT 200`,
      [tid(req)]
    );
    res.json({ status: 'success', data: rows });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

router.post('/queue/:id/complete', async (req, res) => {
  try {
    const ok = req.body?.success !== false;
    await pool.execute(
      `UPDATE channel_sync_queue
          SET status = ?, last_error = ?, attempts = attempts + 1, processed_at = NOW()
        WHERE id = ? AND tenant_id = ?`,
      [ok ? 'done' : 'failed', ok ? null : (req.body?.error || 'unknown error'), req.params.id, tid(req)]
    );
    if (ok && req.body?.external_id && req.body?.product_id && req.body?.channel_id) {
      await pool.execute(
        `UPDATE channel_product_links
            SET external_id = ?, sync_status = 'synced', last_synced_at = NOW(), last_error = NULL
          WHERE tenant_id = ? AND channel_id = ? AND product_id = ?`,
        [req.body.external_id, tid(req), req.body.channel_id, req.body.product_id]
      );
    }
    res.json({ status: 'success' });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

module.exports = router;
