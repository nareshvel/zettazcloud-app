# Migrations & Seeds — Applied Log

All files below have been applied to the database. Newest first.
See [README.md](./README.md) for the workflow.

## Migrations (`migrations/applied/`)

| File | Applied | Creates / changes |
|---|---|---|
| `2026-08-16_print_templates.sql` | 2026-08-16 | `print_templates`, `template_versions`, `duty_free_profiles`, `duty_free_invoice_sequences`, `duty_free_invoice_corrections` |
| `2026-08-16_print_device_registry.sql` | 2026-08-16 | `printer_devices`, `print_stations`, `print_jobs`, `print_routes` (security hardening) |
| `2026-08-08_serialized_inventory.sql` | 2026-08-08 | `product_pieces`, `product_piece_sequences`; adds `products.is_serialized` |
| `2026-08-08_old_gold_exchange.sql` | 2026-08-08 | `old_gold_purchases`, `old_gold_voucher_sequences` |
| `2026-08-08_repair_orders.sql` | 2026-08-08 | `repair_orders`, `repair_order_updates`, `repair_ticket_sequences` |
| `2026-08-08_employees_module.sql` | 2026-08-08 | `employees`, `employee_sales_targets`; adds `sales.employee_id` |
| `2026-08-08_industry_fields_and_pricing.sql` | 2026-08-08 | `industry_types`, `industry_field_definitions`, `tenant_field_overrides`, `tenant_cost_code_settings`; adds `tenants.industry_code` + product pricing/attribute columns |
| `2025-09-02_make_sales_returns_number_tenant_scoped.sql` | 2025-09-02 | `sales_returns.return_number` unique per tenant |
| `2025-08-16_performance_indexes.sql` | 2025-08-16 (pre-existing) | performance indexes |

## Seeds (`seeds/applied/`)

| File | Applied | Inserts |
|---|---|---|
| `2026-08-08_industry_field_definitions_seed.sql` | 2026-08-08 | industry types + default product fields (jewelry 11, pharmacy 7, apparel/electronics/grocery 6, general_retail 3) |
| `2025-06-18_permissions_roles_subscriptions.sql` | 2025-06-18 (pre-existing) | permissions / roles / subscription plans |
| `2025-06-18_rbac_seed_data.sql` | 2025-06-18 (pre-existing) | RBAC seed data |

## Verification queries (run in TablePlus)

```sql
-- Tables from the 2026-08-08 feature set should all exist:
SHOW TABLES LIKE 'industry\_%';
SHOW TABLES LIKE 'tenant\_field\_overrides';
SHOW TABLES LIKE 'tenant\_cost\_code\_settings';
SHOW TABLES LIKE 'employees';
SHOW TABLES LIKE 'employee\_sales\_targets';
SHOW TABLES LIKE 'repair\_%';
SHOW TABLES LIKE 'old\_gold\_%';
SHOW TABLES LIKE 'product\_piece%';

-- Added columns:
SHOW COLUMNS FROM products LIKE 'is_serialized';
SHOW COLUMNS FROM products LIKE 'purchase_price';
SHOW COLUMNS FROM products LIKE 'attributes';
SHOW COLUMNS FROM tenants  LIKE 'industry_code';
SHOW COLUMNS FROM sales    LIKE 'employee_id';

-- Seed sanity:
SELECT industry_code, COUNT(*) AS fields FROM industry_field_definitions GROUP BY industry_code;
```

Expected seed counts: jewelry 11, pharmacy 7, apparel 6, electronics 6, grocery 6, general_retail 3.
