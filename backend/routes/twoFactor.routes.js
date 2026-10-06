/**
 * TOTP two-factor auth routes — /api/users/me/2fa
 * All `authenticate`-gated, self-service only (own row).
 *
 *   POST /setup     generate a new TOTP secret (NOT persisted yet)
 *   POST /confirm    verify a code against a client-echoed secret, persist + issue backup codes
 *   POST /disable    re-verify password, then disable
 *   GET  /status     { enabled }
 *
 * KNOWN LIMITATION: users.totp_secret is stored plaintext — see the migration
 * header (2026-09-03_two_factor_auth.sql) for detail; no app-level
 * encryption-at-rest helper exists in this backend today.
 */

'use strict';

const express = require('express');
const router = express.Router();
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/unifiedAuthMiddleware');
const { logActivity } = require('../services/auditLogService');

router.use(authenticate);

const ISSUER = 'Zettaz Cloud POS';

function generateBackupCode() {
  // Random 8-char alphanumeric, uppercase for easy manual entry, grouped for readability.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

// POST /api/users/me/2fa/setup
router.post('/setup', async (req, res) => {
  try {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(req.user.email, ISSUER, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    res.json({ status: 'success', data: { secret, qrCodeDataUrl, otpauthUrl } });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /api/users/me/2fa/confirm  { secret, code }
router.post('/confirm', async (req, res) => {
  try {
    const { secret, code } = req.body || {};
    if (!secret || !code) {
      return res.status(400).json({ status: 'error', message: 'secret and code are required' });
    }

    const isValid = authenticator.verify({ token: String(code), secret });
    if (!isValid) {
      return res.status(400).json({ status: 'error', message: 'Invalid verification code' });
    }

    const userId = req.user.id;

    // Persist secret + enable, and (re)generate backup codes — only on success.
    await pool.query('UPDATE users SET totp_secret = ?, totp_enabled = 1 WHERE id = ?', [secret, userId]);
    await pool.query('DELETE FROM user_backup_codes WHERE user_id = ?', [userId]);

    const plaintextCodes = [];
    for (let i = 0; i < 10; i++) {
      const plain = generateBackupCode();
      plaintextCodes.push(plain);
      const hash = await bcrypt.hash(plain, 10);
      await pool.query(
        'INSERT INTO user_backup_codes (id, user_id, code_hash, created_at) VALUES (?, ?, ?, NOW())',
        [uuidv4(), userId, hash]
      );
    }

    try {
      await logActivity({
        tenant_id: req.user.tenant_id,
        user_id: userId,
        action: '2FA_ENABLED',
        entity_type: 'user',
        entity_id: userId,
      });
    } catch (auditErr) {
      console.error('[2FA] Failed to write audit log for 2FA_ENABLED:', auditErr.message);
    }

    // Backup codes are returned PLAINTEXT exactly once — the DB only ever
    // stores their bcrypt hashes from this point on.
    res.json({ status: 'success', data: { enabled: true, backupCodes: plaintextCodes } });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /api/users/me/2fa/disable  { password }
router.post('/disable', async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ status: 'error', message: 'password is required' });
    }

    const userId = req.user.id;
    const [[row]] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [userId]);
    if (!row) return res.status(404).json({ status: 'error', message: 'User not found' });

    const isValid = await bcrypt.compare(password, row.password_hash);
    if (!isValid) {
      return res.status(401).json({ status: 'error', message: 'Incorrect password' });
    }

    await pool.query('UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?', [userId]);
    await pool.query('DELETE FROM user_backup_codes WHERE user_id = ?', [userId]);

    try {
      await logActivity({
        tenant_id: req.user.tenant_id,
        user_id: userId,
        action: '2FA_DISABLED',
        entity_type: 'user',
        entity_id: userId,
      });
    } catch (auditErr) {
      console.error('[2FA] Failed to write audit log for 2FA_DISABLED:', auditErr.message);
    }

    res.json({ status: 'success', data: { enabled: false } });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /api/users/me/2fa/status
router.get('/status', async (req, res) => {
  try {
    const [[row]] = await pool.query('SELECT totp_enabled FROM users WHERE id = ?', [req.user.id]);
    res.json({ status: 'success', data: { enabled: Boolean(row?.totp_enabled) } });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

module.exports = router;
