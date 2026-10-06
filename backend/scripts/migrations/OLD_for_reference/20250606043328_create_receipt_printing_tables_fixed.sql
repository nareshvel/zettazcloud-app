-- Migration: Create Receipt Printing Tables
-- Date: 2025-06-06

-- Create the receipt templates table
CREATE TABLE IF NOT EXISTS receipt_templates (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  html_template TEXT NOT NULL,
  css_template TEXT,
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  updated_by VARCHAR(36),
  INDEX (tenant_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Create the printer settings table
CREATE TABLE IF NOT EXISTS printer_settings (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  store_id VARCHAR(36) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  auto_print BOOLEAN DEFAULT false,
  print_mode ENUM('browser', 'direct', 'server') DEFAULT 'browser',
  printer_name VARCHAR(255),
  paper_width INT DEFAULT 58,
  template_id VARCHAR(36),
  header TEXT,
  footer TEXT,
  logo_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  updated_by VARCHAR(36),
  INDEX (tenant_id),
  INDEX (store_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES receipt_templates(id) ON DELETE SET NULL
);
