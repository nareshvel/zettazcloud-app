-- Migration: System-Wide Payment Methods Architecture
-- This creates the new payment gateway and settings tables for the improved architecture

-- Create payment_gateways table for tenant-specific gateway configurations
CREATE TABLE IF NOT EXISTS payment_gateways (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id VARCHAR(36) NOT NULL,
    gateway_type ENUM('stripe', 'paypal', 'upi', 'square', 'razorpay') NOT NULL,
    is_enabled BOOLEAN DEFAULT FALSE,
    configuration JSON NULL COMMENT 'Gateway-specific configuration (API keys, etc.)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_tenant_gateway (tenant_id, gateway_type),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Update tenant_payment_settings to include terminal configuration
ALTER TABLE tenant_payment_settings 
ADD COLUMN IF NOT EXISTS has_card_terminal BOOLEAN DEFAULT FALSE COMMENT 'Whether tenant has physical card terminal',
ADD COLUMN IF NOT EXISTS terminal_type VARCHAR(50) NULL COMMENT 'Type of card terminal (e.g., Square, Clover)';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_gateways_tenant_enabled ON payment_gateways(tenant_id, is_enabled);
CREATE INDEX IF NOT EXISTS idx_tenant_payment_settings_terminal ON tenant_payment_settings(tenant_id, has_card_terminal);

-- Insert sample data for existing tenants (optional)
-- This gives all existing tenants the basic terminal capability
INSERT IGNORE INTO tenant_payment_settings (tenant_id, has_card_terminal, terminal_type, default_currency, allow_partial_payments, created_at, updated_at)
SELECT 
    id as tenant_id,
    TRUE as has_card_terminal,
    'Generic' as terminal_type,
    'USD' as default_currency,
    TRUE as allow_partial_payments,
    NOW() as created_at,
    NOW() as updated_at
FROM tenants 
WHERE id NOT IN (SELECT tenant_id FROM tenant_payment_settings);

-- Show the new structure
SELECT 'Payment Gateways Table Created' as status;
DESCRIBE payment_gateways;

SELECT 'Tenant Payment Settings Updated' as status;
DESCRIBE tenant_payment_settings;

SELECT 'Migration completed successfully' as final_status;
