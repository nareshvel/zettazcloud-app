-- COMPREHENSIVE FIX: Payment Methods for Your Tenant
-- This script resolves the UUID conflict and ensures your tenant has all payment methods

-- Your tenant ID
SET @tenant_id = '2d63688f-d18b-4138-b0e1-49146ec63fcb';

-- First, show current state
SELECT 'BEFORE: Current payment methods for your tenant:' as status;
SELECT 
    id,
    name,
    code,
    is_active,
    requires_terminal,
    sort_order
FROM payment_methods 
WHERE tenant_id = @tenant_id
ORDER BY sort_order;

-- Add all missing payment methods with unique UUIDs
-- Cash (should already exist)
INSERT IGNORE INTO payment_methods (id, tenant_id, name, code, is_active, requires_terminal, icon, sort_order, created_at, updated_at)
VALUES (UUID(), @tenant_id, 'Cash', 'cash', 1, 0, 'cash', 1, NOW(), NOW());

-- Credit/Debit Card (should already exist)
INSERT IGNORE INTO payment_methods (id, tenant_id, name, code, is_active, requires_terminal, icon, sort_order, created_at, updated_at)
VALUES (UUID(), @tenant_id, 'Credit/Debit Card', 'card', 1, 1, 'credit-card', 2, NOW(), NOW());

-- UPI (should already exist)
INSERT IGNORE INTO payment_methods (id, tenant_id, name, code, is_active, requires_terminal, icon, sort_order, created_at, updated_at)
VALUES (UUID(), @tenant_id, 'UPI', 'upi', 1, 1, 'phone', 3, NOW(), NOW());

-- Charge (missing - add it)
INSERT IGNORE INTO payment_methods (id, tenant_id, name, code, is_active, requires_terminal, icon, sort_order, created_at, updated_at)
VALUES (UUID(), @tenant_id, 'Charge', 'ON_ACCOUNT', 1, 0, 'user', 4, NOW(), NOW());

-- No Payment Required (missing due to UUID conflict - add with unique UUID)
INSERT IGNORE INTO payment_methods (id, tenant_id, name, code, is_active, requires_terminal, icon, sort_order, created_at, updated_at)
VALUES (UUID(), @tenant_id, 'No Payment Required', 'none', 1, 0, 'check-circle', 99, NOW(), NOW());

-- Ensure all payment methods are active
UPDATE payment_methods 
SET is_active = 1 
WHERE tenant_id = @tenant_id;

-- Create payment settings if missing
INSERT IGNORE INTO tenant_payment_settings (tenant_id, default_currency, allow_partial_payments, created_at, updated_at)
VALUES (@tenant_id, 'USD', 1, NOW(), NOW());

-- Show final state
SELECT 'AFTER: Updated payment methods for your tenant:' as status;
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

-- Count verification
SELECT 
    COUNT(*) as total_payment_methods,
    SUM(is_active) as active_payment_methods,
    @tenant_id as tenant_id
FROM payment_methods 
WHERE tenant_id = @tenant_id;

-- Show payment settings
SELECT 'Payment settings for your tenant:' as status;
SELECT * FROM tenant_payment_settings WHERE tenant_id = @tenant_id;

SELECT 'PAYMENT METHODS FIX COMPLETED SUCCESSFULLY' as final_status;
