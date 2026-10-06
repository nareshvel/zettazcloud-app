# Products API Documentation

This document outlines the CRUD API endpoints for managing products.

**Base Path:** `/api/products`

## Authentication

All endpoints require authentication. The client must send an `Authorization` header with a Bearer token:

`Authorization: Bearer <your_jwt_token>`

## Image Uploads

For endpoints that support image uploads (Create and Update), requests must be `multipart/form-data`. The image file should be sent under the field name `image`.

---

## 1. Get All Products

- **Endpoint:** `/`
- **HTTP Method:** `GET`
- **Description:** Retrieves a list of all products for the authenticated user's tenant.
- **Request Format:**
    - **Headers:** `Authorization: Bearer <token>`
- **Response Format (Success - 200 OK):**
    ```json
    {
        "status": "success",
        "results": 2,
        "data": {
            "products": [
                {
                    "id": "prod_uuid_1",
                    "tenant_id": "tenant_uuid",
                    "store_id": "store_uuid_1",
                    "name": "Laptop Pro",
                    "description": "High-performance laptop",
                    "price": 1200.00,
                    "category_id": "cat_uuid_electronics",
                    "category_name": "Electronics",
                    "stock_quantity": 50,
                    "barcode": "123456789012",
                    "sku": "LP-001",
                    "image_url": "tenant_uuid/products/image_filename.webp", // Relative to /uploads/
                    "is_active": true,
                    "tax_class_id": "tax_uuid_standard",
                    "tax_class_name": "Standard Tax",
                    "purchase_price": 800.00,
                    "low_stock_threshold": 10,
                    "reorder_point": 5,
                    "created_by_user_id": "user_uuid_creator",
                    "updated_by_user_id": "user_uuid_updater",
                    "created_at": "2024-05-26T10:00:00.000Z",
                    "updated_at": "2024-05-26T12:00:00.000Z"
                },
                // ... more products
            ]
        }
    }
    ```
- **Response Format (Error):
    - `500 Internal Server Error`:** `{ "message": "Error fetching products", "error": "<error_details>" }`

---

## 2. Get Single Product

- **Endpoint:** `/:id`
- **HTTP Method:** `GET`
- **Description:** Retrieves a single product by its ID for the authenticated user's tenant.
- **Request Format:**
    - **Headers:** `Authorization: Bearer <token>`
    - **URL Parameters:** `id` (string, UUID) - The ID of the product.
- **Response Format (Success - 200 OK):**
    ```json
    {
        "status": "success",
        "data": {
            "product": {
                "id": "prod_uuid_1",
                "tenant_id": "tenant_uuid",
                "store_id": "store_uuid_1",
                "name": "Laptop Pro",
                // ... other fields as in 'Get All Products'
            }
        }
    }
    ```
- **Response Format (Error):
    - `404 Not Found`:** `{ "message": "Product not found or not owned by tenant." }`
    - `500 Internal Server Error`:** `{ "message": "Error fetching product", "error": "<error_details>" }`

---

## 3. Create Product

- **Endpoint:** `/`
- **HTTP Method:** `POST`
- **Description:** Creates a new product for the authenticated user's tenant. Supports image upload.
- **Request Format:** `multipart/form-data`
    - **Headers:** `Authorization: Bearer <token>`
    - **Form Fields:**
        - `name` (string, required): Product name.
        - `price` (number, required): Retail price.
        - `category_id` (string, UUID, required): ID of the category.
        - `stock_quantity` (integer, required): Initial stock quantity.
        - `description` (string, optional): Product description.
        - `barcode` (string, optional): Product barcode.
        - `sku` (string, optional): Stock Keeping Unit.
        - `image` (file, optional): Product image file.
        - `is_active` (boolean, optional, default: `true`): Product status.
        - `tax_class_id` (string, UUID, optional): ID of the tax class.
        - `purchase_price` (number, optional): Cost price.
        - `low_stock_threshold` (integer, optional): Low stock warning threshold.
        - `reorder_point` (integer, optional): Reorder point for inventory.
        - `store_id` (string, UUID, optional): ID of the store this product belongs to.
- **Response Format (Success - 201 Created):**
    ```json
    {
        "status": "success",
        "message": "Product created successfully",
        "data": {
            "product": {
                "id": "prod_new_uuid",
                "tenant_id": "tenant_uuid",
                "store_id": "store_uuid_1",
                "name": "New Gadget",
                // ... other fields, image_url will be populated if image was uploaded
                "image_url": "tenant_uuid/products/new_image.webp", 
                "created_by_user_id": "user_uuid_current",
                "updated_by_user_id": "user_uuid_current",
                "created_at": "2024-05-26T14:00:00.000Z",
                "updated_at": "2024-05-26T14:00:00.000Z"
            }
        }
    }
    ```
- **Response Format (Error):
    - `400 Bad Request`:** `{ "message": "Missing or empty required fields: name, price, category_id, stock_quantity." }` (or other validation errors)
    - `500 Internal Server Error`:** `{ "message": "Error creating product", "error": "<error_details>" }`

---

## 4. Update Product

- **Endpoint:** `/:id`
- **HTTP Method:** `PUT`
- **Description:** Updates an existing product by its ID. Supports image upload (replaces existing image).
- **Request Format:** `multipart/form-data`
    - **Headers:** `Authorization: Bearer <token>`
    - **URL Parameters:** `id` (string, UUID) - The ID of the product to update.
    - **Form Fields:** (Provide only fields to be updated)
        - `name` (string, optional)
        - `description` (string, optional)
        - `price` (number, optional)
        - `category_id` (string, UUID, optional)
        - `stock_quantity` (integer, optional)
        - `barcode` (string, optional)
        - `sku` (string, optional)
        - `image` (file, optional): New product image. If provided, replaces the old one.
        - `is_active` (boolean, optional)
        - `tax_class_id` (string, UUID, optional)
        - `purchase_price` (number, optional)
        - `low_stock_threshold` (integer, optional)
        - `reorder_point` (integer, optional)
        - `store_id` (string, UUID, optional)
- **Response Format (Success - 200 OK):**
    ```json
    {
        "status": "success",
        "message": "Product updated successfully",
        "data": {
            "product": {
                "id": "prod_uuid_1",
                // ... updated fields
                "updated_at": "2024-05-26T15:00:00.000Z",
                "updated_by_user_id": "user_uuid_current"
            }
        }
    }
    ```
- **Response Format (Error):
    - `400 Bad Request`:** `{ "message": "Validation error details..." }`
    - `404 Not Found`:** `{ "message": "Product not found or not owned by tenant." }`
    - `500 Internal Server Error`:** `{ "message": "Error updating product", "error": "<error_details>" }`

---

## 5. Delete Product

- **Endpoint:** `/:id`
- **HTTP Method:** `DELETE`
- **Description:** Deletes a product by its ID. This also attempts to delete the associated image file from storage.
- **Request Format:**
    - **Headers:** `Authorization: Bearer <token>`
    - **URL Parameters:** `id` (string, UUID) - The ID of the product to delete.
- **Response Format (Success - 200 OK):**
    ```json
    {
        "status": "success",
        "message": "Product deleted successfully"
    }
    ```
- **Response Format (Error):
    - `404 Not Found`:** `{ "message": "Product not found or not owned by tenant." }`
    - `500 Internal Server Error`:** `{ "message": "Error deleting product", "error": "<error_details>" }`

---

## 6. Search Products

- **Endpoint:** `/search`
- **HTTP Method:** `GET`
- **Description:** Searches for products by a term (name, SKU, description). Used, for example, in the Stock Adjustment Modal.
- **Request Format:**
    - **Headers:** `Authorization: Bearer <token>`
    - **Query Parameters:**
        - `term` (string, required): The search term.
- **Response Format (Success - 200 OK):**
    ```json
    {
        "status": "success",
        "results": 1,
        "data": {
            "products": [
                {
                    "id": "prod_uuid_search_1",
                    "name": "Searched Laptop",
                    "sku": "SL-001",
                    "stockQuantity": 25,
                    "price": 1100.00,
                    "imageUrl": "tenant_uuid/products/searched_image.webp" // Relative to /uploads/
                }
                // ... other matching products (limit 10)
            ]
        }
    }
    ```
- **Response Format (Error):
    - `400 Bad Request`:** `{ "message": "Search term is required." }`
    - `500 Internal Server Error`:** `{ "message": "Error searching products", "error": "<error_details>" }`

---

## 7. Update Product Stock Level (Partial Update)

- **Endpoint:** `/:id/stock`
- **HTTP Method:** `PATCH`
- **Description:** Updates the stock level of a specific product. This is a partial update focused only on stock quantity.
- **Request Format:**
    - **Headers:** `Authorization: Bearer <token>`
    - **URL Parameters:** `id` (string, UUID) - The ID of the product to update.
    - **Body (JSON):**
        ```json
        {
            "newStockLevel": 75 
        }
        ```
        - `newStockLevel` (integer, required): The new stock quantity for the product.
- **Response Format (Success - 200 OK):**
    ```json
    {
        "status": "success",
        "message": "Product stock level updated successfully",
        "data": {
            "product": {
                "id": "prod_uuid_1",
                "name": "Laptop Pro",
                "stock_quantity": 75,
                // ... other relevant product fields might be returned
                "updated_at": "2024-05-26T16:00:00.000Z"
            }
        }
    }
    ```
- **Response Format (Error):
    - `400 Bad Request`:** If `newStockLevel` is missing or invalid.
    - `404 Not Found`:** `{ "message": "Product not found or not owned by tenant." }`
    - `500 Internal Server Error`:** `{ "message": "Error updating product stock", "error": "<error_details>" }`
