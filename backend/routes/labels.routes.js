/**
 * Label / tag printing routes
 * Base path: /api/labels   (mounted in routes/index.js)
 *
 *   POST /print            print one label (piece or product)
 *   POST /print/bulk       print labels for multiple piece IDs
 *   GET  /settings         get label-printer settings for a store
 *   PUT  /settings         save label-printer settings for a store
 *   POST /test             send a test label to the configured printer
 */

'use strict';

const express  = require('express');
const router   = express.Router();
const { pool } = require('../config/db');
const { authenticate, requireTenantId } = require('../middleware/unifiedAuthMiddleware');
const { printRateLimit } = require('../middleware/rateLimitMiddleware');
const labelSvc = require('../services/labelPrintService');
const printerDeviceService = require('../services/printerDeviceService');

const tid   = (req) => req.user?.tenant_id || req.headers['x-tenant-id'];
const sid   = (req) => req.user?.store_id  || req.headers['x-store-id'];

router.use(authenticate);
router.use(requireTenantId);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getLabelSettings(tenantId, storeId) {
  const [rows] = await pool.execute(
    `SELECT label_printer_type, label_printer_address, label_paper_width_mm, label_paper_height_mm,
            header AS store_name
       FROM printer_settings
      WHERE tenant_id = ? AND store_id = ?
      LIMIT 1`,
    [tenantId, storeId]
  );
  return rows[0] || null;
}

// ---------------------------------------------------------------------------
// GET /api/labels/settings
// ---------------------------------------------------------------------------
router.get('/settings', async (req, res) => {
  try {
    const s = await getLabelSettings(tid(req), req.query.store_id || sid(req));
    res.json({
      status: 'success',
      data: s || {
        label_printer_type: 'none',
        label_printer_address: null,
        label_paper_width_mm: 50,
        label_paper_height_mm: 25,
      },
    });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// ---------------------------------------------------------------------------
// PUT /api/labels/settings
// ---------------------------------------------------------------------------
router.put('/settings', async (req, res) => {
  try {
    const { store_id, label_printer_type, label_printer_address, label_paper_width_mm, label_paper_height_mm } = req.body || {};
    const storeId = store_id || sid(req);

    // SECURITY: Validate printer address if provided and type is network
    let validatedAddress = label_printer_address;
    if (label_printer_type && label_printer_type !== 'none' && label_printer_type !== 'browser' && label_printer_address) {
      try {
        printerDeviceService.validatePrinterAddress(label_printer_address);
      } catch (err) {
        return res.status(400).json({ status: 'error', message: `Invalid printer address: ${err.message}` });
      }
    }

    await pool.execute(
      `UPDATE printer_settings
          SET label_printer_type      = ?,
              label_printer_address   = ?,
              label_paper_width_mm    = ?,
              label_paper_height_mm   = ?,
              updated_at              = NOW()
        WHERE tenant_id = ? AND store_id = ?`,
      [
        label_printer_type    || 'none',
        validatedAddress || null,
        label_paper_width_mm  || 50,
        label_paper_height_mm || 25,
        tid(req), storeId,
      ]
    );
    res.json({ status: 'success' });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// ---------------------------------------------------------------------------
// POST /api/labels/print
// Print a single label for a piece_id or a freeform item object
// ---------------------------------------------------------------------------
router.post('/print', printRateLimit, async (req, res) => {
  try {
    const { piece_id, item: rawItem, store_id } = req.body || {};
    const storeId = store_id || sid(req);

    // Load label settings
    const cfg = await getLabelSettings(tid(req), storeId);
    if (!cfg || cfg.label_printer_type === 'none') {
      return res.status(400).json({ status: 'error', message: 'Label printer not configured. Set it in Settings → Printers.' });
    }

    // Resolve piece data if only piece_id provided
    let item = rawItem;
    if (!item && piece_id) {
      const [[piece]] = await pool.query(
        `SELECT pp.*, p.name, p.name AS product_name
           FROM product_pieces pp
           JOIN products p ON p.id = pp.product_id
          WHERE pp.id = ? AND pp.tenant_id = ?`,
        [piece_id, tid(req)]
      );
      if (!piece) return res.status(404).json({ status: 'error', message: 'Piece not found' });
      item = piece;
    }
    if (!item) return res.status(400).json({ status: 'error', message: 'piece_id or item required' });

    const result = await labelSvc.printLabel({
      driver:   cfg.label_printer_type,
      address:  cfg.label_printer_address,
      item,
      settings: {
        widthMm:   cfg.label_paper_width_mm,
        heightMm:  cfg.label_paper_height_mm,
        storeName: cfg.store_name,
      },
    });

    if (result.html) {
      // Browser driver — return HTML for frontend window.print()
      return res.json({ status: 'success', driver: 'browser', html: result.html });
    }
    res.json({ status: 'success', driver: cfg.label_printer_type });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// ---------------------------------------------------------------------------
// POST /api/labels/print/bulk
// Body: { piece_ids: [...], store_id? }
// ---------------------------------------------------------------------------
router.post('/print/bulk', printRateLimit, async (req, res) => {
  try {
    const { piece_ids = [], store_id } = req.body || {};
    if (!piece_ids.length) return res.status(400).json({ status: 'error', message: 'piece_ids required' });
    const storeId = store_id || sid(req);

    const cfg = await getLabelSettings(tid(req), storeId);
    if (!cfg || cfg.label_printer_type === 'none') {
      return res.status(400).json({ status: 'error', message: 'Label printer not configured.' });
    }

    const placeholders = piece_ids.map(() => '?').join(',');
    const [pieces] = await pool.execute(
      `SELECT pp.*, p.name, p.name AS product_name
         FROM product_pieces pp
         JOIN products p ON p.id = pp.product_id
        WHERE pp.id IN (${placeholders}) AND pp.tenant_id = ?`,
      [...piece_ids, tid(req)]
    );

    const htmlPages = [];
    for (const piece of pieces) {
      const result = await labelSvc.printLabel({
        driver:   cfg.label_printer_type,
        address:  cfg.label_printer_address,
        item:     piece,
        settings: {
          widthMm:   cfg.label_paper_width_mm,
          heightMm:  cfg.label_paper_height_mm,
          storeName: cfg.store_name,
        },
      });
      if (result.html) htmlPages.push(result.html);
    }

    if (htmlPages.length) {
      // Return combined HTML pages for browser printing
      return res.json({ status: 'success', driver: 'browser', html: htmlPages.join('<div style="page-break-after:always"></div>'), count: htmlPages.length });
    }
    res.json({ status: 'success', driver: cfg.label_printer_type, count: pieces.length });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// ---------------------------------------------------------------------------
// POST /api/labels/test
// Sends a test label to verify printer connectivity
// ---------------------------------------------------------------------------
router.post('/test', async (req, res) => {
  try {
    const { store_id } = req.body || {};
    const cfg = await getLabelSettings(tid(req), store_id || sid(req));
    if (!cfg || cfg.label_printer_type === 'none') {
      return res.status(400).json({ status: 'error', message: 'Label printer not configured.' });
    }
    const testItem = {
      piece_code: 'PC-000001',
      name: 'Test Label',
      purity: '22KT',
      net_weight: 5.25,
      selling_price: 29999,
      barcode: 'PC-000001',
    };
    const result = await labelSvc.printLabel({
      driver:   cfg.label_printer_type,
      address:  cfg.label_printer_address,
      item:     testItem,
      settings: { widthMm: cfg.label_paper_width_mm, heightMm: cfg.label_paper_height_mm, storeName: cfg.store_name },
    });
    if (result.html) return res.json({ status: 'success', driver: 'browser', html: result.html });
    res.json({ status: 'success', message: 'Test label sent' });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

module.exports = router;
