/**
 * Platform Jobs — scheduled platform-maintenance tasks.
 *
 * No cron dependency: a single setInterval ticker runs each job on its own
 * cadence, and every run is recorded in job_runs so the Health page can show
 * last-run status (paisepath pattern). Jobs are idempotent and safe to
 * re-run. Disable entirely with PLATFORM_JOBS_DISABLED=true (e.g. tests,
 * one-off scripts).
 */
'use strict';

const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');
const { PLATFORM_TENANT_ID } = require('./platformService');

const TICK_MS = 60 * 1000;          // scheduler tick
const initialState = () => ({ lastAttempt: 0, running: false });

// ---------------------------------------------------------------------------
// Job implementations
// ---------------------------------------------------------------------------

/**
 * Trials whose trial_end_date has passed become 'expired'. The global
 * subscription gate then blocks their API traffic (except billing) until a
 * paid subscription starts.
 */
const expireTrials = async () => {
  const [r] = await pool.query(
    `UPDATE subscriptions
        SET status = 'expired', updated_at = NOW()
      WHERE status = 'trial'
        AND trial_end_date IS NOT NULL
        AND trial_end_date < CURDATE()`
  );
  return `expired ${r.affectedRows || 0} trial subscription(s)`;
};

/**
 * Subscriptions in the payment-failure grace window whose grace has lapsed
 * are marked expired (Stripe may still recover the invoice; a subsequent
 * webhook flips status back to active).
 */
const runDunning = async () => {
  const [r] = await pool.query(
    `UPDATE subscriptions
        SET status = 'expired', updated_at = NOW()
      WHERE grace_period_ends_at IS NOT NULL
        AND grace_period_ends_at < NOW()
        AND status IN ('active', 'trial')`
  );
  return `expired ${r.affectedRows || 0} subscription(s) past grace`;
};

/**
 * Hard-delete tenants past their deletion_due_at. Deletes every row in every
 * table that has a tenant_id column matching the tenant, inside a transaction
 * with FK checks off (order-independent). The tenant row goes last.
 */
const processDeletions = async () => {
  const [doomed] = await pool.query(
    `SELECT id, name FROM tenants
      WHERE status = 'pending_deletion'
        AND deletion_due_at IS NOT NULL
        AND deletion_due_at < NOW()
        AND id <> ?`,
    [PLATFORM_TENANT_ID]
  );
  if (!doomed.length) return 'no tenants due for deletion';

  const [tables] = await pool.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'tenant_id'`
  );

  for (const t of doomed) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');
      for (const { TABLE_NAME } of tables) {
        if (TABLE_NAME === 'tenants') continue;
        await conn.query(`DELETE FROM \`${TABLE_NAME}\` WHERE tenant_id = ?`, [t.id]);
      }
      await conn.query('DELETE FROM tenants WHERE id = ?', [t.id]);
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
      await conn.commit();
      console.log(`[platformJobs] deleted tenant ${t.id} (${t.name})`);
    } catch (e) {
      try { await conn.query('SET FOREIGN_KEY_CHECKS = 1'); } catch (_) {}
      try { await conn.rollback(); } catch (_) {}
      throw new Error(`delete ${t.id}: ${e.message}`);
    } finally {
      conn.release();
    }
  }
  return `deleted ${doomed.length} tenant(s)`;
};

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const recordRun = async (jobName, fn) => {
  const runId = uuidv4();
  await pool.query(
    `INSERT INTO job_runs (id, job_name, started_at, status) VALUES (?, ?, NOW(), 'running')`,
    [runId, jobName]
  );
  try {
    const message = await fn();
    await pool.query(
      `UPDATE job_runs SET finished_at = NOW(), status = 'success', message = ? WHERE id = ?`,
      [String(message).slice(0, 1000), runId]
    );
    return { status: 'success', message };
  } catch (e) {
    await pool.query(
      `UPDATE job_runs SET finished_at = NOW(), status = 'failure', message = ? WHERE id = ?`,
      [String(e.message || e).slice(0, 1000), runId]
    ).catch(() => {});
    throw e;
  }
};

const JOBS = [
  { name: 'expire_trials',      intervalMs: 60 * 60 * 1000,      fn: expireTrials },
  { name: 'dunning',            intervalMs: 60 * 60 * 1000,      fn: runDunning },
  { name: 'process_deletions',  intervalMs: 6 * 60 * 60 * 1000,  fn: processDeletions },
];

const state = new Map(JOBS.map((j) => [j.name, initialState()]));
let timer = null;

const tick = async () => {
  const now = Date.now();
  for (const job of JOBS) {
    const s = state.get(job.name);
    if (s.running || now - s.lastAttempt < job.intervalMs) continue;
    s.running = true;
    s.lastAttempt = now;
    try {
      const result = await recordRun(job.name, job.fn);
      console.log(`[platformJobs] ${job.name}: ${result.message}`);
    } catch (e) {
      console.error(`[platformJobs] ${job.name} failed:`, e.message);
    } finally {
      s.running = false;
    }
  }
};

/** Start the scheduler. Called once from server.js after DB is ready. */
const start = () => {
  if (process.env.PLATFORM_JOBS_DISABLED === 'true' || timer) return;
  // First tick shortly after boot (let the DB settle), then every minute.
  setTimeout(() => tick().catch(() => {}), 30 * 1000);
  timer = setInterval(() => tick().catch(() => {}), TICK_MS);
  if (timer.unref) timer.unref();
  console.log('[platformJobs] scheduler started');
};

const stop = () => {
  if (timer) clearInterval(timer);
  timer = null;
};

module.exports = { start, stop, expireTrials, runDunning, processDeletions };
