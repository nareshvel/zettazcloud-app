# Purchase Module Implementation Plan

## 1. Objective

To design and implement a purchase module that allows the business to efficiently manage the procurement of products from suppliers. This includes creating purchase orders, tracking ordered items, managing costs, and laying the groundwork for inventory updates upon receipt of goods.

## 2. Phased Approach

The implementation will be done in phases to ensure manageable development cycles and iterative improvements.

### Phase 1: Core Purchase Functionality

This phase focuses on establishing the foundational elements required to create and track purchase orders.

#### 2.1. Database Schema (Completed)

The following tables have been added to the database (`digitpulse_zcloud_v2.sql`):

*   **`purchase_orders`**
    *   **Purpose:** Stores header information for each purchase order.
    *   **Key Fields:** `id`, `tenant_id`, `store_id`, `supplier_id`, `purchase_order_number`, `order_date`, `expected_delivery_date`, `status`, `total_amount`, `notes`, `created_by_user_id`, `updated_by_user_id`.
*   **`purchase_order_items`**
    *   **Purpose:** Stores line item details for each product within a purchase order.
    *   **Key Fields:** `id`, `purchase_order_id`, `product_id`, `quantity_ordered`, `cost_price`, `quantity_received`, `line_total`.

#### 2.2. Core Backend APIs

Development of RESTful API endpoints to manage purchase orders and their items:

*   **Purchase Orders (`/api/purchase-orders`)**
    *   `POST /`: Create a new purchase order.
    *   `GET /`: List all purchase orders (with filtering/pagination).
    *   `GET /{id}`: Retrieve a specific purchase order by its ID.
    *   `PUT /{id}`: Update an existing purchase order (e.g., status, notes, expected delivery date).
    *   `DELETE /{id}`: Cancel/delete a purchase order (consider soft delete or status change).
*   **Purchase Order Items (`/api/purchase-orders/{po_id}/items`)**
    *   `POST /`: Add a new item to a purchase order.
    *   `GET /`: List items for a specific purchase order.
    *   `PUT /{item_id}`: Update an item in a purchase order (e.g., quantity, cost price if allowed before ordering).
    *   `DELETE /{item_id}`: Remove an item from a purchase order.

#### 2.3. Basic User Interface (High-Level Goals)

Initial UI components to interact with the purchase module:

*   **Purchase Order Creation Form:** Allows users to select a supplier, add products, specify quantities, and input cost prices.
*   **Purchase Orders List View:** Displays a table of existing purchase orders with key details (PO number, supplier, date, status, total).
*   **Purchase Order Detail View:** Shows all information for a single purchase order, including its line items.

### Phase 2: Enhancements (Future To-Do)

Once the core functionality is stable, the following enhancements can be prioritized:

*   **`ProductSuppliers` Junction Table:**
    *   Implement a many-to-many relationship between `products` and `suppliers`.
    *   Store supplier-specific product codes and default cost prices.
    *   Use this table to populate product selection lists when creating POs for a specific supplier.
*   **Detailed Goods Receiving Process:**
    *   Implement a system for recording received quantities against purchase order items, potentially with Goods Received Notes (GRNs).
    *   Handle partial receipts and backorders.
*   **Automated Stock Updates:**
    *   Develop logic to automatically update `products.stock_quantity` when goods are marked as received.
*   **Supplier Invoices and Payments:**
    *   Link purchase orders to supplier invoices.
    *   Track payment status against supplier invoices.
*   **Returns to Suppliers:**
    *   Functionality to manage the return of goods to suppliers.
*   **Reporting and Analytics:**
    *   Develop reports for purchase history, supplier performance, cost analysis, etc.

## 3. Technology Stack

*   **Backend:** Node.js, Express.js (as per existing backend structure)
*   **Database:** MySQL (as per `digitpulse_zcloud_v2.sql`)
*   **Frontend:** React, TypeScript (as per existing frontend structure)

## 4. Next Steps (Implementation Start)

Begin with the backend API development for Phase 1, starting with the CRUD operations for `purchase_orders`.
