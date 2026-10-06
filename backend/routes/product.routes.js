const express = require('express');
const router = express.Router();
const { pool, getConnectionWithTimeZone } = require('../config/db'); // Use central DB config with timezone helper
const { authenticate, requireTenantId, requireStoreId } = require('../middleware/unifiedAuthMiddleware');
// Import consolidated RBAC permission middleware
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');
const path = require('path');
const fs = require('fs').promises; // For async file operations
const { v4: uuidv4 } = require('uuid'); // Ensure uuid is imported

// Import the specific multer instance configured in multerConfig.js
const { uploadProductImage } = require('../middleware/multerConfig'); // Adjusted path
const { logActivity } = require('../services/auditLogService'); // Import for activity logging
const ImageService = require('../services/imageService'); // Import unified image service
const costCodeService = require('../services/costCodeService'); // Cost-code cipher + derived pricing
const industryFieldService = require('../services/industryFieldService'); // Industry dynamic fields
const storeProductListingService = require('../services/storeProductListingService'); // Per-store price/stock for shared products
const { withinUsageLimits, enforceStorageLimitAfterUpload } = require('../middleware/subscriptionMiddleware'); // Plan `limits.products`/`limits.storage` enforcement

// Verbose per-request product CRUD debug logging - opt-in only, disabled by
// default to avoid log noise during bulk import etc.
const DEBUG_PRODUCTS = process.env.DEBUG_PRODUCTS === 'true' || process.env.DEBUG === 'true';

// Async count function for withinUsageLimits('products', ...) — counts all
// products for the tenant, matching the same query subscriptionService's
// getSubscriptionUsage() uses for the usage-percentage display, so the
// enforced number and the displayed number never disagree.
const countTenantProducts = async (tenantId) => {
    const [row] = await pool.query('SELECT COUNT(*) as count FROM products WHERE tenant_id = ?', [tenantId]);
    return row?.[0]?.count ?? 0;
};

// Helper function to safely parse integers
function parseIntSafely(value, defaultValue) {
    const parsedValue = parseInt(value, 10);
    return isNaN(parsedValue) ? defaultValue : parsedValue;
}

// Helper function to safely parse floats
function parseFloatSafely(value, defaultValue) {
    const parsedValue = parseFloat(value);
    return isNaN(parsedValue) ? defaultValue : parsedValue;
}

// Helper async function to check existence and unlink using fs.promises
async function unlinkIfExists(filePath, fsPromises) {
    try {
        await fsPromises.access(filePath); // Check if file exists and is accessible
        await fsPromises.unlink(filePath); // If accessible, unlink
        // console.log(`Successfully unlinked ${filePath}`); // Optional: for debugging
    } catch (error) {
        if (error.code === 'ENOENT') {
            // File doesn't exist, which is fine in this context.
        } else {
            // Some other error occurred (e.g., permissions)
            console.error(`Error during unlinkIfExists for ${filePath}:`, error.message);
        }
    }
}

// --- Product Routes --- 

/**
 * @route   GET /api/products/search
 * @desc    Search products by term (specifically for StockAdjustmentModal)
 * @access  Private (requires products.read permission)
 */
router.get('/search', requirePermission('products.view'), async (req, res) => {
    const { term } = req.query;
    const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id']; // Safe access with fallbacks

    if (!term) {
        return res.status(400).json({ message: 'Search term is required.' });
    }

    if (!tenant_id) {
        return res.status(400).json({ message: 'Tenant ID is required.' });
    }

    try {
        const sql = `
            SELECT id, name, sku, stock_quantity, price, image_url
            FROM products
            WHERE tenant_id = ? AND (
                name LIKE ? OR
                sku LIKE ? OR
                description LIKE ?
            )
            LIMIT 10; -- Limit results for performance
        `;
        const searchTerm = `%${term}%`;
        const [rows] = await pool.query(sql, [tenant_id, searchTerm, searchTerm, searchTerm]);

        const products = rows.map(product => ({
            id: product.id,
            name: product.name,
            sku: product.sku,
            stockQuantity: product.stock_quantity,
            price: product.price,
            imageUrl: product.image_url ? `${req.protocol}://${req.get('host')}/${product.image_url.replace(/^public[\\/]/, '')}` : null
        }));

        if (DEBUG_PRODUCTS) console.log(`[Products API Router] Search for term "${term}" in tenant "${tenant_id}" found ${products.length} products.`);
        res.status(200).json({
            status: 'success',
            results: products.length,
            data: { products }
        });
    } catch (error) {
        console.error('[Products API Router] Error searching products:', error);
        res.status(500).json({ message: 'Error searching products', error: error.message });
    }
});

/**
 * @route   POST /api/products/share-existing
 * @desc    One-off bulk conversion for a tenant adopting multi-store after
 *          already having a catalog: every still-store-owned product becomes
 *          tenant-wide shared, with a store_product_listings row created for
 *          its current store so that store's stock/price/cost-tracking don't
 *          change — other stores (including a brand-new one) can then see
 *          and receive stock into it. Safe to call more than once (already-
 *          shared products are left untouched).
 *          See docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md.
 * @access  Private (requires products.update permission — same gate as the
 *          per-store listing PATCH endpoint, since this mutates that table too)
 */
router.post('/share-existing', requirePermission('products.update'), async (req, res) => {
    const tenant_id = req.user?.tenant_id || req.headers['x-tenant-id'];
    if (!tenant_id) {
        return res.status(400).json({ message: 'Tenant ID is required.' });
    }
    try {
        const result = await storeProductListingService.shareExistingStoreOwnedProducts(tenant_id);
        res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        console.error('[Products API Router] Error sharing existing products:', error);
        res.status(500).json({ message: 'Error sharing existing products', error: error.message });
    }
});

// GET all products for the authenticated user's tenant
/**
 * @route   GET /api/products
 * @desc    Get all products with pagination, filtering and sorting
 * @access  Private (requires products.read permission)
 */
router.get('/', requirePermission('products.view'), async (req, res) => {
    // Safe access to req.user which might be undefined when permission checks are skipped
    const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'];
    const store_id = req.query.store_id || req.user?.store_id || req.headers['x-store-id'];
    
    try {
        let sql = `
            SELECT
                p.*,
                c.name as category_name,
                tc.name as tax_class_name,
                po.name as promotional_offer_name,
                po.offer_type as promotional_offer_discount_type,
                po.discount_value as promotional_offer_discount_value,
                po.start_date as promotional_offer_start_date,
                po.end_date as promotional_offer_end_date,
                spl.price AS listing_price,
                spl.stock_quantity AS listing_stock_quantity,
                spl.is_active AS listing_is_active
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id AND c.tenant_id = p.tenant_id
            LEFT JOIN tax_classes tc ON p.tax_class_id = tc.id AND tc.tenant_id = p.tenant_id
            LEFT JOIN promotional_offers po ON p.promotional_offer_id = po.id AND po.tenant_id = p.tenant_id
            LEFT JOIN store_product_listings spl
                ON spl.product_id = p.id AND spl.tenant_id = p.tenant_id AND spl.store_id = ?
            WHERE p.tenant_id = ?
        `;

        const queryParams = [store_id || null, tenant_id];

        // A store's product list is its own store-owned products PLUS every
        // tenant-wide shared product (p.store_id IS NULL) — a shared product
        // is never excluded by the store filter, it's just resolved through
        // its store_product_listings row (joined above) instead. See
        // docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §3.
        if (store_id) {
            sql += ` AND (p.store_id = ? OR p.store_id IS NULL)`;
            queryParams.push(store_id);
            // Exclude a shared product this store has explicitly unlisted
            // (store_product_listings.is_active = 0). No listing row at all
            // is treated as listed/visible (fail-open), matching
            // upsertListing's default is_active = 1.
            sql += ` AND (p.store_id IS NOT NULL OR spl.is_active IS NULL OR spl.is_active = 1)`;
        }

        sql += ` ORDER BY p.created_at DESC;`;

        const [rows] = await pool.query(sql, queryParams);

        const products = rows.map(dbProduct => {
          // Explicitly ensure dbProduct.category_name (from SQL alias) and dbProduct.stock_quantity are accessed
          // And mapped to camelCase properties categoryName and stockQuantity respectively.
          const isSharedRow = dbProduct.store_id === null;
          // For a shared product, prefer the per-store listing's price/stock
          // (NULL price = inherit the shared product's own price). A
          // store-owned product's own columns are always authoritative.
          const effectivePrice = isSharedRow && dbProduct.listing_price != null
            ? dbProduct.listing_price
            : dbProduct.price;
          const effectiveStock = isSharedRow
            ? parseIntSafely(dbProduct.listing_stock_quantity, 0)
            : dbProduct.stock_quantity;
          return {
            id: dbProduct.id,
            tenantId: dbProduct.tenant_id,
            storeId: dbProduct.store_id,
            isSharedProduct: isSharedRow,
            categoryId: dbProduct.category_id,
            name: dbProduct.name,
            description: dbProduct.description,
            sku: dbProduct.sku,
            barcode: dbProduct.barcode,
            price: parseFloatSafely(effectivePrice, 0),
            basePrice: parseFloatSafely(dbProduct.price, 0),
            costPrice: parseFloatSafely(dbProduct.cost_price, null),
            purchasePrice: parseFloatSafely(dbProduct.purchase_price, null),
            handlingCostPct: parseFloatSafely(dbProduct.handling_cost_pct, null),
            markupPct: parseFloatSafely(dbProduct.markup_pct, null),
            costCode: dbProduct.cost_code || null,
            attributes: typeof dbProduct.attributes === 'string' ? JSON.parse(dbProduct.attributes || 'null') : (dbProduct.attributes || null),
            stockQuantity: parseIntSafely(effectiveStock, 0), // Ensure this uses dbProduct.stock_quantity
            lowStockThreshold: parseIntSafely(dbProduct.low_stock_threshold, null),
            supplierId: dbProduct.supplier_id,
            isActive: Boolean(dbProduct.is_active),
            createdAt: dbProduct.created_at,
            updatedAt: dbProduct.updated_at,
            createdByUserId: dbProduct.created_by_user_id,
            updatedByUserId: dbProduct.updated_by_user_id,
            imageUrl: dbProduct.image_url,
            tags: typeof dbProduct.tags === 'string' ? JSON.parse(dbProduct.tags) : dbProduct.tags,
            brand: dbProduct.brand,
            unitOfMeasure: dbProduct.unit_of_measure,
            trackInventory: Boolean(dbProduct.track_inventory),
            specificDiscountType: dbProduct.specific_discount_type,
            specificDiscountValue: parseFloatSafely(dbProduct.specific_discount_value, null),
            taxClassId: dbProduct.tax_class_id,
            promotionalOfferId: dbProduct.promotional_offer_id, // Include promotional offer ID
            categoryName: dbProduct.category_name, // Ensure this uses dbProduct.category_name (from SQL alias)
            taxClassName: dbProduct.tax_class_name,
            // Note: weight_kg was present in original mapping but not in frontend Product type. Add if needed.
            // Jewelry weight-pricing defaults (2026-09-03_jewelry_weight_pricing_checkout_capture.sql)
            purity: dbProduct.purity || null,
            hsnCode: dbProduct.hsn_code || null,
            defaultGrossWeight: parseFloatSafely(dbProduct.default_gross_weight, null),
            defaultNetWeight: parseFloatSafely(dbProduct.default_net_weight, null),
            defaultMakingChargeType: dbProduct.default_making_charge_type || null,
            defaultMakingChargeValue: parseFloatSafely(dbProduct.default_making_charge_value, null),
            defaultWastagePct: parseFloatSafely(dbProduct.default_wastage_pct, null),
          };
        });

        // Transform image URLs to full URLs for frontend consumption
        const transformedProducts = products.map(product => ({
            ...product,
            imageUrl: ImageService.toFullUrl(product.imageUrl)
        }));

        res.status(200).json({
            status: 'success',
            results: transformedProducts.length,
            data: { products: transformedProducts }
        });
    } catch (error) {
        console.error('[Products API Router] Error fetching products:', error);
        res.status(500).json({ message: 'Error fetching products', error: error.message });
    }
});

// GET a single product by ID for the authenticated user's tenant
/**
 * @route   GET /api/products/:id
 * @desc    Get a single product by ID
 * @access  Private (requires products.read permission)
 */
router.get('/:id', requirePermission('products.view'), async (req, res) => {
    const { id } = req.params;
    const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"];
    const store_id = req.query.store_id || req.user?.store_id || req.headers['x-store-id'];
    try {
        const sql = `
            SELECT
                p.*,
                c.name as category_name,
                tc.name as tax_class_name,
                po.name as promotional_offer_name,
                po.offer_type as promotional_offer_discount_type,
                po.discount_value as promotional_offer_discount_value,
                po.start_date as promotional_offer_start_date,
                po.end_date as promotional_offer_end_date,
                spl.price AS listing_price,
                spl.stock_quantity AS listing_stock_quantity,
                spl.is_active AS listing_is_active
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id AND c.tenant_id = p.tenant_id
            LEFT JOIN tax_classes tc ON p.tax_class_id = tc.id AND tc.tenant_id = p.tenant_id
            LEFT JOIN promotional_offers po ON p.promotional_offer_id = po.id AND po.tenant_id = p.tenant_id
            LEFT JOIN store_product_listings spl
                ON spl.product_id = p.id AND spl.tenant_id = p.tenant_id AND spl.store_id = ?
            WHERE p.id = ? AND p.tenant_id = ?;
        `;
        const [rows] = await pool.query(sql, [store_id || null, id, tenant_id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Product not found or not owned by tenant.' });
        }
        const dbProduct = rows[0];
        const isSharedRow = dbProduct.store_id === null;
        const effectivePrice = isSharedRow && dbProduct.listing_price != null
          ? dbProduct.listing_price
          : dbProduct.price;
        const effectiveStock = isSharedRow
          ? parseIntSafely(dbProduct.listing_stock_quantity, 0)
          : dbProduct.stock_quantity;
        const product = {
            id: dbProduct.id,
            tenantId: dbProduct.tenant_id,
            storeId: dbProduct.store_id,
            isSharedProduct: isSharedRow,
            categoryId: dbProduct.category_id,
            name: dbProduct.name,
            description: dbProduct.description,
            sku: dbProduct.sku,
            barcode: dbProduct.barcode,
            price: parseFloatSafely(effectivePrice, 0),
            basePrice: parseFloatSafely(dbProduct.price, 0),
            costPrice: parseFloatSafely(dbProduct.cost_price, null),
            purchasePrice: parseFloatSafely(dbProduct.purchase_price, null),
            handlingCostPct: parseFloatSafely(dbProduct.handling_cost_pct, null),
            markupPct: parseFloatSafely(dbProduct.markup_pct, null),
            costCode: dbProduct.cost_code || null,
            attributes: typeof dbProduct.attributes === 'string' ? JSON.parse(dbProduct.attributes || 'null') : (dbProduct.attributes || null),
            stockQuantity: parseIntSafely(effectiveStock, 0),
            lowStockThreshold: parseIntSafely(dbProduct.low_stock_threshold, null),
            supplierId: dbProduct.supplier_id,
            isActive: Boolean(dbProduct.is_active),
            createdAt: dbProduct.created_at, // Assuming DB sends ISO string or convertible
            updatedAt: dbProduct.updated_at, // Assuming DB sends ISO string or convertible
            createdByUserId: dbProduct.created_by_user_id,
            updatedByUserId: dbProduct.updated_by_user_id,
            imageUrl: ImageService.toFullUrl(dbProduct.image_url), // Transform to full URL
            tags: typeof dbProduct.tags === 'string' ? JSON.parse(dbProduct.tags) : dbProduct.tags, // Assuming tags are stored as JSON string
            brand: dbProduct.brand,
            unitOfMeasure: dbProduct.unit_of_measure,
            trackInventory: Boolean(dbProduct.track_inventory),
            specificDiscountType: dbProduct.specific_discount_type,
            specificDiscountValue: parseFloatSafely(dbProduct.specific_discount_value, null),
            taxClassId: dbProduct.tax_class_id,
            promotionalOfferId: dbProduct.promotional_offer_id, // Include promotional offer ID
            promotionalOfferName: dbProduct.promotional_offer_name, // From JOIN
            promotionalOfferDiscountType: dbProduct.promotional_offer_discount_type, // From JOIN
            promotionalOfferDiscountValue: parseFloatSafely(dbProduct.promotional_offer_discount_value, null), // From JOIN
            promotionalOfferStartDate: dbProduct.promotional_offer_start_date, // From JOIN
            promotionalOfferEndDate: dbProduct.promotional_offer_end_date, // From JOIN
            categoryName: dbProduct.category_name, // From JOIN
            taxClassName: dbProduct.tax_class_name,   // From JOIN
            // Note: weight_kg was present in original but not in frontend Product type. Add if needed.
            // Jewelry weight-pricing defaults (2026-09-03_jewelry_weight_pricing_checkout_capture.sql)
            purity: dbProduct.purity || null,
            hsnCode: dbProduct.hsn_code || null,
            defaultGrossWeight: parseFloatSafely(dbProduct.default_gross_weight, null),
            defaultNetWeight: parseFloatSafely(dbProduct.default_net_weight, null),
            defaultMakingChargeType: dbProduct.default_making_charge_type || null,
            defaultMakingChargeValue: parseFloatSafely(dbProduct.default_making_charge_value, null),
            defaultWastagePct: parseFloatSafely(dbProduct.default_wastage_pct, null),
        };
        res.status(200).json({
            status: 'success',
            data: { product }
        });
    } catch (error) {
        console.error(`[Products API Router] Error fetching product ${id}:`, error);
        res.status(500).json({ message: 'Error fetching product', error: error.message });
    }
});

// POST a new product
/**
 * @route   POST /api/products
 * @desc    Create a new product
 * @access  Private (requires products.create permission)
 */
router.post('/', requirePermission('products.create'), withinUsageLimits('products', countTenantProducts), uploadProductImage.single('image'), enforceStorageLimitAfterUpload((req) => req.file?.path), async (req, res, next) => {
    try {
        const {
            name,
            description,
            price, // retail_price
            category_id,
            stock_quantity,
            barcode,
            sku,
            // imageUrl will be derived from req.file
            is_active, // Assuming this comes as 'true'/'false' string or boolean
            tax_class_id,
            purchase_price, // cost_price
            low_stock_threshold, // can also be reorder_point
            reorder_point, // specific field for reorder_point if used
            store_id, // Added store_id
            share_across_stores, // Create-time-only: tenant-wide shared product (products.store_id stays NULL)
            promotionalOfferId // Added for product-specific discounts
        } = req.body;

        const tenant_id_from_user = req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'];
        const user_id_from_auth = req.user?.id || 'system'; // Safe access with fallback
        const isSharedProduct = share_across_stores === 'true' || share_across_stores === true;
        // A shared product intentionally gets no store_id at all — see
        // docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §3.
        const store_id_from_user = isSharedProduct ? null : (store_id || req.user?.store_id || req.headers['x-store-id']);

        if (DEBUG_PRODUCTS) console.log('[Products API Router POST] Received req.body.is_active:', req.body.is_active);
        const isActive = is_active === 'true' || is_active === true;
        if (DEBUG_PRODUCTS) console.log('[Products API Router POST] Calculated isActive boolean:', isActive);

        // Auto-create category if it doesn't exist but category name is provided
        let finalCategoryId = null;
        // Acquire a connection with session time_zone set to store tz for all writes in this handler
        const connection = await getConnectionWithTimeZone(req.storeTz);
        try {
        if (category_id && String(category_id).trim() !== '') {
            // Check if category_id is a UUID (existing category) or a name (new category)
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(category_id);
            
            if (isUUID) {
                // Verify category exists
                const [existingCategory] = await connection.query(
                    'SELECT id FROM categories WHERE id = ? AND tenant_id = ?',
                    [category_id, tenant_id_from_user]
                );
                if (existingCategory.length > 0) {
                    finalCategoryId = category_id;
                }
            } else {
                // Treat as category name - find existing or create new
                const [existingCategory] = await connection.query(
                    'SELECT id FROM categories WHERE name = ? AND tenant_id = ?',
                    [String(category_id).trim(), tenant_id_from_user]
                );
                
                if (existingCategory.length > 0) {
                    finalCategoryId = existingCategory[0].id;
                } else {
                    // Auto-create new category
                    const newCategoryId = uuidv4();
                    await connection.query(
                        'INSERT INTO categories (id, name, tenant_id, is_active, created_at) VALUES (?, ?, ?, ?, NOW())',
                        [newCategoryId, String(category_id).trim(), tenant_id_from_user, true]
                    );
                    finalCategoryId = newCategoryId;
                    if (DEBUG_PRODUCTS) console.log(`[Product API] Auto-created category: ${category_id} with ID: ${newCategoryId}`);
                }
            }
        }

        // Handle tax class - auto-create if name provided but doesn't exist
        let finalTaxClassId = null;
        if (tax_class_id && String(tax_class_id).trim() !== '' && tax_class_id !== 'null') {
            // Check if tax_class_id is a UUID (existing tax class) or a name (new tax class)
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tax_class_id);
            
            if (isUUID) {
                // Verify tax class exists
                const [existingTaxClass] = await connection.query(
                    'SELECT id FROM tax_classes WHERE id = ? AND tenant_id = ?',
                    [tax_class_id, tenant_id_from_user]
                );
                if (existingTaxClass.length > 0) {
                    finalTaxClassId = tax_class_id;
                }
            } else {
                // Treat as tax class name - find existing or create new
                const [existingTaxClass] = await connection.query(
                    'SELECT id FROM tax_classes WHERE name = ? AND tenant_id = ?',
                    [String(tax_class_id).trim(), tenant_id_from_user]
                );
                
                if (existingTaxClass.length > 0) {
                    finalTaxClassId = existingTaxClass[0].id;
                } else {
                    // Auto-create new tax class
                    const newTaxClassId = uuidv4();
                    await connection.query(
                        'INSERT INTO tax_classes (id, name, tenant_id, store_id, is_active, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
                        [newTaxClassId, String(tax_class_id).trim(), tenant_id_from_user, store_id_from_user, true]
                    );
                    finalTaxClassId = newTaxClassId;
                    if (DEBUG_PRODUCTS) console.log(`[Product API] Auto-created tax class: ${tax_class_id} with ID: ${newTaxClassId}`);
                }
            }
            if (DEBUG_PRODUCTS) console.log(`[Product API] Using tax class: ${finalTaxClassId}`);
        } else {
            // No tax class provided - leave as null for "No Tax" products
            if (DEBUG_PRODUCTS) console.log(`[Product API] No tax class provided - product will have no tax applied`);
        }

        // Validate required fields
        const missingFields = [];
        if (name === undefined || name === null || String(name).trim() === '') missingFields.push('name');
        if (price === undefined || price === null || String(price).trim() === '') missingFields.push('price'); // price can be number or string from form
        if (stock_quantity === undefined || stock_quantity === null || String(stock_quantity).trim() === '') missingFields.push('stock_quantity');

        if (missingFields.length > 0) {
            console.error('[Products API Router] Validation Error: Missing or empty required fields:', missingFields.join(', '));
            return res.status(400).json({ message: `Missing or empty required fields: ${missingFields.join(', ')}.` });
        }

        // Construct imageUrl: 'tenant_id/products/filename.ext'
        // IMPORTANT: This assumes multer is configured to save files to 'backend/uploads/tenant_id/products/filename.ext'
        // Prepend '/uploads/' to make it a web-accessible path relative to the static serving config
        const imageUrl = req.file ? `/uploads/${path.join(tenant_id_from_user, 'products', req.file.filename).replace(/\\/g, '/')}` : null;
        // Use purchase_price for cost_price in DB. If purchase_price is not sent, default to null or 0.
        const purchase_price_for_sql = parseFloatSafely(purchase_price, null); 

        // Use low_stock_threshold if provided, otherwise fallback to reorder_point, then null.
        const reorder_point_for_sql = parseIntSafely(low_stock_threshold || reorder_point, null);

        const finalBarcode = barcode && String(barcode).trim() !== '' ? String(barcode).trim() : null;
        const finalSku = sku && String(sku).trim() !== '' ? String(sku).trim() : null;

        const newProductId = uuidv4(); // Generate a new UUID for the product

        // --- Industry dynamic attributes (additive, non-breaking) ---
        let attributesJson = null;
        try {
            const rawAttrs = req.body.attributes;
            const parsedAttrs = typeof rawAttrs === 'string' ? JSON.parse(rawAttrs || '{}') : (rawAttrs || {});
            if (parsedAttrs && Object.keys(parsedAttrs).length) {
                const { value, errors } = await industryFieldService.validateAttributes(tenant_id_from_user, 'product', parsedAttrs);
                if (errors.length) {
                    return res.status(400).json({ message: 'Attribute validation failed', errors });
                }
                attributesJson = Object.keys(value).length ? JSON.stringify(value) : null;
            }
        } catch (attrErr) {
            console.warn('[Products API] attribute processing skipped:', attrErr.message);
        }

        // --- Non-weight pricing flow: purchase -> cost -> selling ---
        const handlingCostPct = parseFloatSafely(req.body.handling_cost_pct, null);
        const markupPct = parseFloatSafely(req.body.markup_pct, null);
        const rawPurchasePrice = parseFloatSafely(req.body.purchase_price, null);
        // Effective cost price: computed from purchase+handling when both provided,
        // otherwise fall back to the legacy purchase_price->cost_price mapping.
        let effectiveCostPrice = purchase_price_for_sql;
        if (rawPurchasePrice != null && handlingCostPct != null) {
            try { effectiveCostPrice = costCodeService.computeCostPrice(rawPurchasePrice, handlingCostPct); }
            catch (_) { /* keep legacy value */ }
        }

        // --- Cost-code cipher for the price tag (best-effort) ---
        let costCodeStr = null;
        try {
            const [ccRows] = await connection.query('SELECT * FROM tenant_cost_code_settings WHERE tenant_id = ?', [tenant_id_from_user]);
            if (ccRows.length && ccRows[0].enabled && effectiveCostPrice != null) {
                const r = ccRows[0];
                costCodeStr = costCodeService.encode(effectiveCostPrice, {
                    enabled: true, prefix: r.prefix_char, suffix: r.suffix_char,
                    decimalChar: r.decimal_char, repeatChar: r.repeat_char || '',
                    digitMap: typeof r.digit_map === 'string' ? JSON.parse(r.digit_map) : r.digit_map,
                });
            }
        } catch (ccErr) {
            console.warn('[Products API] cost-code generation skipped:', ccErr.message);
        }

        // Jewelry weight-pricing defaults (2026-09-03_jewelry_weight_pricing_checkout_capture.sql)
        // — meaningless/unused for non-jewelry tenants, all nullable.
        const jewelryPurity = req.body.purity || null;
        const jewelryHsnCode = req.body.hsnCode || req.body.hsn_code || null;
        const jewelryDefaultGrossWeight = parseFloatSafely(req.body.defaultGrossWeight ?? req.body.default_gross_weight, null);
        const jewelryDefaultNetWeight = parseFloatSafely(req.body.defaultNetWeight ?? req.body.default_net_weight, null);
        const jewelryDefaultMakingChargeType = req.body.defaultMakingChargeType || req.body.default_making_charge_type || null;
        const jewelryDefaultMakingChargeValue = parseFloatSafely(req.body.defaultMakingChargeValue ?? req.body.default_making_charge_value, null);
        const jewelryDefaultWastagePct = parseFloatSafely(req.body.defaultWastagePct ?? req.body.default_wastage_pct, null);

        const sql = `INSERT INTO products (
            id, name, description, price, category_id, stock_quantity,
            barcode, sku, image_url, is_active, tenant_id,
            tax_class_id, cost_price, low_stock_threshold,
            store_id, created_by_user_id, promotional_offer_id,
            purchase_price, handling_cost_pct, markup_pct, cost_code, attributes,
            purity, hsn_code, default_gross_weight, default_net_weight,
            default_making_charge_type, default_making_charge_value, default_wastage_pct
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;

        const values = [
            newProductId, // Add the generated UUID
            name, description, price,
            finalCategoryId, // Use processed category ID (auto-created if needed)
            parseIntSafely(stock_quantity, 0),
            finalBarcode, finalSku, imageUrl, isActive, tenant_id_from_user, // Use tenant_id from authenticated user
            finalTaxClassId, // Use processed tax class ID (default if needed)
            effectiveCostPrice, // cost_price (computed from purchase+handling, or legacy mapping)
            reorder_point_for_sql, // low_stock_threshold (mapped from reorder_point or low_stock_threshold)
            store_id_from_user, // store_id from user context, or NULL for a shared product (see isSharedProduct above)
            user_id_from_auth, // created_by_user_id
            (promotionalOfferId === 'null' || promotionalOfferId === '' || promotionalOfferId === undefined || promotionalOfferId === 'undefined') ? null : String(promotionalOfferId), // promotional_offer_id as string UUID or null
            rawPurchasePrice, // purchase_price (raw supplier price)
            handlingCostPct,  // handling_cost_pct
            markupPct,        // markup_pct
            costCodeStr,      // cost_code (encoded tag)
            attributesJson,   // attributes (industry-specific JSON)
            jewelryPurity, jewelryHsnCode, jewelryDefaultGrossWeight, jewelryDefaultNetWeight,
            jewelryDefaultMakingChargeType, jewelryDefaultMakingChargeValue, jewelryDefaultWastagePct,
        ];

        // Execute SQL query
        if (DEBUG_PRODUCTS) console.log('Executing SQL:', sql); 
        if (DEBUG_PRODUCTS) console.log('Final raw sqlValues for query:', values);
        const [result] = await connection.query(sql, values); 

        // Fetch the newly created product to return it in the response
        const [newProductRows] = await connection.query(
            `SELECT p.*, c.name as category_name, tc.name as tax_class_name 
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id AND c.tenant_id = p.tenant_id
             LEFT JOIN tax_classes tc ON p.tax_class_id = tc.id AND tc.tenant_id = p.tenant_id
             WHERE p.id = ? AND p.tenant_id = ?`,
            [newProductId, tenant_id_from_user]
        );

        if (newProductRows.length === 0) {
            // This case should ideally not happen if insert was successful
            console.error('[Products API Router] Failed to fetch newly created product.');
            return res.status(500).json({ message: 'Product created but failed to retrieve details.' });
        }

        if (isSharedProduct) {
            // Give every active store in the tenant a store_product_listings
            // row so this shared product is immediately sellable everywhere.
            // The creator's own store (if known) gets the requested initial
            // stock_quantity; every other store starts at 0, same as a brand
            // new store creation does for existing shared products. See
            // docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §3.
            try {
                const creatorStoreId = req.user?.store_id || req.headers['x-store-id'] || null;
                const initialStock = parseIntSafely(stock_quantity, 0);
                const [activeStores] = await connection.query(
                    `SELECT id FROM stores WHERE tenant_id = ? AND deleted_at IS NULL`,
                    [tenant_id_from_user]
                );
                for (const s of activeStores) {
                    const startingStock = (creatorStoreId && s.id === creatorStoreId) ? initialStock : 0;
                    await connection.query(
                        `INSERT IGNORE INTO store_product_listings
                           (id, tenant_id, store_id, product_id, price, cost_price_override, stock_quantity, is_active)
                         VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)`,
                        [uuidv4(), tenant_id_from_user, s.id, newProductId, startingStock, isActive ? 1 : 0]
                    );
                }
            } catch (listingsErr) {
                console.error('[Products API Router POST] store_product_listings provisioning failed (non-blocking):', listingsErr.message);
            }
        }

        const dbProduct = newProductRows[0];
        const newlyCreatedProduct = {
            id: dbProduct.id,
            tenantId: dbProduct.tenant_id,
            storeId: dbProduct.store_id,
            categoryId: dbProduct.category_id,
            name: dbProduct.name,
            description: dbProduct.description,
            sku: dbProduct.sku,
            barcode: dbProduct.barcode,
            price: parseFloatSafely(dbProduct.price, 0),
            costPrice: parseFloatSafely(dbProduct.cost_price, null),
            purchasePrice: parseFloatSafely(dbProduct.purchase_price, null),
            handlingCostPct: parseFloatSafely(dbProduct.handling_cost_pct, null),
            markupPct: parseFloatSafely(dbProduct.markup_pct, null),
            costCode: dbProduct.cost_code || null,
            attributes: typeof dbProduct.attributes === 'string' ? JSON.parse(dbProduct.attributes || 'null') : (dbProduct.attributes || null),
            stockQuantity: parseIntSafely(dbProduct.stock_quantity, 0),
            lowStockThreshold: parseIntSafely(dbProduct.low_stock_threshold, null),
            supplierId: dbProduct.supplier_id,
            isActive: Boolean(dbProduct.is_active),
            createdAt: dbProduct.created_at,
            updatedAt: dbProduct.updated_at,
            createdByUserId: dbProduct.created_by_user_id,
            updatedByUserId: dbProduct.updated_by_user_id,
            imageUrl: dbProduct.image_url,
            tags: typeof dbProduct.tags === 'string' ? JSON.parse(dbProduct.tags) : dbProduct.tags,
            brand: dbProduct.brand,
            unitOfMeasure: dbProduct.unit_of_measure,
            trackInventory: Boolean(dbProduct.track_inventory),
            specificDiscountType: dbProduct.specific_discount_type,
            specificDiscountValue: parseFloatSafely(dbProduct.specific_discount_value, null),
            taxClassId: dbProduct.tax_class_id,
            categoryName: dbProduct.category_name,
            taxClassName: dbProduct.tax_class_name,
            purity: dbProduct.purity || null,
            hsnCode: dbProduct.hsn_code || null,
            defaultGrossWeight: parseFloatSafely(dbProduct.default_gross_weight, null),
            defaultNetWeight: parseFloatSafely(dbProduct.default_net_weight, null),
            defaultMakingChargeType: dbProduct.default_making_charge_type || null,
            defaultMakingChargeValue: parseFloatSafely(dbProduct.default_making_charge_value, null),
            defaultWastagePct: parseFloatSafely(dbProduct.default_wastage_pct, null),
        };

        if (DEBUG_PRODUCTS) console.log(`[Products API Router] Product created successfully. MySQL insertId: ${newProductId}`);

        // Log product creation activity
        try {
          await logActivity({
            tenant_id: tenant_id_from_user, // req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"]
            user_id: req.user?.id || "system",
            username: req.user?.email || "system@example.com", // Assuming req.user has email
            action_type: 'PRODUCT_CREATED',
            description: `Product "${newlyCreatedProduct.name}" (ID: ${newlyCreatedProduct.id}) created.`,
            details: {
              productId: newlyCreatedProduct.id,
              productName: newlyCreatedProduct.name,
              sku: newlyCreatedProduct.sku,
              price: newlyCreatedProduct.price,
              categoryId: newlyCreatedProduct.categoryId
            },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
          });
        } catch (logError) {
          console.error('[Products API Router] Failed to log product creation activity:', logError);
          // Do not let logging failure prevent sending response to client
        }

        res.status(201).json({
            status: 'success',
            message: 'Product created successfully',
            data: { product: newlyCreatedProduct } // Return the full product object
        });
        } finally {
          // Always release the connection
          connection.release();
        }
    } catch (error) {
        console.error('[Products API Router] Error creating product:', error);
        // If an image was uploaded but an error occurred later, delete the temp file
        if (req.file && req.file.path) {
            await fs.unlink(req.file.path).catch(err => console.error("Error deleting temp file after validation fail:", err));
        }
        if (error.code === 'ER_DUP_ENTRY') {
            if (error.sqlMessage && error.sqlMessage.toLowerCase().includes('primary')) {
                console.error('[Products API Router POST] Duplicate entry for PRIMARY KEY:', error.sqlMessage);
                return res.status(500).json({ message: 'Error creating product due to a primary key conflict. Please try again or contact support.' });
            } else if (error.sqlMessage && error.sqlMessage.toLowerCase().includes('sku')) {
                return res.status(409).json({ message: 'Product with this SKU already exists for your tenant.' });
            } else {
                // Other unique constraint violation
                console.error('[Products API Router POST] Duplicate entry for other unique constraint:', error.sqlMessage);
                return res.status(409).json({ message: 'A similar product entry already exists. Please check unique fields.' });
            }
        }
        // For other errors, send a generic 500 response
        res.status(500).json({ message: 'Error creating product', error: error.message });
    }
});

// PUT update an existing product
/**
 * @route   PUT /api/products/:id
 * @desc    Update an existing product
 * @access  Private (requires products.update permission)
 */
router.put('/:id', requirePermission('products.update'), uploadProductImage.single('image'), enforceStorageLimitAfterUpload((req) => req.file?.path), async (req, res) => {
    const { id: productId } = req.params;
    const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"];
    const store_id = req.user?.store_id || req.query?.store_id || req.headers['x-store-id'];

    // Acquire a connection with session time_zone set to store tz for all writes in this handler
    const connection = await getConnectionWithTimeZone(req.storeTz);
    
    try {
        const {
            name,
            description,
            price,
            category_id,
            stock_quantity,
            barcode,
            sku,
            is_active,
            supplier_id,
            tax_class_id,
            purchase_price, // cost_price
            low_stock_threshold, // or reorder_point
            reorder_point,
            image_url, // To handle cases where image might be removed or changed without new upload
            promotionalOfferId // Added for product-specific discounts
        } = req.body;

        // SKU Uniqueness Check (if SKU is being provided in the update)
        if (sku !== undefined && sku !== null && sku !== '') { // Check if SKU is part of the update attempt
            const [existingSkuRows] = await connection.query(
                'SELECT id FROM products WHERE sku = ? AND tenant_id = ? AND id != ?',
                [sku, tenant_id, productId]
            );
            if (existingSkuRows.length > 0) {
                return res.status(409).json({ message: 'Another product with this SKU already exists for your tenant.' });
            }
        }

        // Fetch existing product to compare image and potentially delete old one
        const [existingProductRows] = await connection.query('SELECT image_url, sku FROM products WHERE id = ? AND tenant_id = ?', [productId, tenant_id]);
        if (existingProductRows.length === 0) {
            if (req.file && req.file.path) { // If a new file was uploaded for a non-existent product
                await fs.unlink(req.file.path).catch(err => console.error("Error deleting temp file for non-existent product update:", err));
            }
            connection.release();
            return res.status(404).json({ message: 'Product not found or not owned by tenant.' });
        }
        
        // Validate promotionalOfferId existence when provided (non-empty and not 'null'/'undefined')
        if (promotionalOfferId !== undefined && promotionalOfferId !== null && promotionalOfferId !== '' && promotionalOfferId !== 'null' && promotionalOfferId !== 'undefined') {
            let promoCheckSql = 'SELECT id FROM promotional_offers WHERE id = ? AND tenant_id = ?';
            const promoParams = [String(promotionalOfferId), tenant_id];
            if (store_id) {
                promoCheckSql += ' AND store_id = ?';
                promoParams.push(store_id);
            }
            const [promoRows] = await connection.query(promoCheckSql, promoParams);
            if (!promoRows || promoRows.length === 0) {
                // If a new image was uploaded but validation fails, clean up temp file
                if (req.file && req.file.path) {
                    await fs.unlink(req.file.path).catch(err => console.error("Error deleting temp file after promo validation fail:", err));
                }
                connection.release();
                return res.status(400).json({ message: 'Invalid promotionalOfferId: promotional offer not found for this tenant/store.' });
            }
        }
        const existingImageUrl = existingProductRows[0].image_url;

        let newImageUrl = existingImageUrl; // Default to existing image
        if (req.file) { // New image uploaded
            // Prepend '/uploads/' to make it a web-accessible path
            newImageUrl = `/uploads/${path.join(tenant_id, 'products', req.file.filename).replace(/\\/g, '/')}`;
            // If there was an old image and a new one is uploaded, delete the old one.
            if (existingImageUrl && existingImageUrl.startsWith('/uploads/')) { // Only delete from uploads
                const oldImageSystemPath = path.join(__dirname, '..', existingImageUrl);
                if (DEBUG_PRODUCTS) console.log(`[Products API Router PUT] Attempting to delete old image: ${oldImageSystemPath}`);
                await unlinkIfExists(oldImageSystemPath, fs); // Use fs.promises via helper
            }
        } else if (req.body.image_url === '' || req.body.image_url === null) {
            // Image explicitly removed by client by sending empty/null image_url
            newImageUrl = null;
            if (existingImageUrl && existingImageUrl.startsWith('/uploads/')) {
                const oldImageSystemPath = path.join(__dirname, '..', existingImageUrl);
                if (DEBUG_PRODUCTS) console.log(`[Products API Router PUT] Attempting to delete removed image: ${oldImageSystemPath}`);
                await unlinkIfExists(oldImageSystemPath, fs); 
            }
        }
        // If no new file and image_url not explicitly cleared, newImageUrl remains existingImageUrl


        const updateFields = [];
        const values = [];

        // Helper to add field to update if it's provided in the request body
        const addUpdateField = (fieldName, value, isNumeric = false, isFloat = false) => {
            if (value !== undefined && value !== null) { // Check for undefined or null to allow clearing fields with empty string
                updateFields.push(`${fieldName} = ?`);
                if (isNumeric) {
                    values.push(isFloat ? parseFloatSafely(value, null) : parseIntSafely(value, null));
                } else {
                    values.push(value);
                }
            }
        };

        // Convert empty strings for barcode and sku to null for DB storage
        const finalBarcode = (barcode === '') ? null : barcode;
        const finalSku = (sku === '') ? null : sku;

        addUpdateField('name', name);
        addUpdateField('description', description);
        addUpdateField('price', price, true, true);
        addUpdateField('category_id', category_id);
        
        // Block stock quantity updates during product edit - use stock adjustment instead
        if (stock_quantity !== undefined && stock_quantity !== null) {
            if (req.file && req.file.path) {
                await fs.unlink(req.file.path).catch(err => console.error("Error deleting temp file after stock validation fail:", err));
            }
            connection.release();
            return res.status(400).json({ 
                message: 'Stock quantity cannot be updated through product edit. Use Stock Adjustment feature instead.' 
            });
        }
        
        addUpdateField('barcode', finalBarcode); // Use the modified value
        // Only add SKU to update if it's actually provided in the request body
        // The uniqueness check above already validated it if it was provided.
        if (sku !== undefined) { // Allow setting SKU to null/empty if desired by sending sku: '' or sku: null
            addUpdateField('sku', finalSku);
        }
        if (newImageUrl !== existingImageUrl) { // Only update image_url if it has changed
            addUpdateField('image_url', newImageUrl);
        }
        if (is_active !== undefined && is_active !== null) {
            addUpdateField('is_active', is_active === 'true' || is_active === true);
        }
        // Handle tax_class_id specially - it's a UUID string, not a number
        if (tax_class_id === 'null' || tax_class_id === '') {
            // Explicitly set to NULL when 'null' string is received
            updateFields.push('tax_class_id = ?');
            values.push(null);
        } else if (tax_class_id !== undefined) {
            // Otherwise treat as string UUID
            updateFields.push('tax_class_id = ?');
            values.push(String(tax_class_id));
        }
        addUpdateField('cost_price', purchase_price, true, true);

        const finalLowStockThreshold = low_stock_threshold !== undefined ? low_stock_threshold : reorder_point;
        addUpdateField('low_stock_threshold', finalLowStockThreshold, true);

        // Jewelry weight-pricing defaults (2026-09-03_jewelry_weight_pricing_checkout_capture.sql)
        // — meaningless/unused for non-jewelry tenants. Read directly off req.body
        // (camelCase from ProductFormModal) with a snake_case fallback, same
        // pattern as the POST handler above.
        addUpdateField('purity', req.body.purity);
        addUpdateField('hsn_code', req.body.hsnCode ?? req.body.hsn_code);
        addUpdateField('default_gross_weight', req.body.defaultGrossWeight ?? req.body.default_gross_weight, true, true);
        addUpdateField('default_net_weight', req.body.defaultNetWeight ?? req.body.default_net_weight, true, true);
        addUpdateField('default_making_charge_type', req.body.defaultMakingChargeType ?? req.body.default_making_charge_type);
        addUpdateField('default_making_charge_value', req.body.defaultMakingChargeValue ?? req.body.default_making_charge_value, true, true);
        addUpdateField('default_wastage_pct', req.body.defaultWastagePct ?? req.body.default_wastage_pct, true, true);
        
        // Handle promotional_offer_id specially - it's a UUID string, similar to tax_class_id
        if (promotionalOfferId === 'null' || promotionalOfferId === '' || promotionalOfferId === undefined || promotionalOfferId === 'undefined') {
            // Explicitly set to NULL when 'null' string is received
            updateFields.push('promotional_offer_id = ?');
            values.push(null);
        } else if (promotionalOfferId !== undefined) {
            // Otherwise treat as string UUID
            updateFields.push('promotional_offer_id = ?');
            values.push(String(promotionalOfferId));
        }

        if (updateFields.length === 0 && newImageUrl === existingImageUrl) {
            // If a file was uploaded but no other fields changed, it might be an image-only update handled by newImageUrl logic.
            // If no fields changed AND image didn't change (no new upload, not cleared), then nothing to update.
            if (req.file && newImageUrl !== existingImageUrl) { // A new file was uploaded, and it's different, but other fields were same.
                 // This case is tricky. If only image changed, updateFields might be empty.
                 // The addUpdateField for image_url should handle this.
            } else if (!req.file) {
                 // No changes detected: still return the current product object for frontend sync
                 const [rows] = await connection.query(
                    `SELECT 
                        p.*, 
                        c.name as category_name, 
                        tc.name as tax_class_name,
                        po.name as promotional_offer_name,
                        po.offer_type as promotional_offer_discount_type,
                        po.discount_value as promotional_offer_discount_value,
                        po.start_date as promotional_offer_start_date,
                        po.end_date as promotional_offer_end_date
                     FROM products p
                     LEFT JOIN categories c ON p.category_id = c.id AND c.tenant_id = p.tenant_id
                     LEFT JOIN tax_classes tc ON p.tax_class_id = tc.id AND tc.tenant_id = p.tenant_id
                     LEFT JOIN promotional_offers po ON p.promotional_offer_id = po.id AND po.tenant_id = p.tenant_id
                     WHERE p.id = ? AND p.tenant_id = ?;`,
                     [productId, tenant_id]
                 );
                 if (!rows || rows.length === 0) {
                    connection.release();
                    return res.status(404).json({ message: 'Product not found or not owned by tenant.' });
                 }
                 const dbProduct = rows[0];
                 const product = {
                    id: dbProduct.id,
                    tenantId: dbProduct.tenant_id,
                    storeId: dbProduct.store_id,
                    categoryId: dbProduct.category_id,
                    name: dbProduct.name,
                    description: dbProduct.description,
                    sku: dbProduct.sku,
                    barcode: dbProduct.barcode,
                    price: parseFloatSafely(dbProduct.price, 0),
                    costPrice: parseFloatSafely(dbProduct.cost_price, null),
                    stockQuantity: parseIntSafely(dbProduct.stock_quantity, 0),
                    lowStockThreshold: parseIntSafely(dbProduct.low_stock_threshold, null),
                    supplierId: dbProduct.supplier_id,
                    isActive: Boolean(dbProduct.is_active),
                    createdAt: dbProduct.created_at,
                    updatedAt: dbProduct.updated_at,
                    createdByUserId: dbProduct.created_by_user_id,
                    updatedByUserId: dbProduct.updated_by_user_id,
                    imageUrl: ImageService.toFullUrl(dbProduct.image_url),
                    tags: typeof dbProduct.tags === 'string' ? JSON.parse(dbProduct.tags) : dbProduct.tags,
                    brand: dbProduct.brand,
                    unitOfMeasure: dbProduct.unit_of_measure,
                    trackInventory: Boolean(dbProduct.track_inventory),
                    specificDiscountType: dbProduct.specific_discount_type,
                    specificDiscountValue: parseFloatSafely(dbProduct.specific_discount_value, null),
                    taxClassId: dbProduct.tax_class_id,
                    promotionalOfferId: dbProduct.promotional_offer_id,
                    promotionalOfferName: dbProduct.promotional_offer_name,
                    promotionalOfferDiscountType: dbProduct.promotional_offer_discount_type,
                    promotionalOfferDiscountValue: parseFloatSafely(dbProduct.promotional_offer_discount_value, null),
                    promotionalOfferStartDate: dbProduct.promotional_offer_start_date,
                    promotionalOfferEndDate: dbProduct.promotional_offer_end_date,
                    categoryName: dbProduct.category_name,
                    taxClassName: dbProduct.tax_class_name,
                    purity: dbProduct.purity || null,
                    hsnCode: dbProduct.hsn_code || null,
                    defaultGrossWeight: parseFloatSafely(dbProduct.default_gross_weight, null),
                    defaultNetWeight: parseFloatSafely(dbProduct.default_net_weight, null),
                    defaultMakingChargeType: dbProduct.default_making_charge_type || null,
                    defaultMakingChargeValue: parseFloatSafely(dbProduct.default_making_charge_value, null),
                    defaultWastagePct: parseFloatSafely(dbProduct.default_wastage_pct, null),
                 };
                 const responsePayload = {
                    status: 'success',
                    message: 'No changes detected. Returning current product.',
                    data: { product }
                 };
                 connection.release();
                 return res.status(200).json(responsePayload);
            }
        }

        if (DEBUG_PRODUCTS) console.log(`[Product Update ${productId}] updateFields prepared:`, JSON.stringify(updateFields, null, 2));
        if (DEBUG_PRODUCTS) console.log(`[Product Update ${productId}] values prepared for SQL:`, JSON.stringify(values, null, 2));

        const sql = `UPDATE products SET ${updateFields.join(', ')} WHERE id = ? AND tenant_id = ?`;
        values.push(productId, tenant_id); 

        if (DEBUG_PRODUCTS) console.log('Final raw sqlValues for query (UPDATE):', values);
        if (DEBUG_PRODUCTS) console.log(`[Product Update ${productId}] Final SQL query:`, sql);
        if (DEBUG_PRODUCTS) console.log(`[Product Update ${productId}] WHERE conditions: id=${productId}, tenant_id=${tenant_id}`);
        
        // Debug: Check if product exists with these exact conditions
        const [checkRows] = await connection.execute(
            'SELECT id, tenant_id, name FROM products WHERE id = ? AND tenant_id = ?', 
            [productId, tenant_id]
        );
        if (DEBUG_PRODUCTS) console.log(`[Product Update ${productId}] Pre-update check - found ${checkRows.length} matching products:`, checkRows);
        
        if (checkRows.length === 0) {
            if (DEBUG_PRODUCTS) console.log(`[Product Update ${productId}] ERROR: No product found with id=${productId} and tenant_id=${tenant_id}`);
            // Check if product exists with different tenant_id
            const [allRows] = await connection.execute('SELECT id, tenant_id, name FROM products WHERE id = ?', [productId]);
            if (DEBUG_PRODUCTS) console.log(`[Product Update ${productId}] Product exists with different tenant_id:`, allRows);
        }

        const [result] = await connection.execute(sql, values);
        
        if (DEBUG_PRODUCTS) console.log(`[Product Update ${productId}] UPDATE result:`, {
            affectedRows: result.affectedRows,
            changedRows: result.changedRows,
            insertId: result.insertId,
            info: result.info
        });

        // Check if the update failed due to no matching rows vs no changes needed
        if (result.affectedRows === 0) {
            // Parse the MySQL info string to check if rows were matched
            const infoString = result.info || '';
            const rowsMatchedMatch = infoString.match(/Rows matched: (\d+)/);
            const rowsMatched = rowsMatchedMatch ? parseInt(rowsMatchedMatch[1], 10) : 0;
            
            if (DEBUG_PRODUCTS) console.log(`[Product Update ${productId}] Analysis: rowsMatched=${rowsMatched}, affectedRows=${result.affectedRows}, changedRows=${result.changedRows}`);
            
            if (rowsMatched > 0) {
                // Product was found but no changes were needed (values are identical)
                if (DEBUG_PRODUCTS) console.log(`[Product Update ${productId}] Success: Product found but no changes needed (values identical)`);
                // This is actually a successful update - no changes were needed
            } else {
                // Product was not found or not owned by tenant
                if (DEBUG_PRODUCTS) console.log(`[Product Update ${productId}] Error: Product not found or not owned by tenant`);
                // If a new image was uploaded but the DB update affected 0 rows (e.g. product not found for tenant)
                // we should delete the newly uploaded temp file.
                if (req.file && newImageUrl && newImageUrl.startsWith('/uploads/')) {
                    const tempFilePath = path.join(__dirname, '..', newImageUrl);
                    await unlinkIfExists(tempFilePath, fs); // Use fs.promises via helper
                }
                connection.release();
                return res.status(404).json({ message: 'Product not found or not owned by tenant.' });
            }
        }

        if (DEBUG_PRODUCTS) console.log(`[Products API Router] Product ${productId} updated successfully.`);

        // Log product update activity
        try {
          const productNameForLog = req.body.name || 'N/A'; // Use name from request if available
          await logActivity({
            tenant_id: tenant_id, // req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"]
            user_id: req.user?.id || "system",
            username: req.user?.email || "system@example.com", // Assuming req.user has email
            action_type: 'PRODUCT_UPDATED',
            description: `Product "${productNameForLog}" (ID: ${productId}) updated.`,
            details: {
              productId: productId,
              updatedFields: updateFields, // Array of column names that were updated
              requestedChanges: req.body // Log the entire request body for audit details
            },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
          });
        } catch (logError) {
          console.error('[Products API Router] Failed to log product update activity:', logError);
          // Do not let logging failure prevent sending response to client
        }

        // Fetch and return the updated product for frontend synchronization
        const [updatedRows] = await connection.query(
            `SELECT 
                p.*, 
                c.name as category_name, 
                tc.name as tax_class_name,
                po.name as promotional_offer_name,
                po.offer_type as promotional_offer_discount_type,
                po.discount_value as promotional_offer_discount_value,
                po.start_date as promotional_offer_start_date,
                po.end_date as promotional_offer_end_date
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id AND c.tenant_id = p.tenant_id
             LEFT JOIN tax_classes tc ON p.tax_class_id = tc.id AND tc.tenant_id = p.tenant_id
             LEFT JOIN promotional_offers po ON p.promotional_offer_id = po.id AND po.tenant_id = p.tenant_id
             WHERE p.id = ? AND p.tenant_id = ?;`,
            [productId, tenant_id]
        );
        if (!updatedRows || updatedRows.length === 0) {
            connection.release();
            return res.status(404).json({ message: 'Product not found after update.' });
        }
        const dbProduct = updatedRows[0];
        const updatedProduct = {
            id: dbProduct.id,
            tenantId: dbProduct.tenant_id,
            storeId: dbProduct.store_id,
            categoryId: dbProduct.category_id,
            name: dbProduct.name,
            description: dbProduct.description,
            sku: dbProduct.sku,
            barcode: dbProduct.barcode,
            price: parseFloatSafely(dbProduct.price, 0),
            costPrice: parseFloatSafely(dbProduct.cost_price, null),
            purchasePrice: parseFloatSafely(dbProduct.purchase_price, null),
            handlingCostPct: parseFloatSafely(dbProduct.handling_cost_pct, null),
            markupPct: parseFloatSafely(dbProduct.markup_pct, null),
            costCode: dbProduct.cost_code || null,
            attributes: typeof dbProduct.attributes === 'string' ? JSON.parse(dbProduct.attributes || 'null') : (dbProduct.attributes || null),
            stockQuantity: parseIntSafely(dbProduct.stock_quantity, 0),
            lowStockThreshold: parseIntSafely(dbProduct.low_stock_threshold, null),
            supplierId: dbProduct.supplier_id,
            isActive: Boolean(dbProduct.is_active),
            createdAt: dbProduct.created_at,
            updatedAt: dbProduct.updated_at,
            createdByUserId: dbProduct.created_by_user_id,
            updatedByUserId: dbProduct.updated_by_user_id,
            imageUrl: ImageService.toFullUrl(dbProduct.image_url),
            tags: typeof dbProduct.tags === 'string' ? JSON.parse(dbProduct.tags) : dbProduct.tags,
            brand: dbProduct.brand,
            unitOfMeasure: dbProduct.unit_of_measure,
            trackInventory: Boolean(dbProduct.track_inventory),
            specificDiscountType: dbProduct.specific_discount_type,
            specificDiscountValue: parseFloatSafely(dbProduct.specific_discount_value, null),
            taxClassId: dbProduct.tax_class_id,
            promotionalOfferId: dbProduct.promotional_offer_id,
            promotionalOfferName: dbProduct.promotional_offer_name,
            promotionalOfferDiscountType: dbProduct.promotional_offer_discount_type,
            promotionalOfferDiscountValue: parseFloatSafely(dbProduct.promotional_offer_discount_value, null),
            promotionalOfferStartDate: dbProduct.promotional_offer_start_date,
            promotionalOfferEndDate: dbProduct.promotional_offer_end_date,
            categoryName: dbProduct.category_name,
            taxClassName: dbProduct.tax_class_name,
            purity: dbProduct.purity || null,
            hsnCode: dbProduct.hsn_code || null,
            defaultGrossWeight: parseFloatSafely(dbProduct.default_gross_weight, null),
            defaultNetWeight: parseFloatSafely(dbProduct.default_net_weight, null),
            defaultMakingChargeType: dbProduct.default_making_charge_type || null,
            defaultMakingChargeValue: parseFloatSafely(dbProduct.default_making_charge_value, null),
            defaultWastagePct: parseFloatSafely(dbProduct.default_wastage_pct, null),
        };

        const successPayload = {
            status: 'success',
            message: 'Product updated successfully',
            data: { product: updatedProduct }
        };
        connection.release();
        return res.status(200).json(successPayload);

    } catch (error) {
        console.error(`[Products API Router] Error updating product ${productId}:`, error);
        // If a new image was uploaded but an error occurred during the process, delete the temp file.
        if (req.file && req.file.path) {
            await fs.unlink(req.file.path).catch(err => console.error("Error deleting temp file after update error:", err));
        }
        if (error.code === 'ER_DUP_ENTRY') {
            let conflictMessage = 'A conflict occurred. This value may already exist for another product.';
            if (error.sqlMessage && error.sqlMessage.toLowerCase().includes('unique_sku_per_tenant')) {
                conflictMessage = 'Product with this SKU already exists for your tenant.';
            } else if (error.sqlMessage && error.sqlMessage.toLowerCase().includes('unique_barcode_per_tenant')) {
                conflictMessage = 'Product with this Barcode already exists for your tenant.';
            }
            return res.status(409).json({ message: conflictMessage });
        }
        res.status(500).json({ message: 'Error updating product', error: error.message });
    } finally {
        // Always release the connection
        connection.release();
    }
});

// DELETE a product by ID for the authenticated user's tenant
router.delete('/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"];
    try {
        // Optional: Fetch product to get image_url for deletion if stored locally
        const [productRows] = await pool.query('SELECT image_url FROM products WHERE id = ? AND tenant_id = ?', [id, tenant_id]);
        if (productRows.length > 0 && productRows[0].image_url) {
            const imageUrl = productRows[0].image_url;
            if (imageUrl.startsWith('/uploads/')) { // Only delete from uploads
                const imagePath = path.join(__dirname, '..', imageUrl);
                await unlinkIfExists(imagePath, fs); // Use fs.promises via helper
            }
        }

        const [result] = await pool.query('DELETE FROM products WHERE id = ? AND tenant_id = ?', [id, tenant_id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Product not found or not owned by tenant.' });
        }
        res.status(200).json({ 
            status: 'success',
            message: 'Product deleted successfully' 
        });
    } catch (error) {
        console.error(`[Products API Router] Error deleting product ${id}:`, error);
        res.status(500).json({ message: 'Error deleting product', error: error.message });
    }
});

// PATCH update product stock (for stock adjustments)
/**
 * @route   PATCH /api/products/:id/stock
 * @desc    Update product stock level
 * @access  Private (requires inventory.adjust permission)
 */
router.patch('/:id/stock', requirePermission('inventory.adjust'), async (req, res) => {
    const { id: productId } = req.params;
    const { new_stock_level, adjustment_type, reason, notes } = req.body;
    const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'];
    const user_id = req.user?.id || 'system'; // Safe access with fallback

    if (new_stock_level === undefined || new_stock_level === null || isNaN(parseInt(new_stock_level))) {
        return res.status(400).json({ message: 'New stock level is required and must be a number.' });
    }

    const newStockLevel = parseInt(new_stock_level, 10);

    const store_id = req.user?.store_id || req.query?.store_id || req.headers['x-store-id']; // Safe access with fallbacks

    const connection = await getConnectionWithTimeZone(req.storeTz);
    try {
        await connection.beginTransaction();

        // Get current stock level (and whether this is a store-owned or
        // tenant-shared product — a shared product's stock lives per-store in
        // store_product_listings, not on the products row).
        const [currentStockRows] = await connection.execute(
            'SELECT store_id, stock_quantity FROM products WHERE id = ? AND tenant_id = ? FOR UPDATE',
            [productId, tenant_id]
        );

        if (currentStockRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Product not found or not owned by tenant.' });
        }
        const isSharedProduct = currentStockRows[0].store_id === null;

        let currentStockQuantity;
        if (isSharedProduct) {
            if (!store_id) {
                await connection.rollback();
                return res.status(400).json({ message: 'store_id is required to adjust stock for a shared product.' });
            }
            const listing = await storeProductListingService.getListing(tenant_id, store_id, productId);
            currentStockQuantity = listing ? listing.stock_quantity : 0;
        } else {
            currentStockQuantity = parseInt(currentStockRows[0].stock_quantity, 10);
        }
        const quantityChanged = newStockLevel - currentStockQuantity;

        // Update stock level — shared products via their per-store listing,
        // store-owned products on the products row itself as before.
        if (isSharedProduct) {
            await connection.execute(
                `INSERT INTO store_product_listings (id, tenant_id, store_id, product_id, price, cost_price_override, stock_quantity, is_active)
                 VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)
                 ON DUPLICATE KEY UPDATE stock_quantity = VALUES(stock_quantity)`,
                [uuidv4(), tenant_id, store_id, productId, newStockLevel]
            );
        } else {
            const [updateResult] = await connection.execute(
                'UPDATE products SET stock_quantity = ? WHERE id = ? AND tenant_id = ?',
                [newStockLevel, productId, tenant_id]
            );
            if (updateResult.affectedRows === 0) {
                // This case should ideally be caught by the SELECT FOR UPDATE if product doesn't exist
                await connection.rollback();
                return res.status(404).json({ message: 'Product not found, not owned by tenant, or stock level already up-to-date.' });
            }
        }

        // Log the stock adjustment
        const stockAdjustmentId = uuidv4();

        // Determine adjustment_type for ENUM
        let dbAdjustmentType;
        if (quantityChanged > 0) {
            dbAdjustmentType = 'INCREMENT';
        } else if (quantityChanged < 0) {
            dbAdjustmentType = 'DECREMENT';
        } else {
            // If quantityChanged is 0, arguably no adjustment log is needed,
            // or use a specific type like 'NO_CHANGE'. For now, let's assume it implies a type.
            // If your enum doesn't allow null or other values, this needs a decision.
            // Defaulting to 'CORRECTION' if no change, or handle as error/skip logging.
            dbAdjustmentType = 'CORRECTION'; // Or handle appropriately if quantityChanged is 0
        }

        const logSql = `INSERT INTO stock_adjustments (
                            id, tenant_id, store_id, product_id, user_id, 
                            adjustment_type, reason_code, 
                            quantity_adjusted, stock_before_adjustment, stock_after_adjustment, 
                            notes, adjustment_date
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`; // NOW() for adjustment_date
        
        // For reason_code, since 'reason' from req.body is undefined in this POS flow,
        // we'll use a default. 'SALE_TRANSACTION' or 'POS_SALE' might be suitable.
        // If adjustment_type (from req.body) was defined, it could inform reason_code.
        const reasonCodeFromBody = req.body.reason_code || req.body.reason; // Check if client sends reason_code
        const finalReasonCode = reasonCodeFromBody || (dbAdjustmentType === 'DECREMENT' ? 'SALE_TRANSACTION' : 'MANUAL_UPDATE');

        await connection.execute(logSql, [
            stockAdjustmentId, tenant_id, store_id, productId, user_id,
            dbAdjustmentType, 
            finalReasonCode, // Use a default or map from input
            Math.abs(quantityChanged), // quantity_adjusted is unsigned
            currentStockQuantity, 
            newStockLevel,
            req.body.notes === undefined ? null : req.body.notes, // notes from req.body
        ]);

        await connection.commit();

        // Log stock adjustment activity
        try {
          await logActivity({
            tenant_id: tenant_id,
            user_id: user_id,
            username: req.user?.email || "system@example.com", // Assuming req.user has email
            action_type: 'PRODUCT_STOCK_ADJUSTED',
            description: `Stock for product ID ${productId} adjusted from ${currentStockQuantity} to ${newStockLevel}. Change: ${quantityChanged}.`,
            details: {
              productId: productId,
              oldStock: currentStockQuantity,
              newStock: newStockLevel,
              quantityChanged: quantityChanged,
              adjustmentType: dbAdjustmentType, // INCREMENT, DECREMENT, CORRECTION
              reasonCode: finalReasonCode,
              notes: req.body.notes || null,
              storeId: store_id
            },
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
          });
        } catch (logError) {
          console.error('[Products API Router] Failed to log stock adjustment activity:', logError);
          // Do not let logging failure prevent sending response to client
        }

        res.status(200).json({
            status: 'success',
            message: 'Product stock updated successfully.',
            data: { productId, newStockLevel }
        });

    } catch (error) {
        await connection.rollback();
        console.error(`[Products API Router] Error updating stock for product ${productId}:`, error);
        res.status(500).json({ message: 'Error updating product stock', error: error.message });
    } finally {
        connection.release();
    }
});

// GET per-store price/stock listings for a tenant-wide shared product
/**
 * @route   GET /api/products/:id/store-listings
 * @desc    List every store's store_product_listings row for a shared
 *          product, joined with the store name, so the product edit page can
 *          show a per-store pricing/stock table. 404s for a store-owned
 *          product — this only applies to products.store_id IS NULL. See
 *          docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §3.
 * @access  Private (requires products.view permission)
 */
router.get('/:id/store-listings', requirePermission('products.view'), async (req, res) => {
    const { id: productId } = req.params;
    const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'];
    try {
        const [productRows] = await pool.query(
            'SELECT store_id, price AS base_price FROM products WHERE id = ? AND tenant_id = ?',
            [productId, tenant_id]
        );
        if (!productRows.length) {
            return res.status(404).json({ message: 'Product not found or not owned by tenant.' });
        }
        if (productRows[0].store_id !== null) {
            return res.status(400).json({ message: 'This product is store-owned, not shared — it has no per-store listings.' });
        }

        const [rows] = await pool.query(
            `SELECT s.id AS store_id, s.name AS store_name,
                    spl.id AS listing_id, spl.price, spl.cost_price_override,
                    spl.stock_quantity, spl.is_active
             FROM stores s
             LEFT JOIN store_product_listings spl
               ON spl.store_id = s.id AND spl.product_id = ? AND spl.tenant_id = s.tenant_id
             WHERE s.tenant_id = ? AND s.deleted_at IS NULL
             ORDER BY s.name ASC`,
            [productId, tenant_id]
        );

        res.status(200).json({
            status: 'success',
            data: {
                basePrice: parseFloatSafely(productRows[0].base_price, 0),
                listings: rows.map((r) => ({
                    storeId: r.store_id,
                    storeName: r.store_name,
                    listingId: r.listing_id,
                    price: r.price != null ? parseFloatSafely(r.price, null) : null,
                    costPriceOverride: r.cost_price_override != null ? parseFloatSafely(r.cost_price_override, null) : null,
                    stockQuantity: parseIntSafely(r.stock_quantity, 0),
                    isActive: r.is_active == null ? true : Boolean(r.is_active),
                })),
            },
        });
    } catch (error) {
        console.error(`[Products API Router] Error fetching store listings for product ${productId}:`, error);
        res.status(500).json({ message: 'Error fetching store listings', error: error.message });
    }
});

// PATCH a single store's price/active override for a shared product
/**
 * @route   PATCH /api/products/:id/store-listings/:storeId
 * @desc    Update the price override / active flag for a shared product at
 *          one store. Stock is intentionally NOT settable here — it goes
 *          through the existing stock-adjustment flow (PATCH /:id/stock with
 *          this store's context), same as a store-owned product, so every
 *          stock change gets its stock_adjustments audit row.
 * @access  Private (requires products.update permission)
 */
router.patch('/:id/store-listings/:storeId', requirePermission('products.update'), async (req, res) => {
    const { id: productId, storeId } = req.params;
    const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'];
    const { price, costPriceOverride, isActive } = req.body || {};
    try {
        const listing = await storeProductListingService.upsertListing(tenant_id, storeId, productId, {
            price: price === '' || price === null || price === undefined ? null : Number(price),
            costPriceOverride: costPriceOverride === '' || costPriceOverride === null || costPriceOverride === undefined ? null : Number(costPriceOverride),
            isActive: isActive === undefined ? undefined : Boolean(isActive),
        });
        res.status(200).json({ status: 'success', data: listing });
    } catch (error) {
        console.error(`[Products API Router] Error updating store listing for product ${productId}, store ${storeId}:`, error);
        res.status(400).json({ message: error.message || 'Error updating store listing' });
    }
});

module.exports = router;
