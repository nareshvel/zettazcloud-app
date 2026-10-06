/**
 * Sequential document numbering.
 *
 * Issues gapless, per-scope document numbers such as `INV-2026-000417`.
 *
 * THE ONE RULE THAT MATTERS
 * -------------------------
 * `allocate()` takes a CONNECTION, not the pool. It must be given the same
 * connection that is inserting the sale, inside that transaction. That is what
 * makes the number and the sale atomic: both commit or neither does.
 *
 * Handing it a pool connection instead would allocate on a separate
 * transaction, and a sale that later rolled back would leave a burned number
 * and a gap in the sequence — the exact defect that made the old
 * duty_free_invoice_sequences implementation unusable, and the exact thing the
 * jurisdictions requiring sequential numbering prohibit.
 *
 * WHY NOT `UPDATE ... ; SELECT ...`
 * ---------------------------------
 * Two statements without a lock is a read-modify-write race: two tills can read
 * the same value and issue the same number. `SELECT ... FOR UPDATE` holds a row
 * lock for the rest of the transaction, so the second till waits.
 */

'use strict';

const { randomUUID } = require('crypto');
const { pool } = require('../config/db');
const jurisdictionService = require('./jurisdictionService');

/** Default width. `INV-2026-000417` reads better than `INV-2026-417`. */
const DEFAULT_PADDING = 6;

/**
 * The reset window a date falls in.
 *
 * Returned as a string because it is stored as one — it is a bucket label, not
 * a date, and treating it as a date invites timezone drift between the value
 * written and the value read back.
 */
function periodFor(reset, date = new Date()) {
  const y = date.getUTCFullYear();
  switch (reset) {
    case 'never': return 'ALL';
    case 'monthly': return `${y}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    case 'yearly':
    default: return String(y);
  }
}

/**
 * Is sequential numbering on for this store?
 *
 * Asymmetric by design: a store may opt IN, but may not opt OUT of something
 * its tax authority requires. A tenant checkbox that could disable a legal
 * obligation would be a compliance hazard dressed up as a preference.
 */
async function isEnabledFor(tenantId, storeId) {
  const jurisdiction = await jurisdictionService.getJurisdictionProfile(tenantId, storeId);
  if (jurisdiction.profile && jurisdiction.profile.requiresSequentialNumbering) {
    return { enabled: true, reason: 'required by jurisdiction', mandatory: true };
  }

  const [rows] = await pool.query(
    `SELECT sequential_numbering_optin AS optin
       FROM store_jurisdiction_settings
      WHERE store_id = ? AND tenant_id = ?
      LIMIT 1`,
    [storeId, tenantId],
  );

  return rows[0] && Number(rows[0].optin) === 1
    ? { enabled: true, reason: 'enabled by the store', mandatory: false }
    : { enabled: false, reason: 'not required and not enabled', mandatory: false };
}

/** Prefix and reset cadence for a store. */
async function settingsFor(conn, tenantId, storeId) {
  const [rows] = await conn.query(
    `SELECT invoice_number_prefix AS prefix, sequence_reset AS reset
       FROM store_jurisdiction_settings
      WHERE store_id = ? AND tenant_id = ?
      LIMIT 1`,
    [storeId, tenantId],
  );
  return {
    prefix: (rows[0] && rows[0].prefix) || null,
    reset: (rows[0] && rows[0].reset) || 'yearly',
  };
}

/**
 * Allocate the next number.
 *
 * @param {object} conn     Connection ALREADY inside the caller's transaction.
 * @param {object} opts
 * @param {string} opts.tenantId
 * @param {string} opts.storeId
 * @param {string} [opts.docType='sale']
 * @param {Date}   [opts.date]
 * @returns {Promise<string>} e.g. 'INV-2026-000417'
 */
async function allocate(conn, { tenantId, storeId, docType = 'sale', date = new Date() } = {}) {
  if (!conn || typeof conn.query !== 'function') {
    // Being handed the pool instead of a connection is the mistake that
    // silently reintroduces gaps, so it fails loudly rather than working
    // 99% of the time.
    throw new Error(
      'documentSequenceService.allocate requires the transaction connection, not the pool — '
      + 'allocating outside the sale transaction reintroduces sequence gaps',
    );
  }
  if (!tenantId || !storeId) throw new Error('allocate requires tenantId and storeId');

  const { prefix, reset } = await settingsFor(conn, tenantId, storeId);
  const period = periodFor(reset, date);

  // Create the counter if this is the first document in the window.
  //
  // INSERT IGNORE + the unique key handles the race: if two tills open a new
  // period simultaneously, one insert wins and the other is ignored. Both then
  // proceed to the locking SELECT below and serialise there.
  await conn.query(
    `INSERT IGNORE INTO document_sequences
       (id, tenant_id, store_id, doc_type, period, current_value, prefix, padding)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    [randomUUID(), tenantId, storeId, docType, period, prefix, DEFAULT_PADDING],
  );

  // The lock. Everything after this is serialised per scope until commit.
  const [rows] = await conn.query(
    `SELECT id, current_value, prefix, padding
       FROM document_sequences
      WHERE tenant_id = ? AND store_id = ? AND doc_type = ? AND period = ?
      FOR UPDATE`,
    [tenantId, storeId, docType, period],
  );

  if (!rows.length) {
    throw new Error(`Document sequence missing for ${tenantId}/${storeId}/${docType}/${period}`);
  }

  const row = rows[0];
  const next = Number(row.current_value) + 1;

  await conn.query(
    'UPDATE document_sequences SET current_value = ? WHERE id = ?',
    [next, row.id],
  );

  return format({ prefix: row.prefix, period, next, padding: row.padding });
}

/**
 * Assemble the printed number.
 *
 * The period is included so a number is self-describing on paper: an auditor
 * looking at `INV-2026-000417` can see which run it belongs to without
 * consulting the system. Omitted for non-resetting sequences, where it would be
 * a meaningless constant.
 */
function format({ prefix, period, next, padding = DEFAULT_PADDING }) {
  const body = String(next).padStart(padding, '0');
  const parts = [];
  if (prefix) parts.push(prefix);
  if (period && period !== 'ALL') parts.push(period);
  parts.push(body);
  return parts.join('-');
}

/**
 * Read a counter without consuming a number.
 * For settings screens that want to show "next number will be ...".
 */
async function peek(tenantId, storeId, docType = 'sale', date = new Date()) {
  const { prefix, reset } = await settingsFor(pool, tenantId, storeId);
  const period = periodFor(reset, date);

  const [rows] = await pool.query(
    `SELECT current_value, prefix, padding
       FROM document_sequences
      WHERE tenant_id = ? AND store_id = ? AND doc_type = ? AND period = ?
      LIMIT 1`,
    [tenantId, storeId, docType, period],
  );

  const row = rows[0];
  return {
    period,
    issued: row ? Number(row.current_value) : 0,
    nextNumber: format({
      prefix: row ? row.prefix : prefix,
      period,
      next: (row ? Number(row.current_value) : 0) + 1,
      padding: row ? row.padding : DEFAULT_PADDING,
    }),
  };
}

module.exports = {
  allocate,
  isEnabledFor,
  peek,
  periodFor,
  format,
  DEFAULT_PADDING,
};
