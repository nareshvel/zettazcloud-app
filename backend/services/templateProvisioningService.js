/**
 * Template Provisioning Service
 *
 * Gives a store the documents its retail profile calls for.
 *
 * WHY
 * ---
 * A new tenant previously landed on an empty Print Templates page and had to
 * build a receipt from scratch before they could sell anything. Worse, a store
 * that switched to duty-free, or corrected its business type, kept whatever
 * templates it happened to have — the setting changed but nothing followed.
 *
 * Provisioning closes that: the retail profile states which documents are
 * needed, and this creates the missing ones.
 *
 * NON-DESTRUCTIVE BY DEFAULT
 * --------------------------
 * Only MISSING templates are created. Existing templates are never modified or
 * deleted, because a tenant may have spent real effort customising them, and
 * silently overwriting that would be far worse than leaving a gap. `replace`
 * exists for demo seeding, where the data is disposable by definition.
 */

'use strict';

const { pool } = require('../config/db');
const printTemplateService = require('./printTemplateService');
const retailProfileService = require('./retailProfileService');

/**
 * Blocks for a planned template.
 *
 * DEFAULT_BLOCKS is keyed by template type. A preset may layer overrides on top
 * (gift mode being the case that exists today), and duty-free templates need
 * their `dutyFree` block switched on — it ships hidden because it is meaningless
 * for a domestic sale.
 */
function blocksForPlanEntry(entry) {
  /*
   * A plan entry may name a LAYOUT VARIANT — a different arrangement of the
   * same document type. Falls back to the type's canonical blocks, so an entry
   * naming a layout that has been removed still produces a usable document
   * rather than an empty one.
   */
  const base = (entry.layout && printTemplateService.TEMPLATE_LAYOUTS[entry.layout])
    || printTemplateService.DEFAULT_BLOCKS[entry.templateType]
    || printTemplateService.DEFAULT_BLOCKS.receipt;

  // Deep clone: DEFAULT_BLOCKS is module state shared across every tenant.
  // Mutating it would leak one tenant's configuration into the next.
  let blocks = JSON.parse(JSON.stringify(base));

  if (entry.salesMode === 'duty_free' || entry.salesMode === 'export') {
    blocks = printTemplateService.withDutyFreeVisible(blocks);
  }

  if (entry.overrides) {
    blocks = blocks.map((b) => ({
      ...b,
      config: { ...(b.config || {}), ...entry.overrides },
    }));
  }

  return blocks;
}

/**
 * Provision templates for one store.
 *
 * @param {string}  tenantId
 * @param {string}  storeId
 * @param {object}  [opts]
 * @param {boolean} [opts.replace=false]  Delete existing templates first. Demo seeding only.
 * @param {boolean} [opts.publish=true]   Publish immediately so they are usable.
 * @param {string}  [opts.createdBy]
 * @returns {Promise<{created: Array, skipped: Array, profile: object}>}
 */
async function provisionStoreTemplates(tenantId, storeId, opts = {}) {
  const { replace = false, publish = true, createdBy = null } = opts;

  const profile = await retailProfileService.getRetailProfile(tenantId, storeId);

  if (replace) {
    // Demo seeding only. Never reachable from tenant-facing settings.
    await pool.query(
      'DELETE FROM print_templates WHERE tenant_id = ? AND store_id = ?',
      [tenantId, storeId],
    );
  }

  const [existingRows] = await pool.query(
    'SELECT id, name, template_type FROM print_templates WHERE tenant_id = ? AND store_id = ?',
    [tenantId, storeId],
  );
  const existingNames = new Set(existingRows.map((r) => String(r.name).toLowerCase()));

  const created = [];
  const skipped = [];

  for (const entry of profile.templatePlan) {
    // Match on name: a tenant who renamed a template has taken ownership of it,
    // and creating a near-duplicate beside it would be unhelpful.
    if (existingNames.has(entry.name.toLowerCase())) {
      skipped.push({ name: entry.name, reason: 'already exists' });
      continue;
    }

    const template = await printTemplateService.createTemplate({
      tenant_id: tenantId,
      store_id: storeId,
      name: entry.name,
      template_type: entry.templateType,
      blocks: blocksForPlanEntry(entry),
      created_by: createdBy,
    });

    if (publish) {
      await printTemplateService.publishTemplate(template.id, tenantId, createdBy);
    }

    // One default per document type, so printing has something to reach for
    // without the user choosing.
    if (entry.isDefault) {
      try {
        await printTemplateService.setAsDefault(template.id, tenantId, createdBy);
      } catch {
        // Non-fatal: the template exists and is usable either way.
      }
    }

    created.push({ id: template.id, name: entry.name, presetId: entry.presetId });
  }

  return { created, skipped, profile };
}

/**
 * Provision every store in a tenant. Used at signup and after an industry change.
 */
async function provisionTenantTemplates(tenantId, opts = {}) {
  const [stores] = await pool.query(
    'SELECT id FROM stores WHERE tenant_id = ?',
    [tenantId],
  );

  const results = [];
  for (const store of stores) {
    try {
      results.push({
        storeId: store.id,
        ...(await provisionStoreTemplates(tenantId, store.id, opts)),
      });
    } catch (error) {
      // One store failing must not abort the rest — a tenant with three stores
      // should end up with two provisioned, not zero.
      console.error(`[templates] provisioning failed for store ${store.id}:`, error.message);
      results.push({ storeId: store.id, error: error.message });
    }
  }
  return results;
}

/**
 * Which planned templates a store is missing, without creating anything.
 * Lets settings show "3 templates recommended for this profile" before acting.
 */
async function findMissingTemplates(tenantId, storeId) {
  const profile = await retailProfileService.getRetailProfile(tenantId, storeId);
  const [rows] = await pool.query(
    'SELECT name FROM print_templates WHERE tenant_id = ? AND store_id = ?',
    [tenantId, storeId],
  );
  const existing = new Set(rows.map((r) => String(r.name).toLowerCase()));

  return {
    profile,
    missing: profile.templatePlan.filter((e) => !existing.has(e.name.toLowerCase())),
  };
}

module.exports = {
  provisionStoreTemplates,
  provisionTenantTemplates,
  findMissingTemplates,
  blocksForPlanEntry,
};
