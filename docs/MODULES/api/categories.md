# Categories API

This document details the endpoints for managing product categories in the Zettaz Cloud Enterprise API.

## Overview

The Categories API provides endpoints for creating, retrieving, updating, and deleting product categories. Categories are used to organize products and can be hierarchical with parent-child relationships.

## Endpoints

### List Categories

```
GET /api/v1/categories
```

Retrieves a list of all product categories.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| parent_id | string | Filter by parent category ID (optional, use 'null' to get root categories) |
| include_products | boolean | Whether to include product counts for each category (default: false) |
| include_children | boolean | Whether to include child categories (default: false) |
| status | string | Filter by status ('ACTIVE', 'INACTIVE') |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "cat_123",
      "name": "Electronics",
      "slug": "electronics",
      "description": "Electronic devices and accessories",
      "parent_id": null,
      "level": 0,
      "status": "ACTIVE",
      "image_url": "https://assets.zettaz.com/categories/electronics.jpg",
      "product_count": 120,
      "child_count": 5,
      "created_at": "2023-01-15T09:00:00.000Z",
      "updated_at": "2023-05-10T14:30:00.000Z"
    },
    {
      "id": "cat_124",
      "name": "Computers",
      "slug": "computers",
      "description": "Desktop and laptop computers",
      "parent_id": "cat_123",
      "level": 1,
      "status": "ACTIVE",
      "image_url": "https://assets.zettaz.com/categories/computers.jpg",
      "product_count": 45,
      "child_count": 2,
      "created_at": "2023-01-15T09:15:00.000Z",
      "updated_at": "2023-05-12T11:00:00.000Z"
    },
    {
      "id": "cat_125",
      "name": "Laptops",
      "slug": "laptops",
      "description": "Portable laptop computers",
      "parent_id": "cat_124",
      "level": 2,
      "status": "ACTIVE",
      "image_url": "https://assets.zettaz.com/categories/laptops.jpg",
      "product_count": 30,
      "child_count": 0,
      "created_at": "2023-01-15T09:30:00.000Z",
      "updated_at": "2023-05-15T10:00:00.000Z"
    }
    // Additional categories...
  ]
}
```

#### Notes
- Results are automatically filtered by the tenant_id of the authenticated user
- When include_children is true, each category will have a "children" array with its immediate child categories
- Category level represents its depth in the hierarchy (0 for root categories)

### Get Category Tree

```
GET /api/v1/categories/tree
```

Retrieves a hierarchical tree of categories.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| root_id | string | ID of the root category to start the tree from (optional) |
| max_depth | number | Maximum depth of children to include (default: 3) |
| include_products | boolean | Whether to include product counts for each category (default: false) |
| status | string | Filter by status ('ACTIVE', 'INACTIVE') |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "cat_123",
      "name": "Electronics",
      "slug": "electronics",
      "description": "Electronic devices and accessories",
      "parent_id": null,
      "level": 0,
      "status": "ACTIVE",
      "image_url": "https://assets.zettaz.com/categories/electronics.jpg",
      "product_count": 120,
      "children": [
        {
          "id": "cat_124",
          "name": "Computers",
          "slug": "computers",
          "description": "Desktop and laptop computers",
          "parent_id": "cat_123",
          "level": 1,
          "status": "ACTIVE",
          "image_url": "https://assets.zettaz.com/categories/computers.jpg",
          "product_count": 45,
          "children": [
            {
              "id": "cat_125",
              "name": "Laptops",
              "slug": "laptops",
              "description": "Portable laptop computers",
              "parent_id": "cat_124",
              "level": 2,
              "status": "ACTIVE",
              "image_url": "https://assets.zettaz.com/categories/laptops.jpg",
              "product_count": 30,
              "children": []
            },
            {
              "id": "cat_126",
              "name": "Desktops",
              "slug": "desktops",
              "description": "Desktop computers",
              "parent_id": "cat_124",
              "level": 2,
              "status": "ACTIVE",
              "image_url": "https://assets.zettaz.com/categories/desktops.jpg",
              "product_count": 15,
              "children": []
            }
          ]
        },
        // More child categories...
      ]
    },
    // Other root categories...
  ]
}
```

### Get Category Details

```
GET /api/v1/categories/:id
```

Retrieves detailed information for a specific category.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| include_parent | boolean | Whether to include parent category details (default: false) |
| include_children | boolean | Whether to include immediate child categories (default: false) |
| include_products | boolean | Whether to include product count and sample products (default: false) |

#### Response

```json
{
  "success": true,
  "data": {
    "id": "cat_124",
    "name": "Computers",
    "slug": "computers",
    "description": "Desktop and laptop computers",
    "parent_id": "cat_123",
    "level": 1,
    "status": "ACTIVE",
    "seo_title": "Computer Systems & Components",
    "seo_description": "Browse our wide selection of desktop and laptop computers",
    "seo_keywords": "computers, desktop, laptop, workstation",
    "image_url": "https://assets.zettaz.com/categories/computers.jpg",
    "banner_url": "https://assets.zettaz.com/categories/computers-banner.jpg",
    "display_order": 10,
    "product_count": 45,
    "child_count": 2,
    "attributes": [
      {
        "name": "Processor",
        "type": "select",
        "options": ["Intel i3", "Intel i5", "Intel i7", "AMD Ryzen 3", "AMD Ryzen 5", "AMD Ryzen 7"]
      },
      {
        "name": "RAM",
        "type": "select",
        "options": ["4GB", "8GB", "16GB", "32GB", "64GB"]
      },
      {
        "name": "Storage",
        "type": "select",
        "options": ["256GB SSD", "512GB SSD", "1TB SSD", "2TB HDD"]
      }
    ],
    "parent": {
      "id": "cat_123",
      "name": "Electronics",
      "slug": "electronics",
      "status": "ACTIVE"
    },
    "children": [
      {
        "id": "cat_125",
        "name": "Laptops",
        "slug": "laptops",
        "status": "ACTIVE",
        "product_count": 30
      },
      {
        "id": "cat_126",
        "name": "Desktops",
        "slug": "desktops",
        "status": "ACTIVE",
        "product_count": 15
      }
    ],
    "sample_products": [
      {
        "id": "prod_101",
        "name": "Business Laptop Pro",
        "sku": "BLP001",
        "image_url": "https://assets.zettaz.com/products/blp001.jpg",
        "price": 999.99
      },
      {
        "id": "prod_102",
        "name": "Gaming Desktop X1",
        "sku": "GDX001",
        "image_url": "https://assets.zettaz.com/products/gdx001.jpg",
        "price": 1499.99
      }
      // Additional sample products...
    ],
    "created_by": "user_123",
    "created_by_name": "John Doe",
    "created_at": "2023-01-15T09:15:00.000Z",
    "updated_at": "2023-05-12T11:00:00.000Z"
  }
}
```

### Create Category

```
POST /api/v1/categories
```

Creates a new product category.

#### Request Body

```json
{
  "name": "Tablets",
  "slug": "tablets",
  "description": "Tablet computers and accessories",
  "parent_id": "cat_124",
  "status": "ACTIVE",
  "seo_title": "Tablet Computers & Accessories",
  "seo_description": "Browse our selection of tablets and tablet accessories",
  "seo_keywords": "tablets, iPad, Android tablet, accessories",
  "display_order": 20,
  "attributes": [
    {
      "name": "Screen Size",
      "type": "select",
      "options": ["7-inch", "8-inch", "10-inch", "12-inch"]
    },
    {
      "name": "Operating System",
      "type": "select",
      "options": ["iOS", "Android", "Windows"]
    }
  ]
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "cat_127",
    "name": "Tablets",
    "slug": "tablets",
    "description": "Tablet computers and accessories",
    "parent_id": "cat_124",
    "level": 2,
    "status": "ACTIVE",
    "seo_title": "Tablet Computers & Accessories",
    "seo_description": "Browse our selection of tablets and tablet accessories",
    "seo_keywords": "tablets, iPad, Android tablet, accessories",
    "display_order": 20,
    "attributes": [
      {
        "name": "Screen Size",
        "type": "select",
        "options": ["7-inch", "8-inch", "10-inch", "12-inch"]
      },
      {
        "name": "Operating System",
        "type": "select",
        "options": ["iOS", "Android", "Windows"]
      }
    ],
    "product_count": 0,
    "child_count": 0,
    "created_by": "user_123",
    "created_by_name": "John Doe",
    "tenant_id": "tenant_123",
    "created_at": "2023-06-02T15:30:00.000Z",
    "updated_at": "2023-06-02T15:30:00.000Z"
  }
}
```

#### Notes
- Category slugs must be unique within a tenant
- The system automatically sets the level based on the parent category
- If no slug is provided, it will be generated based on the name
- When creating a category with a parent, the parent must exist and belong to the same tenant
- All categories are created within the tenant of the authenticated user

### Update Category

```
PUT /api/v1/categories/:id
```

Updates an existing product category.

#### Request Body

```json
{
  "name": "Tablet Devices",
  "description": "Tablet computers and smart devices",
  "status": "ACTIVE",
  "seo_title": "Tablet Devices & Accessories",
  "display_order": 15,
  "attributes": [
    {
      "name": "Screen Size",
      "type": "select",
      "options": ["7-inch", "8-inch", "10-inch", "12-inch", "13-inch"]
    },
    {
      "name": "Operating System",
      "type": "select",
      "options": ["iOS", "Android", "Windows"]
    },
    {
      "name": "Connectivity",
      "type": "select",
      "options": ["WiFi", "WiFi + Cellular"]
    }
  ]
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "cat_127",
    "name": "Tablet Devices",
    "slug": "tablets",
    "description": "Tablet computers and smart devices",
    "parent_id": "cat_124",
    "level": 2,
    "status": "ACTIVE",
    "seo_title": "Tablet Devices & Accessories",
    "display_order": 15,
    "updated_at": "2023-06-02T16:00:00.000Z"
    // Other fields...
  }
}
```

#### Notes
- The slug cannot be changed if there are products associated with the category
- Moving a category to a different parent will update the level of the category and all its descendants
- Updating attributes will not affect existing product attributes

### Delete Category

```
DELETE /api/v1/categories/:id
```

Deletes a category or marks it as inactive.

#### Response

```json
{
  "success": true,
  "data": {
    "message": "Category deactivated successfully"
  }
}
```

#### Notes
- In most cases, categories are not physically deleted but marked as INACTIVE
- Category deletion is only allowed if there are no products associated with it
- Deleting a parent category is not allowed if it has child categories
- All category deletion actions are logged for audit purposes

### Upload Category Image

```
POST /api/v1/categories/:id/image
```

Uploads an image for a category.

#### Request

Multipart form data with 'image' field containing the image file.

#### Response

```json
{
  "success": true,
  "data": {
    "id": "cat_127",
    "name": "Tablet Devices",
    "image_url": "https://assets.zettaz.com/categories/tablets.jpg",
    "updated_at": "2023-06-02T16:30:00.000Z"
  }
}
```

### Upload Category Banner

```
POST /api/v1/categories/:id/banner
```

Uploads a banner image for a category.

#### Request

Multipart form data with 'banner' field containing the image file.

#### Response

```json
{
  "success": true,
  "data": {
    "id": "cat_127",
    "name": "Tablet Devices",
    "banner_url": "https://assets.zettaz.com/categories/tablets-banner.jpg",
    "updated_at": "2023-06-02T16:45:00.000Z"
  }
}
```

### Get Category Products

```
GET /api/v1/categories/:id/products
```

Retrieves a paginated list of products in a specific category.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20, max: 100) |
| sort | string | Field to sort by (default: 'name') |
| order | string | Sort order ('asc' or 'desc', default: 'asc') |
| include_subcategories | boolean | Whether to include products from subcategories (default: false) |
| status | string | Filter by product status ('ACTIVE', 'INACTIVE') |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "prod_101",
      "name": "Business Laptop Pro",
      "sku": "BLP001",
      "description": "Professional laptop for business users",
      "price": 999.99,
      "sale_price": null,
      "image_url": "https://assets.zettaz.com/products/blp001.jpg",
      "current_stock_quantity": 25,
      "status": "ACTIVE",
      "created_at": "2023-01-20T10:00:00.000Z",
      "updated_at": "2023-05-15T14:30:00.000Z"
    },
    {
      "id": "prod_102",
      "name": "Gaming Desktop X1",
      "sku": "GDX001",
      "description": "High-performance gaming desktop",
      "price": 1499.99,
      "sale_price": 1399.99,
      "image_url": "https://assets.zettaz.com/products/gdx001.jpg",
      "current_stock_quantity": 10,
      "status": "ACTIVE",
      "created_at": "2023-01-22T11:30:00.000Z",
      "updated_at": "2023-05-20T09:45:00.000Z"
    }
    // Additional products...
  ],
  "pagination": {
    "totalItems": 45,
    "totalPages": 3,
    "currentPage": 1,
    "pageSize": 20,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

### Reorder Categories

```
PUT /api/v1/categories/reorder
```

Updates the display order of multiple categories.

#### Request Body

```json
{
  "categories": [
    {
      "id": "cat_125",
      "display_order": 10
    },
    {
      "id": "cat_126",
      "display_order": 20
    },
    {
      "id": "cat_127",
      "display_order": 30
    }
  ]
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "message": "Categories reordered successfully",
    "updated": 3
  }
}
```

## Error Responses

### Not Found

```json
{
  "success": false,
  "error": {
    "message": "Category not found",
    "code": "NOT_FOUND"
  }
}
```

### Validation Error

```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": {
      "name": "Category name is required",
      "slug": "Category slug already exists",
      "parent_id": "Parent category not found"
    }
  }
}
```

### Dependency Error

```json
{
  "success": false,
  "error": {
    "message": "Cannot delete category with associated products",
    "code": "DEPENDENCY_ERROR",
    "details": {
      "product_count": 45
    }
  }
}
```

## Implementation Notes

### Multi-tenancy Considerations

All category operations enforce tenant isolation:

```javascript
// Direct category query
const [categories] = await connection.query(
  'SELECT * FROM product_categories WHERE tenant_id = ?',
  [tenant_id]
);

// Joined queries for category products
const [products] = await connection.query(`
  SELECT p.* 
  FROM products p
  WHERE p.category_id = ? AND p.tenant_id = ?
  ORDER BY p.name ASC
`, [categoryId, tenant_id]);
```

### Hierarchical Category Management

Category hierarchy is managed through:

1. Parent-child relationships with parent_id references
2. Level tracking to indicate depth in the hierarchy
3. Breadcrumb generation for navigation
4. Recursive queries for tree structures
5. Constraints to prevent circular references

```javascript
// Get full category path (breadcrumb)
const getCategoryPath = async (categoryId, tenant_id) => {
  const path = [];
  let currentId = categoryId;
  
  while (currentId) {
    const [rows] = await connection.query(
      'SELECT id, name, slug, parent_id FROM product_categories WHERE id = ? AND tenant_id = ?',
      [currentId, tenant_id]
    );
    
    if (rows.length === 0) break;
    
    path.unshift(rows[0]);
    currentId = rows[0].parent_id;
  }
  
  return path;
};
```

### Category Attributes

Category attributes are used to:

1. Define product specification fields
2. Create filterable product attributes
3. Generate product forms in the admin interface
4. Standardize product data entry
5. Enable advanced product search

### SEO Optimization

Category SEO fields support:

1. Custom page titles for category pages
2. Meta descriptions for search engine results
3. Keyword targeting
4. URL slug optimization
5. Structured data for rich search results

### Image and Asset Management

Category images and banners:

1. Are stored in a cloud storage service
2. Have standardized dimensions for UI consistency
3. Are processed to create multiple resolutions
4. Include alt text for accessibility
5. Are delivered through a CDN for performance

### Performance Considerations

For performance optimization:

1. Category trees are cached to reduce database load
2. Product counts are maintained as counters to avoid expensive queries
3. Hierarchical queries use optimized algorithms
4. Category lists are paginated for large catalogs
5. Common category operations use prepared statements
