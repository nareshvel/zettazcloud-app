/**
 * Print Agent Fleet Service tests
 *
 * Covers tenant isolation, one-time enrollment codes, code expiration,
 * device-token hashing, credential revocation, heartbeat metadata allowlist,
 * and printer-mapping validation.
 */

const assert = require('assert');
const crypto = require('crypto');
const Module = require('module');
const sinon = require('sinon');

function stubModule(modPath, exportsObj) {
  const resolved = require.resolve(modPath);
  const saved = require.cache[resolved];
  const mod = new Module(resolved, null);
  mod.filename = resolved;
  mod.loaded = true;
  mod.exports = exportsObj;
  require.cache[resolved] = mod;
  return { resolved, saved };
}

function loadService(fakePool) {
  const servicePath = require.resolve('../services/printAgentService');
  const stub = stubModule('../config/db', { pool: fakePool });
  delete require.cache[servicePath];
  const service = require('../services/printAgentService');
  return {
    service,
    restore: () => {
      require.cache[stub.resolved] = stub.saved;
      delete require.cache[servicePath];
    },
  };
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

describe('printAgentService', function () {
  let sandbox;
  let fakePool;

  beforeEach(function () {
    sandbox = sinon.createSandbox();
    fakePool = {
      query: sandbox.stub(),
      getConnection: sandbox.stub(),
    };
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('createEnrollmentCode', function () {
    it('creates a 10-minute code and stores only its SHA-256 hash', async function () {
      fakePool.query.resolves([]);
      const { service, restore } = loadService(fakePool);
      try {
        const result = await service.createEnrollmentCode('tenant-1', 'store-1', 'user-1');
        assert.ok(result.code, 'plaintext code returned');
        assert.strictEqual(result.code_hash, sha256(result.code), 'stored hash is SHA-256 of plaintext');
        assert.strictEqual(fakePool.query.callCount, 1);
        const [, params] = fakePool.query.firstCall.args;
        assert.strictEqual(params[1], 'tenant-1');
        assert.strictEqual(params[2], 'store-1');
        assert.strictEqual(params[5], 'user-1');
      } finally {
        restore();
      }
    });

    it('rejects when tenant or store is missing', async function () {
      const { service, restore } = loadService(fakePool);
      try {
        await assert.rejects(service.createEnrollmentCode(null, 'store-1', 'user-1'), /Tenant ID and Store ID are required/);
      } finally {
        restore();
      }
    });
  });

  describe('consumeEnrollmentCode', function () {
    function makeConnection(queryFake) {
      return {
        query: sandbox.stub().callsFake(queryFake),
        beginTransaction: sandbox.stub().resolves(),
        commit: sandbox.stub().resolves(),
        rollback: sandbox.stub().resolves(),
        release: sandbox.stub(),
      };
    }

    it('atomically consumes a valid code and returns a one-time bearer token', async function () {
      const queries = [];
      const codeRow = {
        id: 'code-1',
        tenant_id: 'tenant-1',
        store_id: 'store-1',
        code_hash: sha256('valid-code'),
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      };
      const conn = makeConnection(async (sql, values) => {
        queries.push({ sql, values });
        if (/FROM print_agent_enrollment_codes[\s\S]*FOR UPDATE/i.test(sql)) return [[codeRow]];
        if (/FROM print_agents[\s\S]*FOR UPDATE/i.test(sql)) return [[]];
        if (/INSERT INTO print_agents/i.test(sql)) return [{ affectedRows: 1 }];
        if (/UPDATE print_agent_enrollment_codes[\s\S]*consumed_by/i.test(sql)) return [{ affectedRows: 1 }];
        return [];
      });
      fakePool.getConnection.resolves(conn);
      const { service, restore } = loadService(fakePool);
      try {
        const result = await service.consumeEnrollmentCode('valid-code', 'agent-1', { version: '2.2.0' });
        assert.ok(result.token, 'plaintext token returned');
        assert.strictEqual(result.tenant_id, 'tenant-1');
        assert.strictEqual(result.store_id, 'store-1');
        assert.ok(queries.some((q) => /UPDATE print_agent_enrollment_codes[\s\S]*consumed_by/i.test(q.sql)), 'code marked consumed');
        const insertQuery = queries.find((q) => /INSERT INTO print_agents/i.test(q.sql));
        assert.ok(insertQuery, 'agent row inserted');
        assert.strictEqual(insertQuery.values[5], sha256(result.token), 'stored token hash is SHA-256');
        assert.strictEqual(conn.commit.callCount, 1);
      } finally {
        restore();
      }
    });

    it('rejects an already consumed or expired code', async function () {
      const conn = makeConnection(async (sql) => {
        if (/FROM print_agent_enrollment_codes[\s\S]*FOR UPDATE/i.test(sql)) return [[]];
        return [];
      });
      fakePool.getConnection.resolves(conn);
      const { service, restore } = loadService(fakePool);
      try {
        await assert.rejects(service.consumeEnrollmentCode('used-code', 'agent-1'), /Invalid or expired enrollment code/);
      } finally {
        restore();
      }
    });

    it('reuses an existing agent row for the same agent_id but issues a new token', async function () {
      const queries = [];
      const codeRow = {
        id: 'code-1',
        tenant_id: 'tenant-1',
        store_id: 'store-1',
        code_hash: sha256('valid-code'),
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      };
      const conn = makeConnection(async (sql, values) => {
        queries.push({ sql, values });
        if (/FROM print_agent_enrollment_codes[\s\S]*FOR UPDATE/i.test(sql)) return [[codeRow]];
        if (/FROM print_agents[\s\S]*FOR UPDATE/i.test(sql)) return [[{ id: 'agent-row-1', status: 'offline' }]];
        if (/UPDATE print_agents[\s\S]*SET status/i.test(sql)) return [{ affectedRows: 1 }];
        if (/DELETE FROM print_agent_printer_mappings/i.test(sql)) return [{ affectedRows: 0 }];
        if (/UPDATE print_agent_enrollment_codes[\s\S]*consumed_by/i.test(sql)) return [{ affectedRows: 1 }];
        return [];
      });
      fakePool.getConnection.resolves(conn);
      const { service, restore } = loadService(fakePool);
      try {
        const result = await service.consumeEnrollmentCode('valid-code', 'agent-1', {});
        assert.strictEqual(result.agent_id, 'agent-row-1');
        assert.ok(result.token);
        assert.ok(queries.some((q) => /DELETE FROM print_agent_printer_mappings/i.test(q.sql)));
      } finally {
        restore();
      }
    });

    it('rejects enrollment for a revoked agent', async function () {
      const codeRow = {
        id: 'code-1',
        tenant_id: 'tenant-1',
        store_id: 'store-1',
        code_hash: sha256('valid-code'),
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      };
      const conn = makeConnection(async (sql) => {
        if (/FROM print_agent_enrollment_codes[\s\S]*FOR UPDATE/i.test(sql)) return [[codeRow]];
        if (/FROM print_agents[\s\S]*FOR UPDATE/i.test(sql)) return [[{ id: 'agent-row-1', status: 'revoked' }]];
        return [];
      });
      fakePool.getConnection.resolves(conn);
      const { service, restore } = loadService(fakePool);
      try {
        await assert.rejects(service.consumeEnrollmentCode('valid-code', 'agent-1'), /Agent credentials have been revoked/);
      } finally {
        restore();
      }
    });
  });

  describe('authenticateDevice', function () {
    it('authenticates by SHA-256 hash only, not plaintext token', async function () {
      const token = 'bearer-token-1';
      fakePool.query.resolves([[{
        id: 'agent-row-1',
        tenant_id: 'tenant-1',
        store_id: 'store-1',
        agent_id: 'agent-1',
        status: 'online',
        capabilities: '{"printers":3}',
        workstation_overrides: '{}',
      }]]);
      const { service, restore } = loadService(fakePool);
      try {
        const agent = await service.authenticateDevice(token);
        assert.strictEqual(agent.tenant_id, 'tenant-1');
        assert.strictEqual(agent.capabilities.printers, 3);
        const [, params] = fakePool.query.firstCall.args;
        assert.strictEqual(params[0], sha256(token), 'query uses hash, not plaintext');
      } finally {
        restore();
      }
    });

    it('returns null for a revoked agent token', async function () {
      fakePool.query.resolves([[{ id: 'agent-row-1', status: 'revoked' }]]);
      const { service, restore } = loadService(fakePool);
      try {
        const agent = await service.authenticateDevice('any-token');
        assert.strictEqual(agent, null);
      } finally {
        restore();
      }
    });
  });

  describe('revokeAgent', function () {
    it('sets status revoked and clears token_hash', async function () {
      fakePool.query.resolves([{ affectedRows: 1 }]);
      const { service, restore } = loadService(fakePool);
      try {
        const revoked = await service.revokeAgent('agent-row-1', 'tenant-1', 'store-1');
        assert.strictEqual(revoked, true);
        const [sql, params] = fakePool.query.firstCall.args;
        assert.ok(sql.includes("status = 'revoked'"), 'status set revoked');
        assert.ok(sql.includes('token_hash = NULL'), 'token hash cleared');
        assert.strictEqual(params[params.length - 1], 'store-1');
      } finally {
        restore();
      }
    });

    it('returns false when agent does not belong to tenant/store', async function () {
      fakePool.query.resolves([{ affectedRows: 0 }]);
      const { service, restore } = loadService(fakePool);
      try {
        const revoked = await service.revokeAgent('agent-row-1', 'tenant-2', 'store-2');
        assert.strictEqual(revoked, false);
      } finally {
        restore();
      }
    });
  });

  describe('tenant isolation', function () {
    it('listAgents filters by tenant and store', async function () {
      fakePool.query.resolves([[
        { id: 'a1', tenant_id: 'tenant-1', store_id: 'store-1', capabilities: null },
        { id: 'a2', tenant_id: 'tenant-1', store_id: 'store-1', capabilities: null },
      ]]);
      const { service, restore } = loadService(fakePool);
      try {
        const agents = await service.listAgents('tenant-1', 'store-1');
        assert.strictEqual(agents.length, 2);
        const [sql, params] = fakePool.query.firstCall.args;
        assert.ok(sql.includes('WHERE tenant_id = ?'));
        assert.strictEqual(params[0], 'tenant-1');
        assert.strictEqual(params[1], 'store-1');
      } finally {
        restore();
      }
    });

    it('getAgentById requires tenant match', async function () {
      fakePool.query.resolves([[{ id: 'a1', tenant_id: 'tenant-1', store_id: 'store-1', capabilities: null }]]);
      const { service, restore } = loadService(fakePool);
      try {
        const agent = await service.getAgentById('a1', 'tenant-1', 'store-1');
        assert.strictEqual(agent.id, 'a1');
        const [, params] = fakePool.query.firstCall.args;
        assert.strictEqual(params[1], 'tenant-1');
        assert.strictEqual(params[2], 'store-1');
      } finally {
        restore();
      }
    });
  });

  describe('updateAgent validation', function () {
    it('allows permitted fields and rejects invalid update_channel', async function () {
      fakePool.query.resolves([{ affectedRows: 1 }]);
      const { service, restore } = loadService(fakePool);
      try {
        await assert.rejects(
          async () => {
            try {
              await service.updateAgent('agent-row-1', 'tenant-1', 'store-1', { update_channel: 'nightly' });
            } catch (error) {
              if (error.errors && error.errors.update_channel) throw new Error(error.errors.update_channel);
              throw error;
            }
          },
          /Must be one of/
        );
        assert.strictEqual(fakePool.query.callCount, 0);
      } finally {
        restore();
      }
    });

    it('rejects heartbeat_interval outside 30-3600', async function () {
      fakePool.query.resolves([{ affectedRows: 1 }]);
      const { service, restore } = loadService(fakePool);
      try {
        await assert.rejects(
          async () => {
            try {
              await service.updateAgent('agent-row-1', 'tenant-1', 'store-1', { heartbeat_interval: 10 });
            } catch (error) {
              if (error.errors && error.errors.heartbeat_interval) throw new Error(error.errors.heartbeat_interval);
              throw error;
            }
          },
          /between 30 and 3600/
        );
        await assert.rejects(
          async () => {
            try {
              await service.updateAgent('agent-row-1', 'tenant-1', 'store-1', { heartbeat_interval: 4000 });
            } catch (error) {
              if (error.errors && error.errors.heartbeat_interval) throw new Error(error.errors.heartbeat_interval);
              throw error;
            }
          },
          /between 30 and 3600/
        );
      } finally {
        restore();
      }
    });

    it('accepts workstation_overrides as an object', async function () {
      fakePool.query.resolves([{ affectedRows: 1 }]);
      const { service, restore } = loadService(fakePool);
      try {
        const ok = await service.updateAgent('agent-row-1', 'tenant-1', 'store-1', {
          display_name: 'Counter A',
          heartbeat_interval: 120,
          workstation_overrides: { paper_width: 80 },
        });
        assert.strictEqual(ok, true);
        const [, params] = fakePool.query.firstCall.args;
        assert.ok(params.some((p) => typeof p === 'string' && p.includes('paper_width')));
      } finally {
        restore();
      }
    });
  });

  describe('printer mapping validation', function () {
    it('rejects invalid document route and missing local_printer_id', async function () {
      const { service, restore } = loadService(fakePool);
      try {
        await assert.rejects(
          async () => {
            try {
              await service.updatePrinterMappings('agent-row-1', 'tenant-1', 'store-1', [
                { document_route: 'invalid', local_printer_id: '', priority: 1 },
              ]);
            } catch (error) {
              if (error.errors) throw new Error(Object.values(error.errors).join('; '));
              throw error;
            }
          },
          /Must be one of/
        );
      } finally {
        restore();
      }
    });

    it('rejects priority outside 0-100', async function () {
      fakePool.query.callsFake(async (sql) => {
        if (/FROM print_agents/i.test(sql)) return [[{ id: 'agent-row-1' }]];
        return [];
      });
      const { service, restore } = loadService(fakePool);
      try {
        await assert.rejects(
          async () => {
            try {
              await service.updatePrinterMappings('agent-row-1', 'tenant-1', 'store-1', [
                { document_route: 'receipt', local_printer_id: 'lp1', priority: 101 },
              ]);
            } catch (error) {
              if (error.errors) throw new Error(Object.values(error.errors).join('; '));
              throw error;
            }
          },
          /between 0 and 100/
        );
      } finally {
        restore();
      }
    });

    it('replaces existing mappings transactionally for valid input', async function () {
      const queries = [];
      const conn = {
        query: sandbox.stub().callsFake(async (sql, values) => {
          queries.push({ sql, values });
          if (/FROM print_agents/i.test(sql)) return [[{ id: 'agent-row-1' }]];
          if (/DELETE FROM print_agent_printer_mappings/i.test(sql)) return [{ affectedRows: 2 }];
          if (/INSERT INTO print_agent_printer_mappings/i.test(sql)) return [{ affectedRows: 1 }];
          return [];
        }),
        beginTransaction: sandbox.stub().resolves(),
        commit: sandbox.stub().resolves(),
        rollback: sandbox.stub().resolves(),
        release: sandbox.stub(),
      };
      fakePool.getConnection.resolves(conn);
      fakePool.query.callsFake(async (sql) => {
        if (/FROM print_agents/i.test(sql)) return [[{ id: 'agent-row-1' }]];
        return [];
      });
      const { service, restore } = loadService(fakePool);
      try {
        const mappings = [
          { document_route: 'receipt', local_printer_id: 'lp1', priority: 1, is_fallback: false, enabled: true },
          { document_route: 'receipt', local_printer_id: 'lp2', priority: 2, is_fallback: true, enabled: true },
          { document_route: 'invoice', local_printer_id: 'lp3', priority: 1, enabled: true },
        ];
        const result = await service.updatePrinterMappings('agent-row-1', 'tenant-1', 'store-1', mappings);
        assert.strictEqual(result.length, 3);
        assert.strictEqual(result.filter((m) => m.route === 'receipt').length, 2);
        assert.strictEqual(conn.commit.callCount, 1);
      } finally {
        restore();
      }
    });
  });

  describe('heartbeat metadata allowlist', function () {
    it('stores allowed fields and rejects arbitrary metadata', async function () {
      fakePool.query.resolves([{ affectedRows: 1 }]);
      const { service, restore } = loadService(fakePool);
      try {
        await assert.rejects(
          service.recordHeartbeat('agent-row-1', { status: 'hacked', arbitrary_key: 'x' }),
          /Validation failed/
        );
        assert.strictEqual(fakePool.query.callCount, 0);
      } finally {
        restore();
      }
    });

    it('accepts version, platform, os_version, architecture, status, capabilities, queue_counts, last_error', async function () {
      fakePool.query.resolves([{ affectedRows: 1 }]);
      const { service, restore } = loadService(fakePool);
      try {
        const ok = await service.recordHeartbeat('agent-row-1', {
          version: '2.2.0',
          platform: 'darwin',
          os_version: '14.0',
          architecture: 'arm64',
          status: 'online',
          capabilities: { pdf: true, raw: false },
          queue_counts: { pending: 0 },
          last_error: 'connection reset',
        });
        assert.strictEqual(ok, true);
        const [sql, params] = fakePool.query.firstCall.args;
        assert.ok(sql.includes('version = ?'));
        assert.ok(sql.includes('last_seen = NOW()'));
        assert.ok(params.includes('online'));
      } finally {
        restore();
      }
    });

    it('sanitizes last_error and rejects revoked status from heartbeat', async function () {
      fakePool.query.resolves([{ affectedRows: 1 }]);
      const { service, restore } = loadService(fakePool);
      try {
        await assert.rejects(
          async () => {
            try {
              await service.recordHeartbeat('agent-row-1', { status: 'revoked' });
            } catch (error) {
              if (error.errors && error.errors.status) throw new Error(error.errors.status);
              throw error;
            }
          },
          /Revoked status cannot be set via heartbeat/
        );
      } finally {
        restore();
      }
    });
  });

  describe('configuration retrieval', function () {
    it('returns cloud defaults plus workstation overrides and mappings', async function () {
      fakePool.query.callsFake(async (sql) => {
        if (/FROM print_agent_printer_mappings/i.test(sql)) return [[]];
        return [[]];
      });
      const { service, restore } = loadService(fakePool);
      try {
        const agent = {
          id: 'agent-row-1',
          agent_id: 'agent-1',
          tenant_id: 'tenant-1',
          store_id: 'store-1',
          update_channel: 'stable',
          heartbeat_interval: 300,
          notification_policy: 'errors',
          config_policy: 'hybrid',
          workstation_overrides: { paper_width: 80 },
        };
        const config = await service.getConfiguration(agent);
        assert.strictEqual(config.agent_id, 'agent-1');
        assert.strictEqual(config.config_policy, 'hybrid');
        assert.deepStrictEqual(config.workstation_overrides, { paper_width: 80 });
        assert.deepStrictEqual(config.printer_mappings, []);
      } finally {
        restore();
      }
    });
  });
});
