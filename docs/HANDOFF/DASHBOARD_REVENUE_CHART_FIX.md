# Dashboard Revenue Chart Fix

## Issue Identified

**Problem**: Revenue Overview chart was not displaying the right information

**Root Cause**: The chart was using browser's `new Date()` to calculate date ranges instead of the store's timezone.

---

## Technical Details

### What Was Wrong

**Before**:
```typescript
// ❌ WRONG - Uses browser timezone
const today = new Date();
const endDate = today.toISOString().split('T')[0];
const startDate = new Date(today);
startDate.setDate(today.getDate() - 6);
const startDateStr = startDate.toISOString().split('T')[0];
```

**Problem**:
1. `new Date()` creates date in **browser's timezone**
2. `.toISOString()` converts to UTC, but from wrong starting point
3. Date range doesn't match store's business days
4. Chart shows wrong data for stores in different timezones

### Example of the Problem

**Scenario**:
- Store: Antigua (UTC-4)
- User: Missouri (UTC-5)
- Current time: 11:30 PM Antigua time

**Browser's calculation** ❌:
- Browser time: 10:30 PM Missouri time
- "Today" = Nov 1 in Missouri timezone
- API gets: Nov 1 (but should be Nov 2 in Antigua!)

**Correct calculation** ✅:
- Store time: 11:30 PM Antigua time
- "Today" = Nov 1 in Antigua timezone
- API gets: Nov 1 (correct!)

---

## Solution Applied

### Fix 1: Import Timezone Utilities

```typescript
import { getNowInTimezone, toApiDateString } from '../utils/timezone';
```

### Fix 2: Use Store Timezone for Date Calculations

**After**:
```typescript
// ✅ CORRECT - Uses store timezone
const today = getNowInTimezone(timezone);
const endDate = toApiDateString(today, timezone);
const startDate = new Date(today);
startDate.setDate(today.getDate() - 6);
const startDateStr = toApiDateString(startDate, timezone);
```

**How It Works**:
1. `getNowInTimezone(timezone)` - Gets current time in store's timezone
2. `toApiDateString(date, timezone)` - Converts to UTC for API call
3. Date range now matches store's business days
4. Chart shows correct data

### Fix 3: Apply to Transactions Data Too

**Also fixed**:
```typescript
// Get today's date in store timezone
const today = getNowInTimezone(timezone);
const startDate = new Date(today);
startDate.setDate(today.getDate() - 7); // Last 7 days

const filters = {
  startDate: toApiDateString(startDate, timezone),
  endDate: toApiDateString(today, timezone),
};
```

---

## Impact

### Revenue Overview Chart

**Before Fix** ❌:
- Shows last 7 days based on browser timezone
- Wrong dates for remote users
- Mismatched with store's business days
- Inconsistent data

**After Fix** ✅:
- Shows last 7 days based on store timezone
- Correct dates for all users
- Matches store's business days
- Consistent data

### Recent Transactions Table

**Before Fix** ❌:
- Fetches last 7 days based on browser timezone
- May miss or include wrong transactions

**After Fix** ✅:
- Fetches last 7 days based on store timezone
- Shows correct transactions for store's business period

---

## Testing

### Test 1: Revenue Chart Data

1. **Go to Dashboard**
2. **Check Revenue Overview chart**
3. **Expected**: Shows last 7 days of sales in store's timezone
4. **Verify**: X-axis dates match store's current date

### Test 2: Timezone Change

1. **Note current chart data**
2. **Go to Settings > Localization**
3. **Change timezone** (e.g., Antigua → Jamaica)
4. **Go back to Dashboard**
5. **Expected**: Chart reloads with new timezone's date range

### Test 3: End-of-Day Boundary

**Scenario**: Store in Antigua (UTC-4), current time 11:30 PM

1. **Create a sale**
2. **Check Dashboard**
3. **Expected**: Sale appears in today's chart data (not tomorrow's)

### Test 4: Remote User

**Scenario**: Store in Antigua, User in Missouri

1. **User logs in from Missouri**
2. **Views Dashboard**
3. **Expected**: Chart shows Antigua's last 7 days (not Missouri's)

---

## Files Modified

### `/frontend/src/pages/Dashboard.tsx`

**Changes**:
1. Added imports: `getNowInTimezone`, `toApiDateString`
2. Updated `loadSalesData()`:
   - Changed `new Date()` → `getNowInTimezone(timezone)`
   - Changed `.toISOString().split('T')[0]` → `toApiDateString(date, timezone)`
3. Updated `loadTransactionsData()`:
   - Same timezone-aware date calculations

**Lines Changed**:
- Line 16: Added timezone utility imports
- Lines 316-320: Fixed sales data date range calculation
- Lines 438-444: Fixed transactions data date range calculation

---

## Related Issues Fixed

This fix also resolves:
- ✅ Recent transactions showing wrong date range
- ✅ Chart X-axis labels not matching store dates
- ✅ Data inconsistency for remote users
- ✅ End-of-day boundary issues

---

## Best Practices Reinforced

### ✅ DO THIS

```typescript
// Use timezone utilities for date calculations
import { getNowInTimezone, toApiDateString } from '../utils/timezone';

const today = getNowInTimezone(timezone);
const apiDate = toApiDateString(today, timezone);
```

### ❌ DON'T DO THIS

```typescript
// Don't use browser's Date for business logic
const today = new Date();
const apiDate = today.toISOString().split('T')[0];
```

---

## Why This Matters

### Business Impact

**Revenue Chart Accuracy**:
- Shows correct sales data for store's business days
- Remote managers see accurate store performance
- End-of-day reports match chart data
- Financial analysis is consistent

**User Experience**:
- All users see same data regardless of location
- Chart updates when timezone changes
- No confusion about date ranges
- Clear, accurate reporting

---

## Summary

**Issue**: Revenue chart used browser timezone for date calculations

**Fix**: Updated to use store timezone with `getNowInTimezone()` and `toApiDateString()`

**Result**: Chart now shows correct data based on store's business days

**Status**: ✅ **FIXED** - Ready for testing

---

**Last Updated**: November 1, 2025  
**Issue**: Revenue Overview chart showing wrong data  
**Root Cause**: Browser timezone instead of store timezone  
**Solution**: Use timezone utilities for all date calculations
