# Payment Terminal Integration Architecture

## Overview
This document outlines the integration architecture for payment terminals (Card/UPI) and online payment gateways (PayPal/Stripe) in the ZettaZ Cloud POS system.

## 1. Payment Terminal Integration (Card/UPI)

### Supported Terminal Types
- **Card Terminals**: Square Reader, Clover, Ingenico, Verifone
- **UPI Terminals**: Paytm Soundbox, Pine Labs, Razorpay POS

### Database Schema

#### `payment_terminals` Table
```sql
CREATE TABLE payment_terminals (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  terminal_type ENUM('card', 'upi') NOT NULL,
  provider VARCHAR(50) NOT NULL, -- 'square', 'clover', 'paytm', 'razorpay'
  terminal_id VARCHAR(100) NOT NULL, -- Provider's terminal ID
  device_name VARCHAR(100),
  api_endpoint VARCHAR(255),
  api_key_encrypted TEXT,
  is_active BOOLEAN DEFAULT true,
  last_connected_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

#### `payment_terminal_transactions` Table
```sql
CREATE TABLE payment_terminal_transactions (
  id VARCHAR(36) PRIMARY KEY,
  sale_id VARCHAR(36) NOT NULL,
  terminal_id VARCHAR(36) NOT NULL,
  provider_transaction_id VARCHAR(100),
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
  response_data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id),
  FOREIGN KEY (terminal_id) REFERENCES payment_terminals(id)
);
```

### Backend API Endpoints

#### Terminal Management
- `GET /api/payment-terminals` - List tenant's terminals
- `POST /api/payment-terminals` - Add new terminal
- `PUT /api/payment-terminals/:id` - Update terminal config
- `DELETE /api/payment-terminals/:id` - Remove terminal
- `POST /api/payment-terminals/:id/test` - Test terminal connection

#### Terminal Transactions
- `POST /api/payment-terminals/:id/charge` - Process payment
- `GET /api/payment-terminals/transactions` - List transactions
- `POST /api/payment-terminals/transactions/:id/refund` - Process refund

### Frontend Integration

#### Terminal Selection UI
```typescript
interface PaymentTerminal {
  id: string;
  terminalType: 'card' | 'upi';
  provider: string;
  deviceName: string;
  isActive: boolean;
  lastConnectedAt: Date;
}

// POS Terminal Selection Component
const TerminalSelector = ({ onTerminalSelect }) => {
  const [terminals, setTerminals] = useState<PaymentTerminal[]>([]);
  // Terminal selection logic
};
```

#### Payment Processing Flow
1. **Terminal Selection**: User selects active terminal for Card/UPI
2. **Amount Transmission**: Send payment amount to terminal
3. **Customer Interaction**: Customer completes payment on terminal
4. **Response Handling**: Process success/failure response
5. **Receipt Generation**: Generate receipt with terminal transaction ID

## 2. Online Payment Gateway Integration (PayPal/Stripe)

### Database Schema

#### `payment_gateways` Table
```sql
CREATE TABLE payment_gateways (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  gateway_type ENUM('stripe', 'paypal', 'razorpay', 'square') NOT NULL,
  is_active BOOLEAN DEFAULT false,
  is_live_mode BOOLEAN DEFAULT false, -- true for production, false for sandbox
  config_data JSON NOT NULL, -- Encrypted API keys and settings
  webhook_secret VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  UNIQUE KEY unique_tenant_gateway (tenant_id, gateway_type)
);
```

#### `payment_gateway_transactions` Table
```sql
CREATE TABLE payment_gateway_transactions (
  id VARCHAR(36) PRIMARY KEY,
  sale_id VARCHAR(36) NOT NULL,
  gateway_id VARCHAR(36) NOT NULL,
  gateway_transaction_id VARCHAR(100),
  payment_intent_id VARCHAR(100), -- Stripe Payment Intent or PayPal Order ID
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status ENUM('pending', 'completed', 'failed', 'cancelled', 'refunded') DEFAULT 'pending',
  gateway_response JSON,
  webhook_data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id),
  FOREIGN KEY (gateway_id) REFERENCES payment_gateways(id)
);
```

### Gateway Configuration

#### Stripe Integration
```javascript
// Stripe Configuration
const stripeConfig = {
  publishableKey: 'pk_test_...', // Frontend
  secretKey: 'sk_test_...', // Backend (encrypted)
  webhookSecret: 'whsec_...', // Webhook verification
  currency: 'usd',
  captureMethod: 'automatic'
};
```

#### PayPal Integration
```javascript
// PayPal Configuration
const paypalConfig = {
  clientId: 'AY...', // Frontend
  clientSecret: 'EH...', // Backend (encrypted)
  environment: 'sandbox', // or 'live'
  currency: 'USD',
  intent: 'capture'
};
```

### Frontend Payment Flow

#### Stripe Payment Component
```typescript
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const StripePayment = ({ amount, onSuccess, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  
  const handleSubmit = async (event) => {
    event.preventDefault();
    
    // Create payment intent on backend
    const { clientSecret } = await createPaymentIntent(amount);
    
    // Confirm payment with Stripe
    const result = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: elements.getElement(CardElement),
      }
    });
    
    if (result.error) {
      onError(result.error);
    } else {
      onSuccess(result.paymentIntent);
    }
  };
};
```

#### PayPal Payment Component
```typescript
import { PayPalButtons } from '@paypal/react-paypal-js';

const PayPalPayment = ({ amount, onSuccess, onError }) => {
  return (
    <PayPalButtons
      createOrder={(data, actions) => {
        return actions.order.create({
          purchase_units: [{
            amount: {
              value: amount.toString(),
              currency_code: 'USD'
            }
          }]
        });
      }}
      onApprove={async (data, actions) => {
        const details = await actions.order.capture();
        onSuccess(details);
      }}
      onError={onError}
    />
  );
};
```

## 3. Settings Page Integration

### Payment Methods Management UI
- **Enable/Disable** payment methods per tenant
- **Terminal Configuration** for Card/UPI methods
- **Gateway Setup** for online payments
- **Test Transactions** for validation

### Configuration Flow
1. **Method Selection**: Choose payment method to configure
2. **Provider Selection**: Select terminal/gateway provider
3. **Credentials Entry**: Enter API keys/credentials (encrypted storage)
4. **Test Connection**: Validate configuration
5. **Activation**: Enable method for POS use

## 4. POS Integration

### Payment Method Selection
```typescript
interface PaymentMethodOption {
  id: string;
  name: string;
  code: string;
  requiresTerminal: boolean;
  terminalType?: 'card' | 'upi';
  gatewayType?: 'stripe' | 'paypal';
  isConfigured: boolean;
}
```

### Payment Processing Logic
1. **Method Selection**: User selects payment method
2. **Configuration Check**: Verify method is properly configured
3. **Processing Route**:
   - **Cash/Charge**: Direct POS processing
   - **Card/UPI Terminal**: Route to terminal integration
   - **Online Gateway**: Route to Stripe/PayPal flow
4. **Transaction Recording**: Store transaction details
5. **Receipt Generation**: Generate appropriate receipt

## 5. Security Considerations

### API Key Management
- **Encryption**: All API keys encrypted at rest
- **Environment Separation**: Separate sandbox/live credentials
- **Key Rotation**: Support for credential updates
- **Access Control**: Role-based access to payment settings

### Transaction Security
- **HTTPS Only**: All payment communications over HTTPS
- **Webhook Verification**: Verify webhook signatures
- **Idempotency**: Prevent duplicate transactions
- **Audit Logging**: Log all payment activities

## 6. Implementation Phases

### Phase 1: Terminal Integration
- [ ] Database schema for terminals
- [ ] Backend API for terminal management
- [ ] Frontend terminal configuration UI
- [ ] Square Reader integration (pilot)

### Phase 2: Gateway Integration
- [ ] Database schema for gateways
- [ ] Stripe integration (backend + frontend)
- [ ] PayPal integration (backend + frontend)
- [ ] Settings page gateway configuration

### Phase 3: POS Integration
- [ ] Payment method routing logic
- [ ] Terminal/gateway selection in POS
- [ ] Transaction recording and receipts
- [ ] Error handling and fallbacks

### Phase 4: Advanced Features
- [ ] Refund processing
- [ ] Partial payments
- [ ] Split payments
- [ ] Recurring payments (subscriptions)

## 7. Testing Strategy

### Unit Tests
- Payment processing logic
- Gateway integration functions
- Terminal communication

### Integration Tests
- End-to-end payment flows
- Webhook handling
- Error scenarios

### Manual Testing
- Real terminal devices
- Sandbox gateway accounts
- POS user workflows
