/**
 * Removal regressions.
 *
 * Deleting code is only half the job — the other half is making sure it cannot
 * quietly come back. Each assertion here corresponds to something removed on
 * 2026-08-25, and states why its return would be a problem rather than just
 * noting that it is gone.
 *
 * These are static source assertions: no database, no app boot.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');

const read = (p) => fs.readFileSync(p, 'utf8');
const exists = (p) => fs.existsSync(p);

/**
 * Source with comments stripped.
 *
 * Needed because the removals left explanatory comments behind that name the
 * very things being checked for — routes/index.js documents why
 * /duty-free-profiles is gone, which a naive grep reads as the thing still
 * being there. What matters is whether code REFERENCES the removed concept, not
 * whether prose MENTIONS it.
 */
const readCode = (p) => read(p)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

/** Every source file under a directory, ignoring node_modules and applied migrations. */
function walk(dir, exts, acc = []) {
  if (!exists(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'applied' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, exts, acc);
    else if (exts.some((e) => entry.name.endsWith(e))) acc.push(full);
  }
  return acc;
}

describe('Removed: duty_free_profiles subsystem', function () {
  // Replaced by store_jurisdiction_settings.sales_mode (is this store duty-free?)
  // + jurisdiction_profiles (what does the country require?) + print_templates
  // blocks (what goes on the document). Two homes for one setting is how a store
  // ends up marked duty-free in one place and taxed in the other.

  it('the service file is gone', function () {
    assert.ok(
      !exists(path.join(ROOT, 'services', 'dutyFreeService.js')),
      'dutyFreeService.js is back — duty-free config belongs in store_jurisdiction_settings',
    );
  });

  it('the route file is gone', function () {
    assert.ok(
      !exists(path.join(ROOT, 'routes', 'dutyFree.routes.js')),
      'dutyFree.routes.js is back',
    );
  });

  it('nothing is mounted at /duty-free-profiles', function () {
    const src = readCode(path.join(ROOT, 'routes', 'index.js'));
    // Match the mount, not the explanatory comment that replaced it.
    assert.ok(
      !/router\.use\(\s*['"]\/duty-free-profiles['"]/.test(src),
      '/duty-free-profiles is mounted again',
    );
  });

  it('no backend source queries the dropped tables', function () {
    const offenders = walk(path.join(ROOT, 'services'), ['.js'])
      .concat(walk(path.join(ROOT, 'routes'), ['.js']))
      .filter((f) => /duty_free_(profiles|invoice_sequences|invoice_corrections)/.test(readCode(f)));

    assert.deepStrictEqual(
      offenders.map((f) => path.relative(REPO, f)), [],
      'these files query tables that no longer exist — the query will fail at runtime',
    );
  });

  it('the frontend no longer calls the removed endpoint', function () {
    const offenders = walk(path.join(REPO, 'frontend', 'src'), ['.ts', '.tsx'])
      .filter((f) => /duty-free-profiles|fetchDutyFreeProfiles|DutyFreeProfile\b/.test(readCode(f)));

    assert.deepStrictEqual(
      offenders.map((f) => path.relative(REPO, f)), [],
      'the frontend calls an endpoint that returns 404',
    );
  });

  it('a migration exists to drop the tables', function () {
    const dirs = [
      path.join(REPO, 'database', 'migrations'),
      path.join(REPO, 'database', 'migrations', 'applied'),
    ];
    const found = dirs
      .filter(exists)
      .flatMap((d) => fs.readdirSync(d).map((f) => path.join(d, f)))
      .filter((f) => f.endsWith('drop_duty_free_profiles.sql'));

    assert.ok(found.length > 0, 'the drop migration is missing — code is gone but tables remain');

    // The guard is the difference between "drops empty tables" and "destroys
    // whatever happened to be in there". Losing it silently would be worse than
    // never having written it, because the comment would still promise safety.
    const sql = read(found[0]);
    assert.ok(/SIGNAL SQLSTATE/.test(sql), 'the drop migration lost its non-empty guard');
  });
});

describe('Removed: abandoned backup files', function () {
  // Six files committed as *_backup_<timestamp> / .bak / "copy 2". None were
  // imported. They are hazardous precisely because they look like real modules:
  // the next person greps for a symbol, finds it in a stale copy, and edits code
  // that has been dead since August.
  const GONE = [
    'frontend/src/index copy 2.css',
    'frontend/src/hooks/useReceipt_backup_20250819_002147.ts',
    'frontend/src/hooks/useReturnReceipt_backup_20250819_002505.ts',
    'frontend/src/pages/Dashboard_backup_20250818_235856.tsx',
    'frontend/src/services/roleService.ts.bak',
    'frontend/src/services/receiptService_backup_20250819_002546.ts',
  ];

  GONE.forEach((rel) => {
    it(`${rel} stays deleted`, function () {
      assert.ok(!exists(path.join(REPO, rel)), `${rel} is back`);
    });
  });

  it('no new dated-backup files have been committed', function () {
    const suspects = walk(path.join(REPO, 'frontend', 'src'), ['.ts', '.tsx', '.css', '.bak'])
      .filter((f) => /_backup_\d{8}|\.bak$|copy \d+\./i.test(path.basename(f)));

    assert.deepStrictEqual(
      suspects.map((f) => path.relative(REPO, f)), [],
      'use git history rather than committing a copy of the file beside it',
    );
  });
});

describe('Business type is written to both of its homes', function () {
  /*
   * tenants.industry_code drives product fields and menus.
   * stores.industry_code drives the retail profile and its template plan, and
   * retailProfileService reads it IN PREFERENCE to the tenant value.
   *
   * The 2026-08-24 migration backfilled stores.industry_code, so from that point
   * the store row shadows the tenant row. Updating only the tenant — which is
   * what PUT /industry/tenant used to do — changes the product fields while
   * leaving the documents on the old vertical. They must move together.
   */
  const src = read(path.join(ROOT, 'routes', 'industry.routes.js'));
  const handler = src.slice(src.indexOf("router.put('/tenant'"), src.indexOf("// ---- tenant field overrides"));

  it('updates tenants.industry_code', function () {
    assert.ok(/UPDATE tenants SET industry_code/.test(handler));
  });

  it('also updates stores.industry_code', function () {
    assert.ok(
      /UPDATE stores SET industry_code/.test(handler),
      'stores.industry_code is not updated, so the template plan will keep the old business type',
    );
  });

  it('does both in one transaction', function () {
    // A partial update leaves exactly the disagreement this prevents.
    assert.ok(/beginTransaction/.test(handler), 'no transaction');
    assert.ok(/rollback/.test(handler), 'no rollback on failure');
  });
});

describe('New tenants and profile changes get their templates', function () {
  /*
   * Provisioning exists and works, but for a while nothing called it: a new
   * account opened on an empty Print Templates page and could not print a
   * receipt until someone built one by hand. Three call sites close that.
   */

  describe('signup', function () {
    const src = read(path.join(ROOT, 'services', 'signupService.js'));

    it('provisions templates for the new tenant', function () {
      assert.ok(
        /templateProvisioningService\.provisionTenantTemplates/.test(src),
        'signup does not provision templates — new tenants land on an empty page',
      );
    });

    it('does so after the transaction commits', function () {
      // Before commit, the tenant and store rows are not visible to the
      // provisioning service's own pool connection, so it would find nothing.
      const commitAt = src.indexOf('await connection.commit()');
      const provisionAt = src.indexOf('provisionTenantTemplates');
      assert.ok(commitAt !== -1 && provisionAt > commitAt,
        'provisioning must run after commit');
    });

    it('cannot fail the signup', function () {
      // The account is already valid. A template failure must not roll it back
      // or return an error to someone who has successfully registered.
      const tail = src.slice(src.indexOf('provisionTenantTemplates'));
      assert.ok(/catch/.test(tail.slice(0, 600)), 'provisioning is not wrapped in try/catch');
    });
  });

  describe('business type change', function () {
    const src = readCode(path.join(ROOT, 'routes', 'industry.routes.js'));

    it('re-provisions so the new vertical gets its documents', function () {
      assert.ok(
        /provisionTenantTemplates/.test(src),
        'switching business type leaves the tenant without the new vertical documents',
      );
    });
  });

  describe('duty-free change', function () {
    const src = readCode(path.join(ROOT, 'routes', 'retailProfile.routes.js'));
    const put = src.slice(src.indexOf("router.put('/'"), src.indexOf("router.get('/templates/missing'"));

    it('provisions the duty-free document when the switch is flipped', function () {
      // Otherwise the till stops charging tax while the paperwork justifying
      // that does not exist.
      assert.ok(
        /provisionStoreTemplates/.test(put),
        'turning on duty-free does not create the duty-free document',
      );
    });

    it('reports what it created back to the caller', function () {
      assert.ok(
        /provisionedTemplates/.test(put),
        'the user is not told a new template appeared',
      );
    });
  });

  it('provisioning is never destructive outside demo seeding', function () {
    // `replace: true` deletes every existing template for the store. A tenant
    // may have spent real effort customising theirs.
    const callers = [
      path.join(ROOT, 'services', 'signupService.js'),
      path.join(ROOT, 'routes', 'industry.routes.js'),
      path.join(ROOT, 'routes', 'retailProfile.routes.js'),
    ];
    callers.forEach((f) => {
      assert.ok(
        !/replace:\s*true/.test(readCode(f)),
        `${path.basename(f)} provisions with replace: true — this deletes customised templates`,
      );
    });
  });
});

describe('Tax enforcement never rewrites a charged total', function () {
  const src = readCode(path.join(ROOT, 'controllers', 'createSaleController.js'));

  it('the sale controller honours a rejection', function () {
    assert.ok(
      /taxVerification\.reject/.test(src),
      'enforce mode has no effect — mismatched sales are still recorded',
    );
  });

  it('a rejected sale is refused, not written', function () {
    const block = src.slice(src.indexOf('taxVerification.reject'));
    assert.ok(/return res\.status\(409\)/.test(block.slice(0, 900)),
      'a mismatched sale must be refused with a conflict, not silently accepted');
  });

  it('warn remains the default', function () {
    // Defaulting to enforce would let a tax misconfiguration stop a shop
    // trading. It has to be opted into after the mismatch logs are quiet.
    assert.ok(
      /TAX_VERIFICATION_MODE \|\| 'warn'/.test(src),
      'the default verification mode is no longer warn',
    );
  });
});

describe('Demo data cannot be seeded by an ordinary migrate run', function () {
  /*
   * `npm run migrate` is run against real databases. Demo tenants appearing in
   * one would be discovered by a customer, not by us.
   */
  const migrateSrc = read(path.join(ROOT, 'scripts', 'migrate.js'));

  it('the demo seed uses the .demo.sql suffix', function () {
    const dirs = [
      path.join(REPO, 'database', 'migrations'),
      path.join(REPO, 'database', 'migrations', 'applied'),
    ];
    const demoFiles = dirs
      .filter(exists)
      .flatMap((d) => fs.readdirSync(d))
      .filter((f) => /demo_tenants/.test(f));

    assert.ok(demoFiles.length > 0, 'the demo seed is missing');
    demoFiles.forEach((f) => {
      assert.ok(f.endsWith('.demo.sql'), `${f} would run during an ordinary migrate`);
    });
  });

  it('the runner filters demo files unless explicitly opted in', function () {
    assert.ok(/FLAGS\.demo \|\| !isDemoFile/.test(migrateSrc), 'the demo filter is gone');
  });

  it('opting in requires an explicit flag or environment variable', function () {
    assert.ok(
      /argv\.includes\('--demo'\)/.test(migrateSrc)
      && /ALLOW_DEMO_SEED === '1'/.test(migrateSrc),
      'demo seeding must not be reachable by default',
    );
  });
});

describe('Removed: receipt_templates dead system', function () {
  // Backed a `receipt_templates` table nothing ever wrote rows into — it only
  // ever surfaced "Default Template" in the Printer Settings dropdown. The
  // real template store is `print_templates` (printTemplateService.js /
  // /api/print-templates), used by the Print Template Designer.

  it('the controller no longer exports the receipt_templates CRUD functions', function () {
    const src = readCode(path.join(ROOT, 'controllers', 'printerSettingsController.js'));
    ['getReceiptTemplates', 'getReceiptTemplate', 'createReceiptTemplate', 'updateReceiptTemplate', 'deleteReceiptTemplate']
      .forEach((fn) => {
        assert.ok(
          !new RegExp(`exports\\.${fn}\\s*=`).test(src),
          `${fn} is back on printerSettingsController.js — it queried the retired receipt_templates table`,
        );
      });
  });

  it('nothing is mounted at /receipt-templates', function () {
    const src = readCode(path.join(ROOT, 'routes', 'printerSettings.routes.js'));
    assert.ok(
      !/['"]\/receipt-templates/.test(src),
      '/receipt-templates is mounted again',
    );
  });

  it('no backend source queries the receipt_templates table', function () {
    const offenders = walk(path.join(ROOT, 'controllers'), ['.js'])
      .concat(walk(path.join(ROOT, 'routes'), ['.js']))
      .concat(walk(path.join(ROOT, 'services'), ['.js']))
      .filter((f) => /\breceipt_templates\b/.test(readCode(f)));

    assert.deepStrictEqual(
      offenders.map((f) => path.relative(REPO, f)), [],
      'these files query receipt_templates, a table nothing populates',
    );
  });

  it('the frontend no longer calls the removed receipt-templates endpoints', function () {
    const offenders = walk(path.join(REPO, 'frontend', 'src'), ['.ts', '.tsx'])
      .filter((f) => /getReceiptTemplates|createReceiptTemplate|updateReceiptTemplate|deleteReceiptTemplate|\/receipt-templates/.test(readCode(f)));

    assert.deepStrictEqual(
      offenders.map((f) => path.relative(REPO, f)), [],
      'the frontend calls an endpoint that returns 404',
    );
  });

  it('the dead SettingsPrint.tsx and useOptimizedReceipt.ts files stay gone', function () {
    assert.ok(
      !exists(path.join(REPO, 'frontend', 'src', 'components', 'settings', 'SettingsPrint.tsx')),
      'SettingsPrint.tsx is back — it was an unused duplicate of PrinterSettings.tsx',
    );
    assert.ok(
      !exists(path.join(REPO, 'frontend', 'src', 'hooks', 'useOptimizedReceipt.ts')),
      'useOptimizedReceipt.ts is back — it was an unused hook with no importers',
    );
  });

  it('the legacy hardcoded receipt/return HTML generators stay gone', function () {
    const src = readCode(path.join(REPO, 'frontend', 'src', 'services', 'receiptService.ts'));
    assert.ok(
      !/generateReceiptHtml|generateTestReceipt/.test(src),
      'a hardcoded receipt generator is back — receiptService.ts must render exclusively through print_templates (Print Module Phase 1)',
    );
  });

  it('PrinterSettings.tsx no longer reads/writes the legacy printer_settings-backed API', function () {
    const src = readCode(path.join(REPO, 'frontend', 'src', 'components', 'settings', 'PrinterSettings.tsx'));
    assert.ok(
      !/getPrinterSettings|updatePrinterSettings/.test(src),
      'PrinterSettings.tsx is back to reading/writing printer_settings directly — it should use print_document_settings via printDocumentSettingsService.ts',
    );
  });
});
