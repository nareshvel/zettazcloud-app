/**
 * Authorization consistency.
 *
 * WHY THIS EXISTS
 * ---------------
 * The codebase has three authorization paths, and they disagreed about who a
 * tenant admin is:
 *
 *   authorize(...roles)        string-matches 'Tenant Admin' in the JWT
 *   requirePermission(perm)    DB lookup via rbacService.isTenantAdmin
 *   hasPermission([perms])     NOTHING — JWT permission array only
 *
 * A tenant admin therefore passed `/api/print-templates` and was refused by
 * `/api/v1/settings/taxes` on the same page load, producing 403s reading
 * `user_permissions: ["dashboard.view"]` while the rest of the app worked.
 *
 * Two properties are pinned here. Both are security-relevant, in opposite
 * directions: the first stops a legitimate admin being locked out, the second
 * stops a revoked permission continuing to work.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/** Source with comments stripped — prose about a rule is not the rule. */
const readCode = (p) => read(p)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

/** Isolate a named middleware factory from its source file. */
function bodyOf(source, declaration) {
  const start = source.indexOf(declaration);
  assert.notStrictEqual(start, -1, `${declaration} not found`);
  const next = source.indexOf('\nconst ', start + declaration.length);
  return source.slice(start, next === -1 ? source.length : next);
}

describe('Authorization — tenant admins are recognised everywhere', function () {
  const unified = readCode('middleware/unifiedAuthMiddleware.js');
  const rbacMw = readCode('middleware/rbacPermissionMiddleware.js');

  it('hasPermission recognises a tenant admin', function () {
    const body = bodyOf(unified, 'const hasPermission =');
    assert.ok(
      /isTenantAdmin/.test(body),
      'hasPermission has no tenant-admin check — an admin will be refused by the '
      + 'routes using it while passing the ones using requirePermission',
    );
  });

  it('hasPermission resolves admin status from the DATABASE, not the token', function () {
    /*
     * The JWT permission array is a snapshot taken at login. Trusting it means
     * a permission REVOKED mid-session keeps working until the token expires.
     * A permission check that cannot be revoked is not a permission check.
     */
    const body = bodyOf(unified, 'const hasPermission =');
    assert.ok(
      /rbacService\.isTenantAdmin/.test(body),
      'hasPermission must resolve admin status via rbacService, matching requirePermission',
    );
  });

  it('requirePermission still recognises a tenant admin', function () {
    // The path that was already correct. Asserted so a future "cleanup" cannot
    // fix the inconsistency by removing the bypass from BOTH.
    assert.ok(/isTenantAdmin/.test(rbacMw));
  });

  it('both paths use the same resolver, so they cannot drift apart again', function () {
    const hasPerm = bodyOf(unified, 'const hasPermission =');
    assert.ok(
      /rbacService\.isTenantAdmin/.test(hasPerm) && /rbacService\.isTenantAdmin/.test(rbacMw),
      'the two middlewares resolve tenant-admin status differently',
    );
  });

  it('hasPermission is async, or the admin check silently never runs', function () {
    /*
     * The subtle failure mode. `isTenantAdmin` returns a Promise; in a
     * non-async middleware `if (await ...)` is a syntax error, and dropping the
     * await makes the condition a truthy Promise object that grants access to
     * EVERYONE. Async is what keeps the check honest.
     */
    const body = bodyOf(unified, 'const hasPermission =');
    assert.ok(/return async \(req, res, next\)/.test(body), 'hasPermission is not async');
    assert.ok(/await rbacService\.isTenantAdmin/.test(body), 'the admin check is not awaited');
  });

  it('fails closed when the admin lookup errors', function () {
    // An unreachable database must not grant access. The catch has to fall
    // through to the explicit permission check, never to next().
    const body = bodyOf(unified, 'const hasPermission =');
    const cat = body.slice(body.indexOf('catch'));
    const beforeNextCheck = cat.slice(0, cat.indexOf('requiredPermissions.some'));
    assert.ok(
      !/return next\(\)/.test(beforeNextCheck),
      'the error path grants access — an unreachable DB must not authorise anyone',
    );
  });
});

describe('Authorization — the tenant admin role name', function () {
  /*
   * isTenantAdmin matches on LOWER(REPLACE(name,' ','_')) = 'tenant_admin'.
   * Anything creating that role has to produce a name that normalises to it,
   * or the account silently has no admin rights — which is exactly how the
   * demo tenants ended up with `["dashboard.view"]`.
   */
  const normalises = (name) => String(name).toLowerCase().replace(/ /g, '_') === 'tenant_admin';

  it('"Tenant Admin" normalises correctly', function () {
    assert.ok(normalises('Tenant Admin'));
    assert.ok(normalises('tenant admin'));
    assert.ok(normalises('tenant_admin'));
  });

  it('near-misses do NOT', function () {
    // Named here so the trap is visible to whoever adds the next seed.
    assert.ok(!normalises('Admin'));
    assert.ok(!normalises('Tenant Administrator'));
    assert.ok(!normalises('TenantAdmin'));
  });

  it('every seeded admin role uses a name that normalises', function () {
    const dirs = [
      path.join(ROOT, '..', 'database', 'migrations'),
      path.join(ROOT, '..', 'database', 'migrations', 'applied'),
      path.join(ROOT, '..', 'database', 'seeds'),
      path.join(ROOT, '..', 'database', 'seeds', 'applied'),
    ].filter(fs.existsSync);

    const problems = [];
    dirs
      .flatMap((d) => fs.readdirSync(d).map((f) => path.join(d, f)))
      .filter((f) => f.endsWith('.sql'))
      .forEach((file) => {
        const sql = fs.readFileSync(file, 'utf8');
        // Role rows that look like an admin but would not match the query.
        const matches = sql.match(/'(Tenant[^']*|[^']*Admin[^']*)'\s*,\s*'Full access'/gi) || [];
        matches.forEach((m) => {
          const name = m.match(/'([^']+)'/)[1];
          if (!normalises(name)) {
            problems.push(`${path.basename(file)}: role "${name}" will NOT be treated as a tenant admin`);
          }
        });
      });

    assert.deepStrictEqual(problems, []);
  });
});
