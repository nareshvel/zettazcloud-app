-- Payment Terminal and Gateway Integration Schema
-- This migration adds support for payment terminals and online gateways

-- Payment Terminals Table (Card/UPI terminals)
CREATE TABLE IF NOT EXISTS payment_terminals (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  terminal_type ENUM('card', 'upi') NOT NULL,
  provider VARCHAR(50) NOT NULL, -- 'square', 'clover', 'paytm', 'razorpay', 'ingenico'
  terminal_id VARCHAR(100) NOT NULL, -- Provider's terminal ID
  device_name VARCHAR(100),
  api_endpoint VARCHAR(255),
  api_key_encrypted TEXT,
  configuration JSON, -- Terminal-specific settings
  is_active BOOLEAN DEFAULT true,
  last_connected_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX idx_tenant_terminals (tenant_id, is_active),
  INDEX idx_terminal_type (terminal_type)
);

-- Payment Terminal Transactions Table
CREATE TABLE IF NOT EXISTS payment_terminal_transactions (
  id VARCHAR(36) PRIMARY KEY,
  sale_id VARCHAR(36) NOT NULL,
  terminal_id VARCHAR(36) NOT NULL,
  provider_transaction_id VARCHAR(100),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status ENUM('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded') DEFAULT 'pending',
  response_data JSON,
  error_message TEXT,
  processed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (terminal_id) REFERENCES payment_terminals(id) ON DELETE CASCADE,
  INDEX idx_sale_terminal (sale_id),
  INDEX idx_terminal_status (terminal_id, status),
  INDEX idx_provider_transaction (provider_transaction_id)
);

-- Payment Gateways Table (Stripe, PayPal, etc.)
CREATE TABLE IF NOT EXISTS payment_gateways (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  gateway_type ENUM('stripe', 'paypal', 'razorpay', 'square', 'authorize_net') NOT NULL,
  is_active BOOLEAN DEFAULT false,
  is_live_mode BOOLEAN DEFAULT false, -- true for production, false for sandbox
  config_data JSON NOT NULL, -- Encrypted API keys and settings
  webhook_secret VARCHAR(255),
  webhook_endpoint VARCHAR(255),
  supported_currencies JSON, -- ['USD', 'EUR', 'INR']
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE KEY unique_tenant_gateway (tenant_id, gateway_type),
  INDEX idx_tenant_gateways (tenant_id, is_active)
);

-- Payment Gateway Transactions Table
CREATE TABLE IF NOT EXISTS payment_gateway_transactions (
  id VARCHAR(36) PRIMARY KEY,
  sale_id VARCHAR(36) NOT NULL,
  gateway_id VARCHAR(36) NOT NULL,
  gateway_transaction_id VARCHAR(100),
  payment_intent_id VARCHAR(100), -- Stripe Payment Intent or PayPal Order ID
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status ENUM('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded') DEFAULT 'pending',
  gateway_response JSON,
  webhook_data JSON,
  refund_amount DECIMAL(10,2) DEFAULT 0.00,
  fees_amount DECIMAL(10,2) DEFAULT 0.00, -- Gateway processing fees
  processed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (gateway_id) REFERENCES payment_gateways(id) ON DELETE CASCADE,
  INDEX idx_sale_gateway (sale_id),
  INDEX idx_gateway_status (gateway_id, status),
  INDEX idx_gateway_transaction (gateway_transaction_id),
  INDEX idx_payment_intent (payment_intent_id)
);

-- Update payment_methods table to support terminal/gateway references
ALTER TABLE payment_methods 
ADD COLUMN IF NOT EXISTS terminal_id VARCHAR(36) NULL,
ADD COLUMN IF NOT EXISTS gateway_id VARCHAR(36) NULL,
ADD COLUMN IF NOT EXISTS integration_type ENUM('none', 'terminal', 'gateway') DEFAULT 'none',
ADD FOREIGN KEY (terminal_id) REFERENCES payment_terminals(id) ON DELETE SET NULL,
ADD FOREIGN KEY (gateway_id) REFERENCES payment_gateways(id) ON DELETE SET NULL;

-- Create indexes for payment_methods integration
CREATE INDEX IF NOT EXISTS idx_payment_methods_terminal ON payment_methods(terminal_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_gateway ON payment_methods(gateway_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_integration ON payment_methods(integration_type);

-- Payment Processing Logs Table (for debugging and audit)
CREATE TABLE IF NOT EXISTS payment_processing_logs (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  sale_id VARCHAR(36),
  payment_method_id VARCHAR(36),
  terminal_id VARCHAR(36) NULL,
  gateway_id VARCHAR(36) NULL,
  action VARCHAR(50) NOT NULL, -- 'charge', 'refund', 'void', 'capture'
  amount DECIMAL(10,2),
  status VARCHAR(20) NOT NULL,
  request_data JSON,
  response_data JSON,
  error_message TEXT,
  processing_time_ms INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL,
  FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL,
  FOREIGN KEY (terminal_id) REFERENCES payment_terminals(id) ON DELETE SET NULL,
  FOREIGN KEY (gateway_id) REFERENCES payment_gateways(id) ON DELETE SET NULL,
  INDEX idx_tenant_logs (tenant_id, created_at),
  INDEX idx_sale_logs (sale_id),
  INDEX idx_status_logs (status, created_at)
);

-- Insert default terminal and gateway configurations for existing tenants
-- This will be handled by a separate migration script to avoid affecting existing data
