# Purchase Order Deletion Bug - Troubleshooting Journey

## Issue Summary
When attempting to delete a purchase order (either hard delete or cancel/soft delete), the system was returning a 500 Internal Server Error. The frontend showed the error message "Error processing purchase order deletion" when trying to delete a purchase order with ID `61b42f82-a942-4f04-a8e2-2f23d6cfba68`.

## Root Causes Identified
Through our troubleshooting, we identified several interconnected issues:

1. **Property Name Mismatch**: Initially, we discovered a mismatch between snake_case properties in the backend vs camelCase in the frontend.
2. **Undefined Property Access**: The backend was trying to access `purchase_order_number` when the property might be called `purchaseOrderNumber`.
3. **Transaction Handling Issues**: The most critical issue turned out to be improper return values within the database transaction callback.

## Troubleshooting Approaches and Attempts

### Attempt 1: Fixing Camel Case vs Snake Case Property Access

We first identified that the debug logs showed the frontend was using camelCase property names:

```javascript
// Frontend debug logs:
purchase-orders:37 First PO: {id: '61b42f82-a942-4f04-a8e2-2f23d6cfba68', tenantId: '...', ... }
purchase-orders:37 PO Number: undefined
purchase-orders:37 Supplier Name: undefined
```

But these fields were undefined because the code was looking for snake_case properties:

```javascript
console.log('PO Number:', data[0].purchase_order_number);
console.log('Supplier Name:', data[0].supplier_name);
```

**Fix attempt**: We updated the frontend debug code to use camelCase properties and created a normalization function in the backend:

```javascript
const normalizePurchaseOrder = (po) => {
  if (!po) return {};
  
  return {
    id: po.id,
    tenantId: po.tenant_id || po.tenantId,
    // ...other properties
    purchaseOrderNumber: po.purchase_order_number || po.purchaseOrderNumber || `PO-${po.id}`,
  };
};
```

### Attempt 2: Handling UUID Case Sensitivity

The server logs showed:
```
[Backend] Processing purchase order deletion: 61b42f82-a942-4f04-a8e2-2f23d6cfba68, Type: SOFT DELETE/CANCEL, Tenant ID: d7f267da-d5d9-4a15-b0d3-31ca710a4492
[Backend] Purchase order query result: No PO found
```

We hypothesized this might be a UUID case sensitivity issue.

**Fix attempt**: We added `LOWER()` SQL function to normalize UUID comparison:

```javascript
// Build the query with case-insensitive UUID comparison
let query = `SELECT po.*, ... FROM purchase_orders po ... WHERE LOWER(po.id) = ?`;
let queryParams = [id.toLowerCase()];

if (tenant_id) {
  query += ' AND LOWER(po.tenant_id) = ?';
  queryParams.push(tenant_id.toLowerCase());
}
```

### Attempt 3: Simplifying Database Access

After realizing the complex query with joins might be causing issues, we simplified the approach:

**Fix attempt**: We implemented a direct database query without joins:

```javascript
// Execute simple query without joins or LOWER() functions
const [poRows] = await connection.query(
  'SELECT * FROM purchase_orders WHERE id = ?',
  [id]
);
```

### Attempt 4: Direct Database Test

To validate our hypothesis about data retrieval, we ran a direct database test:

```javascript
// Our direct database test showed:
Found PO: NO
{
  id: '61b42f82-a942-4f04-a8e2-2f23d6cfba68',
  // ...rest of the data
}
```

This revealed a logical contradiction - the console said "NO" but the data was actually returned.

### Final Solution: Fixing Transaction Handling

The core issue was that we were incorrectly returning Express responses (`res.status().json()`) from inside the database transaction callback. This breaks the transaction flow since:

1. In a database transaction, you need to return data objects to the transaction handler
2. Only after the transaction completes should you send responses to the client

**Solution**:
```javascript
// Before (problematic)
return await db.withTransaction(async (connection) => {
  // ...
  return res.status(404).json({ message: 'Error' }); // WRONG: Breaks transaction
});

// After (fixed)
const result = await db.withTransaction(async (connection) => {
  // ...
  return { status: 404, message: 'Error' }; // Correct: Returns data to transaction
});

// Now handle response outside the transaction
return res.status(result.status).json({ message: result.message });
```

## Key Learnings

1. **Transaction Pattern**: When using database transactions, never return HTTP responses from within the transaction callback. Always return data objects and handle the response after the transaction completes.

2. **Data Normalization**: With mixed property naming conventions (snake_case vs. camelCase), it's important to normalize data consistently or use accessor functions.

3. **Direct Testing**: Direct database testing was crucial to identifying the actual issue versus what the logs were showing.

4. **UUID Handling**: While UUID case sensitivity wasn't the root cause here, it's an important consideration for database queries.

5. **Error Message Clarity**: More descriptive error messages in the API responses would have made troubleshooting faster.

## Failed Attempt #3: Simplified Non-Transaction Approach (May 30, 2025)

After multiple attempts with transaction-based logic, we tried a completely simplified approach that avoided using transactions altogether.

### Changes Made
* Removed the `db.withTransaction()` pattern completely
* Used direct database queries with proper error handling
* Maintained the same business logic (PO existence check, tenant validation, GRN constraints check)
* Simplified the execution flow while maintaining all security checks

### Error Result
This approach also resulted in a 500 Internal Server Error with the same client-side error message: "Error processing purchase order deletion".

```
DELETE http://localhost:3000/api/purchase-orders/61b42f82-a942-4f04-a8e2-2f23d6cfba68?tenant_id=d7f267da-d5d9-4a15-b0d3-31ca710a4492 500 (Internal Server Error)
```

After these multiple failed attempts with various approaches, a full rollback to a previous stable version may be necessary, followed by a more fundamental rethinking of the deletion logic.

## Recommendations for Future Development

1. **Consistent Naming Convention**: Standardize on either snake_case or camelCase throughout the entire stack.

2. **Transaction Helper Functions**: Create helper functions that properly handle the transaction-to-HTTP-response pattern.

3. **Enhanced Error Logging**: Add more detailed error information in API responses.

4. **Database Schema Documentation**: Document the expected format of UUIDs (case sensitivity, etc.) in the database.

5. **Unit Tests**: Add automated tests for critical operations like deletions with various scenarios.
