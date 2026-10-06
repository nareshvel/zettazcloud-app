/**
 * Role Routes
 * Handles API endpoints for roles management (both system and tenant)
 */
const express = require('express');
const router = express.Router();
const roleService = require('../services/roleService');
const permissionService = require('../services/permissionService');
const { pool } = require('../config/db');
const { authenticate, authorize, requireTenantId, requireStoreId } = require('../middleware/unifiedAuthMiddleware');
// Import the new RBAC permission middleware
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');
const { auditReq } = require('../services/auditLogService');
// Legacy middleware imports removed - now fully migrated to RBAC

/**
 * @route GET /api/roles
 * @desc Get all roles for the current tenant
 * @access Private - Requires valid JWT token with tenant_id
 */
router.get('/',
  authenticate,
  async (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      
      const { includePermissions } = req.query;
      const roles = await roleService.getTenantRoles(tenantId, {
        includePermissions: includePermissions === 'true'
      });
      
      res.json({ roles });
    } catch (error) {
      console.error('Error fetching tenant roles:', error);
      res.status(500).json({ message: 'Failed to fetch roles' });
    }
  }
);

/**
 * @route GET /api/roles/system
 * @desc Get all system roles
 * @access Private - System admin only
 */
router.get('/system',
  authenticate,
  requirePermission('system.roles.manage'),
  async (req, res) => {
    try {
      const { includePermissions } = req.query;
      const roles = await roleService.getSystemRoles({
        includePermissions: includePermissions === 'true'
      });
      res.json({ roles });
    } catch (error) {
      console.error('Error fetching system roles:', error);
      res.status(500).json({ message: 'Failed to fetch system roles' });
    }
  }
);

/**
 * @route GET /api/roles/system/:id
 * @desc Get a specific system role by ID
 * @access Private - System admin only
 */
router.get('/system/:id',
  authenticate,
  requirePermission('system.roles.manage'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { includePermissions } = req.query;
      
      const role = await roleService.getSystemRoleById(id, {
        includePermissions: includePermissions === 'true'
      });
      
      if (!role) {
        return res.status(404).json({ message: 'System role not found' });
      }
      
      res.json({ role });
    } catch (error) {
      console.error('Error fetching system role:', error);
      res.status(500).json({ message: 'Failed to fetch system role' });
    }
  }
);

/**
 * @route POST /api/roles/system
 * @desc Create a new system role
 * @access Private - System admin only
 */
router.post('/system',
  authenticate,
  requirePermission('system.roles.manage'),
  async (req, res) => {
    try {
      const { name, description, permissions } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: 'Role name is required' });
      }
      
      const role = await roleService.createSystemRole({
        name,
        description,
        permissions
      });

      await auditReq(req, {
        action: 'system_role_created',
        entity_type: 'role',
        entity_id: role?.id || null,
        severity: 'high',
        new_values: { name, description, permissions },
      });

      res.status(201).json({
        message: 'System role created successfully',
        role
      });
    } catch (error) {
      console.error('Error creating system role:', error);
      res.status(500).json({ message: 'Failed to create system role' });
    }
  }
);

/**
 * @route PUT /api/roles/system/:id
 * @desc Update a system role
 * @access Private - System admin only
 */
router.put('/system/:id',
  authenticate,
  requirePermission('system.roles.manage'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, permissions } = req.body;
      
      // Prevent modifying protected system roles
      const role = await roleService.getSystemRoleById(id);
      if (role && (role.name === 'Super Admin' || role.name === 'Platform Admin')) {
        return res.status(403).json({ 
          message: 'Cannot modify protected system roles' 
        });
      }
      
      const updatedRole = await roleService.updateSystemRole(id, {
        name,
        description,
        permissions
      });

      if (!updatedRole) {
        return res.status(404).json({ message: 'System role not found' });
      }

      await auditReq(req, {
        action: 'system_role_updated',
        entity_type: 'role',
        entity_id: id,
        severity: 'high',
        old_values: { name: role.name, description: role.description },
        new_values: { name, description, permissions },
      });

      res.json({
        message: 'System role updated successfully',
        role: updatedRole
      });
    } catch (error) {
      console.error('Error updating system role:', error);
      res.status(500).json({ message: 'Failed to update system role' });
    }
  }
);

/**
 * @route DELETE /api/roles/system/:id
 * @desc Delete a system role
 * @access Private - System admin only
 */
router.delete('/system/:id',
  authenticate,
  requirePermission('system.roles.manage'),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // Prevent deleting protected system roles
      const role = await roleService.getSystemRoleById(id);
      if (!role) {
        return res.status(404).json({ message: 'System role not found' });
      }
      
      if (role.name === 'Super Admin' || role.name === 'Platform Admin') {
        return res.status(403).json({ 
          message: 'Cannot delete protected system roles' 
        });
      }
      
      const result = await roleService.deleteSystemRole(id);

      if (result.error) {
        return res.status(400).json({
          message: result.error
        });
      }

      await auditReq(req, {
        action: 'system_role_deleted',
        entity_type: 'role',
        entity_id: id,
        severity: 'critical',
        old_values: { name: role.name, description: role.description },
      });

      res.json({
        message: 'System role deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting system role:', error);
      res.status(500).json({ message: 'Failed to delete system role' });
    }
  }
);

/**
 * @route GET /api/roles/tenant
 * @desc Get all tenant roles
 * @access Private - Tenant admin only
 */
router.get('/tenant/:tenantId',
  authenticate,
  requirePermission('roles.view'),
  async (req, res) => {
    try {
      const { tenantId } = req.params;
      const { includePermissions } = req.query;
      
      const roles = await roleService.getTenantRoles(tenantId, {
        includePermissions: includePermissions === 'true'
      });
      
      res.json({ roles });
    } catch (error) {
      console.error('Error fetching tenant roles:', error);
      res.status(500).json({ message: 'Failed to fetch tenant roles' });
    }
  }
);

/**
 * @route GET /api/roles/permissions/:roleId
 * @desc Get all permissions for a specific role
 * @access Private - Requires authentication and appropriate permissions
 */
router.get('/permissions/:roleId',
  authenticate,
  async (req, res) => {
    try {
      const { roleId } = req.params;
      const isSystemRole = req.query.isSystemRole === 'true';
      
      // Log for debugging
      // Debug logging removed for cleaner console output
      // Debug logging removed for cleaner console output
      
      // Get permissions for the role and ensure it's always an array
      let rolePermissions = await permissionService.getPermissionsByRoleId(roleId, isSystemRole);
      
      // Ensure rolePermissions is always an array
      rolePermissions = Array.isArray(rolePermissions) ? rolePermissions : [];
      
      // Debug logging removed for cleaner console output
      
      // Get all available permissions to show which ones are assigned
      let allPermissions = [];
      try {
        if (isSystemRole) {
          allPermissions = await permissionService.getSystemPermissions();
        } else {
          allPermissions = await permissionService.getTenantPermissions();
        }
        
        // Ensure allPermissions is always an array
        if (!allPermissions || !Array.isArray(allPermissions)) {
          // Debug logging removed for cleaner console output
          allPermissions = [];
        }
        
        // Debug logging removed for cleaner console output
      } catch (permError) {
        console.error('Error getting all permissions:', permError);
        allPermissions = []; // Fallback to empty array on error
      }
      
      // Get the role to determine its purpose
      let role;
      if (isSystemRole) {
        role = await roleService.getSystemRoleById(roleId);
        // Debug logging removed for cleaner console output
      } else {
        // For tenant roles, just use the roleId
        // Debug logging removed for cleaner console output
      }
      
      // Filter permissions by role type to only show relevant ones
      // STRICT filtering: system roles should NEVER see platform/system permissions
      // This is a two-step filtering approach for better control
      let filteredPermissions = [];
      
      // First, remove ALL platform and system permissions for ANY system role
      if (isSystemRole) {
        filteredPermissions = allPermissions.filter(permission => {
          const permName = permission.name;
          return !permName.startsWith('platform.') && 
                 !permName.startsWith('system.');
        });
        
        // Debug logging removed for cleaner console output
      } else {
        // For tenant roles, hide system/platform permissions — the write path
        // (roleService + PUT /permissions/:roleId) rejects them, so offering
        // them in the UI would only produce 400s and dead grants.
        filteredPermissions = allPermissions.filter(permission => {
          const permName = permission.name;
          return !/^(platform|system|tenants|subscriptions|plans|support)\./.test(permName);
        });
      }
      
      // Second, apply role-specific filtering
      filteredPermissions = filteredPermissions.filter(permission => {
        const permName = permission.name;
        
        // For system roles, apply special filtering
        if (isSystemRole && role && role.name) {
          // Debug logging removed for cleaner console output
          
          if (role.name === 'Cashier') {
            // Cashier should ONLY see these specific permissions
            return permName.startsWith('sales.') || 
                   permName.startsWith('customers.') ||
                   permName.startsWith('payments.') ||
                   permName.startsWith('tax.') ||
                   permName.startsWith('printer.') ||
                   permName === 'dashboard.view' ||
                   permName === 'products.view' ||
                   permName === 'categories.view' ||
                   permName === 'inventory.view';
          } 
          else if (role.name === 'Store Manager') {
            // Store Manager should see store-level permissions
            // Exclude tenant admin, platform, system, and subscription permissions
            return !permName.startsWith('tenant.') && 
                   !permName.startsWith('subscriptions.');
          }
          else if (role.name === 'Reports Viewer') {
            // Reports viewer should ONLY see view permissions
            return permName.endsWith('.view') ||
                   permName === 'dashboard.view' ||
                   permName === 'reports.view';
          }
          else if (role.name === 'Tenant Admin') {
            // Tenant Admin sees all tenant-level permissions (platform/system already filtered)
            return true;
          }
        }
        
        // For tenant roles or unrecognized system roles, keep all available permissions
        // that survived the first filtering step
        return true;
      });
      
      // Debug logging removed for cleaner console output
      
      // Debug logging removed for cleaner console output
      
      // Mark permissions as assigned or not
      const assignedPermissionIds = rolePermissions.map(p => p.id);
      const formattedPermissions = filteredPermissions.map(permission => ({
        ...permission,
        assigned: assignedPermissionIds.includes(permission.id)
      }));
      
      // Return permissions with their assignment state
      res.json({ permissions: formattedPermissions });
    } catch (error) {
      console.error('Error fetching role permissions:', error);
      res.status(500).json({ message: 'Failed to fetch role permissions' });
    }
  }
);

/**
 * @route GET /api/roles/tenant/:id
 * @desc Get a specific tenant role by ID
 * @access Private - Tenant admin only
 */
router.get('/tenant/:id',
  authenticate,
  requirePermission('roles.view'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { includePermissions } = req.query;
      const tenantId = req.tenantId;
      
      const role = await roleService.getTenantRoleById(id, tenantId, {
        includePermissions: includePermissions === 'true'
      });
      
      if (!role) {
        return res.status(404).json({ message: 'Role not found' });
      }
      
      res.json({ role });
    } catch (error) {
      console.error('Error fetching tenant role:', error);
      res.status(500).json({ message: 'Failed to fetch tenant role' });
    }
  }
);

/**
 * @route POST /api/roles/tenant
 * @desc Create a new tenant role
 * @access Private - Tenant admin only
 */
router.post('/tenant',
  authenticate,
  requirePermission('roles.create'),
  async (req, res) => {
    try {
      const { name, description } = req.body || {};
      let { permissions } = req.body || {};
      const tenantId = req.tenantId || req.user?.tenant_id || req.headers['x-tenant-id'];
      
      if (!name) {
        return res.status(400).json({ message: 'Role name is required' });
      }
      if (!tenantId) {
        return res.status(400).json({ message: 'Missing tenant context' });
      }
      // Normalize permissions to array of strings
      if (!Array.isArray(permissions)) permissions = [];
      permissions = permissions
        .map((p) => (typeof p === 'string' ? p : p?.id))
        .filter(Boolean);
      
      // Require authenticated user id for created_by to satisfy FK constraints
      const createdBy = req.user && req.user.id ? req.user.id : null;
      if (!createdBy) {
        return res.status(401).json({ message: 'Unauthorized: missing user context' });
      }

      const role = await roleService.createTenantRole(String(tenantId), {
        name,
        description: description ?? '',
        permissions
      }, createdBy);

      await auditReq(req, {
        action: 'role_created',
        entity_type: 'role',
        entity_id: role?.id || null,
        new_values: { name, description: description ?? '', permissions },
      });

      res.status(201).json({
        message: 'Role created successfully',
        role
      });
    } catch (error) {
      // Enhanced logging and error mapping
      console.error('Error creating tenant role:', {
        message: error?.message,
        code: error?.code,
        sqlMessage: error?.sqlMessage,
      });
      // Map common FK errors to 400 with actionable message
      if (error?.code === 'ER_NO_REFERENCED_ROW_2' || error?.errno === 1452) {
        return res.status(400).json({ 
          message: 'Invalid reference: ensure all permission IDs and created_by user exist.' 
        });
      }
      res.status(500).json({ message: 'Failed to create tenant role' });
    }
  }
);

/**
 * @route PUT /api/roles/tenant/:id
 * @desc Update a tenant role
 * @access Private - Tenant admin only
 */
router.put('/tenant/:id',
  authenticate,
  requirePermission('roles.edit'),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if req.body exists and log it for debugging
      if (!req.body) {
        console.error('Error: req.body is undefined in PUT /api/roles/tenant/:id');
        return res.status(400).json({ message: 'Request body is required' });
      }
      
      // Debug logging removed for cleaner console output
      
      // Handle both camelCase and snake_case property names
      const name = req.body.name;
      const description = req.body.description;
      const permissions = req.body.permissions;
      const tenantId = req.tenantId || req.user?.tenant_id;
      
      // Prevent modifying Tenant Admin role permissions
      const role = await roleService.getTenantRoleById(id, tenantId);
      if (role && role.name === 'Tenant Admin' && permissions) {
        return res.status(403).json({ 
          message: 'Cannot modify Tenant Admin role permissions' 
        });
      }
      
      const updatedRole = await roleService.updateTenantRole(id, tenantId, {
        name: role && role.name === 'Tenant Admin' ? 'Tenant Admin' : name, // Prevent renaming Tenant Admin
        description,
        permissions
      });

      if (!updatedRole) {
        return res.status(404).json({ message: 'Role not found' });
      }

      await auditReq(req, {
        action: 'role_updated',
        entity_type: 'role',
        entity_id: id,
        old_values: { name: role?.name, description: role?.description },
        new_values: { name: updatedRole.name ?? name, description, permissions },
      });

      res.json({
        message: 'Role updated successfully',
        role: updatedRole
      });
    } catch (error) {
      console.error('Error updating tenant role:', error);
      res.status(500).json({ message: 'Failed to update tenant role' });
    }
  }
);

/**
 * @route DELETE /api/roles/tenant/:id
 * @desc Delete a tenant role
 * @access Private - Tenant admin only
 */
router.delete('/tenant/:id',
  authenticate,
  requirePermission('roles.delete'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId;
      
      // Prevent deleting protected tenant roles
      const role = await roleService.getTenantRoleById(id, tenantId);
      if (!role) {
        return res.status(404).json({ message: 'Role not found' });
      }
      
      if (role.name === 'Tenant Admin') {
        return res.status(403).json({ 
          message: 'Cannot delete the Tenant Admin role' 
        });
      }
      
      const result = await roleService.deleteTenantRole(id, tenantId);

      if (result.error) {
        return res.status(400).json({
          message: result.error
        });
      }

      await auditReq(req, {
        action: 'role_deleted',
        entity_type: 'role',
        entity_id: id,
        severity: 'high',
        old_values: { name: role.name, description: role.description },
      });

      res.json({
        message: 'Role deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting tenant role:', error);
      res.status(500).json({ message: 'Failed to delete tenant role' });
    }
  }
);

/**
 * @route PUT /api/roles/permissions/:roleId
 * @desc Update permissions for a specific role
 * @access Private - Requires admin permissions
 */
router.put('/permissions/:roleId',
  authenticate,
  requirePermission('roles.edit'),
  async (req, res) => {
    try {
      const { roleId } = req.params;
      const { permissions, isSystemRole = false } = req.body;
      const tenantId = req.tenantId || req.user?.tenant_id;

      if (!Array.isArray(permissions)) {
        return res.status(400).json({ message: 'Permissions must be an array of permission IDs' });
      }

      if (isSystemRole) {
        // System roles are platform objects — only a platform admin may touch them
        if (!req.user.isSystemAdmin) {
          return res.status(403).json({ message: 'Not authorized to modify system role permissions' });
        }
      } else {
        // Tenant scoping: the role must belong to the caller's tenant.
        // Without this check anyone with roles.edit could rewrite
        // role_permissions for ANY tenant's role (or a system-seeded role in
        // this tenant) by guessing its ID.
        const role = await roleService.getTenantRoleById(roleId, tenantId);
        if (!role) {
          return res.status(404).json({ message: 'Role not found' });
        }
        if (role.is_system_role) {
          return res.status(403).json({ message: 'Cannot modify permissions of a system role' });
        }

        // Tenant roles must never carry system/platform permissions — those
        // resolve through user_system_roles, not role_permissions, so granting
        // them here would be a dead grant at best and a future escalation
        // surface at worst.
        const [rows] = await pool.query(
          `SELECT name FROM permissions WHERE id IN (${permissions.map(() => '?').join(',') || "''"})`,
          permissions.length ? permissions : []
        );
        const blocked = (rows || [])
          .map(r => r.name)
          .filter(n => /^(platform|system|tenants|subscriptions|plans|support)\./.test(n));
        if (blocked.length) {
          return res.status(400).json({
            message: `System permissions cannot be granted to tenant roles: ${blocked.join(', ')}`
          });
        }
      }

      // Snapshot the old permission set for the audit trail before rewriting
      const oldPerms = await permissionService.getPermissionsByRoleId(roleId, isSystemRole);
      const oldNames = (Array.isArray(oldPerms) ? oldPerms : []).map(p => p.name).sort();

      await permissionService.updateRolePermissions(roleId, permissions, isSystemRole);

      // Flush cached permission sets for every user holding this role
      const rbacService = require('../services/rbacService');
      await rbacService.invalidateRoleUsersCache(roleId);

      // Resolve the new permission names for the audit record
      const [newRows] = permissions.length
        ? await pool.query(
            `SELECT name FROM permissions WHERE id IN (${permissions.map(() => '?').join(',')})`,
            permissions
          )
        : [[]];
      const newNames = (newRows || []).map(r => r.name).sort();

      await auditReq(req, {
        action: 'role_permissions_updated',
        entity_type: 'role_permission',
        entity_id: roleId,
        severity: 'high',
        old_values: { isSystemRole, permissions: oldNames },
        new_values: { isSystemRole, permissions: newNames },
      });

      res.json({ success: true, message: 'Role permissions updated successfully' });
    } catch (error) {
      console.error('Error updating role permissions:', error);
      res.status(500).json({ message: 'Failed to update role permissions' });
    }
  }
);

/**
 * @route GET /api/roles/user/:userId/permissions
 * @desc Get user's permissions across all their roles
 * @access Private - Requires authentication
 */
router.get('/user/:userId/permissions',
  authenticate,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const tenantId = req.user.tenant_id;
      const storeId = req.headers['store-id'] || null;
      
      // Can only fetch permissions for yourself or if you have management permission.
      // Use the service-level check — invoking requirePermission() as a function
      // sends its own 403 response before this handler can decide.
      const isSelf = userId === req.user.id;
      const rbacService = require('../services/rbacService');
      const hasManagePermission = await rbacService.isTenantAdmin(req.user.id, tenantId) ||
        await rbacService.hasPermission(req.user.id, 'users.view', tenantId, storeId);
      
      if (!isSelf && !hasManagePermission) {
        return res.status(403).json({ message: 'Not authorized to view other users permissions' });
      }
      
      const permissions = await permissionService.getUserPermissions(userId, tenantId, storeId);
      res.json({ permissions });
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      res.status(500).json({ message: 'Failed to fetch user permissions' });
    }
  }
);

/**
 * @route GET /api/roles/tenant/:id/limits
 * @desc List numeric caps configured for a tenant role (Phase 2d)
 * @access Private - roles.view
 */
router.get('/tenant/:id/limits',
  authenticate,
  requirePermission('roles.view'),
  async (req, res) => {
    try {
      const tenantId = req.tenantId || req.user?.tenant_id;
      const role = await roleService.getTenantRoleById(req.params.id, tenantId);
      if (!role) return res.status(404).json({ message: 'Role not found' });

      const [rows] = await pool.query(
        'SELECT id, limit_type, limit_value FROM role_limits WHERE role_id = ? AND tenant_id = ? ORDER BY limit_type',
        [req.params.id, tenantId]
      );
      res.json({ limits: rows });
    } catch (error) {
      console.error('Error fetching role limits:', error);
      res.status(500).json({ message: 'Failed to fetch role limits' });
    }
  }
);

/**
 * @route PUT /api/roles/tenant/:id/limits
 * @desc Replace a tenant role's numeric caps.
 *       Body: { limits: [{ limit_type: 'discount_percent'|'discount_amount'|'refund_amount', limit_value: number }] }
 *       Missing types are cleared — the body is the complete desired set.
 * @access Private - roles.edit
 */
router.put('/tenant/:id/limits',
  authenticate,
  requirePermission('roles.edit'),
  async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const tenantId = req.tenantId || req.user?.tenant_id;
      const role = await roleService.getTenantRoleById(req.params.id, tenantId);
      if (!role) return res.status(404).json({ message: 'Role not found' });

      const VALID = ['discount_percent', 'discount_amount', 'refund_amount'];
      const limits = Array.isArray(req.body?.limits) ? req.body.limits : [];
      for (const l of limits) {
        if (!VALID.includes(l.limit_type)) {
          return res.status(400).json({ message: `Invalid limit_type: ${l.limit_type}` });
        }
        const v = Number(l.limit_value);
        if (!isFinite(v) || v < 0) {
          return res.status(400).json({ message: `limit_value must be a non-negative number for ${l.limit_type}` });
        }
      }

      const [oldRows] = await connection.query(
        'SELECT limit_type, limit_value FROM role_limits WHERE role_id = ? AND tenant_id = ?',
        [req.params.id, tenantId]
      );

      await connection.beginTransaction();
      await connection.query('DELETE FROM role_limits WHERE role_id = ? AND tenant_id = ?', [req.params.id, tenantId]);
      for (const l of limits) {
        await connection.query(
          `INSERT INTO role_limits (tenant_id, role_id, limit_type, limit_value, created_by)
           VALUES (?, ?, ?, ?, ?)`,
          [tenantId, req.params.id, l.limit_type, Number(l.limit_value), req.user.id]
        );
      }
      await connection.commit();

      // Caps live inside effective-permission decisions — flush holders
      const rbacService = require('../services/rbacService');
      await rbacService.invalidateRoleUsersCache(req.params.id);

      await auditReq(req, {
        action: 'role_limits_updated',
        entity_type: 'role',
        entity_id: req.params.id,
        severity: 'high',
        old_values: { limits: oldRows },
        new_values: { limits },
      });

      res.json({ message: 'Role limits updated' });
    } catch (error) {
      await connection.rollback().catch(() => {});
      console.error('Error updating role limits:', error);
      res.status(500).json({ message: 'Failed to update role limits' });
    } finally {
      connection.release();
    }
  }
);

module.exports = router;
