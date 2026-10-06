const { query } = require('../config/db');

/**
 * Get products with inventory information
 */
const getProducts = async (tenant_id, store_id, options = {}) => {
  try {
    // Validate inputs
    if (!tenant_id || !store_id) {
      throw new Error('tenant_id and store_id are required');
    }
    
    const { limit = 50, offset = 0, search = '', category_id = null } = options;
    
    let sql = `
      SELECT
        p.id,
        p.name,
        p.sku,
        p.barcode,
        p.category_id,
        p.store_id,
        p.price,
        p.cost_price,
        p.stock_quantity,
        p.low_stock_threshold,
        p.is_active,
        c.name as category_name,
        spl.price AS listing_price,
        spl.stock_quantity AS listing_stock_quantity,
        spl.is_active AS listing_is_active
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN store_product_listings spl
        ON spl.product_id = p.id AND spl.tenant_id = p.tenant_id AND spl.store_id = ?
      WHERE p.tenant_id = ? AND (p.store_id = ? OR p.store_id IS NULL)
        AND (p.store_id IS NOT NULL OR spl.is_active IS NULL OR spl.is_active = 1)
    `;
    // A store's inventory is its own products plus every tenant-wide shared
    // product, resolved through store_product_listings — see
    // docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §3.
    const params = [store_id, tenant_id, store_id];
    
    if (search) {
      sql += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (category_id) {
      sql += ` AND p.category_id = ?`;
      params.push(category_id);
    }
    
    // Use string interpolation for LIMIT and OFFSET to avoid parameter binding issues
    const limitNum = parseInt(limit) || 50;
    const offsetNum = parseInt(offset) || 0;
    sql += ` ORDER BY p.name ASC LIMIT ${limitNum} OFFSET ${offsetNum}`;
    
    console.log('getProducts SQL:', sql);
    console.log('getProducts params:', params);
    
    const [results] = await query(sql, params);
    // Resolve effective price/stock for shared products through their
    // per-store listing row; store-owned products are untouched.
    const resolved = (results || []).map((row) => {
      if (row.store_id !== null) return row;
      return {
        ...row,
        price: row.listing_price != null ? row.listing_price : row.price,
        stock_quantity: row.listing_stock_quantity != null ? row.listing_stock_quantity : 0
      };
    });
    return resolved;
  } catch (error) {
    console.error('Error getting products:', error);
    throw error;
  }
};

/**
 * Get low stock products
 */
const getLowStockProducts = async (tenant_id, store_id) => {
  try {
    const sql = `
      SELECT 
        p.id,
        p.name,
        p.sku,
        p.stock_quantity,
        p.low_stock_threshold
      FROM products p
      WHERE p.tenant_id = ? 
        AND p.store_id = ?
        AND p.stock_quantity <= p.low_stock_threshold
        AND p.is_active = 1
      ORDER BY (p.stock_quantity / NULLIF(p.low_stock_threshold, 0)) ASC
    `;
    
    const [results] = await query(sql, [tenant_id, store_id]);
    return results || [];
  } catch (error) {
    console.error('Error getting low stock products:', error);
    throw error;
  }
};

/**
 * Get inventory summary
 */
const getInventorySummary = async (tenant_id, store_id) => {
  try {
    const sql = `
      SELECT 
        COUNT(*) as total_products,
        SUM(CASE WHEN stock_quantity <= low_stock_threshold THEN 1 ELSE 0 END) as low_stock_count,
        SUM(CASE WHEN stock_quantity = 0 THEN 1 ELSE 0 END) as out_of_stock_count,
        SUM(stock_quantity * cost_price) as total_inventory_value
      FROM products 
      WHERE tenant_id = ? 
        AND store_id = ? 
        AND is_active = 1
    `;
    
    const [results] = await query(sql, [tenant_id, store_id]);
    return results[0] || {
      total_products: 0,
      low_stock_count: 0,
      out_of_stock_count: 0,
      total_inventory_value: 0
    };
  } catch (error) {
    console.error('Error getting inventory summary:', error);
    throw error;
  }
};

module.exports = {
  getProducts,
  getLowStockProducts,
  getInventorySummary
};
