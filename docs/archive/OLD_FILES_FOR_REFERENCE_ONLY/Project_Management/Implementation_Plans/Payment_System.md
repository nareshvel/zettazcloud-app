# Payment System Specification

## Overview
This document outlines the enhanced payment system for Zettaz Cloud POS, focusing on a touch-first interface with essential features for initial implementation and a roadmap for future enhancements.

## Core Requirements

### 1. Touch-Optimized Payment Modal
- Large, touch-friendly number pad
- Quick denomination buttons (e.g., $5, $10, $20, $50, $100) // TODO: Implement denomination buttons
- Clear display of:
  - Total Amount Due
  - Amount Tendered
  - Change Due
  - Selected Payment Method
- Payment method buttons displayed in a 4-column grid for better visibility and access.

### 2. Essential Payment Methods (Current Implementation Focus)
- **Cash**: Primary implemented method with amount tendered and change calculation.
- **Charge to Account**: Available when an eligible customer is selected. Eligibility is determined by customer type and credit limit. This method is currently managed with specific logic in the frontend (`Cart.tsx`) in addition to being an entry in the `payment_methods` table.
- **Card**: Selectable in the UI. Full terminal integration is a future enhancement. Currently records the sale with 'Card' as the payment method.
- **Phone/UPI/Digital Wallets**: Selectable in the UI (e.g., 'Phone'). Specific UPI/wallet processing flows are future enhancements. Currently records the sale with the chosen method.

### 3. Database Schema Updates
```sql
-- Payment Methods Table
CREATE TABLE IF NOT EXISTS payment_methods (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(50) NOT NULL,  -- e.g., 'Cash', 'Credit Card', 'UPI'
    code VARCHAR(20) NOT NULL,   -- e.g., 'CASH', 'CARD', 'UPI'
    is_active BOOLEAN DEFAULT TRUE,
    requires_terminal BOOLEAN DEFAULT FALSE,
    icon VARCHAR(50),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `unique_tenant_payment_code` (tenant_id, code)
);

-- Payment Terminals Table
CREATE TABLE IF NOT EXISTS payment_terminals (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    type ENUM('INGENICO', 'VERIFONE', 'PAYTM', 'PHONEPE', 'CUSTOM') NOT NULL,
    terminal_id VARCHAR(100),
    api_key VARCHAR(255),
    api_secret TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    settings JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Payment Transactions Table
CREATE TABLE IF NOT EXISTS payment_transactions (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    sale_id VARCHAR(36) NOT NULL,
    payment_method_id VARCHAR(36) NOT NULL,
    terminal_id VARCHAR(36),
    
    -- Amount details
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    exchange_rate DECIMAL(10,6) DEFAULT 1.0,
    
    -- Transaction details
    transaction_id VARCHAR(100),
    reference_id VARCHAR(100),
    status ENUM('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED') NOT NULL,
    
    -- Card/Wallet specific
    card_last4 VARCHAR(4),
    card_type VARCHAR(20),
    wallet_name VARCHAR(50),
    
    -- Metadata
    metadata JSON,
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id),
    FOREIGN KEY (terminal_id) REFERENCES payment_terminals(id)
);

-- Tenant Payment Settings
CREATE TABLE IF NOT EXISTS tenant_payment_settings (
    tenant_id VARCHAR(36) PRIMARY KEY,
    default_currency VARCHAR(3) DEFAULT 'INR',
    allow_partial_payments BOOLEAN DEFAULT TRUE,
    allow_tips BOOLEAN DEFAULT FALSE,
    default_tip_percentage DECIMAL(5,2) DEFAULT 10.00,
    receipt_settings JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

## Phase 1: Essential Features

### 1. Touch-Based Payment Modal
- **Number Pad**: Large, touch-friendly buttons (0-9, 00, .)
- **Quick Buttons**: Common denominations (e.g., 100, 500, 1000) - *To be implemented*
- **Payment Methods**: Toggle between available methods. Buttons are now arranged in a 4-column grid.
- **Clear Display**: Large, easy-to-read amounts for Total, Tendered, and Change.

### 2. Core Payment Flows
1. **Cash Payment**
   - Enter amount tendered
   - Auto-calculate change
   - Option to print receipt (Receipt printing is a future enhancement)

2. **Charge to Account Payment**
   - Automatically available if an eligible customer (not 'Walk-In' or has credit limit > 0) is associated with the sale.
   - Records the sale with 'Charge to Account' as the payment method.

3. **Card / Phone (Other Digital Methods) Payment**
   - Selectable in the UI.
   - Basic recording of the sale with the chosen payment method.
   - Full terminal integration (for Card) or specific digital payment gateway integration (for Phone/UPI) are future enhancements.
   - Receipt printing is a future enhancement.

### 3. Database Initialization
```sql
-- Insert example payment methods (ensure tenant_id is valid)
INSERT INTO payment_methods (id, tenant_id, name, code, is_active, requires_terminal, icon, sort_order)
VALUES 
    ('e9ca7524-35f4-11f0-8297-525400148990', 'your_tenant_id', 'Cash', 'CASH', TRUE, FALSE, 'cash', 1),
    ('e9ca75b4-35f4-11f0-8297-525400148990', 'your_tenant_id', 'Charge to Account', 'ON_ACCOUNT', TRUE, FALSE, 'Person', 4),
    ('e9ca7670-35f4-11f0-8297-525400148990', 'your_tenant_id', 'Card', 'CARD', TRUE, TRUE, 'credit-card', 2),
    ('e9ca76b3-35f4-11f0-8297-525400148990', 'your_tenant_id', 'Phone', 'PHONE', TRUE, TRUE, 'mobile', 3);

-- Initialize tenant payment settings (ensure tenant_id is valid)
INSERT INTO tenant_payment_settings (tenant_id, default_currency, allow_partial_payments)
SELECT id, 'INR', TRUE FROM tenants WHERE id = 'your_tenant_id'; -- Example for a specific tenant
```

## Phase 2: Advanced Features (Future)

### 1. Enhanced Payment Methods
- UPI integration
- Digital wallets (PayTM, PhonePe, etc.)
- Net banking
- EMI options

### 2. Loyalty Program
- Points calculation
- Redemption
- Customer history

### 3. Receipt Options
- Print
- Email
- SMS
- WhatsApp

### 4. Merchant Integrations
- Card terminal support
- Multiple terminal support
- Batch settlements

## API Endpoints

### 1. Get Available Payment Methods
```
GET /api/payment-methods
```
- **Purpose**: Fetches all active payment methods from the `payment_methods` table for the current tenant.
- **Frontend Behavior**: 
    - The frontend (`Cart.tsx`) calls this endpoint to populate the list of payment options in the Payment Modal.
    - If the API call fails or returns no methods, the frontend currently falls back to a default list of payment methods.
    - The "Charge to Account" option has special conditional display logic in the frontend based on customer selection and eligibility, supplementing the data fetched from this API.

### 2. Process Payment / Record Sale
Currently, payment information is recorded as part of the sale creation process:
```
POST /api/sales
```
- **Purpose**: Creates a new sale, including details of items, customer (if any), discounts, taxes, and the chosen `paymentMethodId`.
- **Request Body Snippet (relevant to payment)**:
  ```json
  {
    // ... other sale data (items, customerId, totals, etc.)
    "paymentMethodId": "e9ca7524-35f4-11f0-8297-525400148990", // ID of the selected payment method
    "amountTendered": 100.00, // Optional, primarily for cash transactions
    "changeDue": 0.00 // Optional, primarily for cash transactions
    // ... other payment-related fields if applicable
  }
  ```
- **Note**: A more dedicated `POST /api/payment/process` endpoint might be developed in the future for more complex payment scenarios (e.g., multiple payment types for a single sale, deferred payments, terminal interactions).

## UI/UX Guidelines

### Payment Modal Layout
- The payment method selection area now uses a **4-column grid** to display payment option buttons.
- Example visual:
```
+--------------------------------+
|         PAYMENT                |
+--------------------------------+
|  Total Due:     ₹1,250.00     |
|  Tendered:      ₹1,500.00     |
|  Change Due:    ₹ 250.00      |
+--------------------------------+
|  [CASH] [CHARGE] [CARD] [PHONE]|
+--------------------------------+
|  [1]  [2]  [3]  [CLEAR]      |
|  [4]  [5]  [6]  [BACKSPACE]   |
|  [7]  [8]  [9]  [ENTER]       |
|  [.]  [0]  [00] [PAY]         |
+--------------------------------+
|  [100] [200] [500] [1000]     | // Denomination buttons (To be implemented)

### Known Issues / Future Refinements

- **Dynamic "Charge to Account"**: The frontend logic in `Cart.tsx` for managing the "Charge to Account" payment method (currently using a hardcoded object and prepending it) should be refactored. The goal is for this method to be fully sourced from the `/api/payment-methods` endpoint, with its `isActive` status dynamically controlled based on customer eligibility, rather than being added/removed from the list separately.
- **Denomination Buttons**: The quick denomination buttons in the payment modal are yet to be implemented.
- **Receipt Printing**: Functionality for printing receipts needs to be developed.
- **Full Terminal/Gateway Integration**: Deeper integration with payment terminals (for cards) and payment gateways (for UPI/digital wallets) is planned for future phases.

## Implementation Plan

### Week 1: Core Infrastructure
1. Database schema implementation
2. Basic payment modal UI
3. Cash payment flow

### Week 2: Card Payments
1. Terminal integration
2. Payment processing
3. Receipt generation

### Week 3: Testing & Refinement
1. Edge case handling
2. Performance optimization
3. User testing

## Future Considerations
1. Multi-currency support
2. Advanced reporting
3. Integration with accounting software
4. Mobile app for payments
5. Offline payment processing

## Security Considerations
1. PCI-DSS compliance for card data
2. Secure storage of API keys
3. Transaction logging
4. Audit trails

## Testing Strategy
1. Unit tests for payment calculations
2. Integration tests with payment gateways
3. UI tests for touch interactions
4. End-to-end payment flow testing
