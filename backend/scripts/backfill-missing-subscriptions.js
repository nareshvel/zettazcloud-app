#!/usr/bin/env node
/**
 * One-off backfill: give every EXISTING tenant a `subscriptions` row.
 *
 * WHY THIS SCRIPT EXISTS
 * -----------------------
 * The Stripe billing module (2026-08-31, see
 * docs/17-migration-and-roadmap/17_Stripe_Billing_Module.md) added
 * `requireActiveSubscription()` as a global route guard. New tenants get a
 * trial `subscriptions` row automatically at signup
 * (signupService.js's createTrialSubscription). Tenants created BEFORE this
 * module existed never got one — and the guard originally treated "no row"
 * as "blocked", which locked every pre-existing tenant out of the whole app
 * the moment the guard went live. The guard now fails OPEN on a missing row
 * (see subscriptionMiddleware.js's comment), so nothing is broken while this
 * script hasn't been run yet — but real enforcement (e.g. eventually
 * tightening that fail-open branch, or building any future feature/limit
 * gating that assumes every tenant has a row) depends on every tenant
 * actually having one.
 *
 * Gives each tenant with zero `subscriptions` rows an ACTIVE subscription on
 * the Professional plan (matching the old signup-time default, before plan
 * capture existed — see docs/17-migration-and-roadmap/16_Plan_Capture_Signup_Fix.md),
 * with a 1-year end_date and no Stripe customer/subscription attached
 * (payment_method = 'manual' — these are legacy tenants, not real Stripe
 * subscribers; an admin can move them onto real billing later via Settings →
 * Billing → Upgrade, which will overwrite this row through the normal
 * checkout webhook path).
 *
 * Safe to run repeatedly: only inserts for tenants with zero existing rows.
 *
 *   node scripts/backfill-missing-subscriptions.js           # apply
 *   node scripts/backfill-missing-subscriptions.js --dry-run # report only
 */

'use strict';

const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');

const DRY_RUN = process.argv.includes('--dry-run');
const DEFAULT_PLAN_NAME = 'Professional';

const c = {
  reset: '\x1b[0m', dim: '\x1b[2m', green: '\x1b[32m',
  yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m',
};

async function main() {
  console.log(`${c.cyan}Subscription backfill for existing tenants${c.reset}`);
  if (DRY_RUN) console.log(`${c.yellow}--dry-run: nothing will be written${c.reset}`);
  console.log('');

  const [plans] = await pool.query('SELECT id, name FROM plans WHERE name = ? AND is_active = 1', [DEFAULT_PLAN_NAME]);
  if (!plans.length) {
    console.log(`${c.red}Default plan '${DEFAULT_PLAN_NAME}' not found in \`plans\` — aborting.${c.reset}`);
    process.exitCode = 1;
    return;
  }
  const defaultPlanId = plans[0].id;

  const [tenants] = await pool.query(`
    SELECT t.id, t.name
      FROM tenants t
      LEFT JOIN subscriptions s ON s.tenant_id = t.id
     WHERE s.id IS NULL
     ORDER BY t.name
  `);

  if (tenants.length === 0) {
    console.log(`${c.dim}Every tenant already has a subscriptions row — nothing to do.${c.reset}`);
    return;
  }

  console.log(`Found ${tenants.length} tenant(s) with no subscriptions row.\n`);

  let created = 0;
  let failed = 0;

  for (const tenant of tenants) {
    if (DRY_RUN) {
      console.log(`${c.dim}[dry-run] would create ACTIVE '${DEFAULT_PLAN_NAME}' subscription for: ${tenant.name} (${tenant.id})${c.reset}`);
      created += 1;
      continue;
    }
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);

      await pool.execute(
        `INSERT INTO subscriptions (
           id, tenant_id, plan_id, status, start_date, end_date, auto_renew,
           payment_method, billing_cycle, created_at, updated_at
         ) VALUES (?, ?, ?, 'active', ?, ?, 0, 'manual', 'monthly', NOW(), NOW())`,
        [uuidv4(), tenant.id, defaultPlanId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
      );
      console.log(`${c.green}✔${c.reset} Created ACTIVE '${DEFAULT_PLAN_NAME}' subscription for: ${tenant.name} (${tenant.id})`);
      created += 1;
    } catch (err) {
      console.log(`${c.red}✘${c.reset} Failed for ${tenant.name} (${tenant.id}): ${err.message}`);
      failed += 1;
    }
  }

  console.log('');
  console.log(`${c.cyan}Done.${c.reset} Created: ${created}, Failed: ${failed}${DRY_RUN ? ' (dry-run, nothing written)' : ''}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`${c.red}Fatal error:${c.reset}`, err);
    process.exit(1);
  });
