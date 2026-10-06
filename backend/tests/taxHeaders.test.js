const request = require('supertest');
const app = require('../server');

// These tests focus on auth/header middleware behavior only (no DB setup required)
// They assert early failures (401/400) that occur before hitting controllers.

describe('Tax headers and auth preconditions', function () {
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
    const res = await request(app)
      .get('/api/v1/settings/taxes/classes')
      .set('tenant-id', 'test-tenant') // triggers dev fallback user in authenticate
      .expect('Content-Type', /json/);

    if (res.status !== 400) {
      throw new Error(`Expected 400, got ${res.status} with body: ${JSON.stringify(res.body)}`);
    }
    if (!/Store ID is required/i.test(JSON.stringify(res.body))) {
      throw new Error(`Expected error message about missing store ID, got: ${JSON.stringify(res.body)}`);
    }
  });

  it('should return 400 on POST /classes when store header is missing', async function () {
    const res = await request(app)
      .post('/api/v1/settings/taxes/classes')
      .set('tenant-id', 'test-tenant')
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
