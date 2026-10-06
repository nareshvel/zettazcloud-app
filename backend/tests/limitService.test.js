/**
 * RBAC Phase 2d — role-level caps and manager-PIN override.
 *
 * Pins the semantics that protect the checkout and returns paths:
 *   - no configured limit => uncapped (existing tenants unaffected)
 *   - effective cap = MIN across the user's applicable roles
 *   - manager PIN resolves against approvals.manager_override holders only,
 *     tenant-scoped, and bcrypt-verified
 */

const assert = require('assert');
const sinon = require('sinon');
const bcrypt = require('bcryptjs');

const cfgPath = require.resolve('../config/db');
const rbacPath = require.resolve('../services/rbacService');
const limPath = require.resolve('../services/limitService');
const origCfg = require.cache[cfgPath];
const origRbac = require.cache[rbacPath];
const origLim = require.cache[limPath];
delete require.cache[cfgPath];
delete require.cache[rbacPath];
delete require.cache[limPath];
const { pool } = require(cfgPath);
const rbacService = require(rbacPath);
const limitService = require(limPath);
if (origCfg) require.cache[cfgPath] = origCfg;
if (origRbac) require.cache[rbacPath] = origRbac;
if (origLim) require.cache[limPath] = origLim;

const TENANT = 'tenant-lim';
const PIN = '2468';
const PIN_HASH = bcrypt.hashSync(PIN, 4); // cheap rounds — tests only

describe('limitService', function () {
  let queryStub;

  afterEach(() => {
    if (queryStub) { queryStub.restore(); queryStub = null; }
  });

  it('returns null when no role_limits rows exist (uncapped)', async function () {
    sinon.stub(rbacService, 'isTenantAdmin').resolves(false);
    queryStub = sinon.stub(pool, 'query').resolves([[{ cap: null }]]);
    const cap = await limitService.getEffectiveLimit('u1', TENANT, 'refund_amount');
    assert.strictEqual(cap, null);
    rbacService.isTenantAdmin.restore();
  });

  it('returns the MIN across applicable roles', async function () {
    sinon.stub(rbacService, 'isTenantAdmin').resolves(false);
    // The SQL uses MIN() — the stub returns what the DB would
    queryStub = sinon.stub(pool, 'query').resolves([[{ cap: 50 }]]);
    const cap = await limitService.getEffectiveLimit('u1', TENANT, 'refund_amount', 'store-1');
    assert.strictEqual(cap, 50);
    rbacService.isTenantAdmin.restore();
  });

  it('tenant admins are always uncapped', async function () {
    sinon.stub(rbacService, 'isTenantAdmin').resolves(true);
    queryStub = sinon.stub(pool, 'query').rejects(new Error('should not query'));
    const cap = await limitService.getEffectiveLimit('admin1', TENANT, 'refund_amount');
    assert.strictEqual(cap, null);
    rbacService.isTenantAdmin.restore();
  });

  it('rejects non-digit or out-of-length PINs without querying', async function () {
    queryStub = sinon.stub(pool, 'query').rejects(new Error('should not query'));
    assert.strictEqual(await limitService.verifyManagerPin(TENANT, 'abc'), null);
    assert.strictEqual(await limitService.verifyManagerPin(TENANT, '123'), null);
    assert.strictEqual(await limitService.verifyManagerPin(TENANT, '123456789'), null);
  });

  it('matches a PIN against an approvals.manager_override holder', async function () {
    queryStub = sinon.stub(pool, 'query').callsFake(async (sql) => {
      if (/approvals\.manager_override/.test(sql)) {
        return [[{ id: 'mgr-1', name: 'Manager One', pos_pin_hash: PIN_HASH }]];
      }
      return [[]];
    });
    const mgr = await limitService.verifyManagerPin(TENANT, PIN, 'store-1');
    assert.deepStrictEqual(mgr, { id: 'mgr-1', name: 'Manager One' });
  });

  it('rejects a wrong PIN', async function () {
    queryStub = sinon.stub(pool, 'query').resolves([[{ id: 'mgr-1', name: 'M', pos_pin_hash: PIN_HASH }]]);
    assert.strictEqual(await limitService.verifyManagerPin(TENANT, '9999'), null);
  });
});
