/**
 * Platform console access invariants.
 *
 * WHY THIS EXISTS
 * ---------------
 * The platform admin console (/api/platform/*) is authorized by a different
 * rule than tenant routes: permissions in the platform/tenants/
 * subscriptions/plans/support namespaces may ONLY be satisfied by a
 * NULL-tenant (system) role — never by the tenant-admin bypass and never by
 * a tenant-scoped role grant. These tests pin that boundary, plus the two
 * adjacent properties the console depends on: the global subscription gate
 * must not block platform paths (the platform tenant has no subscription
 * row), and the tenants column whitelist must reject arbitrary field names.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const readCode = (p) => read(p)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const { isSystemPermissionName } = require('../middleware/rbacPermissionMiddleware');
const { requireActiveSubscription } = require('../middleware/subscriptionMiddleware');
const platformService = require('../services/platformService');

describe('Platform permission classification', function () {
  it('treats platform namespaces as system-scoped', function () {
    for (const p of [
      'platform.view', 'platform.manage', 'platform.impersonate',
      'tenants.view', 'tenants.create', 'tenants.delete',
      'subscriptions.view', 'subscriptions.edit',
      'plans.view', 'plans.create', 'plans.edit',
      'support.view', 'support.respond',
    ]) {
      assert.strictEqual(isSystemPermissionName(p), true, `${p} must be system-scoped`);
    }
  });

  it('leaves tenant-scoped permissions out of the system set', function () {
    for (const p of [
      'sales.create', 'products.view', 'stores.edit', 'settings.edit',
      'tenant.subscription.view',
    ]) {
      assert.strictEqual(isSystemPermissionName(p), false, `${p} must stay tenant-scoped`);
    }
  });

  it("does not classify 'system.*' as platform-scoped", function () {
    // system.roles.manage / system.audit / system.maintenance are tenant-admin
    // capabilities on tenant-facing routes in this codebase — folding them
    // into the platform set would break tenant role management.
    assert.strictEqual(isSystemPermissionName('system.roles.manage'), false);
    assert.strictEqual(isSystemPermissionName('system.audit'), false);
  });
});

describe('Platform routes are permission-gated', function () {
  const src = readCode('routes/platform.routes.js');

  it('requires authenticate before any route', function () {
    assert.ok(/router\.use\(authenticate\)/.test(src), 'router.use(authenticate) missing');
  });

  it('every route literal carries a platform-scoped requirePermission', function () {
    const routes = [...src.matchAll(/router\.(get|post|put|patch|delete)\('([^']+)',\s*requirePermission\('([^']+)'\)/g)];
    assert.ok(routes.length >= 15, `expected >=15 gated routes, found ${routes.length}`);
    for (const [, , pathName, perm] of routes) {
      assert.ok(
        isSystemPermissionName(perm),
        `${pathName} is gated on '${perm}' — a permission the tenant-admin bypass can satisfy`,
      );
    }
  });
});

describe('checkUserPermission — no tenant-admin bypass for platform perms', function () {
  const src = readCode('middleware/rbacPermissionMiddleware.js');

  it('routes system-scoped names through checkSystemPermission before isTenantAdmin', function () {
    const bodyStart = src.indexOf('const checkUserPermission');
    const sysIdx = src.indexOf('isSystemPermissionName(requiredPermission)', bodyStart);
    const adminIdx = src.indexOf('isTenantAdmin', bodyStart);
    assert.ok(sysIdx !== -1 && adminIdx !== -1);
    assert.ok(sysIdx < adminIdx, 'system-permission branch must precede the tenant-admin bypass');
  });
});

describe('Subscription gate exempts the platform console', function () {
  const src = readCode('middleware/subscriptionMiddleware.js');

  it('excludes /api/platform from subscription enforcement', function () {
    assert.ok(src.includes("'/api/platform'"), 'platform path exclusion missing');
  });

  it('matches exclusions on originalUrl (mount-stripped req.path never matches)', function () {
    assert.ok(/req\.originalUrl/.test(src), 'exclusions must check req.originalUrl');
  });

  it('passes an /api/platform request through untouched', async function () {
    const mw = requireActiveSubscription();
    const req = { path: '/tenants', originalUrl: '/api/platform/tenants', headers: {} };
    let called = false;
    await mw(req, {}, () => { called = true; });
    assert.ok(called, 'middleware should next() for /api/platform/*');
  });
});

describe('Tenant update whitelist', function () {
  it('rejects bodies containing only non-whitelisted columns', async function () {
    await assert.rejects(
      () => platformService.updateTenant('t-1', { status: 'suspended', id: 'other', created_at: 'x' }),
      /No recognized fields/,
    );
  });
});

describe('Platform tenant cannot be lifecycle-targeted', function () {
  it('refuses to suspend the platform tenant', async function () {
    await assert.rejects(
      () => platformService.suspendTenant(platformService.PLATFORM_TENANT_ID, 'x'),
      /platform tenant cannot/i,
    );
  });
});
