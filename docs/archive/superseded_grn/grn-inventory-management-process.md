# GRN Inventory Management Process

## Overview

This document outlines the inventory management process for Goods Received Notes (GRNs) in the Zettaz Cloud Enterprise system. It covers how inventory is tracked and updated throughout the GRN lifecycle, including creation, editing, status changes, and deletion of GRNs.

## Database Structure

The system uses two primary tables for tracking inventory changes:

### 1. `inventory_logs` Table

This is the primary table for tracking all transaction-based inventory changes:

| Field                      | Description                                                |
|----------------------------|------------------------------------------------------------|
| `id`                       | Unique identifier (UUID)                                   |
| `tenant_id`                | Tenant identifier for multi-tenancy support                |
| `product_id`               | Reference to the product being affected                    |
| `store_id`                 | Store where the inventory change occurred                  |
| `quantity_change`          | Amount changed (positive for increases, negative for decreases) |
| `reference_type`           | Source of the change (e.g., 'GRN_ITEM', 'SALE_ITEM')      |
| `reference_id`             | ID of the source document/item                             |
| `reason`                   | Descriptive text explaining the change                     |
| `current_stock_before_change` | Stock level before this change                          |
| `current_stock_after_change`  | Stock level after this change                           |
| `created_by`               | User who performed the action                              |
| `created_at`               | Timestamp of the change                                    |

### 2. `stock_adjustments` Table

This table is used for manual adjustments not tied to specific transactions:

| Field                    | Description                                                |
|--------------------------|------------------------------------------------------------|
| `id`                     | Unique identifier (UUID)                                   |
| `tenant_id`              | Tenant identifier for multi-tenancy support                |
| `store_id`               | Store where the adjustment occurred                        |
| `product_id`             | Reference to the product being adjusted                    |
| `variant_id`             | For future product variant support                         |
| `user_id`                | User performing the adjustment                             |
| `adjustment_type`        | 'INCREMENT' or 'DECREMENT'                                 |
| `reason_code`            | Categorized reason for adjustment                          |
| `quantity_adjusted`      | Absolute value of quantity changed                         |
| `stock_before_adjustment` | Stock level before adjustment                             |
| `stock_after_adjustment` | Stock level after adjustment                               |
| `notes`                  | Additional information                                     |
| `adjustment_date`        | When the adjustment occurred                               |
| `created_at`             | Record creation timestamp                                  |
| `updated_at`             | Record update timestamp                                    |

## GRN Lifecycle Events and Inventory Management

### 1. GRN Creation

When a new GRN is created:

1. Records are inserted into `goods_received_notes` and `grn_items` tables
2. For each GRN item:
   - Product stock is updated in the `products` table
   - An entry is added to `inventory_logs` with:
     - `reference_type = 'GRN_ITEM'`
     - `reference_id = grn_items.id`
     - `quantity_change = item.quantity_received` (positive value)
     - Before/after stock levels are recorded
   - If the GRN is linked to a purchase order:
     - The purchase order item status is updated
     - If all items are received, the purchase order status is updated

**Implementation Notes:**
- All database operations are performed within a transaction to ensure data integrity
- The WAC (Weighted Average Cost) is recalculated for each product
- The `last_received_date` is updated in the products table

### 2. GRN Editing

When a GRN is edited:

1. Calculate the difference between old and new quantities for each item
2. For each modified item:
   - Update the product stock in the `products` table
   - Add a new entry to `inventory_logs` with:
     - `reference_type = 'GRN_ITEM_EDITED'`
     - `reference_id = grn_items.id`
     - `quantity_change` = net change (positive or negative)
     - Before/after stock levels are recorded
     - Reason includes details of what was changed
   - Update related purchase order items if applicable

**Implementation Notes:**
- The original GRN items should be retrieved before making changes
- The net quantity change should be calculated (new quantity - old quantity)
- WAC should be recalculated based on new costs if applicable

### 3. GRN Status Changes

When a GRN status changes:

#### From DRAFT to COMPLETED
- No inventory impact (inventory is already updated on creation)
- Update the GRN status only

#### From COMPLETED to DRAFT
1. For each GRN item:
   - Reduce the product stock in the `products` table
   - Add a new entry to `inventory_logs` with:
     - `reference_type = 'GRN_ITEM_STATUS_CHANGE'`
     - `reference_id = grn_items.id`
     - `quantity_change = -item.quantity_received` (negative value)
     - Before/after stock levels are recorded
     - Reason includes the status change details
   - Update related purchase order items if applicable

**Implementation Notes:**
- Status changes should be carefully controlled to maintain data integrity
- Consider additional validation before allowing status changes that affect inventory

### 4. GRN Deletion

When a GRN is deleted:

1. For each GRN item:
   - Reduce the product stock in the `products` table
   - Add a new entry to `inventory_logs` with:
     - `reference_type = 'GRN_ITEM_DELETED'`
     - `reference_id = grn_items.id`
     - `quantity_change = -item.quantity_received` (negative value)
     - Before/after stock levels are recorded
     - Reason includes deletion details
   - Update related purchase order items if applicable

**Implementation Notes:**
- Consider implementing soft deletion instead of hard deletion
- Ensure all related records are properly handled

## Reference Type Values

The `reference_type` field in the `inventory_logs` table should use the following values for GRN operations:

| Value                  | Description                                 |
|------------------------|---------------------------------------------|
| `GRN_ITEM`             | Initial receipt of goods through a GRN      |
| `GRN_ITEM_EDITED`      | Modification of a GRN item                  |
| `GRN_ITEM_STATUS_CHANGE` | Change in GRN status affecting inventory  |
| `GRN_ITEM_DELETED`     | Deletion of a GRN                           |

## Transaction Safety

All inventory operations should be wrapped in database transactions to ensure data consistency. If any part of the operation fails, the entire transaction should be rolled back to prevent data inconsistencies.

## Audit and Reporting

The `inventory_logs` table serves as a comprehensive audit trail for all inventory changes. It can be used for:

1. Generating inventory movement reports
2. Tracking product history
3. Investigating discrepancies
4. Reconstructing inventory at any point in time

## Implementation Guidelines

When implementing these processes:

1. Always validate data before processing
2. Use explicit transactions for all operations affecting multiple tables
3. Include detailed information in the `reason` field for better auditing
4. Calculate and store both before and after values for verification
5. Properly handle errors and provide meaningful feedback

## Sequence Diagrams

### GRN Creation Process

```
User                    System                    Database
 |                        |                          |
 |--Create GRN----------->|                          |
 |                        |--Begin Transaction------>|
 |                        |--Insert GRN------------->|
 |                        |--Insert GRN Items------->|
 |                        |--Update Product Stock--->|
 |                        |--Create Inventory Logs-->|
 |                        |--Update PO Status------->|
 |                        |--Commit Transaction----->|
 |<-Success Notification--|                          |
 |                        |                          |
```

### GRN Status Change (COMPLETED to DRAFT)

```
User                    System                    Database
 |                        |                          |
 |--Change GRN Status---->|                          |
 |                        |--Begin Transaction------>|
 |                        |--Get GRN Items---------->|
 |                        |--Update Product Stock--->|
 |                        |--Create Inventory Logs-->|
 |                        |--Update GRN Status------>|
 |                        |--Update PO Status------->|
 |                        |--Commit Transaction----->|
 |<-Success Notification--|                          |
 |                        |                          |
```

## Conclusion

This document outlines the comprehensive approach to inventory management through the GRN lifecycle. Following these processes ensures data integrity, provides a complete audit trail, and enables accurate reporting of inventory movements.
