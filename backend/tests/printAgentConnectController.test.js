/**
 * Print Agent Connect Controller tests
 *
 * Verifies public-but-device-authenticated endpoints enforce the metadata
 * allowlist and return expected shapes.
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
  const controllerPath = require.resolve('../controllers/printAgentConnectController');
  delete require.cache[controllerPath];
  return require(controllerPath);
}

describe('printAgentConnectController', function () {
  let sandbox;
  let restoreService;

  beforeEach(function () {
    sandbox = sinon.createSandbox();
  });

  afterEach(function () {
    sandbox.restore();
    if (restoreService) restoreService();
  });

  describe('enroll', function () {
    it('returns a one-time bearer token and tenant/store scope', async function () {
      const stub = {
        consumeEnrollmentCode: sandbox.stub().resolves({
          agent_id: 'agent-row-1',
          tenant_id: 'tenant-1',
          store_id: 'store-1',
          token: 'plaintext-token',
        }),
      };
      restoreService = stubService(stub);
      const controller = loadController();
      const req = { body: { code: 'enrollment-code', agent_id: 'workstation-1', version: '2.2.0' } };
      const res = fakeRes();
      await controller.enroll(req, res);
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.data.token, 'plaintext-token');
      assert.strictEqual(res.body.data.tenant_id, 'tenant-1');
      assert.strictEqual(stub.consumeEnrollmentCode.callCount, 1);
    });

    it('rejects missing enrollment code or agent_id', async function () {
      const stub = { consumeEnrollmentCode: sandbox.stub() };
      restoreService = stubService(stub);
      const controller = loadController();
      const req = { body: { agent_id: 'workstation-1' } };
      const res = fakeRes();
      await controller.enroll(req, res);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(stub.consumeEnrollmentCode.callCount, 0);
    });
  });

  describe('heartbeat', function () {
    it('records only the allowlisted metadata fields', async function () {
      const stub = { recordHeartbeat: sandbox.stub().resolves(true) };
      restoreService = stubService(stub);
      const controller = loadController();
      const req = {
        agent: { id: 'agent-row-1' },
        body: {
          version: '2.2.0',
          platform: 'darwin',
          os_version: '14.0',
          architecture: 'arm64',
          status: 'online',
          capabilities: { pdf: true },
          queue_counts: { pending: 0 },
          last_error: 'paper jam',
          browser_token: 'should-be-ignored',
          customer_data: 'should-be-ignored',
        },
      };
      const res = fakeRes();
      await controller.heartbeat(req, res);
      assert.strictEqual(res.statusCode, 200);
      const passed = stub.recordHeartbeat.firstCall.args[1];
      assert.strictEqual(passed.version, '2.2.0');
      assert.strictEqual(passed.browser_token, undefined);
      assert.strictEqual(passed.customer_data, undefined);
    });

    it('returns 401 without an authenticated agent', async function () {
      const stub = { recordHeartbeat: sandbox.stub() };
      restoreService = stubService(stub);
      const controller = loadController();
      const req = { agent: null, body: { status: 'online' } };
      const res = fakeRes();
      await controller.heartbeat(req, res);
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(stub.recordHeartbeat.callCount, 0);
    });
  });

  describe('getConfiguration', function () {
    it('returns cloud defaults, overrides, and mappings for the agent', async function () {
      const stub = {
        getConfiguration: sandbox.stub().resolves({
          agent_id: 'workstation-1',
          tenant_id: 'tenant-1',
          store_id: 'store-1',
          update_channel: 'stable',
          heartbeat_interval: 300,
          notification_policy: 'errors',
          config_policy: 'hybrid',
          workstation_overrides: { paper_width: 80 },
          printer_mappings: [{ document_route: 'receipt', local_printer_id: 'lp1' }],
        }),
      };
      restoreService = stubService(stub);
      const controller = loadController();
      const req = { agent: { id: 'agent-row-1' } };
      const res = fakeRes();
      await controller.getConfiguration(req, res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.agent_id, 'workstation-1');
      assert.ok(stub.getConfiguration.calledWith(req.agent));
    });

    it('returns 401 without an authenticated agent', async function () {
      const stub = { getConfiguration: sandbox.stub() };
      restoreService = stubService(stub);
      const controller = loadController();
      const req = { agent: null };
      const res = fakeRes();
      await controller.getConfiguration(req, res);
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(stub.getConfiguration.callCount, 0);
    });
  });
});
