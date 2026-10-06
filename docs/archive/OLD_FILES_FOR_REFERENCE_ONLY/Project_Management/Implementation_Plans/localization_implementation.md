# Localization System Implementation

## Overview

This document describes the implementation of the localization system in the Zettaz Cloud Enterprise application. The localization system allows for consistent formatting of currency, dates, numbers, and measurements across the application.

## Architecture

The localization system is built on several components working together:

1. **StoreContext**: Central store for application-wide settings including localization preferences
2. **LocalizationContext**: Provides localization functions to components based on store settings
3. **Formatting utilities**: Functions for currency, date, number, and measurement formatting
4. **Settings UI**: Admin interface for configuring localization preferences

## Components

### StoreContext

The `StoreContext` manages store settings and provides them to all components. It loads store data from the API and allows for updating settings.

Location: `/frontend/src/contexts/StoreContext.tsx`

Key features:
- Fetches store settings based on the authenticated user
- Provides settings to all components through context
- Allows updating store settings via API

### LocalizationContext

The `LocalizationContext` provides formatting functions to components based on the current store settings.

Location: `/frontend/src/contexts/LocalizationContext.tsx`

Key features:
- Uses settings from StoreContext to determine formatting rules
- Provides specialized hooks for specific formatting needs:
  - `useCurrency()`: For currency formatting
  - `useDateFormatting()`: For date and time formatting
  - `useNumberFormatting()`: For number formatting
  - `useMeasurement()`: For measurement conversions and formatting

### Formatting Utilities

A collection of utility functions for different formatting needs:

- **currencyUtils.ts**: Currency formatting and parsing
- **dateUtils.ts**: Date formatting
- **numberUtils.ts**: Number formatting
- **measurementUtils.ts**: Measurement system conversions

Location: `/frontend/src/utils/locale/`

### Format Bridge

A compatibility layer to ease migration from old formatting to the new system.

Location: `/frontend/src/utils/formatBridge.ts`

## Settings Interface

The localization settings are managed through a dedicated tab in the Settings page, allowing administrators to configure:

1. **Locale**: The application's primary locale (e.g., en-US, fr-FR)
2. **Currency**: Currency code and symbol for monetary values
3. **Number Format**: Decimal and thousand separator preferences
4. **Decimal Precision**: Number of decimal places for monetary values
5. **Measurement System**: Choice between metric and imperial units

Location: `/frontend/src/pages/Settings.tsx`

## How to Use

### Basic Usage

```tsx
// For currency formatting
import { useFormattingBridge } from '../utils/formatBridge';

const MyComponent = () => {
  const { formatCurrency } = useFormattingBridge();
  
  return <div>{formatCurrency(19.99)}</div>;  // Outputs "$19.99" or "€19,99" based on settings
};
```

### Direct Context Usage

```tsx
// For more specific formatting needs
import { useCurrency } from '../contexts/LocalizationContext';

const MyComponent = () => {
  const { formatCurrency, currencySymbol } = useCurrency();
  
  return (
    <div>
      <span>{currencySymbol}</span>
      <span>{formatCurrency(19.99, { minimumFractionDigits: 0 })}</span>
    </div>
  );
};
```

### Specialized Hooks

The system provides specialized hooks for different formatting needs:

```tsx
// Date formatting
import { useDateFormatting } from '../contexts/LocalizationContext';

const { formatDate, formatDateTime } = useDateFormatting();

// Number formatting
import { useNumberFormatting } from '../contexts/LocalizationContext';

const { formatNumber, formatPercent } = useNumberFormatting();

// Measurement conversion
import { useMeasurement } from '../contexts/LocalizationContext';

const { convertWeight, formatWeight } = useMeasurement();
```

## Configuration

Localization settings can be configured through the Settings page in the admin interface. These settings are stored in the backend and affect all users accessing the application.

## Migration Notes

1. All direct usage of old formatting utilities should be replaced with the new localization system.
2. The `formatBridge.ts` file provides a compatibility layer to ease migration.
3. Once migration is complete, the old formatting utilities can be removed.
