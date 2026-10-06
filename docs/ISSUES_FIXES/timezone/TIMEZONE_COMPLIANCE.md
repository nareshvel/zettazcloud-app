# Timezone Compliance Guidelines

## Overview

This document outlines the strict guidelines for timezone handling across the Zettaz Cloud POS application. **All developers must follow these guidelines** to ensure consistent and accurate date/time handling across different timezones.

## Core Principles

### 1. **Store Timezone is the Source of Truth**
- Every tenant/store has a configured timezone (e.g., `America/New_York`, `Europe/London`)
- All business logic operates in the store's timezone
- All dates displayed to users are in the store's timezone
- All user input dates are interpreted in the store's timezone

### 2. **UTC for Storage and API**
- **Backend**: All dates are stored in UTC in the database
- **API**: All date/time values sent to/from API are in UTC (ISO 8601 format)
- **Frontend**: Convert UTC to store timezone for display, convert store timezone to UTC for API calls

### 3. **Never Use `new Date()` Directly**
- ❌ **WRONG**: `const today = new Date()`
- ✅ **CORRECT**: `const today = getNowInTimezone(timezone)`

## Utility Functions

### Location
All timezone utilities are in `/src/utils/timezone.ts`

### Key Functions

#### `getNowInTimezone(timezone: string): Date`
Get current date/time in store's timezone.
```typescript
import { getNowInTimezone } from '@/utils/timezone';
import { useDateFormatting } from '@/contexts/LocalizationContext';

const { timezone } = useDateFormatting();
const now = getNowInTimezone(timezone);
```

#### `utcToTimezone(date: Date | string, timezone: string): Date`
Convert UTC date from API to store timezone for display.
```typescript
const apiDate = '2025-11-01T14:30:00Z'; // UTC from API
const localDate = utcToTimezone(apiDate, timezone);
```

#### `timezoneToUtc(date: Date, timezone: string): Date`
Convert store timezone date to UTC for API calls.
```typescript
const userInputDate = new Date('2025-11-01'); // From date picker
const utcDate = timezoneToUtc(userInputDate, timezone);
```

#### `toApiDateString(date: Date, timezone: string, includeTime?: boolean): string`
Convert date to API-ready string (YYYY-MM-DD or ISO format).
```typescript
const dateForApi = toApiDateString(userDate, timezone); // "2025-11-01"
const datetimeForApi = toApiDateString(userDate, timezone, true); // "2025-11-01T14:30:00.000Z"
```

#### `formatInStoreTimezone(date: Date | string, format: string, timezone: string): string`
Format any date in store's timezone.
```typescript
const formatted = formatInStoreTimezone(apiDate, 'MMM d, yyyy', timezone);
// Output: "Nov 1, 2025"
```

#### `getLastNDaysRange(days: number, timezone: string): { start: Date; end: Date }`
Get date range for last N days in store timezone.
```typescript
const { start, end } = getLastNDaysRange(7, timezone); // Last 7 days
```

## Implementation Checklist

### ✅ Date Pickers & User Input

#### DateRangePicker Component
- ✅ Uses `getNowInTimezone()` for default dates
- ✅ Presets (Today, Last 7 Days, etc.) use store timezone
- ✅ Imported in: `SalesReport`, `PaymentReport`, `InventoryReport`, `CustomerValueReport`, `ChargeAccountReport`

#### Date Input Fields
```typescript
// ✅ CORRECT: When sending to API
const startDateForApi = toApiDateString(dateRange.from, timezone);
const endDateForApi = toApiDateString(dateRange.to, timezone);

await fetchReport({ startDate: startDateForApi, endDate: endDateForApi });
```

### ✅ Dashboard & Charts

#### Dashboard.tsx
- ✅ Uses `useDateFormatting()` hook
- ✅ Uses `formatDate()` for chart labels
- ✅ Date ranges use store timezone

```typescript
const { formatDate } = useDateFormatting();
const dateStr = formatDate(date, 'MMM d'); // Uses store timezone
```

### ✅ Reports

All report pages must:
1. Use `DateRangePicker` component (already timezone-aware)
2. Convert dates to API format using `toApiDateString()`
3. Display dates using `formatInStoreTimezone()` or `formatDate()` from context

#### Example: SalesReport.tsx
```typescript
const { timezone } = useDateFormatting();

const filters: ReportFilter = {
  startDate: toApiDateString(currentDateRange.from, timezone),
  endDate: toApiDateString(currentDateRange.to, timezone),
};

const chartData = await getSalesChartData(filters);
```

### ✅ POS & Sales Transactions

#### Sale Creation
```typescript
// Sale timestamps are automatically set by backend in UTC
// No frontend timezone conversion needed for sale creation timestamp
```

#### Receipt Display
```typescript
import { formatDateTimeForDisplay } from '@/utils/timezone';

const saleDate = formatDateTimeForDisplay(
  sale.createdAt,  // UTC from API
  dateFormat,
  timeFormat,
  timezone
);
```

### ✅ Context Integration

#### LocalizationContext
Provides timezone and formatting functions:
```typescript
const { timezone, dateFormat, timeFormat, formatDate, formatTime, formatDateTime } = useDateFormatting();
```

These functions automatically use the store's timezone.

## Common Patterns

### Pattern 1: Fetching Data for Date Range
```typescript
import { toApiDateString } from '@/utils/timezone';
import { useDateFormatting } from '@/contexts/LocalizationContext';

const { timezone } = useDateFormatting();

// User selects date range
const dateRange = { from: new Date('2025-11-01'), to: new Date('2025-11-07') };

// Convert to API format
const filters = {
  startDate: toApiDateString(dateRange.from, timezone),
  endDate: toApiDateString(dateRange.to, timezone),
};

// Fetch data
const data = await fetchSalesData(filters);
```

### Pattern 2: Displaying Dates from API
```typescript
import { formatInStoreTimezone } from '@/utils/timezone';
import { useDateFormatting } from '@/contexts/LocalizationContext';

const { timezone, dateFormat } = useDateFormatting();

// API returns UTC date
const apiResponse = { createdAt: '2025-11-01T14:30:00Z' };

// Display in store timezone
const displayDate = formatInStoreTimezone(apiResponse.createdAt, dateFormat, timezone);
```

### Pattern 3: Date Calculations
```typescript
import { getNowInTimezone, getLastNDaysRange } from '@/utils/timezone';
import { useDateFormatting } from '@/contexts/LocalizationContext';

const { timezone } = useDateFormatting();

// Get current time in store timezone
const now = getNowInTimezone(timezone);

// Get last 7 days range
const { start, end } = getLastNDaysRange(7, timezone);
```

## Testing Timezone Compliance

### Test Cases

1. **Different Store Timezones**
   - Set store timezone to `America/New_York` (UTC-5)
   - Set store timezone to `Asia/Tokyo` (UTC+9)
   - Set store timezone to `Europe/London` (UTC+0)
   - Verify all dates display correctly

2. **Date Range Reports**
   - Select "Today" - should show sales from 00:00 to 23:59 in store timezone
   - Select "Last 7 Days" - should show correct 7-day range in store timezone
   - Verify API receives correct UTC dates

3. **Daylight Saving Time (DST)**
   - Test during DST transition dates
   - Verify dates don't shift unexpectedly

4. **Cross-Timezone Sales**
   - Create sale at 11:00 PM in store timezone
   - Verify it appears in correct day in reports
   - Verify receipt shows correct time

## Migration Guide

### Updating Existing Code

#### Before (Non-Compliant)
```typescript
// ❌ WRONG
const today = new Date();
const yesterday = new Date();
yesterday.setDate(today.getDate() - 1);

const dateStr = today.toLocaleDateString('en-US');
const apiDate = today.toISOString().split('T')[0];
```

#### After (Compliant)
```typescript
// ✅ CORRECT
import { getNowInTimezone, toApiDateString, formatInStoreTimezone } from '@/utils/timezone';
import { useDateFormatting } from '@/contexts/LocalizationContext';

const { timezone, dateFormat } = useDateFormatting();

const today = getNowInTimezone(timezone);
const yesterday = new Date(today);
yesterday.setDate(today.getDate() - 1);

const dateStr = formatInStoreTimezone(today, dateFormat, timezone);
const apiDate = toApiDateString(today, timezone);
```

## Files Updated for Timezone Compliance

### ✅ Completed
- `/src/utils/timezone.ts` - Core timezone utilities (NEW)
- `/src/components/reports/DateRangePicker.tsx` - Timezone-aware date picker
- `/src/pages/Dashboard.tsx` - Uses store timezone for charts
- `/src/components/layout/TopBar.tsx` - Breadcrumb fixes

### 🔄 Partially Compliant (Using Context)
- `/src/pages/reports/SalesReport.tsx` - Uses DateRangePicker, needs API conversion
- `/src/pages/reports/PaymentReportPage.tsx` - Uses DateRangePicker, needs API conversion
- `/src/pages/reports/InventoryReportPage.tsx` - Uses DateRangePicker, needs API conversion
- `/src/pages/reports/CustomerValueReportPage.tsx` - Uses DateRangePicker, needs API conversion
- `/src/pages/reports/ChargeAccountReportPage.tsx` - Uses DateRangePicker, needs API conversion

### ⚠️ Needs Review
- `/src/pages/POSScreen.tsx` - Check sale timestamp handling
- `/src/services/receiptService.ts` - Verify date formatting
- `/src/components/promotions/OfferFormModalTabbed.tsx` - Check promotion date handling
- `/src/pages/ProductsPage.tsx` - Check product date fields

## Backend Requirements

### API Expectations
1. **Accept timezone parameter** (optional, for future enhancement)
   ```typescript
   GET /reports/sales/chart?startDate=2025-11-01&endDate=2025-11-07&timezone=America/New_York
   ```

2. **Return dates in ISO 8601 UTC format**
   ```json
   {
     "createdAt": "2025-11-01T14:30:00.000Z",
     "date": "2025-11-01"
   }
   ```

3. **Store all timestamps in UTC**
   - Database columns: `TIMESTAMP` or `DATETIME` in UTC
   - Never store timezone-specific timestamps

## FAQ

### Q: Why not use browser timezone?
**A:** Business operations happen in the store's physical location. A manager in New York should see sales data in EST, even if they're traveling in California.

### Q: What if the user is in a different timezone than the store?
**A:** All dates are still shown in the store's timezone. This is intentional for business consistency.

### Q: How do I test timezone handling locally?
**A:** 
1. Go to Settings > Localization
2. Change store timezone
3. Verify all dates update correctly
4. Check browser console for any `new Date()` warnings

### Q: What about server-side rendering (SSR)?
**A:** Not applicable - this is a client-side React app. All timezone conversion happens in the browser.

### Q: Can I use `moment.js` or `dayjs`?
**A:** No. Use `date-fns` and `date-fns-tz` as they're already in the project and tree-shakeable.

## Enforcement

### ESLint Rules (Future)
Consider adding ESLint rules to prevent:
- Direct use of `new Date()` in business logic
- Use of `toLocaleDateString()` without timezone
- Use of `toISOString()` without timezone conversion

### Code Review Checklist
- [ ] All date inputs use `DateRangePicker` or timezone utilities
- [ ] All API calls use `toApiDateString()` for date parameters
- [ ] All date displays use `formatInStoreTimezone()` or context formatters
- [ ] No direct `new Date()` calls in business logic
- [ ] No hardcoded date formats (use store's dateFormat)

## Summary

**Golden Rule**: If you're working with dates, use the timezone utilities. If you're displaying dates, use the formatting functions from `LocalizationContext`. If you're sending dates to the API, use `toApiDateString()`.

Following these guidelines ensures:
- ✅ Consistent date handling across the application
- ✅ Accurate reports regardless of user's browser timezone
- ✅ Correct business logic for multi-timezone operations
- ✅ Future-proof code that's easy to maintain

---

**Last Updated**: November 1, 2025  
**Version**: 1.0.0  
**Maintained by**: Development Team
