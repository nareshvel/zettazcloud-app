# Tenant Provisioning and Onboarding

This document defines the standard, deterministic flow for provisioning a new tenant and enabling the correct default features and permissions. It is designed to be idempotent, testable, and safe to run for both new signups and administrative backfills.

## Goals

- Ensure every new tenant is fully usable post-signup without manual debugging.
- Enable all currently implemented features by default for new tenants:
  - advanced_tax
  - promotional_offers
  - printer_integration
- Assign a robust default RBAC profile to the tenant admin so they can access all core features immediately.
- Provide a single provisioning function that can be retried safely.

## High-Level Flow

1) Signup completes (or an admin creates a tenant).
2) Backend calls `provisionTenant(tenantId, adminUserId)`.
3) Steps performed (idempotent):
   - Create a default store for the tenant if none exists.
   - Seed RBAC roles, permissions, assign `tenant_admin` to admin user.
   - Enable default feature flags for the tenant (including advanced modules listed above).
   - Seed baseline configurations (localization, receipt/printer defaults, optional tax defaults).
   - Initialize onboarding progress state so the wizard can reflect remaining steps.

## Data Model

- Features
  - Table: `features` (feature_id, key, label, description, status)
  - Table: `tenant_features` (tenant_id, feature_id, enabled, updated_at)
- RBAC
  - Tables exist: `roles`, `permissions`, `role_permissions`, `user_roles` (see `database/permissions_roles_subscriptions.sql`)
- Onboarding State
  - Table: `tenant_onboarding` (tenant_id, step, status, updated_at) OR JSONB column on `tenants` (steps and status)

All provisioning steps must use UPSERT patterns to be idempotent.

## Default Feature Flags for New Tenants

Enabled by default (current scope):
- advanced_tax
- promotional_offers
- printer_integration
- core modules implicitly enabled by existing UI/API (inventory, products, sales, customers, reports, settings_basic)

Notes:
- We maintain the ability to fine-tune features by subscription later; defaults apply to all new signups now.

## Default Roles and Permissions

On onboarding, the tenant admin receives complete access to all implemented modules and features. We seed exactly two tenant roles ready for assignment by the tenant admin: Store Manager and Cashier (no other tenant roles are auto-created).

### Tenant Admin (Full Access)

The initial tenant admin user has full access to all modules and features. Baseline permission coverage (non-exhaustive; wildcards allowed where supported):

- settings.*
- tax.*
- products.*
- inventory.*
- customers.*
- categories.*
- sales.*
- payments.*
- printer.*
- promotional_offers.*
- reports.*
- dashboard.*

If category wildcards are not defined for some modules, we expand to granular permissions during migration. Until then, wildcard support in the frontend `permissionUtils` and backend checks should be honored.

### Store Manager (All except Reports)

Purpose: Manage day-to-day operations, but not view analytics/reports.

Include:
- settings.view, settings.edit
- tax.view, tax.edit
- products.*
- inventory.*
- customers.*
- categories.*
- sales.*
- payments.*
- printer.*
- promotional_offers.*
- dashboard.*

Exclude:
- reports.*

### Cashier (POS-only)

Purpose: Operate POS with minimal management access. Based on existing route/UI usage filters in `backend/routes/roleRoutes.js`.

Include:
- sales.*
- customers.view, customers.create
- payments.*
- tax.view
- printer.*
- products.view
- categories.view
- dashboard.view

Exclude:
- inventory.*
- products.edit/create/delete
- settings.*
- promotional_offers.* (unless business requires visibility; default off for Cashier)
- reports.*

Notes:
- Sales returns: not found as a separate module in code search; unless dedicated keys/routes exist, returns are treated under `sales.*` (e.g., `sales.return.create/view`). If separate keys are later introduced, seed them accordingly.
- If additional permission keys exist for promotions or printer, we will align seeds to the exact keys (e.g., `promotions.view`/`promotions.edit`, `printer.manage`).

## Backend Implementation Plan

- Service: `backend/services/tenantProvisioningService.js`
  - `async function provisionTenant(tenantId, adminUserId, options)`
  - Steps (all UPSERT/idempotent):
    1. Ensure default store exists.
    2. Ensure tenant roles exist: `Store Manager`, `Cashier` (no other tenant roles seeded).
    3. Seed permissions for these roles as defined above (Store Manager all except reports; Cashier POS-only).
    4. Grant the initial admin user full access (tenant admin) without creating additional tenant roles. This can be via attaching a full-permission set directly, or by leveraging the existing `systemRoles` Tenant Admin bypass recognized in `frontend/src/utils/permissionUtils.ts`.
    5. Ensure features exist in `features`; enable for tenant in `tenant_features`:
       - advanced_tax, promotional_offers, printer_integration (true)
    6. Seed baseline configuration:
       - Localization defaults (currency, country, timezone) from signup payload or sensible defaults (e.g., USD/US/America/Chicago) until user completes onboarding.
       - Printer defaults: basic profile. Advanced integrations can be configured later.
       - Tax: set default class/rate only if we have a safe default for the tenant locale; otherwise let UI wizard complete.
    7. Initialize onboarding steps with statuses (e.g., business_profile, store_created, localization_set, tax_configured, payment_setup).

- Route to trigger provisioning (admin-only):
  - `POST /api/admin/tenants/:tenantId/provision` (for manual retries/ops). This calls the service.

- Middleware helpers:
  - Add `requireFeature('key')` in `backend/middleware/unifiedAuthMiddleware` (or similar) to gate APIs behind feature flags where desired. For now, advanced features are enabled by default for new tenants.

## Frontend Implementation Plan

- Feature Flags
  - Add `FeatureFlagContext` (e.g., `frontend/src/contexts/FeatureFlagContext.tsx`).
  - Endpoint: `GET /api/features` returns enabled keys for current tenant.
  - Use flags in UI alongside permission checks to render features.

- Onboarding Wizard (`frontend/src/pages/OnboardingWizard.tsx`)
  - Ensure it:
    - Links/creates default store if missing
    - Saves localization (currency/country/timezone)
    - Shows tax step (advanced_tax enabled by default) and completes store’s default tax config
    - Optionally nudges printer setup if `printer_integration` is enabled

- POS/Cart/Reports
  - Respect both permissions and feature flags. For example, advanced tax components only render if `tax.view` and `advanced_tax` are enabled.

## Idempotency & Safety

- Each step checks for existing rows and uses UPSERT.
- All steps are individually try/catch logged; the service returns a summary of what was created/updated.
- The provisioning endpoint is admin-protected and internally rate-limited.

## Rollout & Migration

- Script: `scripts/backfill_tenant_provisioning.js`
  - Iterates all tenants; ensures roles/permissions and features enabled.
  - Logs differences; no destructive updates.

## Testing

- Unit tests for `tenantProvisioningService` (idempotency, correct grants, feature enables).
- API tests for provisioning endpoint and feature list endpoint.
- E2E smoke: signup -> provision -> login as tenant_admin -> verify menus/pages for advanced tax, promotions, printer are available.

## Open Items / Validation Needed

- Permission keys for promotional offers and printer integration have not been explicitly found in code. If backend routes enforce specific permission keys (e.g., `promotions.view`, `promotions.edit`, `printer.manage`), we will add them to the default grant. Otherwise, feature flags will control UI visibility and backend routes should either not enforce extra permissions or use `settings.*`/module wildcards.
- Confirm whether wildcard permissions (e.g., `products.*`) are acceptable for tenant_admin initially. If not, we will expand to explicit granular permissions.

## Deliverables Summary

1) `tenantProvisioningService.js` with `provisionTenant()`
2) Admin route: `POST /api/admin/tenants/:tenantId/provision`
3) Feature flag tables and GET endpoint (`/api/features`)
4) Frontend `FeatureFlagContext` + gating
5) Onboarding wizard refinements
6) Backfill script for existing tenants
7) Tests (unit + API + minimal E2E)
