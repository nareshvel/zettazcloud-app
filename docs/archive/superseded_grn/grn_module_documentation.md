# Goods Received Note (GRN) Module Documentation

## 1. Introduction

The Goods Received Note (GRN) module is responsible for managing the process of receiving goods into inventory. This typically occurs when a shipment arrives from a supplier, possibly against a Purchase Order (PO). The module handles the creation of GRN records, updating product stock levels, calculating weighted average costs (WAC), logging inventory movements, and updating related PO statuses.

All operations are designed with multi-tenancy in mind, primarily using `tenant_id` and often `store_id` for data isolation and context.

## 2. Key Entities & Database Tables Involved

-   **`goods_received_notes`**: Stores the header information for each GRN.
    -   Key Columns: `id` (PK), `tenant_id`, `store_id`, `grn_number` (system-generated), `status` (e.g., DRAFT, COMPLETED, CANCELLED), `supplier_id` (FK), `purchase_order_id` (FK), `received_date`, `user_id` (creator), `received_by_user_id`, `total_received_value`, `supplier_invoice_number`, `supplier_invoice_date`, `total_tax_paid`, `shipping_handling_paid`, `other_charges_paid`, `grand_total` (calculated).
-   **`grn_items`**: Stores line item details for each GRN.
    -   Key Columns: `id` (PK), `grn_id` (FK), `product_id` (FK), `purchase_order_item_id` (FK, optional), `quantity_ordered`, `quantity_received`, `unit_cost_price`, `tax_rate`, `tax_amount` (calculated), `line_total` (calculated), `line_total_with_tax` (calculated), `batch_number`, `expiry_date`.
-   **`products`**: Master table for products. Updated by GRN operations.
    -   Key Columns: `id` (PK), `tenant_id`, `stock_quantity`, `weighted_average_cost`, `last_received_cost_price`, `total_quantity_received`, `last_received_date`.
-   **`inventory_logs`**: Records all changes to product stock levels.
    -   Key Columns: `id` (PK), `tenant_id`, `store_id`, `product_id` (FK), `quantity_change`, `current_stock_before_change`, `current_stock_after_change`, `reason`, `created_by` (FK to users), `reference_type` (e.g., 'GRN_ITEM', 'GRN_DELETION_REVERSAL'), `reference_id` (e.g., GRN Item ID or GRN ID).
-   **`purchase_orders`**: Purchase Order header information. Status may be updated by GRN operations.
    -   Key Columns: `id` (PK), `tenant_id`, `status`.
-   **`purchase_order_items`**: Purchase Order line item details. Status and received quantities are updated.
    -   Key Columns: `id` (PK), `tenant_id`, `purchase_order_id` (FK), `quantity_ordered`, `quantity_received`, `status`.
-   **`suppliers`**: Supplier master data.
-   **`users`**: User master data (for `created_by`, `received_by_user_id`).
-   **`stores`**: Store master data (for `store_id` context).

## 3. GRN Statuses

-   **`DRAFT`**: GRN is created but inventory is not yet committed. Can be edited.
-   **`COMPLETED`**: GRN is finalized, and inventory has been committed (stock updated, WAC calculated).
-   **`POSTED`**: (Potentially a future status) Indicates GRN has been posted to accounting or a subsequent system. Typically a final state.
-   **`CANCELLED`**: GRN is voided. If inventory was previously committed, it's reversed.

## 4. Core GRN Operations (CRUD) & Database Impact

Critical operations like Create, Update Status, and Delete are wrapped in database transactions (`db.withTransaction`) to ensure atomicity.

### 4.1. Create GRN (`POST /api/grn`)

-   **Purpose**: To record new incoming goods.
-   **Inputs (Request Body)**: `tenant_id`, `store_id`, `supplier_id` (optional), `purchase_order_id` (optional), `received_date`, `notes` (optional), `items` (array of item objects), `supplier_invoice_number` (optional), `supplier_invoice_date` (optional), `total_tax_paid` (optional), `shipping_handling_paid` (optional), `other_charges_paid` (optional).
    -   Each item object: `product_id`, `quantity_received`, `unit_cost_price`, `tax_rate`, `purchase_order_item_id` (optional), `quantity_ordered` (optional), `batch_number` (optional), `expiry_date` (optional).
-   **Default Status on Creation**: `COMPLETED` (meaning inventory is committed immediately upon creation as per current `createGrn` logic).
-   **Database Interactions**:
    1.  **`goods_received_notes`**: `INSERT` a new record.
        -   Populates: `id` (UUID), `tenant_id`, `store_id`, `grn_number` (generated sequentially per tenant, e.g., GRN-YYMM-XXXXX), `status` ('COMPLETED'), `supplier_id`, `purchase_order_id`, `received_date`, `user_id` (from auth), `received_by_user_id` (from auth), `total_received_value` (calculated sum of `item.quantity_received * item.unit_cost_price`), and other optional fields like `supplier_invoice_number`, etc.
    2.  **`grn_items`**: For each item in the request:
        -   `INSERT` a new record.
        -   Populates: `id` (UUID), `grn_id`, `product_id`, `purchase_order_item_id`, `quantity_ordered`, `quantity_received`, `unit_cost_price`, `tax_rate`.
    3.  **`products`**: For each item:
        -   `SELECT` existing `stock_quantity`, `weighted_average_cost`, `total_quantity_received` for the `product_id` and `tenant_id`.
        -   `UPDATE` the product record:
            -   `stock_quantity`: Incremented by `item.quantity_received`.
            -   `last_received_cost_price`: Set to `item.unit_cost_price`.
            -   `weighted_average_cost`: Recalculated: `((old_stock * old_wac) + (received_qty * received_cost)) / (new_total_stock)`.
            -   `total_quantity_received`: Incremented by `item.quantity_received`.
            -   `last_received_date`: Set to GRN's `received_date`.
    4.  **`inventory_logs`**: For each item:
        -   `INSERT` a new record.
        -   Populates: `id` (UUID), `tenant_id`, `store_id`, `product_id`, `quantity_change` (+`item.quantity_received`), `current_stock_before_change`, `current_stock_after_change`, `reason` (e.g., "GRN Receipt: [grnNumber]"), `created_by` (user ID), `reference_type` ('GRN_ITEM'), `reference_id` (GRN Item ID).
    5.  **`purchase_order_items`** (if `item.purchase_order_item_id` is provided):
        -   `SELECT` current `quantity_received` and `quantity_ordered`.
        -   `UPDATE` the PO item:
            -   `quantity_received`: Incremented by `item.quantity_received`.
            -   `status`: Updated based on new `quantity_received` vs `quantity_ordered` (e.g., 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED').
    6.  **`purchase_orders`** (if `purchase_order_id` is provided or derived from items):
        -   Calls `updatePurchaseOrderStatus` helper to potentially update PO header `status` based on the status of all its items.

### 4.2. Read GRNs (`GET /api/grn`, `GET /api/grn/:id`)

-   **`GET /api/grn` (List GRNs)**
    -   **Inputs**: `tenant_id`, `store_id` (required query params). Optional: `page`, `limit`, `status`, `supplier_id`, `purchase_order_id`, `grn_number`, `date_from`, `date_to`.
    -   **Database Interactions**: `SELECT` from `goods_received_notes` with `LEFT JOIN`s to `suppliers`, `purchase_orders`, `users` (for `received_by_username`), `stores` to fetch related names. Includes pagination and filtering.
    -   **Outputs**: Paginated list of GRN headers.
-   **`GET /api/grn/:id` (Single GRN by ID)**
    -   **Inputs**: `id` (GRN ID in path), `tenant_id` (required query param).
    -   **Database Interactions**:
        1.  `SELECT` from `goods_received_notes` (JOIN `suppliers`, `users`, `stores`, `purchase_orders`) for the GRN header.
        2.  `SELECT` from `grn_items` JOIN `products` (for `product_name`, `product_sku`) for the GRN line items.
    -   **Outputs**: A single GRN object containing header details and an array of its items.

### 4.3. Update GRN (`PUT /api/grn/:id`)

-   **Purpose**: To modify details of an existing Goods Received Note. The modifiable fields depend heavily on the GRN's current status.
-   **Inputs (Request Body)**: Fields similar to Create GRN, including `tenant_id`. The `items` array might be replaced or modified *only if the GRN is in DRAFT status*.
-   **Behavior based on GRN Status**:
    -   **`DRAFT` Status**:
        -   Allows updates to most header fields (e.g., `store_id`, `supplier_id`, `purchase_order_id`, `received_date`, `notes`, financial fields).
        -   If `items` are provided, all existing GRN items are deleted and replaced with the new set. `total_received_value` is recalculated.
        -   No direct inventory changes occur; this happens when the status is changed to `COMPLETED`.
    -   **`COMPLETED` Status**:
        -   **Item changes are NOT allowed.** Attempting to pass an `items` array will result in an error.
        -   Allows updates to non-item-related header fields such as `notes`, `supplier_invoice_number`, `supplier_invoice_date`, `total_tax_paid`, `shipping_handling_paid`, `other_charges_paid`.
    -   **`POSTED` Status**:
        -   Only allows updates to `notes`, `supplier_invoice_number`, and `supplier_invoice_date`. All other changes are disallowed.
    -   **`CANCELLED` Status**:
        -   No updates are allowed via this endpoint.
-   **Database Interactions**:
    1.  `SELECT` from `goods_received_notes` to fetch the GRN and validate its status and `tenant_id`.
    2.  If status is `DRAFT` and `items` are provided:
        -   `DELETE` from `grn_items` where `grn_id` matches.
        -   `INSERT` new records into `grn_items` for each item in the request.
        -   Recalculate `total_received_value`.
    3.  `UPDATE goods_received_notes` with new/modified header values based on the allowed changes for its current status.
    4.  If `purchase_order_id` is linked and relevant changes occurred (items changed for `DRAFT`, or `purchase_order_id` changed for `DRAFT`), calls `updatePurchaseOrderStatus`.
-   **Inventory Impact**: The `updateGrn` function itself **does not directly alter inventory levels** (`products.stock_quantity`) or create `inventory_logs`. These changes are handled by the `updateGrnStatus` function when a GRN is transitioned to/from a committed state (e.g., `DRAFT` to `COMPLETED`).

### 4.4. Update GRN Status (`PATCH /api/grn/:id/status`)

-   **Purpose**: To change the status of a GRN, which often triggers inventory commitment or reversal.
-   **Inputs (Request Body)**: `new_status`, `tenant_id`.
-   **Database Interactions**:
    1.  `SELECT` from `goods_received_notes` (using `FOR UPDATE`) to get current `status`, `store_id`, `grn_number`, `received_date`, `purchase_order_id`.
    2.  `SELECT` from `grn_items` to get all items associated with the GRN.
    3.  **Logic based on `currentStatus` and `newStatus`**:
        -   **Committing Inventory (e.g., `DRAFT` -> `COMPLETED`)**: For each GRN item:
            -   `products`: `UPDATE` `stock_quantity` (increase), recalculate `weighted_average_cost`, update `last_received_cost_price`, `total_quantity_received`, `last_received_date` (as in `createGrn`).
            -   `inventory_logs`: `INSERT` log for stock increase.
            -   `purchase_order_items` (if linked): `UPDATE` `quantity_received`, `status`.
        -   **Reversing Inventory (e.g., `COMPLETED` -> `DRAFT` or `CANCELLED`)**: For each GRN item:
            -   `products`: `UPDATE` `stock_quantity` (decrease). *Note: WAC is typically not recalculated on simple reversals; this would require more complex accounting adjustments.*
            -   `inventory_logs`: `INSERT` log for stock decrease.
            -   `purchase_order_items` (if linked): `UPDATE` `quantity_received` (decrease), `status`.
    4.  `UPDATE goods_received_notes` to set the `status` to `newStatus`.
    5.  `purchase_orders` (if `purchase_order_id` exists): Call `updatePurchaseOrderStatus` helper to potentially update PO header `status`.

### 4.5. Delete GRN (`DELETE /api/grn/:id`)

-   **Purpose**: To remove a GRN from the system.
-   **Inputs**: `id` (GRN ID in path), `tenant_id` (required query param).
-   **Database Interactions**:
    1.  `SELECT` from `goods_received_notes` (using `FOR UPDATE`) to get current `status`, `store_id`, `grn_number`, `received_date`, `purchase_order_id`.
    2.  **If `status` was `COMPLETED` or `POSTED` (inventory committed)**:
        -   `SELECT` from `grn_items` (using `FOR UPDATE`).
        -   For each GRN item:
            -   `products`: `SELECT` current `stock_quantity` (using `FOR UPDATE`). `UPDATE` `stock_quantity` (decrease by `item.quantity_received`).
            -   `inventory_logs`: `INSERT` log for stock decrease. `reason` indicates GRN deletion, `reference_type` is 'GRN_DELETION_REVERSAL'.
            -   `purchase_order_items` (if linked): `SELECT` current state (using `FOR UPDATE`). `UPDATE` `quantity_received` (decrease), `status`.
        -   `purchase_orders` (if `purchase_order_id` exists): Call `updatePurchaseOrderStatus`.
    3.  **If `status` was `DRAFT` (or other non-committed status)**: No inventory reversal logic is executed for `products` or `inventory_logs` related to stock quantities.
    4.  `DELETE` from `grn_items` where `grn_id` matches.
    5.  `DELETE` from `goods_received_notes` where `id` matches.

## 5. Multi-Tenancy

-   `tenant_id` is a mandatory filter in almost all queries to ensure data segregation and security.
-   `store_id` is often used in conjunction with `tenant_id` for operations specific to a particular store within a tenant.

## 6. Transactions

-   Operations that involve multiple database writes (Create GRN, Update GRN Status, Delete GRN) are wrapped in transactions using `db.withTransaction`. This ensures that all changes are committed together, or none are if an error occurs, maintaining data integrity.

This document provides a detailed overview of the GRN module's interaction with the database. It should serve as a good reference for testing and further development.


## 7. Module Review Findings and Action Plan (June 2025)

A detailed review of the Purchase Order (PO) and Goods Received Note (GRN) modules was conducted in June 2025, focusing on database schema, backend API logic, and frontend implementation. The following key findings and action items were identified:

### 7.1. Key Findings

1.  **`purchase_order_items.item_received_status` Not Maintained:**
    *   **Observation:** The `grnController.js` (specifically the GRN creation and update processes) does not update the `item_received_status` column in the `purchase_order_items` table. This field remains at its default value or its state prior to the GRN.
    *   **Impact:** Any logic relying on `purchase_order_items.item_received_status` to determine an individual PO item's receipt status will likely be incorrect. The system currently appears to derive this by comparing `quantity_ordered` vs. `quantity_received` on the PO item and uses `purchase_orders.received_status` for the overall PO header.

2.  **Purchase Order Item Status on PO Cancellation:**
    *   **Observation:** When a Purchase Order is cancelled (soft delete via `purchaseOrderRoutes.js`), its associated `purchase_order_items` retain their existing statuses (e.g., 'PENDING', 'PARTIALLY_RECEIVED'). Their `status` field is not updated to 'CANCELLED'.
    *   **Impact:** While the PO header status (`CANCELLED`) prevents further processing, the item-level statuses might be misleading if viewed in isolation.

3.  **GRN Over-Receiving Handling:**
    *   **Observation:** The system currently relies on a database `CHECK (quantity_received <= quantity_ordered)` constraint on the `purchase_order_items` table to prevent over-receiving against a PO line.
    *   **Impact:** If a GRN attempts to over-receive, the GRN creation process will fail with a generic database error due to this constraint violation. This may not provide a clear, user-friendly error message.

4.  **Hardcoded Tax Rate in PO Creation UI:**
    *   **Observation:** The `CreatePurchaseOrderModal.tsx` component in the frontend has a hardcoded `taxRate = 0.0` when preparing PO data.
    *   **Impact:** This may be intentional if taxes are handled post-PO or not at the PO stage, but requires clarification.

5.  **`purchase_orders.received_status` Field Visibility in UI:**
    *   **Observation:** The `PurchaseManagementPage.tsx` displays the main `purchase_orders.status` (e.g., 'DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CANCELLED') but does not have a separate column to display the more granular `purchase_orders.received_status` (e.g., 'NOT_RECEIVED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED').
    *   **Note:** This is a UI/UX choice and not necessarily an issue, as the main `status` often conveys sufficient information.

### 7.2. Action Plan & Proposed Fixes

1.  **Address `purchase_order_items.item_received_status` (High Priority - Fix Planned):**
    *   **Plan:** Modify `grnController.js` within the GRN creation/update logic. When processing each GRN item linked to a PO item, explicitly update the corresponding `purchase_order_items.item_received_status`.
    *   The status should be set to 'FULLY_RECEIVED' if `new_total_quantity_received >= quantity_ordered`.
    *   It should be set to 'PARTIALLY_RECEIVED' if `new_total_quantity_received > 0 AND new_total_quantity_received < quantity_ordered`.
    *   It should remain 'NOT_RECEIVED' if `new_total_quantity_received` is 0 (or not updated if already 'NOT_RECEIVED').
    *   This change will ensure the `item_received_status` accurately reflects the state of each PO line item.

2.  **Implement Proactive Over-Receiving Check in GRN (Medium Priority - Fix Planned):**
    *   **Plan:** In `grnController.js`, before attempting to update `purchase_order_items`, iterate through the incoming GRN items. For each item linked to a PO:
        *   Fetch the current `purchase_order_items` record (specifically `quantity_ordered` and current `quantity_received`).
        *   Calculate if the `grn_item.quantity_received + po_item.quantity_received` would exceed `po_item.quantity_ordered`.
        *   If over-receiving is detected for any item, abort the GRN creation/update process for that item (or the entire GRN) and return a specific, user-friendly error message (e.g., "Over-receiving item [Product Name]: Ordered X, Already Received Y, Attempting to Receive Z. Max allowable is X-Y.").

3.  **Clarify/Update PO Item Status on PO Cancellation (Low Priority - Future Consideration):**
    *   **Plan:** Discuss whether `purchase_order_items.status` should be explicitly set to 'CANCELLED' when the parent PO is cancelled. If deemed beneficial for clarity or reporting, update the PO cancellation logic in `purchaseOrderRoutes.js`.

4.  **Clarify Hardcoded Tax Rate (Low Priority - Clarification Needed):**
    *   **Plan:** Confirm with stakeholders if the `taxRate = 0.0` in `CreatePurchaseOrderModal.tsx` is the intended behavior or if tax calculation at the PO creation stage is a future requirement.

### 7.3. Implemented Improvements (June 2025)

1. **Enhanced PO Status Handling for GRN Status Changes (High Priority - Completed):**
   * **Issue:** When a GRN status was changed (e.g., from COMPLETED to DRAFT), only the directly linked PO in the GRN header was being updated. This could leave other POs with items in the GRN in an inconsistent state.
   * **Solution:** Implemented a new helper function `updateAllAffectedPurchaseOrders` that identifies and updates all Purchase Orders affected by a GRN, including:
     * The direct PO linked in the GRN header
     * Any POs associated with individual GRN items through their `purchase_order_item_id`
   * **Implementation:** The helper function is now called during all GRN status changes (inventory commitment, inventory reversal) and GRN deletion, ensuring all affected POs have their statuses properly updated to reflect the correct received quantities.
   * **Benefits:** This improvement maintains data consistency between GRNs and POs, ensuring accurate representation of received status across the system even when GRNs contain items from multiple POs or when GRN statuses change.

2. **Robust Error Handling for Missing Products (High Priority - Completed):**
   * **Issue:** GRN status changes would fail with transaction rollback if any referenced product was missing from the database.
   * **Solution:** Enhanced error handling in the `updateGrnStatus` function to gracefully handle missing products by logging warnings and skipping those specific products instead of failing the entire transaction.
   * **Implementation:** This approach was applied to both inventory reversal (COMPLETED to DRAFT) and inventory commitment (DRAFT to COMPLETED) operations.
   * **Benefits:** The system can now successfully process GRN status changes even if some of the referenced products have been deleted, improving reliability and user experience.

3. **Fixed GRN Creation Status Handling (High Priority - Completed):**
   * **Issue:** The GRN creation function was hardcoding the status to "COMPLETED" regardless of user input.
   * **Solution:** Modified the code to use the status provided in the request body, defaulting to "COMPLETED" only if no status is provided.
   * **Implementation:** Changed from hardcoded status to `req.body.status || 'COMPLETED'` in the `createGrn` function.
   * **Benefits:** GRNs can now be created with any valid status as selected in the UI, respecting user choice and allowing for proper workflow stages.

This section will be updated as fixes are implemented and further decisions are made.
