# API Reference

This section contains comprehensive documentation for the Zettaz Cloud Enterprise API, which serves as the backbone for communication between the frontend and backend systems.

## Overview

The Zettaz Cloud Enterprise API is a RESTful API built on Node.js and Express.js. It provides endpoints for all core business functions, including inventory management, sales processing, purchase orders, and user management.

## API Design Principles

The API follows these key design principles:

1. **RESTful Architecture**: Resources are represented as URLs, and standard HTTP methods (GET, POST, PUT, DELETE) are used for operations.

2. **JSON Data Format**: All requests and responses use JSON for data serialization.

3. **Multi-tenancy**: All endpoints enforce tenant isolation through `tenant_id` filtering.

4. **Authentication**: JWT-based authentication is required for all endpoints except authentication endpoints.

5. **Role-Based Access Control**: Endpoints enforce permissions based on user roles.

6. **Consistent Error Handling**: Standardized error responses with appropriate HTTP status codes.

7. **Pagination**: List endpoints support pagination for large result sets.

## Base URL

```
https://api.zettazcloud.com/v1
```

For local development:

```
http://localhost:3000/api
```

## Authentication

All API requests (except the authentication endpoints) require a valid JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

See the [Authentication](../7-authentication/README.md) section for details on obtaining and using tokens.

## Common Request Headers

| Header | Description |
|--------|-------------|
| `Content-Type` | Should be set to `application/json` for requests with a body |
| `Authorization` | JWT token for authentication |
| `Accept-Language` | Optional language preference (e.g., `en-US`) |

## Common Response Headers

| Header | Description |
|--------|-------------|
| `Content-Type` | Set to `application/json` for all responses with a body |
| `X-Request-ID` | Unique identifier for the request (useful for troubleshooting) |

## Standard Response Format

All API responses follow a standard format:

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data specific to the endpoint
  },
  "meta": {
    // Metadata about the response (pagination, etc.)
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Additional error details (optional)
    }
  }
}
```

## Common HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| 200 | OK - The request was successful |
| 201 | Created - A new resource was successfully created |
| 204 | No Content - The request was successful, but there is no response body |
| 400 | Bad Request - The request was malformed or invalid |
| 401 | Unauthorized - Authentication is required or failed |
| 403 | Forbidden - The authenticated user doesn't have permission |
| 404 | Not Found - The requested resource was not found |
| 409 | Conflict - The request conflicts with the current state |
| 422 | Unprocessable Entity - Validation errors |
| 500 | Internal Server Error - An unexpected error occurred |

## API Categories

The API is organized into the following categories:

1. [Authentication](./authentication.md)
2. [Users](./users.md)
3. [Customers](./customers.md)
4. [Products](./products.md)
5. [Categories](./categories.md)
6. [Inventory](./inventory.md)
7. [Sales](./sales.md)
8. [Purchase Orders](./purchase-orders.md)
9. [Goods Received Notes](./grn.md)
10. [Suppliers](./suppliers.md)
11. [Stores](./stores.md)
12. [Reports](./reports.md)

## Error Codes

Below is a list of common error codes returned by the API:

| Error Code | Description |
|------------|-------------|
| `AUTHENTICATION_FAILED` | Invalid credentials provided |
| `TOKEN_EXPIRED` | The provided JWT token has expired |
| `INVALID_TOKEN` | The provided JWT token is invalid |
| `PERMISSION_DENIED` | User does not have permission for the requested operation |
| `RESOURCE_NOT_FOUND` | The requested resource was not found |
| `VALIDATION_ERROR` | The request data failed validation |
| `DUPLICATE_ENTRY` | The request would create a duplicate entry |
| `FOREIGN_KEY_VIOLATION` | The request references a non-existent related resource |
| `DATABASE_ERROR` | A general database error occurred |
| `INTERNAL_SERVER_ERROR` | An unexpected error occurred on the server |

## Pagination

List endpoints support pagination through the following query parameters:

| Parameter | Description |
|-----------|-------------|
| `page` | Page number (starting from 1) |
| `limit` | Number of items per page |
| `sort` | Field to sort by |
| `order` | Sort order (`asc` or `desc`) |

Example request:

```
GET /api/products?page=2&limit=10&sort=name&order=asc
```

Pagination metadata is included in the response:

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "pagination": {
      "page": 2,
      "limit": 10,
      "total": 45,
      "totalPages": 5
    }
  }
}
```

## Filtering

List endpoints support filtering through query parameters. The specific parameters depend on the resource, but common patterns include:

```
GET /api/products?category_id=abc123
GET /api/sales?start_date=2025-01-01&end_date=2025-01-31
GET /api/customers?search=john
```

## Rate Limiting

The API implements rate limiting to prevent abuse. Current limits are:

- **Anonymous Requests**: 60 requests per minute
- **Authenticated Requests**: 300 requests per minute

When a rate limit is exceeded, the API returns a 429 (Too Many Requests) status code with headers indicating the limit and when it resets:

```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1622825602
```

## Versioning

The API is versioned through the URL path:

```
/api/v1/products
```

When breaking changes are introduced, a new version will be created. Old versions will be maintained for a reasonable deprecation period.

## Cross-Origin Resource Sharing (CORS)

The API supports CORS for allowed domains. For development, all origins are allowed.

## API Clients

The Zettaz Cloud Enterprise system includes the following API clients:

1. **Frontend Web Application**: Primary client built with React
2. **Mobile Application**: React Native client for iOS and Android
3. **CLI Tools**: Command-line tools for administrative tasks

## Request Examples

Each API endpoint documentation includes request and response examples. Here's a sample for creating a product:

### Request

```
POST /api/products
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "name": "Smartphone X1",
  "sku": "SMX1-2025",
  "category_id": "550e8400-e29b-41d4-a716-446655440000",
  "description": "Latest model smartphone with advanced features",
  "price": 499.99,
  "cost": 320.00,
  "stock_quantity": 25,
  "tax_class_id": "91a0c4b4-908f-4720-8b0e-15fa6a0c9a2a",
  "barcode": "7891234567890",
  "is_active": true
}
```

### Response

```
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "7f8d1d6a-4b0c-4a4b-8b0a-c1d2e3f4g5h6",
    "name": "Smartphone X1",
    "sku": "SMX1-2025",
    "category_id": "550e8400-e29b-41d4-a716-446655440000",
    "description": "Latest model smartphone with advanced features",
    "price": 499.99,
    "cost": 320.00,
    "stock_quantity": 25,
    "tax_class_id": "91a0c4b4-908f-4720-8b0e-15fa6a0c9a2a",
    "barcode": "7891234567890",
    "is_active": true,
    "created_at": "2025-06-15T14:30:22.123Z",
    "updated_at": "2025-06-15T14:30:22.123Z"
  }
}
```

## Implementation Notes

The API is implemented in the `backend` directory, with routes defined in the `routes` directory and controllers in the `controllers` directory. Each API endpoint is backed by one or more controller functions that handle the business logic.

Database queries use the `mysql2` library with prepared statements to prevent SQL injection attacks.

## Security Considerations

The API implements several security measures:

1. **Input Validation**: All request data is validated using middleware
2. **Prepared Statements**: SQL queries use parameterized queries
3. **Rate Limiting**: Prevents brute force attacks
4. **HTTPS**: All production traffic uses HTTPS
5. **JWT Expiration**: Authentication tokens expire after a set period
6. **CORS Policy**: Restricts access to allowed domains
7. **Role-Based Access Control**: Ensures users can only access authorized resources
