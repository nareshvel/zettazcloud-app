# Purchase Order (PO) to Goods Received Note (GRN) Workflow

_This document serves as the definitive technical guide for the PO-to-GRN workflow in the Zettaz Cloud application. It outlines the business logic, database interactions, API endpoints, and status transitions involved in the process._

## 1. Overview

The PO-to-GRN workflow is a core inventory management process that begins with the creation of a Purchase Order and concludes with the receipt of goods, recorded via a Goods Received Note. This process directly impacts inventory levels, product costs, and supplier balances.

### Key Stages:

1.  **Purchase Order Creation**: A PO is created with a `DRAFT` status.
2.  **PO Finalization**: The PO is moved to an `ORDERED` status, making it active.
3.  **GRN Creation**: A GRN is created by selecting one or more `ORDERED` or `PARTIALLY_RECEIVED` POs.
4.  **Receiving Goods**: Items from the PO are marked as received on the GRN.
5.  **GRN Completion**: The GRN is marked as `COMPLETED`, which triggers:
    *   Inventory stock level updates.
    *   Weighted Average Cost (WAC) recalculation for products.
    *   PO and PO item status updates (`PARTIALLY_RECEIVED` or `FULLY_RECEIVED`).

---

## 2. Database Schema Analysis

This section details the structure of the primary tables involved in the PO-to-GRN workflow and provides an analysis of their design.

### Table Structures

#### `purchase_orders`
- **Purpose**: Stores the header information for each Purchase Order.
- **Key Columns**: `id`, `tenant_id`, `store_id`, `supplier_id`, `purchase_order_number`, `order_date`, `status`, `received_status`.
- **Analysis**: The presence of both `status` and `received_status` is redundant. The `received_status` can be derived from `status`, creating a risk of data inconsistency. **Recommendation: Remove `received_status`**.

#### `purchase_order_items`
- **Purpose**: Stores the individual line items for each Purchase Order.
- **Key Columns**: `id`, `purchase_order_id`, `product_id`, `quantity_ordered`, `quantity_received`, `item_received_status`.
- **Analysis**: The `item_received_status` is redundant. It can be calculated by comparing `quantity_ordered` and `quantity_received`. **Recommendation: Remove `item_received_status`**.

#### `goods_received_notes`
- **Purpose**: Stores the header information for each Goods Received Note.
- **Key Columns**: `id`, `tenant_id`, `store_id`, `supplier_id`, `grn_number`, `status`.
- **Analysis**: The schema is well-designed with a clear and necessary `status` column (`DRAFT`, `COMPLETED`, `CANCELLED`). No issues found.

#### `grn_items`
- **Purpose**: Stores the individual line items for each GRN.
- **Key Columns**: `id`, `grn_id`, `product_id`, `purchase_order_item_id`, `quantity_ordered`, `quantity_received`.
- **Analysis**: The `quantity_ordered` column is redundant. The authoritative source for the ordered quantity is the `purchase_order_items` table. Storing it here can lead to data conflicts. **Recommendation: Remove `quantity_ordered`**.

## 3. Status Update Logic

This section details the precise flow of status transitions for both Purchase Orders and Goods Received Notes. The logic is now driven by transactional data rather than redundant status fields.

### Purchase Order (`purchase_orders`)

1.  **Creation**: A PO is created with a `status` of **`DRAFT`**.
    *   At this stage, it is not yet an official order and can be edited freely.

2.  **Finalization**: When the user finalizes the PO, its `status` changes to **`ORDERED`**.
    *   The PO is now considered active and can be selected for a GRN.
    *   The concept of a `received_status` no longer exists. The received state is determined dynamically.

3.  **Receiving (GRN Completion)**: When a GRN linked to the PO is marked as `COMPLETED`:
    *   The backend calculates the total `quantity_received` for all items on the PO by summing the quantities from all *completed* GRNs.
    *   It then compares the total `quantity_received` against the `quantity_ordered` for every line item.
    *   If **all** items are fully received, the PO `status` is updated to **`FULLY_RECEIVED`**.
    *   If **at least one** item has been received (but not all), the PO `status` is updated to **`PARTIALLY_RECEIVED`**.

### Purchase Order Items (`purchase_order_items`)

1.  **Creation**: An item is created with a `status` of **`PENDING`** (or similar initial state).

2.  **Receiving (GRN Completion)**: When a GRN containing the PO item is `COMPLETED`:
    *   The `quantity_received` on the `purchase_order_items` table is updated to reflect the new total quantity received for that item across all GRNs.
    *   The item's `status` is recalculated:
        *   If `quantity_received` >= `quantity_ordered`, the `status` becomes **`FULLY_RECEIVED`**.
        *   If `quantity_received` > 0 but < `quantity_ordered`, the `status` becomes **`PARTIALLY_RECEIVED`**.

### Goods Received Note (`goods_received_notes`)

1.  **Creation**: A GRN is created with a `status` of **`DRAFT`**.
    *   In this state, it does not affect inventory or PO statuses.

2.  **Completion**: When the user confirms the receipt of goods, the GRN `status` is updated to **`COMPLETED`**.
    *   This is the trigger for all major updates:
        *   Inventory stock levels are increased.
        *   Product costs (WAC) are recalculated.
        *   The statuses of the associated POs and PO items are updated as described above.

3.  **Cancellation**: A `DRAFT` GRN can be moved to a `status` of **`CANCELLED`**, which has no impact on inventory or POs.
