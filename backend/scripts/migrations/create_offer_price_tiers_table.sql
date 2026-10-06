-- Create the offer_price_tiers table
CREATE TABLE IF NOT EXISTS offer_price_tiers (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    store_id VARCHAR(36) NOT NULL,
    offer_id VARCHAR(36) NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (offer_id) REFERENCES promotional_offers(id) ON DELETE CASCADE,
    INDEX idx_offer_price_tiers_tenant_store (tenant_id, store_id),
    INDEX idx_offer_price_tiers_offer (offer_id)
);
