CREATE TABLE suppliers (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    supplier_name VARCHAR(255) NOT NULL COMMENT 'Name of the supplier company or individual',
    contact_person VARCHAR(255) NULL COMMENT 'Primary contact person at the supplier',
    email VARCHAR(255) NULL COMMENT 'Email address of the supplier',
    phone VARCHAR(50) NULL COMMENT 'Phone number of the supplier',
    address_line1 VARCHAR(255) NULL,
    address_line2 VARCHAR(255) NULL,
    city VARCHAR(100) NULL,
    state_province VARCHAR(100) NULL,
    postal_code VARCHAR(20) NULL,
    country VARCHAR(100) NULL,
    website VARCHAR(255) NULL COMMENT 'Supplier website URL',
    tax_id VARCHAR(50) NULL COMMENT 'Tax identification number (e.g., VAT ID, EIN)',
    default_payment_terms VARCHAR(100) NULL COMMENT 'e.g., Net 30, Due on Receipt',
    notes TEXT NULL COMMENT 'Internal notes about the supplier',
    is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Whether the supplier is currently active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by_user_id VARCHAR(36) NULL,
    updated_by_user_id VARCHAR(36) NULL,

    CONSTRAINT fk_suppliers_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_suppliers_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_suppliers_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL,

    INDEX idx_suppliers_tenant_id (tenant_id),
    INDEX idx_suppliers_tenant_id_supplier_name (tenant_id, supplier_name),
    INDEX idx_suppliers_tenant_id_email (tenant_id, email),
    INDEX idx_suppliers_tenant_id_phone (tenant_id, phone),
    INDEX idx_suppliers_is_active (is_active)
);

-- Consider adding unique constraints for (tenant_id, supplier_name) if supplier names must be unique per tenant.
-- Example:
-- ALTER TABLE suppliers ADD CONSTRAINT uq_suppliers_tenant_supplier_name UNIQUE (tenant_id, supplier_name);
-- Similar considerations for (tenant_id, email) if email must be unique when provided.
