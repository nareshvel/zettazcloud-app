/**
 * Permission Seeding Service
 * Creates and assigns default permissions to tenant roles during onboarding
 */

const { pool } = require('../config/db');

class PermissionSeedingService {
  /**
   * Default permission sets for each role type
   */
  /**
   * Platform-scoped permission prefixes — mirrors isSystemPermissionName() in
   * rbacPermissionMiddleware. These are reserved for NULL-tenant system roles;
   * a tenant-scoped grant can never satisfy them, so no tenant role should
   * carry them (the checkbox would lie).
   */
  static PLATFORM_PREFIXES = ['platform.', 'tenants.', 'subscriptions.', 'plans.', 'support.'];

  /** WHERE fragment matching every permission a tenant role CAN hold. */
  static tenantScopedWhere(column = 'name') {
    return this.PLATFORM_PREFIXES.map(p => `${column} NOT LIKE '${p}%'`).join('\n           AND ');
  }

  static ROLE_PERMISSIONS = {
    // NOTE: 'Tenant Admin' is deliberately absent — its grant set is derived
    // in assignPermissionsToRole (all tenant-scoped permissions) because the
    // runtime admin bypass already gives it everything; a hardcoded list here
    // only ever drifted stale as new permissions were added to the catalog.

    'Store Manager': [
      // 60 permissions - Store operations excluding 21 advanced permissions
      'dashboard.view', 'reports.view', 'reports.export',
      'products.view', 'products.create', 'products.edit', 'products.import', 'products.export',
      'categories.view', 'categories.create', 'categories.edit',
      'inventory.view', 'inventory.adjust', 'inventory.history', 'inventory.count_approve',
      'sales.view', 'sales.create', 'sales.void', 'sales.refund', 'sales.discount',
      'customers.view', 'customers.create', 'customers.edit',
      'stores.view', 'stores.edit',
      'users.view', 'users.create', 'users.edit',
      'suppliers.view', 'suppliers.create', 'suppliers.edit',
      'tax.view', 'tax.create', 'tax.edit', 'payments.view', 'printer.view', 'printer.settings',
      'sales-return.view', 'sales-return.create', 'sales-return.process',
      'purchase-orders.view', 'purchase-orders.create', 'purchase-orders.edit',
      'grn.view', 'grn.create', 'grn.edit', 'grn.complete',
      'promotions.view', 'promotions.create', 'promotions.edit', 'promotions.delete', 'promotions.apply',
      'settings.view', 'settings.edit', 'settings.tax', 'settings.payment', 'settings.printer', 'settings.store',
      'orders.view', 'orders.fulfill', 'orders.delete',
      'employees.view', 'employees.create', 'employees.edit',
      'finance.view', 'finance.manage', 'finance.approve',
      'register.view', 'register.open', 'register.movement', 'register.close'
    ],

    'Cashier': [
      // 17 permissions - Essential POS operations only.
      // dashboard.view deliberately excluded (2026-09-03): this permission
      // was never actually gating navigation to the admin /dashboard route —
      // that navigation is gated by isAdminUser (see
      // frontend/src/utils/permissionUtils.ts), which every Cashier legitimately
      // fails. Every cashier holding dashboard.view meant it gated nothing
      // for this role and only obscured what the permission was actually for.
      // If a future feature needs a real "can see a dashboard widget"
      // permission for cashiers, grant it explicitly and deliberately rather
      // than relying on this broad grant.
      'products.view', 'categories.view', 'inventory.view',
      'sales.view', 'sales.create', 'sales.discount',
      'customers.view', 'customers.create', 'customers.edit',
      'tax.view', 'payments.view', 'printer.view', 'printer.settings',
      'sales-return.view', 'sales-return.create',
      'promotions.view', 'promotions.apply',
      'register.view', 'register.open', 'register.movement', 'register.close'
    ],
    
    'Inventory Manager': [
      // 28 permissions - Product and inventory focus
      'dashboard.view', 'reports.view',
      'products.view', 'products.create', 'products.edit', 'products.delete', 'products.import', 'products.export',
      'categories.view', 'categories.create', 'categories.edit', 'categories.delete',
      'inventory.view', 'inventory.adjust', 'inventory.transfer', 'inventory.history', 'inventory.count_approve',
      'suppliers.view', 'suppliers.create',
      'purchase-orders.view', 'purchase-orders.create', 'purchase-orders.edit', 'purchase-orders.delete', 'purchase-orders.approve',
      'grn.view', 'grn.create', 'grn.edit', 'grn.complete',
      'promotions.view'
    ],
    
    'Reports Viewer': [
      // 12 permissions - Read-only access to reports and analytics
      'dashboard.view', 'reports.view', 'reports.export',
      'products.view', 'categories.view', 'inventory.view',
      'sales.view', 'customers.view', 'suppliers.view',
      'purchase-orders.view', 'grn.view', 'promotions.view'
    ]
  };

  /**
   * Create default permissions for a tenant if they don't exist
   * @param {string} tenantId - Tenant ID (null for system-wide permissions)
   * @param {Object} connection - Database connection
   */
  static async ensurePermissionsExist(tenantId = null, connection) {
    const allPermissions = [
      // Dashboard & Reports (3)
      { name: 'dashboard.view', description: 'View store dashboard', module: 'dashboard' },
      { name: 'reports.view', description: 'View reports', module: 'reports' },
      { name: 'reports.export', description: 'Export reports', module: 'reports' },
      
      // Products (6)
      { name: 'products.view', description: 'View products', module: 'products' },
      { name: 'products.create', description: 'Create products', module: 'products' },
      { name: 'products.edit', description: 'Edit products', module: 'products' },
      { name: 'products.delete', description: 'Delete products', module: 'products' },
      { name: 'products.import', description: 'Import products', module: 'products' },
      { name: 'products.export', description: 'Export products', module: 'products' },
      
      // Categories (4)
      { name: 'categories.view', description: 'View categories', module: 'categories' },
      { name: 'categories.create', description: 'Create categories', module: 'categories' },
      { name: 'categories.edit', description: 'Edit categories', module: 'categories' },
      { name: 'categories.delete', description: 'Delete categories', module: 'categories' },
      
      // Inventory (4)
      { name: 'inventory.view', description: 'View inventory', module: 'inventory' },
      { name: 'inventory.adjust', description: 'Adjust inventory', module: 'inventory' },
      { name: 'inventory.transfer', description: 'Transfer inventory between stores', module: 'inventory' },
      { name: 'inventory.history', description: 'View inventory history', module: 'inventory' },
      { name: 'inventory.count_approve', description: 'Review and approve submitted stock counts', module: 'inventory' },
      
      // Finance (2)
      { name: 'finance.view', description: 'View expenses and outgoing payments', module: 'finance' },
      { name: 'finance.manage', description: 'Record, edit and void expenses and outgoing payments', module: 'finance' },
      { name: 'finance.approve', description: 'Approve expenses above the tenant approval threshold', module: 'finance' },

      // Cash Register (4)
      { name: 'register.view', description: 'View the cash register, session history and X/Z reports', module: 'register' },
      { name: 'register.open', description: 'Open a register session and set the starting float', module: 'register' },
      { name: 'register.movement', description: 'Record paid-ins and paid-outs on an open register', module: 'register' },
      { name: 'register.close', description: 'Close a register session and post the cash variance', module: 'register' },
      
      // Sales (5)
      { name: 'sales.view', description: 'View sales', module: 'sales' },
      { name: 'sales.create', description: 'Create sales', module: 'sales' },
      { name: 'sales.void', description: 'Void sales', module: 'sales' },
      { name: 'sales.refund', description: 'Process refunds', module: 'sales' },
      { name: 'sales.discount', description: 'Apply discounts', module: 'sales' },
      { name: 'sales.delete', description: 'Delete sales', module: 'sales' },
      { name: 'sales.override_tax_mode', description: 'Override store tax mode at checkout', module: 'sales' },
      { name: 'approvals.manager_override', description: 'Approve over-limit refunds and discounts via manager PIN', module: 'approvals' },

      // Sales Return (4)
      { name: 'sales-return.view', description: 'View sales returns', module: 'sales-return' },
      { name: 'sales-return.create', description: 'Create sales returns', module: 'sales-return' },
      { name: 'sales-return.process', description: 'Process sales returns', module: 'sales-return' },
      { name: 'sales-return.approve', description: 'Approve sales returns', module: 'sales-return' },
      
      // Customers (4)
      { name: 'customers.view', description: 'View customers', module: 'customers' },
      { name: 'customers.create', description: 'Create customers', module: 'customers' },
      { name: 'customers.edit', description: 'Edit customers', module: 'customers' },
      { name: 'customers.delete', description: 'Delete customers', module: 'customers' },
      
      // Stores (4)
      { name: 'stores.view', description: 'View stores', module: 'stores' },
      { name: 'stores.create', description: 'Create stores', module: 'stores' },
      { name: 'stores.edit', description: 'Edit stores', module: 'stores' },
      { name: 'stores.delete', description: 'Delete stores', module: 'stores' },
      
      // Users & Roles (8)
      { name: 'users.view', description: 'View users', module: 'users' },
      { name: 'users.create', description: 'Create users', module: 'users' },
      { name: 'users.edit', description: 'Edit users', module: 'users' },
      { name: 'users.delete', description: 'Delete users', module: 'users' },
      { name: 'roles.view', description: 'View roles', module: 'roles' },
      { name: 'roles.create', description: 'Create roles', module: 'roles' },
      { name: 'roles.edit', description: 'Edit roles', module: 'roles' },
      { name: 'roles.delete', description: 'Delete roles', module: 'roles' },
      
      // Suppliers (4)
      { name: 'suppliers.view', description: 'View suppliers', module: 'suppliers' },
      { name: 'suppliers.create', description: 'Create suppliers', module: 'suppliers' },
      { name: 'suppliers.edit', description: 'Edit suppliers', module: 'suppliers' },
      { name: 'suppliers.delete', description: 'Delete suppliers', module: 'suppliers' },
      
      // Purchase Orders (5)
      { name: 'purchase-orders.view', description: 'View purchase orders', module: 'purchase-orders' },
      { name: 'purchase-orders.create', description: 'Create purchase orders', module: 'purchase-orders' },
      { name: 'purchase-orders.edit', description: 'Edit purchase orders', module: 'purchase-orders' },
      { name: 'purchase-orders.delete', description: 'Delete purchase orders', module: 'purchase-orders' },
      { name: 'purchase-orders.approve', description: 'Approve purchase orders', module: 'purchase-orders' },
      
      // GRN (4)
      { name: 'grn.view', description: 'View goods receiving notes', module: 'grn' },
      { name: 'grn.create', description: 'Create goods receiving notes', module: 'grn' },
      { name: 'grn.edit', description: 'Edit goods receiving notes', module: 'grn' },
      { name: 'grn.complete', description: 'Complete goods receiving', module: 'grn' },
      { name: 'grn.delete', description: 'Delete goods receiving notes', module: 'grn' },
      
      // Promotions (5)
      { name: 'promotions.view', description: 'View promotional offers', module: 'promotions' },
      { name: 'promotions.create', description: 'Create promotional offers', module: 'promotions' },
      { name: 'promotions.edit', description: 'Edit promotional offers', module: 'promotions' },
      { name: 'promotions.delete', description: 'Delete promotional offers', module: 'promotions' },
      { name: 'promotions.apply', description: 'Apply promotional offers', module: 'promotions' },
      
      // Tax & Payments (6)
      { name: 'tax.view', description: 'View tax classes and rates', module: 'tax' },
      { name: 'tax.create', description: 'Create tax classes and rates', module: 'tax' },
      { name: 'tax.edit', description: 'Edit tax classes and rates', module: 'tax' },
      { name: 'tax.delete', description: 'Delete tax classes and rates', module: 'tax' },
      { name: 'payments.view', description: 'View payment methods', module: 'payments' },
      { name: 'payments.create', description: 'Create payment methods', module: 'payments' },
      { name: 'payments.edit', description: 'Edit payment methods', module: 'payments' },
      { name: 'payments.delete', description: 'Delete payment methods', module: 'payments' },
      { name: 'payments.refund', description: 'Refund payment transactions', module: 'payments' },
      
      // Printer (2)
      { name: 'printer.view', description: 'View printer settings', module: 'printer' },
      { name: 'printer.settings', description: 'Manage printer settings', module: 'printer' },
      
      // Settings (6)
      { name: 'settings.view', description: 'View tenant settings', module: 'settings' },
      { name: 'settings.edit', description: 'Edit tenant settings', module: 'settings' },
      { name: 'settings.tax', description: 'Manage tax settings', module: 'settings' },
      { name: 'settings.payment', description: 'Manage payment settings', module: 'settings' },
      { name: 'settings.printer', description: 'Manage printer settings', module: 'settings' },
      { name: 'settings.store', description: 'Manage store settings', module: 'settings' },
      
      // System Administration (4)
      { name: 'system.audit', description: 'View audit logs', module: 'system' },
      { name: 'system.backup', description: 'Create system backups', module: 'system' },
      { name: 'system.settings', description: 'Manage system settings', module: 'system' },
      { name: 'system.maintenance', description: 'Perform system maintenance', module: 'system' },
      { name: 'system.roles.manage', description: 'Manage platform-level system roles', module: 'system' },
      { name: 'system.plans.manage', description: 'Manage subscription plans', module: 'system' },
      { name: 'system.platform.manage', description: 'Platform administration', module: 'system' },
      
      // Orders (5)
      { name: 'orders.view', description: 'View orders', module: 'orders' },
      { name: 'orders.create', description: 'Create orders', module: 'orders' },
      { name: 'orders.edit', description: 'Edit orders', module: 'orders' },
      { name: 'orders.delete', description: 'Delete orders', module: 'orders' },
      { name: 'orders.fulfill', description: 'Fulfill orders', module: 'orders' },

      // Employees (4)
      { name: 'employees.view', description: 'View employees', module: 'employees' },
      { name: 'employees.create', description: 'Create employees', module: 'employees' },
      { name: 'employees.edit', description: 'Edit employees', module: 'employees' },
      { name: 'employees.delete', description: 'Delete employees', module: 'employees' },

      // Tenant & Subscription (2) — system-prefixed names are platform-level by design
      { name: 'tenants.edit', description: 'Edit tenant details', module: 'tenants' },
      { name: 'tenant.subscription.view', description: 'View and manage own tenant subscription', module: 'subscription' },

      // Platform administration (system console, /api/platform/*) — these are
      // system-scoped: only NULL-tenant roles may grant them; the tenant-admin
      // bypass in rbacPermissionMiddleware deliberately does not apply.
      { name: 'platform.view', description: 'View platform dashboard and statistics', module: 'platform' },
      { name: 'platform.manage', description: 'Manage platform settings and configuration', module: 'platform' },
      { name: 'platform.impersonate', description: 'Impersonate a tenant (open workspace)', module: 'platform' },
      { name: 'platform.features.manage', description: 'Manage per-tenant feature flags', module: 'platform' },
      { name: 'platform.announcements.manage', description: 'Manage platform announcements', module: 'platform' },
      { name: 'platform.audit.view', description: 'View platform audit log', module: 'platform' },
      { name: 'platform.health.view', description: 'View platform health and job runs', module: 'platform' },
      { name: 'tenants.view', description: 'View all tenants on the platform', module: 'tenants' },
      { name: 'tenants.create', description: 'Create new tenants', module: 'tenants' },
      { name: 'tenants.delete', description: 'Delete or schedule deletion of tenants', module: 'tenants' },
      { name: 'subscriptions.view', description: 'View all subscriptions', module: 'subscriptions' },
      { name: 'subscriptions.create', description: 'Create subscriptions', module: 'subscriptions' },
      { name: 'subscriptions.edit', description: 'Edit subscriptions', module: 'subscriptions' },
      { name: 'subscriptions.delete', description: 'Cancel or delete subscriptions', module: 'subscriptions' },
      { name: 'plans.view', description: 'View subscription plans', module: 'plans' },
      { name: 'plans.create', description: 'Create subscription plans', module: 'plans' },
      { name: 'plans.edit', description: 'Edit subscription plans', module: 'plans' },
      { name: 'plans.delete', description: 'Delete subscription plans', module: 'plans' },
      { name: 'support.view', description: 'View support tickets', module: 'support' },
      { name: 'support.respond', description: 'Respond to support tickets', module: 'support' },
      { name: 'support.escalate', description: 'Escalate support tickets', module: 'support' },
      { name: 'support.close', description: 'Close support tickets', module: 'support' },
      { name: 'system.logs.view', description: 'View system logs', module: 'system' },
      { name: 'system.settings.view', description: 'View system settings', module: 'system' },
      { name: 'system.settings.edit', description: 'Edit system settings', module: 'system' }
    ];

    // Insert permissions if they don't exist (system-wide, not tenant-specific)
    for (const permission of allPermissions) {
      await connection.execute(`
        INSERT IGNORE INTO permissions (name, description, module, created_at, updated_at)
        VALUES (?, ?, ?, NOW(), NOW())
      `, [permission.name, permission.description, permission.module]);
    }

    console.log(`✅ Ensured all ${allPermissions.length} permissions exist in database`);
  }

  /**
   * Assign permissions to a role
   * @param {string} roleId - Role ID
   * @param {string} roleName - Role name
   * @param {string} tenantId - Tenant ID
   * @param {Object} connection - Database connection
   */
  static async assignPermissionsToRole(roleId, roleName, tenantId, connection) {
    let permissions;

    if (roleName === 'Tenant Admin') {
      // Tenant admins bypass tenant-scoped permission checks at runtime, so
      // their stored grants must equal everything a tenant role can hold:
      // the whole catalog minus the platform-scoped prefixes (which tenant
      // grants can never satisfy anyway). Derived from the permissions table
      // rather than a static list so new permissions can't drift out of sync.
      [permissions] = await connection.execute(
        `SELECT id, name FROM permissions WHERE ${this.tenantScopedWhere()}`
      );
    } else {
      const permissionNames = this.ROLE_PERMISSIONS[roleName];

      if (!permissionNames || permissionNames.length === 0) {
        console.log(`⚠️ No permissions defined for role: ${roleName}`);
        return;
      }

      const placeholders = permissionNames.map(() => '?').join(',');
      [permissions] = await connection.execute(`
        SELECT id, name FROM permissions
        WHERE name IN (${placeholders})
      `, permissionNames);
    }

    // Seeding is additive-only: we never DELETE permissions a tenant granted
    // themselves — backfilling a default role must not silently strip tenant
    // customizations.
    for (const permission of permissions) {
      await connection.execute(`
        INSERT IGNORE INTO role_permissions (role_id, permission_id)
        VALUES (?, ?)
      `, [roleId, permission.id]);
    }

    console.log(`✅ Assigned ${permissions.length} permissions to role: ${roleName} (${roleId})`);
    return permissions.length;
  }

  /**
   * Create default roles with permissions for a new tenant
   * @param {string} tenantId - Tenant ID
   * @param {string} createdBy - User ID who creates the roles
   * @param {Object} connection - Database connection
   */
  static async createDefaultRolesWithPermissions(tenantId, createdBy, connection) {
    // Ensure permissions exist first
    await this.ensurePermissionsExist(tenantId, connection);

    const defaultRoles = [
      {
        name: 'Tenant Admin',
        description: 'Full administrative access to tenant resources',
        isSystemRole: true
      },
      {
        name: 'Store Manager',
        description: 'Manage store operations and staff',
        isSystemRole: true
      },
      {
        name: 'Cashier',
        description: 'Process sales and handle transactions',
        isSystemRole: true
      },
      {
        name: 'Inventory Manager',
        description: 'Manage product inventory and stock',
        isSystemRole: false
      },
      {
        name: 'Reports Viewer',
        description: 'View-only access to reports and analytics',
        isSystemRole: false
      }
    ];

    const createdRoles = [];

    for (const role of defaultRoles) {
      const roleId = require('crypto').randomUUID();
      
      // Create the role
      await connection.execute(`
        INSERT INTO roles (id, name, description, tenant_id, is_system_role, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        roleId,
        role.name,
        role.description,
        tenantId,
        role.isSystemRole ? 1 : 0,
        createdBy
      ]);

      // Assign permissions to the role
      const permissionCount = await this.assignPermissionsToRole(roleId, role.name, tenantId, connection);
      
      createdRoles.push({
        id: roleId,
        name: role.name,
        permissionCount
      });
    }

    console.log(`✅ Created ${createdRoles.length} default roles with permissions for tenant: ${tenantId}`);
    return createdRoles;
  }

  /**
   * Backfill permissions for existing roles that lack proper permissions
   * @param {string} tenantId - Tenant ID (optional, if null processes all tenants)
   */
  static async backfillExistingRoles(tenantId = null) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Ensure permissions exist
      await this.ensurePermissionsExist(tenantId, connection);

      // Get roles that need permission assignments
      let query = `
        SELECT r.id, r.name, r.tenant_id, 
               COUNT(rp.permission_id) as current_permission_count
        FROM roles r
        LEFT JOIN role_permissions rp ON r.id = rp.role_id
        WHERE r.name IN ('Tenant Admin', 'Store Manager', 'Cashier', 'Inventory Manager', 'Reports Viewer')
      `;
      let params = [];

      if (tenantId) {
        query += ' AND r.tenant_id = ?';
        params.push(tenantId);
      }

      query += ' GROUP BY r.id, r.name, r.tenant_id';

      const [roles] = await connection.execute(query, params);

      // Tenant Admin's expected set is derived (every tenant-scoped
      // permission), not a static list — count it from the catalog.
      const [tac] = await connection.execute(
        `SELECT COUNT(*) AS n FROM permissions WHERE ${this.tenantScopedWhere()}`
      );
      const tenantScopedCount = tac[0].n;

      let updatedRoles = 0;
      for (const role of roles) {
        const expectedPermissions = role.name === 'Tenant Admin'
          ? tenantScopedCount
          : this.ROLE_PERMISSIONS[role.name]?.length || 0;
        
        if (role.current_permission_count < expectedPermissions) {
          console.log(`🔧 Backfilling permissions for role: ${role.name} (${role.current_permission_count}/${expectedPermissions})`);
          
          await this.assignPermissionsToRole(role.id, role.name, role.tenant_id, connection);
          updatedRoles++;
        }
      }

      await connection.commit();
      console.log(`✅ Backfilled permissions for ${updatedRoles} roles`);
      return updatedRoles;

    } catch (error) {
      await connection.rollback();
      console.error('❌ Error backfilling role permissions:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = PermissionSeedingService;
