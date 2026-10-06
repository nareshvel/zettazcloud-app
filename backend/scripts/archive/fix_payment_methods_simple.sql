-- Simple fix for payment methods without collation issues
-- Direct INSERT statements for your specific tenant

-- Add missing payment methods for your tenant: 2d63688f-d18b-4138-b0e1-49146ec63fcb

-- Add Charge payment method
INSERT IGNORE INTO payment_methods (id, tenant_id, name, code, is_active, requires_terminal, icon, sort_order, created_at, updated_at)
VALUES ('charge-' || UUID(), '2d63688f-d18b-4138-b0e1-49146ec63fcb', 'Charge', 'ON_ACCOUNT', 1, 0, 'user', 4, NOW(), NOW());

-- Add No Payment Required with unique UUID for your tenant
INSERT IGNORE INTO payment_methods (id, tenant_id, name, code, is_active, requires_terminal, icon, sort_order, created_at, updated_at)
VALUES ('none-' || UUID(), '2d63688f-d18b-4138-b0e1-49146ec63fcb', 'No Payment Required', 'none', 1, 0, 'check-circle', 99, NOW(), NOW());

-- Ensure all existing payment methods for your tenant are active
UPDATE payment_methods 
SET is_active = 1 
WHERE tenant_id = '2d63688f-d18b-4138-b0e1-49146ec63fcb';

-- Create payment settings if missing
INSERT IGNORE INTO tenant_payment_settings (tenant_id, default_currency, allow_partial_payments, created_at, updated_at)
VALUES ('2d63688f-d18b-4138-b0e1-49146ec63fcb', 'USD', 1, NOW(), NOW());

-- Show final result (this should work without collation issues)
SELECT 
    name,
    code,
    is_active,
    sort_order
FROM payment_methods 
WHERE tenant_id = '2d63688f-d18b-4138-b0e1-49146ec63fcb'
ORDER BY sort_order;
