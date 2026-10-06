-- Generated tenant hard-delete script
-- Replace @tenant_id with the UUID of the tenant to delete.
-- Stop the backend app before running to avoid lock contention.

-- Pin connection collation so the @tenant_id variable and string literals
-- match the schema's utf8mb4_0900_ai_ci (mysql2/TablePlus default to
-- unicode_ci -> "Illegal mix of collations" without this).
SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;

SET @tenant_id = '__TENANT_ID__';
SET @tenant_name = (SELECT name FROM tenants WHERE id = @tenant_id);

SET SESSION FOREIGN_KEY_CHECKS = 0;
SET SESSION innodb_lock_wait_timeout = 600;

DELETE c FROM `sale_items` c
JOIN `sales` p ON c.`sale_id` COLLATE utf8mb4_0900_ai_ci = p.`id` COLLATE utf8mb4_0900_ai_ci
WHERE p.tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE c FROM `sale_item_discounts` c
JOIN `sales` p ON c.`sale_id` COLLATE utf8mb4_0900_ai_ci = p.`id` COLLATE utf8mb4_0900_ai_ci
WHERE p.tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE c FROM `sale_applied_offers` c
JOIN `sales` p ON c.`sale_id` COLLATE utf8mb4_0900_ai_ci = p.`id` COLLATE utf8mb4_0900_ai_ci
WHERE p.tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE c FROM `sales_return_items` c
JOIN `sales_returns` p ON c.`sales_return_id` COLLATE utf8mb4_0900_ai_ci = p.`id` COLLATE utf8mb4_0900_ai_ci
WHERE p.tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE c FROM `grn_items` c
JOIN `goods_received_notes` p ON c.`grn_id` COLLATE utf8mb4_0900_ai_ci = p.`id` COLLATE utf8mb4_0900_ai_ci
WHERE p.tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE c FROM `purchase_order_items` c
JOIN `purchase_orders` p ON c.`purchase_order_id` COLLATE utf8mb4_0900_ai_ci = p.`id` COLLATE utf8mb4_0900_ai_ci
WHERE p.tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE c FROM `tax_class_rates` c
JOIN `tax_classes` p ON c.`tax_class_id` COLLATE utf8mb4_0900_ai_ci = p.`id` COLLATE utf8mb4_0900_ai_ci
WHERE p.tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE c FROM `offer_price_tiers` c
JOIN `promotional_offers` p ON c.`offer_id` COLLATE utf8mb4_0900_ai_ci = p.`id` COLLATE utf8mb4_0900_ai_ci
WHERE p.tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE c FROM `offer_rules` c
JOIN `promotional_offers` p ON c.`offer_id` COLLATE utf8mb4_0900_ai_ci = p.`id` COLLATE utf8mb4_0900_ai_ci
WHERE p.tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE c FROM `offer_usage` c
JOIN `promotional_offers` p ON c.`offer_id` COLLATE utf8mb4_0900_ai_ci = p.`id` COLLATE utf8mb4_0900_ai_ci
WHERE p.tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE c FROM `role_permissions` c
JOIN `roles` p ON c.`role_id` COLLATE utf8mb4_0900_ai_ci = p.`id` COLLATE utf8mb4_0900_ai_ci
WHERE p.tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE c FROM `user_roles` c
JOIN `users` p ON c.`user_id` COLLATE utf8mb4_0900_ai_ci = p.`id` COLLATE utf8mb4_0900_ai_ci
WHERE p.tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE c FROM `user_system_roles` c
JOIN `users` p ON c.`user_id` COLLATE utf8mb4_0900_ai_ci = p.`id` COLLATE utf8mb4_0900_ai_ci
WHERE p.tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE c FROM `payment_gateway_transactions` c
JOIN `sales` p ON c.`sale_id` COLLATE utf8mb4_0900_ai_ci = p.`id` COLLATE utf8mb4_0900_ai_ci
WHERE p.tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE c FROM `customer_contacts` c
JOIN `customers` p ON c.`customer_id` COLLATE utf8mb4_0900_ai_ci = p.`id` COLLATE utf8mb4_0900_ai_ci
WHERE p.tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE c FROM `customer_activity_log` c
JOIN `customers` p ON c.`customer_id` COLLATE utf8mb4_0900_ai_ci = p.`id` COLLATE utf8mb4_0900_ai_ci
WHERE p.tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE c FROM `support_ticket_messages` c
JOIN `support_tickets` p ON c.`ticket_id` COLLATE utf8mb4_0900_ai_ci = p.`id` COLLATE utf8mb4_0900_ai_ci
WHERE p.tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE c FROM `template_versions` c
JOIN `print_templates` p ON c.`template_id` COLLATE utf8mb4_0900_ai_ci = p.`id` COLLATE utf8mb4_0900_ai_ci
WHERE p.tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE c FROM `print_agent_printer_mappings` c
JOIN `print_agents` p ON c.`print_agent_id` COLLATE utf8mb4_0900_ai_ci = p.`id` COLLATE utf8mb4_0900_ai_ci
WHERE p.tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE c FROM `user_backup_codes` c
JOIN `users` p ON c.`user_id` COLLATE utf8mb4_0900_ai_ci = p.`id` COLLATE utf8mb4_0900_ai_ci
WHERE p.tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `attachments` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `audit_logs` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `categories` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `channel_product_links` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `channel_sync_queue` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `customer_code_sequences` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `customer_wishlist_items` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `customers` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `document_sequences` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `employee_sales_targets` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `employees` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `goods_received_notes` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `held_orders` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `inventory_logs` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `layaway_items` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `layaway_payments` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `layaway_plans` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `layaway_sequences` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `legacy_users_backup` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `memo_items` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `memo_sequences` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `memo_transactions` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `metal_rates` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `migration_backup_categories` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `migration_backup_products` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `offer_price_tiers` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `offer_rules` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `offer_usage` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `old_gold_purchases` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `old_gold_voucher_sequences` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `payment_gateways` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `payment_methods` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `payment_terminals` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `payment_transactions` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `print_agent_enrollment_codes` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `print_agents` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `print_document_settings` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `print_jobs` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `print_routes` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `print_stations` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `print_templates` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `printer_devices` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `printer_settings` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `product_piece_sequences` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `product_pieces` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `products` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `promotional_offers` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `purchase_orders` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `receipt_templates` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `repair_order_updates` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `repair_orders` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `repair_ticket_sequences` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `return_number_sequences` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `role_limits` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `roles` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `sale_applied_offers` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `sale_item_discounts` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `sales` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `sales_channels` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `sales_orders` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `sales_returns` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `savings_scheme_enrollments` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `savings_scheme_payments` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `savings_scheme_plans` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `savings_scheme_sequences` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `stock_adjustments` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `store_jurisdiction_settings` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `store_product_listings` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `stores` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `subscription_history` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `subscriptions` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `suppliers` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `support_tickets` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `tax_classes` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `tenant_cost_code_settings` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `tenant_features` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `tenant_field_overrides` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `tenant_payment_settings` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `tenant_pricing_settings` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `user_activity_logs` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `user_notification_preferences` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `user_permission_overrides` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `user_sessions` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `users` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `users_backup_20250626051814474` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = @tenant_id COLLATE utf8mb4_0900_ai_ci;

DELETE FROM `tenants` WHERE id = @tenant_id;

SET SESSION FOREIGN_KEY_CHECKS = 1;

-- Verify — should return 0 rows (tenant gone):
SELECT id, name FROM tenants WHERE id = @tenant_id;

-- Verify — any tenant_id rows left in ANY table? Builds a UNION query from
-- INFORMATION_SCHEMA so it also catches tables added after this script was
-- written. Should return an empty result set.
SET SESSION group_concat_max_len = 1000000;
SELECT GROUP_CONCAT(
  CONCAT('SELECT ''', TABLE_NAME, ''' AS tbl, COUNT(*) AS leftover FROM `', TABLE_NAME,
         '` WHERE tenant_id = ''', @tenant_id, '''')
  SEPARATOR ' UNION ALL '
) INTO @leftover_sql
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'tenant_id';
SET @leftover_sql = CONCAT('SELECT * FROM (', @leftover_sql, ') x WHERE leftover > 0');
PREPARE chk FROM @leftover_sql; EXECUTE chk; DEALLOCATE PREPARE chk;