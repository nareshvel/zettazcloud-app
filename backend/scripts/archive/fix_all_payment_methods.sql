-- Comprehensive fix for payment methods issues
-- This script will ensure your tenant has all required payment methods

-- Your tenant ID (from the table data you showed)
SET @tenant_id = '2d63688f-d18b-4138-b0e1-49146ec63fcb';

-- First, let's see what payment methods currently exist for your tenant
SELECT 'Current payment methods for your tenant:' as info;
SELECT 
    id,
    name,
    code,
    is_active,
    requires_terminal,
    icon,
    sort_order
FROM payment_methods 
WHERE tenant_id = @tenant_id
ORDER BY sort_order;

-- Add the missing "Charge" payment method
INSERT IGNORE INTO payment_methods (id, tenant_id, name, code, is_active, requires_terminal, icon, sort_order, created_at, updated_at)
VALUES (UUID(), @tenant_id, 'Charge', 'ON_ACCOUNT', 1, 0, 'user', 4, NOW(), NOW());

-- Fix any missing codes
UPDATE payment_methods 
SET code = 'none' 
WHERE tenant_id = @tenant_id 
  AND name = 'No Payment Required' 
  AND (code IS NULL OR code = '');

-- Ensure all payment methods are active
UPDATE payment_methods 
SET is_active = 1 
WHERE tenant_id = @tenant_id;

-- Final verification - show all payment methods for your tenant
SELECT 'Updated payment methods for your tenant:' as info;
SELECT 
    id,
    name,
    code,
    is_active,
    requires_terminal,
    icon,
    sort_order,
    created_at
FROM payment_methods 
WHERE tenant_id = @tenant_id
ORDER BY sort_order;

-- Count active payment methods
SELECT 
    COUNT(*) as active_payment_methods_count,
    @tenant_id as tenant_id
FROM payment_methods 
WHERE tenant_id = @tenant_id AND is_active = 1;

SELECT 'Payment methods fix completed' as status;
