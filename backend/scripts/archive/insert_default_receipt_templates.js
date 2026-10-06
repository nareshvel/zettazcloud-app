/**
 * Script to insert default receipt templates
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

// Default receipt templates
const defaultTemplates = [
  {
    id: uuidv4(),
    name: 'Standard Receipt',
    description: 'Traditional receipt format with store details, items, and totals',
    isDefault: true,
    isSystem: true,
    htmlTemplate: `
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
</div>`,
    cssTemplate: `
.receipt {
  width: 100%;
  max-width: 300px;
  margin: 0 auto;
  font-family: 'Courier New', monospace;
  font-size: 10pt;
}

.header {
  text-align: center;
  margin-bottom: 10px;
}

.header h1 {
  font-size: 14pt;
  margin: 0;
}

.receipt-info {
  margin-bottom: 10px;
}

.receipt-info p {
  margin: 2px 0;
}

.items {
  border-top: 1px dashed #000;
  border-bottom: 1px dashed #000;
  padding: 10px 0;
}

.item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.item-name {
  flex: 2;
}

.item-price {
  flex: 1;
  text-align: center;
}

.item-total {
  flex: 1;
  text-align: right;
}

.totals {
  margin-top: 10px;
}

.totals > div {
  display: flex;
  justify-content: space-between;
}

.total {
  font-weight: bold;
  margin-top: 5px;
}

.payment {
  margin-top: 10px;
  text-align: center;
}

.footer {
  margin-top: 20px;
  text-align: center;
  font-size: 9pt;
}`
  },
  {
    id: uuidv4(),
    name: 'Compact Receipt',
    description: 'Space-saving receipt format for small paper sizes',
    isDefault: false,
    isSystem: true,
    htmlTemplate: `
<div class="compact-receipt">
  <div class="header">
    <h1>{{storeName}}</h1>
  </div>
  
  <div class="receipt-info">
    <p>{{date}} #{{receiptNumber}}</p>
  </div>
  
  <div class="items">
    {{#each items}}
    <div class="item">
      <div class="item-name">{{name}}</div>
      <div class="item-detail">
        <span>{{price}} x{{quantity}}</span>
        <span>{{total}}</span>
      </div>
    </div>
    {{/each}}
  </div>
  
  <div class="totals">
    <div><span>SUB</span><span>{{subtotal}}</span></div>
    {{#if tax}}
    <div><span>TAX</span><span>{{tax}}</span></div>
    {{/if}}
    {{#if discount}}
    <div><span>DISC</span><span>{{discount}}</span></div>
    {{/if}}
    <div class="total"><span>TOTAL</span><span>{{total}}</span></div>
  </div>
  
  <div class="payment">
    <p>{{paymentMethod}}: {{amountPaid}}</p>
  </div>
  
  <div class="footer">
    <p>{{footerText}}</p>
  </div>
</div>`,
    cssTemplate: `
.compact-receipt {
  width: 100%;
  max-width: 220px;
  margin: 0 auto;
  font-family: 'Courier New', monospace;
  font-size: 8pt;
}

.header {
  text-align: center;
  margin-bottom: 5px;
}

.header h1 {
  font-size: 10pt;
  margin: 0;
}

.receipt-info {
  text-align: center;
  margin-bottom: 5px;
}

.receipt-info p {
  margin: 0;
}

.items {
  border-top: 1px dashed #000;
  border-bottom: 1px dashed #000;
  padding: 5px 0;
}

.item {
  margin-bottom: 3px;
}

.item-detail {
  display: flex;
  justify-content: space-between;
  font-size: 7pt;
}

.totals {
  margin-top: 5px;
  font-size: 8pt;
}

.totals > div {
  display: flex;
  justify-content: space-between;
}

.total {
  font-weight: bold;
  border-top: 1px solid #000;
  padding-top: 2px;
  margin-top: 2px;
}

.payment {
  margin-top: 5px;
  text-align: center;
  font-size: 8pt;
}

.footer {
  margin-top: 10px;
  text-align: center;
  font-size: 7pt;
}`
  },
  {
    id: uuidv4(),
    name: 'Detailed Receipt',
    description: 'Comprehensive receipt with additional transaction details',
    isDefault: false,
    isSystem: true,
    htmlTemplate: `
<div class="detailed-receipt">
  <div class="header">
    <div class="logo">{{#if logoUrl}}<img src="{{logoUrl}}" />{{/if}}</div>
    <h1>{{storeName}}</h1>
    <p>{{storeAddress}}</p>
    <p>{{storePhone}} | {{storeEmail}}</p>
    <p>{{storeWebsite}}</p>
  </div>
  
  <div class="receipt-info">
    <table>
      <tr>
        <td>Date:</td>
        <td>{{date}}</td>
      </tr>
      <tr>
        <td>Time:</td>
        <td>{{time}}</td>
      </tr>
      <tr>
        <td>Receipt #:</td>
        <td>{{receiptNumber}}</td>
      </tr>
      <tr>
        <td>Cashier:</td>
        <td>{{cashier}}</td>
      </tr>
      {{#if customer}}
      <tr>
        <td>Customer:</td>
        <td>{{customer}}</td>
      </tr>
      {{/if}}
    </table>
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
          <td>{{name}}</td>
          <td>{{price}}</td>
          <td>{{quantity}}</td>
          <td>{{total}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
  </div>
  
  <div class="totals">
    <table>
      <tr>
        <td>Subtotal:</td>
        <td>{{subtotal}}</td>
      </tr>
      {{#if tax}}
      <tr>
        <td>Tax:</td>
        <td>{{tax}}</td>
      </tr>
      {{/if}}
      {{#if discount}}
      <tr>
        <td>Discount:</td>
        <td>{{discount}}</td>
      </tr>
      {{/if}}
      <tr class="total">
        <td>TOTAL:</td>
        <td>{{total}}</td>
      </tr>
      <tr>
        <td>Payment Method:</td>
        <td>{{paymentMethod}}</td>
      </tr>
      <tr>
        <td>Amount Paid:</td>
        <td>{{amountPaid}}</td>
      </tr>
      {{#if change}}
      <tr>
        <td>Change:</td>
        <td>{{change}}</td>
      </tr>
      {{/if}}
    </table>
  </div>
  
  <div class="barcode">
    {{#if barcodeUrl}}
    <img src="{{barcodeUrl}}" />
    {{/if}}
  </div>
  
  <div class="footer">
    <p>{{footerText}}</p>
    <p>Thank you for your business!</p>
  </div>
</div>`,
    cssTemplate: `
.detailed-receipt {
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
  font-family: Arial, sans-serif;
  font-size: 10pt;
}

.header {
  text-align: center;
  margin-bottom: 15px;
}

.logo {
  margin-bottom: 10px;
}

.logo img {
  max-width: 100px;
  max-height: 50px;
}

.header h1 {
  font-size: 16pt;
  margin: 0 0 5px 0;
}

.header p {
  margin: 0;
  font-size: 9pt;
}

.receipt-info {
  margin-bottom: 15px;
}

.receipt-info table {
  width: 100%;
  border-collapse: collapse;
}

.receipt-info td {
  padding: 2px 0;
}

.receipt-info td:first-child {
  font-weight: bold;
}

.items {
  margin-bottom: 15px;
}

.items table {
  width: 100%;
  border-collapse: collapse;
}

.items th {
  border-bottom: 1px solid #000;
  text-align: left;
  padding: 5px 0;
}

.items td {
  padding: 5px 0;
  border-bottom: 1px dotted #ccc;
}

.items th:nth-child(2),
.items th:nth-child(3),
.items th:nth-child(4),
.items td:nth-child(2),
.items td:nth-child(3),
.items td:nth-child(4) {
  text-align: right;
}

.totals {
  margin-bottom: 15px;
}

.totals table {
  width: 100%;
  border-collapse: collapse;
}

.totals td {
  padding: 2px 0;
}

.totals td:first-child {
  font-weight: bold;
}

.totals td:last-child {
  text-align: right;
}

.totals .total {
  font-size: 12pt;
  border-top: 1px solid #000;
  border-bottom: 1px solid #000;
}

.barcode {
  text-align: center;
  margin: 15px 0;
}

.barcode img {
  max-width: 200px;
}

.footer {
  text-align: center;
  margin-top: 20px;
  font-size: 9pt;
}

.footer p {
  margin: 3px 0;
}`
  }
];

// Database configuration from environment variables
const dbConfig = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: process.env.MYSQL_PORT || 3306,
  connectTimeout: 20000,
};

// We'll fetch the first tenant ID from the database

async function insertDefaultTemplates() {
  let connection;
  try {
    // Create database connection
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to database');
    
    // Get an existing tenant ID
    const [tenants] = await connection.execute('SELECT id FROM tenants LIMIT 1');
    
    if (tenants.length === 0) {
      console.error('No tenants found in the database. Cannot proceed.');
      return;
    }
    
    const tenantId = tenants[0].id;
    console.log(`Using tenant ID: ${tenantId}`);

    // Check if system templates already exist
    const [existingTemplates] = await connection.execute(
      'SELECT COUNT(*) as count FROM receipt_templates WHERE is_system = 1'
    );

    if (existingTemplates[0].count > 0) {
      console.log('System templates already exist. Skipping insertion.');
      return;
    }

    // Insert default templates
    for (const template of defaultTemplates) {
      console.log(`Inserting template: ${template.name}`);
      await connection.execute(
        `INSERT INTO receipt_templates 
        (id, tenant_id, name, description, html_template, css_template, is_default, is_system) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          template.id,
          tenantId,
          template.name,
          template.description,
          template.htmlTemplate,
          template.cssTemplate,
          template.isDefault ? 1 : 0,
          template.isSystem ? 1 : 0
        ]
      );
    }

    console.log('Successfully inserted default receipt templates');
  } catch (error) {
    console.error('Error inserting default templates:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

// Run the function
insertDefaultTemplates();
