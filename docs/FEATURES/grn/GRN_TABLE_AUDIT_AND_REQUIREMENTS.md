# GRN/PO Workflow - Complete Table Audit and Update Requirements

## Overview
This document provides a comprehensive audit of all tables impacted by the GRN/PO workflow and specifies exactly what needs to be updated during GRN creation, completion, cancellation, and deletion operations.

## Tables Impacted by GRN/PO Workflow

### 1. **products** Table
**Columns that need updates:**
- `stock_quantity` - Current inventory level
- `total_quantity_received` - Cumulative quantity received from all GRNs
- `last_received_cost_price` - Most recent cost price from GRN
- `weighted_average_cost` - Calculated weighted average cost
- `last_received_date` - Date of last GRN receipt
- `cost_price` - Current cost price (may be updated based on business logic)

**Update Logic:**
- **GRN Creation (DRAFT)**: No updates to products table
- **GRN Completion (DRAFT → COMPLETED)**: 
  - `stock_quantity` += `quantity_received`
  - `total_quantity_received` += `quantity_received`
  - `last_received_cost_price` = `unit_cost_price` from GRN item
  - `last_received_date` = GRN `received_date`
  - `weighted_average_cost` = Calculate based on existing stock and new receipt
  - `cost_price` = Update if business rule requires (e.g., use latest cost)
- **GRN Cancellation/Deletion (COMPLETED → CANCELLED/DELETED)**:
  - Reverse all the above changes
  - Recalculate `weighted_average_cost` without the cancelled quantities

### 2. **inventory_logs** Table
**Purpose**: Track all inventory movements for audit trail

**Update Logic:**
- **GRN Completion**: Create log entry for each product
  - `quantity_change` = `+quantity_received`
  - `reference_type` = 'GRN'
  - `reference_id` = GRN ID
  - `reason` = 'Goods received from supplier'
  - `current_stock_before_change` = Previous stock quantity
  - `current_stock_after_change` = New stock quantity
- **GRN Cancellation/Deletion**: Create reversal log entry
  - `quantity_change` = `-quantity_received`
  - `reference_type` = 'GRN_REVERSAL'
  - `reason` = 'GRN cancelled/deleted'

### 3. **purchase_orders** Table
**Columns that need updates:**
- `status` - Overall PO status based on item completion
- `last_grn_date` - Date of most recent GRN against this PO

**Status Logic:**
- `DRAFT` - PO not yet ordered
- `ORDERED` - PO sent to supplier, no items received
- `PARTIALLY_RECEIVED` - Some items received, some pending
- `RECEIVED` - All items fully received
- `CANCELLED` - PO cancelled

**Update Logic:**
- **GRN Creation/Completion**: 
  - Calculate new status based on all PO items' received quantities
  - Update `last_grn_date` = GRN `received_date`
- **GRN Cancellation/Deletion**: 
  - Recalculate status based on remaining received quantities

### 4. **purchase_order_items** Table
**Columns that need updates:**
- `quantity_received` - Total quantity received for this PO item
- `status` - Individual item status
- `remaining_quantity` - Auto-calculated (quantity_ordered - quantity_received)

**Status Logic:**
- `NOT_RECEIVED` - No quantity received yet
- `PARTIALLY_RECEIVED` - Some quantity received, but less than ordered
- `FULLY_RECEIVED` - Received quantity >= ordered quantity

**Update Logic:**
- **GRN Creation/Completion**: 
  - `quantity_received` += GRN item `quantity_received`
  - Update `status` based on received vs ordered quantities
- **GRN Cancellation/Deletion**: 
  - `quantity_received` -= GRN item `quantity_received`
  - Recalculate `status`

### 5. **goods_received_notes** Table
**Columns that need updates:**
- `status` - GRN workflow status
- `total_received_value` - Calculated total value
- `grand_total` - Auto-calculated total including taxes and charges

**Status Logic:**
- `DRAFT` - GRN created but not committed to inventory
- `COMPLETED` - GRN committed, inventory updated
- `CANCELLED` - GRN cancelled, inventory reversed

### 6. **grn_items** Table
**Columns that need updates:**
- All fields are set during creation
- `line_total`, `tax_amount`, `line_total_with_tax` are auto-calculated
- No updates needed after creation (items are immutable once GRN is completed)

## Additional Tables to Consider

### 7. **suppliers** Table
**Potential Updates:**
- `last_order_date` - Could be updated when PO is created
- `last_delivery_date` - Could be updated when GRN is completed
- **Note**: Check if these columns exist and if business logic requires updates

### 8. **stores** Table
**Settings that affect GRN logic:**
- `allow_over_receiving` - Controls whether quantities can exceed PO amounts
- **Note**: This is read-only for GRN logic, no updates needed

## Critical Business Rules

### 1. **Over-Receiving Control**
- Check `stores.allow_over_receiving` setting
- If `false`: Prevent receiving more than ordered quantity
- If `true`: Allow over-receiving with appropriate warnings

### 2. **Weighted Average Cost Calculation**
```
New WAC = (Current Stock Value + New Receipt Value) / (Current Stock + New Quantity)
Where:
- Current Stock Value = current_stock * current_weighted_average_cost
- New Receipt Value = quantity_received * unit_cost_price
```

### 3. **Status Transition Rules**
- **PO Status**: Based on ALL items in the PO
- **PO Item Status**: Based on individual item quantities
- **GRN Status**: Controls whether inventory is committed

### 4. **Reversal Logic**
- **GRN Cancellation**: Must reverse all inventory, cost, and status changes
- **Data Integrity**: Ensure no negative stock quantities after reversal
- **Audit Trail**: Maintain complete log of all changes and reversals

## Implementation Priority

### Phase 1: Core GRN Operations
1. ✅ GRN Creation (DRAFT status)
2. ✅ GRN Completion (DRAFT → COMPLETED with inventory updates)
3. ✅ PO/PO Item status updates based on received quantities

### Phase 2: Advanced Features
1. GRN Cancellation (COMPLETED → CANCELLED with inventory reversal)
2. GRN Deletion with complete data cleanup
3. Weighted average cost calculation
4. Over-receiving validation and controls

### Phase 3: Audit and Reporting
1. Complete inventory log tracking
2. Comprehensive audit trails
3. Reporting and analytics on receiving patterns

## Current Status
- **GRN Creation**: ✅ Working (authentication fixed)
- **PO Item quantity_received**: ✅ Updating correctly
- **PO/PO Item status updates**: ❌ Not working - needs debugging
- **Inventory updates**: ❌ Not implemented
- **Inventory logs**: ❌ Not implemented
- **Reversal logic**: ❌ Not implemented

## Next Steps
1. Debug and fix PO/PO Item status update logic
2. Implement inventory updates (products table)
3. Implement inventory logging
4. Add reversal logic for cancellation/deletion
5. Add weighted average cost calculation
6. Add over-receiving validation
