# Promotional Offers & Discounts

This document provides a comprehensive overview of the promotional offers and discount system implemented in the Zettaz Cloud application. The system enables businesses to create and manage various types of promotional offers that can be applied to products or categories to encourage customer purchases.

## Table of Contents

1. [Concept Overview](#concept-overview)
2. [Offer Types](#offer-types)
3. [Database Structure](#database-structure)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [Current Status](#current-status)
7. [Pending Tasks](#pending-tasks)

## Concept Overview

The promotional offers system enables businesses to create tailored discounts and special pricing that can be applied to products, categories, or across the entire store. The system supports various offer types including percentage-based discounts, fixed amount discounts, buy-X-get-Y free offers, bundle pricing, and tiered quantity pricing.

Key components of the promotional offers system include:

- **Offers**: Define the type of promotion, its value, and validity period
- **Rules**: Define what products or categories the offer applies to
- **Usage Tracking**: Keeps track of how many times an offer has been used
- **Pricing Tiers**: Enables volume-based pricing where unit price decreases with quantity

Offers can be created, activated, deactivated, modified, and deleted through the administrative interface. The system applies eligible offers automatically at checkout based on configured rules.

## Offer Types

The system supports the following types of promotional offers:

1. **Percentage Discount (percentage_discount)**
   - Applies a percentage-based discount to eligible products
   - Example: 20% off all bakery items

2. **Fixed Discount (fixed_discount)**
   - Applies a fixed dollar amount discount to eligible products
   - Example: $5 off any shirt

3. **Buy X Get Y Free (buy_x_get_y)**
   - Customers buy a specified quantity of items and receive additional items free
   - Example: Buy 2 coffees, get 1 free

4. **Bundle Price (bundle_price)**
   - Set a special price when customers purchase multiple items together
   - Example: Lunch special - sandwich, chips & drink for $10.99

5. **Tiered Pricing (tiered_pricing)**
   - Price per unit decreases as quantity purchased increases
   - Example: T-shirts: $20 each, $18 each when buying 5+, $15 each when buying 10+

## Database Structure

The promotional offers system is built on three main database tables:

### promotional_offers

This table stores the primary offer details.

```sql
CREATE TABLE promotional_offers (
    id CHAR(36) PRIMARY KEY,
    tenant_id CHAR(36) NOT NULL,
    store_id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    offer_type ENUM('buy_x_get_y', 'percentage_discount', 'fixed_discount', 'bundle_price', 'tiered_pricing') NOT NULL,
    discount_value DECIMAL(10, 2) NOT NULL,
    start_date DATETIME NOT NULL,
    end_date DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    priority INT DEFAULT 0,
    max_uses_per_customer INT,
    max_total_uses INT,
    minimum_quantity INT DEFAULT 1,
    minimum_purchase_amount DECIMAL(10, 2),
    created_by_user_id CHAR(36) NOT NULL,
    updated_by_user_id CHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_promotional_offers_tenant (tenant_id),
    INDEX idx_promotional_offers_store (store_id)
)
```

### offer_rules

This table defines which products or categories an offer applies to.

```sql
CREATE TABLE offer_rules (
    id CHAR(36) PRIMARY KEY,
    tenant_id CHAR(36) NOT NULL,
    store_id CHAR(36) NOT NULL,
    offer_id CHAR(36) NOT NULL,
    rule_type ENUM('product', 'category', 'all_products') NOT NULL,
    entity_id CHAR(36),
    quantity INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (offer_id) REFERENCES promotional_offers(id) ON DELETE CASCADE,
    INDEX idx_offer_rule (offer_id, rule_type),
    INDEX idx_offer_rule_store (store_id)
)
```

### offer_usage

This table tracks when and by whom offers are used.

```sql
CREATE TABLE offer_usage (
    id CHAR(36) PRIMARY KEY,
    tenant_id CHAR(36) NOT NULL,
    store_id CHAR(36) NOT NULL,
    offer_id CHAR(36) NOT NULL,
    customer_id CHAR(36) NOT NULL,
    order_id CHAR(36) NOT NULL,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (offer_id) REFERENCES promotional_offers(id),
    INDEX idx_offer_customer (offer_id, customer_id),
    INDEX idx_offer_usage_store (store_id)
)
```

### Price Tiers Table (Pending Implementation)

While the system has frontend support for tiered pricing, there is not yet a database table for storing price tiers. This is a pending implementation item. The proposed structure is:

```sql
CREATE TABLE price_tiers (
    id CHAR(36) PRIMARY KEY,
    tenant_id CHAR(36) NOT NULL,
    store_id CHAR(36) NOT NULL,
    offer_id CHAR(36) NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (offer_id) REFERENCES promotional_offers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_offer_quantity (offer_id, quantity)
)
```

## Backend Implementation

The promotional offers system is implemented through several RESTful API endpoints managed by the promotionalOfferController in the backend. The key functions implemented are:

1. **getActiveOffers**: Retrieves all active promotional offers for a store
2. **getOfferById**: Retrieves a specific promotional offer by ID
3. **createOffer**: Creates a new promotional offer with associated rules
4. **updateOffer**: Updates an existing promotional offer and its rules
5. **deleteOffer**: Deletes a promotional offer
6. **getOfferUsage**: Retrieves usage statistics for an offer

Each API endpoint includes:
- Authentication & authorization checks
- Tenant and store ID validation
- Input validation
- Transaction management (for operations that modify multiple tables)
- Error handling and logging

## Frontend Implementation

### TypeScript Interfaces

The promotional offers system uses the following key TypeScript interfaces:

```typescript
export type OfferType = 'buy_x_get_y' | 'percentage_discount' | 'fixed_discount' | 'bundle_price' | 'tiered_pricing';
export type RuleType = 'product' | 'category' | 'all_products';

export interface PromotionalOffer {
  id: string;
  tenantId: string;
  storeId: string;
  name: string;
  description?: string;
  code?: string; 
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
  createdAt?: string;
  updatedAt?: string;
  createdByUserId?: string;
  updatedByUserId?: string;
  rules?: OfferRule[];
}

// Extended to include price tiers support
interface ExtendedPromotionalOffer extends PromotionalOffer {
  priceTiers?: PriceTier[];
}

interface PriceTier {
  id: string;
  quantity: number;
  price: number;
}
```

### Components

The frontend implementation includes the following key components:

1. **OfferListView**: Displays a list of all offers with filtering and sorting options
2. **OfferFormModalTabbed**: A multi-tab modal for creating and editing offers
   - Basic Info Tab: Name, type, description
   - Discount Tab: Discount values, price tiers for tiered pricing
   - Rules Tab: Configuring which products/categories the offer applies to
   - Schedule Tab: Set validity period and usage limits
   - Review Tab: Final review and submission

### Key Features Implemented

1. **Tiered Pricing UI**: 
   - Added full CRUD support for price tiers
   - Base tier always shown with minimum quantity and base discount price
   - Dynamic addition/removal of tiers with validation
   - Real-time pricing preview
   
2. **Multiple Bundling Support**: 
   - Allow configuring multiple products or categories in bundle offers
   - Support variable quantities for each item

3. **Date Picker and Scheduling**: 
   - Fixed off-by-one-day bug in date handling
   - Improved timezone handling
   - Added schedule guidance

4. **Improved Product/Category Loading**:
   - Fixed caching issues to always fetch fresh data
   - Added loading indicators
   - Improved error handling

## Current Status

The promotional offers system is functional with the following capabilities:

- **Backend API**: Core CRUD operations for offers and rules are implemented and tested
- **Frontend UI**: Full UI for offer management is implemented with all tabs
- **Tiered Pricing**: UI components for tiered pricing are fully implemented
- **Database**: Main tables for offers, rules, and usage are implemented

## Pending Tasks

The following tasks remain to fully implement the promotional offers system:

1. **Price Tiers Backend Implementation**:
   - Create database migration for price_tiers table
   - Extend backend controller to handle price tiers
   - Update API endpoints for create/update to handle price tier data

2. **Backend Validation**:
   - Add comprehensive validation for tiered pricing
   - Ensure validation for complex rules and combinations

3. **Discount Application Engine**:
   - Implement logic to calculate applicable discounts for cart items
   - Handle complex scenarios like offer stacking and priority rules
   - Account for all offer types including tiered pricing

4. **Usage Tracking**:
   - Implement tracking of offer usage
   - Create reports for offer effectiveness

5. **Frontend Improvements**:
   - Add keyboard navigation support for accessibility
   - Implement tooltips for better UX
   - Add validation feedback
   - Enhance loading states

6. **Testing**:
   - Add comprehensive unit and integration tests for discount application
   - Test across different timezones
   - Test edge cases in pricing tiers

7. **Documentation**:
   - Create developer guides for extending the system
   - Create user documentation for merchants
