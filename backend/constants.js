/**
 * Application-wide constants
 * Contains permission definitions used by the authentication middleware
 * and other constants used throughout the application
 */

// Permission constants for access control
const PERMISSIONS = {
    // User Management
    USER_READ: 'user:read',
    USER_CREATE: 'user:create',
    USER_UPDATE: 'user:update',
    USER_DELETE: 'user:delete',
    
    // Role Management
    ROLE_READ: 'role:read',
    ROLE_CREATE: 'role:create',
    ROLE_UPDATE: 'role:update',
    ROLE_DELETE: 'role:delete',
    
    // Store Management
    STORE_READ: 'store:read',
    STORE_CREATE: 'store:create',
    STORE_UPDATE: 'store:update',
    STORE_DELETE: 'store:delete',
    
    // Product Management
    PRODUCT_READ: 'product:read',
    PRODUCT_CREATE: 'product:create',
    PRODUCT_UPDATE: 'product:update',
    PRODUCT_DELETE: 'product:delete',
    
    // Category Management
    CATEGORY_READ: 'category:read',
    CATEGORY_CREATE: 'category:create',
    CATEGORY_UPDATE: 'category:update',
    CATEGORY_DELETE: 'category:delete',
    
    // Order Management
    ORDER_READ: 'order:read',
    ORDER_CREATE: 'order:create',
    ORDER_UPDATE: 'order:update',
    ORDER_DELETE: 'order:delete',
    
    // Customer Management
    CUSTOMER_READ: 'customer:read',
    CUSTOMER_CREATE: 'customer:create',
    CUSTOMER_UPDATE: 'customer:update',
    CUSTOMER_DELETE: 'customer:delete',
    
    // Promotional Offer Management
    PROMO_READ: 'promo:read',
    PROMO_CREATE: 'promo:create',
    PROMO_UPDATE: 'promo:update',
    PROMO_DELETE: 'promo:delete',
    
    // Settings
    SETTINGS_READ: 'settings:read',
    SETTINGS_UPDATE: 'settings:update',
    
    // Report Access
    REPORT_READ: 'report:read',
    
    // System Settings (Admin Only)
    SYSTEM_ADMIN: 'system:admin',
};

module.exports = {
    PERMISSIONS
};
