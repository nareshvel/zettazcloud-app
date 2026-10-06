# POS Integration Guide for Promotional Offers

This document outlines how to integrate the promotional offers system with the Point of Sale (POS) transaction flow in Zettaz Cloud, covering both implemented functionality and pending tasks.

## Current Implementation Status

### Implemented Features
- Basic product-level discounts through the promotional offers system
- Connection between products and promotional offers via `promotional_offer_id` field
- Simple percentage and fixed discount calculation in cart
- UI for offer creation and management

### Pending Implementation
- Complex offer types (Buy X Get Y, Bundle Pricing, Tiered Pricing)
- Backend processing for multi-product offers
- Price tiers database table and management
- Integration with order processing workflow
- Usage tracking and limit enforcement

## Integration Points in POS Flow

### 1. Cart Addition Process

#### Current Implementation
When a product is added to the cart, the system checks if it has an assigned promotional offer:

```javascript
// In CartContext.tsx or similar service
const addItemToCart = (product, quantity) => {
  // Check for product-specific offer
  if (product.promotionalOfferId) {
    // Simple discount application
    applyProductDiscount(product, quantity);
  } else {
    // Add without discount
    addRegularItemToCart(product, quantity);
  }
};
```

#### Pending Enhancements
- Implement scanning for applicable store-wide or category offers
- Support Buy X Get Y detection when quantity threshold is met
- Handle bundle detection when multiple qualifying products are present
- Apply tiered pricing based on quantity thresholds

### 2. Discount Calculation Service

#### Requirements
A comprehensive discount calculation service should:
- Check all potentially applicable offers for a transaction
- Handle priority and conflict resolution between offers
- Calculate optimal discount combinations for customers
- Apply correct tax calculations on discounted amounts
- Update discount attribution for reporting

```typescript
// Example of enhanced discount calculation service
interface DiscountCalculationService {
  // Find all offers that could apply to the current cart
  findApplicableOffers(cartItems: CartItem[]): Promise<PromotionalOffer[]>;
  
  // Determine optimal offer combination
  calculateOptimalDiscounts(
    cartItems: CartItem[], 
    applicableOffers: PromotionalOffer[]
  ): DiscountCalculationResult;
  
  // Apply calculated discounts to cart
  applyDiscountsToCart(
    cart: Cart, 
    calculationResult: DiscountCalculationResult
  ): Cart;
}

// Calculation result with detailed attribution
interface DiscountCalculationResult {
  appliedOffers: AppliedOffer[];
  totalDiscountAmount: number;
  itemDiscounts: Map<string, ItemDiscount[]>; // Maps item ID to discounts
  subtotalBeforeDiscount: number;
  subtotalAfterDiscount: number;
  taxableAmountAdjustment: number;
}
```

### 3. Checkout Integration

#### Required Functionality
- Display applied discounts clearly on checkout screen
- Show savings amount and percentage for customer satisfaction
- Allow cashier to override or remove offers if necessary
- Print discount details on receipt
- Track offer usage and enforce usage limits

#### Example UI Components Needed
- Discount summary component in checkout view
- Per-item discount display
- Discount override modal with manager authorization
- Receipt template with discount sections

### 4. Order Processing

#### Data Storage Requirements
- Record which offers were applied to each order
- Store discount amount per line item
- Maintain discount attribution for reporting
- Track usage counts for offers with limits

```sql
-- Example schema additions needed for order_items table
ALTER TABLE order_items ADD COLUMN applied_offer_id CHAR(36);
ALTER TABLE order_items ADD COLUMN discount_amount DECIMAL(10, 2);
ALTER TABLE order_items ADD COLUMN original_price DECIMAL(10, 2);
ALTER TABLE order_items ADD COLUMN discount_name VARCHAR(255);

-- Foreign key to promotional offers
ALTER TABLE order_items ADD CONSTRAINT fk_order_items_offers
  FOREIGN KEY (applied_offer_id) REFERENCES promotional_offers(id)
  ON DELETE SET NULL;
```

## Implementation Plan for Full POS Integration

### Phase 1: Basic Discount Types (Currently In Progress)
- Complete percentage and fixed discount integration
- Ensure proper tax handling for discounted items
- Verify receipt printing with basic discounts
- Test manual offer application by cashiers

### Phase 2: Complex Offer Types
- Implement Buy X Get Y logic in cart processing
- Add bundle detection and pricing
- Create tiered pricing calculator
- Develop UI to show complex discount application

### Phase 3: Advanced Features
- Implement automatic offer suggestion system
- Add offer stacking with priority rules
- Create override authorization workflow
- Develop comprehensive reporting

## Testing Scenarios

### Basic Discount Testing
1. Add product with percentage discount to cart
2. Add product with fixed amount discount to cart
3. Verify correct discount calculation
4. Check receipt formatting
5. Verify order database records

### Complex Offer Testing
1. Test Buy X Get Y with same product
2. Test Buy X Get Y with different product
3. Test bundle offers with all qualifying products
4. Test bundle offers with partial qualification
5. Test tiered pricing at different quantity levels

### Edge Cases
1. Test maximum discount caps
2. Test offer expiration at midnight boundary
3. Test usage limits (per customer and global)
4. Test offer priority when multiple offers apply
5. Test partial returns of discounted items

## Reporting and Analytics Integration

### Required Reports
- Discount usage by offer, product, and category
- Discount effectiveness analysis
- Revenue impact of promotions
- Customer response to specific offers

### Data Requirements
- Complete offer usage tracking
- Attribution of each discount to specific offers
- Customer purchase history with offer response

## Common Implementation Issues and Solutions

### Issue: Incorrect Tax Calculation on Discounted Items
**Solution**: Ensure discount amount is properly subtracted before tax calculation; store original and discounted prices separately.

### Issue: Multiple Offers Conflict
**Solution**: Implement priority system and clear rules for offer stacking or exclusivity.

### Issue: Performance Degradation with Complex Calculations
**Solution**: Optimize offer detection algorithms, implement caching for frequently used offers.

### Issue: Inconsistent Discount Application
**Solution**: Centralize discount calculation in a single service, add comprehensive unit tests.

## Security and Authorization

### Discount Override Controls
- Require manager authorization for manual discount adjustments
- Log all discount overrides with user ID and reason
- Set maximum override amounts based on user role

### Fraud Prevention
- Monitor unusual discount patterns
- Implement limits on frequency of offer usage
- Create alerts for suspicious discount activity

## Future Considerations

### Multichannel Integration
- Ensure consistent discount application across POS, e-commerce, and mobile app
- Synchronize offer usage across channels
- Provide unified reporting

### AI-Enhanced Offer Creation
- Analyze sales patterns to suggest effective offers
- Automatically adjust offer parameters for optimal results
- Predict customer response to potential offers

### Customer-Specific Offers
- Generate personalized offers based on purchase history
- Implement customer loyalty integration with tiered benefits
- Create birthday and anniversary special offers
