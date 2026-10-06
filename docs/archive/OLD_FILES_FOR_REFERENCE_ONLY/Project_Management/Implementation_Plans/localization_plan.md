**Localization Implementation Guide for Store Settings**

---

### 📄 Overview

This guide outlines best practices for implementing localization using store-specific settings in your application. It ensures consistent formatting of currency, dates, timezones, and numerical values across both frontend and backend.

---

### ✅ Current Schema Review

Your `store_settings` table already covers these fields:

| Field                        | Purpose                                          |
| ---------------------------- | ------------------------------------------------ |
| `currency_code`              | ISO 4217 code (e.g. USD, INR)                    |
| `language_code`              | ISO 639-1 (e.g. en, fr)                          |
| `country_code`               | ISO 3166-1 alpha-2 (e.g. US, IN)                 |
| `date_format`, `time_format` | Display formats                                  |
| `timezone`                   | Region-based timezone string (e.g. Asia/Kolkata) |

---

### 🧰 Recommended Additions

| Column               | Type                       | Purpose                            |
| -------------------- | -------------------------- | ---------------------------------- |
| `number_format`      | VARCHAR(20)                | e.g. `1,234.56`, `1.234,56`        |
| `decimal_precision`  | INT                        | e.g. 2 for currency, 3 for weights |
| `locale_code`        | VARCHAR(10)                | e.g. `en-US`, `fr-CA`              |
| `measurement_system` | ENUM(`metric`, `imperial`) | For units like grams vs pounds     |

---

### 🧠 Implementation Instructions

#### 1. Central Config Service or Hook

* Load store settings on login or session start.
* Store in React Context/Redux for frontend.
* Use in global middleware for backend (Node/NestJS).

#### 2. Frontend Usage

* Save settings in global state.
* Create/utilize utility functions:

```ts
// @frontend/src/utils/locale/formatters.ts
import { format } from 'date-fns';
import currency from 'currency.js';

export const formatDate = (date, formatStr, locale) =>
  format(new Date(date), formatStr, { locale });

export const formatCurrency = (amount, symbol, precision = 2) =>
  currency(amount, { symbol, precision, separator: ',', decimal: '.' }).format();
```

#### 3. Backend Usage (Node/NestJS)

* Use `Intl` and `moment-timezone` or `luxon`:

```ts
const formatter = new Intl.NumberFormat(localeCode, {
  style: 'currency',
  currency: currencyCode,
  minimumFractionDigits: decimalPrecision,
});
formatter.format(1000); // ₹1,000.00 or $1,000.00
```

#### 4. Testing Instructions

* Mock settings per region (e.g., INR, DD-MM-YYYY).
* Validate display:

  * Order summaries
  * Prices in cart
  * Receipts/invoices
  * Admin dashboards

---

### 🧹 Suggested Folder Structure

| Path                             | Purpose                              |
| -------------------------------- | ------------------------------------ |
| `@frontend/src/utils/locale/`    | `dateFormat.ts`, `currencyFormat.ts` |
| `@backend/src/lib/locale/`       | Centralized format helpers           |
| `@shared/types/StoreSettings.ts` | Shared TypeScript model              |

---

### 🔎 Summary

To complete your localization system:

1. Add `number_format`, `decimal_precision`, `locale_code`, `measurement_system` to DB
2. Centralize settings retrieval and usage
3. Implement utility functions and apply them across all UI components and backend formatting logic

You're now equipped to support global and regional localization preferences seamlessly.

---


Complete Project Timeline
Database Updates (1 day)
    Add missing fields to stores table
    Update seed data
Type Definitions & Utilities (2 days)
    Update interface definitions
    Create new utility functions structure
    Implement comprehensive localization utilities
Context Implementation (1 day)
    Create LocalizationContext
    Update App.tsx
Component Migration (3-5 days)
    Update components to use the new context
    Prioritize critical components like tables, forms, and reports
Testing (2 days)
    Test with different localization settings
    Validate formatting in all key areas
Documentation (1 day)
    Update developer documentation
    Create usage examples


Next Steps
1. Component Migration: Update existing components to use the new localization system:
    Product price displays
    Order totals
    Date displays
    Measurement values
2. Remove Old Utilities: After migrating components, you can safely remove the deprecated currency formatting functions from the old files.
3. Settings UI: Consider creating a store settings page where administrators can configure localization preferences.
4. Testing: Test the application with different locale settings to ensure consistent formatting across all components.
5. This implementation follows the localization plan while ensuring backward compatibility through specialized hooks like useCurrency() that maintain the same API as before. Would you like me to help update any specific components to use this new localization system?