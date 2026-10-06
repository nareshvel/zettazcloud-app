# Troubleshooting Guide

This comprehensive guide provides solutions for common issues encountered in the Zettaz Cloud Enterprise application, covering both user-facing problems and technical issues for developers.

## Table of Contents

1. [User-Facing Issues](#user-facing-issues)
   - [Authentication Problems](#authentication-problems)
   - [Purchase Order Issues](#purchase-order-issues)
   - [Goods Received Note (GRN) Issues](#goods-received-note-grn-issues)
   - [Point of Sale (POS) Issues](#point-of-sale-pos-issues)
   - [Inventory Discrepancies](#inventory-discrepancies)
   - [Report Generation Problems](#report-generation-problems)

2. [Developer Technical Issues](#developer-technical-issues)
   - [Database Query Errors](#database-query-errors)
   - [API Response Issues](#api-response-issues)
   - [Frontend Problems](#frontend-problems)
   - [Deployment Issues](#deployment-issues)
   - [Performance Problems](#performance-problems)

3. [Diagnostic Tools](#diagnostic-tools)
   - [Log Files](#log-files)
   - [System Status Page](#system-status-page)
   - [Database Inspection](#database-inspection)

## User-Facing Issues

### Authentication Problems

#### Issue: Unable to Log In

**Symptoms:**
- Login page continuously reloads after entering credentials
- "Invalid username or password" error despite correct credentials
- Login button becomes unresponsive

**Troubleshooting Steps:**
1. Verify that the username (email) is entered correctly with proper capitalization
2. Reset password using the "Forgot Password" link
3. Clear browser cache and cookies
4. Try a different browser
5. Check if account has been locked due to multiple failed attempts

**Solution:**
- If the issue persists, contact your system administrator to verify account status
- Admin can check user account status in the User Management panel

#### Issue: Session Timeouts

**Symptoms:**
- Frequent redirects to login page
- "Your session has expired" message
- Losing work when submitting forms

**Troubleshooting Steps:**
1. Check if there has been a period of inactivity
2. Verify that cookies are enabled in the browser
3. Check if multiple tabs/windows are open with the same account

**Solution:**
- Increase session timeout duration in system settings (administrator only)
- Implement "Keep me logged in" option for users who need longer sessions

### Purchase Order Issues

#### Issue: Cannot Create Purchase Order

**Symptoms:**
- Error message when trying to save a new purchase order
- Form submission fails without clear error message
- Purchase order appears as "Processing" but never completes

**Troubleshooting Steps:**
1. Check if all required fields are filled out correctly
2. Verify that selected products have valid pricing information
3. Check if the supplier is active in the system
4. Verify user permissions for creating purchase orders

**Solution:**
- Administrator should verify user role has appropriate permissions
- Check server logs for specific validation errors
- Ensure the database connection is functioning correctly

#### Issue: Purchase Order Status Not Updating

**Symptoms:**
- Purchase order remains in "ORDERED" status despite receiving goods
- Status doesn't change after GRN creation
- Manual status update fails

**Troubleshooting Steps:**
1. Verify that GRNs have been properly created and completed for this purchase order
2. Check if all items have been received or only a partial delivery
3. Look for error messages during GRN processing

**Solution:**
- Check that the purchase order has the correct items and quantities
- Verify that the GRN status is set to "COMPLETED" and not "DRAFT"
- Administrator can manually update the purchase order status if necessary

### Goods Received Note (GRN) Issues

#### Issue: Cannot Create GRN

**Symptoms:**
- Error message when trying to save a new GRN
- "Reference purchase order not found" error
- Form submission fails with validation errors

**Troubleshooting Steps:**
1. Verify that the referenced purchase order exists and is in "ORDERED" status
2. Check if all required fields are filled out correctly
3. Verify that quantities being received are valid
4. Check if user has permission to create GRNs

**Solution:**
- Ensure the purchase order is in a valid status for receiving goods
- Verify that product information matches the purchase order
- Check server logs for specific validation errors

#### Issue: GRN Status Not Respecting User Selection

**Symptoms:**
- GRN always saves as "COMPLETED" regardless of selected status
- Status dropdown appears to work but doesn't affect saved status
- Inventory is always updated even when trying to save as "DRAFT"

**Troubleshooting Steps:**
1. Check if the frontend is correctly sending the selected status
2. Verify that the backend is not overriding the status value
3. Check server logs for clues about status handling

**Solution:**
- Ensure the GRN controller is respecting the status from the request
- Use default values only when no status is provided: `req.body.status || 'COMPLETED'`
- Verify that status change triggers appropriate inventory updates

#### Issue: Inventory Not Updated After GRN Completion

**Symptoms:**
- GRN status changes to "COMPLETED" but product quantities don't increase
- Inventory report doesn't reflect received goods
- "Product not found" errors in server logs

**Troubleshooting Steps:**
1. Check if the products in the GRN still exist in the database
2. Verify that product IDs match between GRN items and product database
3. Check server logs for errors during inventory update

**Solution:**
- Ensure robust error handling is in place for missing products
- Verify that the correct column name (`current_stock_quantity`) is used for inventory updates
- Check that the transaction is completing successfully

### Point of Sale (POS) Issues

#### Issue: Products Not Appearing in POS

**Symptoms:**
- Search returns no results for products that exist
- Products visible in inventory but not in POS
- "No products found" message

**Troubleshooting Steps:**
1. Check if products are marked as "Active" and "Sellable"
2. Verify that products have valid pricing information
3. Check if products are assigned to the current location
4. Verify that inventory levels are greater than zero (if set to hide out-of-stock items)

**Solution:**
- Update product settings to ensure they're active and sellable
- Verify inventory levels are correctly set
- Check if product visibility settings are correctly configured

#### Issue: Payment Processing Fails

**Symptoms:**
- "Payment processing error" message
- Transaction appears to complete but receipt doesn't print
- Payment device shows error or doesn't respond

**Troubleshooting Steps:**
1. Check internet connectivity
2. Verify that payment terminal is connected and powered on
3. Check if payment gateway credentials are valid
4. Look for specific error codes from payment processor

**Solution:**
- Retry the payment after confirming connectivity
- Process payment using an alternative method if available
- Contact payment gateway support with specific error codes

### Inventory Discrepancies

#### Issue: Physical Count Doesn't Match System

**Symptoms:**
- Actual inventory quantities differ from system records
- Regular variances in specific products
- Inventory adjustments required frequently

**Troubleshooting Steps:**
1. Check recent GRNs, sales, and adjustments for the affected products
2. Verify that all inventory movements have been properly recorded
3. Check if automatic inventory updates are functioning correctly
4. Look for patterns (specific products, times, or users)

**Solution:**
- Conduct a full inventory count and reconciliation
- Review inventory transaction history for errors
- Implement more frequent cycle counts for problematic items
- Check for potential issues in GRN processing or sales recording

#### Issue: Inventory Quantity Not Updating After Status Change

**Symptoms:**
- Changing GRN status doesn't affect inventory levels as expected
- Reversing a GRN doesn't correctly reverse inventory
- Inconsistent inventory counts after GRN processing

**Troubleshooting Steps:**
1. Check if inventory update logic is correctly implemented for status changes
2. Verify that the correct column names are used in inventory updates
3. Look for error logs during inventory processing

**Solution:**
- Ensure consistent use of `current_stock_quantity` in all inventory operations
- Implement robust error handling for missing products
- Verify transaction handling is properly implemented

## Developer Technical Issues

### Database Query Errors

#### Issue: "poItems is not iterable" Error

**Symptoms:**
- Server error when processing GRNs
- Error logs show "poItems is not iterable" exception
- GRN creation fails when connecting to purchase orders

**Cause:**
This occurs due to incorrect destructuring of MySQL2 query results. MySQL2 returns an array with two elements: `[rows, fields]`.

**Solution:**
```javascript
// Incorrect:
const poItems = await connection.query(
  'SELECT * FROM purchase_order_items WHERE purchase_order_id = ?',
  [purchaseOrderId]
);
// Later fails when trying to iterate: for (const item of poItems)

// Correct:
const [poItems] = await connection.query(
  'SELECT * FROM purchase_order_items WHERE purchase_order_id = ?',
  [purchaseOrderId]
);
// Now works: for (const item of poItems)
```

#### Issue: "Cannot read properties of undefined (reading 'status')"

**Symptoms:**
- Error when checking purchase order status
- GRN processing fails with property access error
- Server logs show null or undefined access errors

**Cause:**
This happens when trying to access the `status` property of an undefined object, typically due to improper destructuring of database query results or a missing purchase order.

**Solution:**
```javascript
// Incorrect:
const poStatus = await connection.query(
  'SELECT status FROM purchase_orders WHERE id = ?',
  [purchaseOrderId]
);
const status = poStatus.status; // Error: poStatus is [rows, fields]

// Correct:
const [poStatusResult] = await connection.query(
  'SELECT status FROM purchase_orders WHERE id = ?',
  [purchaseOrderId]
);
// Check if we have results before accessing
if (poStatusResult && poStatusResult.length > 0) {
  const status = poStatusResult[0].status;
  // Use status safely
}
```

#### Issue: "Unknown column 'tenant_id' in 'where clause'"

**Symptoms:**
- Database error during GRN creation
- Error message specifically mentions tenant_id column not found
- Multi-tenancy filtering fails

**Cause:**
This error occurs when trying to filter by `tenant_id` directly on a table that doesn't have this column. For example, the `purchase_order_items` table doesn't have a `tenant_id` column, but it's related to `purchase_orders` which does.

**Solution:**
```javascript
// Incorrect:
const [poItems] = await connection.query(`
  SELECT * FROM purchase_order_items poi
  WHERE poi.purchase_order_id = ? AND poi.tenant_id = ?
`, [purchaseOrderId, tenantId]);

// Correct - JOIN with purchase_orders to get tenant_id:
const [poItems] = await connection.query(`
  SELECT poi.* 
  FROM purchase_order_items poi
  JOIN purchase_orders po ON poi.purchase_order_id = po.id
  WHERE po.id = ? AND po.tenant_id = ?
`, [purchaseOrderId, tenantId]);
```

#### Issue: Product Not Found During GRN Processing

**Symptoms:**
- GRN status update fails with product not found error
- Inventory updates incomplete
- Transaction rollback due to product errors

**Cause:**
This occurs when a product referenced in a GRN has been deleted from the database or has an invalid ID. Without proper error handling, this can cause the entire GRN process to fail.

**Solution:**
Implement robust error handling that logs warnings and skips missing products rather than failing the entire transaction:

```javascript
// Process each GRN item
for (const item of grnItems) {
  try {
    // Check if product exists
    const [productResult] = await connection.query(
      'SELECT id, current_stock_quantity FROM products WHERE id = ? AND tenant_id = ?',
      [item.product_id, tenant_id]
    );
    
    if (!productResult || productResult.length === 0) {
      // Log warning but continue processing other items
      console.warn(`Product not found during GRN processing: ${item.product_id}`);
      continue; // Skip this item but continue with others
    }
    
    // Process this item...
  } catch (error) {
    console.error(`Error processing GRN item ${item.product_id}:`, error);
    throw error; // Rethrow critical errors
  }
}
```

#### Issue: Column Name Inconsistency in Inventory Operations

**Symptoms:**
- Inventory updates fail or behave inconsistently
- Some operations update inventory while others don't
- Error logs show column not found errors

**Cause:**
This happens when different parts of the codebase use inconsistent column names for the same concept, such as using both `stock_quantity` and `current_stock_quantity`.

**Solution:**
Standardize on a single column name throughout the codebase:

```javascript
// Incorrect - inconsistent column names:
await connection.query(
  'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
  [quantity, productId]
);

// In another function:
await connection.query(
  'UPDATE products SET current_stock_quantity = current_stock_quantity - ? WHERE id = ?',
  [quantity, productId]
);

// Correct - standardized on current_stock_quantity:
await connection.query(
  'UPDATE products SET current_stock_quantity = current_stock_quantity + ? WHERE id = ?',
  [quantity, productId]
);

// In another function:
await connection.query(
  'UPDATE products SET current_stock_quantity = current_stock_quantity - ? WHERE id = ?',
  [quantity, productId]
);
```

### API Response Issues

#### Issue: Inconsistent API Response Format

**Symptoms:**
- Frontend displays generic error messages
- Some API endpoints return different response structures
- Console errors about undefined properties

**Cause:**
API endpoints are not following a consistent response format, making it difficult for the frontend to handle responses uniformly.

**Solution:**
Standardize all API responses to follow this format:

```javascript
// Success response:
res.status(200).json({
  success: true,
  data: result,
  pagination: paginationInfo // if applicable
});

// Error response:
res.status(errorStatusCode).json({
  success: false,
  error: {
    message: 'Descriptive error message',
    code: 'ERROR_CODE',
    details: errorDetails // if applicable
  }
});
```

#### Issue: API Returns 500 Errors Without Details

**Symptoms:**
- Generic "Internal Server Error" messages
- No detailed error information in responses
- Difficult to diagnose issues from client side

**Cause:**
Server-side errors are not being properly caught and formatted before sending responses.

**Solution:**
Implement a global error handler middleware:

```javascript
// errorHandler.js
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  
  // Determine status code
  const statusCode = err.statusCode || 500;
  
  // Format error for response
  const errorResponse = {
    success: false,
    error: {
      message: err.message || 'Internal Server Error',
      code: err.code || 'INTERNAL_SERVER_ERROR'
    }
  };
  
  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = err.stack;
  }
  
  res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;
```

### Frontend Problems

#### Issue: Form Submissions Don't Respect User Input

**Symptoms:**
- User selections or inputs are ignored when form is submitted
- Default values override user choices
- Some fields reset to defaults unexpectedly

**Cause:**
Backend code may be hardcoding values instead of using the values submitted by the user.

**Solution:**
Always respect user input and provide sensible defaults only when input is missing:

```javascript
// Incorrect:
const createGrn = async (req, res) => {
  // Always using 'COMPLETED' status regardless of what user sent
  const status = 'COMPLETED';
  // Process GRN with hardcoded status...
};

// Correct:
const createGrn = async (req, res) => {
  // Use status from request or default to 'COMPLETED'
  const status = req.body.status || 'COMPLETED';
  // Process GRN with user-selected or default status...
};
```

#### Issue: React Components Not Updating

**Symptoms:**
- UI doesn't reflect changes in data
- Components don't re-render after state changes
- Actions appear to have no effect

**Cause:**
This can happen due to improper state management, reference equality issues, or missing dependency arrays in hooks.

**Solution:**
Ensure proper state updates and dependency arrays:

```javascript
// Incorrect:
const [items, setItems] = useState([]);

const addItem = (newItem) => {
  items.push(newItem); // Mutating state directly!
  // Component won't re-render
};

// Correct:
const [items, setItems] = useState([]);

const addItem = (newItem) => {
  setItems([...items, newItem]); // Creating new array reference
  // Component will properly re-render
};

// Incorrect useEffect:
useEffect(() => {
  fetchData();
}, []); // Missing dependency on filters

// Correct useEffect:
useEffect(() => {
  fetchData();
}, [filters, page]); // Properly include all dependencies
```

### Deployment Issues

#### Issue: Application Fails After Deployment

**Symptoms:**
- Application works in development but fails in production
- Blank screens or 500 errors after deployment
- Missing functionality in deployed version

**Troubleshooting Steps:**
1. Check server logs for errors
2. Verify environment variables are correctly set
3. Ensure build process completed successfully
4. Check for differences between development and production environments

**Solution:**
- Review deployment logs for specific errors
- Implement proper environment variable validation
- Set up pre-deployment testing in a staging environment
- Add health checks to verify services after deployment

#### Issue: Frontend Assets Not Loading

**Symptoms:**
- Missing styles or JavaScript functionality
- Console errors about failed resource loading
- Partial or broken UI

**Troubleshooting Steps:**
1. Check browser console for 404 errors on specific assets
2. Verify that the build process included all necessary files
3. Check file paths in the generated HTML

**Solution:**
- Ensure proper base paths are configured
- Verify that the build process correctly processes all assets
- Check server configuration for static file serving
- Consider using a CDN for asset delivery

### Performance Problems

#### Issue: Slow API Responses

**Symptoms:**
- Long loading times for data-heavy pages
- Timeouts on complex operations
- Poor performance with large datasets

**Troubleshooting Steps:**
1. Profile slow endpoints to identify bottlenecks
2. Check database query execution time
3. Look for N+1 query problems
4. Verify proper indexing on frequently queried columns

**Solution:**
- Optimize database queries with proper indexing
- Implement pagination for large data sets
- Cache frequently accessed data
- Use query batching to reduce database roundtrips

```javascript
// Inefficient - N+1 queries:
const orders = await getOrders();
for (const order of orders) {
  const items = await getOrderItems(order.id); // Separate query for each order
  order.items = items;
}

// Efficient - Single query with JOIN:
const orders = await getOrdersWithItems();
```

#### Issue: Memory Leaks in Frontend

**Symptoms:**
- Browser becomes increasingly slow
- Application crashes after extended use
- Increasing memory usage in browser task manager

**Troubleshooting Steps:**
1. Use Chrome DevTools Memory tab to identify leaks
2. Check for event listeners that aren't being cleaned up
3. Look for large data caches that grow unbounded
4. Check for improper useEffect cleanup

**Solution:**
- Properly clean up subscriptions and event listeners
- Implement useEffect cleanup functions
- Limit cache sizes and implement LRU eviction
- Consider using virtualization for long lists

```javascript
// Incorrect:
useEffect(() => {
  const subscription = someService.subscribe(handleData);
  // Missing cleanup function
}, []);

// Correct:
useEffect(() => {
  const subscription = someService.subscribe(handleData);
  return () => {
    subscription.unsubscribe(); // Proper cleanup
  };
}, []);
```

## Diagnostic Tools

### Log Files

#### Application Logs

Location: `/var/log/zettaz/app.log` (production) or `logs/app.log` (development)

These logs contain:
- API requests and responses
- Error messages and stack traces
- Authentication events
- System operations

Example command to view recent errors:
```bash
grep -i error /var/log/zettaz/app.log | tail -n 100
```

#### Database Logs

Location: `/var/log/mysql/mysql-error.log` (typical location)

These logs contain:
- Query errors
- Connection issues
- Schema validation failures

Example command to view slow queries:
```bash
grep -i "slow query" /var/log/mysql/mysql-slow.log | tail -n 50
```

### System Status Page

The application includes a system status page accessible to administrators at `/admin/system-status`.

This page provides:
- Component health status (API, database, cache, storage)
- Recent error counts and types
- System resource utilization
- Active user count
- Background job status

### Database Inspection

For direct database inspection (administrators only):

1. Connect to the database:
```bash
mysql -u admin -p zettaz_db
```

2. Check table status:
```sql
SHOW TABLE STATUS;
```

3. Verify specific records:
```sql
-- Check for orphaned records
SELECT COUNT(*) FROM purchase_order_items poi
LEFT JOIN purchase_orders po ON poi.purchase_order_id = po.id
WHERE po.id IS NULL;

-- Check for data inconsistencies
SELECT id, status, received_status FROM purchase_orders
WHERE status = 'COMPLETED' AND received_status != 'FULLY_RECEIVED';
```

## Common Error Codes and Resolutions

| Error Code | Description | Resolution |
|------------|-------------|------------|
| DB_CONNECTION_ERROR | Database connection failed | Check database credentials and connection settings |
| TENANT_NOT_FOUND | Tenant ID invalid or missing | Verify tenant exists and user has correct tenant association |
| PRODUCT_NOT_FOUND | Referenced product doesn't exist | Update product references or implement robust error handling |
| INSUFFICIENT_STOCK | Not enough inventory for operation | Verify inventory counts and adjust quantities |
| INVALID_STATUS_TRANSITION | Invalid status change attempted | Check business rules for allowed status transitions |
| DUPLICATE_SKU | Duplicate product SKU detected | Use a unique SKU for each product |
| PERMISSION_DENIED | User lacks required permissions | Check user role and permission assignments |
| TOKEN_EXPIRED | Authentication token expired | Re-login or implement token refresh |
| VALIDATION_ERROR | Form data validation failed | Check input data against validation rules |
