# Localization and Internationalization (i18n) Guide

This document explains how to use the localization and internationalization (i18n) system in the Zettaz Cloud Enterprise application.

## Overview

The application uses two complementary systems:

1. **Localization System** - Handles formatting of numbers, currencies, dates, and measurements based on store settings.
2. **Internationalization (i18n) System** - Manages UI text translations across different languages.

## Localization System

The localization system is based on the store settings and is managed through the `LocalizationContext`. This context provides formatting functions for various data types.

### Key Components

- **StoreContext** - Manages store settings, including locale preferences.
- **LocalizationContext** - Provides formatting functions based on store settings.
- **formatBridge** - Provides backward compatibility for the older formatting utilities.

### How to Use

```tsx
import { useLocalization } from '../contexts/LocalizationContext';

const MyComponent = () => {
  const { 
    formatCurrency, 
    formatNumber, 
    formatDate,
    formatPercentage,
    formatMeasurement
  } = useLocalization();
  
  return (
    <div>
      <p>Price: {formatCurrency(19.99)}</p>
      <p>Quantity: {formatNumber(1234.56)}</p>
      <p>Date: {formatDate(new Date())}</p>
      <p>Discount: {formatPercentage(0.15)}</p>
      <p>Weight: {formatMeasurement(500, 'weight')}</p>
    </div>
  );
};
```

## Internationalization (i18n) System

The i18n system is based on [i18next](https://www.i18next.com/) and [react-i18next](https://react.i18next.com/). It provides translation functionality for UI text.

### Key Components

- **i18n Configuration** - Located in `src/i18n/index.ts`.
- **Translation Files** - Located in `public/locales/{language}/{namespace}.json`.
- **useI18n Hook** - Custom hook that integrates i18next with our store-based localization system.
- **LanguageSwitcher Component** - UI component for changing the application language.

### How to Use

```tsx
import { useI18n } from '../hooks/useI18n';

const MyComponent = () => {
  const { t } = useI18n();
  
  return (
    <div>
      <h1>{t('app.name')}</h1>
      <p>{t('messages.welcome', { name: 'User' })}</p>
      <button>{t('actions.save')}</button>
    </div>
  );
};
```

### Translation Structure

The application uses namespaced translation files:

- **common.json** - General application strings (navigation, actions, messages)
- **settings.json** - Settings-related strings
- Add more namespaces as needed for different sections of the application

### Adding a New Language

1. Create a new directory under `public/locales` with the language code (e.g., `de` for German)
2. Copy the structure from an existing language folder
3. Translate all string values in the JSON files
4. Update the `languageNames` object in the `LanguageSwitcher` component

### Using Variables in Translations

```tsx
// In your translation file:
{
  "greeting": "Hello, {{name}}!"
}

// In your component:
const { t } = useI18n();
return <p>{t('greeting', { name: 'John' })}</p>;
// Renders: "Hello, John!"
```

## Best Practices

1. **Use Translation Keys** - Always use translation keys instead of hardcoded strings for UI text.
2. **Namespace Your Keys** - Organize translations into logical namespaces.
3. **Use Variables** - Use variables for dynamic content instead of string concatenation.
4. **Formatting** - Use the localization context for formatting numbers, currencies, and dates.
5. **Testing** - Test your UI with different languages and locales to ensure proper display.

## Migration from Old System

If you're migrating from the old formatting utilities:

1. Replace imports from the old utility files with the appropriate context hooks
2. Replace direct function calls with the corresponding context functions
3. Use the `formatBridge` if you need a transition period

```tsx
// Old way:
import { formatCurrency } from '../utils/currencyUtils';
const price = formatCurrency(19.99, 'USD');

// New way:
import { useLocalization } from '../contexts/LocalizationContext';
const { formatCurrency } = useLocalization();
const price = formatCurrency(19.99); // Currency code comes from store settings
```

## Troubleshooting

- **Missing Translations**: Check if the translation key exists in all language files
- **Formatting Issues**: Ensure the store settings have the correct locale and currency code
- **Type Errors**: Make sure to use the typed versions of the formatting functions
