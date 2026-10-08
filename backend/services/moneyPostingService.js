'use strict';

/**
 * moneyPostingService — double-entry ledger posting for money movement.
 *
 * One posting API for every business event: postEntry() writes a balanced
 * money_journal_entries row + its money_journal_lines legs inside the
 * CALLER's transaction (pass `conn`), or opens its own when called without
 * one. Invariants enforced here, once:
 *
 *   - >= 2 lines, each line has exactly one of debit/credit > 0
 *   - sum(debits) === sum(credits) to the cent
 *   - every account belongs to the tenant and is active
 *   - (tenant_id, source_type, source_id) is UNIQUE — posting the same
 *     source event twice throws ER_DUP_ENTRY, so hooks are idempotent
 *
 * Voids are never updates/deletes: reverseEntry() posts a mirror entry with
 * reversal_of_id pointing back, and flips the original to 'voided'.
 *
 * Account resolution is mapping-driven: callers pass account codes
 * ('CASH', 'AP', …) or a mapping key ('tender:cash', 'event:revenue') via
 * resolveAccountId(). Mappings live in finance_account_mappings and are
 * tenant-editable; DEFAULT_* below mirror the 2026-10-12a migration seed
 * and are also inserted lazily by ensureDefaults() for new tenants.
 */

const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');

/** Accounts with a debit-normal balance: balance = Σdebit − Σcredit. */
const DEBIT_NORMAL_TYPES = new Set(['asset', 'expense']);

const DEFAULT_ACCOUNTS = [
  ['CASH',      'Cash in Hand',                          'asset',     'cash'],
  ['BANK',      'Bank — Main',                           'asset',     'bank'],
  ['SAFE',      'Store Safe',                            'asset',     'safe'],
  ['CARDCLR',   'Card Clearing',                         'asset',     'card_clearing'],
  ['AR',        'Accounts Receivable',                   'asset',     'receivable'],
  ['AP',        'Accounts Payable',                      'liability', 'payable'],
  ['TAXPAY',    'Tax Payable',                           'liability', 'tax_payable'],
  ['LAYDEF',    'Deferred Revenue — Layaways',           'liability', 'deferred_revenue'],
  ['SAVDEF',    'Deferred Revenue — Savings Schemes',    'liability', 'deferred_revenue'],
  ['SALES',     'Sales Revenue',                         'revenue',   'sales'],
  ['SALESRET',  'Sales Returns & Refunds',               'revenue',   'sales_returns'],
  ['PURCH',     'Purchases',                             'expense',   'purchases'],
  ['OPEXP',     'Operating Expenses',                    'expense',   'operating'],
  ['OVERSHORT', 'Cash Over/Short',                       'expense',   'cash_over_short'],
  ['EQUITY',    "Owner's Equity",                        'equity',    'opening_balance'],
];

const DEFAULT_MAPPINGS = [
  ['tender:cash',           'CASH'],
  ['tender:card',           'CARDCLR'],
  ['tender:phone',          'CARDCLR'],
  ['tender:stripe',         'CARDCLR'],
  ['tender:paypal',         'CARDCLR'],
  ['tender:bank_transfer',  'BANK'],
  ['tender:on_account',     'AR'],
  ['event:revenue',         'SALES'],
  ['event:returns',         'SALESRET'],
  ['event:tax',             'TAXPAY'],
  ['event:payable',         'AP'],
  ['event:receivable',      'AR'],
  ['event:purchases',       'PURCH'],
  ['event:expense',         'OPEXP'],
  ['event:layaway_liability', 'LAYDEF'],
  ['event:savings_liability', 'SAVDEF'],
  ['event:over_short',      'OVERSHORT'],
  ['event:equity',          'EQUITY'],
  ['event:default_out',     'BANK'],
  ['event:default_in',      'CASH'],
];

const round2 = (n) => Math.round(Number(n) * 100) / 100;

/**
 * Pure validation — throws Error with a clear message on violation.
 * @returns {{totalDebit:number,totalCredit:number}}
 */
function validateLines(lines) {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new Error('A journal entry needs at least 2 lines');
  }
  let totalDebit = 0;
  let totalCredit = 0;
  lines.forEach((l, i) => {
    const rawDebit = Number(l.debit) || 0;
    const rawCredit = Number(l.credit) || 0;
    if (rawDebit < 0 || rawCredit < 0) {
      throw new Error(`Line ${i + 1}: amounts cannot be negative`);
    }
    // Round each leg to cents — that is what gets stored, so balance is
    // judged on stored values, not float noise.
    const debit = round2(rawDebit);
    const credit = round2(rawCredit);
    if ((debit > 0) === (credit > 0)) {
      throw new Error(`Line ${i + 1}: exactly one of debit/credit must be > 0`);
    }
    if (!l.accountId && !l.accountCode) {
      throw new Error(`Line ${i + 1}: accountId or accountCode is required`);
    }
    l.debit = debit;
    l.credit = credit;
    totalDebit += debit;
    totalCredit += credit;
  });
  totalDebit = round2(totalDebit);
  totalCredit = round2(totalCredit);
  if (totalDebit !== totalCredit) {
    throw new Error(`Entry not balanced: debits ${totalDebit} ≠ credits ${totalCredit}`);
  }
  return { totalDebit, totalCredit };
}

/** Build reversal lines (swap debit/credit) for an entry's line rows. */
function buildReversalLines(lines) {
  return lines.map((l) => ({
    accountId: l.account_id,
    debit: l.credit,
    credit: l.debit,
    memo: l.memo,
    customerId: l.customer_id,
    supplierId: l.supplier_id,
  }));
}

/** Idempotently seed the system accounts + mappings for a tenant. */
async function ensureDefaults(tenantId, conn = pool) {
  for (const [code, name, type, subtype] of DEFAULT_ACCOUNTS) {
    await conn.query(
      `INSERT IGNORE INTO money_accounts
         (id, tenant_id, store_id, code, name, account_type, subtype, is_system, is_active)
       VALUES (?, ?, NULL, ?, ?, ?, ?, 1, 1)`,
      [uuidv4(), tenantId, code, name, type, subtype]
    );
  }
  const [accts] = await conn.query(
    'SELECT id, code FROM money_accounts WHERE tenant_id = ?', [tenantId]
  );
  const idByCode = Object.fromEntries(accts.map((a) => [a.code, a.id]));
  for (const [key, code] of DEFAULT_MAPPINGS) {
    if (!idByCode[code]) continue;
    await conn.query(
      'INSERT IGNORE INTO finance_account_mappings (id, tenant_id, mapping_key, account_id) VALUES (?, ?, ?, ?)',
      [uuidv4(), tenantId, key, idByCode[code]]
    );
  }
  return idByCode;
}

/**
 * Resolve a posting target for a tenant. Order: explicit mapping row →
 * account code (when the key looks like one) → ensureDefaults + retry → null.
 */
async function resolveAccountId(tenantId, mappingKey, conn = pool) {
  const [rows] = await conn.query(
    'SELECT account_id FROM finance_account_mappings WHERE tenant_id = ? AND mapping_key = ?',
    [tenantId, mappingKey]
  );
  if (rows.length) return rows[0].account_id;

  // A key may itself be a system code (e.g. callers passing 'CASH').
  const [byCode] = await conn.query(
    'SELECT id FROM money_accounts WHERE tenant_id = ? AND code = ? AND is_active = 1',
    [tenantId, mappingKey]
  );
  if (byCode.length) return byCode[0].id;

  // Tenant might predate the seed — provision, then retry once.
  await ensureDefaults(tenantId, conn);
  const [retry] = await conn.query(
    'SELECT account_id FROM finance_account_mappings WHERE tenant_id = ? AND mapping_key = ?',
    [tenantId, mappingKey]
  );
  return retry.length ? retry[0].account_id : null;
}

async function nextEntryNumber(conn, tenantId, year) {
  const [rows] = await conn.query(
    `SELECT MAX(CAST(SUBSTRING_INDEX(entry_number, '-', -1) AS UNSIGNED)) AS maxSeq
       FROM money_journal_entries
      WHERE tenant_id = ? AND entry_number LIKE ?`,
    [tenantId, `JE-${year}-%`]
  );
  return `JE-${year}-${String((rows[0].maxSeq || 0) + 1).padStart(6, '0')}`;
}

async function insertEntry(conn, input, lines) {
  const entryId = uuidv4();
  const entryDate = input.entryDate || new Date().toISOString().slice(0, 10);
  const entryNumber = await nextEntryNumber(conn, input.tenantId, Number(entryDate.slice(0, 4)));

  await conn.query(
    `INSERT INTO money_journal_entries
       (id, tenant_id, store_id, entry_number, entry_date, source_type, source_id, memo, status, reversal_of_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'posted', ?, ?)`,
    [
      entryId, input.tenantId, input.storeId || null, entryNumber, entryDate,
      input.sourceType || 'manual', input.sourceId || null,
      input.memo || null, input.reversalOfId || null, input.createdBy || null,
    ]
  );

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    await conn.query(
      `INSERT INTO money_journal_lines
         (id, tenant_id, entry_id, line_no, account_id, debit, credit, memo, customer_id, supplier_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(), input.tenantId, entryId, i + 1, l.accountId,
        round2(l.debit) || 0, round2(l.credit) || 0,
        l.memo || null, l.customerId || null, l.supplierId || null,
      ]
    );
  }
  return { entryId, entryNumber };
}

/** Resolve accountCodes to ids + verify account ownership/activity. */
async function resolveLines(conn, tenantId, lines) {
  const codes = [...new Set(lines.filter((l) => !l.accountId && l.accountCode).map((l) => l.accountCode))];
  let codeMap = {};
  if (codes.length) {
    const [accts] = await conn.query(
      `SELECT id, code FROM money_accounts WHERE tenant_id = ? AND code IN (${codes.map(() => '?').join(',')})`,
      [tenantId, ...codes]
    );
    codeMap = Object.fromEntries(accts.map((a) => [a.code, a.id]));
  }
  const resolved = lines.map((l) => ({ ...l, accountId: l.accountId || codeMap[l.accountCode] }));
  const missing = resolved.filter((l) => !l.accountId);
  if (missing.length) {
    throw new Error(`Unknown account code(s): ${missing.map((l) => l.accountCode).join(', ')}`);
  }
  const ids = [...new Set(resolved.map((l) => l.accountId))];
  const [valid] = await conn.query(
    `SELECT id FROM money_accounts WHERE tenant_id = ? AND is_active = 1 AND id IN (${ids.map(() => '?').join(',')})`,
    [tenantId, ...ids]
  );
  if (valid.length !== ids.length) {
    throw new Error('One or more accounts are inactive or do not belong to this tenant');
  }
  return resolved;
}

/**
 * Post a balanced journal entry.
 *
 * @param {object} input
 *   tenantId, storeId?, entryDate? ('YYYY-MM-DD'), sourceType, sourceId?,
 *   memo?, createdBy?, reversalOfId?,
 *   lines: [{ accountId|accountCode, debit?, credit?, memo?, customerId?, supplierId? }]
 * @param {object} [conn] pooled transaction connection — pass the caller's
 *   transaction so the entry commits/rolls back with the business write.
 *   Omit to run in its own transaction.
 */
async function postEntry(input, conn) {
  validateLines(input.lines); // throws on violation; rounds each leg to cents
  if (!input.tenantId) throw new Error('tenantId is required');

  if (conn) {
    const resolved = await resolveLines(conn, input.tenantId, input.lines);
    return insertEntry(conn, input, resolved);
  }
  const own = await pool.getConnection();
  try {
    await own.beginTransaction();
    const resolved = await resolveLines(own, input.tenantId, input.lines);
    const result = await insertEntry(own, input, resolved);
    await own.commit();
    return result;
  } catch (err) {
    await own.rollback().catch(() => {});
    throw err;
  } finally {
    own.release();
  }
}

/**
 * Void a posted entry by posting its mirror image. The original is marked
 * 'voided' but kept for audit; the reversal entry links back via
 * reversal_of_id.
 */
async function reverseEntry(entryId, { tenantId, memo, createdBy } = {}, conn) {
  const run = async (c) => {
    const [entries] = await c.query(
      `SELECT * FROM money_journal_entries
        WHERE id = ? AND tenant_id = ? FOR UPDATE`,
      [entryId, tenantId]
    );
    if (!entries.length) throw new Error('Journal entry not found');
    const entry = entries[0];
    if (entry.status !== 'posted') throw new Error('Entry is already voided');

    const [lines] = await c.query(
      'SELECT * FROM money_journal_lines WHERE entry_id = ?', [entryId]
    );
    const reversalLines = buildReversalLines(lines);
    validateLines(reversalLines);

    const result = await insertEntry(c, {
      tenantId: entry.tenant_id,
      storeId: entry.store_id,
      entryDate: new Date().toISOString().slice(0, 10),
      sourceType: entry.source_type,
      sourceId: null, // unique index ties source to the ORIGINAL entry
      memo: memo || `Reversal of ${entry.entry_number || entry.id}`,
      createdBy,
      reversalOfId: entry.id,
    }, reversalLines);

    await c.query(
      `UPDATE money_journal_entries SET status = 'voided' WHERE id = ? AND tenant_id = ?`,
      [entryId, tenantId]
    );
    return result;
  };

  if (conn) return run(conn);
  const own = await pool.getConnection();
  try {
    await own.beginTransaction();
    const result = await run(own);
    await own.commit();
    return result;
  } catch (err) {
    await own.rollback().catch(() => {});
    throw err;
  } finally {
    own.release();
  }
}

/**
 * Per-account signed balances: (debit − credit) totals + opening.
 * Callers interpret the sign via account_type (asset/expense are
 * debit-normal; liability/equity/revenue are credit-normal).
 *
 * Counts EVERY line, including voided originals: a voided entry is always
 * paired with a posted reversal, so including both is what nets them to
 * zero — excluding the original while counting the reversal would
 * double-subtract the money.
 */
async function accountBalances(tenantId, { storeId } = {}) {
  const params = [tenantId];
  let acctWhere = 'a.tenant_id = ?';
  if (storeId) { acctWhere += ' AND (a.store_id = ? OR a.store_id IS NULL)'; params.push(storeId); }
  const [rows] = await pool.query(
    `SELECT a.id, a.code, a.name, a.account_type, a.subtype, a.store_id,
            a.opening_balance, a.is_system, a.is_active,
            COALESCE(SUM(l.debit), 0)  AS total_debit,
            COALESCE(SUM(l.credit), 0) AS total_credit
       FROM money_accounts a
       LEFT JOIN money_journal_lines l
              ON l.account_id = a.id
             AND l.tenant_id = a.tenant_id
      WHERE ${acctWhere}
      GROUP BY a.id
      ORDER BY a.account_type, a.code`,
    params
  );
  return rows.map((r) => {
    const signed = round2(Number(r.total_debit) - Number(r.total_credit));
    const debitNormal = DEBIT_NORMAL_TYPES.has(r.account_type);
    const balance = debitNormal ? signed : -signed;
    return { ...r, balance: round2(Number(r.opening_balance) + balance), debit_normal: debitNormal };
  });
}

module.exports = {
  DEBIT_NORMAL_TYPES,
  DEFAULT_ACCOUNTS,
  DEFAULT_MAPPINGS,
  validateLines,
  buildReversalLines,
  ensureDefaults,
  resolveAccountId,
  postEntry,
  reverseEntry,
  accountBalances,
};
