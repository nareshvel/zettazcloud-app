# Product-Wise Discounts

This document explains the implementation of product-wise discounts in the Zettaz Cloud POS system, which is a key component of the overall promotional offers functionality.

## Overview

The product-wise discount feature allows assigning specific promotional offers to individual products. When these products are added to the cart, their associated discounts are automatically applied, streamlining the checkout process and ensuring consistent pricing.

## Implementation Status

### Completed Tasks

#### Database
- ✅ Added `promotional_offer_id` column to the `products` table
- ✅ Created foreign key constraint to the `promotional_offers` table
- ✅ Added index for better query performance
- ✅ Created migration scripts for database schema changes

#### Backend
- ✅ Updated product creation and update routes to handle `promotionalOfferId`
- ✅ Created SQL script to migrate legacy discount data to promotional offers
- ✅ Enhanced product API with promotional offer details

#### Frontend
- ✅ Extended `Product` interface to include `promotionalOfferId`
- ✅ Updated `ProductFormModal.tsx` to include promotional offer selection
- ✅ Enhanced `CartContext.tsx` to apply discounts based on promotional offers
- ✅ Added fallback to legacy discount fields for backward compatibility

## Migration from Legacy Discount Fields

The products table previously had `specific_discount_type` and `specific_discount_value` fields that are being replaced by the promotional offers system. A migration strategy has been implemented to transition from these legacy fields to the new system:

1. **Add New Field**: `promotional_offer_id` added to the products table
2. **Create Offers**: Promotional offers generated for products with existing specific discounts
3. **Link Products**: Products associated with their newly created promotional offers
4. **Transition Period**: Both systems supported temporarily
5. **Remove Old Fields**: Legacy discount fields to be removed after full migration

### Migration Script

A SQL migration script (`/backend/migrations/update_product_offer.sql`) has been created that:

1. Creates promotional offers for products with specific discounts
2. Maps products to their corresponding offers
3. Updates product records with the new offer IDs
4. Preserves the original discount values and types

## Implementation Details

### Database Changes

```sql
-- Add promotional_offer_id column to products table
ALTER TABLE products ADD COLUMN promotional_offer_id CHAR(36) DEFAULT NULL;

-- Add foreign key constraint
ALTER TABLE products ADD CONSTRAINT fk_products_promotional_offers
  FOREIGN KEY (promotional_offer_id) REFERENCES promotional_offers(id)
  ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_products_promotional_offer_id ON products(promotional_offer_id);
```

### Backend Integration

The product controller has been updated to handle the `promotionalOfferId` field in both create and update operations:

```javascript
// Product creation with promotional offer
const createProduct = async (req, res) => {
  // ... existing code ...
  const { 
    name, description, sku, price, tax_category_id, category_id,
    promotional_offer_id, // New field
    // ... other fields ...
  } = req.body;
  
  // ... validation ...
  
  const result = await pool.query(
    `INSERT INTO products (
      id, tenant_id, store_id, name, description, sku, price,
      promotional_offer_id, // Added to query
      // ... other fields ...
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ...)`,
    [
      uuid(), tenantId, storeId, name, description, sku, price,
      promotional_offer_id, // Added to values
      // ... other values ...
    ]
  );
  
  // ... response ...
};
```

### Frontend Integration

#### Product Form Modal

The product form has been enhanced to include a dropdown for selecting promotional offers:

```tsx
// In ProductFormModal.tsx
const [offers, setOffers] = useState<PromotionalOffer[]>([]);

// Fetch offers when modal opens
useEffect(() => {
  if (isOpen) {
    fetchActiveOffers();
  }
}, [isOpen]);

const fetchActiveOffers = async () => {
  try {
    const response = await api.get('/promotional-offers/active');
    setOffers(response.data.data);
  } catch (error) {
    console.error('Failed to fetch offers:', error);
  }
};

// In form JSX
<FormControl>
  <FormLabel>Promotional Offer</FormLabel>
  <Select
    value={formData.promotionalOfferId || ''}
    onChange={(e) => handleInputChange('promotionalOfferId', e.target.value)}
  >
    <option value="">No offer</option>
    {offers.map((offer) => (
      <option key={offer.id} value={offer.id}>
        {offer.name} ({getOfferDescription(offer)})
      </option>
    ))}
  </Select>
</FormControl>
```

#### Cart Integration

The cart context has been enhanced to automatically apply product-specific promotional offers:

```tsx
// In CartContext.tsx
const addToCart = (product: Product, quantity: number = 1) => {
  // Check if product has a promotional offer
  if (product.promotionalOfferId) {
    // Fetch offer details if needed
    const offer = getOfferById(product.promotionalOfferId);
    
    // Apply discount based on offer type
    let discount = 0;
    if (offer.offerType === 'percentage_discount') {
      discount = (product.price * offer.discountValue / 100) * quantity;
    } else if (offer.offerType === 'fixed_discount') {
      discount = offer.discountValue * quantity;
    }
    
    // Calculate final price
    const finalPrice = product.price - (discount / quantity);
    
    // Add to cart with discount info
    setCartItems([...cartItems, {
      product,
      quantity,
      originalPrice: product.price,
      appliedDiscounts: [{
        offerId: offer.id,
        offerName: offer.name,
        discountType: offer.offerType,
        discountValue: offer.discountValue,
        discountAmount: discount
      }],
      finalPrice
    }]);
  } else {
    // Add to cart without discount
    // ...
  }
};
```

## How It Works

1. **Assigning Discounts to Products**:
   - When creating or editing a product, select a promotional offer from the dropdown
   - The offer ID is saved with the product in the database

2. **Automatic Discount Application**:
   - When a product with an associated offer is added to the cart, the system:
     - Retrieves the offer details
     - Calculates the discount amount based on the offer type and value
     - Applies the discount to the product's price
     - Updates the cart item with the discount information

3. **Discount Calculation**:
   - For percentage discounts: `discountAmount = (price * percentage / 100) * quantity`
   - For fixed discounts: `discountAmount = fixedAmount * quantity`
   - The final price is calculated as: `finalPrice = originalPrice - (discountAmount / quantity)`

## Testing

A test script is available at `/frontend/src/tests/productDiscountTest.js` which outlines test cases for:
- Adding products with promotional offers to the cart
- Updating a product's promotional offer
- Bulk editing products to assign the same promotional offer

## Known Issues

None at this time. The product-wise discount feature is fully implemented and working as expected.

## Future Enhancements

1. **Bulk Assignment Tools**:
   - Implement UI for bulk assignment of offers to multiple products
   - Add category-level offer application

2. **Enhanced Filters**:
   - Add UI for filtering products by promotional offer
   - Create views showing products with active offers

3. **Analytics Integration**:
   - Develop reporting for discount usage and effectiveness
   - Track which product offers perform best

4. **Legacy Field Removal**:
   - After successful migration, remove legacy discount fields from product schema
   - Update any remaining code references
