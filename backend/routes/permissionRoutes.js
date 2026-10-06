/**
 * Permission Routes
 * Handles API endpoints for permissions management
 */
const express = require('express');
const router = express.Router();
const permissionService = require('../services/permissionService');
const roleService = require('../services/roleService');
// Add consolidated rbacService
const rbacService = require('../services/rbacService');
const { authenticate, authorize, requireTenantId, requireStoreId } = require('../middleware/unifiedAuthMiddleware');
// Import the new RBAC permission middleware
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');
// Legacy middleware imports removed - now fully migrated to RBAC

/**
 * @route GET /api/permissions/system
 * @desc Get all system permissions
 * @access Private - System admin only
 */
router.get('/system',
  authenticate,
  requirePermission('system.roles.manage'),
  async (req, res) => {
    try {
      const permissions = await permissionService.getSystemPermissions();
      res.json({ permissions });
    } catch (error) {
      console.error('Error fetching system permissions:', error);
      res.status(500).json({ message: 'Failed to fetch system permissions' });
    }
  }
);

/**
 * @route GET /api/permissions/tenant
 * @desc Get all tenant permissions
 * @access Private - System admin or tenant admin
 */
router.get('/tenant',
  authenticate,
  requirePermission('roles.view'),
  async (req, res) => {
    try {
      const permissions = await permissionService.getTenantPermissions();
      res.json({ permissions });
    } catch (error) {
      console.error('Error fetching tenant permissions:', error);
      res.status(500).json({ message: 'Failed to fetch tenant permissions' });
    }
  }
);

/**
 * @route GET /api/permissions/role/:roleId
 * @desc Get permissions for a specific role
 * @access Private - System admin or tenant admin
 */
router.get('/role/:roleId',
  authenticate,
  async (req, res) => {
    try {
      const { roleId } = req.params;
      const { isSystem } = req.query;
      const userId = req.user?.id;
      const tenantId = req.user?.tenant_id;

      let permissions;
      if (isSystem === 'true') {
        // Verify against live DB system roles — never the JWT snapshot.
        const sysRoles = await rbacService.getUserSystemRoles(userId);
        const names = (sysRoles || []).map(r => String(r.name).toLowerCase());
        if (!names.includes('super admin') && !names.includes('platform admin')) {
          return res.status(403).json({ message: 'Access denied for system roles' });
        }
        permissions = await permissionService.getPermissionsByRoleId(roleId, true);
      } else {
        // Tenant role: caller must hold roles.view and the role must belong
        // to their tenant (prevents enumerating other tenants' role perms).
        const allowed = await rbacService.isTenantAdmin(userId, tenantId) ||
          await rbacService.hasPermission(userId, 'roles.view', tenantId);
        if (!allowed) {
          return res.status(403).json({ message: 'Access denied for tenant roles' });
        }
        const role = await roleService.getTenantRoleById(roleId, tenantId);
        if (!role) {
          return res.status(404).json({ message: 'Role not found' });
        }
        permissions = await permissionService.getPermissionsByRoleId(roleId, false);
      }

      res.json({ permissions });
    } catch (error) {
      console.error('Error fetching role permissions:', error);
      res.status(500).json({ message: 'Failed to fetch role permissions' });
    }
  }
);

/**
 * @route GET /api/permissions/my
 * @desc Get all permissions for the current user
 * @access Private
 */
router.get('/my',
  authenticate,
  async (req, res) => {
    try {
      const { tenantId, storeId } = req.query;
      const userId = req.user?.id || "system";
      
      const permissions = await permissionService.getUserPermissions(userId, tenantId, storeId);
      res.json({ permissions });
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      res.status(500).json({ message: 'Failed to fetch user permissions' });
    }
  }
);

/**
 * @route GET /api/permissions/my/stores
 * @desc Get all stores accessible by the current user with permissions
 * @access Private - Requires tenant context
 */
router.get('/my/stores',
  authenticate,
  async (req, res) => {
    try {
      const userId = req.user?.id || "system";
      const tenantId = req.tenantId;
      
      const stores = await permissionService.getUserAccessibleStores(userId, tenantId);
      res.json({ stores });
    } catch (error) {
      console.error('Error fetching accessible stores:', error);
      res.status(500).json({ message: 'Failed to fetch accessible stores' });
    }
  }
);

/**
 * @route GET /api/permissions/check
 * @desc Check if user has specific permission
 * @access Private
 */
router.get('/check',
  authenticate,
  async (req, res) => {
    try {
      const { permission, tenantId, storeId } = req.query;
      const userId = req.user?.id || "system";
      
      if (!permission) {
        return res.status(400).json({ message: 'Permission parameter is required' });
      }
      
      // Use rbacService instead of permissionService for permission checks
      const hasPermission = await rbacService.hasPermission(
        userId,
        permission,
        tenantId || req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"],
        storeId || req.user?.store_id || req.query?.store_id || req.headers["x-store-id"]
      );
      
      res.json({ hasPermission });
    } catch (error) {
      console.error('Error checking permission:', error);
      res.status(500).json({ message: 'Failed to check permission' });
    }
  }
);

module.exports = router;
