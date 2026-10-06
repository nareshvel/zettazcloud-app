/**
 * User Role Service - PROXY IMPLEMENTATION
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
    logger.warn('DEPRECATED: userRoleService.js is deprecated and will be removed in a future release. Use rbacService.js instead.');
    deprecationWarningLogged = true;
  }
}

/**
 * Get system roles for a user
 * 
 * @param {String} userId - User ID
 * @returns {Promise<Array>} User's system roles
 */
const getUserSystemRoles = async (userId) => {
  logDeprecationWarning();
  return rbacService.getUserSystemRoles(userId);
};

/**
 * Assign system role to user
 * 
 * @param {String} userId - User ID
 * @param {String} roleId - Role ID
 * @param {String} assignedBy - User ID who assigned the role
 * @returns {Promise<Object>} Assignment result
 */
const assignSystemRole = async (userId, roleId, assignedBy) => {
  logDeprecationWarning();
  return rbacService.assignSystemRole(userId, roleId, assignedBy);
};

/**
 * Remove system role from user
 * 
 * @param {String} userId - User ID
 * @param {String} roleId - Role ID
 * @returns {Promise<Boolean>} Success status
 */
const removeSystemRole = async (userId, roleId) => {
  logDeprecationWarning();
  return rbacService.removeSystemRole(userId, roleId);
};

/**
 * Get tenant roles for a user with scope information
 * 
 * @param {String} userId - User ID
 * @param {String} tenantId - Tenant ID
 * @param {Object} options - Query options
 * @param {String} options.storeId - Filter by store ID for store-scoped roles
 * @param {String} options.scope - Filter by scope ('tenant' or 'store')
 * @returns {Promise<Array>} User's tenant roles
 */
const getUserTenantRoles = async (userId, tenantId, options = {}) => {
  logDeprecationWarning();
  return rbacService.getUserTenantRoles(userId, tenantId, options);
};

/**
 * Assign tenant role to user with scope
 * 
 * @param {String} userId - User ID
 * @param {String} roleId - Role ID
 * @param {String} tenantId - Tenant ID
 * @param {String} scope - Role scope ('tenant' or 'store')
 * @param {String} storeId - Store ID (required if scope is 'store')
 * @param {String} assignedBy - User ID who assigned the role
 * @returns {Promise<Object>} Assignment result
 */
const assignTenantRole = async (userId, roleId, tenantId, scope = 'tenant', storeId = null, assignedBy) => {
  logDeprecationWarning();
  return rbacService.assignTenantRole(userId, roleId, tenantId, scope, storeId, assignedBy);
};

/**
 * Remove tenant role from user
 * 
 * @param {String} assignmentId - User role assignment ID
 * @param {String} userId - User ID (for verification)
 * @param {String} tenantId - Tenant ID (for verification)
 * @returns {Promise<Boolean>} Success status
 */
const removeTenantRole = async (assignmentId, userId, tenantId) => {
  logDeprecationWarning();
  return rbacService.removeTenantRole(assignmentId, userId, tenantId);
};

/**
 * Get users with a specific system role
 * 
 * @param {String} roleId - Role ID
 * @returns {Promise<Array>} Users with the role
 */
const getUsersWithSystemRole = async (roleId) => {
  logDeprecationWarning();
  return rbacService.getUsersWithSystemRole(roleId);
};

/**
 * Get users with a specific tenant role
 * 
 * @param {String} roleId - Role ID
 * @param {String} tenantId - Tenant ID
 * @param {Object} options - Query options
 * @param {String} options.scope - Filter by scope ('tenant' or 'store')
 * @param {String} options.storeId - Filter by store ID
 * @returns {Promise<Array>} Users with the role
 */
const getUsersWithTenantRole = async (roleId, tenantId, options = {}) => {
  logDeprecationWarning();
  return rbacService.getUsersWithTenantRole(roleId, tenantId, options);
};

/**
 * Get tenant roles for multiple users in a single query (batch fetch).
 * 
 * @param {Array<String>} userIds - An array of user IDs.
 * @param {String} tenantId - The tenant ID.
 * @returns {Promise<Map<String, Array>>} A map where keys are user IDs and values are arrays of their roles.
 */
const getTenantRolesForUsers = async (userIds, tenantId) => {
  logDeprecationWarning();
  return rbacService.getTenantRolesForUsers(userIds, tenantId);
};

module.exports = {
  // System role assignments
  getUserSystemRoles,
  assignSystemRole,
  removeSystemRole,
  getUsersWithSystemRole,
  
  // Tenant role assignments
  getUserTenantRoles,
  assignTenantRole,
  removeTenantRole,
  getUsersWithTenantRole,
  getTenantRolesForUsers
};
