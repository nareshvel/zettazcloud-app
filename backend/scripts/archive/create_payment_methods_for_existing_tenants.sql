-- Create default payment methods for existing tenants that don't have any
-- This script handles the collation issue by using direct tenant ID references

-- First, let's see which tenants need payment methods
SELECT 
    t.id as tenant_id,
    t.name as tenant_name,
    COUNT(pm.id) as payment_method_count
FROM tenants t 
LEFT JOIN payment_methods pm ON CAST(t.id AS CHAR) = CAST(pm.tenant_id AS CHAR)
GROUP BY t.id, t.name
HAVING payment_method_count = 0;

-- Create payment methods for tenants that don't have any
-- We'll use a specific tenant ID for now (the current user's tenant)

-- Get the current user's tenant ID (replace with actual tenant ID)
SET @target_tenant_id = '2d63688f-d18b-4138-b0e1-49146ec63fcb';

-- Check if this tenant already has payment methods
SELECT COUNT(*) as existing_count FROM payment_methods WHERE tenant_id = @target_tenant_id;

-- Insert default payment methods for the target tenant
INSERT IGNORE INTO payment_methods (id, tenant_id, name, code, is_active, requires_terminal, icon, sort_order, created_at, updated_at)
VALUES 
    (UUID(), @target_tenant_id, 'Cash', 'cash', 1, 0, 'cash', 1, NOW(), NOW()),
    (UUID(), @target_tenant_id, 'Credit/Debit Card', 'card', 1, 1, 'credit-card', 2, NOW(), NOW()),
    (UUID(), @target_tenant_id, 'UPI', 'upi', 1, 1, 'phone', 3, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', @target_tenant_id, 'No Payment Required', 'none', 1, 0, 'check-circle', 99, NOW(), NOW());

-- Create payment settings for the tenant if they don't exist
INSERT IGNORE INTO tenant_payment_settings (tenant_id, default_currency, allow_partial_payments, created_at, updated_at)
VALUES (@target_tenant_id, 'USD', 1, NOW(), NOW());

-- Verify the payment methods were created
SELECT 
    pm.id,
    pm.name,
    pm.code,
    pm.is_active,
    pm.requires_terminal,
    pm.sort_order
FROM payment_methods pm 
WHERE pm.tenant_id = @target_tenant_id
ORDER BY pm.sort_order;

SELECT 'Payment methods creation completed for tenant' as status, @target_tenant_id as tenant_id;
