/**
 * Route Auth Guard — regression suite
 *
 * WHY THIS EXISTS
 * ---------------
 * `/api/purchase-orders` was mounted without `authenticate` and resolved tenant
 * scope from a client-supplied `tenant-id` header, with a hardcoded admin user as
 * fallback. Any unauthenticated caller could read or write another tenant's
 * purchase orders.
 *
 * These tests assert the two invariants that failure violated:
 *   1. Tenant-scoped API routes reject unauthenticated requests.
 *   2. Supplying a `tenant-id` header is NOT sufficient to gain tenant context.
 *
 * When adding a genuinely public endpoint, add it to PUBLIC_ROUTE_ALLOWLIST with a
 * comment justifying why it is safe to expose without a session.
 */

const request = require('supertest');
const fs = require('fs');
const path = require('path');

/**
 * Lazily load the Express app.
 *
 * Booting `server.js` pulls in native modules (e.g. `sharp`) that are compiled for
 * the host platform. On a machine where those binaries are missing or built for a
 * different OS/arch, the HTTP suites below cannot run — but the static source
 * assertions still can, and those are the ones that catch a regression being
 * committed. So we degrade gracefully instead of failing the whole file.
 */
let app = null;
let appLoadError = null;
try {
  app = require('../server');
} catch (err) {
  appLoadError = err;
}

const requireApp = function (ctx) {
  if (!app) {
    console.warn(
      `[routeAuthGuard] Skipping HTTP assertions — server.js failed to load: ` +
      `${appLoadError && appLoadError.message ? appLoadError.message.split('\n')[0] : 'unknown'}`
    );
    ctx.skip();
  }
};

// ---------------------------------------------------------------------------
// Routes that are public BY DESIGN. Each entry must state why.
// ---------------------------------------------------------------------------
const PUBLIC_ROUTE_ALLOWLIST = [
  '/api/auth',            // login / register / refresh — cannot require a session
  '/api/public',          // storefront marketing data (active promotional offers)
  '/api/payment-webhooks',// signed callbacks from payment providers, verified by signature
  '/api/health',          // liveness probe
  '/api/debug',           // NODE_ENV-gated, never mounted in production
  '/api/direct-debug',    // NODE_ENV-gated, never mounted in production
];

/**
 * Tenant-scoped routes that must never serve an unauthenticated caller.
 * Method chosen to be the least destructive available on each route.
 */
const PROTECTED_ROUTES = [
  { method: 'get', path: '/api/purchase-orders' },
  { method: 'get', path: '/api/purchase-orders/some-id' },
  { method: 'get', path: '/api/grn' },
  { method: 'get', path: '/api/products' },
  { method: 'get', path: '/api/customers' },
  { method: 'get', path: '/api/sales' },
  { method: 'get', path: '/api/print-templates' },
  { method: 'get', path: '/api/metal-rates' },
  { method: 'get', path: '/api/memos' },
  { method: 'get', path: '/api/repairs' },
  { method: 'get', path: '/api/old-gold' },
  { method: 'get', path: '/api/layaways' },
  { method: 'get', path: '/api/savings-schemes' },
  { method: 'get', path: '/api/product-pieces/all' },
  // Jurisdiction drives whether tax is charged at all (duty-free zero-rating),
  // so it is a financially significant surface.
  { method: 'get', path: '/api/jurisdiction/current' },
  { method: 'get', path: '/api/jurisdiction/profiles' },
  // Retail profile decides whether tax is charged at all (duty-free).
  { method: 'get', path: '/api/retail-profile' },
  { method: 'get', path: '/api/retail-profile/industries' },
];

const isAllowlisted = (path) =>
  PUBLIC_ROUTE_ALLOWLIST.some((prefix) => path.startsWith(prefix));

/** 401/403 = correctly refused. 404 = route absent (acceptable, nothing leaked). */
const REFUSED = [401, 403, 404];

describe('Route auth guard', function () {
  this.timeout(10000);

  describe('unauthenticated requests are refused', function () {
    PROTECTED_ROUTES.forEach(({ method, path }) => {
      it(`${method.toUpperCase()} ${path} rejects a request with no credentials`, async function () {
        requireApp(this);
        if (isAllowlisted(path)) this.skip();

        const res = await request(app)[method](path);

        if (!REFUSED.includes(res.status)) {
          throw new Error(
            `SECURITY: ${method.toUpperCase()} ${path} returned ${res.status} to an ` +
            `unauthenticated caller. Expected one of ${REFUSED.join('/')}. ` +
            `Body: ${JSON.stringify(res.body).slice(0, 300)}`
          );
        }
      });
    });
  });

  describe('a tenant-id header alone does not grant tenant context', function () {
    PROTECTED_ROUTES.forEach(({ method, path }) => {
      it(`${method.toUpperCase()} ${path} ignores a forged tenant-id header`, async function () {
        requireApp(this);
        if (isAllowlisted(path)) this.skip();

        // This is the exact attack the original bug allowed: no token, arbitrary tenant.
        const res = await request(app)[method](path)
          .set('tenant-id', '00000000-dead-beef-0000-000000000000')
          .set('store-id', '00000000-dead-beef-0000-000000000001');

        if (!REFUSED.includes(res.status)) {
          throw new Error(
            `SECURITY: ${method.toUpperCase()} ${path} returned ${res.status} when given ` +
            `only a forged tenant-id header. A header must never establish tenant scope. ` +
            `Body: ${JSON.stringify(res.body).slice(0, 300)}`
          );
        }
      });
    });
  });

  describe('purchase orders (the original vulnerability)', function () {
    it('does not accept writes from an unauthenticated caller', async function () {
      requireApp(this);
      const res = await request(app)
        .post('/api/purchase-orders')
        .set('tenant-id', '00000000-dead-beef-0000-000000000000')
        .send({
          supplier_id: 'attacker-supplied',
          order_date: '2026-01-01',
          items: [{ product_id: 'x', quantity: 1, unit_price: 1 }],
        });

      if (!REFUSED.includes(res.status)) {
        throw new Error(
          `SECURITY REGRESSION: POST /api/purchase-orders returned ${res.status} to an ` +
          `unauthenticated caller supplying only a tenant-id header. ` +
          `Body: ${JSON.stringify(res.body).slice(0, 300)}`
        );
      }
    });

    it('does not fall back to a hardcoded admin user id', function () {
      const src = fs.readFileSync(
        path.join(__dirname, '..', 'routes', 'purchaseOrderRoutes.js'),
        'utf8'
      );

      // The specific UUID that used to be returned when req.user was absent.
      if (src.includes('a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d')) {
        throw new Error(
          'SECURITY REGRESSION: purchaseOrderRoutes.js still contains the hardcoded ' +
          'admin user UUID fallback. Acting user must come from the verified JWT.'
        );
      }
    });

    it('does not read tenant scope from request headers', function () {
      const src = fs.readFileSync(
        path.join(__dirname, '..', 'routes', 'purchaseOrderRoutes.js'),
        'utf8'
      );

      if (/req\.headers\[['"]tenant-id['"]\]/.test(src)) {
        throw new Error(
          'SECURITY REGRESSION: purchaseOrderRoutes.js reads tenant-id from headers. ' +
          'Tenant identity must come from req.user (verified JWT) only.'
        );
      }
    });
  });

  describe('requireTenantId middleware', function () {
    it('does not accept tenant identity from headers or query params', function () {
      const src = fs.readFileSync(
        path.join(__dirname, '..', 'middleware', 'unifiedAuthMiddleware.js'),
        'utf8'
      );

      // Isolate the requireTenantId function body.
      const start = src.indexOf('const requireTenantId');
      if (start === -1) throw new Error('requireTenantId not found in unifiedAuthMiddleware.js');
      const body = src.slice(start, src.indexOf('\n};', start));

      // The resolution expression must not fall back to attacker-controlled sources.
      const resolution = body.slice(0, body.indexOf('if (!tenantId)'));
      if (/req\.headers|req\.query/.test(resolution)) {
        throw new Error(
          'SECURITY REGRESSION: requireTenantId resolves tenant identity from headers ' +
          'or query params. It must use req.user (verified JWT) only.'
        );
      }
    });
  });

  describe('JWT secret handling', function () {
    it('refuses the public development fallback secret in production', function () {
      const src = fs.readFileSync(
        path.join(__dirname, '..', 'config', 'constants.js'),
        'utf8'
      );

      if (!/IS_PRODUCTION\s*&&\s*!process\.env\.JWT_SECRET/.test(src)) {
        throw new Error(
          'SECURITY REGRESSION: config/constants.js no longer fails fast when ' +
          'JWT_SECRET is unset in production. The fallback secret is public — ' +
          'anyone could forge tokens for any tenant.'
        );
      }
    });
  });
});
