/**
 * User RBAC Service - PROXY IMPLEMENTATION
 * 
 * @deprecated This service is deprecated and will be removed in a future release.
 * Please use the consolidated rbacService.js instead.
 * 
 * This is now a proxy to the consolidated rbacService.js to maintain backward compatibility
 * during the migration period. All calls are delegated to the new service.
 */

const rbacService = require('./rbacService');
const logger = require('../utils/logger');

// Log deprecation warning only once per server instance
let deprecationWarningLogged = false;

function logDeprecationWarning() {
  if (!deprecationWarningLogged) {
    logger.warn('DEPRECATED: userRbacService.js is deprecated and will be removed in a future release. Use rbacService.js instead.');
    deprecationWarningLogged = true;
  }
}

/**
 * Get all roles and permissions for a user
 * @param {string} userId - User ID
 * @param {string} tenantId - Optional tenant ID to filter roles
 * @param {string} storeId - Optional store ID to filter roles
 * @returns {Promise<Object>} Roles and permissions
 */
async function getUserRolesAndPermissions(userId, tenantId = null, storeId = null) {
  logDeprecationWarning();
  return rbacService.getUserRolesAndPermissions(userId, tenantId, storeId);
}

/**
 * Check if a user has a specific role
 * @param {string} userId - User ID
 * @param {string} roleName - Role name to check
 * @param {string} tenantId - Optional tenant ID
 * @param {string} storeId - Optional store ID
 * @returns {Promise<boolean>} True if user has the role
 */
async function hasRole(userId, roleName, tenantId = null, storeId = null) {
  logDeprecationWarning();
  return rbacService.hasRole(userId, roleName, tenantId, storeId);
}

/**
 * Check if a user has a specific permission
 * @param {string} userId - User ID
 * @param {string} permission - Permission to check
 * @param {string} tenantId - Optional tenant ID
 * @param {string} storeId - Optional store ID
 * @returns {Promise<boolean>} True if user has the permission
 */
async function hasPermission(userId, permission, tenantId = null, storeId = null) {
  logDeprecationWarning();
  return rbacService.hasPermission(userId, permission, tenantId, storeId);
}

/**
 * Get all permissions for a user
 * @param {string} userId - User ID  
 * @param {string} tenantId - Optional tenant ID to filter
 * @param {string} storeId - Optional store ID to filter
 * @returns {Promise<string[]>} Array of permission strings
 */
async function getUserPermissions(userId, tenantId = null, storeId = null) {
  logDeprecationWarning();
  return rbacService.getUserPermissions(userId, tenantId, storeId);
}

/**
 * Check if a user is a tenant admin
 * @param {string} userId - User ID
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<boolean>} True if user is admin of the tenant
 */
async function isTenantAdmin(userId, tenantId) {
  logDeprecationWarning();
  return rbacService.isTenantAdmin(userId, tenantId);
}

module.exports = {
  getUserRolesAndPermissions,
  hasRole,
  hasPermission,
  getUserPermissions,
  isTenantAdmin
};
