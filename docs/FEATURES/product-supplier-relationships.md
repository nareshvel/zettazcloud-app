# Product-Supplier Relationship Enhancement

## Overview

This document outlines the planned implementation for creating relationships between products and suppliers in the Zettaz Cloud POS system. The current product schema keeps products independent of suppliers, which provides flexibility but limits supplier-specific functionality.

## Current Approach

Currently, products are maintained independently of suppliers. This approach has several benefits:

- Products maintain their identity regardless of supplier changes
- Simple product management without supplier dependencies
- Flexibility in sourcing products from different suppliers

## Proposed Enhancement

Rather than adding a direct `supplier_id` field to the products table, we recommend implementing a many-to-many relationship through a junction table.

### New Table Structure

```sql
CREATE TABLE product_suppliers (
    id CHAR(36) PRIMARY KEY,
    product_id CHAR(36) NOT NULL,
    supplier_id CHAR(36) NOT NULL,
    is_preferred BOOLEAN DEFAULT FALSE,
    cost_price DECIMAL(15,2),
    lead_time_days INT,
    minimum_order_quantity INT,
    supplier_sku VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_product_supplier (product_id, supplier_id)
);

-- Add indexes for better performance
CREATE INDEX idx_product_suppliers_product_id ON product_suppliers(product_id);
CREATE INDEX idx_product_suppliers_supplier_id ON product_suppliers(supplier_id);
```

### Benefits of This Approach

1. **Multiple suppliers per product**: Track and compare different suppliers for the same product
2. **Supplier-specific details**: Store different costs, lead times, and SKUs for each supplier
3. **Preferred supplier marking**: Designate a preferred supplier for each product
4. **Enhanced purchasing workflows**: Simplify purchase order creation with supplier-specific information
5. **Detailed reporting**: Generate reports on supplier performance, pricing trends, and more

## Implementation Steps

1. Create the `product_suppliers` junction table
2. Modify the product management UI to allow assigning suppliers to products
3. Update the purchase order creation workflow to leverage supplier-product relationships
4. Add supplier comparison functionality to help select the best supplier for each product
5. Implement reporting features for supplier analysis

## API Endpoints to Add

1. `GET /api/products/:id/suppliers` - Get all suppliers for a specific product
2. `POST /api/products/:id/suppliers` - Add a supplier to a product
3. `PUT /api/products/:id/suppliers/:supplierId` - Update supplier details for a product
4. `DELETE /api/products/:id/suppliers/:supplierId` - Remove a supplier from a product
5. `GET /api/suppliers/:id/products` - Get all products from a specific supplier

## UI Changes

1. Add a "Suppliers" tab to the product detail view
2. Create a supplier assignment modal for products
3. Enhance the purchase order creation UI to show supplier-specific information
4. Add supplier filters to the product listing page

## Migration Strategy

Since the current system doesn't track supplier relationships, no data migration is needed. The new functionality can be added without affecting existing product data.

## Timeline

This enhancement is planned for a future release after completing current priority features like product-wise discounts.
