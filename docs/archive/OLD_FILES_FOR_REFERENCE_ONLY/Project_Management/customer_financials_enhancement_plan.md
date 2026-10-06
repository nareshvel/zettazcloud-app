# Implementation Plan: Enhancements for Customer Financials (Discounts, Credit, Tax Exemption)

**Version:** 1.0
**Date:** 2025-05-25

## 1. Objective

To improve the robustness, maintainability, and clarity of handling customer-specific financial aspects such as discounts (ad-hoc and default), customer credit (charge to account), and tax exemptions within the Zettaz Cloud POS system.

## 2. Current State Analysis (Summary from Code Review - May 2025)

### 2.1. Ad-hoc Discounts (Manual Discounts per Sale)

*   **Frontend:** Applied via `DiscountModal` in `Cart.tsx`, managed by `CartContext.customSetDiscount`, which updates `discountState`.
*   **Backend (`POST /api/sales`):** Receives `discountType`, `discountValue`, and `discountAmount` from `discountState` in the `SaleData` payload. The backend currently uses these values as provided.

### 2.2. Default Customer Discounts

*   **Frontend:** When a customer is selected (`CartContext.customSetSelectedCustomer`), if the `Customer` object (fetched from backend) contains `defaultDiscountValue` and `defaultDiscountType` properties, these are automatically applied to the cart's `discountState`.
*   **Backend:** Relies on the `Customer` object served by customer-related APIs (e.g., `/api/customers`) to include these fields. The `POST /api/sales` endpoint receives the applied discount details similarly to ad-hoc discounts.
*   **Note:** A manual discount applied during a sale overrides the customer's default discount for that sale.

### 2.3. Customer Credit (Charge to Account)

*   **Frontend:** Treated as a payment method (`on_account`) in `PaymentModal.tsx`.
    *   `Cart.tsx` determines general eligibility (`canChargeToAccount`) based on `selectedCustomer.customerType` and `creditLimit > 0`.
    *   `PaymentModal.tsx` performs detailed client-side validation against `selectedCustomer.creditLimit` and `selectedCustomer.outstandingCredit` to ensure the sale total doesn't exceed available credit.
*   **Backend (`POST /api/sales`):** If the payment method indicates "charge to account" and a `customerId` is provided, the backend is responsible for updating the customer's `outstanding_credit` in the database.
*   **Note:** Relies on `Customer` object having `creditLimit` and `outstandingCredit` fields.

### 2.4. Tax Exemptions

*   **Frontend:** 
    *   The `Customer` object is expected to have an `is_tax_exempt` flag.
    *   The core tax calculation logic in `CartContext.calculateTotalsAndTaxes` (which populates `cartTotalTax`) **does not currently appear to explicitly zero out tax** if `selectedCustomer.is_tax_exempt` is true. It calculates tax based on items and applicable rates.
*   **Backend (`POST /api/sales`):** 
    *   Receives the `tax` amount as calculated by the frontend (via `cartTotalTax`).
    *   **Crucially, the backend *must* currently be responsible for re-validating the customer's tax-exempt status using the `customerId` and ensuring the final recorded sale tax is $0 if the customer is indeed exempt.** This step is vital for compliance.

## 3. Key Dependencies & Potential Issues

*   **Customer Object Integrity:** Frontend logic heavily relies on the `Customer` object (from backend APIs) containing accurate and consistently named fields: `defaultDiscountValue`, `defaultDiscountType`, `creditLimit`, `outstandingCredit`, `is_tax_exempt`, `customerType`.
*   **Backend Logic Gaps/Assumptions:** 
    *   The backend implicitly trusts the `tax` amount from the frontend to some extent, but *must* override it for tax-exempt customers.
    *   Discount amounts are taken as calculated by the frontend.
*   **Lack of Centralized Management:** Core financial attributes of a customer (default discount, credit limit, tax exemption status) are primarily managed as part of the general customer data, without dedicated APIs for these specific financial aspects, which can make auditing or specific updates more complex.

## 4. Proposed Enhancements & Implementation Steps

### 4.1. Phase 1: Strengthen Backend Validation & Logic (High Priority)

*   **Objective:** Ensure backend is the ultimate source of truth for critical calculations and compliance.
*   **Target:** `POST /api/sales` endpoint in `backend/server.js` (or relevant sales processing module).
*   **Actions:**
    1.  **Tax Exemption Enforcement:** 
        *   When a `customerId` is present in the sale data, re-fetch the customer's `is_tax_exempt` status from the database.
        *   If `is_tax_exempt` is true, **unconditionally set the `tax` amount for the sale to 0**, overriding any `tax` value sent from the frontend.
    2.  **Discount Recalculation (Optional but Recommended):**
        *   Consider having the backend recalculate `discountAmount` based on the `subtotal`, `discountType`, `discountValue` from the request, and the store's `discountApplicationPreference` (fetched server-side). This ensures consistency if frontend calculation ever drifts.
    3.  **Credit Update Robustness:**
        *   Ensure the update to `outstanding_credit` is atomic and handles potential race conditions if applicable.

### 4.2. Phase 2: Improve Frontend Clarity & User Experience

*   **Objective:** Provide clearer feedback to the POS user, especially regarding tax exemptions.
*   **Target:** `frontend/src/contexts/CartContext.tsx`.
*   **Actions:**
    1.  **Tax Exemption Display:** 
        *   Modify the `calculateTotalsAndTaxes` internal function (or the exported `calculateTax` function) to check `selectedCustomer?.is_tax_exempt`.
        *   If true, ensure `cartTotalTax` is set to 0 and `appliedTaxDetails` is empty or reflects the exemption. This will make the cart UI display $0 tax for exempt customers *before* checkout.

### 4.3. Phase 3: Centralize Customer Financial Profile Management

*   **Objective:** Improve maintainability, auditability, and clarity of managing customer financial attributes.
*   **Actions:**
    1.  **Design Dedicated API Endpoints:**
        *   `PUT /api/customers/:id/financial-profile` (or similar): For updating fields like `defaultDiscountValue`, `defaultDiscountType`, `creditLimit`, `is_tax_exempt`.
        *   `GET /api/customers/:id/financial-profile`: For fetching these specific details.
    2.  **Frontend Integration:** Update customer management UIs to use these new endpoints for modifying these specific attributes.

### 4.4. Ongoing: API Contracts & Documentation

*   **Objective:** Ensure clear understanding of data structures and responsibilities across frontend and backend.
*   **Actions:**
    1.  Document the expected fields in the `Customer` object (and their data types/formats) related to discounts, credit, and tax status.
    2.  Clearly document the responsibilities and behavior of the `POST /api/sales` endpoint regarding how it processes discounts, enforces tax exemptions, and updates customer credit.

## 5. Next Steps (Based on User Request 2025-05-25)

*   This plan is documented for future reference.
*   Development will now shift to implementing the **Stock Adjustment** module.
*   The enhancements outlined above can be revisited and prioritized as needed after progress on other modules.
