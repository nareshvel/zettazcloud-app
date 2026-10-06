/**
 * User Role Routes
 * Handles API endpoints for assigning roles to users
 */
const express = require('express');
const router = express.Router();
// Use the consolidated RBAC service instead of userRoleService
const rbacService = require('../services/rbacService');
const { authenticate, authorize, requireTenantId, requireStoreId } = require('../middleware/unifiedAuthMiddleware');
// Import the new RBAC permission middleware
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');
// Legacy middleware imports removed - now fully migrated to RBAC

/**
 * @route GET /api/user-roles/system
 * @desc Get all system role assignments
 * @access Private - System admin only
 */
router.get('/system',
  authenticate,
  requirePermission('system.roles.read'),
  async (req, res) => {
    try {
      const { includeRoles, includeUsers } = req.query;
      
      const userRoles = await userRoleService.getAllSystemRoleAssignments({
        includeRoles: includeRoles === 'true',
        includeUsers: includeUsers === 'true'
      });
      
      res.json({ userRoles });
    } catch (error) {
      console.error('Error fetching system role assignments:', error);
      res.status(500).json({ message: 'Failed to fetch system role assignments' });
    }
  }
);

/**
 * @route GET /api/user-roles/system/user/:userId
 * @desc Get system roles for a specific user
 * @access Private - System admin or self
 */
router.get('/system/user/:userId',
  authenticate,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { includeRoles } = req.query;
      
      // Allow users to see their own roles, or system admins to see any user's roles
      const isSelf = userId === req.user?.id || "system";
      const isSystemAdmin = req.user.systemRoles.includes('Super Admin') || 
                            req.user.systemRoles.includes('Platform Admin');
                            
      if (!isSelf && !isSystemAdmin) {
        return res.status(403).json({ 
          message: 'You are not authorized to view this user\'s system roles' 
        });
      }
      
      const roles = await userRoleService.getUserSystemRoles(userId, {
        includeRoles: includeRoles === 'true'
      });
      
      res.json({ roles });
    } catch (error) {
      console.error('Error fetching user system roles:', error);
      res.status(500).json({ message: 'Failed to fetch user system roles' });
    }
  }
);

/**
 * @route POST /api/user-roles/system/assign
 * @desc Assign system role to a user
 * @access Private - System admin only
 */
router.post('/system/assign',
  authenticate,
  requirePermission('system.roles.assign'),
  async (req, res) => {
    try {
      const { userId, roleId } = req.body;
      
      if (!userId || !roleId) {
        return res.status(400).json({ 
          message: 'User ID and Role ID are required' 
        });
      }
      
      const result = await userRoleService.assignSystemRole(userId, roleId);
      
      if (result.error) {
        return res.status(400).json({ message: result.error });
      }
      
      res.status(201).json({ 
        message: 'System role assigned successfully',
        userRole: result.userRole 
      });
    } catch (error) {
      console.error('Error assigning system role:', error);
      res.status(500).json({ message: 'Failed to assign system role' });
    }
  }
);

/**
 * @route DELETE /api/user-roles/system/remove
 * @desc Remove system role from a user
 * @access Private - System admin only
 */
router.delete('/system/remove',
  authenticate,
  requirePermission('system.roles.delete'),
  async (req, res) => {
    try {
      const { userId, roleId } = req.body;
      
      if (!userId || !roleId) {
        return res.status(400).json({ 
          message: 'User ID and Role ID are required' 
        });
      }
      
      // Prevent removing Super Admin role from the last Super Admin
      const result = await userRoleService.removeSystemRole(userId, roleId);
      
      if (result.error) {
        return res.status(400).json({ message: result.error });
      }
      
      res.json({ 
        message: 'System role removed successfully' 
      });
    } catch (error) {
      console.error('Error removing system role:', error);
      res.status(500).json({ message: 'Failed to remove system role' });
    }
  }
);

/**
 * @route GET /api/user-roles/tenant
 * @desc Get all tenant role assignments
 * @access Private - Tenant admin only
 */
router.get('/tenant',
  authenticate,
  requirePermission('tenant.roles.read'),
  async (req, res) => {
    try {
      const { includeRoles, includeUsers, storeId } = req.query;
      const tenantId = req.tenantId;
      
      const userRoles = await userRoleService.getAllTenantRoleAssignments(
        tenantId,
        {
          storeId,
          includeRoles: includeRoles === 'true',
          includeUsers: includeUsers === 'true'
        }
      );
      
      res.json({ userRoles });
    } catch (error) {
      console.error('Error fetching tenant role assignments:', error);
      res.status(500).json({ message: 'Failed to fetch tenant role assignments' });
    }
  }
);

/**
 * @route GET /api/user-roles/tenant/user/:userId
 * @desc Get tenant roles for a specific user
 * @access Private - Tenant admin or self
 */
router.get('/tenant/user/:userId',
  authenticate,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { includeRoles, storeId } = req.query;
      const tenantId = req.tenantId;
      
      // Allow users to see their own roles, or tenant admins to see any user's roles
      const isSelf = userId === req.user?.id || "system";
      const isTenantAdmin = req.user.permissions.includes(PERMISSIONS.TENANT.USERS.VIEW);
                            
      if (!isSelf && !isTenantAdmin) {
        return res.status(403).json({ 
          message: 'You are not authorized to view this user\'s tenant roles' 
        });
      }
      
      const roles = await userRoleService.getUserTenantRoles(
        userId, 
        tenantId,
        {
          storeId,
          includeRoles: includeRoles === 'true'
        }
      );
      
      res.json({ roles });
    } catch (error) {
      console.error('Error fetching user tenant roles:', error);
      res.status(500).json({ message: 'Failed to fetch user tenant roles' });
    }
  }
);

/**
 * @route POST /api/user-roles/tenant/assign
 * @desc Assign tenant role to a user
 * @access Private - Tenant admin only
 */
router.post('/tenant/assign',
  authenticate,
  requirePermission('tenant.roles.assign'),
  async (req, res) => {
    try {
      const { userId, roleId, storeId, scope } = req.body;
      const tenantId = req.tenantId;
      
      if (!userId || !roleId) {
        return res.status(400).json({ 
          message: 'User ID and Role ID are required' 
        });
      }
      
      // If scope is 'store', storeId is required
      if (scope === 'store' && !storeId) {
        return res.status(400).json({ 
          message: 'Store ID is required for store-scoped roles' 
        });
      }
      
      const result = await userRoleService.assignTenantRole(
        userId, 
        roleId, 
        tenantId, 
        { storeId, scope }
      );
      
      if (result.error) {
        return res.status(400).json({ message: result.error });
      }
      
      res.status(201).json({ 
        message: 'Role assigned successfully',
        userRole: result.userRole 
      });
    } catch (error) {
      console.error('Error assigning tenant role:', error);
      res.status(500).json({ message: 'Failed to assign tenant role' });
    }
  }
);

/**
 * @route DELETE /api/user-roles/tenant/remove
 * @desc Remove tenant role from a user
 * @access Private - Tenant admin only
 */
router.delete('/tenant/remove',
  authenticate,
  requirePermission('tenant.roles.delete'),
  async (req, res) => {
    try {
      const { userId, roleId, storeId } = req.body;
      const tenantId = req.tenantId;
      
      if (!userId || !roleId) {
        return res.status(400).json({ 
          message: 'User ID and Role ID are required' 
        });
      }
      
      // Prevent removing the last Tenant Admin
      const result = await userRoleService.removeTenantRole(
        userId, 
        roleId, 
        tenantId, 
        { storeId }
      );
      
      if (result.error) {
        return res.status(400).json({ message: result.error });
      }
      
      res.json({ 
        message: 'Role removed successfully' 
      });
    } catch (error) {
      console.error('Error removing tenant role:', error);
      res.status(500).json({ message: 'Failed to remove tenant role' });
    }
  }
);

/**
 * @route GET /api/user-roles/tenant/role/:roleId/users
 * @desc Get users assigned to a specific tenant role
 * @access Private - Tenant admin only
 */
router.get('/tenant/role/:roleId/users',
  authenticate,
  requirePermission('tenant.users.view'),
  async (req, res) => {
    try {
      const { roleId } = req.params;
      const { storeId } = req.query;
      const tenantId = req.tenantId;
      
      const users = await userRoleService.getUsersByTenantRole(
        roleId,
        tenantId,
        { storeId }
      );
      
      res.json({ users });
    } catch (error) {
      console.error('Error fetching users by role:', error);
      res.status(500).json({ message: 'Failed to fetch users by role' });
    }
  }
);

module.exports = router;
