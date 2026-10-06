**Goods Received Notes (GRN) Module Review and Implementation Guide**

---

### **1. Objective**

To review and validate the current implementation of the Goods Received Notes (GRN) module and ensure it conforms to expected business processes, maintains data integrity, and supports operational workflows. This guide will help identify gaps, improve logic, and refine the code as needed.

---

### **2. GRN Module Overview**

The GRN module facilitates the recording and processing of received goods from suppliers. It supports creation of GRNs:

* Fully from existing Purchase Orders (POs)
* Partially from POs with additional manual entries
* Entirely through manual data entry

**Status Options:**

* **DRAFT**: Actions allowed - View, Edit, Print, Delete
* **COMPLETED**: Actions allowed - View, Change to Draft, Print, Delete (Edit disabled)

---

### **3. Functional Scenarios**

#### **3.1 Create GRN as Draft**

* Insert a record into `goods_received_notes`
* Insert line items into `grn_items`
* Enable item selection from POs

  * Validate item quantities do not exceed `purchase_order_items.remaining_quantity`
  * Exception: If `stores.allow_over_receiving = true`, show a warning and optionally track over-received amount
  * Store a flag `is_over_received` and optionally `over_received_quantity` for audit

#### **3.2 Edit Draft GRN**

* Update GRN header and item details in `goods_received_notes` and `grn_items`
* Permit adding new items or modifying existing ones
* Maintain PO item references where applicable

#### **3.3 Convert GRN from Draft to Completed**

* Set GRN status to COMPLETED
* Update item quantities and financial values
* Lock `products` rows during update to avoid race conditions
* Sync changes with:

  * `purchase_order_items.quantity_received`
  * `purchase_orders.received_status`, `last_grn_date`
  * `inventory_logs`: Log quantity changes with stock snapshots
  * `products` table:

    * Increment `stock_quantity`, `total_quantity_received`
    * Update `last_received_date`, `last_received_cost_price`
    * Recalculate `weighted_average_cost`:

      ```
      new_weighted_cost = ((old_qty * old_cost) + (new_qty * new_cost)) / (old_qty + new_qty)
      ```

      * Protect against divide-by-zero

#### **3.4 Create GRN as Completed**

* Execute same updates and validations as in 3.3
* Enforce backend/API lock on status and data
* Add `locked_at` and `locked_by_user_id` for traceability

#### **3.5 Change GRN from Completed to Draft**

* Revert inventory and PO updates:

  * Decrease `products.stock_quantity` and `total_quantity_received`
  * Adjust `purchase_order_items.quantity_received`
  * Mark affected `inventory_logs` as reversed or remove them
  * Maintain rollback traceability with `is_reversed` flag or rollback journal
* Update GRN status to DRAFT

#### **3.6 Delete GRN**

* If DRAFT: Delete entries from `goods_received_notes` and `grn_items`
* If COMPLETED:

  * Reverse inventory, PO, and log updates as in 3.5
  * Delete GRN record and associated items
  * Prevent duplicate GRN creation by enforcing unique `grn_number` + `store_id`

---

### **4. Validation Rules**

* PO-derived items must not exceed `remaining_quantity` unless `allow_over_receiving = true`
* Accurate tax and total calculations are mandatory
* Inventory logs must reflect before/after quantity states
* Editing completed GRNs must be disabled
* Manual entries must honor pricing and quantity rules
* Warn user on over-receiving even if allowed
* Expiry dates must be future-dated
* Prevent batch number duplicates within same GRN

---

### **5. Affected Database Tables**

* `goods_received_notes`
* `grn_items`
* `purchase_orders`
* `purchase_order_items`
* `products`
* `inventory_logs`
* Reference: `stores.allow_over_receiving`

---

### **6. AI Agent Review Steps**

**Review:**

* Confirm proper handling of status transitions (DRAFT → COMPLETED and vice versa)
* Validate quantity and over-receiving checks
* Inspect inventory update and rollback accuracy
* Review financial calculations on line items and GRN total
* Validate weighted average cost updates on `products`
* Check UI enforcement for action permissions based on GRN status
* Confirm database relationships and integrity are maintained
* Ensure uniqueness of `grn_number` + `store_id`
* Check stock locking logic to prevent race conditions
* Validate expiry date and batch control where applicable

**Refine:**

* Improve transactional consistency for multi-table updates
* Refactor services or controllers handling GRN logic
* Create or enhance unit and integration tests for each flow
* Suggest schema indexes for frequently accessed keys (e.g., `product_id`, `grn_id`, `purchase_order_id`)
* Add `is_reversed` or rollback tracking flags for audit consistency
* Add optional `validation_status` for DRAFT GRNs to help identify incomplete entries

---

### **7. Final Notes**

Ensure:

* Business workflows are respected
* Inventory and financial data are accurate
* System feedback is intuitive for the end-user
* GRN logic supports traceability, integrity, and rollback

This document can be used by developers, QA engineers, and product stakeholders to align on expectations and implementation completeness.
