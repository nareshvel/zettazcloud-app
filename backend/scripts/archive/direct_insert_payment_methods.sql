-- Direct INSERT for payment methods - avoids collation issues completely
-- This will add the missing payment methods for your tenant

-- Your tenant: 2d63688f-d18b-4138-b0e1-49146ec63fcb

-- Insert Charge payment method
INSERT INTO payment_methods (id, tenant_id, name, code, is_active, requires_terminal, icon, sort_order, created_at, updated_at)
VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 
    '2d63688f-d18b-4138-b0e1-49146ec63fcb', 
    'Charge', 
    'ON_ACCOUNT', 
    1, 
    0, 
    'user', 
    4, 
    NOW(), 
    NOW()
) ON DUPLICATE KEY UPDATE name = name;

-- Insert No Payment Required with unique UUID for your tenant
INSERT INTO payment_methods (id, tenant_id, name, code, is_active, requires_terminal, icon, sort_order, created_at, updated_at)
VALUES (
    'b2c3d4e5-f6g7-8901-bcde-f23456789012', 
    '2d63688f-d18b-4138-b0e1-49146ec63fcb', 
    'No Payment Required', 
    'none', 
    1, 
    0, 
    'check-circle', 
    99, 
    NOW(), 
    NOW()
) ON DUPLICATE KEY UPDATE name = name;

-- Ensure all payment methods for your tenant are active (direct update)
UPDATE payment_methods 
SET is_active = 1 
WHERE tenant_id = '2d63688f-d18b-4138-b0e1-49146ec63fcb';

-- Insert payment settings if missing
INSERT INTO tenant_payment_settings (tenant_id, default_currency, allow_partial_payments, created_at, updated_at)
VALUES (
    '2d63688f-d18b-4138-b0e1-49146ec63fcb', 
    'USD', 
    1, 
    NOW(), 
    NOW()
) ON DUPLICATE KEY UPDATE default_currency = default_currency;
