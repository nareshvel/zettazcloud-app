# Frontend Components for Promotional Offers

This document outlines the React components, interfaces, and state management patterns used to implement the promotional offers feature in the Zettaz Cloud frontend.

## Key Components

### OfferFormModalTabbed

The main component for creating and editing promotional offers. Implements a tabbed interface that guides users through the offer creation process.

**Location**: `/frontend/src/components/promotions/OfferFormModalTabbed.tsx`

**Props**:
- `isOpen`: Boolean to control modal visibility
- `onClose`: Function to call when closing the modal
- `onSave`: Function that handles form submission
- `initialData`: Optional initial data for editing an existing offer
- `mode`: 'create' or 'edit'

**State Management**:
- Uses React useState hooks for form state
- Form state uses `Partial<ExtendedPromotionalOffer>` type for strong typing
- Tracks the current active tab and completed tabs
- Maintains submission status for feedback

**Tabs Structure**:
1. Basic Info Tab - Name, description, offer type
2. Discount Tab - Discount values, price tiers
3. Rules Tab - Product/category rules
4. Schedule Tab - Start/end dates, usage limits
5. Review Tab - Final review and submission

**Key Features**:
- Centralized validation for each tab
- Conditional rendering based on offer type
- Tab navigation with validation
- Submission handling with success/error feedback

### Tab-Specific Components

#### BasicInfoTab

Handles the basic offer information.

**Key Fields**:
- Offer name (required)
- Offer description (optional)
- Offer type selection (required)

**Usage Guidance**:
- Includes help text explaining each offer type
- Validates required fields

#### DiscountTab

Manages discount values and tiered pricing.

**Key Features**:
- Dynamic form fields based on offer type
- For percentage discounts: percentage value input
- For fixed discounts: fixed amount input
- For bundle price: bundle price input
- For tiered pricing: full CRUD for price tiers
  - Base tier (always present)
  - Add/edit/remove additional tiers
  - Validation for tier quantities and prices

**Tiered Pricing Implementation**:
```jsx
// Tiered pricing handlers in main component
const handleAddPriceTier = () => {
  const newTier = {
    id: uuidv4(),
    quantity: 0,
    price: 0
  };
  setFormData(prev => ({
    ...prev,
    priceTiers: [...(prev.priceTiers || []), newTier]
  }));
};

const handleUpdatePriceTier = (tierId: string, field: keyof PriceTier, value: number) => {
  setFormData(prev => ({
    ...prev,
    priceTiers: (prev.priceTiers || []).map(tier => 
      tier.id === tierId ? { ...tier, [field]: value } : tier
    )
  }));
};

const handleRemovePriceTier = (tierId: string) => {
  setFormData(prev => ({
    ...prev,
    priceTiers: (prev.priceTiers || []).filter(tier => tier.id !== tierId)
  }));
};
```

#### RulesTab

Configures which products or categories the offer applies to.

**Key Features**:
- Rule type selection (product, category, all_products)
- Dynamic product/category selection based on rule type
- Quantity input for each rule
- Support for multiple rules (for bundled offers)
- Add/remove rule functionality
- Product and category search functionality

**Product/Category Loading**:
- Fetch products or categories when input is focused
- Avoid caching issues by always fetching fresh data
- Loading indicators during data fetch

#### ScheduleTab

Sets the offer validity period and usage limits.

**Key Features**:
- Date range picker for offer validity
- Fixed timezone handling for consistent dates
- Optional maximum uses per customer
- Optional maximum total uses
- Start date required, end date optional

#### ReviewTab

Shows a summary of the offer before submission.

**Key Features**:
- Formatted display of all offer details
- Submission status feedback
- Success/failure messaging

## TypeScript Interfaces

### Core Interfaces

```typescript
// Base offer interface
interface PromotionalOffer {
  id: string;
  tenantId: string;
  storeId: string;
  name: string;
  description?: string;
  offerType: OfferType;
  isActive: boolean;
  startDate: string;
  endDate?: string;
  priority: number;
  maxUsesPerCustomer?: number;
  maxTotalUses?: number;
  currentTotalUses: number;
  minimumQuantity: number;
  minimumPurchaseAmount?: number;
  discountValue: number;
  rules?: OfferRule[];
}

// Extended with tiered pricing support
interface ExtendedPromotionalOffer extends PromotionalOffer {
  priceTiers?: PriceTier[];
}

// Price tier structure
interface PriceTier {
  id: string;
  quantity: number;
  price: number;
}

// Offer rule structure
interface OfferRule {
  id: string;
  tenantId: string;
  storeId: string;
  offerId: string;
  ruleType: RuleType;
  entityId?: string;
  quantity: number;
}

// Type definitions
type OfferType = 'buy_x_get_y' | 'percentage_discount' | 'fixed_discount' | 'bundle_price' | 'tiered_pricing';
type RuleType = 'product' | 'category' | 'all_products';
```

## Hooks and Utilities

### useCurrencyFormatter

Custom hook for formatting currency values consistently across the application.

**Usage**:
```jsx
const { format: formatCurrency } = useCurrencyFormatter();
// Later in JSX
<span>{formatCurrency(price)}</span>
```

### Helper Functions

**getEntityName**: Resolves product or category names from their IDs

```jsx
const getEntityName = (type: RuleType, entityId?: string) => {
  if (type === 'all_products') return 'All Products';
  
  if (type === 'product' && entityId) {
    const product = products.find(p => p.id === entityId);
    return product ? product.name : 'Unknown Product';
  }
  
  if (type === 'category' && entityId) {
    const category = categories.find(c => c.id === entityId);
    return category ? category.name : 'Unknown Category';
  }
  
  return 'Unknown';
};
```

## Recent Improvements

1. **Fixed Date Picker Bug**
   - Resolved timezone offset issues causing incorrect saved dates
   - Fixed implementation:
   ```jsx
   const handleDateChange = (field: 'startDate' | 'endDate', date: Date | null) => {
     // Ensure consistent UTC midnight representation
     if (date) {
       const utcDate = new Date(date);
       // Reset hours to avoid timezone issues
       utcDate.setUTCHours(0, 0, 0, 0);
       setFormData(prev => ({ ...prev, [field]: utcDate.toISOString() }));
     } else {
       setFormData(prev => ({ ...prev, [field]: undefined }));
     }
   };
   ```

2. **Improved Product/Category Loading**
   - Removed caching check to fix double-click loading issue
   - Always fetches fresh data on focus

3. **Enhanced Tiered Pricing UI**
   - Full CRUD support for price tiers
   - Improved validation
   - Real-time pricing preview

4. **Added Usage Guidelines**
   - Helpful tips in UI for bundle and Buy X Get Y offers
   - Guidance for scheduling and limits

## Known Limitations and Future Improvements

1. **Backend Support for Price Tiers**
   - Frontend UI fully implemented
   - Backend storage pending implementation

2. **Accessibility**
   - Keyboard navigation needs improvement
   - Screen reader compatibility to be enhanced

3. **Form Validation**
   - More comprehensive real-time validation
   - Better error messaging

4. **Performance**
   - Optimize product/category loading for large catalogs
