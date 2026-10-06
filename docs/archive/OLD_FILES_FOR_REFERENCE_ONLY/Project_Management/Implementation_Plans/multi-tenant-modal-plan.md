Multi Tenant Module Doc
You’re viewing user-generated content that may be unverified or unsafe.
Report
ChatGPT
Edit with ChatGPT
Multi-Tenant Access Control Library Documentation
Project Overview
This document outlines a complete development guide for creating a reusable multi-tenant access control library. The library enables management of subscription plans, user roles, permissions, and feature/module access, integrated with a MySQL database and usable across any project using NestJS and React.

Goals
Modular, plug-and-play design.

Super admin can create/edit/delete plans.

tenants subscribe to plans with defined modules.

Each tenant manages its own users, roles, and permissions.

Auto-assign default roles and permissions.

Stack Summary
Layer	Technology
Backend	NestJS, TypeORM
Frontend	React, TypeScript
Database	MySQL (InnoDB)
Auth	JWT + PassportJS
Dev Tools	Docker, Swagger, Jest
Database Structure (Core)
✅ Included Entities:
users, user_tenant_memberships, user_system_roles

tenants, tenant_roles, tenant_permissions, tenant_role_permissions

plans, tenant_subscriptions

🔄 Recommended Modifications:
plans.modules as structured JSON array:

["featureA", "featureB"]
Add seed data with default roles and permissions.

Backend Setup (NestJS)
1. Project Structure
src/
├── auth/
├── users/
├── tenants/
├── subscriptions/
├── roles/
├── permissions/
├── common/
│   ├── decorators/
│   └── guards/
└── main.ts
2. Entity Relationships
Users can belong to multiple tenants.

Each tenant manages Roles, Permissions, and Subscriptions.

Plans define modules available and user limits.

3. Middleware for Tenant Context
Use middleware to extract tenant (tenant) ID per request.

@Injectable()
export class TenantMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const orgId = req.headers['x-org-id'];
    req['orgId'] = orgId;
    next();
  }
}
4. Guards & Decorators
@UseGuards(RolesGuard)
@Roles('org_admin')
@ModuleAccess('featureA')
5. Permission Service
Check user access at runtime:

canAccess(userId: string, permission: string, orgId: string): boolean
Frontend Setup (React)
1. Folder Structure
src/
├── components/
├── pages/
│   ├── dashboard/
│   └── subscriptions/
├── services/
├── hooks/
├── context/
└── App.tsx
2. Route Guard Example
<Route
  path="/feature-a"
  element={<ModuleGuard module="featureA"><FeatureAComponent /></ModuleGuard>}
/>
3. ModuleGuard Component
function ModuleGuard({ module, children }) {
  const { modules } = useContext(AuthContext);
  return modules.includes(module) ? children : <NoAccessPage />;
}
4. Admin Interface
CRUD for subscription plans

Module selection using UI components

Role/permission management

Database Seeding Guide
📁 Seed File Structure (SQL)
-- Plans
INSERT INTO plans (id, name, price_monthly, duration_months, modules) VALUES
(UUID(), 'Starter', 0.00, 1, '["featureA"]'),
(UUID(), 'Pro', 49.99, 1, '["featureA", "featureB"]');

-- System Roles
INSERT INTO system_roles (id, name) VALUES
(UUID(), 'admin');

-- System Permissions
INSERT INTO system_permissions (id, name, category) VALUES
(UUID(), 'create_plan', 'plans'),
(UUID(), 'edit_plan', 'plans');

-- Link Roles to Permissions
INSERT INTO system_role_permissions (role_id, permission_id) VALUES
('admin_role_id', 'create_plan_permission_id'),
('admin_role_id', 'edit_plan_permission_id');

-- tenant Roles
INSERT INTO tenant_roles (id, tenant_id, name, is_default) VALUES
(UUID(), 'org_id', 'org_admin', 1);

-- tenant Permissions
INSERT INTO tenant_permissions (id, tenant_id, name, action, subject) VALUES
(UUID(), 'org_id', 'Manage FeatureA', 'manage', 'featureA');

-- Link tenant Roles to Permissions
INSERT INTO tenant_role_permissions (role_id, permission_id) VALUES
('org_admin_role_id', 'manage_featureA_permission_id');
💡 Default Users
-- Super Admin User
INSERT INTO users (id, email, password_hash) VALUES (UUID(), 'admin@example.com', '<hashed_password>');

-- tenant Admin
INSERT INTO users (id, email, password_hash) VALUES (UUID(), 'orgadmin@example.com', '<hashed_password>');
INSERT INTO user_tenant_memberships (user_id, tenant_id, role_id) VALUES
('orgadmin_user_id', 'org_id', 'org_admin_role_id');
Developer Setup
1. Backend
npm install
npm run start:dev
Configure .env with MySQL connection.

2. Frontend
npm install
npm start
Configure .env with backend API URL.

3. Database
mysql -u root -p < digitpulse_paytime.sql
mysql -u root -p < seed_data.sql
Optional Improvements
Use Prisma for schema management

Dockerize the app

Add request logging and monitoring

Add rate limiting and tenant isolation tools

Summary
This library equips any project with ready-to-use multi-tenant access control, including:

Subscription plan management

Module-based access

Role and permission management

Developers can build business-specific features on top of this structure, using this as a secure and scalable foundation.



Database Structure (Core)

✅ Included Entities (with recommended definitions):

CREATE TABLE `users` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `first_name` varchar(50),
  `last_name` varchar(50),
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` tinyint(1) DEFAULT 0
);

CREATE TABLE `tenants` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `name` varchar(255) NOT NULL,
  `email` varchar(100),
  `status` varchar(50) DEFAULT 'active',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE `user_tenant_memberships` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `user_id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `role_id` varchar(36),
  `status` varchar(50) DEFAULT 'active',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
);

CREATE TABLE `plans` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `name` varchar(255) NOT NULL,
  `price_monthly` decimal(10,2) NOT NULL,
  `duration_months` int NOT NULL,
  `modules` JSON,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE `tenant_subscriptions` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `tenantId` varchar(36) NOT NULL,
  `planId` varchar(36) NOT NULL,
  `status` enum('active','trial','expired','cancelled','pending') DEFAULT 'pending',
  `startDate` date NOT NULL,
  `endDate` date NOT NULL,
  `modules` JSON,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`planId`) REFERENCES `plans`(`id`)
);

CREATE TABLE `tenant_roles` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `tenant_id` varchar(36) NOT NULL,
  `name` varchar(50) NOT NULL,
  `description` text,
  `is_default` tinyint(1) DEFAULT 0,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE `tenant_permissions` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `tenant_id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `action` varchar(50) NOT NULL,
  `subject` varchar(50) NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE `tenant_role_permissions` (
  `role_id` varchar(36) NOT NULL,
  `permission_id` varchar(36) NOT NULL,
  PRIMARY KEY (`role_id`, `permission_id`),
  FOREIGN KEY (`role_id`) REFERENCES `tenant_roles`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`permission_id`) REFERENCES `tenant_permissions`(`id`) ON DELETE CASCADE
);

CREATE TABLE `system_roles` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `name` varchar(50) NOT NULL,
  `description` text,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE `system_permissions` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `name` varchar(255) NOT NULL,
  `category` varchar(255) NOT NULL DEFAULT 'general',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE `system_role_permissions` (
  `role_id` varchar(36) NOT NULL,
  `permission_id` varchar(36) NOT NULL,
  PRIMARY KEY (`role_id`, `permission_id`),
  FOREIGN KEY (`role_id`) REFERENCES `system_roles`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`permission_id`) REFERENCES `system_permissions`(`id`) ON DELETE CASCADE
);

CREATE TABLE `user_system_roles` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `user_id` varchar(36) NOT NULL,
  `role_id` varchar(36) NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`role_id`) REFERENCES `system_roles`(`id`) ON DELETE CASCADE
);

🔄 Recommended Enhancements to Original Schema

Ensure all UUID columns use DEFAULT (UUID()).

Enforce unique constraints where necessary (e.g., plan name).

Add indexes on common query fields (e.g., tenant_id, user_id).

Normalize modules in tenant_subscriptions based on plans.modules with fallback.

Enforce foreign key constraints for full integrity.

