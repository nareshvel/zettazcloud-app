# Cached Data Fetching System

## Overview

This document outlines the implementation of a centralized data fetching system for the Zettaz Cloud application. The system aims to solve several performance and reliability issues identified in the application, particularly:

1. Duplicate API calls for the same data
2. Lack of consistent error handling
3. No data caching strategy
4. Inconsistent loading state management
5. Unnecessary backend load

## Architecture

The system follows a custom hook-based architecture with a centralized cache management layer:

```
┌───────────────────┐     ┌────────────────────┐     ┌───────────────────┐
│                   │     │                    │     │                   │
│  React Components ├────►│  Data Hook Layer   ├────►│   API Services    │
│                   │     │                    │     │                   │
└───────────────────┘     └────────────────────┘     └───────────────────┘
                                    │
                                    ▼
                          ┌────────────────────┐
                          │                    │
                          │   Cache Manager    │
                          │                    │
                          └────────────────────┘
```

### Components:

1. **Base Cache Fetcher Hook** (`useCachedDataFetcher`): Generic hook that handles common functionality like:
   - Data loading states
   - Error management
   - Cache TTL (Time To Live)
   - Manual refresh capabilities
   - Cancellation of in-flight requests

2. **Specialized Data Hooks**: Domain-specific hooks that use the base fetcher:
   - `useProductsData`: For product listings
   - `useTaxClassesData`: For tax classifications
   - `usePromotionalOffersData`: For promotional offers

3. **Cache Layer**: LocalStorage-based caching with:
   - Configurable TTL per data type
   - Cache invalidation strategies
   - Key-based cache entries

## Benefits

- **Reduced API Calls**: Data is fetched once and shared across components
- **Consistent UX**: Loading and error states are handled uniformly
- **Better Performance**: Avoids redundant network requests
- **Better Developer Experience**: Simple, declarative API for data fetching
- **Offline Support**: Critical data can be available offline via cache
- **Selective Refresh**: Components can request fresh data when needed

## Implementation Details

### Base Hook: `useCachedDataFetcher`

Generic hook that provides core functionality for all data fetchers.

**Features**:
- Cache data in localStorage with TTL
- Prevent duplicate in-flight requests
- Cancel requests when components unmount
- Provide loading/error states
- Allow manual refresh

### Domain-Specific Hooks

#### `useProductsData`

**Purpose**: Fetch and manage product data
**TTL**: 2 minutes
**Parameters**:
- `categoryId`: Optional filter by category

#### `useTaxClassesData`

**Purpose**: Fetch and manage tax class data
**TTL**: 15 minutes

#### `usePromotionalOffersData`

**Purpose**: Fetch and manage promotional offer data
**TTL**: 5 minutes
**Dependencies**:
- Authentication state

## Usage Examples

### Fetching Products

```tsx
function ProductList({ categoryId }) {
  const { 
    data: products, 
    isLoading, 
    error, 
    refresh 
  } = useProductsData(categoryId);

  // Component using the data...
}
```

### Manually Refreshing Data

```tsx
function ProductManager() {
  const { data: products, refresh } = useProductsData();

  const handleProductCreate = async () => {
    await createProduct(newProduct);
    // Refresh product list after creating a new one
    refresh();
  };
}
```

## Performance Considerations

- **TTL Strategy**: Different TTLs for different data types based on volatility
- **Selective Updates**: Refresh only specific data after mutations
- **Memory Usage**: Cache size monitoring
- **Network Strategy**: Conditional fetching based on connection quality

## Future Enhancements

- Server-side rendering support
- Integration with React Query or SWR
- Real-time updates via WebSockets
- More sophisticated cache invalidation strategies
