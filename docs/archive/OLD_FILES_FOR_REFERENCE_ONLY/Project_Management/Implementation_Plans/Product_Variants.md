# Product Variants Implementation Plan

## 1. Goal

To implement product variants functionality, allowing specific versions of a product to differ by one or more attributes (e.g., size, color, weight, material). This will enhance the product management capabilities of the Zettaz Cloud POS system, providing greater flexibility for various industries.

## 2. Phase 0: Clarification and Design Decisions (To Be Finalized)

Before development, the following design aspects need to be confirmed:

*   **Attribute Definition:**
    *   [ ] Decision: Predefined, reusable list of attribute types (e.g., "Color", "Size") managed globally or per tenant, OR product-specific attribute definition.
    *   *Recommendation: Reusable list for scalability.*
*   **Attribute Value Definition:**
    *   [ ] Decision: Predefined list of values for each attribute type (e.g., "Color" has "Red", "Blue"), OR free-form text input for values per product.
    *   *Recommendation: Predefined values for consistency.*
*   **Variant-Specific Fields vs. Base Product Fields:**
    *   [ ] Confirm list of fields unique to each variant (e.g., `price`, `cost_price`, `sku`, `barcode`, `stock_quantity`, `image_url`, `low_stock_threshold`, `specific_discount_type`, `specific_discount_value`, `is_active` for the variant).
    *   [ ] Confirm list of fields common to the base product (e.g., `name`, `description`, `category_id`, `tax_class_id`, `is_active` for the base product).
*   **UI/UX for Variant Selection/Display:**
    *   [ ] Initial thoughts on product list display for items with variants.
    *   [ ] Initial thoughts on variant selection during sales/POS operations.

## 3. Phase 1: Database Schema Changes

**Tasks:**

1.  **Create `attributes` Table:**
    *   Purpose: Store attribute types (e.g., "Color", "Size").
    *   Columns:
        *   `id` (CHAR(36), PK)
        *   `tenant_id` (CHAR(36), FK to `tenants.id`)
        *   `name` (VARCHAR(255), Unique per `tenant_id`)
        *   `created_at`, `updated_at`, `created_by_user_id`, `updated_by_user_id` (standard audit fields)

2.  **Create `attribute_values` Table:**
    *   Purpose: Store possible values for each attribute type (e.g., "Red", "Large").
    *   Columns:
        *   `id` (CHAR(36), PK)
        *   `tenant_id` (CHAR(36), FK to `tenants.id`)
        *   `attribute_id` (CHAR(36), FK to `attributes.id`)
        *   `value` (VARCHAR(255), Unique per `attribute_id` and `tenant_id`)
        *   `created_at`, `updated_at`, `created_by_user_id`, `updated_by_user_id`

3.  **Modify `products` Table:**
    *   Purpose: This table will represent the "base product" or "product template."
    *   Actions:
        *   [ ] Remove fields that become variant-specific: `price`, `cost_price`, `barcode`, `sku`, `stock_quantity`, `image_url` (or keep as generic image), `low_stock_threshold`, `specific_discount_type`, `specific_discount_value`.
        *   [ ] Add new column: `has_variants` (BOOLEAN, DEFAULT FALSE) or `product_type` (ENUM('standard', 'parent'), DEFAULT 'standard').
        *   [ ] Confirm retention of: `id`, `tenant_id`, `name` (base name), `description` (base description), `category_id`, `tax_class_id`, `is_active` (for the whole product line), audit fields.

4.  **Create `product_variants` Table:**
    *   Purpose: Store each specific variant.
    *   Columns:
        *   `id` (CHAR(36), PK)
        *   `tenant_id` (CHAR(36), FK to `tenants.id`)
        *   `product_id` (CHAR(36), FK to `products.id` - base product)
        *   `name_suffix` (VARCHAR(255), Nullable, e.g., "Pro 256GB Blue")
        *   `price` (DECIMAL(10,2), NOT NULL)
        *   `cost_price` (DECIMAL(10,2), NULLABLE)
        *   `sku` (VARCHAR(255), NULLABLE, Unique per `tenant_id` recommended)
        *   `barcode` (VARCHAR(255), NULLABLE, Unique per `tenant_id` recommended)
        *   `stock_quantity` (INT, NOT NULL, DEFAULT 0)
        *   `low_stock_threshold` (INT, NULLABLE)
        *   `image_url` (TEXT, NULLABLE) - Variant-specific image
        *   `is_active` (BOOLEAN, NOT NULL, DEFAULT TRUE) - For this variant
        *   `specific_discount_type` (ENUM('percentage','fixed'), NULLABLE)
        *   `specific_discount_value` (DECIMAL(10,2), NULLABLE)
        *   *(Optional: `weight`, `dimensions`, etc. based on design decisions)*
        *   `created_at`, `updated_at`, `created_by_user_id`, `updated_by_user_id`

5.  **Create `product_variant_options` Table (Junction Table):**
    *   Purpose: Links a variant to its chosen attribute values.
    *   Columns:
        *   `id` (CHAR(36), PK) - Optional, composite PK on (`product_variant_id`, `attribute_id`) might be better.
        *   `product_variant_id` (CHAR(36), FK to `product_variants.id`)
        *   `attribute_id` (CHAR(36), FK to `attributes.id`)
        *   `attribute_value_id` (CHAR(36), FK to `attribute_values.id`)
        *   Unique constraint on (`product_variant_id`, `attribute_id`)

## 4. Phase 2: Backend API Development

**Tasks:**

1.  **Attributes & Values Management APIs:**
    *   [ ] Implement CRUD endpoints for `/api/attributes`.
    *   [ ] Implement CRUD endpoints for `/api/attribute-values` (filterable by `attribute_id`).

2.  **Product & Variant Logic APIs:**
    *   [ ] Modify `POST /api/products`:
        *   Handle creation of standard products (no variants).
        *   Handle creation of base products with an array of variants (creating entries in `product_variants` and `product_variant_options`).
    *   [ ] Modify `PUT /api/products/:productId`:
        *   Update base product details.
        *   Manage variants: add new, update existing (details, stock, price), remove variants.
    *   [ ] Modify `GET /api/products` (List Products):
        *   Define strategy for returning products with variants (e.g., base product only with flag, embed variants, flatten list).
    *   [ ] Modify `GET /api/products/:productId` (Single Product):
        *   Return base product details + all associated variant data and their options.
    *   [ ] Update Inventory Logic: Ensure stock adjustments correctly target `product_variants.stock_quantity`.
    *   [ ] Update Sales Logic (`POST /api/sales`):
        *   Sale items must reference `product_variant_id`.

## 5. Phase 3: Frontend UI/UX Development

**Tasks:**

1.  **Attributes & Values Management UI (Admin/Settings Area):**
    *   [ ] Interface to manage `attributes`.
    *   [ ] Interface to manage `attribute_values` for each attribute.

2.  **Product Form (`ProductFormModal.tsx`):**
    *   [ ] Add toggle: "This product has variants."
    *   If variants enabled:
        *   [ ] Section to select/assign attributes (e.g., "Color", "Size") to the base product.
        *   [ ] Mechanism to generate/manage variant combinations based on selected attribute values.
        *   [ ] Table/list for each variant with inputs for SKU, price, stock, image, etc.
        *   [ ] Option to activate/deactivate individual variants.
    *   If no variants, form adapts to save price, SKU, etc., directly to the (modified) product record.

3.  **Product List (`ProductsPage.tsx`, `ProductsList.tsx`):**
    *   [ ] Implement chosen display strategy for products with variants.
    *   [ ] Update search and filtering to accommodate variants (e.g., search by variant SKU, filter by attribute values).

4.  **POS/Sales Interface:**
    *   [ ] Implement UI for selecting specific variants when a variant-product is added to a sale.

## 6. Phase 4: Testing and Refinement

**Tasks:**

*   [ ] Thoroughly test all CRUD operations for attributes, values, base products, and variants.
*   [ ] Test inventory tracking and stock adjustments for variants.
*   [ ] Test the complete sales process with variant products.
*   [ ] Test impact on reporting (sales reports, inventory reports).
*   [ ] Gather user feedback and iterate on UI/UX and functionality.

## 7. Impact on Existing Implementation

*   **Database:** Significant changes to `products` table. Introduction of 4 new tables.
*   **Backend API (`server.js`):** Major modifications to product creation, update, and retrieval logic. Sales endpoint will need to handle variant IDs.
*   **Frontend (`ProductFormModal.tsx`, `ProductsPage.tsx`, POS/Sales UI):** Substantial UI changes for product management and sales.
*   **Data Migration:** If there's existing product data, a strategy will be needed to migrate them. Products without variants might need to be updated to fit the new `products` table structure (e.g., moving price, SKU etc. if they were previously on the main table and are now part of a single 'default' variant or directly on the product if `has_variants` is false).
*   **Reporting:** Existing reports (sales, inventory) will need to be reviewed and potentially updated to correctly reflect variant data.

## 8. Handling with Care

*   **Iterative Development:** Consider rolling out parts of this feature iteratively if possible, though the database changes are foundational.
*   **Thorough Testing:** Due to the widespread impact, extensive testing in a development/staging environment is critical before deploying to production.
*   **Backup:** Ensure database backups are in place before applying schema changes.
*   **Clear Communication:** Keep all stakeholders informed of the changes and potential impacts.
*   **Data Migration Plan:** If migrating existing data, plan and test this process carefully.

## 9. High-Level To-Do / Checklist

- [ ] Finalize Design Decisions (Phase 0)
- [ ] Implement Database Schema Changes (Phase 1)
- [ ] Develop Backend APIs for Attributes & Values (Phase 2)
- [ ] Develop Backend APIs for Products & Variants (Phase 2)
- [ ] Develop Frontend UI for Attributes & Values (Phase 3)
- [ ] Develop Frontend UI for Product Form with Variants (Phase 3)
- [ ] Develop Frontend UI for Product List with Variants (Phase 3)
- [ ] Develop Frontend UI for POS/Sales Variant Selection (Phase 3)
- [ ] Execute Data Migration Plan (if applicable)
- [ ] Conduct Comprehensive Testing (Phase 4)
- [ ] Review and Update Reporting
- [ ] Deploy and Monitor
