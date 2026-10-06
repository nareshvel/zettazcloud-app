# Tax Module POS Integration Guide

## Overview

This document explains how the tax module integrates with the Point of Sale (POS) system, detailing the transaction flow, user interface elements, and key technical considerations for real-world usage scenarios.

## Transaction Flow

### 1. Cart Addition Process

When a product is added to the cart, the tax module performs several operations:

1. **Product Tax Class Determination**:
   - The system checks if the product has a specific tax class (`product.tax_class_id`)
   - If not, it uses the store's default tax class (`store.tax_class_id`)

2. **Customer Tax Status Check**:
   - If customer is identified, system checks `customer.is_tax_exempt` status
   - Tax-exempt customers with valid exemption certificates have taxes removed

3. **Tax Rate Application**:
   - The system retrieves the applicable tax rate from `tax_class_rates`
   - The store's tax basis setting determines how the tax is calculated

4. **Cart Display Update**:
   - Tax information is displayed according to the store's tax basis setting
   - For tax-exclusive stores, the tax is shown separately
   - For tax-inclusive stores, prices include tax with notification

```javascript
// Example cart addition with tax calculation
function addToCart(product, quantity, customer = null) {
  // Get product tax details
  const taxClassId = product.tax_class_id || store.tax_class_id;
  const isTaxable = product.is_taxable && (!customer || !customer.is_tax_exempt);
  
  // Calculate tax based on store settings
  const taxDetails = isTaxable ? 
    calculateTax(product.price, taxClassId, store.default_tax_basis) : 
    { amount: 0, rate: 0, rateId: null };
  
  // Add to cart with tax details
  cart.items.push({
    product,
    quantity,
    unitPrice: product.price,
    taxAmount: taxDetails.amount * quantity,
    taxRate: taxDetails.rate,
    taxClassRateId: taxDetails.rateId,
    lineTotal: store.default_tax_basis === 'EXCLUSIVE' ? 
      (product.price * quantity) + (taxDetails.amount * quantity) : 
      product.price * quantity
  });
  
  // Update cart totals
  updateCartTotals();
}
```

### 2. Checkout Process

During checkout, the tax module:

1. **Finalizes Tax Calculations**:
   - Ensures all tax calculations are up-to-date
   - Calculates the total tax amount for the order

2. **Records Tax Details**:
   - Stores the tax basis used at time of sale
   - Records tax class rates applied to each item
   - Preserves tax amounts for reporting and refunds

3. **Receipt Generation**:
   - Formats tax information according to local requirements
   - Shows tax breakdown by rate (if multiple rates apply)
   - Displays tax status for each item as needed

```javascript
// Example checkout process with tax handling
async function processCheckout(cart, paymentDetails) {
  // Final tax calculations and verification
  const orderTaxDetails = calculateOrderTaxes(cart);
  
  // Create order with tax information
  const order = {
    id: generateOrderId(),
    store_id: currentStore.id,
    customer_id: cart.customer?.id || null,
    items: cart.items.map(item => ({
      product_id: item.product.id,
      quantity: item.quantity,
      price: item.unitPrice,
      tax_amount: item.taxAmount,
      applicable_tax_class_rate_id: item.taxClassRateId
    })),
    subtotal_amount: cart.subtotal,
    total_tax_amount: orderTaxDetails.totalTax,
    total_amount: cart.total,
    tax_basis_at_sale: currentStore.default_tax_basis,
    // Other order fields
  };
  
  // Save order to database
  const savedOrder = await saveOrder(order);
  
  // Generate receipt with tax details
  generateReceipt(savedOrder);
  
  return savedOrder;
}
```

## User Interface Elements

### 1. Product Display

- For tax-exclusive stores, prices are shown without tax
- For tax-inclusive stores, prices include tax with a "Tax Included" indicator
- Product listing clearly indicates tax status (taxable/non-taxable)

### 2. Cart Display

- Line items show unit price based on store tax basis
- Tax amount displayed per item (for tax-exclusive) or as notification (for tax-inclusive)
- Tax breakdown section shows taxes by category/rate

```jsx
// Example POS cart component
const POSCart = ({ cart, store }) => {
  const taxInclusive = store.default_tax_basis === 'INCLUSIVE';
  
  return (
    <div className="pos-cart">
      <div className="cart-header">
        {taxInclusive && <div className="tax-notice">All prices include tax</div>}
      </div>
      
      <div className="cart-items">
        {cart.items.map(item => (
          <CartItem 
            key={item.id} 
            item={item} 
            taxInclusive={taxInclusive} 
          />
        ))}
      </div>
      
      <div className="cart-summary">
        <div className="subtotal">
          <span>Subtotal:</span>
          <span>{formatCurrency(cart.subtotal)}</span>
        </div>
        
        {!taxInclusive && (
          <div className="tax-total">
            <span>Tax:</span>
            <span>{formatCurrency(cart.taxTotal)}</span>
          </div>
        )}
        
        <div className="grand-total">
          <span>Total:</span>
          <span>{formatCurrency(cart.total)}</span>
        </div>
      </div>
    </div>
  );
};
```

### 3. Checkout Screen

- Displays itemized receipt with appropriate tax information
- For tax-inclusive stores: Shows embedded tax amounts
- For tax-exclusive stores: Shows added tax amounts
- Tax exemption status clearly displayed when applicable

### 4. Receipt Design

- Tax information formatted according to local regulations
- Tax-exclusive receipts show:
  - Item prices without tax
  - Tax added per line or at the bottom
  - Tax rates applied
- Tax-inclusive receipts show:
  - Item prices with tax included
  - Tax component extracted for reporting purposes
  - Notice that prices include tax

## Common POS Scenarios

### Scenario 1: Mixed Tax Classes

When a transaction includes items with different tax classes:

1. Each item is taxed according to its specific tax class
2. The receipt shows a breakdown of taxes by category
3. Tax totals are properly aggregated for the order

Example: A grocery store selling both standard goods (taxable) and food items (non-taxable).

### Scenario 2: Tax-Exempt Customer

When a tax-exempt customer is identified:

1. Customer tax exemption status is verified
2. Tax exemption number is recorded with the transaction
3. Taxes are removed from all applicable items
4. Receipt indicates tax exemption status and certificate number

Example: A non-profit organization purchasing office supplies.

### Scenario 3: Returns and Refunds

For returns and partial refunds:

1. The system retrieves the original transaction's tax details
2. Tax is refunded exactly as it was collected
3. Return receipt shows the appropriate tax refund amounts

```javascript
// Example return processing
async function processReturn(originalOrderId, returnItems) {
  // Get original order with tax details
  const originalOrder = await getOrder(originalOrderId);
  
  // Process each return item with exact tax refund
  const returnData = returnItems.map(returnItem => {
    const originalItem = originalOrder.items.find(i => 
      i.product_id === returnItem.product_id
    );
    
    // Calculate exact tax refund
    const taxRefund = (originalItem.tax_amount / originalItem.quantity) * returnItem.quantity;
    
    return {
      product_id: returnItem.product_id,
      quantity: returnItem.quantity,
      price: originalItem.price,
      tax_amount: taxRefund,
      applicable_tax_class_rate_id: originalItem.applicable_tax_class_rate_id
    };
  });
  
  // Create return transaction
  const returnOrder = await createReturnOrder(originalOrderId, returnData);
  
  return returnOrder;
}
```

### Scenario 4: Price Adjustments

For manual price adjustments:

1. Tax is recalculated based on the adjusted price
2. The system maintains proper tax rates and basis
3. Audit logs track both price and tax adjustments

## Technical Integration Points

### 1. Cart Service and Tax Calculation

The cart service integrates with tax calculation logic:

```javascript
// Integration between CartService and TaxService
class CartService {
  constructor(storeService, taxService, productService) {
    this.storeService = storeService;
    this.taxService = taxService;
    this.productService = productService;
  }
  
  async addToCart(productId, quantity, customerId = null) {
    const product = await this.productService.getProduct(productId);
    const store = await this.storeService.getCurrentStore();
    const customer = customerId ? await this.customerService.getCustomer(customerId) : null;
    
    // Get tax details from tax service
    const taxInfo = await this.taxService.calculateProductTax({
      product,
      store,
      customer,
      quantity
    });
    
    // Add to cart with tax info
    // ...
  }
}
```

### 2. Order Creation

The order service integrates tax information into order records:

```javascript
// Tax integration in OrderService
class OrderService {
  async createOrder(cart, paymentDetails) {
    const store = await this.storeService.getCurrentStore();
    
    // Create order with tax details
    const orderData = {
      // ...order fields
      tax_basis_at_sale: store.default_tax_basis,
      items: cart.items.map(item => ({
        // ...item fields
        tax_amount: item.taxAmount,
        applicable_tax_class_rate_id: item.taxClassRateId
      }))
    };
    
    return this.orderRepository.save(orderData);
  }
}
```

### 3. Receipt Generation

The receipt service formats tax information according to requirements:

```javascript
// Tax handling in ReceiptService
class ReceiptService {
  generateReceipt(order) {
    const taxInclusive = order.tax_basis_at_sale === 'INCLUSIVE';
    const receiptData = {
      // ...receipt fields
      taxDisplayMode: taxInclusive ? 'INCLUDED' : 'SEPARATE',
      taxBreakdown: this.generateTaxBreakdown(order),
      lineItems: order.items.map(item => ({
        // ...item fields
        priceDisplay: this.formatItemPrice(item, taxInclusive),
        taxDisplay: this.formatItemTax(item, taxInclusive)
      }))
    };
    
    return this.receiptTemplate.render(receiptData);
  }
  
  generateTaxBreakdown(order) {
    // Group taxes by rate for summary display
    // ...
  }
}
```

## Troubleshooting Common Issues

### Issue: Tax Calculation Discrepancies

**Symptoms:**
- Different tax amounts for the same product in different transactions
- Rounding errors in tax calculation

**Solutions:**
- Ensure consistent rounding rules are applied (round at the line item level)
- Verify that the correct store tax basis is being used
- Check for proper tax class assignment for products
- Validate that the tax rates are correctly defined

### Issue: Tax Exemption Not Applied

**Symptoms:**
- Tax-exempt customers still being charged tax
- Tax exemption only partially applied

**Solutions:**
- Verify customer's tax-exempt status in the database
- Check that exemption certificate is not expired
- Ensure the tax calculation service is checking exemption status
- Validate that all product types respect tax exemption status

### Issue: Tax Reporting Errors

**Symptoms:**
- Tax reports show incorrect totals
- Missing tax data for specific transactions

**Solutions:**
- Confirm tax details are being properly recorded with each order
- Check that the tax_basis_at_sale is recorded correctly
- Ensure applicable_tax_class_rate_id is stored for each item
- Validate that historical tax rates are preserved for reporting

## Best Practices

1. **Consistent Rounding**:
   - Always round tax calculations to two decimal places
   - Apply consistent rounding at the line item level
   - Avoid recalculating tax from rounded subtotals

2. **Clear Customer Communication**:
   - Clearly indicate tax-inclusive or tax-exclusive pricing
   - Show tax breakdown on receipts for transparency
   - Provide clear tax exemption status on receipts

3. **Audit Trail**:
   - Maintain complete records of tax calculations
   - Log tax rate changes for historical reference
   - Store the exact tax configuration used for each sale

4. **Regular Testing**:
   - Test tax calculations with representative test cases
   - Validate tax calculations after rate changes
   - Test across different stores and tax bases
