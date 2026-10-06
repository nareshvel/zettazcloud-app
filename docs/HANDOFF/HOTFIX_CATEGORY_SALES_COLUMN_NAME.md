# HOTFIX: Category Sales Column Name Error

## 🚨 **Critical Issue**

**Error**: `Unknown column 's.tax_amount' in 'field list'`

**Impact**: Category sales chart completely broken - no data displayed

**Root Cause**: Used wrong column name in SQL query

---

## 🔍 **Problem**

### **Database Schema**

The `sales` table has:
```sql
CREATE TABLE `sales` (
  `subtotal` decimal(10,2) NOT NULL,
  `tax` decimal(10,2) NOT NULL,        -- ✅ Column is called 'tax'
  `discount` decimal(10,2) DEFAULT '0.00',
  `total` decimal(10,2) NOT NULL,
  ...
)
```

### **My Mistake**

I used `s.tax_amount` in the SQL query, but the column is actually called `s.tax`!

```sql
-- ❌ WRONG - Column doesn't exist
COALESCE(s.tax_amount, 0)

-- ✅ CORRECT - Column name is 'tax'
COALESCE(s.tax, 0)
```

---

## ✅ **Fix Applied**

### **Files Fixed**

1. `/backend/services/api.js` - Line 17
2. `/backend/controllers/reportsController.js` - Line 629

### **Change**

```sql
-- Before (WRONG)
(si.quantity * si.price) / s.subtotal * COALESCE(s.tax_amount, 0)

-- After (CORRECT)
(si.quantity * si.price) / s.subtotal * COALESCE(s.tax, 0)
```

---

## 🚀 **Deployment Instructions**

### **Step 1: Commit & Push**

```bash
cd /Users/nareshvelusamy/Herd/app-zettaz-cloud
git add backend/services/api.js backend/controllers/reportsController.js
git commit -m "hotfix: fix category sales tax column name (tax not tax_amount)"
git push origin main
```

### **Step 2: Deploy to Server**

```bash
# SSH to server
ssh root@app

# Pull latest code
cd /var/www/app-zettaz-cloud/repo
git pull origin main

# Reload backend
pm2 reload api

# Check logs
pm2 logs api --lines 20 --nostream
```

### **Step 3: Verify**

1. **Check logs** - Should see no more `Unknown column` errors
2. **Refresh Dashboard** - Category sales should now display
3. **Verify tax inclusion** - Should show full amount with tax

---

## 📊 **Expected Results**

### **Before Fix** ❌

```
Error: Unknown column 's.tax_amount' in 'field list'
Category Sales: No data displayed
```

### **After Fix** ✅

```
Category Sales: Shows $34.04 (includes tax)
No errors in logs
```

---

## 🧪 **Testing**

### **Test Case**

**Sale**:
- Subtotal: $18.00
- Tax: $3.06
- Total: $21.06

**Expected Category Sales**:
- Produce: **$21.06** ✅ (includes tax)

**Formula**:
```
Item Total = Item Subtotal + (Item Subtotal / Sale Subtotal × Sale Tax)
           = $18.00 + ($18.00 / $18.00 × $3.06)
           = $18.00 + $3.06
           = $21.06 ✅
```

---

## 📝 **Lessons Learned**

1. **Always check database schema** before writing SQL
2. **Test on production-like data** before deploying
3. **Column names vary** - don't assume naming conventions

### **Database Column Names**

For reference:
- ✅ `sales.tax` - Tax amount
- ✅ `sales.subtotal` - Subtotal amount
- ✅ `sales.total` - Total amount
- ✅ `sales.discount` - Discount amount

**NOT**:
- ❌ `sales.tax_amount`
- ❌ `sales.subtotal_amount`
- ❌ `sales.total_amount`

---

## 🎯 **Status**

- ✅ **Fix Applied**: Both files corrected
- ⏳ **Deployment**: Ready to commit & push
- ⏳ **Verification**: Pending server deployment

---

**Priority**: CRITICAL - Deploy immediately!

**ETA**: 2 minutes (commit, push, deploy, verify)
