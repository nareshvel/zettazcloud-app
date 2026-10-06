CREATE TABLE customers (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    store_id VARCHAR(36) NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NULL,
    email VARCHAR(255) NULL,
    phone_number VARCHAR(30) NULL,
    address_line1 VARCHAR(255) NULL,
    address_line2 VARCHAR(255) NULL,
    city VARCHAR(100) NULL,
    state_province VARCHAR(100) NULL,
    postal_code VARCHAR(20) NULL,
    country VARCHAR(100) NULL,
    customer_type VARCHAR(50) NULL DEFAULT 'INDIVIDUAL',
    loyalty_id VARCHAR(50) NULL,
    tax_id_number VARCHAR(50) NULL,
    notes TEXT NULL,
    credit_limit DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    outstanding_credit DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by_user_id VARCHAR(36) NULL,
    updated_by_user_id VARCHAR(36) NULL,

    CONSTRAINT fk_customers_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_customers_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL,
    CONSTRAINT fk_customers_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_customers_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL,

    INDEX idx_customers_tenant_id (tenant_id),
    INDEX idx_customers_email (tenant_id, email),
    INDEX idx_customers_phone_number (tenant_id, phone_number),
    INDEX idx_customers_loyalty_id (tenant_id, loyalty_id),
    INDEX idx_customers_is_active (is_active)
);

-- Add a default "Walk-In" customer for each tenant.
-- This is a placeholder and might need adjustment based on your tenant creation process.
-- For now, this is a conceptual trigger or a seed data step.
-- A more robust solution would be to create this customer programmatically when a new tenant is created.

-- Consider adding unique constraints for (tenant_id, email) and (tenant_id, phone_number) if they must be strictly unique per tenant.
-- Example:
-- ALTER TABLE customers ADD CONSTRAINT uq_customers_tenant_email UNIQUE (tenant_id, email);
-- ALTER TABLE customers ADD CONSTRAINT uq_customers_tenant_phone UNIQUE (tenant_id, phone_number);
-- However, be cautious with unique constraints on nullable fields as behavior can vary across SQL databases.
-- Typically, NULLs are not considered equal, so multiple NULL emails/phones would be allowed.
-- If an email/phone MUST be unique if present, application-level checks or database-specific features might be needed.
