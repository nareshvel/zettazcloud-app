/**
 * Sessions / login-history routes — /api/users/me/sessions
 * All endpoints are ownership-scoped to req.user.id — a user can only ever
 * see/revoke their OWN sessions, never another user's, even within the same
 * tenant. `authenticate` only (no requireTenantId — a user's session list is
 * a fact about the user, not tenant-gated business data).
 *
 *   GET    /                 list current user's non-revoked sessions
 *   DELETE /:sessionId        revoke one (rejects revoking your own current session)
 *   POST   /revoke-others     revoke every OTHER non-revoked session for this user
 */

'use strict';

const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/unifiedAuthMiddleware');

router.use(authenticate);

// GET /api/users/me/sessions
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(
      `SELECT id, ip_address, user_agent, device_label, created_at, last_active_at
       FROM user_sessions
       WHERE user_id = ? AND revoked_at IS NULL
       ORDER BY last_active_at DESC`,
      [userId]
    );

    const data = rows.map((r) => ({ ...r, is_current: r.id === req.user.sid }));
    res.json({ status: 'success', data });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// DELETE /api/users/me/sessions/:sessionId
router.delete('/:sessionId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    if (sessionId === req.user.sid) {
      return res.status(400).json({
        status: 'error',
        message: 'You cannot revoke the session you are currently using. Log out instead.',
      });
    }

    const [[row]] = await pool.query(
      'SELECT id, user_id FROM user_sessions WHERE id = ? AND revoked_at IS NULL',
      [sessionId]
    );
    if (!row || row.user_id !== userId) {
      // Ownership check: never reveal whether a session exists for someone else.
      return res.status(404).json({ status: 'error', message: 'Session not found' });
    }

    await pool.query('UPDATE user_sessions SET revoked_at = NOW() WHERE id = ? AND user_id = ?', [sessionId, userId]);
    res.json({ status: 'success' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /api/users/me/sessions/revoke-others
router.post('/revoke-others', async (req, res) => {
  try {
    const userId = req.user.id;
    const currentSid = req.user.sid || null;

    const [result] = await pool.query(
      currentSid
        ? 'UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL AND id <> ?'
        : 'UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
      currentSid ? [userId, currentSid] : [userId]
    );

    res.json({ status: 'success', data: { revokedCount: result.affectedRows } });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

module.exports = router;
