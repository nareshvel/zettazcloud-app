/**
 * Notification preference routes — /api/users/me/notification-preferences
 * Self-service only (own row), `authenticate` only — mirrors userSessions.routes.js.
 *
 *   GET  /   read (auto-creates a default row on first read if none exists)
 *   PUT  /   partial update of the boolean toggles
 */

'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/unifiedAuthMiddleware');

router.use(authenticate);

const BOOLEAN_FIELDS = [
  'email_payment_failed',
  'email_trial_ending',
  'email_subscription_renewed',
  'email_low_stock',
  'email_new_sale_summary',
];

async function getOrCreate(userId, tenantId) {
  const [[existing]] = await pool.query('SELECT * FROM user_notification_preferences WHERE user_id = ?', [userId]);
  if (existing) return existing;

  const id = uuidv4();
  await pool.query(
    `INSERT INTO user_notification_preferences (id, user_id, tenant_id, created_at, updated_at)
     VALUES (?, ?, ?, NOW(), NOW())`,
    [id, userId, tenantId || null]
  );
  const [[created]] = await pool.query('SELECT * FROM user_notification_preferences WHERE id = ?', [id]);
  return created;
}

// GET /api/users/me/notification-preferences
router.get('/', async (req, res) => {
  try {
    const row = await getOrCreate(req.user.id, req.user.tenant_id);
    res.json({ status: 'success', data: row });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// PUT /api/users/me/notification-preferences — partial update
router.put('/', async (req, res) => {
  try {
    await getOrCreate(req.user.id, req.user.tenant_id); // ensure a row exists first

    const updates = [];
    const values = [];
    for (const field of BOOLEAN_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
        updates.push(`\`${field}\` = ?`);
        values.push(req.body[field] ? 1 : 0);
      }
    }

    if (updates.length > 0) {
      values.push(req.user.id);
      await pool.query(
        `UPDATE user_notification_preferences SET ${updates.join(', ')}, updated_at = NOW() WHERE user_id = ?`,
        values
      );
    }

    const [[row]] = await pool.query('SELECT * FROM user_notification_preferences WHERE user_id = ?', [req.user.id]);
    res.json({ status: 'success', data: row });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

module.exports = router;
