#!/usr/bin/env node
/**
 * Seed a couple of starter print templates (Receipt + Jewelry Invoice) for
 * every existing store, using printTemplateService so the standard default
 * blocks / versioning logic is reused. Templates are created as published
 * defaults so they show up immediately in the Print Templates designer.
 *
 * Usage:
 *   cd backend
 *   node scripts/seed_print_templates.js                 # seed all stores
 *   node scripts/seed_print_templates.js --store <id>     # seed one store
 */

const { pool } = require('../config/db');
const printTemplateService = require('../services/printTemplateService');
const logger = require('../utils/logger');

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

const parseArgs = () => {
  const args = process.argv.slice(2);
  const storeIndex = args.indexOf('--store');
  return {
    storeId: storeIndex !== -1 ? args[storeIndex + 1] : null,
  };
};

const seedForStore = async (tenantId, storeId, storeName) => {
  console.log(`\n→ Seeding print templates for store "${storeName}" (${storeId})`);

  const existing = await printTemplateService.listTemplates(tenantId, storeId);
  const existingTypes = new Set(existing.map((t) => t.template_type));

  const templatesToCreate = [
    { name: 'Standard Receipt', template_type: 'receipt' },
    { name: 'Standard Jewelry Invoice', template_type: 'jewelry_invoice' },
  ];

  for (const spec of templatesToCreate) {
    if (existingTypes.has(spec.template_type)) {
      console.log(`  ✔ "${spec.name}" (${spec.template_type}) already exists — skipping`);
      continue;
    }

    const created = await printTemplateService.createTemplate({
      tenant_id: tenantId,
      store_id: storeId,
      name: spec.name,
      template_type: spec.template_type,
      created_by: SYSTEM_USER_ID,
    });

    const published = await printTemplateService.publishTemplate(created.id, tenantId, SYSTEM_USER_ID);

    console.log(`  ✅ Created & published "${published.name}" (${published.template_type}, v${published.version}, default=${published.is_default})`);
  }
};

const main = async () => {
  const { storeId } = parseArgs();

  let stores;
  if (storeId) {
    [stores] = await pool.query('SELECT id, tenant_id, name FROM stores WHERE id = ?', [storeId]);
    if (stores.length === 0) {
      console.error(`No store found with id ${storeId}`);
      process.exit(1);
    }
  } else {
    [stores] = await pool.query('SELECT id, tenant_id, name FROM stores');
  }

  console.log(`Seeding print templates for ${stores.length} store(s)...`);

  for (const store of stores) {
    try {
      await seedForStore(store.tenant_id, store.id, store.name);
    } catch (error) {
      console.error(`  ❌ Failed to seed store ${store.name} (${store.id}): ${error.message}`);
    }
  }

  console.log('\nDone.');
  process.exit(0);
};

main().catch((error) => {
  console.error('Fatal error seeding print templates:', error);
  process.exit(1);
});
