-- Sales Return Module Database Migration
-- Creates tables for sales return functionality

-- 1. Create sales_returns table
CREATE TABLE IF NOT EXISTS sales_returns (
  id VARCHAR(36) PRIMARY KEY,
  return_number VARCHAR(50) UNIQUE NOT NULL,
  original_sale_id VARCHAR(36) NOT NULL,
  customer_id VARCHAR(36),
  tenant_id VARCHAR(36) NOT NULL,
  store_id VARCHAR(36) NOT NULL,
  return_date DATETIME NOT NULL,
  return_reason ENUM('defective', 'wrong_item', 'customer_change_mind', 'damaged', 'other') NOT NULL,
  return_reason_notes TEXT,
  total_return_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  refund_method ENUM('cash', 'card', 'store_credit', 'exchange') NOT NULL,
  status ENUM('pending', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  processed_by_user_id VARCHAR(36) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (original_sale_id) REFERENCES sales(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (processed_by_user_id) REFERENCES users(id),
  
  INDEX idx_return_number (return_number),
  INDEX idx_original_sale (original_sale_id),
  INDEX idx_tenant_store (tenant_id, store_id),
  INDEX idx_return_date (return_date)
);

-- 2. Create sales_return_items table
CREATE TABLE IF NOT EXISTS sales_return_items (
  id VARCHAR(36) PRIMARY KEY,
  sales_return_id VARCHAR(36) NOT NULL,
  original_sale_item_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  quantity_returned INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  return_condition ENUM('new', 'used', 'damaged', 'defective') NOT NULL DEFAULT 'new',
  restockable BOOLEAN NOT NULL DEFAULT true,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (sales_return_id) REFERENCES sales_returns(id) ON DELETE CASCADE,
  FOREIGN KEY (original_sale_item_id) REFERENCES sale_items(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  
  INDEX idx_return_id (sales_return_id),
  INDEX idx_product (product_id)
);

-- 3. Add return-related permissions to the system
INSERT IGNORE INTO permissions (id, name, description, module, created_at) VALUES
('sales-return-view', 'sales.return.view', 'View sales returns', 'sales', NOW()),
('sales-return-create', 'sales.return.create', 'Create new sales returns', 'sales', NOW()),
('sales-return-edit', 'sales.return.edit', 'Edit pending sales returns', 'sales', NOW()),
('sales-return-complete', 'sales.return.complete', 'Complete sales returns', 'sales', NOW()),
('sales-return-cancel', 'sales.return.cancel', 'Cancel sales returns', 'sales', NOW()),
('sales-return-reports', 'sales.return.reports', 'View sales return reports', 'sales', NOW());

-- 4. Create return number sequence table for auto-generation
CREATE TABLE IF NOT EXISTS return_number_sequences (
  tenant_id VARCHAR(36) PRIMARY KEY,
  current_number INT NOT NULL DEFAULT 1,
  prefix VARCHAR(10) NOT NULL DEFAULT 'RET',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
