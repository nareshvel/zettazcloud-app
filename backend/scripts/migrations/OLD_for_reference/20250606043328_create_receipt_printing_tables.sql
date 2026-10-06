-- Migration: Create Receipt Printing Tables
-- Date: 2025-06-06

-- Create the receipt templates table
CREATE TABLE receipt_templates (
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
CREATE TABLE printer_settings (
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

-- Insert default templates (Standard, Compact, Detailed)
INSERT INTO receipt_templates (id, tenant_id, name, description, html_template, css_template, is_default, is_system, created_at, updated_at)
VALUES 
(
  UUID(), 
  '00000000-0000-0000-0000-000000000000', -- System tenant ID
  'Standard Receipt', 
  'Traditional receipt format with store details, items, and totals',
  '<!-- Standard Receipt Template -->
<div class="receipt">
  <div class="header">
    <h1>{{storeName}}</h1>
    <p>{{storeAddress}}</p>
    <p>{{storePhone}}</p>
  </div>
  
  <div class="receipt-info">
    <p>Date: {{date}}</p>
    <p>Cashier: {{cashier}}</p>
    <p>Receipt #: {{receiptNumber}}</p>
  </div>
  
  <div class="items">
    {{#each items}}
    <div class="item">
      <span class="item-name">{{name}}</span>
      <span class="item-price">{{price}} x{{quantity}}</span>
      <span class="item-total">{{total}}</span>
    </div>
    {{/each}}
  </div>
  
  <div class="totals">
    <div><span>Subtotal</span><span>{{subtotal}}</span></div>
    {{#if tax}}
    <div><span>Tax</span><span>{{tax}}</span></div>
    {{/if}}
    {{#if discount}}
    <div><span>Discount</span><span>{{discount}}</span></div>
    {{/if}}
    <div class="total"><span>TOTAL</span><span>{{total}}</span></div>
  </div>
  
  <div class="payment">
    <p>Payment Method: {{paymentMethod}}</p>
    <p>Amount Paid: {{amountPaid}}</p>
  </div>
  
  <div class="footer">
    <p>{{footerText}}</p>
  </div>
</div>',
  '/* Standard Receipt CSS */
.receipt {
  width: 100%;
  max-width: 300px;
  font-family: "Courier New", monospace;
  font-size: 10pt;
}

.receipt .header {
  text-align: center;
  margin-bottom: 10px;
}

.receipt .header h1 {
  font-size: 14pt;
  margin: 0;
}

.receipt .header p {
  margin: 2px 0;
}

.receipt-info {
  margin-bottom: 10px;
}

.receipt-info p {
  margin: 2px 0;
}

.items {
  margin: 10px 0;
  border-top: 1px dashed #000;
  border-bottom: 1px dashed #000;
  padding: 5px 0;
}

.item {
  display: flex;
  justify-content: space-between;
  margin: 3px 0;
}

.item-name {
  width: 50%;
}

.item-price {
  width: 25%;
  text-align: right;
}

.item-total {
  width: 25%;
  text-align: right;
}

.totals {
  margin-top: 10px;
}

.totals div {
  display: flex;
  justify-content: space-between;
}

.total {
  font-weight: bold;
  margin-top: 5px;
}

.payment {
  margin: 10px 0;
}

.footer {
  text-align: center;
  margin-top: 15px;
  font-size: 9pt;
}

@media print {
  body {
    width: 58mm;
  }
  
  .receipt {
    width: 100%;
  }
}',
  true, -- is_default
  true, -- is_system
  NOW(),
  NOW()
),
(
  UUID(), 
  '00000000-0000-0000-0000-000000000000', -- System tenant ID
  'Compact Receipt', 
  'Minimal format for smaller paper with condensed information',
  '<!-- Compact Receipt Template -->
<div class="receipt compact">
  <div class="header">
    <h1>{{storeName}}</h1>
  </div>
  
  <div class="receipt-info">
    <p>{{date}} #{{receiptNumber}}</p>
  </div>
  
  <div class="items">
    {{#each items}}
    <div class="item">
      <span>{{name}} x{{quantity}}</span>
      <span>{{total}}</span>
    </div>
    {{/each}}
  </div>
  
  <div class="totals">
    {{#if tax}}<div><span>Tax</span><span>{{tax}}</span></div>{{/if}}
    {{#if discount}}<div><span>Disc</span><span>{{discount}}</span></div>{{/if}}
    <div class="total"><span>TOTAL</span><span>{{total}}</span></div>
    <div><span>Paid ({{paymentMethod}})</span><span>{{amountPaid}}</span></div>
  </div>
  
  <div class="footer">
    <p>{{footerText}}</p>
  </div>
</div>',
  '/* Compact Receipt CSS */
.receipt.compact {
  width: 100%;
  max-width: 200px;
  font-family: "Courier New", monospace;
  font-size: 8pt;
}

.compact .header {
  text-align: center;
  margin-bottom: 5px;
}

.compact .header h1 {
  font-size: 10pt;
  margin: 0;
}

.compact .receipt-info {
  text-align: center;
  margin-bottom: 5px;
  font-size: 7pt;
}

.compact .items {
  margin: 5px 0;
  border-top: 1px dashed #000;
  border-bottom: 1px dashed #000;
  padding: 2px 0;
}

.compact .item {
  display: flex;
  justify-content: space-between;
  margin: 2px 0;
  font-size: 7pt;
}

.compact .totals {
  margin-top: 5px;
  font-size: 7pt;
}

.compact .totals div {
  display: flex;
  justify-content: space-between;
}

.compact .total {
  font-weight: bold;
  border-top: 1px dashed #000;
  margin-top: 2px;
  padding-top: 2px;
}

.compact .footer {
  text-align: center;
  margin-top: 5px;
  font-size: 7pt;
}

@media print {
  body {
    width: 58mm;
  }
  
  .receipt.compact {
    width: 100%;
  }
}',
  false, -- is_default
  true, -- is_system
  NOW(),
  NOW()
),
(
  UUID(), 
  '00000000-0000-0000-0000-000000000000', -- System tenant ID
  'Detailed Receipt', 
  'Extended information with customer details, product descriptions, and policies',
  '<!-- Detailed Receipt Template -->
<div class="receipt detailed">
  <div class="header">
    <h1>{{storeName}}</h1>
    <p>{{storeAddress}}</p>
    <p>Phone: {{storePhone}}</p>
    <p>Email: {{storeEmail}}</p>
  </div>
  
  <div class="receipt-info">
    <p>Date: {{date}}</p>
    <p>Receipt #: {{receiptNumber}}</p>
    <p>Cashier: {{cashier}}</p>
    {{#if customer}}
    <div class="customer">
      <p>Customer: {{customer.name}}</p>
      {{#if customer.phone}}<p>Phone: {{customer.phone}}</p>{{/if}}
      {{#if customer.email}}<p>Email: {{customer.email}}</p>{{/if}}
    </div>
    {{/if}}
  </div>
  
  <div class="items">
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Price</th>
          <th>Qty</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {{#each items}}
        <tr>
          <td>
            <div class="item-name">{{name}}</div>
            {{#if description}}<div class="item-desc">{{description}}</div>{{/if}}
          </td>
          <td>{{price}}</td>
          <td>{{quantity}}</td>
          <td>{{total}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
  </div>
  
  <div class="totals">
    <div><span>Subtotal</span><span>{{subtotal}}</span></div>
    {{#if tax}}
    <div class="tax-details">
      <span>Tax ({{taxRate}}%)</span>
      <span>{{tax}}</span>
    </div>
    {{/if}}
    {{#if discount}}
    <div class="discount">
      <span>{{discountDescription}}</span>
      <span>{{discount}}</span>
    </div>
    {{/if}}
    <div class="total"><span>TOTAL</span><span>{{total}}</span></div>
  </div>
  
  <div class="payment">
    <h3>Payment Details</h3>
    <p>Method: {{paymentMethod}}</p>
    <p>Amount Paid: {{amountPaid}}</p>
    {{#if change}}<p>Change: {{change}}</p>{{/if}}
  </div>
  
  <div class="policies">
    <h3>Return Policy</h3>
    <p>{{returnPolicy}}</p>
  </div>
  
  <div class="footer">
    <p>{{footerText}}</p>
    <p>{{storeTagline}}</p>
  </div>
</div>',
  '/* Detailed Receipt CSS */
.receipt.detailed {
  width: 100%;
  max-width: 400px;
  font-family: Arial, sans-serif;
  font-size: 10pt;
  line-height: 1.4;
}

.detailed .header {
  text-align: center;
  margin-bottom: 15px;
}

.detailed .header h1 {
  font-size: 16pt;
  margin: 0 0 5px 0;
}

.detailed .header p {
  margin: 2px 0;
}

.detailed .receipt-info {
  margin-bottom: 15px;
}

.detailed .receipt-info p {
  margin: 2px 0;
}

.detailed .customer {
  margin-top: 10px;
  padding: 5px;
  background-color: #f8f8f8;
  border-radius: 3px;
}

.detailed .items {
  margin: 15px 0;
}

.detailed table {
  width: 100%;
  border-collapse: collapse;
}

.detailed th {
  text-align: left;
  border-bottom: 1px solid #000;
  padding: 3px;
}

.detailed td {
  padding: 5px 3px;
  border-bottom: 1px dotted #ccc;
}

.detailed .item-name {
  font-weight: bold;
}

.detailed .item-desc {
  font-size: 8pt;
  color: #666;
}

.detailed .totals {
  margin: 15px 0;
}

.detailed .totals div {
  display: flex;
  justify-content: space-between;
  margin: 5px 0;
}

.detailed .tax-details, .detailed .discount {
  font-size: 9pt;
}

.detailed .total {
  font-weight: bold;
  font-size: 12pt;
  border-top: 1px solid #000;
  margin-top: 5px;
  padding-top: 5px;
}

.detailed .payment {
  margin: 15px 0;
  padding: 10px;
  background-color: #f8f8f8;
  border-radius: 3px;
}

.detailed .payment h3 {
  margin: 0 0 5px 0;
  font-size: 11pt;
}

.detailed .policies {
  margin: 15px 0;
  font-size: 9pt;
}

.detailed .policies h3 {
  margin: 0 0 5px 0;
  font-size: 10pt;
}

.detailed .footer {
  text-align: center;
  margin-top: 20px;
  padding-top: 10px;
  border-top: 1px dashed #ccc;
  font-size: 9pt;
}

@media print {
  body {
    width: 80mm;
  }
  
  .receipt.detailed {
    width: 100%;
  }
}',
  false, -- is_default
  true, -- is_system
  NOW(),
  NOW()
);

-- Insert default printer settings for each store
INSERT INTO printer_settings (id, tenant_id, store_id, enabled, auto_print, print_mode, paper_width, header, footer)
SELECT
  UUID(), 
  s.tenant_id, 
  s.id,
  true, -- enabled by default
  false, -- auto_print off by default
  'browser', -- browser printing by default
  58, -- 58mm paper width
  CONCAT('Welcome to ', s.name), -- default header
  'Thank you for your purchase!' -- default footer
FROM
  stores s;
