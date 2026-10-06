#!/usr/bin/env node
/**
 * Provision print templates for the demo tenants.
 *
 * Normally invoked for you — `npm run migrate:demo` seeds the tenants and then
 * runs this. Call it directly to re-provision without re-seeding:
 *
 *   node scripts/provision-demo-templates.js            # create missing only
 *   node scripts/provision-demo-templates.js --replace  # wipe and recreate
 *
 * WHY A SCRIPT RATHER THAN SEED SQL
 * ---------------------------------
 * Templates are generated from DEFAULT_BLOCKS by the same provisioning service
 * real tenants use. Hand-writing the block JSON into a seed file would mean the
 * demo exercises a code path customers never touch, and would silently drift
 * every time the defaults improve.
 */

'use strict';

const { pool } = require('../config/db');
const templateProvisioningService = require('../services/templateProvisioningService');
const retailProfileService = require('../services/retailProfileService');

const REPLACE = process.argv.includes('--replace');

const c = {
  reset: '\x1b[0m', dim: '\x1b[2m', green: '\x1b[32m',
  yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m',
};

async function main() {
  console.log(`${c.cyan}Demo template provisioning${c.reset}`);
  if (REPLACE) {
    console.log(`${c.yellow}--replace: existing demo templates will be deleted first${c.reset}`);
  }
  console.log('');

  const [stores] = await pool.query(
    `SELECT s.id AS store_id, s.tenant_id, s.name AS store_name,
            s.industry_code, s.is_duty_free, t.name AS tenant_name
       FROM stores s
       JOIN tenants t ON t.id = s.tenant_id
      WHERE s.tenant_id LIKE 'demo000%'
      ORDER BY t.name`,
  );

  if (stores.length === 0) {
    console.log(`${c.red}No demo tenants found.${c.reset}`);
    console.log('Seed them first:  npm run migrate:demo');
    process.exitCode = 1;
    return;
  }

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const store of stores) {
    const industry = retailProfileService.INDUSTRIES[store.industry_code];
    const label = industry?.label || store.industry_code;
    const mode = store.is_duty_free ? `${c.yellow}duty-free${c.reset}` : 'domestic';

    console.log(`${c.cyan}▶ ${store.tenant_name}${c.reset} ${c.dim}(${label}, ${mode})${c.reset}`);

    try {
      const result = await templateProvisioningService.provisionStoreTemplates(
        store.tenant_id,
        store.store_id,
        { replace: REPLACE, publish: true },
      );

      result.created.forEach((t) => {
        console.log(`    ${c.green}✔ created${c.reset} ${t.name} ${c.dim}(${t.presetId})${c.reset}`);
      });
      result.skipped.forEach((t) => {
        console.log(`    ${c.dim}• skipped ${t.name} — ${t.reason}${c.reset}`);
      });

      totalCreated += result.created.length;
      totalSkipped += result.skipped.length;
    } catch (error) {
      // One tenant failing must not stop the rest.
      console.log(`    ${c.red}✗ ${error.message}${c.reset}`);
    }
    console.log('');
  }

  console.log(`${c.green}Done${c.reset} — ${totalCreated} created, ${totalSkipped} already present.`);
  console.log('');
  console.log(`${c.dim}Sign in with any of:${c.reset}`);
  console.log(`${c.dim}  demo@jewelry.zettaz.test      (jewelry, duty-free)${c.reset}`);
  console.log(`${c.dim}  demo@grocery.zettaz.test      (grocery)${c.reset}`);
  console.log(`${c.dim}  demo@electronics.zettaz.test  (electronics, UAE VAT)${c.reset}`);
  console.log(`${c.dim}  demo@apparel.zettaz.test      (apparel, UK VAT)${c.reset}`);
  console.log(`${c.dim}  demo@retail.zettaz.test       (general retail, US)${c.reset}`);
}

main()
  .catch((err) => {
    console.error(`${c.red}Provisioning failed:${c.reset}`, err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
