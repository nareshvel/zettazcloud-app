# Task: Enhance Customer Deletion Strategy

**Date Created:** 2025-05-25
**Status:** Pending
**Priority:** Medium
**Reporter:** Cascade AI / User Request
**Assigned To:** Backend Team

## 1. Current Situation

Currently, customer deletion is implemented as a **hard delete** in the backend (`DELETE /api/customers/:id` route in `backend/routes/customer.routes.js`).
The SQL query executed is: `DELETE FROM customers WHERE id = ? AND tenant_id = ?`.

A database-level foreign key constraint (`ER_ROW_IS_REFERENCED_2`) prevents the deletion of customers who have associated records (e.g., sales, invoices). In such cases, the API returns a 400 error, and the frontend displays a message indicating that the customer cannot be deleted due to existing references.

## 2. Desired Enhancement

Implement a more robust and flexible customer deletion strategy. The preferred approach is to introduce **soft deletion** or a **conditional deletion** mechanism:

**Option A: Always Soft Delete**
*   Modify the `DELETE /api/customers/:id` endpoint to perform a soft delete.
*   This typically involves:
    *   Adding an `is_deleted` boolean column (default `false`) to the `customers` table.
    *   Adding a `deleted_at` timestamp column (nullable) to the `customers` table.
*   When a delete request is received, update the customer record by setting `is_deleted = true` and `deleted_at = NOW()`.
*   Update all relevant customer fetch queries (e.g., `GET /api/customers`, `GET /api/customers/search`, `GET /api/customers/:id`) to exclude soft-deleted customers by default (e.g., `WHERE is_deleted = false`).
*   Consider providing an admin interface or special API endpoints to view/manage soft-deleted customers or perform permanent deletion if necessary.

**Option B: Conditional Deletion**
*   Modify the `DELETE /api/customers/:id` endpoint.
*   **If the customer has no associated transactions or critical linked records:**
    *   Perform a hard delete (as is currently done).
*   **If the customer has associated transactions or critical linked records:**
    *   Perform a soft delete (as described in Option A).
    *   The frontend should be informed whether a soft or hard delete was performed, or simply that the customer is no longer active.

## 3. Rationale

*   **Data Integrity:** Prevents accidental permanent loss of customer data, especially if they have a history.
*   **Auditing & Reporting:** Allows for historical reporting and auditing even for customers who are no longer active.
*   **Reversibility:** Soft-deleted customers can potentially be restored.
*   **User Experience:** Provides a clearer path for users when a customer cannot be fully removed due to dependencies, rather than just an error.

## 4. Implementation Steps (General for Soft Delete)

1.  **Database Schema Changes:**
    *   Add `is_deleted` (BOOLEAN, default `false`, add index) to the `customers` table.
    *   Add `deleted_at` (TIMESTAMP, nullable) to the `customers` table.
2.  **Backend API Changes (`customer.routes.js`):**
    *   Update the `DELETE /api/customers/:id` route handler to perform the soft delete (update `is_deleted` and `deleted_at`).
    *   Modify all customer retrieval queries (`SELECT`) to filter out soft-deleted records (`WHERE is_deleted = false AND tenant_id = ? ...`).
    *   Consider if any other services or parts of the application need to be aware of this change (e.g., reporting services).
3.  **Frontend Changes (Optional but Recommended):**
    *   Ensure the UI correctly reflects that a customer is no longer active (already handled by `isActive` flag, but ensure consistency).
    *   Potentially provide an option for administrators to view or manage "archived" (soft-deleted) customers.
4.  **Testing:**
    *   Test deletion of customers with and without transactions.
    *   Verify that soft-deleted customers do not appear in standard lists/searches.
    *   Verify data integrity and referential integrity.

## 5. Acceptance Criteria

*   Customers with transactions are soft-deleted (or deletion is handled gracefully according to the chosen strategy).
*   Customers without transactions can be hard-deleted (if conditional logic is chosen) or soft-deleted.
*   Soft-deleted customers are not visible in regular customer listings or searches.
*   The system maintains data integrity.
