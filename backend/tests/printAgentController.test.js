/**
 * Print Agent Controller tests
 *
 * Verifies the authenticated fleet-management endpoints delegate to the service
 * correctly and return the expected response shapes.
 */

const assert = require('assert');
const Module = require('module');
const sinon = require('sinon');

function fakeRes() {
  const res = {};
  res.statusCode = 200;
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

function stubService(stubs) {
  const resolved = require.resolve('../services/printAgentService');
  const saved = require.cache[resolved];
  const mod = new Module(resolved, null);
  mod.filename = resolved;
  mod.loaded = true;
  mod.exports = stubs;
  require.cache[resolved] = mod;
  return () => { require.cache[resolved] = saved; };
}

function loadController() {
  const controllerPath = require.resolve('../controllers/printAgentController');
  delete require.cache[controllerPath];
  return require(controllerPath);
}

describe('printAgentController', function () {
  let sandbox;
  let restoreService;

  beforeEach(function () {
    sandbox = sinon.createSandbox();
  });

  afterEach(function () {
    sandbox.restore();
    if (restoreService) restoreService();
  });

  describe('createEnrollmentCode', function () {
    it('returns a plaintext code scoped to tenant and store from the request body', async function () {
      const stub = {
        createEnrollmentCode: sandbox.stub().resolves({
          id: 'code-1',
          code: 'super-secret-code',
          expires_at: '2026-09-04T12:00:00',
          tenant_id: 'tenant-1',
          store_id: 'store-1',
        }),
      };
      restoreService = stubService(stub);
      const controller = loadController();
      const req = { user: { tenant_id: 'tenant-1', id: 'user-1' }, body: { store_id: 'store-1' } };
      const res = fakeRes();
      await controller.createEnrollmentCode(req, res);
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.data.code, 'super-secret-code');
      assert.ok(stub.createEnrollmentCode.calledWith('tenant-1', 'store-1', 'user-1'));
    });

    it('requires tenant and store scope', async function () {
      const stub = { createEnrollmentCode: sandbox.stub() };
      restoreService = stubService(stub);
      const controller = loadController();
      const req = { user: { tenant_id: 'tenant-1' }, body: {} };
      const res = fakeRes();
      await controller.createEnrollmentCode(req, res);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.status, 'error');
      assert.strictEqual(stub.createEnrollmentCode.callCount, 0);
    });
  });

  describe('listAgents', function () {
    it('lists agents filtered by tenant and store from the user context', async function () {
      const stub = { listAgents: sandbox.stub().resolves([{ id: 'a1' }, { id: 'a2' }]) };
      restoreService = stubService(stub);
      const controller = loadController();
      const req = { user: { tenant_id: 'tenant-1', store_id: 'store-1' }, query: {} };
      const res = fakeRes();
      await controller.listAgents(req, res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.length, 2);
      assert.ok(stub.listAgents.calledWith('tenant-1', 'store-1', {}));
    });
  });

  describe('getAgent', function () {
    it('returns agent with printer mappings when found', async function () {
      const stub = {
        getAgentById: sandbox.stub().resolves({ id: 'a1', tenant_id: 'tenant-1' }),
        getPrinterMappings: sandbox.stub().resolves([{ document_route: 'receipt' }]),
      };
      restoreService = stubService(stub);
      const controller = loadController();
      const req = { user: { tenant_id: 'tenant-1', store_id: 'store-1' }, params: { id: 'a1' } };
      const res = fakeRes();
      await controller.getAgent(req, res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.id, 'a1');
      assert.strictEqual(res.body.data.printer_mappings.length, 1);
    });

    it('returns 404 when agent not in tenant scope', async function () {
      const stub = {
        getAgentById: sandbox.stub().resolves(null),
        getPrinterMappings: sandbox.stub(),
      };
      restoreService = stubService(stub);
      const controller = loadController();
      const req = { user: { tenant_id: 'tenant-1', store_id: 'store-1' }, params: { id: 'missing' } };
      const res = fakeRes();
      await controller.getAgent(req, res);
      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(stub.getPrinterMappings.callCount, 0);
    });
  });

  describe('updateAgent', function () {
    it('returns success when update applies', async function () {
      const stub = { updateAgent: sandbox.stub().resolves(true) };
      restoreService = stubService(stub);
      const controller = loadController();
      const req = { user: { tenant_id: 'tenant-1', store_id: 'store-1' }, params: { id: 'a1' }, body: { display_name: 'Counter A' } };
      const res = fakeRes();
      await controller.updateAgent(req, res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.status, 'success');
    });

    it('returns 404 when agent not found', async function () {
      const stub = { updateAgent: sandbox.stub().resolves(false) };
      restoreService = stubService(stub);
      const controller = loadController();
      const req = { user: { tenant_id: 'tenant-1', store_id: 'store-1' }, params: { id: 'a1' }, body: { display_name: 'Counter A' } };
      const res = fakeRes();
      await controller.updateAgent(req, res);
      assert.strictEqual(res.statusCode, 404);
    });
  });

  describe('updatePrinterMappings', function () {
    it('validates and stores mappings array', async function () {
      const mappings = [{ document_route: 'receipt', local_printer_id: 'lp1' }];
      const stub = { updatePrinterMappings: sandbox.stub().resolves(mappings) };
      restoreService = stubService(stub);
      const controller = loadController();
      const req = { user: { tenant_id: 'tenant-1', store_id: 'store-1' }, params: { id: 'a1' }, body: { mappings } };
      const res = fakeRes();
      await controller.updatePrinterMappings(req, res);
      assert.strictEqual(res.statusCode, 200);
      assert.deepStrictEqual(res.body.data, mappings);
      assert.ok(stub.updatePrinterMappings.calledWith('a1', 'tenant-1', 'store-1', mappings));
    });
  });

  describe('revokeAgent', function () {
    it('revokes the agent credential and returns success', async function () {
      const stub = { revokeAgent: sandbox.stub().resolves(true) };
      restoreService = stubService(stub);
      const controller = loadController();
      const req = { user: { tenant_id: 'tenant-1', store_id: 'store-1' }, params: { id: 'a1' } };
      const res = fakeRes();
      await controller.revokeAgent(req, res);
      assert.strictEqual(res.statusCode, 200);
      assert.ok(stub.revokeAgent.calledWith('a1', 'tenant-1', 'store-1'));
    });

    it('returns 404 when agent not found', async function () {
      const stub = { revokeAgent: sandbox.stub().resolves(false) };
      restoreService = stubService(stub);
      const controller = loadController();
      const req = { user: { tenant_id: 'tenant-1', store_id: 'store-1' }, params: { id: 'a1' } };
      const res = fakeRes();
      await controller.revokeAgent(req, res);
      assert.strictEqual(res.statusCode, 404);
    });
  });
});
