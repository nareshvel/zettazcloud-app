-- Fix missing code field for "No Payment Required" payment method
-- This affects the payment method with ID 00000000-0000-0000-0000-000000000000

UPDATE payment_methods 
SET code = 'none' 
WHERE id = '00000000-0000-0000-0000-000000000000' 
  AND name = 'No Payment Required' 
  AND (code IS NULL OR code = '');

-- Verify the fix
SELECT 
    id,
    tenant_id,
    name,
    code,
    is_active,
    requires_terminal,
    icon,
    sort_order
FROM payment_methods 
WHERE id = '00000000-0000-0000-0000-000000000000';

-- Also check all payment methods for your tenant to ensure they're correct
SELECT 
    id,
    name,
    code,
    is_active,
    requires_terminal,
    icon,
    sort_order
FROM payment_methods 
WHERE tenant_id = '2d63688f-d18b-4138-b0e1-49146ec63fcb'
ORDER BY sort_order;

SELECT 'Payment method code fix completed' as status;
