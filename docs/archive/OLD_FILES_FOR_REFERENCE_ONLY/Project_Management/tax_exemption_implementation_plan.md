# Implementation Plan: Tax-Exempt Customers

**Version:** 1.0
**Date:** 2025-05-25

## 1. Objective

To implement functionality within the Zettaz Cloud POS system to correctly handle tax-exempt customers, ensuring that no tax is applied to their transactions when applicable, and that their status is manageable and clearly indicated.

## 2. Current State

Currently, the system applies taxes based on configured tax classes and rates to all sales. There is no mechanism to identify or treat specific customers as tax-exempt.

## 3. Proposed Solution

### 3.1. Data Model Changes

*   **`customers` Table:**
    *   Add a new boolean column: `is_tax_exempt` (TINYINT(1), default: `0` or `false`).
    *   (Optional - for future enhancement) Add a new string column: `tax_exemption_id` (VARCHAR(255), nullable, default: `NULL`) to store an exemption certificate number or identifier.
    *   (Optional - for future enhancement) Add a new text column: `tax_exemption_details` (TEXT, nullable) for any notes or reasons.

### 3.2. Backend API Changes

*   **Customer Endpoints (`/api/customers`):
    *   **`POST /api/customers` (Create Customer):** Allow `is_tax_exempt` (and optional fields) to be set during customer creation.
    *   **`PUT /api/customers/:id` (Update Customer):** Allow `is_tax_exempt` (and optional fields) to be updated.
    *   **`GET /api/customers` & `GET /api/customers/:id` (Fetch Customers):** Ensure `is_tax_exempt` status (and optional fields) are returned in the customer data.
*   **Sales/Order Processing Logic (e.g., in `POST /api/sales`):
    *   When a sale is associated with a customer ID, fetch the customer's `is_tax_exempt` status.
    *   If `is_tax_exempt` is true, the calculated tax for the sale must be zero, regardless of items or default tax rules.
    *   The `sales` table should accurately reflect the tax charged (which would be 0 for exempt sales).
*   **Tax Calculation Logic:**
    *   Modify any centralized tax calculation functions to accept customer context and apply exemption if necessary.

### 3.3. Frontend Changes

*   **Customer Management UI (e.g., `CustomersListPage.tsx`, Customer Edit/Create Forms):
    *   Add a checkbox or toggle to set/unset the `is_tax_exempt` status for a customer.
    *   (Optional) Add fields for `tax_exemption_id` and `tax_exemption_details`.
*   **POS Interface (`CartContext.tsx`, `Cart.tsx`):
    *   When a customer is selected for a sale:
        *   Fetch the customer's full details, including `is_tax_exempt`.
        *   Store this status in the `CartContext` or relevant state.
    *   **`calculateTax()` function in `CartContext.tsx`:**
        *   If the current customer in the cart is tax-exempt, this function should return `0`.
    *   **UI Display in Cart/Checkout:**
        *   Clearly indicate if the current customer is tax-exempt.
        *   Display tax as "$0.00 (Exempt)" or similar when exemption applies.
*   **Receipts:**
    *   Receipts for tax-exempt sales should show $0.00 tax and potentially a note indicating tax-exempt status.

## 4. Key Scenarios to Test

1.  **Admin/User creates a new customer and marks them as tax-exempt.**
    *   Verify: Customer record in DB shows `is_tax_exempt = true`.
2.  **Admin/User edits an existing customer to mark them as tax-exempt.**
    *   Verify: Customer record updates correctly.
3.  **Admin/User edits an existing tax-exempt customer to mark them as non-exempt.**
    *   Verify: Customer record updates correctly.
4.  **POS: Cashier selects a tax-exempt customer for a sale.**
    *   Verify: Cart UI shows tax as $0.00 and indicates exempt status.
    *   Verify: Final sale recorded in backend has $0.00 tax.
    *   Verify: Receipt shows $0.00 tax.
5.  **POS: Cashier selects a regular (taxable) customer for a sale.**
    *   Verify: Cart UI shows applicable tax.
    *   Verify: Final sale recorded in backend has correct tax.
    *   Verify: Receipt shows correct tax.
6.  **POS: Cashier conducts a sale without selecting a customer (guest checkout).**
    *   Verify: Standard tax rules apply.
7.  **Reporting (Manual Check/Future):** Sales reports should be ableable to distinguish or filter tax-exempt sales if needed (e.g., by checking sales records where tax is 0 and a customer was attached who is exempt).

## 5. Workflow for Managing Exemption Status

*   Authorized users (e.g., admins, managers) will manage the `is_tax_exempt` flag through the customer creation/editing interface in the application's admin/customer management section.
*   Cashiers at the POS will select customers. If a selected customer is tax-exempt, the system automatically applies the exemption.

## 6. Future Considerations (Optional)

*   **Granular Exemptions:** Support for customers exempt from specific taxes but not others, or exempt only for certain product types (more complex).
*   **Exemption Certificates:** Storing and managing exemption certificate numbers, expiry dates, and possibly scanned documents.
*   **Audit Trails:** Logging changes to a customer's tax-exempt status.

## 7. Open Questions/Discussion Points

*   Is the simple boolean `is_tax_exempt` sufficient for initial MVP, or are `tax_exemption_id` / `details` needed from the start?
*   What level of user role is required to modify tax-exempt status?
*   Specific UI wording for indicating tax exemption to the cashier and on receipts.
*   Any specific reporting requirements related to tax-exempt sales in the near term?

## 8. Feature: Dynamic Tax Selection at POS (Phase 2 / Future Enhancement)

### 8.1. Objective

To provide POS users (e.g., cashiers) the ability to manually select a specific tax class/rate for a given transaction, overriding any default tax configurations (customer default or system default). This allows for handling exceptions or specific scenarios requiring a non-standard tax application.

### 8.2. Proposed Solution

#### 8.2.1. Frontend Changes

*   **POS UI (`Cart.tsx` or similar):**
    *   Add a "Change Tax" button or link, likely near the displayed tax amount in the cart summary.
    *   This button would be disabled if the customer is tax-exempt.
*   **Tax Selection Modal:**
    *   Triggered by the "Change Tax" button.
    *   Fetches and displays a list of available tax classes (and their primary/default rates) from `/api/tax-classes` and `/api/tax-classes/:classId/rates`.
    *   Allows the user to select one tax configuration.
    *   Includes "Apply" and "Cancel" buttons.
*   **State Management (`CartContext.tsx`):**
    *   Introduce new state to hold the `manuallySelectedTaxConfig` (e.g., `{ taxClassId, taxRateId, effectiveRate, displayName }`).
    *   If a tax is manually selected, this state is populated. It can be cleared to revert to default tax.
*   **Tax Calculation Logic (`calculateTax()` in `CartContext.tsx`):**
    *   Order of precedence:
        1.  If customer is tax-exempt: tax is 0.
        2.  Else if `manuallySelectedTaxConfig` is present: use its `effectiveRate`.
        3.  Else: use the existing default tax logic (customer's default or system default).
*   **UI Display:**
    *   Clearly indicate if a manual tax override is active (e.g., "Tax (Manual): ..." or next to the tax name).

#### 8.2.2. Backend API Changes

*   **Sales Endpoint (`POST /api/sales`):**
    *   Modify the request payload to optionally accept `applied_tax_class_id` and `applied_tax_rate_id`.
    *   If these are provided, the backend should:
        *   Validate them.
        *   Use these IDs to determine the tax rate and calculate the final tax amount for the sale, overriding any default calculations.
        *   Store these IDs in the `sales` table (e.g., in existing `tax_class_id`, `tax_rate_id` columns, or new `overridden_tax_class_id`, `overridden_tax_rate_id` columns if differentiation is critical for reporting). The `tax` amount stored must reflect this override.
*   **Database (`sales` table - considerations):**
    *   Decide if existing `tax_class_id` and `tax_rate_id` can be used for overridden taxes, or if new columns like `overridden_tax_class_id`, `overridden_tax_rate_id`, and `tax_override_reason` (optional) are needed for better auditability.

### 8.3. Key Scenarios to Test

1.  **POS: Cashier overrides default tax with a different tax class for a taxable customer.**
    *   Verify: Modal shows available taxes; selection works.
    *   Verify: Cart UI updates with new tax rate and amount, indicating manual override.
    *   Verify: Backend records sale with the overridden tax class/rate and correct tax amount.
2.  **POS: Cashier attempts to override tax for a tax-exempt customer.**
    *   Verify: "Change Tax" option is disabled or modal prevents selection if customer is exempt.
3.  **POS: Cashier overrides tax, then clears the override.**
    *   Verify: System reverts to default tax calculation.
4.  **POS: Cashier overrides tax, then adds/removes items from cart.**
    *   Verify: Manually selected tax rate is consistently applied to the new subtotal.
5.  **Reporting (Manual Check/Future):** Ensure sales reports can reflect or identify sales where tax was manually overridden.

### 8.4. Workflow

1.  Cashier identifies a need to apply a non-standard tax.
2.  Cashier clicks "Change Tax" in the POS cart view.
3.  Modal appears, listing available tax configurations.
4.  Cashier selects the desired tax and clicks "Apply."
5.  Cart updates with the new tax. Sale proceeds.

### 8.5. Open Questions/Discussion Points

*   What user roles should have permission to override taxes?
*   How should the list of taxes in the modal be presented if there are many tax classes/rates? (Search, pagination?)
*   Is a reason for override necessary to log?
*   Impact on reporting and auditing – how to best track these overrides?

---
