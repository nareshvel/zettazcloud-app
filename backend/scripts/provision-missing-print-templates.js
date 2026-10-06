#!/usr/bin/env node
/**
 * One-off backfill: give every EXISTING tenant its default print templates.
 *
 * WHY THIS SCRIPT EXISTS
 * -----------------------
 * New tenants already get templates automatically — signupService.js and the
 * industry-change route both call templateProvisioningService. But tenants
 * created before that wiring existed may still have no published `receipt`
 * template. Print Module Phase 1 removes the hardcoded legacy receipt
 * (receiptService.ts's generateReceiptHtml) and prints exclusively through
 * print_templates, so this gap has to be closed FIRST — see
 * docs/print-module/PHASE_1_STORE_LEVEL_ROUTES.md step 3.
 *
 * Safe to run repeatedly: provisionStoreTemplates only creates what's missing
 * (matches on template name) and never touches a template a tenant already
 * customised.
 *
 *   node scripts/provision-missing-print-templates.js           # all tenants
 *   node scripts/provision-missing-print-templates.js --dry-run # report only
 */

'use strict';

const { pool } = require('../config/db');
const templateProvisioningService = require('../services/templateProvisioningService');
const retailProfileService = require('../services/retailProfileService');

const DRY_RUN = process.argv.includes('--dry-run');

const c = {
  reset: '\x1b[0m', dim: '\x1b[2m', green: '\x1b[32m',
  yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m',
};

async function main() {
  console.log(`${c.cyan}Print template backfill for existing tenants${c.reset}`);
  if (DRY_RUN) console.log(`${c.yellow}--dry-run: nothing will be created${c.reset}`);
  console.log('');

  const [stores] = await pool.query(
    `SELECT s.id AS store_id, s.tenant_id, s.name AS store_name,
            s.industry_code, s.is_duty_free, t.name AS tenant_name
       FROM stores s
       JOIN tenants t ON t.id = s.tenant_id
      WHERE s.tenant_id NOT LIKE 'demo000%'
      ORDER BY t.name, s.name`,
  );

  if (stores.length === 0) {
    console.log(`${c.dim}No non-demo stores found — nothing to do.${c.reset}`);
    return;
  }

  let totalCreated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const store of stores) {
    const industry = retailProfileService.INDUSTRIES[store.industry_code];
    const label = industry?.label || store.industry_code || 'unknown industry';
    const mode = store.is_duty_free ? `${c.yellow}duty-free${c.reset}` : 'domestic';

    try {
      if (DRY_RUN) {
        const { missing } = await templateProvisioningService.findMissingTemplates(
          store.tenant_id, store.store_id,
        );
        if (missing.length === 0) {
          totalSkipped += 1;
          continue;
        }
        console.log(`${c.cyan}▶ ${store.tenant_name} / ${store.store_name}${c.reset} ${c.dim}(${label}, ${mode})${c.reset}`);
        missing.forEach((m) => console.log(`    ${c.yellow}would create${c.reset} ${m.name} ${c.dim}(${m.presetId})${c.reset}`));
        totalCreated += missing.length;
        continue;
      }

      const result = await templateProvisioningService.provisionStoreTemplates(
        store.tenant_id, store.store_id, { replace: false, publish: true },
      );

      if (result.created.length > 0) {
        console.log(`${c.cyan}▶ ${store.tenant_name} / ${store.store_name}${c.reset} ${c.dim}(${label}, ${mode})${c.reset}`);
        result.created.forEach((t) => console.log(`    ${c.green}✔ created${c.reset} ${t.name} ${c.dim}(${t.presetId})${c.reset}`));
      }

      totalCreated += result.created.length;
      totalSkipped += result.skipped.length;
    } catch (error) {
      totalFailed += 1;
      console.log(`${c.red}✗ ${store.tenant_name} / ${store.store_name}: ${error.message}${c.reset}`);
    }
  }

  console.log('');
  console.log(
    `${c.green}Done${c.reset} — ${totalCreated} ${DRY_RUN ? 'missing' : 'created'}, `
    + `${totalSkipped} already had everything, ${totalFailed} failed.`,
  );
  if (totalFailed > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(`${c.red}Backfill failed:${c.reset}`, err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
