# Point of Sale (POS) Module

## Overview

The Point of Sale (POS) module is a core component of the Zettaz Cloud Enterprise system, providing a comprehensive solution for processing sales transactions. It features an intuitive interface optimized for both desktop and mobile devices, enabling efficient checkout processes for retail environments.

## Business Purpose

The POS module serves several critical business functions:

1. **Sales Transaction Processing**: Enabling fast and accurate checkout for customers
2. **Inventory Management**: Automatically updating stock levels as products are sold
3. **Customer Relationship Management**: Recording customer purchase history and preferences
4. **Payment Processing**: Supporting multiple payment methods and handling transactions
5. **Reporting**: Providing real-time sales data and analytics
6. **Tax Calculation**: Applying appropriate taxes based on products and jurisdictions

## Key Entities

### Sales Header

The sales header contains information about the overall transaction:

| Field | Description |
|-------|-------------|
| `id` | Unique identifier for the sale (UUID) |
| `tenant_id` | The tenant (business) that owns this sale |
| `store_id` | The store location where the sale occurred |
| `customer_id` | Reference to the customer (optional) |
| `sale_number` | A human-readable reference number |
| `sale_date` | Date and time when the sale occurred |
| `status` | Current status of the sale (COMPLETED, VOIDED, etc.) |
| `subtotal` | Sum of all line items before discounts and taxes |
| `discount_amount` | Total discount applied to the sale |
| `tax_amount` | Total tax applied to the sale |
| `total_amount` | Final total amount including discounts and taxes |
| `payment_method` | Method of payment (CASH, CREDIT_CARD, etc.) |
| `payment_status` | Status of the payment (PAID, PENDING, etc.) |
| `notes` | Additional notes about the sale |
| `created_at` | Timestamp when the sale was created |
| `updated_at` | Timestamp when the sale was last updated |
| `created_by_user_id` | User who created the sale |
| `updated_by_user_id` | User who last updated the sale |

### Sale Items

Each sale can have multiple line items, each representing a specific product sold:

| Field | Description |
|-------|-------------|
| `id` | Unique identifier for the sale item (UUID) |
| `tenant_id` | The tenant (business) that owns this sale item |
| `sale_id` | Reference to the parent sale |
| `product_id` | The product being sold |
| `quantity` | Quantity of the product sold |
| `unit_price` | Unit price of the product at the time of sale |
| `discount_amount` | Discount amount applied to this item |
| `tax_amount` | Tax amount applied to this item |
| `subtotal` | Price × quantity before discounts and taxes |
| `total` | Final total for this item after discounts and taxes |
| `created_at` | Timestamp when the sale item was created |
| `updated_at` | Timestamp when the sale item was last updated |

### Applied Tax Details

Records specific tax information for reporting and receipts:

| Field | Description |
|-------|-------------|
| `id` | Unique identifier for the tax detail (UUID) |
| `sale_id` | Reference to the parent sale |
| `tax_name` | Name of the tax (e.g., "State Sales Tax") |
| `tax_rate` | Rate of the tax (e.g., 0.05 for 5%) |
| `tax_amount` | Amount of tax collected |
| `created_at` | Timestamp when the record was created |

## User Interface

The POS module features a responsive design that works seamlessly on both desktop and mobile devices:

### Desktop Layout

- **Two-Column Layout**: Products grid on the left, cart on the right
- **Header**: Logo, screen title, notification icon, sync status, user menu
- **Product Section**: Search bar, category filters, scrollable product grid
- **Cart Section**: Items list, pricing breakdown, checkout button
- **Footer**: Copyright information, application version, terminal ID, last sync time

### Mobile Layout

- **Simplified Header**: Logo and user menu only
- **Full-Width Content**: Product grid takes full width for maximum visibility
- **Search and Cart Bar**: Positioned below the main content for easy access
- **Mobile Cart Modal**: Opens as a full-screen overlay when cart icon is tapped
- **Simplified Footer**: Essential information only

## Dynamic Tax Calculation System

The POS module implements a flexible dynamic tax calculation mechanism primarily within the `CartContext.tsx` on the frontend:

### Core Entities

- **TaxClass**: Represents a classification for taxes (e.g., "General Sales Tax", "Electronics Tax")
- **TaxClassRate**: Defines specific rates for a TaxClass (e.g., a "State GST" rate of 5%)

### Calculation Logic

1. **Default Tax Configuration**: Determined based on `user.defaultTaxClassId` or a tax class marked as `is_default`
2. **Item-Level Tax Calculation**:
   - Checks if the product has a specific `taxClassId`
   - Finds the applicable tax rate for the product's tax class
   - Falls back to the store's default tax configuration if needed
   - Calculates the tax amount based on the appropriate rate
3. **Tax Breakdown**: Records details about applied taxes for reporting and receipts
4. **Discount Interaction**: Respects the `discountApplicationPreference` ('BEFORE_TAX' or 'AFTER_TAX')

## Discount Handling

The POS module supports multiple discount types and application methods:

### Discount Types

- **Percentage Discount**: Applied as a percentage of the item or total price
- **Fixed Amount Discount**: Applied as a fixed currency amount

### Application Preferences

- **Before Tax**: Discounts are applied to the pre-tax subtotal
- **After Tax**: Discounts are applied to the post-tax subtotal

The preference is stored in the store configuration as `discount_application_rule` and retrieved during user login.

## Cart Management

The cart functionality is managed through the `CartContext` provider, which:

1. Maintains the list of items in the cart
2. Calculates subtotals, taxes, and discounts
3. Provides methods for adding, updating, and removing items
4. Handles the checkout process

## Payment Processing

The POS module supports multiple payment methods:

- Cash
- Credit/Debit Card
- Gift Cards
- Mobile Payments

Each payment method has its own processing flow and reconciliation process.

## Offline Support

The POS module includes basic offline functionality:

1. Cached product data for continued operation during internet disruptions
2. Queue for storing transactions when offline
3. Synchronization mechanism for processing queued transactions when connection is restored

## Held Orders

The system supports temporarily holding orders (saving cart state) for later completion:

1. User can hold a current transaction
2. Held orders are saved with a reference number and optional customer association
3. Orders can be retrieved and processed at a later time

## API Endpoints

The POS module exposes the following API endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sales` | GET | Get a list of sales |
| `/api/sales/:id` | GET | Get a specific sale by ID |
| `/api/sales` | POST | Create a new sale |
| `/api/sales/:id` | PUT | Update an existing sale |
| `/api/sales/:id` | DELETE | Delete/void a sale |
| `/api/sales/hold` | POST | Hold a current transaction |
| `/api/sales/held` | GET | Get a list of held transactions |
| `/api/sales/held/:id` | GET | Get a specific held transaction |

## Implementation Details

### Key Components

#### `POSScreen.tsx`

The main POS interface component:

```tsx
// Simplified structure of POSScreen.tsx
const POSScreen = () => {
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  
  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-white border-b">
        {/* Logo, title, and user menu */}
      </header>
      
      {/* Main Content - Desktop Layout */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        {/* Left Column - Products */}
        <div className="w-3/5 p-4 flex flex-col">
          {/* Search and Categories */}
          <div className="mb-4">
            <SearchBar value={searchTerm} onChange={setSearchTerm} />
            <CategoryFilters 
              selectedCategory={selectedCategory} 
              onSelectCategory={setSelectedCategory} 
            />
          </div>
          
          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto">
            <ProductGrid 
              searchTerm={searchTerm}
              selectedCategory={selectedCategory}
            />
          </div>
        </div>
        
        {/* Right Column - Cart */}
        <div className="w-2/5 border-l">
          <Cart />
        </div>
      </div>
      
      {/* Mobile Layout */}
      <div className="md:hidden flex-1 flex flex-col">
        {/* Full-width Product Grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <SearchBar value={searchTerm} onChange={setSearchTerm} />
            <CategoryFilters 
              selectedCategory={selectedCategory} 
              onSelectCategory={setSelectedCategory} 
            />
          </div>
          <ProductGrid 
            searchTerm={searchTerm}
            selectedCategory={selectedCategory}
          />
        </div>
        
        {/* Search and Cart Bar */}
        <div className="border-t p-2 flex justify-between items-center">
          <SearchBar value={searchTerm} onChange={setSearchTerm} />
          <CartButton onClick={() => setMobileCartOpen(true)} />
        </div>
      </div>
      
      {/* Mobile Cart Modal */}
      <MobileCartModal isOpen={mobileCartOpen} onClose={() => setMobileCartOpen(false)} />
      
      {/* Footer */}
      <footer className="hidden md:block bg-white border-t p-2 text-sm text-gray-500">
        {/* Copyright, version, terminal info */}
      </footer>
    </div>
  );
};
```

#### `CartContext.tsx`

The context provider for cart functionality:

```tsx
// Simplified structure of CartContext.tsx
export const CartProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [items, setItems] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [discounts, setDiscounts] = useState([]);
  const [taxClasses, setTaxClasses] = useState([]);
  const [allTaxRates, setAllTaxRates] = useState({});
  
  // Calculate totals
  const subtotal = calculateSubtotal(items);
  const discountAmount = calculateDiscounts(items, discounts, currentUser.discount_application_rule);
  const taxAmount = calculateTax(items, taxClasses, allTaxRates, currentUser.discount_application_rule);
  const total = calculateTotal(subtotal, discountAmount, taxAmount, currentUser.discount_application_rule);
  
  // Cart operations
  const addItem = (product, quantity) => {/* ... */};
  const updateItem = (itemId, updates) => {/* ... */};
  const removeItem = (itemId) => {/* ... */};
  const clearCart = () => {/* ... */};
  
  // Checkout process
  const checkout = async (paymentDetails) => {/* ... */};
  
  // Held orders
  const holdOrder = async (reference) => {/* ... */};
  const retrieveHeldOrder = async (orderId) => {/* ... */};
  
  const value = {
    items,
    customer,
    setCustomer,
    subtotal,
    discountAmount,
    taxAmount,
    total,
    addItem,
    updateItem,
    removeItem,
    clearCart,
    checkout,
    holdOrder,
    retrieveHeldOrder,
    // ...other values and methods
  };
  
  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};
```

## Multi-tenancy Support

All POS operations enforce multi-tenancy by:

1. Including `tenant_id` in all database queries
2. Validating that users can only access sales data belonging to their tenant
3. Ensuring product catalog, pricing, and tax configurations are tenant-specific

## Recent Improvements (May 2025)

1. **Enhanced Mobile UI/UX**:
   - Redesigned mobile layout for better usability
   - Improved search and cart access on small screens
   - Added responsive design for all POS components

2. **Tax Calculation Enhancements**:
   - Implemented product-specific tax classes
   - Added detailed tax breakdown for reporting
   - Improved integration with tax configuration settings

## Future Enhancements

1. **Enhanced Offline Mode**:
   - Improve offline capabilities with robust sync mechanisms
   - Add conflict resolution for offline transactions

2. **Advanced Discounting**:
   - Support for tiered discounts
   - Time-based promotional pricing
   - Bundle discounts

3. **Customer Display Integration**:
   - Support for secondary customer-facing displays
   - Real-time transaction details visible to customers

## Known Issues

1. **Store ID Handling**: Currently, the Point of Sale (POS) system is configured to operate as if for a single, predefined store. When creating a sale, the `store_id` is hardcoded as a fallback in `frontend/src/services/salesService.ts` if it's not present in the `currentUser` object.

2. **Performance with Large Product Catalogs**: The product grid may experience performance issues with very large catalogs (thousands of products). Optimization work is planned.

3. **Tax Calculation Edge Cases**: There may be edge cases in tax calculation for complex scenarios involving multiple tax jurisdictions or compound taxes.
