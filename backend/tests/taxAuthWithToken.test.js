const request = require('supertest');
const sinon = require('sinon');
const app = require('../server');
// Other test files swap ../config/db in require.cache with a fake that lacks
// `execute` (the stubModule technique). Force a fresh require so `pool` here
// is the real mysql2 pool regardless of test-file ordering.
delete require.cache[require.resolve('../config/db')];
const { pool } = require('../config/db');
const { signTestToken } = require('./utils/jwtHelper');

// Provided by user (latest tenant and store)
const TENANT_ID = '9a39bb98-2fba-41d1-98d9-b3e374a46846';
const STORE_ID = 'd455a140-29b7-4839-a23b-bebbd300c3da';

describe('Tax routes auth + headers with signed JWT', function () {
  let stubs = [];

  beforeEach(() => {
    // Stub DB calls to avoid touching a real database during tests.
    // Defensive: only stub methods that exist — if another file's
    // require.cache stub of config/db leaked, `execute` may be absent.
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

  it('returns 400 when store header is missing even with a valid token (no store in token)', async function () {
    const token = signTestToken({
      id: 'test-user',
      tenant_id: TENANT_ID,
      // Intentionally omit store_id
      roles: ['Tenant Admin'],
      permissions: []
    });

    const res = await request(app)
      .get('/api/v1/settings/taxes/classes')
      .set('Authorization', `Bearer ${token}`)
      .set('tenant-id', TENANT_ID)
      .expect('Content-Type', /json/);

    if (res.status !== 400) {
      throw new Error(`Expected 400, got ${res.status} body: ${JSON.stringify(res.body)}`);
    }
  });

  it('passes auth+header checks with valid token, headers, and permissions', async function () {
    const token = signTestToken({
      id: 'test-user',
      tenant_id: TENANT_ID,
      store_id: STORE_ID,
      roles: ['Tenant Admin'],
      permissions: ['*'] // ensure permission gate passes
    });

    const res = await request(app)
      .get('/api/v1/settings/taxes/classes')
      .set('Authorization', `Bearer ${token}`)
      .set('tenant-id', TENANT_ID)
      .set('store-id', STORE_ID)
      .expect('Content-Type', /json/);

    // We only assert that auth/header gatekeepers didn’t block the request.
    // Actual status may vary depending on DB content, but should not be 400/401/403/500.
    const blocked = [400, 401, 403, 500];
    if (blocked.includes(res.status)) {
      throw new Error(`Expected request to pass auth/header checks. Got ${res.status} with body: ${JSON.stringify(res.body)}`);
    }
  });
});
