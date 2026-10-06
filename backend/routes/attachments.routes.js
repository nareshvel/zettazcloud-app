/**
 * Attachments routes — /api/attachments
 * Certificates, photos and documents for any entity.
 *
 *   GET    /:entityType/:entityId    list attachments
 *   POST   /:entityType/:entityId    upload (multipart field: "file")
 *   DELETE /:id                      remove (also deletes the stored file)
 */

'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');
const { authenticate, requireTenantId } = require('../middleware/unifiedAuthMiddleware');
const storage = require('../services/storageService');
const storageUsageService = require('../services/storageUsageService');
const subscriptionService = require('../services/subscriptionService');
const { parseSizeToBytes, formatBytes } = require('../utils/storageSize');

const tid = (req) => req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'];
const uid = (req) => req.user?.id || null;

const ALLOWED_ENTITIES = ['product', 'product_piece', 'repair_order', 'customer', 'memo', 'layaway', 'store'];
const ALLOWED_MIME = /^(image\/(jpeg|png|webp|gif)|application\/pdf)$/;

// Buffer in memory then hand to the storage driver (keeps drivers swappable).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.test(file.mimetype)) {
      return cb(new Error('Only JPEG/PNG/WebP/GIF images and PDF files are allowed.'));
    }
    cb(null, true);
  },
});

router.use(authenticate);
router.use(requireTenantId);

router.get('/:entityType/:entityId', async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    if (!ALLOWED_ENTITIES.includes(entityType)) return res.status(400).json({ status: 'error', message: 'invalid entity type' });
    const [rows] = await pool.execute(
      'SELECT * FROM attachments WHERE tenant_id = ? AND entity_type = ? AND entity_id = ? ORDER BY created_at DESC',
      [tid(req), entityType, entityId]
    );
    res.json({ status: 'success', data: rows.map((r) => ({ ...r, url: storage.publicUrl(r.file_path) })) });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

router.post('/:entityType/:entityId', upload.single('file'), async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    if (!ALLOWED_ENTITIES.includes(entityType)) return res.status(400).json({ status: 'error', message: 'invalid entity type' });
    if (!req.file) return res.status(400).json({ status: 'error', message: 'file is required' });

    // Plan `limits.storage` enforcement — checked BEFORE writing (unlike the
    // disk-storage product/category uploads, this route buffers in memory
    // and hasn't written anything yet, so the file's own size can just be
    // added to current usage rather than needing a post-write rollback).
    const tenantId = tid(req);
    const subscription = req.subscription || await subscriptionService.getTenantSubscription(tenantId, { includePlan: true });
    const rawStorageLimit = subscription?.plan?.limits?.storage;
    if (rawStorageLimit !== undefined && rawStorageLimit !== null && rawStorageLimit !== -1) {
      const limitBytes = parseSizeToBytes(rawStorageLimit);
      if (!isNaN(limitBytes) && limitBytes !== -1) {
        const currentBytes = await storageUsageService.getTenantStorageBytes(tenantId);
        if (currentBytes + req.file.size > limitBytes) {
          return res.status(402).json({
            status: 'error',
            message: `You have reached the storage limit (${formatBytes(limitBytes)}) for your subscription plan. Please upgrade your plan or remove some files to free up space.`,
            currentUsage: formatBytes(currentBytes),
            limit: formatBytes(limitBytes),
            resourceType: 'storage',
          });
        }
      }
    }

    const key = storage.buildKey(tenantId, entityType, req.file.originalname);
    await storage.save(key, req.file.buffer);

    const id = uuidv4();
    await pool.execute(
      `INSERT INTO attachments
        (id, tenant_id, entity_type, entity_id, kind, label, reference_no, issuer,
         file_name, file_path, mime_type, size_bytes, storage_driver, uploaded_by_user_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, tid(req), entityType, entityId, req.body?.kind || 'document', req.body?.label ?? null,
       req.body?.reference_no ?? null, req.body?.issuer ?? null,
       req.file.originalname, key, req.file.mimetype, req.file.size, storage.driverName(), uid(req)]
    );

    res.status(201).json({ status: 'success', data: { id, url: storage.publicUrl(key), file_name: req.file.originalname } });
  } catch (e) { res.status(400).json({ status: 'error', message: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const [[row]] = await pool.query('SELECT * FROM attachments WHERE id = ? AND tenant_id = ?', [req.params.id, tid(req)]);
    if (!row) return res.status(404).json({ status: 'error', message: 'not found' });
    await storage.remove(row.file_path);
    await pool.execute('DELETE FROM attachments WHERE id = ? AND tenant_id = ?', [req.params.id, tid(req)]);
    res.json({ status: 'success' });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

module.exports = router;
