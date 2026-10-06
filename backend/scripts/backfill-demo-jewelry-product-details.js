#!/usr/bin/env node
/**
 * One-off backfill: seed the new jewelry weight-pricing defaults
 * (purity, hsn_code, default_gross_weight, default_net_weight,
 * default_making_charge_type, default_making_charge_value, default_wastage_pct
 * — added by database/migrations/2026-09-03_jewelry_weight_pricing_checkout_capture.sql)
 * onto EXISTING DEMO jewelry-tenant products that don't have them yet.
 *
 * WHY THIS SCRIPT EXISTS
 * -----------------------
 * The new columns are populated going forward by ProductFormModal's "Jewelry
 * Details" section, but every demo jewelry product created before that
 * migration has them all NULL — so the cart's new Weight & Purity modal has
 * nothing to prefill from, and a cashier testing the feature has to type
 * every field by hand for every demo product. This script closes that gap
 * for demo data only.
 *
 * DEMO-ONLY BY DESIGN — see CLAUDE.md's `*.demo.sql` convention: demo
 * tenants are identified by id LIKE 'demo000%' (there is no is_demo column;
 * see database/migrations/applied/2026-08-26_demo_tenants.demo.sql). This
 * script hard-codes that same filter and additionally requires
 * tenants.industry_code = 'jewelry', and will REFUSE to touch a
 * non-'demo000%' tenant even if asked — this is a placeholder-data seeder,
 * not something safe to run against a real tenant's real inventory (real
 * gross/net weight cannot be guessed; a fabricated weight would silently
 * mis-price a real sale).
 *
 * SOURCES OF TRUTH, IN PRIORITY ORDER, PER PRODUCT
 * ---------------------------------------------------
 * 1. `products.attributes` JSON — some demo products (e.g. the Diamond
 *    Republic "extras" seed) already carry purity/gross_weight/net_weight/
 *    wastage_pct/making_charge/hsn_code in this JSON blob (see
 *    database/seeds/applied/2026-08-14_diamond_republic_extras_seed.sql).
 *    When present, these real authored values are copied onto the new
 *    columns as-is — nothing is fabricated for these rows.
 * 2. A "NNKT, N.Ng net" pattern in `description` (older, pre-JSON-attributes
 *    demo rows, e.g. "22KT Gold Necklace" / "22KT, 14.8g net" — see
 *    database/migrations/applied/2026-08-26_demo_tenants.demo.sql). Parsed
 *    with a regex; only used when step 1 found nothing.
 * 3. Deterministic placeholder generation (name-keyword-based weight range,
 *    22K purity, 12% making charge, 5% wastage, HSN 7113) — ONLY for demo
 *    rows with neither of the above, so every demo jewelry product ends up
 *    with *something* to prefill from. These values are explicitly fake and
 *    are never applied to a non-demo tenant.
 *
 * Only fills columns that are currently NULL — never overwrites a value a
 * real session (or an earlier run of this script) already set.
 *
 *   node scripts/backfill-demo-jewelry-product-details.js           # apply
 *   node scripts/backfill-demo-jewelry-product-details.js --dry-run # report only
 */

'use strict';

const { pool } = require('../config/db');

const DRY_RUN = process.argv.includes('--dry-run');

const c = {
  reset: '\x1b[0m', dim: '\x1b[2m', green: '\x1b[32m',
  yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m',
};

// Rough per-piece-type placeholder weight ranges (grams), used only as a
// last resort when neither attributes JSON nor description text have a real
// value. Deliberately approximate — this is demo data.
const WEIGHT_RANGES_BY_KEYWORD = [
  { pattern: /bangle|kangan|bracelet/i, min: 18, max: 32 },
  { pattern: /necklace|haar|mangalsutra/i, min: 20, max: 45 },
  { pattern: /earring|jhumka|stud/i, min: 4, max: 10 },
  { pattern: /ring/i, min: 3, max: 8 },
  { pattern: /chain/i, min: 8, max: 20 },
  { pattern: /pendant/i, min: 3, max: 9 },
  { pattern: /anklet/i, min: 10, max: 18 },
  { pattern: /brooch/i, min: 5, max: 12 },
];
const DEFAULT_WEIGHT_RANGE = { min: 5, max: 15 };

function seededRandomInRange(seedStr, min, max) {
  // Deterministic pseudo-random so re-running the script (without --dry-run
  // twice) reproduces the same placeholder rather than drifting.
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  const frac = (hash % 10000) / 10000;
  return Math.round((min + frac * (max - min)) * 1000) / 1000;
}

function placeholderWeight(productId, name) {
  const range = WEIGHT_RANGES_BY_KEYWORD.find((r) => r.pattern.test(name || '')) || DEFAULT_WEIGHT_RANGE;
  const gross = seededRandomInRange(productId, range.min, range.max);
  const net = Math.round(gross * 0.94 * 1000) / 1000; // ~6% typical stone/mount allowance
  return { gross, net };
}

function parseAttributes(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

// Matches things like "22KT, 21.9g net" or "22K, 14.8g net" in free text.
const DESC_PATTERN = /(\d{2}\s?K(?:T)?)[^\d]{0,10}(\d+(?:\.\d+)?)\s*g\b/i;

function parseDescription(desc) {
  if (!desc) return {};
  const m = desc.match(DESC_PATTERN);
  if (!m) return {};
  return {
    purity: `${m[1].toUpperCase().replace('KT', 'K')}`,
    net_weight: Number(m[2]),
  };
}

async function main() {
  console.log(`${c.cyan}Demo jewelry product details backfill${c.reset}`);
  if (DRY_RUN) console.log(`${c.yellow}--dry-run: nothing will be written${c.reset}`);
  console.log('');

  const [tenants] = await pool.query(
    `SELECT id, name FROM tenants WHERE id LIKE 'demo000%' AND industry_code = 'jewelry'`
  );

  if (tenants.length === 0) {
    console.log(`${c.dim}No demo jewelry tenants found (id LIKE 'demo000%' AND industry_code = 'jewelry') — nothing to do.${c.reset}`);
    return;
  }
  console.log(`Found ${tenants.length} demo jewelry tenant(s): ${tenants.map(t => t.name).join(', ')}\n`);

  const tenantIds = tenants.map(t => t.id);
  const [products] = await pool.query(
    `SELECT id, tenant_id, name, description, attributes,
            purity, hsn_code, default_gross_weight, default_net_weight,
            default_making_charge_type, default_making_charge_value, default_wastage_pct
       FROM products
      WHERE tenant_id IN (?)
        AND (purity IS NULL OR hsn_code IS NULL OR default_gross_weight IS NULL
             OR default_net_weight IS NULL OR default_making_charge_type IS NULL
             OR default_making_charge_value IS NULL OR default_wastage_pct IS NULL)`,
    [tenantIds]
  );

  if (products.length === 0) {
    console.log(`${c.dim}Every demo jewelry product already has these fields set — nothing to do.${c.reset}`);
    return;
  }
  console.log(`Found ${products.length} product(s) with at least one missing field.\n`);

  let fromAttributes = 0, fromDescription = 0, fromPlaceholder = 0, failed = 0;

  for (const p of products) {
    try {
      const attrs = parseAttributes(p.attributes);
      const fromDesc = parseDescription(p.description);
      const usedPlaceholder = !attrs.purity && !attrs.net_weight && !fromDesc.purity && !fromDesc.net_weight;

      const purity = p.purity ?? attrs.purity ?? fromDesc.purity ?? '22K (916)';
      const hsnCode = p.hsn_code ?? attrs.hsn_code ?? '7113';
      let grossWeight = p.default_gross_weight ?? attrs.gross_weight ?? null;
      let netWeight = p.default_net_weight ?? attrs.net_weight ?? fromDesc.net_weight ?? null;

      if (netWeight == null || grossWeight == null) {
        const placeholder = placeholderWeight(p.id, p.name);
        if (grossWeight == null) grossWeight = placeholder.gross;
        if (netWeight == null) netWeight = placeholder.net;
      }

      const wastagePct = p.default_wastage_pct ?? attrs.wastage_pct ?? 5.0;
      let makingChargeType = p.default_making_charge_type;
      let makingChargeValue = p.default_making_charge_value;
      if (makingChargeType == null || makingChargeValue == null) {
        if (attrs.making_charge != null) {
          makingChargeType = 'flat';
          makingChargeValue = attrs.making_charge;
        } else {
          makingChargeType = 'percentage';
          makingChargeValue = 12.0;
        }
      }

      if (usedPlaceholder) fromPlaceholder += 1;
      else if (attrs.purity || attrs.net_weight) fromAttributes += 1;
      else fromDescription += 1;

      if (DRY_RUN) {
        console.log(
          `${c.dim}[dry-run] ${p.name} (${p.id.slice(0, 8)}…): purity=${purity} gross=${grossWeight}g net=${netWeight}g ` +
          `making=${makingChargeType}:${makingChargeValue} wastage=${wastagePct}% hsn=${hsnCode}` +
          `${usedPlaceholder ? ' [placeholder]' : ''}${c.reset}`
        );
        continue;
      }

      await pool.execute(
        `UPDATE products SET
           purity = COALESCE(purity, ?),
           hsn_code = COALESCE(hsn_code, ?),
           default_gross_weight = COALESCE(default_gross_weight, ?),
           default_net_weight = COALESCE(default_net_weight, ?),
           default_making_charge_type = COALESCE(default_making_charge_type, ?),
           default_making_charge_value = COALESCE(default_making_charge_value, ?),
           default_wastage_pct = COALESCE(default_wastage_pct, ?)
         WHERE id = ?`,
        [purity, hsnCode, grossWeight, netWeight, makingChargeType, makingChargeValue, wastagePct, p.id]
      );
      console.log(`${c.green}✔${c.reset} ${p.name} (${p.id.slice(0, 8)}…)${usedPlaceholder ? ' [placeholder weight]' : ''}`);
    } catch (err) {
      console.log(`${c.red}✘${c.reset} Failed for ${p.name} (${p.id}): ${err.message}`);
      failed += 1;
    }
  }

  console.log('');
  console.log(
    `${c.cyan}Done.${c.reset} From attributes JSON: ${fromAttributes}, from description text: ${fromDescription}, ` +
    `placeholder-generated: ${fromPlaceholder}, failed: ${failed}${DRY_RUN ? ' (dry-run, nothing written)' : ''}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`${c.red}Fatal error:${c.reset}`, err);
    process.exit(1);
  });
