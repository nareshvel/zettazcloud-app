# GRN Module - Complete Operations Specification

## Overview
This document defines the complete specification for all GRN operations, database impacts, and implementation requirements. Every possible user action is mapped to specific database changes and business logic.

## 5 Core User Actions

### 1. **Create GRN as DRAFT → Change to COMPLETED**
### 2. **Create GRN as COMPLETED (Direct)**
### 3. **Change GRN from COMPLETED → DRAFT (Reversal)**
### 4. **Make changes in DRAFT → Update as COMPLETED**
### 5. **Delete GRN (from DRAFT or COMPLETED status)**

---

## Database Tables Impacted

### Core Tables:
- `goods_received_notes` (GRN header)
- `grn_items` (GRN line items) - **Updated with purchase_order_id column**
- `products` (inventory levels, costs)
- `inventory_logs` (audit trail)
- `purchase_orders` (PO status)
- `purchase_order_items` (PO item status, received quantities)

### Schema Design for Mixed GRNs:

#### **grn_items Table Structure:**
- `purchase_order_id` - Direct PO reference at item level (NEW)
- `purchase_order_item_id` - Specific PO item reference
- Both fields can be NULL for manual items

#### **goods_received_notes Table:**
- `purchase_order_id` - Set for pure PO GRNs, NULL for mixed/manual GRNs

---

## Detailed Operation Specifications

### **Operation 1: Create GRN as DRAFT → Change to COMPLETED**

#### Phase A: Create as DRAFT
**Database Changes:**
- `goods_received_notes`: Insert with `status = 'DRAFT'`
- `grn_items`: Insert all items
- **NO changes to**: `products`, `inventory_logs`, `purchase_orders`, `purchase_order_items`

#### Phase B: Change DRAFT → COMPLETED
**Database Changes:**
1. **goods_received_notes**: Update `status = 'COMPLETED'`
2. **products** (for each item):
   - `stock_quantity += quantity_received`
   - `total_quantity_received += quantity_received`
   - `last_received_cost_price = unit_cost_price`
   - `last_received_date = received_date`
   - `weighted_average_cost = calculated_wac`
   - `updated_by_user_id = current_user_id`
3. **inventory_logs** (for each item):
   - Create log with `quantity_change = +quantity_received`
   - `reference_type = 'GRN_COMPLETION'`
   - `reference_id = grn_id`
4. **purchase_order_items** (if linked to PO):
   - `quantity_received += quantity_received`
   - Update `status` based on received vs ordered quantities
5. **purchase_orders** (if linked):
   - Update `status` based on all item statuses
   - `last_grn_date = received_date`

---

### **Operation 2: Create GRN as COMPLETED (Direct)**

**Database Changes:** (Same as Operation 1 Phase A + Phase B combined)
1. **goods_received_notes**: Insert with `status = 'COMPLETED'`
2. **grn_items**: Insert all items
3. **products**: All updates from Phase B above
4. **inventory_logs**: All updates from Phase B above
5. **purchase_order_items**: All updates from Phase B above
6. **purchase_orders**: All updates from Phase B above

---

### **Operation 3: Change GRN from COMPLETED → DRAFT (Reversal)**

**Database Changes:**
1. **goods_received_notes**: Update `status = 'DRAFT'`
2. **products** (for each item):
   - `stock_quantity -= quantity_received`
   - `total_quantity_received -= quantity_received`
   - Recalculate `weighted_average_cost` (remove this receipt)
   - `updated_by_user_id = current_user_id`
3. **inventory_logs** (for each item):
   - Create reversal log with `quantity_change = -quantity_received`
   - `reference_type = 'GRN_REVERSAL'`
   - `reference_id = grn_id`
4. **purchase_order_items** (if linked to PO):
   - `quantity_received -= quantity_received`
   - Update `status` based on new received vs ordered quantities
5. **purchase_orders** (if linked):
   - Update `status` based on all item statuses
   - Recalculate `last_grn_date` from remaining GRNs

---

### **Operation 4: Make changes in DRAFT → Update as COMPLETED**

#### Phase A: Update DRAFT GRN
**Database Changes:**
- `goods_received_notes`: Update header fields
- `grn_items`: Delete old items, insert new items
- **NO changes to**: `products`, `inventory_logs`, `purchase_orders`, `purchase_order_items`

#### Phase B: Change DRAFT → COMPLETED
**Database Changes:** (Same as Operation 1 Phase B)

---

### **Operation 5: Delete GRN (from DRAFT or COMPLETED)**

#### If GRN is DRAFT:
**Database Changes:**
- `grn_items`: Delete all items
- `goods_received_notes`: Delete GRN
- **NO changes to**: `products`, `inventory_logs`, `purchase_orders`, `purchase_order_items`

#### If GRN is COMPLETED:
**Database Changes:**
1. **Reversal Logic** (same as Operation 3):
   - `products`: Reverse all inventory/cost changes
   - `inventory_logs`: Create reversal entries
   - `purchase_order_items`: Reverse received quantities and status
   - `purchase_orders`: Recalculate status
2. **Deletion**:
   - `grn_items`: Delete all items
   - `goods_received_notes`: Delete GRN

---

## GRN Types and Database Logic

### **1. Pure PO GRN (All items from same PO)**
**Database Values:**
- `goods_received_notes.purchase_order_id` = PO ID
- `grn_items.purchase_order_id` = PO ID (for all items)
- `grn_items.purchase_order_item_id` = PO Item ID (for all items)

**Business Logic:**
- All items are PO-linked
- Subject to over-receiving validation
- Triggers PO status updates
- GRN header linked to single PO

### **2. Mixed GRN (Items from multiple POs + manual)**
**Database Values:**
- `goods_received_notes.purchase_order_id` = NULL
- `grn_items.purchase_order_id` = PO ID (for PO items) OR NULL (for manual items)
- `grn_items.purchase_order_item_id` = PO Item ID (for PO items) OR NULL (for manual items)

**Business Logic:**
- Some items are PO-linked, some are manual
- PO items: subject to over-receiving validation
- Manual items: no PO validation
- Triggers PO status updates for linked items only
- GRN header not linked to any single PO

### **3. Manual GRN (No PO items)**
**Database Values:**
- `goods_received_notes.purchase_order_id` = NULL
- `grn_items.purchase_order_id` = NULL (for all items)
- `grn_items.purchase_order_item_id` = NULL (for all items)

**Business Logic:**
- All items are manually added
- No over-receiving validation
- No PO status updates
- Pure inventory receipt without PO context

### **Item-Level Processing Logic:**
```javascript
// For each GRN item during operations:
if (item.purchase_order_item_id && item.purchase_order_id) {
  // PO-linked item: update PO tables, validate over-receiving
  await updatePurchaseOrderItem(item);
} else {
  // Manual item: inventory only, no PO updates
  // Only update products and inventory_logs tables
}
```

---

## Status Transition Rules

### Valid Status Transitions:
- `DRAFT → COMPLETED` ✅
- `COMPLETED → DRAFT` ✅
- `DRAFT → CANCELLED` ✅
- `COMPLETED → CANCELLED` ✅

### Invalid Transitions:
- `CANCELLED → any other status` ❌

---

## Validation Rules

### Over-Receiving Prevention:
- For PO-linked items: `quantity_received ≤ (quantity_ordered - previous_quantity_received)`
- For manual items: No validation

### Stock Reversal Validation:
- When reversing COMPLETED → DRAFT: Ensure `current_stock ≥ quantity_to_reverse`

### Required Fields by Status:
- **DRAFT**: Basic fields only
- **COMPLETED**: Must have `supplier_invoice_number`, `supplier_invoice_date`

---

## Error Handling

### Transaction Safety:
- All operations must be wrapped in database transactions
- Rollback on any failure
- Atomic operations for multi-table updates

### Validation Failures:
- Clear error messages for business rule violations
- No partial updates on validation failure

---

## Implementation Checklist

### Backend Routes Required:
- [ ] `POST /api/grn` - Create GRN (DRAFT or COMPLETED)
- [ ] `PUT /api/grn/:id` - Update GRN (DRAFT only)
- [ ] `PATCH /api/grn/:id/status` - Change GRN status
- [ ] `DELETE /api/grn/:id` - Delete GRN (with reversal if needed)

### Backend Functions Required:
- [ ] `createGrn()` - Handle Operations 1A, 2
- [ ] `updateGrn()` - Handle Operation 4A
- [ ] `updateGrnStatus()` - Handle Operations 1B, 3
- [ ] `deleteGrn()` - Handle Operation 5
- [ ] `commitInventory()` - Products/inventory updates
- [ ] `reverseInventory()` - Inventory reversal logic
- [ ] `updatePurchaseOrderStatus()` - PO status management

### Frontend Components Required:
- [ ] GRN creation modal (supports all item types)
- [ ] GRN edit modal (DRAFT only)
- [ ] Status change confirmation dialogs
- [ ] Delete confirmation with reversal warning

---

## Testing Scenarios

### Must Test All Combinations:
1. **PO-linked GRN**: All 5 operations
2. **Manual GRN**: All 5 operations  
3. **Mixed GRN**: All 5 operations
4. **Edge Cases**: Over-receiving, insufficient stock for reversal
5. **Error Cases**: Network failures, validation errors

---

This specification ensures every user action has clearly defined database impacts and implementation requirements.
