/**
 * userSessionService
 * -----------------------------------------------------------------------------
 * Shared helper for creating a `user_sessions` row and deriving a best-effort
 * device label from a User-Agent string. Used by both the normal login path
 * (backend/middleware/unifiedAuthMiddleware.js `login`) and the 2FA
 * pending-token verify path (backend/routes/authRoutes.js `POST
 * /api/auth/2fa/verify`) so both create sessions identically — see part C/D
 * of the session brief this module was built from.
 * -----------------------------------------------------------------------------
 */

'use strict';

const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');

/**
 * Tiny best-effort UA sniffer — no new npm dependency. Not exhaustive; good
 * enough for a human-readable "Chrome on macOS" style label in a sessions list.
 */
function deriveDeviceLabel(userAgent) {
  if (!userAgent || typeof userAgent !== 'string') return null;

  let browser = 'Unknown browser';
  if (/edg\//i.test(userAgent)) browser = 'Edge';
  else if (/opr\//i.test(userAgent) || /opera/i.test(userAgent)) browser = 'Opera';
  else if (/chrome\//i.test(userAgent) && !/chromium/i.test(userAgent)) browser = 'Chrome';
  else if (/crios\//i.test(userAgent)) browser = 'Chrome';
  else if (/firefox\//i.test(userAgent) || /fxios\//i.test(userAgent)) browser = 'Firefox';
  else if (/safari\//i.test(userAgent) && !/chrome\//i.test(userAgent)) browser = 'Safari';

  let os = 'Unknown OS';
  if (/windows/i.test(userAgent)) os = 'Windows';
  else if (/iphone|ipad|ipod/i.test(userAgent)) os = 'iOS';
  else if (/mac os x|macintosh/i.test(userAgent)) os = 'macOS';
  else if (/android/i.test(userAgent)) os = 'Android';
  else if (/linux/i.test(userAgent)) os = 'Linux';

  return `${browser} on ${os}`;
}

/** Best-effort client IP extraction, mirroring how the rest of the app reads it. */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || null;
}

/**
 * Creates a user_sessions row and returns its id (to be embedded as the JWT
 * `sid` claim by the caller). Never throws — session tracking is additive and
 * must never block a login; on failure it returns null and the caller should
 * simply omit `sid` from the token (which fail-opens correctly downstream).
 */
async function createSession(req, { userId, tenantId }) {
  try {
    const id = uuidv4();
    const userAgent = req.headers['user-agent'] || null;
    const ip = getClientIp(req);
    const deviceLabel = deriveDeviceLabel(userAgent);

    await pool.query(
      `INSERT INTO user_sessions (id, user_id, tenant_id, ip_address, user_agent, device_label, created_at, last_active_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, userId, tenantId || null, ip, userAgent, deviceLabel]
    );

    return id;
  } catch (err) {
    console.error('[userSessionService] Failed to create session row (login proceeds without sid):', err.message);
    return null;
  }
}

module.exports = {
  createSession,
  deriveDeviceLabel,
  getClientIp,
};
