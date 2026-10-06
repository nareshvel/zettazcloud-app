# Frontend API Usage Documentation

This document outlines where and how the backend Product and Category APIs are utilized within the frontend application (`frontend/src/`).

## Overview

API interactions in the frontend are primarily managed through service layers and sometimes directly within components.

- **Product APIs (`/api/products`):** Mostly centralized in `services/productService.ts` and `services/api.ts`.
- **Category APIs (`/api/categories`):** Calls are found in `services/api.ts` and directly within `components/categories/CategoryManagementModal.tsx` using `axiosInstance`.

---

## 1. Product API Usage

**Base Path:** `/api/products`

### 1.1. Service Files:

- **`frontend/src/services/productService.ts`:**
    - `fetchProducts()`: Uses `GET /api/products` to retrieve all products.
    - `createProduct()`: Uses `POST /api/products` for new product creation (handles `multipart/form-data` for image uploads).
    - `updateProduct()`: Uses `PUT /api/products/:productId` for updating products (handles `multipart/form-data` for image uploads).
    - `deleteProductById()`: Uses `DELETE /api/products/:productId` for deleting products.
    - `searchProducts()`: Uses `GET /api/products/search?term=<term>&tenantId=<id>` for product lookups.

- **`frontend/src/services/api.ts`:** (Contains similar or potentially older/alternative product service functions)
    - `getProducts()`: Uses `GET /api/products`.
    - `createProduct()`: Uses `POST /api/products`.
    - `updateProduct()`: Uses `PUT /api/products/:id`.
    - `deleteProduct()`: Uses `DELETE /api/products/:id`.
    - `updateProductStockLevel()`: Uses `PATCH /api/products/:id/stock` (JSON body: `{ "newStockLevel": <number> }`) for quick stock adjustments.

### 1.2. Component Usage (Assumed & Identified):

- **`ProductsPage.tsx` (e.g., `frontend/src/pages/ProductsPage.tsx` or similar):
    - **Displaying Products:** Likely calls `productService.fetchProducts()` or `api.getProducts()`.
    - **Deleting Products:** Uses `productService.deleteProductById()` or `api.deleteProduct()`.
    - **Create/Update Modals:** Triggers modals for product creation and updates. These modals would then use the respective service functions (`createProduct`, `updateProduct`).

- **Product Form Modal (e.g., a component like `ProductFormModal.tsx` or integrated within `ProductsPage.tsx`):
    - **Creating Products:** Calls `productService.createProduct()` or `api.createProduct()`.
    - **Updating Products:** Calls `productService.updateProduct()` or `api.updateProduct()`.

- **`StockAdjustmentModal.tsx` (e.g., `frontend/src/components/stock/StockAdjustmentModal.tsx`):
    - **Searching Products:** Calls `productService.searchProducts()` to find products for adjustment.
    - **Updating Stock:** After an adjustment, likely calls `api.updateProductStockLevel()` to update the stock quantity on the backend.

- **`POSScreen.tsx` (e.g., `frontend/src/pages/POSScreen.tsx` or similar):
    - **Fetching/Searching Products:** May use `productService.fetchProducts()` or `productService.searchProducts()` to add products to a transaction.
    - **Stock Impact:** Sales transactions will inherently reduce stock. While this might be handled by a separate sales/order API, direct stock updates for discrepancies might use `api.updateProductStockLevel()`.

---

## 2. Category API Usage

**Base Path:** `/api/categories`

### 2.1. Service Files:

- **`frontend/src/services/api.ts`:**
    - `getCategories(status?: string)`: Uses `GET /api/categories` (or `GET /api/categories?status=<status>`) to fetch categories, allowing filtering by status (`active`, `inactive`, `all`).

### 2.2. Component Usage (Identified):

- **`CategoriesPage.tsx` or similar (e.g., a page for managing categories):
    - **Displaying Categories:** Likely calls `api.getCategories()` to list categories.
    - **Triggering Management Modal:** Opens `CategoryManagementModal.tsx` for creating or editing categories.

- **`frontend/src/components/categories/CategoryManagementModal.tsx`:**
    - **Creating Categories:** Directly calls `POST /api/categories` using `axiosInstance.post()` (handles `multipart/form-data` for image uploads).
    - **Updating Categories:** Directly calls `PUT /api/categories/:id` using `axiosInstance.put()` (handles `multipart/form-data` for image uploads).
    - **Activating/Deactivating Categories:** Makes `PUT` requests to `/api/categories/:id` with a body like `{ "is_active": <boolean> }` to change the category's active status.

---

This documentation should help in understanding the flow of data between the frontend and backend for product and category management. For specific implementation details, refer to the mentioned source files.
