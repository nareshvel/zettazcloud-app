# ADR-0001: Employees vs Users — keep separate, link, don't merge

**Status:** Accepted · 2026-08-08

## Context

We now have two people-related concepts:

- **Users** (`users` table): authentication + authorization identities. Have
  `email`, `password_hash`, `is_active`, `email_verified`, tenant scope, and RBAC
  roles/permissions. A user is *someone who can log in*.
- **Employees** (`employees` table, new): workforce records for sales performance
  — `commission_pct`, sales targets, incentives, and a `paytime_employee_id` link
  to the Paytime payroll app. An employee is *a staff member we track/pay*.

The question: move Employees under an "Administration" menu group, or **merge**
Employees and User Management into one screen/entity?

## Decision

**Keep them as two separate entities, linked by `employees.user_id` (already
present). Do not merge the tables.** Present them together under **Administration**
in the nav, and add an optional "link to login account" affordance on the employee
record.

## Why not merge

The two concepts have a genuine many-to-few, not one-to-one, relationship:

- **Not every employee is a user.** A salesperson tracked for commission may never
  log into the POS; payroll-only staff live in Paytime. Forcing a login account
  (email + password) for every employee is wrong and noisy.
- **Not every user is an employee.** The owner, an external accountant, a
  head-office admin, or an integration/service account are users with no sales
  targets or commission.
- **Different lifecycles & security surfaces.** Users involve credentials, email
  verification, RBAC, session security, lockouts. Employees involve HR/performance
  data and a payroll integration. Merging couples a security-sensitive table to an
  HR table and complicates both.
- **Payroll ownership is Paytime.** Employees deliberately stay lean and defer
  salary/tax/attendance to Paytime via `paytime_employee_id`. Merging into `users`
  would blur that boundary.

This mirrors how mature retail/HR systems model it (identity/IAM separate from the
workforce/HR record, joined by a foreign key).

## Consequences / implementation

- **Nav:** `Administration` group contains **Settings**, **User Management**
  (access & roles), and **Employees** (workforce & performance). Implemented in
  `Sidebar.tsx`.
- **Linking:** `employees.user_id` optionally points at a `users` row. Add a
  picker on the employee form ("link to login account") so a salesperson who also
  logs in is connected — enabling: show the employee's performance on their user
  profile, and pre-fill employee from an existing user.
- **Labels to reduce confusion:** consider surfacing them as
  "Users & Roles" (access) vs "Team / Employees" (workforce).
- **Future option (non-breaking):** a combined "People" landing page with two
  tabs (Access, Team) that read from both tables — presentation only, tables stay
  separate.

## Alternatives considered

1. **Merge into one `people`/`users` table with a `type` flag.** Rejected:
   couples security and HR concerns, forces credentials on non-login staff, and
   fights the Paytime boundary.
2. **Employees under Sales Operations.** Reasonable (it's performance-centric) but
   administratively it's people management; Administration groups it with User
   Management so all "who works here / who can log in" lives in one place.
