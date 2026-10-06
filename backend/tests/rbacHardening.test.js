/**
 * RBAC hardening invariants — Phase 1.
 *
 * WHY THIS EXISTS
 * ---------------
 * The 2026-10 audit found permission names referenced by routes that did not
 * exist in the seed catalog (role management endpoints could never be
 * delegated — only the hardcoded Tenant Admin bypass could reach them), a
 * tenant-admin check keyed on the role NAME alone (any tenant user able to
 * create a role could mint "Tenant Admin" and self-assign it), and a role
 * query with no tenant constraint (roles assigned in one tenant could answer
 * permission checks issued under another tenant's id).
 *
 * These tests pin the fixes so the same drift cannot silently return.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/** Source with comments stripped — prose about a rule is not the rule. */
const readCode = (p) => read(p)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

/** Isolate a named function/const block from a source file. */
function bodyOf(source, declaration) {
  const start = source.indexOf(declaration);
  assert.notStrictEqual(start, -1, `${declaration} not found`);
  const next = source.indexOf('\nconst ', start + declaration.length);
  return source.slice(start, next === -1 ? source.length : next);
}

/** The permission catalog exactly as the seeder writes it. */
function catalogNames() {
  const src = read('services/permissionSeedingService.js');
  const block = src.slice(src.indexOf('const allPermissions'), src.indexOf('];', src.indexOf('const allPermissions')));
  return new Set([...block.matchAll(/name:\s*'([^']+)'/g)].map(m => m[1]));
}

describe('RBAC — route permission names exist in the catalog', function () {
  it('every requirePermission()/hasPermission() literal is a seeded permission', function () {
    const catalog = catalogNames();
    const missing = [];

    const scanDir = (dir) => {
      for (const f of fs.readdirSync(dir)) {
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) { scanDir(full); continue; }
        if (!f.endsWith('.js') || f.endsWith('.test.js')) continue;
        const src = readCode(path.relative(ROOT, full));
        for (const m of src.matchAll(/requirePermission\(\s*'([^']+)'/g)) {
          if (!catalog.has(m[1])) missing.push(`${m[1]}  <- ${path.relative(ROOT, full)}`);
        }
        for (const m of src.matchAll(/hasPermission\(\s*\[([^\]]+)\]/g)) {
          for (const pm of m[1].matchAll(/'([^']+)'/g)) {
            if (!catalog.has(pm[1])) missing.push(`${pm[1]}  <- ${path.relative(ROOT, full)}`);
          }
        }
        // rbacService.hasPermission(userId, 'perm', ...) — multi-line aware
        for (const m of src.matchAll(/hasPermission\(\s*[^,]+,\s*'([a-z_]+(?:\.[a-z_-]+)+)'/gs)) {
          if (!catalog.has(m[1])) missing.push(`${m[1]}  <- ${path.relative(ROOT, full)}`);
        }
      }
    };
    scanDir(path.join(ROOT, 'routes'));
    scanDir(path.join(ROOT, 'controllers'));

    assert.deepStrictEqual(
      missing,
      [],
      'Routes/controllers reference permissions that are not in the catalog '
      + '(grantable by no one — reachable only via admin bypass):\n  ' + missing.join('\n  '),
    );
  });
});

describe('RBAC — tenant-admin detection cannot be spoofed by role name', function () {
  const rbac = readCode('services/rbacService.js');

  it('isTenantAdmin requires is_system_role = 1, not just the name', function () {
    const body = bodyOf(rbac, 'const isTenantAdmin');
    assert.ok(
      /is_system_role\s*=\s*1/.test(body),
      'isTenantAdmin trusts the role name alone — a user-created "Tenant Admin" '
      + 'role would bypass every permission check',
    );
  });

  it('roleService blocks (re)naming a tenant role "Tenant Admin"', function () {
    const svc = readCode('services/roleService.js');
    assert.ok(/isReservedRoleName/.test(svc), 'reserved-name check missing from roleService');
    assert.ok(
      /tenant_admin/.test(bodyOf(svc, 'const isReservedRoleName')),
      'reserved-name list does not cover tenant_admin',
    );
  });
});

describe('RBAC — roles resolve within the request tenant', function () {
  it('getUserRolesAndPermissions constrains roles by tenant_id', function () {
    const body = bodyOf(readCode('services/rbacService.js'), 'const getUserRolesAndPermissions');
    assert.ok(
      /r\.tenant_id\s*(IS NULL|=)/s.test(body),
      'the role query has no tenant constraint — a role assigned in tenant A '
      + 'can satisfy a permission check made under tenant B',
    );
  });

  it('store-scoped roles are excluded when no store context exists', function () {
    const body = bodyOf(readCode('services/rbacService.js'), 'const getUserRolesAndPermissions');
    assert.ok(
      /ur\.scope\s*=\s*['"]tenant['"]/.test(body),
      'with no storeId in context the query must restrict to tenant-scoped '
      + 'roles — otherwise a store role leaks into every store-less request',
    );
  });
});

describe('RBAC — writes invalidate the permission cache', function () {
  it('tenant role update flushes assigned users\' cache after commit', function () {
    const body = bodyOf(readCode('services/roleService.js'), 'const updateTenantRole');
    assert.ok(/invalidateRoleUsersCache/.test(body), 'updateTenantRole does not invalidate the RBAC cache');
    // Must run after commit, not inside the transaction.
    const commitIdx = body.lastIndexOf('executeTransaction');
    const invIdx = body.indexOf('invalidateRoleUsersCache');
    assert.ok(invIdx > commitIdx, 'invalidation appears before the transaction completes');
  });

  it('tenant role delete flushes after commit', function () {
    const body = bodyOf(readCode('services/roleService.js'), 'const deleteTenantRole');
    const commitIdx = body.indexOf('connection.commit()');
    const invIdx = body.indexOf('invalidateRoleUsersCache');
    assert.ok(invIdx > -1 && invIdx > commitIdx,
      'deleteTenantRole must invalidate AFTER commit — pre-commit flushes can repopulate stale data');
  });

  it('role permission updates via /api/roles/permissions flush the cache', function () {
    const body = bodyOf(readCode('routes/roleRoutes.js'), "router.put('/permissions/:roleId'");
    assert.ok(/invalidateRoleUsersCache/.test(body), 'permissions write route does not invalidate cache');
  });
});

describe('RBAC — tenant scoping on role writes', function () {
  it('/api/roles/permissions/:roleId verifies the role belongs to the caller\'s tenant', function () {
    const body = bodyOf(readCode('routes/roleRoutes.js'), "router.put('/permissions/:roleId'");
    assert.ok(
      /getTenantRoleById\(roleId, tenantId\)/.test(body),
      'role_permissions write has no tenant check — cross-tenant modification possible',
    );
  });

  it('tenant roles cannot be granted system-prefixed permissions', function () {
    const svc = readCode('services/roleService.js');
    assert.ok(/assertTenantAssignablePermissions/.test(svc), 'system-permission guard missing from roleService');
    const route = bodyOf(readCode('routes/roleRoutes.js'), "router.put('/permissions/:roleId'");
    assert.ok(
      /platform|system|tenants/.test(route),
      'the permissions write route does not reject system-prefixed permissions',
    );
  });
});
