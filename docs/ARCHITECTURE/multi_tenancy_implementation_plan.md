# Multi-Tenancy, Subscription, and RBAC Implementation Plan

## 1. Introduction & Goals

This document outlines the strategy and phased plan to implement a robust multi-tenancy architecture, subscription management, and comprehensive Role-Based Access Control (RBAC) for the Zettaz Cloud Enterprise POS system. The goal is to create a scalable platform where:

*   Multiple tenants can operate in isolation.
*   Tenants can subscribe to different service plans with varying features/modules.
*   Each tenant can manage its own users, roles, and permissions for its stores and resources.
*   A system-level (super admin) interface can manage tenants, plans, and system-wide settings.

This plan draws heavily from the concepts outlined in `docs/multi-tenant-modal-idea.md` and adapts them to the existing database structure.

## 2. Current State Analysis (Key Tables)

*   **`tenants`**: Exists. Contains `id`, `name`, `domain`, `settings` (json).
*   **`users`**: Exists. Contains `id`, `tenant_id`, `name`, `email`, `password_hash`, `role` (enum: admin, manager, cashier), `store_id`. Users are currently tied to a single tenant and store with a basic role.
*   **`stores`**: Exists. Contains `id`, `tenant_id`, `name`, and various operational settings. Well-structured for store management under a tenant.
*   **Missing**: `plans`, `tenant_subscriptions`, `user_tenant_memberships`, and detailed RBAC tables (`tenant_roles`, `tenant_permissions`, etc.) are currently not present.

## 3. Proposed Architecture

We will adopt a hybrid approach, enhancing the existing schema and adding new tables based on the `multi-tenant-modal-idea.md` proposal.

### 3.1. Core Tenant, User, and Store Management

*   **`users` Table (Modified):**
    *   Will become a central repository for all user accounts.
    *   Fields: `id` (PK), `first_name`, `last_name`, `email` (UNIQUE), `password_hash`, `phone_number`, `profile_picture_url`, `is_active`, `last_login_at`, `created_at`, `updated_at`.
    *   **Remove**: `tenant_id`, `store_id`, `role` (enum). These will be handled by `user_tenant_memberships`.
*   **`tenants` Table (Modified):**
    *   Fields: `id` (PK), `name`, `domain`, `contact_email` (NEW, for primary tenant contact), `status` (NEW, e.g., 'active', 'suspended', 'trial'), `settings` (json), `created_at`, `updated_at`.
*   **`stores` Table (Existing):**
    *   No major changes anticipated. Remains linked to `tenants.id` via its `tenant_id` FK.
*   **`user_tenant_memberships` Table (NEW):**
    *   Links users to tenants, defining their role and store access within that tenancy.
    *   Fields: `id` (PK), `user_id` (FK to `users.id`), `tenant_id` (FK to `tenants.id`), `role_id` (FK to `tenant_roles.id`), `store_id` (FK to `stores.id`, NULLABLE - allows tenant-level roles not tied to a specific store), `status` (e.g., 'active', 'pending_invitation', 'disabled'), `created_at`, `updated_at`.
    *   Composite UNIQUE key on (`user_id`, `tenant_id`, `store_id`) if a user can have only one role per store in a tenant, or (`user_id`, `tenant_id`, `role_id`) if roles are not store specific but user can have multiple roles in a tenant.

### 3.2. Subscription Plan Management

*   **`plans` Table (NEW):**
    *   Defines available subscription plans.
    *   Fields: `id` (PK), `name` (UNIQUE), `description`, `price_monthly` (DECIMAL), `price_annually` (DECIMAL, optional), `trial_days` (INT, optional), `modules` (JSON - list of enabled features/modules), `max_users` (INT, optional), `max_stores` (INT, optional), `is_active` (BOOLEAN - plan visibility), `is_public` (BOOLEAN - self-signup vs internal assignment), `sort_order` (INT), `created_at`, `updated_at`.
*   **`tenant_subscriptions` Table (NEW):**
    *   Tracks which tenant is subscribed to which plan.
    *   Fields: `id` (PK), `tenant_id` (FK to `tenants.id`, UNIQUE - a tenant has one active subscription), `plan_id` (FK to `plans.id`), `status` (ENUM: 'trialing', 'active', 'past_due', 'canceled', 'expired'), `start_date` (DATE), `end_date` (DATE, for fixed-term or trial), `next_billing_date` (DATE, for recurring), `trial_ends_at` (TIMESTAMP, optional), `canceled_at` (TIMESTAMP, optional), `current_period_start` (TIMESTAMP), `current_period_end` (TIMESTAMP), `metadata` (JSON, e.g., payment gateway subscription ID), `created_at`, `updated_at`.

### 3.3. Role-Based Access Control (RBAC) - Tenant-Level

*   **`tenant_roles` Table (NEW):**
    *   Roles defined by each tenant for their users.
    *   Fields: `id` (PK), `tenant_id` (FK to `tenants.id`), `name`, `description`, `is_default_for_new_users` (BOOLEAN), `is_system_defined` (BOOLEAN, e.g., a default 'Tenant Admin' role created on tenant setup), `created_at`, `updated_at`.
    *   Composite UNIQUE key on (`tenant_id`, `name`).
*   **`tenant_permissions` Table (NEW):**
    *   Permissions available within the application that tenants can assign.
    *   Fields: `id` (PK), `action` (e.g., 'create', 'read', 'update', 'delete'), `subject` (e.g., 'Product', 'Order', 'Customer', 'StoreSettings'), `description`, `module` (VARCHAR, e.g., 'Inventory', 'Sales', 'Reporting' - for grouping), `created_at`, `updated_at`.
    *   UNIQUE key on (`action`, `subject`). These are system-defined but tenant roles link to them.
*   **`tenant_role_permissions` Table (NEW - Junction Table):**
    *   Links tenant roles to permissions.
    *   Fields: `role_id` (FK to `tenant_roles.id`), `permission_id` (FK to `tenant_permissions.id`).
    *   Primary Key: (`role_id`, `permission_id`).

### 3.4. Role-Based Access Control (RBAC) - System-Level (Super Admin)

*   **`system_roles` Table (NEW):**
    *   Roles for system administrators (super admins).
    *   Fields: `id` (PK), `name` (UNIQUE, e.g., 'SuperAdmin', 'SupportLevel1'), `description`, `created_at`, `updated_at`.
*   **`system_permissions` Table (NEW):**
    *   Permissions for system-level operations (e.g., manage_tenants, manage_plans).
    *   Fields: `id` (PK), `action`, `subject`, `description`, `created_at`, `updated_at`.
    *   UNIQUE key on (`action`, `subject`).
*   **`system_role_permissions` Table (NEW - Junction Table):**
    *   Links system roles to system permissions.
    *   Fields: `role_id` (FK to `system_roles.id`), `permission_id` (FK to `system_permissions.id`).
    *   Primary Key: (`role_id`, `permission_id`).
*   **`user_system_roles` Table (NEW - Junction Table):**
    *   Assigns system roles to users.
    *   Fields: `user_id` (FK to `users.id`), `role_id` (FK to `system_roles.id`).
    *   Primary Key: (`user_id`, `role_id`).

## 4. Database Schema Changes Summary

*   **Modify `users`**: Remove `tenant_id`, `store_id`, `role`. Add `first_name`, `last_name` (or keep `name` if preferred, but split is common).
*   **Modify `tenants`**: Add `contact_email`, `status`.
*   **Create New Tables**: `user_tenant_memberships`, `plans`, `tenant_subscriptions`, `tenant_roles`, `tenant_permissions`, `tenant_role_permissions`, `system_roles`, `system_permissions`, `system_role_permissions`, `user_system_roles`.
*   **Foreign Keys & Indexes**: Ensure all FKs, indexes, and constraints (UNIQUE, NOT NULL) are properly defined for all new and modified tables.

## 5. Phased Implementation Plan

### Phase 1: Core Tenancy & User Structure Refactor
*   **Task 1.1**: Finalize `users` table structure (e.g., `name` vs `first_name`/`last_name`).
*   **Task 1.2**: Implement schema changes for `users` and `tenants` tables.
*   **Task 1.3**: Create `user_tenant_memberships` table.
*   **Task 1.4**: Develop data migration script for existing users:
    *   Move existing `users` to the new structure.
    *   For each old user, create a corresponding entry in `user_tenant_memberships`, linking them to their original `tenant_id` and `store_id`. A default `tenant_roles.id` will need to be pre-defined and used here (e.g., a migrated 'Admin' role).
*   **Task 1.5**: Update backend authentication and user management logic to use the new structure. User login should identify the user, then potentially allow tenant selection if part of multiple, or default to one.
*   **Task 1.6**: Update all existing queries and business logic that rely on `users.tenant_id` or `users.store_id` to fetch this information via `user_tenant_memberships` or context.

### Phase 2: Plans & Subscription Management
*   **Task 2.1**: Create `plans` and `tenant_subscriptions` tables.
*   **Task 2.2**: Backend API (Super Admin): CRUD operations for `plans`.
*   **Task 2.3**: Backend API (Tenant/System): Endpoints for a tenant to subscribe to a plan, view current subscription, and manage (e.g., cancel, change - future) subscription. This includes logic for `tenant_subscriptions` status changes.
*   **Task 2.4**: Frontend UI (Super Admin): Interface to manage plans.
*   **Task 2.5**: Frontend UI (Settings > Billing): Display available plans (from `plans` table), show current tenant subscription (from `tenant_subscriptions`), and allow selection (linking to backend).
*   **Task 2.6**: Implement logic to check subscription status and feature/module access based on `plans.modules` and `tenant_subscriptions.modules` (if override allowed).

### Phase 3: Tenant-Level RBAC Implementation
*   **Task 3.1**: Create `tenant_roles`, `tenant_permissions`, `tenant_role_permissions` tables.
*   **Task 3.2**: Populate `tenant_permissions` with all relevant application permissions (e.g., product:create, product:read, order:process, settings:manage_localization).
*   **Task 3.3**: Backend API (Tenant Admin): CRUD for `tenant_roles` (scoped to their tenant). Assign permissions from `tenant_permissions` to their custom roles via `tenant_role_permissions`.
*   **Task 3.4**: Backend API: Logic to assign users to tenant roles via `user_tenant_memberships.role_id`.
*   **Task 3.5**: Frontend UI (Tenant Admin): Interface to manage roles, users, and their permissions within their tenant.
*   **Task 3.6**: Implement permission checking middleware/decorators in the backend. All protected routes/actions should verify user's permissions based on their `user_tenant_memberships.role_id` and the associated `tenant_role_permissions`.
    *   **Note on Tenant Admin Access**: A designated 'Tenant Admin' role (or equivalent primary administrative role for a tenant, potentially marked by `tenant_roles.is_system_defined` or a specific known role name) should inherently grant access to *all* modules and features permitted by the tenant's active subscription plan. This access should effectively bypass granular permission checks for this specific role to ensure full administrative capability within the subscribed feature set. The subscription defines the boundary for the tenant; the Tenant Admin gets full control within that boundary.
*   **Task 3.7**: Update data migration (from Phase 1.4) to map old `users.role` (admin, manager, cashier) to new default `tenant_roles`.

### Phase 4: System-Level RBAC (Super Admin)
*   **Task 4.1**: Create `system_roles`, `system_permissions`, `system_role_permissions`, `user_system_roles` tables.
*   **Task 4.2**: Populate `system_permissions` (e.g., tenant:create, tenant:suspend, plan:manage).
*   **Task 4.3**: Backend API (Super Admin): CRUD for `system_roles`, assign permissions, assign users to system roles.
*   **Task 4.4**: Frontend UI (Super Admin Panel): Interface for these operations.
*   **Task 4.5**: Implement system-level permission checks for super admin functionalities.
    *   **Note on System Admin Access**: Users assigned a 'System Admin' (or 'Super Admin') role must have unconditional, unrestricted access to all system functionalities, modules, data, and tenant operations. All permission and subscription-based checks should be effectively bypassed for these roles to allow complete administrative oversight and intervention capabilities.

### Phase 5: Tenant Onboarding & User Invitation Flow
*   **Task 5.1**: Design tenant self-registration flow (if applicable) or super admin tenant creation flow.
    *   Includes selecting a plan during onboarding.
    *   Creation of an initial 'Tenant Admin' user for the new tenant.
*   **Task 5.2**: Design user invitation flow: Tenant admins invite users to their tenant. Invited users get an entry in `users` (if new) and `user_tenant_memberships` (with 'pending_invitation' status and assigned role/store).
*   **Task 5.3**: Implement backend logic for tenant creation, initial user setup, and invitation system.
*   **Task 5.4**: Frontend UI for tenant onboarding and user invitation.

## 6. API Endpoint Considerations (High-Level)

*   **Auth**: `/auth/login`, `/auth/register` (for new users, not tenant specific initially), `/auth/me` (to get user details and their tenant memberships).
*   **Super Admin API (`/api/system/admin/`):**
    *   `/tenants`, `/tenants/{id}` (CRUD for tenants)
    *   `/plans`, `/plans/{id}` (CRUD for plans)
    *   `/users`, `/users/{id}` (Manage all users)
    *   `/system-roles`, `/system-permissions`
*   **Tenant Admin API (`/api/tenant/{tenantId}/` or using tenant context from auth):**
    *   `/users` (Manage users within their tenant - CRUD on `user_tenant_memberships`)
    *   `/roles` (Manage `tenant_roles`)
    *   `/permissions` (List available `tenant_permissions`)
    *   `/subscription` (Manage their `tenant_subscriptions`)
    *   `/stores` (If tenant can manage their own stores)
*   **General API**: All existing operational APIs (products, orders, etc.) must be strictly tenant-aware, filtering by `tenant_id` derived from the authenticated user's context (`user_tenant_memberships`).

## 7. Frontend Considerations

*   **Authentication Flow**: Handle login, and potentially tenant selection if a user belongs to multiple active tenants.
*   **Context Management**: Store current user, active tenant, roles, permissions, and subscription details in a global context.
*   **UI Adaptation**: Conditionally render UI elements and enable/disable features based on user permissions and plan modules.
*   **Super Admin Panel**: A new section or separate application for system-level administration.
*   **Tenant Admin Settings**: Expanded settings area for user management, role management, store management (if applicable), and subscription details.

## 8. Key Decisions & Discussion Points

*   **User's `name` field**: Keep as single `name` or split into `first_name`, `last_name` in the `users` table?
*   **`user_tenant_memberships` uniqueness**: Define precise unique constraints based on how users, tenants, roles, and stores interact.
*   **Default Roles/Permissions**: Strategy for creating default roles (e.g., 'Tenant Admin', 'Store Manager', 'Cashier') and assigning a base set of permissions when a new tenant is created or a plan is chosen.
*   **Data Isolation**: Rigorously enforce `tenant_id` filtering in all database queries to ensure data segregation.

This plan provides a comprehensive roadmap. Each phase and task will require detailed technical design and iterative development. Collaboration and regular review will be key to success.
