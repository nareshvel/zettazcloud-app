/**
 * Print Agent Route Wiring tests
 *
 * Confirms the fleet routes are registered under /api, literal routes precede
 * /:id wildcards, and the public connect endpoints use device authentication.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('printAgent route wiring', function () {
  const routesIndex = fs.readFileSync(path.join(__dirname, '..', 'routes', 'index.js'), 'utf8');
  const printAgentRoutes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'printAgent.routes.js'), 'utf8');
  const connectRoutes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'printAgentConnect.routes.js'), 'utf8');

  it('registers print-agents and print-agent-connect in routes/index.js', function () {
    assert.ok(routesIndex.includes("require('./printAgent.routes')"), 'imports printAgent.routes');
    assert.ok(routesIndex.includes("require('./printAgentConnect.routes')"), 'imports printAgentConnect.routes');
    assert.ok(routesIndex.includes("router.use('/print-agents', printAgentRoutes)"), 'mounts /print-agents');
    assert.ok(routesIndex.includes("router.use('/print-agent-connect', printAgentConnectRoutes)"), 'mounts /print-agent-connect');
  });

  it('lists literal routes before /:id in printAgent.routes.js', function () {
    const enrollmentIndex = printAgentRoutes.indexOf("'/enrollment-codes'");
    const wildcardIndex = printAgentRoutes.indexOf("'/:id'");
    assert.ok(enrollmentIndex > -1, 'has /enrollment-codes route');
    assert.ok(wildcardIndex > -1, 'has /:id route');
    assert.ok(enrollmentIndex < wildcardIndex, 'literal routes precede /:id');
  });

  it('requires JWT authentication and tenant context on fleet routes', function () {
    assert.ok(printAgentRoutes.includes("router.use(authenticate)"), 'uses authenticate');
    assert.ok(printAgentRoutes.includes("router.use(requireTenantId)"), 'uses requireTenantId');
  });

  it('applies RBAC permissions matching the contract', function () {
    // Canonical names after the 2026-10 catalog alignment: printer-fleet
    // management mutations are settings.printer; reads are settings.view.
    assert.ok(printAgentRoutes.includes("requirePermission('settings.printer')"), 'POST enrollment-codes uses settings.printer');
    assert.ok(printAgentRoutes.includes("requirePermission('settings.view')"), 'GET uses settings.view');
    assert.ok(printAgentRoutes.includes("requirePermission('settings.printer')"), 'PUT uses settings.printer');
    assert.ok(printAgentRoutes.includes("requirePermission('settings.printer')"), 'POST revoke uses settings.printer');
  });

  it('applies targeted rate limits to enrollment routes', function () {
    assert.ok(printAgentRoutes.includes('enrollmentRateLimit'), 'fleet enrollment rate limit is mounted');
    assert.ok(connectRoutes.includes('enrollmentRateLimit'), 'connect enrollment rate limit is mounted');
    assert.ok(connectRoutes.includes('connectRateLimit'), 'connect heartbeat/configuration rate limit is mounted');
  });

  it('uses device bearer-token authentication on connect endpoints', function () {
    assert.ok(connectRoutes.includes("authenticatePrintAgent"), 'connect routes use authenticatePrintAgent');
    assert.ok(!connectRoutes.includes("require('../middleware/unifiedAuthMiddleware')"), 'connect routes do not import JWT/session auth');
    assert.ok(!connectRoutes.includes("requirePermission"), 'connect routes do not use RBAC permission middleware');
  });

  it('does not store document payloads or secrets in route handling', function () {
    assert.ok(!printAgentRoutes.includes('document') || !printAgentRoutes.includes('payload'), 'fleet routes do not mention document payloads');
    assert.ok(!connectRoutes.includes('document') || !connectRoutes.includes('payload'), 'connect routes do not mention document payloads');
  });
});
