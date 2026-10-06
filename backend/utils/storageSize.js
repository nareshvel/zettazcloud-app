/**
 * storageSize
 * -----------------------------------------------------------------------------
 * Tiny helpers for the `storage` plan-limit feature. Seeded plans store their
 * storage cap as a human string (`'500MB'`, `'1GB'`, `'20GB'` — see
 * database/seeds/applied/2025-06-18_rbac_seed_data.sql and
 * 2026-08-31_starter_plan.sql), not a byte count, so anything that needs to
 * compare against it numerically (withinUsageLimits, getSubscriptionUsage)
 * must parse it first.
 */

'use strict';

const UNIT_MULTIPLIERS = {
  B: 1,
  KB: 1024,
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4,
};

/**
 * Parse a plan's `limits.storage` value into a byte count.
 * Accepts:
 *  - a plain number (already bytes) — returned as-is
 *  - a numeric string ('1048576') — parsed as bytes
 *  - a unit-suffixed string ('500MB', '1 GB', '20gb') — parsed + converted
 *  - -1, null, undefined — returned as-is (sentinel for "unlimited",
 *    handled by the caller, not this function)
 * Returns NaN if the value can't be parsed at all, so callers can fail open
 * rather than silently miscomparing.
 */
function parseSizeToBytes(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'number') return value;

  const str = String(value).trim();
  if (str === '-1') return -1;

  const match = str.match(/^([\d.]+)\s*([A-Za-z]*)$/);
  if (!match) return NaN;

  const amount = parseFloat(match[1]);
  if (isNaN(amount)) return NaN;

  const unit = (match[2] || 'B').toUpperCase();
  const multiplier = UNIT_MULTIPLIERS[unit];
  if (multiplier === undefined) return NaN;

  return Math.round(amount * multiplier);
}

/** Format a byte count back into a human-readable string for messages/UI. */
function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || isNaN(bytes)) return 'unknown';
  if (bytes < 0) return 'unlimited';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exp);
  return `${exp === 0 ? value : value.toFixed(value < 10 ? 2 : 1)} ${units[exp]}`;
}

module.exports = { parseSizeToBytes, formatBytes };
