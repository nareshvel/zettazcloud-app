-- =============================================================================
-- Teardown: Diamond Republic (all data)
-- Date: 2026-08-15
-- Run BEFORE the new Antigua seed.
-- Deletes every row owned by tenant e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c
-- in safe dependency order.
-- =============================================================================

-- Pin the connection collation: @T inherits collation_connection, and mysql2
-- connects with utf8mb4_unicode_ci by default, which cannot compare against
-- utf8mb4_0900_ai_ci columns (Illegal mix of collations on = @T).
SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;

SET @T = 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c';

SET FOREIGN_KEY_CHECKS = 0;

-- ── 1. Savings schemes ────────────────────────────────────────────────────────
DELETE p FROM savings_scheme_payments p
  INNER JOIN savings_scheme_enrollments e ON p.enrollment_id = e.id
  WHERE e.tenant_id = @T;
DELETE FROM savings_scheme_enrollments WHERE tenant_id = @T;
DELETE FROM savings_scheme_plans       WHERE tenant_id = @T;

-- ── 2. Layaway ────────────────────────────────────────────────────────────────
DELETE p FROM layaway_payments p
  INNER JOIN layaway_plans lp ON p.layaway_id = lp.id
  WHERE lp.tenant_id = @T;
DELETE i FROM layaway_items i
  INNER JOIN layaway_plans lp ON i.layaway_id = lp.id
  WHERE lp.tenant_id = @T;
DELETE FROM layaway_plans     WHERE tenant_id = @T;
DELETE FROM layaway_sequences WHERE tenant_id = @T;

-- ── 3. Memo / consignment ─────────────────────────────────────────────────────
DELETE mi FROM memo_items mi
  INNER JOIN memo_transactions mt ON mi.memo_id = mt.id
  WHERE mt.tenant_id = @T;
DELETE FROM memo_transactions WHERE tenant_id = @T;
DELETE FROM memo_sequences    WHERE tenant_id = @T;

-- ── 4. Old gold ───────────────────────────────────────────────────────────────
DELETE FROM old_gold_purchases        WHERE tenant_id = @T;
DELETE FROM old_gold_voucher_sequences WHERE tenant_id = @T;

-- ── 5. Repairs ───────────────────────────────────────────────────────────────
DELETE u FROM repair_order_updates u
  INNER JOIN repair_orders ro ON u.repair_order_id = ro.id
  WHERE ro.tenant_id = @T;
DELETE FROM repair_orders           WHERE tenant_id = @T;
DELETE FROM repair_ticket_sequences WHERE tenant_id = @T;

-- ── 6. Metal rates & pricing settings ────────────────────────────────────────
DELETE FROM metal_rates             WHERE tenant_id = @T;
DELETE FROM tenant_pricing_settings WHERE tenant_id = @T;

-- ── 7. Sales ──────────────────────────────────────────────────────────────────
DELETE si FROM sale_items si
  INNER JOIN sales s ON si.sale_id = s.id
  WHERE s.tenant_id = @T;
DELETE FROM sales WHERE tenant_id = @T;

-- ── 8. Serialized inventory ───────────────────────────────────────────────────
DELETE FROM product_pieces          WHERE tenant_id = @T;
DELETE FROM product_piece_sequences WHERE tenant_id = @T;

-- ── 9. Catalog sync ───────────────────────────────────────────────────────────
DELETE cl FROM channel_product_links cl
  INNER JOIN sales_channels sc ON cl.channel_id = sc.id
  WHERE sc.tenant_id = @T;
DELETE FROM channel_sync_queue WHERE tenant_id = @T;
DELETE FROM sales_channels     WHERE tenant_id = @T;

-- ── 10. Attachments ───────────────────────────────────────────────────────────
DELETE FROM attachments WHERE tenant_id = @T;

-- ── 11. CRM ───────────────────────────────────────────────────────────────────
DELETE w FROM customer_wishlist_items w
  INNER JOIN customers c ON w.customer_id = c.id
  WHERE c.tenant_id = @T;

-- ── 12. Customers & suppliers ─────────────────────────────────────────────────
DELETE FROM customers             WHERE tenant_id = @T;
DELETE FROM customer_code_sequences WHERE tenant_id = @T;
DELETE FROM suppliers             WHERE tenant_id = @T;

-- ── 13. Employees ─────────────────────────────────────────────────────────────
DELETE st FROM employee_sales_targets st
  INNER JOIN employees e ON st.employee_id = e.id
  WHERE e.tenant_id = @T;
DELETE FROM employees WHERE tenant_id = @T;

-- ── 14. Products & categories ─────────────────────────────────────────────────
DELETE FROM products   WHERE tenant_id = @T;
DELETE FROM categories WHERE tenant_id = @T;

-- ── 15. RBAC ──────────────────────────────────────────────────────────────────
DELETE rp FROM role_permissions rp
  INNER JOIN roles r ON rp.role_id = r.id
  WHERE r.tenant_id = @T;
DELETE ur FROM user_roles ur
  INNER JOIN users u ON ur.user_id = u.id
  WHERE u.tenant_id = @T;
DELETE ur FROM user_roles ur
  INNER JOIN roles r ON ur.role_id = r.id
  WHERE r.tenant_id = @T;
DELETE FROM roles WHERE tenant_id = @T;
DELETE FROM users WHERE tenant_id = @T;

-- ── 16. Store & tenant ────────────────────────────────────────────────────────
DELETE FROM stores  WHERE tenant_id = @T;
DELETE FROM tenants WHERE id = @T;

-- ── 17. Migration history (allow re-seeding) ──────────────────────────────────
DELETE FROM schema_migrations WHERE filename LIKE '%diamond_republic%';

SET FOREIGN_KEY_CHECKS = 1;

-- Done. All Diamond Republic rows removed.
