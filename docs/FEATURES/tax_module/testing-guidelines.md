# Tax Module Testing Guidelines

## Overview

This document provides comprehensive testing guidelines for the Zettaz Cloud tax module. These guidelines cover unit testing, integration testing, and end-to-end testing scenarios to ensure accurate tax calculation and proper POS integration across different scenarios.

## Core Testing Areas

### 1. Database Schema Testing

**Objective**: Verify that the tax database schema is correctly implemented and migrations run successfully.

#### Test Cases:

1. **Table Structure Verification**:
   - Verify all tables have proper columns and data types
   - Check foreign key constraints between related tables
   - Confirm indexes are created for performance

2. **Migration Testing**:
   - Test all migrations run without errors
   - Verify migration rollback functionality
   - Check data preservation during schema changes

```sql
-- Example query to verify tax_class_rates table structure
DESCRIBE tax_class_rates;

-- Example query to test foreign key constraints
SELECT 
  TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM
  INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE
  REFERENCED_TABLE_SCHEMA = 'your_database_name' AND
  (REFERENCED_TABLE_NAME = 'tax_classes' OR TABLE_NAME = 'tax_class_rates');
```

### 2. Tax Calculation Logic Testing

**Objective**: Ensure tax calculations are accurate across different scenarios and configurations.

#### Test Cases:

1. **Tax-Exclusive Calculations**:
   - Test basic add-on tax calculation
   - Verify correct rounding of tax amounts
   - Test calculations with different tax rates

2. **Tax-Inclusive Calculations**:
   - Test tax extraction from inclusive prices
   - Verify consistency in tax backing calculation
   - Test correct subtotal calculation

3. **Edge Cases**:
   - Test zero tax rate scenarios
   - Test maximum tax rate scenarios
   - Test tax calculations for very small and very large amounts

```javascript
// Example tax calculation test for tax-exclusive
describe('Tax Calculation - Exclusive', () => {
  test('should calculate correct tax amount for tax-exclusive store', () => {
    const price = 10.00;
    const rate = 0.075; // 7.5% tax rate
    const taxBasis = 'EXCLUSIVE';
    
    const result = taxService.calculateTax(price, rate, taxBasis);
    
    expect(result.taxAmount).toBeCloseTo(0.75, 2);
    expect(result.finalPrice).toBeCloseTo(10.75, 2);
  });
});

// Example tax calculation test for tax-inclusive
describe('Tax Calculation - Inclusive', () => {
  test('should extract correct tax amount from tax-inclusive price', () => {
    const price = 10.00;
    const rate = 0.075; // 7.5% tax rate
    const taxBasis = 'INCLUSIVE';
    
    const result = taxService.calculateTax(price, rate, taxBasis);
    
    expect(result.taxAmount).toBeCloseTo(0.698, 3);
    expect(result.finalPrice).toBeCloseTo(10.00, 2);
    expect(result.netPrice).toBeCloseTo(9.302, 3);
  });
});
```

### 3. API Endpoint Testing

**Objective**: Test all tax-related API endpoints for correct behavior and error handling.

#### Test Cases:

1. **Tax Class Management**:
   - Test creating, retrieving, updating, and deleting tax classes
   - Test validation and error handling
   - Test proper tenant/store filtering

2. **Tax Rate Management**:
   - Test CRUD operations for tax rates
   - Test validation for required fields and data types
   - Test retrieving rates by tax class and store

3. **Store Tax Configuration**:
   - Test updating store's tax basis setting
   - Test retrieving store's tax configuration
   - Test validation for store tax settings

```javascript
// Example API test for creating a tax class
describe('Tax Class API', () => {
  test('should create a new tax class', async () => {
    const taxClassData = {
      name: 'Test Tax Class',
      description: 'For testing purposes',
      is_active: true
    };
    
    const response = await request(app)
      .post('/api/v1/settings/taxes/classes')
      .set('Authorization', `Bearer ${token}`)
      .set('store-id', storeId)
      .send(taxClassData);
    
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('id');
    expect(response.body.data.name).toBe(taxClassData.name);
  });
});
```

### 4. Frontend Component Testing

**Objective**: Test UI components related to tax configuration and display.

#### Test Cases:

1. **Tax Settings UI**:
   - Test tax class form validation
   - Test tax rate form validation
   - Test store tax basis setting UI

2. **POS Tax Display**:
   - Test tax amount display in cart
   - Test tax-inclusive vs tax-exclusive display variations
   - Test tax exemption display

```javascript
// Example component test for tax basis setting
describe('TaxBasisSelector Component', () => {
  test('should update store tax basis setting', async () => {
    // Mock store data
    const store = {
      id: 'store-id',
      default_tax_basis: 'EXCLUSIVE'
    };
    
    // Mock update function
    const onUpdate = jest.fn();
    
    // Render component
    render(<TaxBasisSelector store={store} onUpdate={onUpdate} />);
    
    // Select Inclusive option
    const inclusiveRadio = screen.getByLabelText(/Tax Inclusive/i);
    fireEvent.click(inclusiveRadio);
    
    // Verify update was called
    expect(onUpdate).toHaveBeenCalledWith({ default_tax_basis: 'INCLUSIVE' });
  });
});
```

### 5. Integration Testing

**Objective**: Verify that tax functionality works correctly when integrated with other modules.

#### Test Cases:

1. **Cart Integration**:
   - Test adding taxable and non-taxable products to cart
   - Test customer tax exemption in cart
   - Test tax calculation for mixed tax classes

2. **Checkout Flow**:
   - Test complete checkout with tax calculation
   - Test order creation with tax details
   - Test receipt generation with tax information

3. **Reporting Integration**:
   - Test tax data in sales reports
   - Test tax summary reports
   - Test tax data export functions

```javascript
// Example integration test for checkout with taxes
describe('Checkout Process with Taxes', () => {
  test('should create order with correct tax information', async () => {
    // Set up test data
    const store = await createTestStore({ default_tax_basis: 'EXCLUSIVE' });
    const taxClass = await createTestTaxClass();
    const taxRate = await createTestTaxRate({ tax_class_id: taxClass.id, rate: 0.08 });
    const product = await createTestProduct({ tax_class_id: taxClass.id, price: 10.00 });
    
    // Create cart and add product
    const cart = new Cart(store);
    cart.addItem(product, 2);
    
    // Process checkout
    const order = await checkoutService.processCheckout(cart, { paymentMethod: 'cash' });
    
    // Assertions
    expect(order.tax_basis_at_sale).toBe('EXCLUSIVE');
    expect(order.total_tax_amount).toBeCloseTo(1.60, 2); // 2 items * $10 * 8% tax
    expect(order.items[0].tax_amount).toBeCloseTo(0.80, 2);
    expect(order.items[0].applicable_tax_class_rate_id).toBe(taxRate.id);
  });
});
```

## Specific Testing Scenarios

### Scenario 1: Tax Basis Changes

**Objective**: Test that changing a store's tax basis correctly affects pricing and calculations.

#### Test Steps:

1. Configure store with tax-exclusive basis
2. Add products to cart and verify tax is added on top
3. Change store to tax-inclusive basis
4. Add same products to a new cart
5. Verify prices now include tax and totals are correct

### Scenario 2: Tax Exemption Testing

**Objective**: Verify that tax exemption for customers works correctly.

#### Test Steps:

1. Create a standard customer and a tax-exempt customer
2. Add identical products to cart for both customers
3. Verify tax is applied for standard customer
4. Verify tax is not applied for tax-exempt customer
5. Test tax exemption with various product combinations

### Scenario 3: Multiple Tax Classes

**Objective**: Test that different tax classes can have different rates and apply correctly.

#### Test Steps:

1. Create multiple tax classes (Standard, Reduced, Zero-rated)
2. Assign different rates to each class
3. Create products in each tax class
4. Add these products to cart
5. Verify each product has the correct tax applied

### Scenario 4: Returns and Refunds

**Objective**: Test that returns properly refund the exact tax amount.

#### Test Steps:

1. Process a sale with taxable items
2. Record the tax collected
3. Process a full return
4. Verify exact tax amount is refunded
5. Process partial returns
6. Verify proportional tax is refunded

## Automated Testing Setup

### Unit Tests

Configure Jest or Mocha with the following test categories:

1. **Tax Calculators**:
   - Tests for tax formulas and calculations
   - Tests for edge cases and boundary conditions
   - Tests for different tax basis scenarios

2. **Tax API Services**:
   - Tests for tax class API functions
   - Tests for tax rate API functions
   - Tests for store configuration API functions

### Integration Tests

Configure Cypress or similar for:

1. **Tax Settings Workflows**:
   - Tax class creation and management
   - Tax rate configuration
   - Store tax basis setting

2. **POS Tax Scenarios**:
   - Adding products and viewing tax in cart
   - Processing checkout with various tax scenarios
   - Handling returns and viewing correct tax refunds

## Manual Testing Checklist

### UI Testing

- [ ] Tax settings UI displays correctly
- [ ] Tax basis selection works properly
- [ ] Tax class management UI functions as expected
- [ ] Tax rate management UI functions as expected
- [ ] POS displays taxes according to store configuration
- [ ] Receipt shows tax information correctly
- [ ] Tax-exempt status is clearly indicated

### Edge Case Testing

- [ ] Test with very small amounts (e.g., $0.01)
- [ ] Test with large quantities
- [ ] Test with discount combinations
- [ ] Test with mixed taxable and non-taxable items

## Testing Documentation

For each test scenario, document:

1. Test ID and description
2. Preconditions and setup
3. Test steps
4. Expected results
5. Actual results
6. Pass/Fail status
7. Any issues or observations

## Regression Testing

After any changes to the tax module, perform regression testing:

1. Run all automated unit tests
2. Run integration tests for key workflows
3. Perform manual testing of critical tax scenarios
4. Verify tax calculations in sample orders
5. Check tax reporting accuracy

## Performance Testing

Test the tax system under load:

1. Time tax calculations for large carts
2. Measure response time for tax-related API endpoints
3. Test bulk operations (e.g., importing many tax rates)
4. Monitor database performance for tax-related queries

## Security Testing

Verify security measures:

1. Test access controls for tax settings
2. Verify proper validation of tax-related inputs
3. Check for potential SQL injection in tax queries
4. Verify audit logging of tax configuration changes

## Deployment Testing

Before deploying tax module changes:

1. Test migration scripts in staging environment
2. Verify backward compatibility
3. Check for any rounding or calculation differences
4. Test data migration for existing orders
5. Verify reporting still functions correctly
