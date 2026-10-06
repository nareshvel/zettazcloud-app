/**
 * Retail profile + template provisioning.
 *
 * Two settings — business type and duty-free — decide which documents a store
 * gets. The risks worth pinning:
 *
 *   * a held-back vertical (pharmacy) must not be selectable
 *   * duty-free must ADD documents, not replace the vertical's own
 *   * provisioning must never modify or delete an existing template, because a
 *     tenant may have spent real effort customising it
 *   * DEFAULT_BLOCKS is shared module state — mutating it would leak one
 *     tenant's configuration into the next
 */

const assert = require('assert');
const retailProfile = require('../services/retailProfileService');
const provisioning = require('../services/templateProvisioningService');
const printTemplateService = require('../services/printTemplateService');

describe('Retail profile', function () {
  describe('industry availability', function () {
    it('offers the five generally-available verticals', function () {
      const codes = retailProfile.availableIndustries().map((i) => i.code);
      ['general_retail', 'grocery', 'electronics', 'apparel', 'jewelry'].forEach((c) => {
        assert.ok(codes.includes(c), `${c} should be selectable`);
      });
    });

    it('does NOT offer pharmacy', function () {
      // Held back pending review of dispensing records against each target
      // market's board-of-pharmacy rules.
      const codes = retailProfile.availableIndustries().map((i) => i.code);
      assert.ok(!codes.includes('pharmacy'), 'pharmacy must not be selectable yet');
      assert.strictEqual(retailProfile.isIndustryAvailable('pharmacy'), false);
    });

    it('still knows about pharmacy, so an existing tenant is not orphaned', function () {
      // Hiding it from the picker must not erase the definition — a tenant
      // already set to pharmacy should still resolve a label and a plan.
      assert.ok(retailProfile.INDUSTRIES.pharmacy);
      assert.ok(retailProfile.INDUSTRIES.pharmacy.unavailableReason);
      assert.ok(retailProfile.planTemplates('pharmacy').length > 0);
    });
  });

  describe('template planning', function () {
    it('gives every vertical at least one document', function () {
      Object.keys(retailProfile.INDUSTRIES).forEach((code) => {
        assert.ok(
          retailProfile.planTemplates(code).length > 0,
          `${code} has no templates planned`,
        );
      });
    });

    it('gives every vertical exactly one default', function () {
      // More than one default per store means printing has an ambiguous target.
      Object.keys(retailProfile.INDUSTRIES).forEach((code) => {
        const defaults = retailProfile.planTemplates(code).filter((t) => t.isDefault);
        assert.strictEqual(defaults.length, 1, `${code} has ${defaults.length} defaults`);
      });
    });

    it('falls back to general retail for an unknown industry', function () {
      const plan = retailProfile.planTemplates('not_a_real_vertical');
      assert.deepStrictEqual(
        plan.map((t) => t.name),
        retailProfile.planTemplates('general_retail').map((t) => t.name),
      );
    });

    describe('duty-free', function () {
      it('ADDS a document rather than replacing the vertical set', function () {
        // A duty-free jeweller still serves local walk-in customers, so it needs
        // its domestic invoice as well as the duty-free one.
        const domestic = retailProfile.planTemplates('jewelry', { dutyFree: false });
        const dutyFree = retailProfile.planTemplates('jewelry', { dutyFree: true });

        assert.strictEqual(dutyFree.length, domestic.length + 1);
        domestic.forEach((d) => {
          assert.ok(
            dutyFree.some((t) => t.name === d.name),
            `duty-free plan dropped "${d.name}"`,
          );
        });
      });

      it('marks the added document with sales_mode duty_free', function () {
        const added = retailProfile.planTemplates('jewelry', { dutyFree: true })
          .filter((t) => t.salesMode === 'duty_free');
        assert.strictEqual(added.length, 1);
      });

      it('gives jewelry a duty-free INVOICE, not a receipt', function () {
        // Jewellery is high value and sold against an invoice; a thermal
        // receipt is the wrong document for a customs officer.
        const t = retailProfile.planTemplates('jewelry', { dutyFree: true })
          .find((x) => x.salesMode === 'duty_free');
        assert.strictEqual(t.templateType, 'jewelry_invoice');
      });

      it('gives other verticals a duty-free receipt', function () {
        const t = retailProfile.planTemplates('grocery', { dutyFree: true })
          .find((x) => x.salesMode === 'duty_free');
        assert.strictEqual(t.templateType, 'receipt');
      });
    });

    it('adds a refund document where the jurisdiction runs a refund scheme', function () {
      const plan = retailProfile.planTemplates('apparel', { taxRefund: true });
      assert.ok(plan.some((t) => t.salesMode === 'tax_refund'));
    });

    it('every planned template maps to a real DEFAULT_BLOCKS set', function () {
      // A bad templateType would silently fall back to receipt defaults,
      // producing the wrong document without any error.
      const valid = new Set(Object.keys(printTemplateService.DEFAULT_BLOCKS));
      Object.keys(retailProfile.INDUSTRIES).forEach((code) => {
        [false, true].forEach((dutyFree) => {
          retailProfile.planTemplates(code, { dutyFree, taxRefund: true }).forEach((t) => {
            assert.ok(
              valid.has(t.templateType),
              `${code}: "${t.name}" uses unknown type "${t.templateType}"`,
            );
          });
        });
      });
    });

    /*
     * A vertical must not borrow another vertical's preset.
     *
     * General Retail's "Invoice" pointed at `electronics-invoice-a4`, whose
     * fixture carries serial numbers, IMEIs and warranty terms. The provisioned
     * document was fine — blocks come from templateType, not presetId — but the
     * gallery and preview showed a gift shop an invoice full of columns it can
     * never populate, and the recorded presetId told anyone reading it that
     * general retail had electronics documents.
     *
     * Presets named for one vertical and used by another are only acceptable
     * when the content is genuinely vertical-neutral, which has to be argued
     * rather than assumed — hence the allowlist.
     */
    it('never borrows a preset named for another vertical', function () {
      const PREFIXES = ['retail', 'grocery', 'electronics', 'apparel', 'jewelry', 'pharmacy'];

      // presetId -> why it is legitimately shared.
      const SHARED = {
        'retail-receipt-80':
          'a plain 80mm till receipt with no vertical-specific columns',
        'taxrefund-invoice-a4':
          'traveller VAT refund is a sales mode, not a vertical',
        'b2b-reverse-charge-a4':
          'reverse charge is a sales mode, not a vertical',
        'retail-dutyfree-80':
          'duty-free receipt used by every non-jewelry vertical',
        'retail-return-80':
          'every vertical refunds, and a refund slip carries no vertical-specific columns',
      };

      const problems = [];
      Object.keys(retailProfile.INDUSTRIES).forEach((code) => {
        const vertical = code === 'general_retail' ? 'retail' : code;
        retailProfile
          .planTemplates(code, { dutyFree: true, taxRefund: true })
          .forEach((t) => {
            const owner = PREFIXES.find((p) => t.presetId.startsWith(`${p}-`));
            if (!owner || owner === vertical || SHARED[t.presetId]) return;
            problems.push(`${code}: "${t.name}" uses ${owner} preset "${t.presetId}"`);
          });
      });

      assert.deepStrictEqual(
        problems, [],
        'add a preset for the vertical, or justify the reuse in SHARED above',
      );
    });

    it('every planned templateType is accepted by the database enum', function () {
      /*
       * `print_templates.template_type` is an ENUM. A planned type missing from
       * it fails at INSERT with "Data truncated for column 'template_type'" —
       * a message that gives no hint the cause is a missing enum member, and
       * which only appears when a store actually provisions.
       *
       * The enum is read out of the migrations rather than hardcoded here, so
       * this cannot drift the way a second hand-kept list would.
       */
      const fs = require('fs');
      const path = require('path');

      const dirs = [
        path.join(__dirname, '..', '..', 'database', 'migrations'),
        path.join(__dirname, '..', '..', 'database', 'migrations', 'applied'),
      ].filter(fs.existsSync);

      const sql = dirs
        .flatMap((d) => fs.readdirSync(d).map((f) => path.join(d, f)))
        .filter((f) => f.endsWith('.sql'))
        .sort()
        .map((f) => fs.readFileSync(f, 'utf8'))
        .join('\n');

      // Backticks are optional: the CREATE writes `template_type ENUM(...)`
      // while the ALTER writes MODIFY COLUMN `template_type` ENUM(...).
      const definitions = sql.match(/`?template_type`?\s+ENUM\(([^)]*)\)/gi) || [];
      assert.ok(definitions.length > 0, 'no template_type enum found in the migrations');

      /*
       * The WIDEST definition wins, not the last one read.
       *
       * Sorting file paths does not reproduce migration order — a pending
       * migration in migrations/ sorts before an older one in applied/ — so
       * "last wins" silently picked the original narrow enum. Enum changes only
       * ever add members, so the widest is the current state regardless of the
       * order the files happen to be read in.
       */
      const memberSets = definitions.map((def) => new Set(
        (def.match(/'[a-z_]+'|"[a-z_]+"/g) || []).map((v) => v.replace(/['"]/g, '')),
      ));
      const accepted = memberSets.reduce((widest, s2) => (s2.size > widest.size ? s2 : widest));

      const planned = new Set();
      Object.keys(retailProfile.INDUSTRIES).forEach((code) => {
        retailProfile.planTemplates(code, { dutyFree: true, taxRefund: true })
          .forEach((t) => planned.add(t.templateType));
      });

      const rejected = [...planned].filter((t) => !accepted.has(t));
      assert.deepStrictEqual(
        rejected, [],
        'these template types would be rejected by the database enum — add a migration widening it',
      );
    });

    it('never plans two templates with the same name', function () {
      // Provisioning matches on name, so duplicates would silently skip.
      Object.keys(retailProfile.INDUSTRIES).forEach((code) => {
        const names = retailProfile.planTemplates(code, { dutyFree: true, taxRefund: true })
          .map((t) => t.name);
        assert.strictEqual(new Set(names).size, names.length, `${code} has duplicate names`);
      });
    });
  });
});

describe('Template provisioning', function () {
  describe('blocksForPlanEntry', function () {
    it('does NOT mutate the shared DEFAULT_BLOCKS', function () {
      // DEFAULT_BLOCKS is module state shared by every tenant. Mutating it would
      // leak one tenant's configuration into the next request.
      const before = JSON.stringify(printTemplateService.DEFAULT_BLOCKS.receipt);
      provisioning.blocksForPlanEntry({
        templateType: 'receipt',
        salesMode: 'duty_free',
        overrides: { giftMode: true },
      });
      assert.strictEqual(
        JSON.stringify(printTemplateService.DEFAULT_BLOCKS.receipt), before,
        'DEFAULT_BLOCKS was mutated',
      );
    });

    it('reveals the duty-free block on a duty-free template', function () {
      // It ships hidden because it is meaningless on a domestic sale.
      const blocks = provisioning.blocksForPlanEntry({
        templateType: 'jewelry_invoice', salesMode: 'duty_free',
      });
      const df = blocks.find((b) => b.type === 'dutyFree');
      assert.ok(df, 'jewelry invoice has no dutyFree block');
      assert.strictEqual(df.visible, true);
    });

    it('leaves the duty-free block hidden on a domestic template', function () {
      const blocks = provisioning.blocksForPlanEntry({ templateType: 'jewelry_invoice' });
      const df = blocks.find((b) => b.type === 'dutyFree');
      assert.strictEqual(df.visible, false);
    });

    it('applies preset overrides to every block', function () {
      const blocks = provisioning.blocksForPlanEntry({
        templateType: 'receipt', overrides: { giftMode: true },
      });
      assert.ok(blocks.every((b) => b.config?.giftMode === true));
    });

    it('falls back to receipt blocks for an unknown type', function () {
      const blocks = provisioning.blocksForPlanEntry({ templateType: 'not_real' });
      assert.ok(Array.isArray(blocks) && blocks.length > 0);
    });
  });
});

describe('Retail profile — writing numbering settings', function () {
  /*
   * A live 500 on every save, found by clicking the button in the running app
   * rather than by reading the code.
   *
   * The three numbering columns are NOT NULL. The write was a single upsert
   * that passed NULL for any field the caller had not supplied, so a PUT
   * changing only `sequentialNumbering` violated the constraint on the other
   * two. MySQL validates the INSERT row before reaching ON DUPLICATE KEY, so
   * the duplicate-key branch never rescued it either.
   *
   * These are source assertions: the fault is in the SQL that gets built, and
   * building it wrongly is what has to be prevented.
   */
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'retailProfileService.js'), 'utf8',
  );
  const block = src.slice(src.indexOf('const numberingColumns'), src.indexOf('await conn.commit()'));

  it('writes only the columns the caller supplied', function () {
    assert.ok(
      /filter\(\(\[, value\]\) => value !== undefined\)/.test(block),
      'undefined fields must be dropped, not sent as NULL into NOT NULL columns',
    );
  });

  it('never passes NULL for an omitted numbering field', function () {
    // The exact shape of the bug.
    assert.ok(
      !/=== undefined \? null :/.test(block),
      'an omitted field is being sent as NULL — this 500s against NOT NULL columns',
    );
  });

  it('a partial update stays partial', function () {
    /*
     * Equally important in the other direction: sending one setting must not
     * reset the others to defaults. Only the named columns appear in the SET.
     */
    assert.ok(
      /SET \$\{numberingColumns\.map/.test(block),
      'the SET clause must be built from the supplied columns only',
    );
  });

  it('still handles a store with no jurisdiction row yet', function () {
    // Otherwise a store that has never been configured cannot save at all.
    assert.ok(/affectedRows === 0/.test(block), 'no insert path for a missing row');
    assert.ok(/INSERT INTO store_jurisdiction_settings/.test(block));
  });

  it('does nothing when no numbering field was supplied', function () {
    assert.ok(/numberingColumns\.length > 0/.test(block));
  });
});
