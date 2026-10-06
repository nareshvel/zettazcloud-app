/**
 * Per-user permission overrides (RBAC Phase 2c).
 *
 * Pins the precedence rules in rbacService.getUserRolesAndPermissions:
 *   - grant adds a permission the user's roles don't carry
 *   - deny removes one the roles DO carry
 *   - a store-scoped override beats a tenant-wide row for the same permission
 *   - deny beats grant at the same scope
 *
 * The middleware stack (requirePermission / hasPermission) resolves through
 * getUserRolesAndPermissions, so these semantics apply everywhere without
 * each middleware re-implementing them.
 */

const assert = require('assert');
const sinon = require('sinon');

// Other test files swap ../config/db in require.cache with fakes, and
// rbacService may already be cached pointing at a stale pool. Load a fresh
// pair so the `pool` we stub below is the same object rbacService queries,
// then restore the originals so later test files keep their instances.
const cfgPath = require.resolve('../config/db');
const rbacPath = require.resolve('../services/rbacService');
const origCfg = require.cache[cfgPath];
const origRbac = require.cache[rbacPath];
delete require.cache[cfgPath];
delete require.cache[rbacPath];
const { pool } = require(cfgPath);
const rbacService = require(rbacPath);
if (origCfg) require.cache[cfgPath] = origCfg;
if (origRbac) require.cache[rbacPath] = origRbac;

const TENANT = 'tenant-ov';
const ROLE_ID = 'role-cashier';

let overrides = [];

// Reads `overrides` at call time so tests can reassign it after the stub exists
function stubDb() {
  return sinon.stub(pool, 'query').callsFake(async (sql, params) => {
    if (/FROM\s+user_roles ur\s+JOIN\s+roles r/i.test(sql)) {
      return [[{
        role_id: ROLE_ID,
        role_name: 'Cashier',
        role_description: 'Baseline cashier',
        tenant_id: TENANT,
        scope: 'tenant',
        store_id: null,
      }]];
    }
    if (/role_permissions rp\s+JOIN\s+permissions p/i.test(sql)) {
      return [[
        { permission_name: 'sales.view', permission_description: '' },
        { permission_name: 'sales.create', permission_description: '' },
      ]];
    }
    if (/user_permission_overrides upo\s+JOIN\s+permissions p/i.test(sql)) {
      // Honour the SQL's store filter so scoping tests exercise real dispatch
      // Mirrors the real SQL: `store_id IS NULL OR store_id = ?` — a null
      // store context ('' param) matches only tenant-wide rows.
      const storeId = params[2] || null;
      return [overrides.filter(r =>
        r.store_id === null || (storeId !== null && r.store_id === storeId))];
    }
    return [[]];
  });
}

describe('Per-user permission overrides', function () {
  let queryStub;

  beforeEach(() => {
    queryStub = stubDb();
  });
  afterEach(() => {
    queryStub.restore();
  });

  it('grant adds a permission the role does not carry', async function () {
    overrides = [{
      permission_name: 'products.edit',
      effect: 'grant',
      store_id: null,
    }];
    const data = await rbacService.getUserRolesAndPermissions('u-grant', TENANT, null);
    assert.ok(data.permissions.includes('products.edit'));
    assert.ok(data.permissions.includes('sales.view'));
  });

  it('deny removes a permission the role carries', async function () {
    overrides = [{
      permission_name: 'sales.view',
      effect: 'deny',
      store_id: null,
    }];
    const data = await rbacService.getUserRolesAndPermissions('u-deny', TENANT, null);
    assert.ok(!data.permissions.includes('sales.view'));
    assert.ok(data.permissions.includes('sales.create'));
  });

  it('store-scoped deny beats a tenant-wide grant for the same permission', async function () {
    overrides = [
      { permission_name: 'reports.view', effect: 'grant', store_id: null },
      { permission_name: 'reports.view', effect: 'deny', store_id: 'store-9' },
    ];
    const inStore = await rbacService.getUserRolesAndPermissions('u-scope-a', TENANT, 'store-9');
    assert.ok(!inStore.permissions.includes('reports.view'));

    // Outside that store the tenant-wide grant still applies
    const outside = await rbacService.getUserRolesAndPermissions('u-scope-b', TENANT, 'store-1');
    assert.ok(outside.permissions.includes('reports.view'));
  });

  it('a store-scoped override does not leak to tenant-scope resolution', async function () {
    overrides = [{
      permission_name: 'reports.view',
      effect: 'grant',
      store_id: 'store-9',
    }];
    const tenantScope = await rbacService.getUserRolesAndPermissions('u-scope-c', TENANT, null);
    assert.ok(!tenantScope.permissions.includes('reports.view'));

    const storeScope = await rbacService.getUserRolesAndPermissions('u-scope-c', TENANT, 'store-9');
    assert.ok(storeScope.permissions.includes('reports.view'));
  });
});
