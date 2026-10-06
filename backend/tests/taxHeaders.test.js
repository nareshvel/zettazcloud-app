const request = require('supertest');
const sinon = require('sinon');
const app = require('../server');
// Other test files swap ../config/db in require.cache with a fake that may
// lack methods — force a fresh require so `pool` is the real mysql2 pool.
delete require.cache[require.resolve('../config/db')];
const { pool } = require('../config/db');
const { signTestToken } = require('./utils/jwtHelper');

// These tests focus on auth/header middleware behavior only (no DB setup required)
// They assert early failures (401/400) that occur before hitting controllers.

const TENANT_ID = 'test-tenant';

describe('Tax headers and auth preconditions', function () {
  let stubs = [];

  beforeEach(() => {
    // Stub DB calls so session-revocation / RBAC lookups can't hit a real
    // database — these tests only exercise the auth + store-id gates.
    if (typeof pool.query === 'function' && !pool.query.restore) {
      stubs.push(sinon.stub(pool, 'query').callsFake(async () => [[], []]));
    }
    if (typeof pool.execute === 'function' && !pool.execute.restore) {
      stubs.push(sinon.stub(pool, 'execute').callsFake(async () => [[], []]));
    }
  });

  afterEach(() => {
    stubs.forEach(s => s.restore());
    stubs = [];
  });

  it('should return 401 when no token and no tenant headers are provided', async function () {
    const res = await request(app)
      .get('/api/v1/settings/taxes/classes')
      .expect('Content-Type', /json/);

    // unifiedAuthMiddleware.authenticate returns 401 if no token and no dev header context
    // In dev mode it can fallback only if tenant headers exist; here it should be 401
    if (res.status !== 401) {
      // Provide useful debug if this ever changes
      throw new Error(`Expected 401, got ${res.status} with body: ${JSON.stringify(res.body)}`);
    }
  });

  it('should return 400 when tenant header is present but store header is missing', async function () {
    // A signed token is required — the old tenant-id-header dev fallback is
    // gated behind ALLOW_DEV_HEADER_AUTH and doesn't run in tests.
    const token = signTestToken({
      id: 'test-user',
      tenant_id: TENANT_ID,
      // Intentionally omit store_id
      roles: ['Tenant Admin'],
      permissions: ['*'],
    });

    const res = await request(app)
      .get('/api/v1/settings/taxes/classes')
      .set('Authorization', `Bearer ${token}`)
      .set('tenant-id', TENANT_ID)
      .expect('Content-Type', /json/);

    if (res.status !== 400) {
      throw new Error(`Expected 400, got ${res.status} with body: ${JSON.stringify(res.body)}`);
    }
    if (!/Store ID is required/i.test(JSON.stringify(res.body))) {
      throw new Error(`Expected error message about missing store ID, got: ${JSON.stringify(res.body)}`);
    }
  });

  it('should return 400 on POST /classes when store header is missing', async function () {
    const token = signTestToken({
      id: 'test-user',
      tenant_id: TENANT_ID,
      roles: ['Tenant Admin'],
      permissions: ['*'],
    });

    const res = await request(app)
      .post('/api/v1/settings/taxes/classes')
      .set('Authorization', `Bearer ${token}`)
      .set('tenant-id', TENANT_ID)
      .send({ name: 'Sample Class' })
      .expect('Content-Type', /json/);

    if (res.status !== 400) {
      throw new Error(`Expected 400, got ${res.status} with body: ${JSON.stringify(res.body)}`);
    }
  });

  it('should return 400 on POST /api/tax/tax-classes when store header is missing', async function () {
    const res = await request(app)
      .post('/api/tax/tax-classes')
      .set('tenant-id', 'test-tenant')
      .send({ name: 'Sample Class' })
      .expect('Content-Type', /json/);

    if (res.status !== 400 && res.status !== 401) {
      throw new Error(`Expected 400/401, got ${res.status} with body: ${JSON.stringify(res.body)}`);
    }
  });
});
