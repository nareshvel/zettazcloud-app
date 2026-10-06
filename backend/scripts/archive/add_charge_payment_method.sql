-- Add missing "Charge" payment method for existing tenants
-- This adds the ON_ACCOUNT payment method that was missing from our default set

-- For your tenant (replace with actual tenant ID if different)
SET @tenant_id = '2d63688f-d18b-4138-b0e1-49146ec63fcb';

-- Add the Charge payment method if it doesn't exist
INSERT IGNORE INTO payment_methods (id, tenant_id, name, code, is_active, requires_terminal, icon, sort_order, created_at, updated_at)
VALUES (UUID(), @tenant_id, 'Charge', 'ON_ACCOUNT', 1, 0, 'user', 4, NOW(), NOW());

-- Also fix the missing code for "No Payment Required" if it exists
UPDATE payment_methods 
SET code = 'none' 
WHERE tenant_id = @tenant_id 
  AND name = 'No Payment Required' 
  AND (code IS NULL OR code = '');

-- Verify all payment methods for the tenant
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

SELECT 'Charge payment method added successfully' as status;
