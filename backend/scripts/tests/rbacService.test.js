/**
 * RBAC Service Tests
 * 
 * Tests the consolidated RBAC service functionality including:
 * - Role assignment and retrieval
 * - Permission checking
 * - Tenant admin detection
 */

const { expect } = require('chai');
const sinon = require('sinon');
const rbacService = require('../services/rbacService');
const db = require('../config/db');

describe('RBAC Service', () => {
  // Stub for database queries
  let dbQueryStub;
  
  beforeEach(() => {
    // Create a stub for database query
    dbQueryStub = sinon.stub(db, 'query');
  });
  
  afterEach(() => {
    // Restore all stubs
    sinon.restore();
  });
  
  describe('getUserRolesAndPermissions', () => {
    it('should fetch user system roles and permissions correctly', async () => {
      // Mock data for system roles
      const mockSystemRoles = [
        {
          role_id: 'sr1',
          role_name: 'system_admin',
          role_display_name: 'System Admin',
          permissions: ['system.users.manage', 'system.roles.manage']
        }
      ];
      
      // Set up stubs to return mock data
      dbQueryStub.onCall(0).resolves([mockSystemRoles, []]);
      
      // Call the function with a test user ID
      const result = await rbacService.getUserRolesAndPermissions('user123');
      
      // Verify the results
      expect(result).to.be.an('object');
      expect(result.roleIds).to.include('sr1');
      expect(result.roleNames).to.include('system_admin');
      expect(result.permissions).to.include('system.users.manage');
      expect(result.permissions).to.include('system.roles.manage');
    });
    
    it('should fetch user tenant roles and permissions with scope correctly', async () => {
      // Mock data for tenant roles
      const mockTenantRoles = [
        {
          role_id: 'tr1',
          role_name: 'tenant_admin',
          role_display_name: 'Tenant Admin',
          scope: 'tenant',
          tenant_id: 'tenant123',
          store_id: null,
          permissions: ['tenant.users.manage', 'tenant.roles.manage']
        },
        {
          role_id: 'tr2',
          role_name: 'store_manager',
          role_display_name: 'Store Manager',
          scope: 'store',
          tenant_id: 'tenant123',
          store_id: 'store456',
          permissions: ['store.inventory.manage', 'store.sales.view']
        }
      ];
      
      // Set up stubs to return mock data
      dbQueryStub.onCall(0).resolves([[], []]);
      dbQueryStub.onCall(1).resolves([mockTenantRoles, []]);
      
      // Call the function with a test user ID and tenant ID
      const result = await rbacService.getUserRolesAndPermissions('user123', 'tenant123');
      
      // Verify the results
      expect(result).to.be.an('object');
      expect(result.roleIds).to.include('tr1');
      expect(result.roleIds).to.include('tr2');
      expect(result.roleNames).to.include('tenant_admin');
      expect(result.roleNames).to.include('store_manager');
      expect(result.permissions).to.include('tenant.users.manage');
      expect(result.permissions).to.include('store.inventory.manage');
      
      // Verify scoped roles
      expect(result.tenantRoles['tenant123']).to.be.an('array');
      expect(result.storeRoles['store456']).to.be.an('array');
    });
  });
  
  describe('hasPermission', () => {
    it('should correctly determine if user has system permission', async () => {
      // Mock roles and permissions data
      const mockRolesAndPermissions = {
        permissions: ['system.users.manage', 'system.roles.view']
      };
      
      // Stub getUserRolesAndPermissions to return mock data
      sinon.stub(rbacService, 'getUserRolesAndPermissions').resolves(mockRolesAndPermissions);
      
      // Check for a permission the user has
      const hasPermission1 = await rbacService.hasPermission('user123', 'system.users.manage');
      expect(hasPermission1).to.be.true;
      
      // Check for a permission the user doesn't have
      const hasPermission2 = await rbacService.hasPermission('user123', 'system.settings.manage');
      expect(hasPermission2).to.be.false;
    });
    
    it('should correctly determine if user has tenant permission', async () => {
      // Mock roles and permissions data
      const mockRolesAndPermissions = {
        permissions: ['tenant.users.manage', 'tenant.roles.view']
      };
      
      // Stub getUserRolesAndPermissions to return mock data
      sinon.stub(rbacService, 'getUserRolesAndPermissions').resolves(mockRolesAndPermissions);
      
      // Check for a permission the user has
      const hasPermission1 = await rbacService.hasPermission('user123', 'tenant.users.manage', 'tenant123');
      expect(hasPermission1).to.be.true;
      
      // Check for a permission the user doesn't have
      const hasPermission2 = await rbacService.hasPermission('user123', 'tenant.settings.manage', 'tenant123');
      expect(hasPermission2).to.be.false;
    });
  });
  
  describe('isTenantAdmin', () => {
    it('should correctly identify tenant admin', async () => {
      // Mock data
      const mockRolesAndPermissions = {
        roleNames: ['tenant_admin'],
        hasRole: (role) => role === 'tenant_admin'
      };
      
      // Stub getUserRolesAndPermissions to return mock data
      sinon.stub(rbacService, 'getUserRolesAndPermissions').resolves(mockRolesAndPermissions);
      
      // Check if user is tenant admin
      const isAdmin = await rbacService.isTenantAdmin('user123', 'tenant123');
      expect(isAdmin).to.be.true;
    });
    
    it('should correctly identify non-admin users', async () => {
      // Mock data
      const mockRolesAndPermissions = {
        roleNames: ['store_manager'],
        hasRole: (role) => role === 'store_manager'
      };
      
      // Stub getUserRolesAndPermissions to return mock data
      sinon.stub(rbacService, 'getUserRolesAndPermissions').resolves(mockRolesAndPermissions);
      
      // Check if user is tenant admin
      const isAdmin = await rbacService.isTenantAdmin('user123', 'tenant123');
      expect(isAdmin).to.be.false;
    });
  });
  
  describe('role assignment', () => {
    it('should successfully assign system role to user', async () => {
      // Mock data
      const mockAssignmentResult = {
        id: 'assignment123',
        user_id: 'user123',
        role_id: 'role123',
        assigned_by: 'admin123',
        created_at: new Date().toISOString()
      };
      
      // Set up stub to return mock data
      dbQueryStub.resolves([{ insertId: 'assignment123' }, []]);
      
      // Call the function
      const result = await rbacService.assignSystemRole('user123', 'role123', 'admin123');
      
      // Verify the results
      expect(result).to.be.an('object');
      expect(dbQueryStub.calledOnce).to.be.true;
    });
    
    it('should successfully assign tenant role to user', async () => {
      // Mock data
      const mockAssignmentResult = {
        id: 'assignment123',
        user_id: 'user123',
        role_id: 'role123',
        tenant_id: 'tenant123',
        scope: 'tenant',
        store_id: null,
        assigned_by: 'admin123',
        created_at: new Date().toISOString()
      };
      
      // Set up stub to return mock data
      dbQueryStub.resolves([{ insertId: 'assignment123' }, []]);
      
      // Call the function
      const result = await rbacService.assignTenantRole(
        'user123', 'role123', 'tenant123', 'tenant', null, 'admin123'
      );
      
      // Verify the results
      expect(result).to.be.an('object');
      expect(dbQueryStub.calledOnce).to.be.true;
    });
  });
});
