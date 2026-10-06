const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../config/constants');

/**
 * Sign a JWT for tests using the centralized JWT secret.
 * @param {object} payload minimal payload including id, tenant_id, store_id, systemRoles
 * @param {string} expiresIn default 1h
 * @returns {string} signed JWT
 */
function signTestToken(payload = {}, expiresIn = '1h') {
  const base = {
    id: payload.id || 'test-user-id',
    tenant_id: payload.tenant_id || payload.tenantId, // allow undefined for tests
    store_id: payload.store_id || payload.storeId,    // allow undefined for tests
    systemRoles: payload.systemRoles || payload.roles || [],
    roles: payload.roles || [],
    permissions: payload.permissions || [],
    email: payload.email,
    name: payload.name,
    role: payload.role,
  };
  return jwt.sign(base, JWT_SECRET, { expiresIn });
}

module.exports = { signTestToken };
