# API Documentation

This section provides comprehensive documentation for the Zettaz Cloud Enterprise API, helping developers understand and interact with the system's endpoints.

## Overview

The Zettaz Cloud Enterprise API follows RESTful principles and uses JSON for request and response payloads. All endpoints require authentication using JWT tokens (except for auth endpoints).

## Authentication

Authentication is handled via JWT tokens. Include the token in the Authorization header of your requests:

```
Authorization: Bearer <your_jwt_token>
```

## Base URL

- Development: `http://localhost:5000/api`
- Production: `https://your-domain.com/api`

## API Versioning

The current version is v1, accessed via `/api/v1/` prefix.

## Response Format

All API responses follow a consistent structure:

### Success Response

```json
{
  "success": true,
  "data": { ... },  // Response data
  "pagination": { ... }  // Optional pagination info
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": { ... }  // Optional additional details
  }
}
```

## Multi-Tenancy

All endpoints enforce multi-tenant isolation. Resources are automatically filtered by the tenant_id associated with the authenticated user.

## Documentation Structure

The API documentation is organized by resource:

1. [Authentication](./authentication.md)
2. [Users](./users.md)
3. [Products](./products.md)
4. [Categories](./categories.md)
5. [Inventory](./inventory.md)
6. [Purchase Orders](./purchase-orders.md)
7. [GRN (Goods Received Notes)](./grn.md)
8. [Sales](./sales.md)
9. [Reports](./reports.md)
10. [Settings](./settings.md)

## Pagination

List endpoints support pagination with the following query parameters:

- `page`: Page number (default: 1)
- `limit`: Number of items per page (default: 20, max: 100)
- `sort`: Field to sort by (default varies by endpoint)
- `order`: Sort order ('asc' or 'desc', default: 'asc')

Pagination response includes:

```json
"pagination": {
  "totalItems": 100,
  "totalPages": 5,
  "currentPage": 1,
  "pageSize": 20,
  "hasNext": true,
  "hasPrevious": false
}
```

## Error Codes

Common error codes include:

| Code | Description |
|------|-------------|
| AUTH_FAILED | Authentication failure |
| INVALID_INPUT | Validation error in request data |
| NOT_FOUND | Requested resource not found |
| FORBIDDEN | User lacks permission for operation |
| CONFLICT | Resource conflict (e.g., duplicate unique field) |
| SERVER_ERROR | Internal server error |

## Rate Limiting

API requests are limited to 100 requests per minute per user. Headers include:

- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Time when the rate limit resets

## Using the API Documentation

Each resource documentation includes:

- Available endpoints
- Request parameters
- Example requests and responses
- Required permissions
- Notes and warnings

## API Changelog

API changes are documented in the [API Changelog](./changelog.md) file.
