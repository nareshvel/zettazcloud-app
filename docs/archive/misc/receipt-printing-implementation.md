# Receipt Printing Implementation Specification

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Frontend Components](#frontend-components)
5. [Backend API Endpoints](#backend-api-endpoints)
6. [Printing Methods](#printing-methods)
7. [Receipt Templates](#receipt-templates)
8. [Implementation Roadmap](#implementation-roadmap)
9. [Technical Considerations](#technical-considerations)

## Overview

This document outlines the detailed implementation plan for adding receipt printing functionality to the Zettaz Cloud POS system. The implementation will support multiple printing methods, customizable templates, and store-specific settings.

### Key Requirements

- Support for multiple printing methods (browser-based, direct thermal, server)
- Store/tenant-specific printer settings
- Customizable receipt templates
- Auto-print functionality
- Cross-platform compatibility
- Fallback mechanisms when preferred printing method is unavailable

## Architecture

The receipt printing system will be implemented with the following components:

### 1. Settings Management
- Printer configuration stored in database
- User interface for managing printer settings
- API endpoints for CRUD operations on printer settings

### 2. Printing Service
- Core service to handle print requests
- Adapter pattern to support multiple printing methods
- Template rendering engine

### 3. Template System
- Customizable receipt templates
- Variable substitution
- Styling specific to printer types

### 4. Integration Points
- Sale completion trigger
- Manual print button in receipt view
- Test print functionality

## Database Schema

### Printer Settings Table

```sql
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
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (template_id) REFERENCES receipt_templates(id)
);
```

### Receipt Templates Table

```sql
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
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

## Frontend Components

### Printer Settings Tab

Located in Settings section with the following fields:

1. **General Settings**
   - Enable receipt printing (toggle)
   - Auto-print on sale completion (toggle)
   - Printing method (dropdown: Browser, Direct Thermal, Print Server)

2. **Printer Configuration**
   - Printer name/ID (text input, for direct printing)
   - Paper size (radio: 58mm, 80mm)
   - Print density (slider, for thermal printers)

3. **Receipt Customization**
   - Template selection (dropdown)
   - Header text (textarea)
   - Footer text (textarea)
   - Logo upload (file input)
   - Preview button
   - Test print button

### Receipt Component

Enhanced version of the current receipt display with:

1. **Print Button**
   - Trigger printing based on selected method
   - Show printing status/errors

2. **Print Preview**
   - Rendered view of receipt as it will print
   - Respects template selection

### Print Service

Frontend service to handle printing operations:

```typescript
interface PrinterService {
  getPrinterSettings(): Promise<PrinterSettings>;
  printReceipt(transaction: TransactionDetail): Promise<boolean>;
  testPrint(): Promise<boolean>;
  getPrinterStatus(): Promise<PrinterStatus>;
}
```

## Backend API Endpoints

### Printer Settings Endpoints

| Method | Endpoint                        | Description                       |
|--------|--------------------------------|-----------------------------------|
| GET    | /api/settings/printer          | Get printer settings for current store |
| PUT    | /api/settings/printer          | Update printer settings            |
| POST   | /api/settings/printer/test     | Send test print                    |

### Receipt Template Endpoints

| Method | Endpoint                        | Description                       |
|--------|--------------------------------|-----------------------------------|
| GET    | /api/receipt-templates         | List available templates          |
| GET    | /api/receipt-templates/:id     | Get specific template             |
| POST   | /api/receipt-templates         | Create new template               |
| PUT    | /api/receipt-templates/:id     | Update template                   |
| DELETE | /api/receipt-templates/:id     | Delete template                   |

### Print Server Endpoints (Optional)

| Method | Endpoint                        | Description                       |
|--------|--------------------------------|-----------------------------------|
| POST   | /api/print                     | Send print job to server          |
| GET    | /api/print/status/:jobId       | Check print job status            |

## Printing Methods

### 1. Browser-Based Printing

**Implementation:**
- Use `window.print()` API
- Custom CSS for receipt formatting
- Media queries for paper size

**Pros:**
- Works on any device with a browser
- No additional dependencies
- Simple implementation

**Cons:**
- Limited formatting control
- User must confirm print dialog
- No direct feedback on print success

**Code Example:**
```javascript
function printReceipt(receiptHtml) {
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>Print Receipt</title>
        <link rel="stylesheet" href="/styles/receipt-print.css">
      </head>
      <body class="receipt">${receiptHtml}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
}
```

### 2. Direct Thermal Printing

**Implementation:**
- Web USB API or Web Serial API for direct communication
- ESC/POS commands for thermal printers
- Library: escpos-printer-toolkit

**Pros:**
- Direct control over printer
- No print dialog needed
- Fast printing

**Cons:**
- Limited browser support
- Requires user permission
- Device-specific setup

**Code Example:**
```javascript
import { EscPosEncoder } from 'escpos-encoder';

async function printToThermalPrinter(receiptData, printerName) {
  try {
    // Request a USB device
    const device = await navigator.usb.requestDevice({
      filters: [{ vendorId: 0x0416 }] // Example vendor ID
    });
    
    // Connect to the device
    await device.open();
    
    // Create ESC/POS commands
    const encoder = new EscPosEncoder();
    const result = encoder
      .initialize()
      .text(receiptData.header)
      .newline()
      .line(receiptData.items.map(item => `${item.name} x${item.quantity} ${item.price}`))
      .newline()
      .text(`Total: ${receiptData.total}`)
      .newline()
      .text(receiptData.footer)
      .cut();
    
    // Send to printer
    const buffer = result.encode();
    await device.transferOut(1, buffer);
    
    return true;
  } catch (err) {
    console.error('Printing failed:', err);
    return false;
  }
}
```

### 3. Print Server

**Implementation:**
- Server-side printing service
- Network communication with printers
- WebSockets for print job notifications

**Pros:**
- Works with network printers
- Centralized print management
- No browser limitations

**Cons:**
- Requires additional server setup
- More complex implementation
- Network dependency

**Architecture:**
1. Web app sends print job to backend
2. Backend queues print job
3. Print server polls for jobs or receives via WebSocket
4. Print server executes print job locally
5. Status reported back to web app

## Receipt Templates

### Default Templates

1. **Standard Receipt** - Traditional receipt format with:
   - Store header (name, address, phone)
   - Transaction details (date, cashier, receipt #)
   - Line items with quantity, price, total
   - Summary (subtotal, tax, discount, total)
   - Payment method
   - Footer message

2. **Compact Receipt** - Minimal format for smaller paper:
   - Store name
   - Date/time
   - Condensed item list
   - Total amount
   - Payment method

3. **Detailed Receipt** - Extended information:
   - Full store details
   - Customer information
   - Detailed product descriptions
   - Tax breakdown
   - Return policy
   - Promotional messaging

### Template Structure

Templates will be stored as HTML with placeholders for dynamic content:

```html
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
      <span>{{name}} @ {{price}} x{{quantity}}</span>
      <span>{{total}}</span>
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
</div>
```

## Current Implementation Status

### Frontend Components
We have implemented the following components for receipt printing:

1. **ReceiptModal Component** (`frontend/src/components/Receipt/ReceiptModal.tsx`)
   - Modal dialog for displaying and printing receipt content
   - Uses browser-based printing with `window.print()` 
   - Support for auto-printing when the modal is opened
   - Print button for manual printing
   - Placeholder for future PDF download functionality

2. **Receipt Service** (`frontend/src/services/receiptService.ts`)
   - Contains functions for generating receipt HTML and CSS
   - Provides default templates for receipt content
   - Handles data formatting for receipt items, totals, and store information
   - Supports customizable headers and footers

3. **useReceipt Hook** (`frontend/src/hooks/useReceipt.ts`) 
   - Manages receipt state and printing functionality
   - Fetches printer settings from the backend
   - Generates receipt content for a given sale
   - Controls modal visibility and auto-print behavior

4. **Dashboard Integration** (`frontend/src/pages/Dashboard.tsx`)
   - Receipt print button in the transaction list
   - Receipt print button in the transaction detail modal
   - Utilizes useReceipt hook to trigger receipt printing

5. **Settings Page Enhancement** (`frontend/src/pages/Settings.tsx`)
   - Added printer settings form with configuration options
   - Support for storing and retrieving printer settings

### Next Implementation Steps

The following components are planned for future development:

1. **Direct Thermal Printing**
   - Implementation using Web USB API for compatible printers
   - Configuration UI for printer selection and settings

2. **Print Server Integration**
   - Server-side printing capability for network printers
   - Print job queue management

3. **Receipt Template Editor**
   - UI for customizing receipt templates
   - Live preview of template changes

## Implementation Roadmap

### Phase 1: Foundation (Week 1)
1. Create database tables for printer settings and templates
2. Implement backend API endpoints for printer settings
3. Create printer settings UI in frontend
4. Implement basic browser-based printing

### Phase 2: Template System (Week 2)
1. Build receipt template system
2. Create default templates
3. Implement template customization UI
4. Add print preview functionality

### Phase 3: Advanced Printing (Week 3)
1. Implement direct thermal printer integration
2. Add print server option
3. Create fallback mechanisms
4. Implement auto-print functionality

### Phase 4: Testing & Optimization (Week 4)
1. Cross-browser testing
2. Printer compatibility testing
3. Performance optimization
4. Documentation & user guides

## Technical Considerations

### Security
- Printer access requires user permission
- Validate printer settings against known safe values
- Sanitize all user inputs for receipt templates

### Performance
- Optimize receipt rendering for quick printing
- Minimize unnecessary re-renders in print preview
- Use caching for frequently accessed templates

### Compatibility
- Support for major thermal printer brands
- Fallback mechanisms for unsupported printers
- Responsive design for different paper sizes

### Offline Support
- Cache printer settings locally
- Queue print jobs when offline
- Retry mechanism for failed print jobs

### Internationalization
- Support for different currencies and number formats
- Right-to-left language support in templates
- Multi-language support in receipt text
