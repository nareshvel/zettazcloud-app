import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { DEFAULT_PAPER_SIZE_FOR_TYPE } from '@/types/printTemplate';
import { TEMPLATE_PRESETS } from './templatePresets';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const printTemplateService = require('../../../backend/services/printTemplateService');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fixtures = require('../../../backend/services/printFixtures');

/**
 * Template types are listed in SIX places. They must agree.
 *
 * Adding `return` to DEFAULT_BLOCKS and to the database enum, but not to the
 * service's `TemplateType` constant, produced this at provisioning time:
 *
 *     ✗ Invalid template_type: return
 *
 * A document type the renderer could draw and the database would store,
 * refused by a hand-maintained list nobody thought to update. Every store
 * silently got zero templates.
 *
 * An earlier test guarded only the database enum, which is why this still got
 * through. The lesson is not "add the type to the sixth list" — it is that a
 * registry no test enumerates will drift. This suite enumerates all of them.
 *
 * DEFAULT_BLOCKS is treated as the source of truth throughout: a type is real
 * precisely when the system knows how to lay it out.
 */

const TYPES: string[] = Object.keys(printTemplateService.DEFAULT_BLOCKS);

const SRC = (rel: string) => readFileSync(join(__dirname, rel), 'utf8');

describe('template type registry — DEFAULT_BLOCKS is the source of truth', () => {
  it('has a plausible number of types', () => {
    // Guards every assertion below against passing on an empty list.
    expect(TYPES.length).toBeGreaterThan(4);
    expect(TYPES).toContain('receipt');
  });

  it('1. the service accepts every type it can render', () => {
    /*
     * The failure that started this. Validation is now derived from
     * DEFAULT_BLOCKS rather than a parallel constant, so it cannot fall behind.
     */
    const valid = printTemplateService.validTemplateTypes();
    expect([...valid].sort()).toEqual([...TYPES].sort());
  });

  it('2. TemplateType exposes every type', () => {
    // Callers use TemplateType.RECEIPT etc; a missing member is a silent
    // `undefined` passed as a template type.
    const values = Object.values(printTemplateService.TemplateType);
    TYPES.forEach((t) => {
      expect(values, `TemplateType has no member for "${t}"`).toContain(t);
    });
  });

  it('3. the database enum accepts every type', () => {
    /*
     * Otherwise: "Data truncated for column 'template_type'" — a message that
     * gives no hint the cause is a missing enum member.
     */
    const dirs = [
      join(__dirname, '../../../database/migrations'),
      join(__dirname, '../../../database/migrations/applied'),
    ].filter(existsSync);

    const sql = dirs
      .flatMap((d) => readdirSync(d).map((f) => join(d, f)))
      .filter((f) => f.endsWith('.sql'))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');

    const definitions = sql.match(/`?template_type`?\s+ENUM\(([^)]*)\)/gi) || [];
    expect(definitions.length, 'no template_type enum found').toBeGreaterThan(0);

    // Widest wins: enum changes only ever add members, and file order does not
    // reproduce migration order.
    const widest = definitions
      .map((d) => new Set((d.match(/'[a-z_]+'|"[a-z_]+"/g) || []).map((v) => v.replace(/['"]/g, ''))))
      .reduce((a, b) => (b.size > a.size ? b : a));

    const rejected = TYPES.filter((t) => !widest.has(t));
    expect(rejected, 'these types would be rejected by the database').toEqual([]);
  });

  it('4. every type has a default paper size', () => {
    // Without one the designer opens the template at the wrong size, and a
    // thermal layout proofed at A4 looks fine right up until it prints.
    const missing = TYPES.filter((t) => !DEFAULT_PAPER_SIZE_FOR_TYPE[t]);
    expect(missing, 'no default paper size').toEqual([]);
  });

  it('5. every type is offered in the New Template dialog', () => {
    // A type users cannot select is a type that only provisioning can create.
    const src = SRC('../components/print-templates/NewTemplateDialog.tsx');
    const offered = (src.match(/value: '([a-z_]+)'/g) || [])
      .map((m) => m.replace(/value: '|'/g, ''));
    const missing = TYPES.filter((t) => !offered.includes(t));
    expect(missing, 'not offered when creating a template').toEqual([]);
  });

  it('6. every type has a human-readable label', () => {
    // Otherwise the raw type string is shown in the template list — a user
    // seeing "return" rather than "Refund / Credit Note".
    const src = SRC('../pages/PrintTemplateDesigner.tsx');
    const labelBlock = src.slice(
      src.indexOf('TEMPLATE_TYPE_LABELS'),
      src.indexOf('};', src.indexOf('TEMPLATE_TYPE_LABELS')),
    );
    const missing = TYPES.filter((t) => !new RegExp(`\\b${t}:`).test(labelBlock));
    expect(missing, 'no display label').toEqual([]);
  });

  it('7. every type has preview fixture data', () => {
    /*
     * A type with no fixture previews as a page of em-dashes, or — worse —
     * borrows another vertical's data. The refund slip previewed as a SALES
     * RECEIPT until it got its own.
     */
    const available = new Set(
      fixtures.listFixtures().map((f: string) => f.split('/')[0]),
    );
    const missing = TYPES.filter((t) => !available.has(t));
    expect(missing, 'no fixture data for preview').toEqual([]);
  });
});

describe('template type registry — presets', () => {
  it('every preset names a real type', () => {
    const unknown = TEMPLATE_PRESETS
      .filter((p) => !TYPES.includes(p.templateType))
      .map((p) => `${p.id}: ${p.templateType}`);
    expect(unknown).toEqual([]);
  });

  it('every PROVISIONED type has a preset', () => {
    /*
     * Derived from the provisioning plan rather than an allowlist of
     * exceptions. `document` and `label` have no preset because nothing
     * provisions them — a user creates them by hand — and an allowlist would
     * have to be corrected by anyone who later changes that. Asking the plan
     * directly cannot go stale.
     *
     * The property that matters: if the product CREATES a document for a
     * store, the gallery must be able to describe it.
     */
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const retailProfile = require('../../../backend/services/retailProfileService');

    const provisioned = new Set<string>();
    Object.keys(retailProfile.INDUSTRIES).forEach((code) => {
      retailProfile.planTemplates(code, { dutyFree: true, taxRefund: true })
        .forEach((t: { templateType: string }) => provisioned.add(t.templateType));
    });

    expect(provisioned.size, 'the plan yielded no types').toBeGreaterThan(2);

    const covered = new Set(TEMPLATE_PRESETS.map((p) => p.templateType));
    const missing = [...provisioned].filter((t) => !covered.has(t));
    expect(missing, 'provisioned but absent from the gallery').toEqual([]);
  });
});
