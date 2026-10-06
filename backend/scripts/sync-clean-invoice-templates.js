/**
 * Sync clean invoice/jewelry_invoice templates to already-provisioned tenants.
 *
 * WHY THIS SCRIPT EXISTS
 * -----------------------
 * printTemplateService.DEFAULT_BLOCKS.invoice and .jewelry_invoice were
 * rewritten on 2026-08-25 to the "clean" A4 layout (logo+name inline, a
 * parties band, a QR code, and a page footer pinned to the bottom of every
 * printed page). That change alone does nothing for a tenant who was already
 * provisioned before today — their `print_templates.blocks` is a JSON COPY
 * taken at provisioning time, not a live reference to DEFAULT_BLOCKS. A
 * duty-free store that signed up last month keeps printing the old layout
 * forever unless something goes and updates the row.
 *
 * NON-DESTRUCTIVE BY THE SAME RULE AS templateProvisioningService
 * -----------------------------------------------------------------
 * templateProvisioningService's own comment says it plainly: "a tenant may
 * have spent real effort customising them, and silently overwriting that
 * would be far worse than leaving a gap." This script honours that. It does
 * NOT touch every invoice/jewelry_invoice row — only rows whose stored
 * `blocks` still deep-equal EXACTLY what auto-provisioning would have written
 * before this change (the OLD_* snapshots below, including the duty-free
 * variant with the `dutyFree` block's `visible` flag flipped on, which is
 * what templateProvisioningService.blocksForPlanEntry does for a duty-free
 * jewelry invoice at creation time). Anything that does not match exactly —
 * a renamed field, a hidden block, a hand-edited header — is left alone and
 * reported as skipped, never overwritten.
 *
 * This is a best-effort heuristic, not a flag the schema tracks explicitly
 * (there is no `is_customized` column). A tenant who opened the designer,
 * changed nothing, and hit Save would bump `updated_by` without changing the
 * content — this script does not treat that as customisation, only content
 * divergence counts.
 *
 * USAGE
 * -----
 *   node scripts/sync-clean-invoice-templates.js            # dry run, reports only
 *   node scripts/sync-clean-invoice-templates.js --yes       # applies the changes
 *   node scripts/sync-clean-invoice-templates.js --yes --tenant <uuid>  # one tenant only
 *
 * Each applied row goes through printTemplateService.updateTemplate (the same
 * path the designer's Save button uses), and is republished via
 * publishTemplate if it was already published — so version history and
 * is_published/published_at stay consistent with a normal edit, not a raw
 * UPDATE that bypasses the app's own bookkeeping.
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { pool } = require('../config/db');
const printTemplateService = require('../services/printTemplateService');
const { classifyStoredBlocks, withDutyFreeVisible } = require('../services/legacyInvoiceBlocksSnapshot');

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--yes');
  const tenantArg = args.find((a) => a.startsWith('--tenant'));
  const onlyTenant = tenantArg ? args[args.indexOf(tenantArg) + 1] : null;

  console.log(apply ? 'APPLYING changes.' : 'DRY RUN — pass --yes to apply.');
  if (onlyTenant) console.log(`Restricted to tenant ${onlyTenant}`);

  const [rows] = await pool.query(
    `SELECT id, tenant_id, store_id, name, template_type, blocks, is_published, version
       FROM print_templates
      WHERE template_type IN ('invoice', 'jewelry_invoice')
      ${onlyTenant ? 'AND tenant_id = ?' : ''}
      ORDER BY tenant_id, store_id, template_type`,
    onlyTenant ? [onlyTenant] : [],
  );

  console.log(`Found ${rows.length} invoice / jewelry_invoice template(s).`);

  const updated = [];
  const skipped = [];

  for (const row of rows) {
    const storedBlocks = typeof row.blocks === 'string' ? JSON.parse(row.blocks) : row.blocks;
    const match = classifyStoredBlocks(row.template_type, storedBlocks);

    if (!match.matched) {
      skipped.push({
        id: row.id, tenantId: row.tenant_id, storeId: row.store_id, name: row.name,
        reason: 'blocks differ from the shipped default — treated as customised',
      });
      continue;
    }

    const newDefault = printTemplateService.DEFAULT_BLOCKS[row.template_type];
    const newBlocks = match.dutyFree ? withDutyFreeVisible(newDefault) : newDefault;

    updated.push({
      id: row.id, tenantId: row.tenant_id, storeId: row.store_id, name: row.name,
      dutyFree: match.dutyFree, wasPublished: Boolean(row.is_published),
    });

    if (apply) {
      await printTemplateService.updateTemplate(row.id, row.tenant_id, { blocks: newBlocks }, null);
      if (row.is_published) {
        await printTemplateService.publishTemplate(row.id, row.tenant_id, null);
      }
    }
  }

  console.log(`\n${apply ? 'Updated' : 'Would update'}: ${updated.length}`);
  updated.forEach((u) => console.log(
    `  - ${u.name} (${u.id}) tenant=${u.tenantId} store=${u.storeId}${u.dutyFree ? ' [duty-free]' : ''}`,
  ));

  console.log(`\nSkipped (looks customised): ${skipped.length}`);
  skipped.forEach((s) => console.log(`  - ${s.name} (${s.id}) tenant=${s.tenantId} store=${s.storeId}`));

  if (!apply && updated.length > 0) {
    console.log('\nRe-run with --yes to apply the changes listed above.');
  }
}

main()
  .catch((err) => {
    console.error('sync-clean-invoice-templates failed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
