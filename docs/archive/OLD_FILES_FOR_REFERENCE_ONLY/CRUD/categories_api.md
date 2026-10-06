# Categories API Documentation

This document outlines the CRUD API endpoints for managing categories.

**Base Path:** `/api/categories`

## Authentication

All endpoints require authentication. The client must send an `Authorization` header with a Bearer token:

`Authorization: Bearer <your_jwt_token>`

## Image Uploads

For endpoints that support image uploads (Create and Update), requests must be `multipart/form-data`. The image file should be sent under the field name `image`.

---

## 1. Get All Categories

- **Endpoint:** `/`
- **HTTP Method:** `GET`
- **Description:** Retrieves a list of all categories for the authenticated user's tenant. Can be filtered by status.
- **Request Format:**
    - **Headers:** `Authorization: Bearer <token>`
    - **Query Parameters:**
        - `status` (string, optional): Filter categories by status. Values: `active` (default), `inactive`, `all`.
- **Response Format (Success - 200 OK):**
    ```json
    [
        {
            "id": "cat_uuid_1",
            "tenant_id": "tenant_uuid",
            "name": "Electronics",
            "description": "Gadgets and devices",
            "image_url": "tenant_uuid/categories/electronics.webp", // Relative to /uploads/
            "is_active": true,
            "created_at": "2024-05-26T09:00:00.000Z",
            "updated_at": "2024-05-26T09:30:00.000Z",
            "product_count": 15
        },
        // ... more categories
    ]
    ```
- **Response Format (Error):
    - `500 Internal Server Error`:** `{ "message": "Failed to fetch categories", "error": "<error_details>" }`

---

## 2. Create Category

- **Endpoint:** `/`
- **HTTP Method:** `POST`
- **Description:** Creates a new category for the authenticated user's tenant. Supports image upload.
- **Request Format:** `multipart/form-data`
    - **Headers:** `Authorization: Bearer <token>`
    - **Form Fields:**
        - `name` (string, required): Category name.
        - `description` (string, optional): Category description.
        - `image` (file, optional): Category image file.
        - `is_active` (boolean, optional, default: `true`): Category status (though typically set to true on creation by backend).
- **Response Format (Success - 201 Created):**
    ```json
    {
        "status": "success",
        "message": "Category created successfully.",
        "data": {
            "id": "cat_new_uuid",
            "tenant_id": "tenant_uuid",
            "name": "New Category",
            "description": "Description for new category",
            "image_url": "tenant_uuid/categories/new_image.webp", // Populated if image was uploaded
            "is_active": true,
            "created_at": "2024-05-26T14:30:00.000Z",
            "updated_at": "2024-05-26T14:30:00.000Z",
            "created_by_user_id": "user_uuid_current",
            "updated_by_user_id": "user_uuid_current"
        }
    }
    ```
- **Response Format (Error):
    - `400 Bad Request`:** `{ "status": "error", "message": "Category name is required." }`
    - `409 Conflict`:** `{ "status": "error", "message": "A category with this name already exists." }`
    - `500 Internal Server Error`:** `{ "status": "error", "message": "Internal server error while creating category.", "details": "<error_details>" }`

---

## 3. Update Category

- **Endpoint:** `/:id`
- **HTTP Method:** `PUT`
- **Description:** Updates an existing category by its ID. Supports image upload (replaces existing image).
- **Request Format:** `multipart/form-data`
    - **Headers:** `Authorization: Bearer <token>`
    - **URL Parameters:** `id` (string, UUID) - The ID of the category to update.
    - **Form Fields:** (Provide only fields to be updated)
        - `name` (string, optional)
        - `description` (string, optional)
        - `image` (file, optional): New category image. If provided, replaces the old one.
        - `is_active` (boolean, optional)
- **Response Format (Success - 200 OK):**
    ```json
    {
        "status": "success",
        "message": "Category updated successfully.",
        "data": {
            "id": "cat_uuid_1",
            // ... updated fields
            "updated_at": "2024-05-26T15:30:00.000Z",
            "updated_by_user_id": "user_uuid_current"
        }
    }
    ```
- **Response Format (Error):
    - `400 Bad Request`:** `{ "status": "error", "message": "Category ID is required." }` (or other validation errors)
    - `404 Not Found`:** `{ "status": "error", "message": "Category not found or access denied." }` (or if update fails for other reasons)
    - `409 Conflict`:** `{ "status": "error", "message": "A category with this name already exists." }`
    - `500 Internal Server Error`:** `{ "status": "error", "message": "Internal server error while updating category.", "details": "<error_details>" }`

---

## 4. Delete Category

- **Endpoint:** `/:id` (Not yet implemented)
- **HTTP Method:** `DELETE`
- **Description:** (Functionality to delete a category is not currently available in `category.routes.js`.)

