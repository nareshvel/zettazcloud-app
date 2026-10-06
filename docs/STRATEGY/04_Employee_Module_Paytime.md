# Employee Module + Paytime Payroll Integration

Deliberately lean. Full payroll (salary, tax, attendance, payout) lives in the
**Paytime** application. Zettaz keeps only what the POS needs for performance
audit, sales targets, incentives and bonuses, and links each employee to Paytime
by `paytime_employee_id`.

## Data model (migration `2026-08-08_employees_module.sql`)

- `employees` — tenant/store scoped: code, name, contact, `job_title`,
  `commission_pct`, `is_sales_staff`, `paytime_employee_id`, optional link to a
  POS login `user_id`.
- `employee_sales_targets` — per employee per period (monthly/quarterly/yearly):
  `target_amount`, `incentive_pct` (bonus % on sales above target), `bonus_flat`
  (flat bonus on hitting target).
- `sales.employee_id` — additive column crediting a sale to a sales employee
  (separate from `cashier_id`), with an index for performance reporting.

## Backend

- `routes/employees.routes.js` (mounted at `/api/employees`): CRUD, `POST
  /:id/targets`, `GET /:id/performance?period_start&period_end` (achieved vs
  target + computed incentive), `GET /paytime/status`, `POST /:id/paytime/sync`.
- `services/paytimeService.js` — thin client (`configured`, `fetchEmployees`,
  `pushIncentive`). Degrades gracefully (returns `{ ok:false }`) so a Paytime
  outage never blocks a sale. Config via `PAYTIME_BASE_URL`, `PAYTIME_API_KEY`.

## Incentive computation

For a period, `achieved = SUM(sales.total WHERE employee_id, status='completed')`.
If `achieved >= target`: `incentive = bonus_flat + (achieved - target) *
incentive_pct/100`. Push the result to Paytime as an incentive line via
`/:id/paytime/sync`.

## Remaining / next

- Frontend: employee list/detail, target setup, and a performance dashboard
  (leaderboard by period). Backend endpoints are ready.
- POS: capture `employee_id` on the sale (dropdown of sales staff) so commissions
  attribute correctly.
- Scheduled monthly job to compute incentives and push to Paytime.
- Confirm the Paytime API contract (endpoints/auth) and finalize
  `paytimeService` request shapes.
