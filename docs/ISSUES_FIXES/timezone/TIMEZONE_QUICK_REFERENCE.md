# Timezone Quick Reference Card

## 🚀 Quick Start

```typescript
import { useDateFormatting } from '@/contexts/LocalizationContext';
import { getNowInTimezone, toApiDateString, formatInStoreTimezone } from '@/utils/timezone';

const { timezone, dateFormat, timeFormat } = useDateFormatting();
```

## 📋 Common Tasks

### Get Current Time in Store Timezone
```typescript
const now = getNowInTimezone(timezone);
```

### Format Date for Display
```typescript
// Using context (recommended)
const { formatDate } = useDateFormatting();
const displayDate = formatDate(apiDate);

// Or using utility directly
const displayDate = formatInStoreTimezone(apiDate, 'MMM d, yyyy', timezone);
```

### Send Date to API
```typescript
const apiDate = toApiDateString(userSelectedDate, timezone);
// Returns: "2025-11-01"

const apiDateTime = toApiDateString(userSelectedDate, timezone, true);
// Returns: "2025-11-01T14:30:00.000Z"
```

### Get Date Ranges
```typescript
import { getLastNDaysRange, getTodayRange } from '@/utils/timezone';

const { start, end } = getLastNDaysRange(7, timezone);
const { start, end } = getTodayRange(timezone);
```

## ❌ Don't Do This

```typescript
// ❌ WRONG - Uses browser timezone
const today = new Date();
const dateStr = today.toLocaleDateString('en-US');
const apiDate = today.toISOString().split('T')[0];
```

## ✅ Do This Instead

```typescript
// ✅ CORRECT - Uses store timezone
const today = getNowInTimezone(timezone);
const dateStr = formatInStoreTimezone(today, dateFormat, timezone);
const apiDate = toApiDateString(today, timezone);
```

## 🔧 Utility Functions Reference

| Function | Purpose | Example |
|----------|---------|---------|
| `getNowInTimezone(tz)` | Get current time in store TZ | `getNowInTimezone('America/New_York')` |
| `utcToTimezone(date, tz)` | Convert UTC to store TZ | `utcToTimezone(apiDate, timezone)` |
| `timezoneToUtc(date, tz)` | Convert store TZ to UTC | `timezoneToUtc(userDate, timezone)` |
| `toApiDateString(date, tz)` | Format for API (YYYY-MM-DD) | `toApiDateString(date, timezone)` |
| `formatInStoreTimezone(date, fmt, tz)` | Format in store TZ | `formatInStoreTimezone(date, 'MMM d', tz)` |
| `getLastNDaysRange(n, tz)` | Get N-day range | `getLastNDaysRange(7, timezone)` |
| `getTodayRange(tz)` | Get today's start/end | `getTodayRange(timezone)` |

## 📅 Date Format Patterns

| Pattern | Example Output |
|---------|----------------|
| `'MMM d, yyyy'` | Nov 1, 2025 |
| `'MM/dd/yyyy'` | 11/01/2025 |
| `'yyyy-MM-dd'` | 2025-11-01 |
| `'dd/MM/yyyy'` | 01/11/2025 |
| `'hh:mm a'` | 02:30 PM |
| `'HH:mm'` | 14:30 |

## 🎯 Component Patterns

### DateRangePicker (Already Timezone-Aware)
```typescript
import { DateRangePicker } from '@/components/reports/DateRangePicker';

<DateRangePicker
  initialDateRange={dateRange}
  onDateChange={setDateRange}
/>
```

### Fetching Report Data
```typescript
const { timezone } = useDateFormatting();

const filters = {
  startDate: toApiDateString(dateRange.from, timezone),
  endDate: toApiDateString(dateRange.to, timezone),
};

const data = await fetchReport(filters);
```

### Displaying API Dates
```typescript
const { formatDate, formatDateTime } = useDateFormatting();

// Just date
<span>{formatDate(sale.createdAt)}</span>

// Date and time
<span>{formatDateTime(sale.createdAt)}</span>
```

## 🧪 Testing Checklist

- [ ] Change store timezone in Settings
- [ ] Verify dates update correctly
- [ ] Check "Today" shows correct day
- [ ] Check "Last 7 Days" shows correct range
- [ ] Verify API receives UTC dates
- [ ] Check receipts show correct time

## 🆘 Troubleshooting

### Problem: Dates are off by one day
**Solution**: You're probably using `new Date()` instead of `getNowInTimezone(timezone)`

### Problem: Times are wrong
**Solution**: Make sure you're converting UTC from API to store timezone using `utcToTimezone()`

### Problem: Reports show wrong date range
**Solution**: Use `toApiDateString()` when sending dates to API

## 📚 Full Documentation
See `/docs/TIMEZONE_COMPLIANCE.md` for complete guidelines.
