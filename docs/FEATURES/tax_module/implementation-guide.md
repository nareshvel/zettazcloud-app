# Tax Module Implementation Guide

## Overview

This document outlines the technical implementation details for the tax module in Zettaz Cloud, including system architecture, calculation logic, and best practices for developers working with the tax system.

## System Architecture

The tax module is built around three core principles:

1. **Store-Specific Configuration**: Each store defines its own tax basis and default tax class
2. **Item-Wise Tax Calculation**: Tax is calculated at the individual item level for maximum flexibility
3. **Separation of Configuration and Processing**: Tax rules are defined separately from tax application logic

The main components of the system include:

- **Tax Configuration API**: RESTful endpoints for managing tax classes and rates
- **Tax Calculation Services**: Backend services handling tax calculation logic
- **Store Configuration Module**: Controls store-level tax settings
- **POS Integration Layer**: Applies tax rules during checkout

## Tax Calculation Logic

### Core Formula

Tax calculation depends on the store's tax basis setting:

#### For Tax-Exclusive Pricing (Add-on Tax)
```
tax_amount = price * tax_rate
final_price = price + tax_amount
```

#### For Tax-Inclusive Pricing (Embedded Tax)
```
tax_amount = price * (tax_rate / (1 + tax_rate))
final_price = price
net_price = price - tax_amount
```

### Multi-Step Decision Logic

For each product added to the cart, the system follows this decision logic:

1. **Taxability Check**
   - If `product.is_taxable` is false, no tax applies
   - If customer is tax-exempt (`customers.is_tax_exempt` is true), no tax applies

2. **Tax Class Determination**
   - If product has a specific tax class (`product.tax_class_id` is not NULL), use that
   - Otherwise, use the store's default tax class (`store.tax_class_id`)

3. **Tax Rate Lookup**
   - Find the rate from `tax_class_rates` using the store_id (current store) and the determined tax_class_id
   - Capture both the rate value and the `tax_class_rates.id` for reference

4. **Tax Basis Determination**
   - Read the store's `default_tax_basis` setting (INCLUSIVE or EXCLUSIVE)

5. **Tax Calculation**
   - Apply the appropriate formula based on tax basis

6. **Order Recording**
   - Store the calculated values in `order_items.tax_amount`
   - Record the applied rate ID in `order_items.applicable_tax_class_rate_id`
   - Store the tax basis in `orders.tax_basis_at_sale`

## Implementation Details

### Backend API Endpoints

#### Tax Class Management

```
GET /api/v1/settings/taxes/classes
POST /api/v1/settings/taxes/classes
GET /api/v1/settings/taxes/classes/{id}
PUT /api/v1/settings/taxes/classes/{id}
DELETE /api/v1/settings/taxes/classes/{id}
```

#### Tax Rate Management

```
GET /api/v1/settings/taxes/classes/{classId}/rates
POST /api/v1/settings/taxes/classes/{classId}/rates
GET /api/v1/settings/taxes/rates/{id}
PUT /api/v1/settings/taxes/rates/{id}
DELETE /api/v1/settings/taxes/rates/{id}
```

#### Store Tax Configuration

```
GET /api/v1/settings/store
PUT /api/v1/settings/store
```

### Backend Controller Implementation

The tax class controller implements standard CRUD operations:

```javascript
const getAllTaxClasses = async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { store_id } = req.headers;
    
    // Query includes store-specific and tenant-wide tax classes
    const result = await pool.query(
      `SELECT * FROM tax_classes 
       WHERE tenant_id = ? 
       AND (store_id = ? OR store_id IS NULL)
       AND is_active = 1`,
      [tenant_id, store_id]
    );
    
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching tax classes:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch tax classes'
    });
  }
};
```

### Tax Calculation Implementation

The cart service handles tax calculations based on the store configuration:

```javascript
// Example of tax calculation in CartService.js
const calculateTax = (item, storeSettings) => {
  // Early return for non-taxable items or exempt customers
  if (!item.product.is_taxable || (item.customer && item.customer.is_tax_exempt)) {
    return {
      taxAmount: 0,
      taxRate: 0,
      appliedTaxClassRateId: null
    };
  }
  
  // Determine tax class and get applicable tax rate
  const taxClassId = item.product.tax_class_id || storeSettings.tax_class_id;
  const taxRate = getTaxRateForClassAndStore(taxClassId, storeSettings.id);
  
  if (!taxRate) {
    return {
      taxAmount: 0,
      taxRate: 0,
      appliedTaxClassRateId: null
    };
  }
  
  let taxAmount = 0;
  const itemPrice = item.product.price;
  const quantity = item.quantity;
  
  // Calculate based on store tax basis
  if (storeSettings.default_tax_basis === 'EXCLUSIVE') {
    // Add-on tax
    taxAmount = itemPrice * taxRate.rate * quantity;
  } else {
    // Inclusive tax - extract tax from price
    taxAmount = (itemPrice * (taxRate.rate / (1 + taxRate.rate))) * quantity;
  }
  
  return {
    taxAmount,
    taxRate: taxRate.rate,
    appliedTaxClassRateId: taxRate.id
  };
};
```

## Frontend Implementation

### Store Settings UI

The store settings page includes configuration options for tax basis:

```jsx
// In SettingsTaxes.tsx
const TaxBasisSection = ({ store, onUpdate }) => {
  const [taxBasis, setTaxBasis] = useState(store.default_tax_basis || 'EXCLUSIVE');
  
  const handleTaxBasisChange = (e) => {
    const newBasis = e.target.value;
    setTaxBasis(newBasis);
    onUpdate({ default_tax_basis: newBasis });
  };
  
  return (
    <Section title="Tax Basis Configuration">
      <FormControl>
        <FormLabel>Default Tax Basis</FormLabel>
        <RadioGroup value={taxBasis} onChange={handleTaxBasisChange}>
          <Radio value="EXCLUSIVE">
            Tax Exclusive (Add-on Tax)
            <FormHelperText>
              Product prices are shown without tax. Tax is added at checkout.
            </FormHelperText>
          </Radio>
          <Radio value="INCLUSIVE">
            Tax Inclusive (Embedded Tax)
            <FormHelperText>
              Product prices already include tax. The exact price shown is what customers pay.
            </FormHelperText>
          </Radio>
        </RadioGroup>
      </FormControl>
    </Section>
  );
};
```

### Cart Display Implementation

The POS cart display shows tax information based on the store's configuration:

```jsx
// In CartItemDisplay.tsx
const CartItem = ({ item, storeTaxBasis }) => {
  const displayPrice = item.product.price;
  const displayTax = item.taxInfo.taxAmount;
  
  return (
    <CartItemContainer>
      <div className="item-details">
        <span className="item-name">{item.product.name}</span>
        <span className="item-price">
          {formatCurrency(displayPrice)} 
          {storeTaxBasis === 'INCLUSIVE' ? ' (Tax Incl.)' : ''}
        </span>
      </div>
      {displayTax > 0 && (
        <div className="item-tax">
          Tax: {formatCurrency(displayTax)}
        </div>
      )}
      <div className="item-total">
        {formatCurrency(displayPrice * item.quantity)}
      </div>
    </CartItemContainer>
  );
};
```

## Key Implementation Considerations

### Tax Changes and Orders

It's important to note that:

1. The tax basis at the time of sale is recorded in `orders.tax_basis_at_sale`
2. The actual tax rates applied are recorded in `order_items.applicable_tax_class_rate_id`
3. The tax amounts are explicitly stored in `order_items.tax_amount`

This ensures that even if tax configurations change, historical orders maintain their correct calculations and can be properly reported.

### Performance Optimization

Tax calculations should be optimized for performance in high-volume POS operations:

1. Cache tax rates for frequently used tax classes
2. Perform bulk tax calculations when applying rates to multiple items
3. Minimize database queries during checkout flow

### Error Handling

Tax calculation code should include robust error handling:

1. Validate all inputs to tax calculation functions
2. Provide graceful fallbacks if tax rates cannot be determined
3. Log detailed information about tax calculation failures
4. Include clear error messaging for administration interfaces

## Migration Strategies

When migrating between tax systems:

1. **Schema Migration**: Follow standard database migration procedures
2. **Data Migration**: Ensure tax classes and rates are properly mapped
3. **Application Logic**: Update cart and order processing to use the new tax system
4. **Testing**: Thoroughly test with representative historical orders

### Example: is_inclusive Flag Removal

The recent migration removing the `is_inclusive` flag from tax_class_rates and moving to a store-level setting required:

1. Adding `default_tax_basis` to the stores table
2. Migrating the is_inclusive value from tax_class_rates to stores.default_tax_basis
3. Updating all tax calculation code to use the store setting instead of rate-specific flags
4. Comprehensive testing across both tax bases

## Future Enhancements

Planned enhancements to the tax system include:

1. **Advanced Reporting**: Enhanced tax reporting capabilities
2. **Multiple Tax Jurisdiction Support**: More sophisticated geographical tax handling
3. **Tax Rules Engine**: Rule-based tax application for complex scenarios
4. **Tax Integration APIs**: Connection to external tax systems
5. **Compound Tax Support**: Support for taxes that apply on top of other taxes
