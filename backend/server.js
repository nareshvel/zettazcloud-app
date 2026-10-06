require('dotenv').config();
const express = require('express');
const cors = require('cors'); // Added semicolon
const helmet = require('helmet');
const https = require('https');
const net = require('net');

// Debug logging flags
// IMPORTANT: Debug logs are DISABLED by default and only enabled explicitly with environment variables
const DEBUG_API = process.env.DEBUG_API === 'true';
const DEBUG_SALES = process.env.DEBUG_SALES === 'true';
const DEBUG_REPORTS = process.env.DEBUG_REPORTS === 'true';

// Conditional debug logging helpers
// All debug logs are disabled by default and must be explicitly enabled via environment variables
const debugLog = (area, ...args) => {
  // No-op if not explicitly enabled
  switch (area) {
    case 'api':
      if (DEBUG_API) console.log('[API]', ...args);
      break;
    case 'sales':
      if (DEBUG_SALES) console.log('[SALES]', ...args);
      break;
    case 'reports':
      if (DEBUG_REPORTS) console.log('[REPORTS]', ...args);
      break;
    default:
      // Default case - logs nothing unless a specific flag is enabled
      // This ensures no accidental logs without explicit enabling
      if (DEBUG_API || DEBUG_SALES || DEBUG_REPORTS) console.log(...args);
  }
};
const rateLimit = require('express-rate-limit');
const { logActivity } = require('./services/auditLogService'); // Added for user activity logging
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./config/constants'); // Import centralized JWT secret
const { v4: uuidv4 } = require('uuid'); // Ensure uuid is imported
const { pool, testConnection, getConnectionWithTimeZone } = require('./config/db');

// ── safeExit: always close the MySQL pool before exiting ──────────────
// Every process.exit() in a startup-failure or crash path MUST go through
// this helper. A bare process.exit(1) skips pool.end(), leaving the pool's
// TCP connections orphaned at the MySQL server. On a shared hosting MySQL
// server with a low max_connections, repeated nodemon restarts after
// crashes accumulate those orphaned connections until the server rejects
// new ones with ER_CON_COUNT_ERROR ("Too many connections") — a death
// spiral where each failed restart makes the next one more likely to fail.
let _poolClosed = false;
const safeExit = async (code = 0, label = 'exit') => {
  if (!_poolClosed) {
    _poolClosed = true;
    try {
      await pool.end();
      if (process.env.NODE_ENV === 'development') {
        console.log(`[safeExit:${label}] Database connection pool closed.`);
      }
    } catch (err) {
      console.error(`[safeExit:${label}] Error closing pool:`, err.message);
    }
  }
  process.exit(code);
};
const timezoneMiddleware = require('./middleware/timezoneMiddleware');
const errorHandler = require('./middleware/error'); // Corrected import
const { authenticate, requireTenantId, requireStoreId } = require('./middleware/unifiedAuthMiddleware');
const { getCategorySalesSummary } = require('./controllers/salesController');
const paymentRoutes = require('./routes/payment.routes');
const customerContactsRoutes = require('./routes/customerContacts');
const customerActivitiesRoutes = require('./routes/customerActivities');
const printRoutes = require('./routes/printRoutes');
// Updated to use the consolidated RBAC tax routes
const taxRoutes = require('./routes/tax.routes');
const apiRouter = require('./routes');

// Import debug routes (only used in development)
const debugRoutes = require('./routes/debugRoutes');
const directRolesDebug = require('./routes/directRolesDebug');
const multer = require('multer');
const fs = require('fs').promises; // Renamed from fsPromises, ensures 'fs' is defined for async operations
const fsSync = require('fs'); // For sync operations at startup, kept as is
const sharp = require('sharp');
const { computePromotions } = require('./services/promotionEngine');

// Initialize express app
const app = express();

// URI Protection Middleware - Protect against malformed URI requests
app.use((req, res, next) => {
  try {
    decodeURIComponent(req.path);
    next();
  } catch (e) {
    console.error(`[${new Date().toISOString()}] Invalid URI encoding detected: ${req.path}`);
    return res.status(400).json({ 
      error: 'Bad Request: Invalid URL encoding',
      timestamp: new Date().toISOString()
    });
  }
});

// Global pre-router logger with filtered routes
app.use((req, res, next) => {
  // Skip logging for tax-classes routes and other high-volume/noisy routes
  const skipLoggingForRoutes = [
    '/api/tax-classes',
    '/api/stores/settings',
    '/api/stores/current',
    '/api/sales/summary',
    '/api/reports',
    '/api/users'
  ];
  
  // Only log if the route is not in the skip list and API debugging is enabled
  if (DEBUG_API && !skipLoggingForRoutes.some(route => req.originalUrl.includes(route))) {
    debugLog('api', `${req.method}: ${req.originalUrl}`);
  }
  next();
});

// Global request logger
/*
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] Incoming Request (Global Logger): ${req.method} ${req.originalUrl}`);
  // Optional: Log headers if you suspect issues there, but can be verbose
  // console.log('Request Headers (Global Logger):', JSON.stringify(req.headers, null, 2)); 
  next();
});
*/

app.set('trust proxy', 1); // Trust proxy to allow express-rate-limit to work correctly behind a proxy
const PORT = process.env.PORT || 3001;

// --- Multer Configuration for Image Uploads ---
const UPLOAD_DIR = path.join(__dirname, 'uploads/temp_images');
const PUBLIC_IMAGES_PRODUCTS_DIR = path.join(__dirname, 'public/images/products');
const PUBLIC_UPLOADS_CATEGORIES_DIR = path.join(__dirname, 'public/uploads/categories'); // Define path for category uploads

// Ensure upload directories exist (using synchronous fs for startup)
if (!fsSync.existsSync(UPLOAD_DIR)) {
  fsSync.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!fsSync.existsSync(PUBLIC_IMAGES_PRODUCTS_DIR)) {
  fsSync.mkdirSync(PUBLIC_IMAGES_PRODUCTS_DIR, { recursive: true });
}
if (!fsSync.existsSync(PUBLIC_UPLOADS_CATEGORIES_DIR)) { // Create directory for category uploads
  fsSync.mkdirSync(PUBLIC_UPLOADS_CATEGORIES_DIR, { recursive: true });
  console.log(`Created directory: ${PUBLIC_UPLOADS_CATEGORIES_DIR}`);
}

// Set security HTTP headers
app.use(helmet({ crossOriginResourcePolicy: false }));

// CORS configuration
// Resolve allowed origins from environment
const resolveAllowedOrigins = () => {
  const envList = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const fromFrontendUrl = process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [];
  const allowLocal = process.env.ALLOW_LOCAL_DEV_ORIGIN === 'true' ? ['http://localhost:5173', 'http://127.0.0.1:5173'] : [];
  // Known frontend domains (do NOT include API domain here)
  const defaults = ['https://cloud.zettaz.com'];
  return Array.from(new Set([...defaults, ...fromFrontendUrl, ...envList, ...allowLocal]));
};

const corsOptions = {
  origin: function (origin, callback) {
    // Allow all origins in development or if no origin (e.g., curl/Postman)
    if (process.env.NODE_ENV === 'development' || !origin) {
      return callback(null, true);
    }

    const allowedOrigins = resolveAllowedOrigins();
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    if (DEBUG_API) {
      console.warn('[CORS] Blocked Origin:', origin, 'Allowed:', allowedOrigins);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'store-id', 'x-store-id', 'storeid', 'tenant-id', 'x-tenant-id', 'tenantid', 'x-request-id'],
  exposedHeaders: ['x-request-id'],
  optionsSuccessStatus: 204
};

// Apply CORS middleware conditionally to avoid duplicate headers when a proxy (e.g., Nginx) also sets CORS
// Set ENABLE_EXPRESS_CORS=false in production if your reverse proxy adds CORS headers
const ENABLE_EXPRESS_CORS = process.env.ENABLE_EXPRESS_CORS !== 'false';
if (ENABLE_EXPRESS_CORS) {
  // Preflight debug logging (only when DEBUG_API is enabled)
  app.use((req, res, next) => {
    if (DEBUG_API && req.method === 'OPTIONS') {
      console.log('[CORS][OPTIONS] Origin:', req.headers.origin,
        'ACRM:', req.headers['access-control-request-method'],
        'ACRH:', req.headers['access-control-request-headers']);
    }
    next();
  });

  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));
} else if (DEBUG_API) {
  console.log('[API] Express CORS is disabled (ENABLE_EXPRESS_CORS=false). Assuming proxy handles CORS.');
}

// Stripe webhook route — MUST be mounted BEFORE express.json() below.
// Stripe signature verification (stripe.webhooks.constructEvent) requires the
// raw, unparsed request body; if express.json() runs first it consumes/
// re-serializes the body and every webhook signature check fails. This is
// the single most common real bug in Stripe integrations — see
// docs/17-migration-and-roadmap/17_Stripe_Billing_Module.md.
const stripeWebhookRoutes = require('./routes/stripeWebhookRoutes');
app.use('/api/webhooks', express.raw({ type: 'application/json' }), stripeWebhookRoutes);

// Body parser, reading data from body into req.body - MUST be before routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(hpp({
  whitelist: [
    'duration', 'ratingsQuantity', 'ratingsAverage', 'maxGroupSize', 'difficulty', 'price'
  ]
}));

// Attach store timezone to each request early
app.use(timezoneMiddleware);

// Standard rate limiter for most API endpoints
const standardLimiter = rateLimit({
  max: 1000, // Allows 1000 requests per 15 minutes
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: 'Too many requests from this IP, please try again in 15 minutes!'
});

// More permissive rate limiter for high-traffic endpoints like roles
const permissiveLimiter = rateLimit({
  max: 5000, // Allow 5000 requests per 15 minutes for high-traffic endpoints
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: 'Too many requests from this IP, please try again in 15 minutes!'
});

// Apply standard limiter to all API routes by default
app.use('/api', standardLimiter);

// Gate authenticated API access on an active subscription (trial/active only;
// billing/auth/public/onboarding/webhook routes are excluded internally so a
// tenant with an expired trial or a declined card can still reach billing to
// fix it). Mounted broadly here rather than per-route because `authenticate`
// is applied inside each individual route file rather than centrally in this
// codebase — see subscriptionMiddleware.js's own JWT decode for why this
// still works without reordering every route file.
const { requireActiveSubscription } = require('./middleware/subscriptionMiddleware');
app.use('/api', requireActiveSubscription());

// Mount the main API router
app.use('/api', apiRouter);

// Mount public routes (no authentication required)
const publicAuthRoutes = require('./routes/publicAuthRoutes');
const onboardingRoutes = require('./routes/onboardingRoutes');
app.use('/api/public/auth', publicAuthRoutes); // Mount public authentication routes
app.use('/api/onboarding', onboardingRoutes); // Mount onboarding routes

// Mount product routes
const productRoutes = require('./routes/product.routes');
const activityLogRoutes = require('./routes/activityLog.routes');

// Mount routes
const userRoutes = require('./routes/userRoutes'); 

app.use('/api/products', productRoutes); // Mount product routes
app.use('/api/inventory', productRoutes); // Mount inventory routes (alias for products)
app.use('/api/users', userRoutes);      // Mount user routes with RBAC support
app.use('/api/activity-logs', activityLogRoutes); // Mount activity log routes

// Mount category routes
const categoryRoutes = require('./routes/category.routes'); // Require the new category routes
app.use('/api/categories', categoryRoutes); // Mount them

// Mount store routes
const storeRoutes = require('./routes/store.routes');
app.use('/api/stores', storeRoutes);

// Mount report routes
const reportRoutes = require('./routes/reports.routes');
app.use('/api/reports', reportRoutes);



// Mount tax settings routes
// Mount tax routes at different paths to handle all required routes
app.use('/api/tax', taxRoutes);
// Add specific route for /api/tax-classes which the frontend expects
app.use('/api/tax-classes', (req, res, next) => {
  // Explicit authentication check for Tenant Admin with tax route handling
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  
  try {
    let decoded;
    let verified = false;
    
    // First try with our centralized JWT_SECRET
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      verified = true;
    } catch (verifyErr) {
      // In development mode, try with common fallback secrets if the main one fails
      if (process.env.NODE_ENV === 'development') {
        const possibleSecrets = [
          'your-secret-key',
          'your-secret-key-for-development-only',
          'your_jwt_secret'
        ];
        
        // Try each possible secret
        for (const secret of possibleSecrets) {
          try {
            decoded = jwt.verify(token, secret);
            verified = true;
            console.log(`JWT verified with fallback secret: '${secret}'. Update frontend to use the same JWT_SECRET.`);
            break;
          } catch (fallbackErr) {
            // Continue to next secret
          }
        }
      }
      
      // If we still couldn't verify, throw the original error
      if (!verified) {
        throw verifyErr;
      }
    }
    
    const systemRoles = decoded.systemRoles || [];
    
    // Allow access for Tenant Admin without checking specific permissions
    if (systemRoles.includes('Tenant Admin')) {
      req.user = {
        id: decoded.id,
        tenant_id: decoded.tenant_id || decoded.tenantId,
        tenantId: decoded.tenant_id || decoded.tenantId
      };
    }
  } catch (err) {
    console.error('Error authenticating for tax-classes:', err);
  }
  
  // Forward all requests to the tax routes handler with adjusted URL
  // This ensures all HTTP methods (GET, POST, PUT, DELETE) are handled
  req.url = '/tax-classes' + (req.url !== '/' ? req.url : '');
  return taxRoutes(req, res, next);
});

// Mount debug routes - restricted to development mode only
if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
  app.use('/api/debug', debugRoutes);
  app.use('/api/direct-debug', directRolesDebug);
}

// Mount public routes (no authentication required)
const publicRoutes = require('./routes/publicRoutes');
app.use('/api/public', publicRoutes);

// Mount promotional offers routes (authentication required)
const promotionalOfferRoutes = require('./routes/promotionalOfferRoutes');
app.use('/api/promotional-offers', promotionalOfferRoutes);

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Serve static files from the 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Test middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// Initialize database with default admin user if no users exist
const initializeDefaultUser = async () => {
  try {
    // Check if there are any users
    const [users] = await pool.execute('SELECT COUNT(*) as count FROM users');
    
    if (users[0].count === 0) {
      //console.log('No users found in database, creating default admin user');
      
      // Generate hashed password
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      // Get a tenant ID (or create one if none exist)
      let tenantId;
      const [tenants] = await pool.execute('SELECT id FROM tenants LIMIT 1');
      
      if (tenants.length === 0) {
        // Create a default tenant
        const [newTenant] = await pool.execute(
          'INSERT INTO tenants (name, created_at, updated_at) VALUES (?, NOW(), NOW())',
          ['Default Tenant']
        );
        tenantId = newTenant.insertId;
      } else {
        tenantId = tenants[0].id;
      }
      
      // Create default admin user
      await pool.execute(
        'INSERT INTO users (name, email, password_hash, role, tenant_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
        ['Admin User', 'admin@example.com', hashedPassword, 'admin', tenantId]
      );
      
      //console.log('Default admin user created successfully');
      //console.log('Username: admin@example.com');
      //console.log('Password: admin123');
    } else {
      // console.log(`Found ${users[0].count} existing users in database`);
    }
  } catch (error) {
    console.error('Error initializing default user:', error);
  }
};

// Middleware
// Removed this line

// API Routes
app.use('/api/payment', paymentRoutes);
// app.use('/api', customerContactsRoutes);
// app.use('/api', customerActivitiesRoutes);
app.use('/api/print', printRoutes);

// Import and use sales routes - MOVED POST /api/sales to salesController
const salesRoutes = require('./routes/sales.routes');
app.use('/api/sales', salesRoutes);

// Import and use sales return routes
const salesReturnRoutes = require('./routes/salesReturn.routes');
app.use('/api/sales-returns', salesReturnRoutes);

// Import and use sales orders routes (Sales Hub "Sales Orders" quick-action —
// backed by the sales_orders table, see 2026-08-28_sales_orders.sql)
const salesOrdersRoutes = require('./routes/salesOrders.routes');
app.use('/api/sales-orders', salesOrdersRoutes);

// Import and use sales hub routes (universal customer-relationship search
// powering the redesigned jewelry Sales Hub landing screen)
const salesHubRoutes = require('./routes/salesHub.routes');
app.use('/api/sales-hub', salesHubRoutes);

// Import sales return controller for returnable items endpoint
const { getReturnableItems } = require('./controllers/salesReturnController');
const { requirePermission } = require('./middleware/rbacPermissionMiddleware');

// Add returnable items endpoint under /api/sales
app.get('/api/sales/:saleId/returnable-items', authenticate, requirePermission('sales.return.view'), getReturnableItems);

// Import and use customer routes
const customerRoutes = require('./routes/customer.routes');
app.use('/api/customers', customerRoutes);
app.use('/api/activity-logs', activityLogRoutes);

// Import and use role routes with permissive rate limiter
const roleRoutes = require('./routes/roleRoutes');
// Remove standard limiter for this route and apply permissive limiter instead
app.use('/api/roles', permissiveLimiter, roleRoutes);

// Import and use supplier routes
const supplierRoutes = require('./routes/supplier.routes');
app.use('/api/suppliers', supplierRoutes);

// Tax routes already imported and mounted earlier

// Import and use purchase order routes
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes'); // Corrected path

// SECURITY: purchase orders are tenant-scoped data. `authenticate` populates
// req.user from a verified JWT; `requireTenantId` guarantees tenant context.
// Without these the route file previously trusted a client-supplied `tenant-id`
// header, allowing cross-tenant reads and writes.
app.use('/api/purchase-orders', authenticate, requireTenantId, purchaseOrderRoutes);

// Import and use GRN routes
const grnRoutes = require('./routes/grnRoutes'); // Added GRN routes import

app.use('/api/grn', authenticate, grnRoutes); // Mount GRN routes under /api/grn

// Import and use printer settings routes
const printerSettingsRoutes = require('./routes/printerSettings.routes');
app.use('/api/settings', printerSettingsRoutes); // Mount printer settings routes under /api/settings

// Import and use QuickStart routes
const quickstartRoutes = require('./routes/quickstartRoutes');
app.use('/api/quickstart', quickstartRoutes); // Mount QuickStart routes under /api/quickstart

// Import and use dashboard routes for performance optimization
const dashboardController = require('./controllers/dashboardController');
app.get('/api/dashboard', authenticate, requireTenantId, requireStoreId, dashboardController.getDashboardData);

// Import and use sale deletion routes
const saleDeletionRoutes = require('./routes/saleDeletionRoutes');
// Sale deletion is destructive and tenant-scoped. The inner `requirePermission`
// middleware verifies the JWT itself, but mounting behind `authenticate` makes the
// contract explicit and consistent with every other tenant-scoped route.
app.use('/api/sales-deletion', authenticate, requireTenantId, saleDeletionRoutes);

// Duplicate storeRoutes declaration (lines 247-249) removed by Cascade

// Countries API
app.get('/api/countries', async (req, res) => {
  try {
    const query = `
      SELECT id, name, code, code3, phone_code, currency_code, flag_emoji 
      FROM countries 
      WHERE is_active = 1 
      ORDER BY sort_order ASC, name ASC
    `;
    
    const [countries] = await pool.query(query);
    
    res.status(200).json({
      success: true,
      data: countries
    });
  } catch (error) {
    console.error('Error fetching countries:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching countries',
      error: error.message
    });
  }
});

// Database setup check
const checkDatabaseSetup = async () => {
  try {
    // Check if database is reachable
    const isConnected = await testConnection();
    if (!isConnected) {
      console.error('Failed to connect to database');
      return false;
    }
    
    // Check if required tables exist
    const requiredTables = [
      'products', 
      'categories', 
      'sales', 
      'sale_items', 
      'users',
      'payment_methods',
      'payment_terminals',
      'payment_transactions',
      'tenant_payment_settings'
    ];
    
    const [tables] = await pool.query('SHOW TABLES'); // Changed from execute to query
    const existingTables = tables.map(row => Object.values(row)[0]);
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));
    
    if (missingTables.length > 0) {
      console.warn(`Warning: Missing required tables: ${missingTables.join(', ')}`);
      // Don't fail the startup for missing payment tables as they might be created by migrations
      if (missingTables.some(t => !t.startsWith('payment_'))) {
        return false;
      }
    }
    
    // console.log('Database setup check passed');
    return true;
  } catch (error) {
    console.error('Database setup check failed:', error);
    return false;
  }
};

// Database setup and user initialization is now handled in the main start() function.

// Stock Adjustments Route
app.post('/api/stock-adjustments', authenticate, requireTenantId, requireStoreId, async (req, res) => {
  try {
    // Extract user/tenant/store from auth/context
    const { id: userId, tenant_id: tenantIdFromUser, store_id: storeIdFromUser, tenantId: tenantIdCamel, storeId: storeIdCamel } = req.user || {};
    // Accept multiple header variants and req.user values populated by middleware/auth
    const tenantId =
      tenantIdFromUser || tenantIdCamel ||
      req.headers['tenant-id'] || req.headers['x-tenant-id'] || req.headers['tenant_id'] ||
      req.query.tenant_id || req.query.tenantId;
    const storeId =
      storeIdFromUser || storeIdCamel ||
      req.headers['store-id'] || req.headers['x-store-id'] || req.headers['store_id'] ||
      req.query.store_id || req.query.storeId || req.body.store_id || req.body.storeId;

    if (DEBUG_API) {
      console.log('[STOCK-ADJ] Extracted context', {
        userId,
        userTenant: tenantIdFromUser || tenantIdCamel,
        userStore: storeIdFromUser || storeIdCamel,
        hdrTenant: req.headers['tenant-id'] || req.headers['x-tenant-id'] || req.headers['tenant_id'],
        hdrStore: req.headers['store-id'] || req.headers['x-store-id'] || req.headers['store_id'],
        finalTenantId: tenantId,
        finalStoreId: storeId,
      });
    }

    // Extract fields - support both camelCase and snake_case from frontend
    const {
      productId, product_id,
      adjustmentType, adjustment_type,
      quantity,
      reasonCode, reason_code,
      adjustmentDate, adjustment_date,
      notes
    } = req.body || {};

    const finalProductId = productId || product_id;
    const finalAdjustmentType = (adjustmentType || adjustment_type || '').toUpperCase();
    const finalReasonCode = reasonCode || reason_code || 'MANUAL_ADJUSTMENT';
    const finalAdjustmentDate = adjustmentDate || adjustment_date || new Date().toISOString();

    // Basic validation
    if (!tenantId || !storeId) {
      return res.status(400).json({ status: 'error', message: 'Missing tenant/store context.' });
    }
    if (!finalProductId || !finalAdjustmentType || quantity == null) {
      return res.status(400).json({ status: 'error', message: 'productId, adjustmentType and quantity are required.' });
    }
    if (!['INCREMENT', 'DECREMENT'].includes(finalAdjustmentType)) {
      return res.status(400).json({ status: 'error', message: 'Invalid adjustmentType. Use INCREMENT or DECREMENT.' });
    }

    const adjQty = parseFloat(quantity);
    if (isNaN(adjQty) || adjQty <= 0) {
      return res.status(400).json({ status: 'error', message: 'quantity must be a positive number.' });
    }

    // Use an explicit transaction
    // Use a connection with session time_zone set to the store's timezone
    const connection = await getConnectionWithTimeZone(req.storeTz);
    try {
      await connection.beginTransaction();

      // Lock product row for update within tenant scope. A tenant-wide
      // shared product (products.store_id IS NULL) keeps its stock on its
      // own store_product_listings row instead of the products row — see
      // storeProductListingService.js / CLAUDE.md's multi-store data
      // sharing model. This mirrors the branching already proven correct in
      // PATCH /api/products/:id/stock; writing straight to
      // products.stock_quantity unconditionally (the old behavior here)
      // corrupted every OTHER store's visible stock for a shared product,
      // since they all read from the same products row.
      const [prodRows] = await connection.query(
        'SELECT id, store_id, stock_quantity FROM products WHERE id = ? AND tenant_id = ? FOR UPDATE',
        [finalProductId, tenantId]
      );

      if (!prodRows || prodRows.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ status: 'error', message: 'Product not found for tenant.' });
      }

      const isSharedProduct = prodRows[0].store_id === null;

      let beforeQty;
      if (isSharedProduct) {
        const [listingRows] = await connection.query(
          `SELECT stock_quantity FROM store_product_listings
           WHERE tenant_id = ? AND store_id = ? AND product_id = ? FOR UPDATE`,
          [tenantId, storeId, finalProductId]
        );
        beforeQty = listingRows && listingRows[0] ? parseFloat(listingRows[0].stock_quantity || 0) : 0;
      } else {
        // Store-owned product — verify the requesting store actually owns
        // it rather than trusting the caller's store_id blindly.
        if (prodRows[0].store_id !== storeId) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ status: 'error', message: 'This product belongs to a different store.' });
        }
        beforeQty = parseFloat(prodRows[0].stock_quantity || 0);
      }

      const delta = finalAdjustmentType === 'INCREMENT' ? adjQty : -adjQty;
      const afterQty = beforeQty + delta;

      if (afterQty < 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ status: 'error', message: 'Adjustment would make stock negative.' });
      }

      // Update product stock — shared products via their per-store listing
      // (creating the listing row on first touch), store-owned products on
      // the products row itself.
      if (isSharedProduct) {
        await connection.query(
          `INSERT INTO store_product_listings (id, tenant_id, store_id, product_id, price, cost_price_override, stock_quantity, is_active)
           VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)
           ON DUPLICATE KEY UPDATE stock_quantity = VALUES(stock_quantity)`,
          [uuidv4(), tenantId, storeId, finalProductId, afterQty.toFixed(2)]
        );
      } else {
        await connection.query(
          'UPDATE products SET stock_quantity = ?, updated_by_user_id = ? WHERE id = ? AND tenant_id = ?',
          [afterQty.toFixed(2), userId || null, finalProductId, tenantId]
        );
      }

      // Insert inventory log for traceability (table used elsewhere by GRN flow)
      const logId = uuidv4();
      const reasonText = notes ? `Manual Adjustment: ${finalReasonCode} - ${notes}` : `Manual Adjustment: ${finalReasonCode}`;
      const inventoryLog = {
        id: logId,
        tenant_id: tenantId,
        store_id: storeId,
        product_id: finalProductId,
        quantity_change: delta.toFixed(2),
        reason: reasonText,
        current_stock_before_change: beforeQty.toFixed(2),
        current_stock_after_change: afterQty.toFixed(2),
        created_by: userId || null,
        reference_id: logId,
        reference_type: 'STOCK_ADJUSTMENT'
      };
      await connection.query('INSERT INTO inventory_logs SET ?', inventoryLog);

      // Also record into stock_adjustments table for reporting consistency
      const stockAdjustmentId = uuidv4();
      const insertStockAdjSql = `
        INSERT INTO stock_adjustments (
          id, tenant_id, store_id, product_id, user_id,
          adjustment_type, reason_code,
          quantity_adjusted, stock_before_adjustment, stock_after_adjustment,
          notes, adjustment_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await connection.query(insertStockAdjSql, [
        stockAdjustmentId,
        tenantId,
        storeId,
        finalProductId,
        userId || null,
        finalAdjustmentType,
        finalReasonCode,
        adjQty, // store as positive amount
        beforeQty,
        afterQty,
        notes || null,
        finalAdjustmentDate
      ]);

      await connection.commit();
      connection.release();

      // Return unwrapped payload compatible with frontend service expectations
      return res.status(200).json({
        status: 'success',
        data: {
          id: logId,
          productId: finalProductId,
          stockBeforeAdjustment: beforeQty,
          stockAfterAdjustment: afterQty,
          quantityAdjusted: adjQty,
          adjustmentType: finalAdjustmentType,
          reasonCode: finalReasonCode,
          notes: notes || null,
          adjustmentDate: finalAdjustmentDate,
          userId: userId || null,
          tenantId,
          storeId
        }
      });
    } catch (txErr) {
      try { await connection.rollback(); } catch (_) {}
      connection.release();
      console.error('Stock adjustment transaction failed:', txErr);
      return res.status(500).json({ status: 'error', message: 'Failed to apply stock adjustment', error: txErr.message });
    }
  } catch (err) {
    console.error('Stock adjustment handler error:', err);
    return res.status(500).json({ status: 'error', message: 'Unexpected server error', error: err.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Routes
// Test connection
// Database test endpoint
app.get('/api/db/status', async (req, res) => {
  try {
    const isSetup = await checkDatabaseSetup();
    if (!isSetup) {
      return res.status(500).json({
        status: 'error',
        message: 'Database is not properly set up',
        tables: {
          required: ['products', 'categories', 'sales', 'sale_items', 'users'],
          existing: (await pool.execute('SHOW TABLES'))[0].map(row => Object.values(row)[0])
        }
      });
    }
    
    // Get row counts for each table
    const tables = ['products', 'categories', 'sales', 'sale_items', 'users'];
    const tableCounts = {};
    
    for (const table of tables) {
      try {
        const [rows] = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        tableCounts[table] = rows[0].count;
      } catch (error) {
        tableCounts[table] = `Error: ${error.message}`;
      }
    }
    
    res.json({
      status: 'success',
      message: 'Database is connected and properly set up',
      tables: tableCounts
    });
  } catch (error) {
    console.error('Database status check failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to check database status',
      error: error.message
    });
  }
});

// Legacy test connection endpoint (for backward compatibility)
app.get('/api/test-connection', async (req, res) => {
  try {
    const [result] = await pool.execute('SELECT 1 + 1 AS result');
    res.json({ 
      status: 'success',
      data: result[0],
      message: 'Database connection is working!'
    });
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to connect to database',
      error: error.message
    });
  }
});

// Ping route for testing server updates
app.get('/api/ping', (req, res) => {
  if (DEBUG_API) console.log('[/api/ping] Received ping request at', new Date().toISOString());
  res.status(200).json({
    status: 'success',
    message: 'pong',
    timestamp: new Date().toISOString(),
    custom_marker: 'CASCADE_PING_ROUTE_V1' // A unique marker
  });
});

// Comment: Removed duplicate test implementation

// Comment: Removed old commented-out implementations

/* // Store Settings Routes
// GET store settings
// app.get('/api/stores/settings', async (req, res) => {
  try {
    const tenantId = req.query.tenant_id;
    
    if (!tenantId) {
      return res.status(400).json({
        status: 'error',
        message: 'tenant_id is required as a query parameter'
      });
    }
    
    console.log(`[/api/stores/settings] Fetching store settings for tenant: ${tenantId}`);
    
    // Query the database to get store settings
    const [stores] = await pool.query(
      'SELECT id, tenant_id, name, email, phone, address, currency_code, ' +
      'currency_decimal_places, date_format, time_format, number_format, ' +
      'decimal_precision, locale_code, measurement_system ' +
      'FROM stores WHERE tenant_id = ? LIMIT 1',
      [tenantId]
    );
    
    if (stores.length === 0) {
      console.log(`[/api/stores/settings] No store found for tenant: ${tenantId}, returning mock data`);
      // Return a mock store if no store is found
      return res.status(200).json({
        id: 'mock-store-id',
        tenantId: tenantId,
        name: 'Mock Store',
        email: 'mock@zettaz.com',
        phone: '(555) MOCK-DATA',
        address: '123 Mock St',
        currencyCode: 'USD',
        currencyDecimalPlaces: 2,
        dateFormat: 'MM/DD/YYYY',
        timeFormat: 'hh:mm A',
        numberFormat: 'point_comma',
        decimalPrecision: 2,
        localeCode: 'en-US',
        measurementSystem: 'metric'
      });
    }
    
    // Convert snake_case database fields to camelCase for frontend
    const store = stores[0];
    const camelCaseStore = {
      id: store.id,
      tenantId: store.tenant_id,
      name: store.name,
      email: store.email,
      phone: store.phone,
      address: store.address,
      currencyCode: store.currency_code,
      currencyDecimalPlaces: store.currency_decimal_places,
      dateFormat: store.date_format,
      timeFormat: store.time_format,
      numberFormat: store.number_format,
      decimalPrecision: store.decimal_precision,
      localeCode: store.locale_code,
      measurementSystem: store.measurement_system

// PATCH store settings
// app.patch('/api/stores/settings', async (req, res) => {
//   try {
//     const storeData = req.body;
//     
//     if (!storeData || !storeData.id) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'Store ID is required'
//       });
//     }
//     
//     console.log(`[PATCH /api/stores/settings] Updating store with ID: ${storeData.id}`);
//     
//     // Convert camelCase frontend fields to snake_case for database
//     const dbStoreData = {
//       name: storeData.name,
//       email: storeData.email,
//       phone: storeData.phone,
//       address: storeData.address,
//       currency_code: storeData.currencyCode,
//       currency_decimal_places: storeData.currencyDecimalPlaces,
//       date_format: storeData.dateFormat,
//       time_format: storeData.timeFormat,
//       number_format: storeData.numberFormat,
//       decimal_precision: storeData.decimalPrecision,
//       locale_code: storeData.localeCode,
//       measurement_system: storeData.measurementSystem
//     };
//     
//     // Build the SQL query dynamically based on which fields are present
//     const updateFields = [];
//     const values = [];
//     
//     Object.entries(dbStoreData).forEach(([key, value]) => {
//       if (value !== undefined) {
//         updateFields.push(`${key} = ?`);
//         values.push(value);
//       }
//     });
//     
//     if (updateFields.length === 0) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'No fields to update'
//       });
//     }
//     
//     // Add the store ID to values array for the WHERE clause
//     values.push(storeData.id);
//     
//     const query = `UPDATE stores SET ${updateFields.join(', ')} WHERE id = ?`;
//     
//     const [result] = await pool.query(query, values);
//     
//     if (result.affectedRows === 0) {
//       return res.status(404).json({
//         status: 'error',
//         message: 'Store not found or no changes made'
//       });
//     }
//     
//     console.log(`[PATCH /api/stores/settings] Successfully updated store with ID: ${storeData.id}`);
//     
//     // Fetch the updated store to return to frontend
//     const [updatedStores] = await pool.query(
//       'SELECT id, tenant_id, name, email, phone, address, currency_code, ' +
//       'currency_decimal_places, date_format, time_format, number_format, ' +
//       'decimal_precision, locale_code, measurement_system ' +
//       'FROM stores WHERE id = ?',
//       [storeData.id]
//     );
//     
//     if (updatedStores.length === 0) {
//       return res.status(404).json({
//         status: 'error',
//         message: 'Store not found after update'
//       });
//     }
//     
//     // Convert snake_case database fields to camelCase for frontend
//     const updatedStore = updatedStores[0];
//     const camelCaseStore = {
//       id: updatedStore.id,
//       tenantId: updatedStore.tenant_id,
//       name: updatedStore.name,
//       email: updatedStore.email,
//       phone: updatedStore.phone,
//       address: updatedStore.address,
//       currencyCode: updatedStore.currency_code,
//       currencyDecimalPlaces: updatedStore.currency_decimal_places,
//       dateFormat: updatedStore.date_format,
//       timeFormat: updatedStore.time_format,
//       numberFormat: updatedStore.number_format,
//       decimalPrecision: updatedStore.decimal_precision,
//       localeCode: updatedStore.locale_code,
//       measurementSystem: updatedStore.measurement_system
//     };
//     
//     return res.status(200).json(camelCaseStore);
//   } catch (error) {
//     console.error('[PATCH /api/stores/settings] Error:', error);
//     return res.status(500).json({
//       status: 'error',
//       message: 'Failed to update store settings',
//       error: error.message
//     });
//   }
// });

*/
// Auth routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      // Log failed login attempt - missing input
      await logActivity({
        tenant_id: req.body.tenant_id || null, // Attempt to get tenant_id if provided in request
        user_id: 'anonymous',
        username: req.body.email || 'unknown',
        action_type: 'USER_LOGIN_FAILURE',
        description: 'Login attempt failed: Email or password not provided.',
        details: { email: req.body.email, reason: 'Missing email or password' },
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });
      return res.status(400).json({ 
        status: 'error',
        message: 'Email and password are required'
      });
    }
    
    // Fetch user from database along with store's tax_config, discount_application_rule, and tenant settings
    const [users] = await pool.execute(
      `SELECT 
        u.id, u.name, u.email, u.password_hash, u.tenant_id, u.store_id,
        s.name AS store_name, s.tax_config, s.discount_application_rule, s.currency_code,
        t.settings AS tenant_settings, t.setup_completed, t.onboarding_step
      FROM 
        users u
      LEFT JOIN 
        stores s ON u.store_id = s.id
      LEFT JOIN
        tenants t ON u.tenant_id = t.id
      WHERE 
        u.email = ?`,
      [email]
    );
    
    if (users.length === 0) {
      // Log failed login attempt - user not found
      await logActivity({
        tenant_id: null, // Tenant ID unknown if user email not found
        user_id: 'anonymous',
        username: email, // Log the attempted email
        action_type: 'USER_LOGIN_FAILURE',
        description: `Login attempt failed: User with email ${email} not found.`,
        details: { email: email, reason: 'User not found' },
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });
      return res.status(401).json({ 
        status: 'error',
        message: 'Invalid credentials'
      });
    }
    
    const user = users[0];
    
    // Parse tax_config and extract default_tax_class_id
    let parsedDefaultTaxClassId = null; // Renamed variable to avoid conflict with user object property
    if (user.tax_config) {
      try {
        const taxConfig = typeof user.tax_config === 'string' ? JSON.parse(user.tax_config) : user.tax_config;
        if (taxConfig && taxConfig.default_tax_class_id) {
          parsedDefaultTaxClassId = taxConfig.default_tax_class_id;
        }
      } catch (e) {
        console.error('Error parsing tax_config JSON:', e);
      }
    }

    // Parse tenant_settings to get allow_negative_stock
    let allowNegativeStock = false; // Default to false
    if (user.tenant_settings) {
      try {
        const tenantSettings = typeof user.tenant_settings === 'string' ? JSON.parse(user.tenant_settings) : user.tenant_settings;
        if (tenantSettings && typeof tenantSettings.allow_negative_stock === 'boolean') {
          allowNegativeStock = tenantSettings.allow_negative_stock;
        }
      } catch (e) {
        console.error('Error parsing tenant_settings JSON:', e);
        // Keep default allowNegativeStock = false if parsing fails
      }
    }

    // Check if password hash exists
    if (!user.password_hash) {
      // Log failed login attempt - missing password hash (data integrity issue)
      await logActivity({
        tenant_id: user.tenant_id,
        user_id: user.id,
        username: user.email,
        action_type: 'USER_LOGIN_FAILURE',
        description: `Login attempt failed for user ${user.email}: Account has no password hash. Potential data issue.`,
        details: { email: user.email, userId: user.id, reason: 'Missing password hash' },
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });
      return res.status(500).json({
        status: 'error',
        message: 'Authentication error'
      });
    }
    
    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      // Log failed login attempt - invalid password
      await logActivity({
        tenant_id: user.tenant_id,
        user_id: user.id,
        username: user.email,
        action_type: 'USER_LOGIN_FAILURE',
        description: `Login attempt failed for user ${user.email}: Invalid password.`,
        details: { email: user.email, userId: user.id, reason: 'Invalid password' },
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });
      return res.status(401).json({ 
        status: 'error',
        message: 'Invalid credentials'
      });
    }
    
    // Get JWT secret from environment
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables. Token cannot be signed.');
      // Optionally, prevent login if secret is missing
      return res.status(500).json({ 
        status: 'error', 
        message: 'Server configuration error: Cannot complete login.' 
      });
    }
    
    // Log successful login
    await logActivity({
      tenant_id: user.tenant_id,
      user_id: user.id,
      username: user.email,
      action_type: 'USER_LOGIN_SUCCESS',
      description: `User ${user.email} logged in successfully.`,
      details: { userId: user.id, email: user.email },
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    // Update last_login_at timestamp for the user
    try {
      // Double check the user ID format - ensure it's a valid UUID
      const userId = user.id;
      if (!userId || typeof userId !== 'string' || userId.length !== 36) {
        console.error(`[LOGIN ERROR] Invalid user ID format for last_login_at update: "${userId}"`);
      }
      
      if (DEBUG_API) console.log(`[LOGIN] Attempting to update last_login_at for user ID: "${userId}"`);
      
      // Use direct connection for critical update to ensure transaction integrity
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        
        // Execute update with explicit transaction
        const [updateResult] = await connection.query(
          'UPDATE users SET last_login_at = NOW() WHERE id = ?', 
          [userId]
        );
        
        if (updateResult && updateResult.affectedRows > 0) {
          await connection.commit();
          if (DEBUG_API) console.log(`[LOGIN SUCCESS] Updated last_login_at timestamp for user ${userId}. Affected rows: ${updateResult.affectedRows}`);
        } else {
          await connection.rollback();
          console.warn(`[LOGIN WARNING] last_login_at update query completed but no rows were affected for user ${userId}`);
          
          // Additional diagnostics - check if user exists with this ID
          const [userCheck] = await pool.query('SELECT id, email FROM users WHERE id = ?', [userId]);
          if (!userCheck || userCheck.length === 0) {
            console.error(`[LOGIN ERROR] User with ID ${userId} not found in database`);
          } else {
            if (DEBUG_API) console.log(`[LOGIN DEBUG] User exists in DB: ID=${userCheck[0].id}, Email=${userCheck[0].email}`);
          }
        }
        
        // Verify the update by querying the user again
        const [verifyUser] = await pool.query('SELECT id, email, last_login_at FROM users WHERE id = ?', [userId]);
        if (verifyUser && verifyUser.length > 0) {
          if (DEBUG_API) console.log(`[LOGIN VERIFY] User ${userId} (${verifyUser[0].email}) last_login_at is now: ${verifyUser[0].last_login_at || 'NULL'}`);
        } else {
          console.error(`[LOGIN ERROR] Failed to verify last_login_at update - user ${userId} not found`);
        }
      } catch (transactionError) {
        // Ensure transaction is rolled back on error
        if (connection) await connection.rollback().catch(e => console.error('Rollback error:', e));
        console.error('[LOGIN ERROR] Transaction error updating last_login_at:', transactionError);
      } finally {
        // Always release connection back to pool
        if (connection) connection.release();
      }
    } catch (updateError) {
      console.error('[LOGIN ERROR] Error in last_login_at update process:', updateError);
      // Continue with authentication even if update fails
    }

    // Generate JWT token with user identity and permissions
    let store_id = user.store_id || null;
    let storeId = user.store_id || null;
        
    // In development mode, create and assign a default store if none exists
    if ((!store_id || store_id === null) && process.env.NODE_ENV === 'development') {
      try {
        // Check if the tenant already has any stores
        const [storeResults] = await pool.execute('SELECT id FROM stores WHERE tenant_id = ? LIMIT 1', [user.tenant_id]);
        
        if (storeResults.length > 0) {
          // Use the first existing store
          store_id = storeResults[0].id;
          storeId = store_id;
          if (process.env.DEBUG === 'auth') {
            console.log(`Development mode: Using existing store ID ${store_id} for user ${user.id}`);
          }
          
          // Ensure the user is linked to this store in user_stores
          const [userStoreCheck] = await pool.execute(
            'SELECT * FROM user_stores WHERE user_id = ? AND store_id = ? LIMIT 1',
            [user.id, store_id]
          );
          
          if (userStoreCheck.length === 0) {
            if (process.env.DEBUG === 'auth') {
              console.log(`Development mode: Linking user ${user.id} to store ${store_id}`);
            }
            await pool.execute(
              'INSERT INTO user_stores (user_id, store_id, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
              [user.id, store_id]
            );
          }
        } else {
          // Create a new default store
          const { v4: uuidv4 } = require('uuid');
          const defaultStoreId = uuidv4();
          if (process.env.DEBUG === 'auth') {
            console.log(`Development mode: Creating default store ${defaultStoreId} for tenant ${user.tenant_id}`);
          }
          
          await pool.execute(
            'INSERT INTO stores (id, tenant_id, name, location, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
            [defaultStoreId, user.tenant_id, 'Default Store', 'Default Location']
          );
          
          // Link user to the new store
          await pool.execute(
            'INSERT INTO user_stores (user_id, store_id, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
            [user.id, defaultStoreId]
          );
          
          store_id = defaultStoreId;
          storeId = defaultStoreId;
        }
      } catch (err) {
        console.error('Error creating/assigning default store:', err);
      }
    }
    
    // Get RBAC permissions from the rbacService instead of legacy role column
    let permissions = [];
    let userRoles = [];
    try {
      const rbacService = require('./services/rbacService');
      
      // Get user's RBAC roles and permissions
      const rbacData = await rbacService.getUserRolesAndPermissions(user.id, user.tenant_id, store_id);
      
      // Initialize with empty array
      permissions = [];
      
      if (rbacData && rbacData.permissions && Array.isArray(rbacData.permissions) && rbacData.permissions.length > 0) {
        // Handle both string permissions and object permissions
        permissions = rbacData.permissions
          .filter(p => p !== null && p !== undefined) // Filter out null/undefined
          .map(p => typeof p === 'object' && p !== null ? p.name : p) // Handle both formats
          .filter(p => p !== null && p !== undefined); // Filter out any resulting null/undefined
      }
      
      // Extract role names
      if (rbacData && rbacData.roles && rbacData.roles.length > 0) {
        userRoles = rbacData.roles.map(r => r.name);
      }
      
      if (process.env.DEBUG === 'auth') {
        console.log(`User ${user.id} has RBAC roles:`, userRoles);
        console.log(`User ${user.id} has permissions:`, permissions);
      }
    } catch (err) {
      console.error('Error getting RBAC permissions:', err);
      // Use empty permissions array as fallback
    }
    
    // Create JWT payload
    const userPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      tenant_id: user.tenant_id,
      tenantId: user.tenant_id,  // Add camelCase version for consistency
      store_id: store_id,
      storeId: storeId,  // Add camelCase version for consistency
      allowNegativeStock: allowNegativeStock, // Added tenant setting
      defaultTaxClassId: parsedDefaultTaxClassId, // Use the parsed value
      discount_application_rule: user.discount_application_rule,
      currency_code: user.currency_code,
      // Completely fix permissions handling - use empty array if no permissions
      permissions: Array.isArray(permissions) ? permissions : [],
      systemRoles: Array.isArray(userRoles) ? userRoles : [] // Make sure roles are always an array too
    };
    
    const token = jwt.sign(userPayload, jwtSecret, {
      expiresIn: '24h' 
    });
    
    // Create a sanitized user object (remove sensitive data)
    const sanitizedUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      tenant_id: user.tenant_id,
      store_id: user.store_id,
      // tax_config: user.tax_config, // This will be part of the store object
      // defaultTaxClassId: parsedDefaultTaxClassId, // This will be part of the store object or user object if preferred at root
      // discount_application_rule: user.discount_application_rule, // This will be part of the store object
      // currency_code: user.currency_code, // This will be part of the store object
      // Include RBAC data in sanitizedUser object
      systemRoles: Array.isArray(userRoles) ? userRoles : [],
      permissions: Array.isArray(permissions) ? permissions : [],
      // Include tenant onboarding information
      tenant: {
        id: user.tenant_id,
        setup_completed: Boolean(user.setup_completed),
        onboarding_step: user.onboarding_step || 'signup',
        settings: user.tenant_settings ? JSON.parse(user.tenant_settings) : {}
      },
      store: {
        id: user.store_id,
        name: user.store_name, // Added store_name from query
        currency_code: user.currency_code,
        tax_config: user.tax_config,
        discount_application_rule: user.discount_application_rule,
        // Add other store-specific fields here if needed by frontend and available from query
      },
      defaultTaxClassId: parsedDefaultTaxClassId, // Keep at user root for now, or move into store if more appropriate
      token: token // Include token within the user object in the response body as per existing frontend expectation
    };
    
    // Add token to user object directly for easier client-side extraction
    sanitizedUser.token = token;
    
    // Send successful response with user data and token in multiple places for better client compatibility
    const response = { 
      status: 'success',
      data: {
        user: sanitizedUser,
        token // Include token at data.token
      },
      token, // Also keep token at the root of data for some conventions
      message: 'Login successful'
    };
    
    res.json(response);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Server error during login',
      error: error.message // Include error message for debugging
    });
  }
}); // Corrected this line

// GET /api/users/me - Get current authenticated user
app.get('/api/users/me', authenticate, async (req, res) => {
  try {
    // req.user is populated by the authenticate middleware
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;

    if (!userId || !tenantId) {
      return res.status(400).json({
        status: 'error',
        message: 'User ID or Tenant ID missing from authenticated token.',
      });
    }

    // Fetch user details along with store name and default tax class ID
    // This query is similar to the one in the login route
    const query = `
      SELECT 
        u.id, u.name, u.email, u.role, u.tenant_id, u.store_id, u.is_active, u.phone_number, 
        u.profile_picture_url, u.last_login_at, u.created_at, u.updated_at,
        s.name AS store_name, 
        s.currency_code AS store_currency_code, 
        s.language_code AS store_language_code,
        s.country_code AS store_country_code,
        s.tax_config AS store_tax_config, -- Fetch tax_config JSON from stores table
        t.settings AS tenant_settings -- Fetch tenant settings
      FROM users u
      LEFT JOIN stores s ON u.store_id = s.id AND u.tenant_id = s.tenant_id
      LEFT JOIN tenants t ON u.tenant_id = t.id -- Join tenants table
      WHERE u.id = ? AND u.tenant_id = ?
      LIMIT 1;
    `;

    const [users] = await pool.execute(query, [userId, tenantId]);

    if (users.length === 0) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'User not found.' 
      });
    }

    const userFromDb = users[0];

    // Parse tax_config from store and extract default_tax_class_id
    let parsedDefaultTaxClassId = null;
    if (userFromDb.store_tax_config) {
      try {
        const taxConfigData = typeof userFromDb.store_tax_config === 'string' 
          ? JSON.parse(userFromDb.store_tax_config) 
          : userFromDb.store_tax_config;
        if (taxConfigData && taxConfigData.default_tax_class_id) {
          parsedDefaultTaxClassId = taxConfigData.default_tax_class_id;
        }
      } catch (e) {
        console.error(`Error parsing store_tax_config JSON for user ${userFromDb.id}:`, e);
        // Keep parsedDefaultTaxClassId as null if parsing fails
      }
    }

    // Parse tenant_settings to get allow_negative_stock (similar to login route)
    let allowNegativeStock = false; // Default to false
    if (userFromDb.tenant_settings) {
      try {
        const tenantSettings = typeof userFromDb.tenant_settings === 'string' 
          ? JSON.parse(userFromDb.tenant_settings) 
          : userFromDb.tenant_settings;
        if (tenantSettings && typeof tenantSettings.allow_negative_stock === 'boolean') {
          allowNegativeStock = tenantSettings.allow_negative_stock;
        }
      } catch (e) {
        console.error(`Error parsing tenant_settings JSON for user ${userFromDb.id}:`, e);
      }
    }

    // Construct the user object for the response
    const userResponseData = {
      id: userFromDb.id,
      name: userFromDb.name,
      email: userFromDb.email,
      role: userFromDb.role,
      tenant_id: userFromDb.tenant_id,
      store_id: userFromDb.store_id, // Keep store_id at root for convenience if needed elsewhere
      is_active: userFromDb.is_active,
      phone_number: userFromDb.phone_number,
      profile_picture_url: userFromDb.profile_picture_url,
      last_login_at: userFromDb.last_login_at,
      created_at: userFromDb.created_at,
      updated_at: userFromDb.updated_at,
      store: { // Nest store-specific information
        id: userFromDb.store_id,
        name: userFromDb.store_name,
        currency_code: userFromDb.store_currency_code,
        language_code: userFromDb.store_language_code,
        country_code: userFromDb.store_country_code,
        tax_config: userFromDb.store_tax_config, // Add the full tax_config object for the store
        // Add other store-specific fields here if needed by frontend and available from query
      },
      default_tax_class_id: parsedDefaultTaxClassId, // This is related to user's context with store's tax system
      allow_negative_stock: allowNegativeStock, // This is a tenant-level setting affecting user's operations
      // Consider if other store-related fields like discount_application_rule should also be nested or are user-level context
    };

    res.json({ status: 'success', data: userResponseData });
  } catch (error) {
    console.error('Error fetching /api/users/me:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Server error while fetching user details.',
      error: error.message
    });
  }
});


// Debug endpoint to check sales table structure
app.get('/api/debug/sales-structure', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.execute('DESCRIBE sales');
    res.json({ status: 'success', data: rows });
  } catch (error) {
    console.error('Error getting sales table structure:', error);
    res.status(500).json({ status: 'error', message: 'Failed to get sales table structure', error: error.message });
  }
});

// Sales routes
app.get('/api/sales/history', authenticate, async (req, res) => {
  try {
    // Get all sales ordered by date
    const [salesRows] = await pool.execute(
      `SELECT * FROM sales ORDER BY created_at DESC LIMIT 100`
    );
    
    // Get all sale items and products
    const [itemRows] = await pool.execute(
      `SELECT si.*, p.name as product_name 
       FROM sale_items si 
       LEFT JOIN products p ON si.product_id = p.id`
    );
    
    // Format data and group items with their sales
    const salesMap = new Map();
    
    for (const sale of salesRows) {
      salesMap.set(sale.id, {
        id: sale.id,
        tenantId: sale.tenant_id,
        storeId: sale.store_id,
        cashierId: sale.cashier_id,
        subtotal: parseFloat(sale.subtotal),
        tax: parseFloat(sale.tax),
        total: parseFloat(sale.total),
        paymentMethod: sale.payment_method,
        status: sale.status,
        createdAt: sale.created_at,
        items: []
      });
    }
    
    for (const item of itemRows) {
      const saleId = item.sale_id;
      if (salesMap.has(saleId)) {
        const sale = salesMap.get(saleId);
        
        sale.items.push({
          id: item.id,
          productId: item.product_id,
          productName: item.product_name,
          quantity: item.quantity,
          price: parseFloat(item.price)
        });
      }
    }
    
    res.json({ 
      status: 'success',
      data: Array.from(salesMap.values()),
      message: 'Sales history retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching sales history:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to fetch sales history',
      error: error.message
    });
  }
});

// REMOVED: POST /api/sales route moved to createSaleController.js and handled via sales.routes.js
// Original route was causing conflicts with the mounted sales routes

// DIAGNOSTIC ENDPOINT: Get customer credit details
app.get('/api/diagnostic/customer/:customerId', async (req, res) => {
  const { customerId } = req.params;
  try {
    const connection = await pool.getConnection();
    
    try {
      // Get customer details
      const [customers] = await connection.execute(
        'SELECT id, first_name, last_name, outstanding_credit, credit_limit FROM customers WHERE id = ?',
        [customerId]
      );
      
      if (customers.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Customer not found'
        });
      }
      
      // Get related sales - corrected column names
      const [sales] = await connection.execute(
        'SELECT id, total, discount, payment_method, created_at FROM sales WHERE customer_id = ? ORDER BY created_at DESC LIMIT 10',
        [customerId]
      );
      
      // Get payment methods for reference
      const [paymentMethods] = await connection.execute('SELECT id, name, code FROM payment_methods');
      
      res.json({
        status: 'success',
        data: {
          customer: customers[0],
          sales,
          paymentMethods
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Diagnostic error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

app.get('/api/sales/summary', authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Get total sales, today's sales, transaction count, and average ticket size
    const [totalResult] = await pool.execute(
      `SELECT 
        COUNT(*) as transaction_count, 
        SUM(total) as total_sales,
        AVG(total) as average_ticket
       FROM sales`
    );
    
    // Get today's sales
    const [todayResult] = await pool.execute(
      `SELECT 
        SUM(total) as today_sales
       FROM sales
       WHERE DATE(created_at) = ?`,
      [today]
    );
    
    res.json({ 
      status: 'success',
      data: {
        transaction_count: parseInt(totalResult[0].transaction_count || 0),
        total_sales: parseFloat(totalResult[0].total_sales || 0),
        today_sales: parseFloat(todayResult[0].today_sales || 0),
        average_ticket: parseFloat(totalResult[0].average_ticket || 0)
      },
      message: 'Sales summary retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching sales summary:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to fetch sales summary',
      error: error.message
    });
  }
});

app.get('/api/sales/payment-summary', authenticate, async (req, res) => {
  try {
    // Get totals and counts by payment method
    const [paymentResults] = await pool.execute(
      `SELECT 
        payment_method,
        COUNT(*) as transaction_count,
        SUM(total) as total_amount
       FROM sales
       GROUP BY payment_method`
    );
    
    // Calculate total amount across all payment methods
    const totalAmount = paymentResults.reduce(
      (sum, row) => sum + parseFloat(row.total_amount || 0), 
      0
    );
    
    // Format the data
    const methods = paymentResults.map(row => ({
      method: row.payment_method,
      amount: parseFloat(row.total_amount || 0),
      percentage: totalAmount > 0 ? (parseFloat(row.total_amount || 0) / totalAmount) * 100 : 0,
      count: parseInt(row.transaction_count || 0)
    }));
    
    res.json({ 
      status: 'success',
      data: { methods },
      message: 'Payment summary retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching payment summary:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to fetch payment summary',
      error: error.message
    });
  }
});

app.get('/api/sales/top-products', authenticate, async (req, res) => {
  try {
    // Get top selling products by revenue
    const [topProducts] = await pool.execute(
      `SELECT 
        p.id,
        p.name,
        SUM(si.quantity) as total_sold,
        SUM(si.quantity * si.price) as revenue
       FROM sale_items si
       JOIN products p ON si.product_id = p.id
       GROUP BY p.id, p.name
       ORDER BY revenue DESC
       LIMIT 5`
    );
    
    res.json({ 
      status: 'success',
      data: topProducts.map(product => ({
        id: product.id,
        name: product.name,
        total_sold: parseInt(product.total_sold),
        revenue: parseFloat(product.revenue)
      })),
      message: 'Top selling products retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching top selling products:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to fetch top selling products',
      error: error.message
    });
  }
});

app.get('/api/sales/chart-data', authenticate, async (req, res) => {
  try {
    // Get sales data for the last 7 days
    const [chartData] = await pool.execute(
      `SELECT 
        DATE(created_at) as date,
        SUM(total) as sales,
        COUNT(*) as transactions
       FROM sales
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    );
    
    res.json({ 
      status: 'success',
      data: chartData.map(day => ({
        date: day.date,
        sales: parseFloat(day.sales),
        transactions: parseInt(day.transactions)
      })),
      message: 'Sales chart data retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching sales chart data:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to fetch sales chart data',
      error: error.message
    });
  }
});

app.get('/api/sales/category-summary', authenticate, getCategorySalesSummary);


// Error Handling Middleware (should be last, after all routes)
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});



// Start the server with retries
let server;

// Tracks every open TCP socket so graceful shutdown can force-close lingering
// keep-alive connections instead of waiting on server.close()'s callback,
// which only fires once ALL sockets are gone. Without this, a single
// keep-alive connection (or hung dev-tool poller) can keep server.close()
// from ever calling back within the shutdown grace period, which means
// pool.end() never runs and that process's MySQL connections leak until
// MySQL's own wait_timeout eventually reaps them — across several rapid
// nodemon restarts this exhausts a local MySQL's max_connections and
// produces exactly the "Too many connections" / "Connection lost" errors
// seen after repeated restarts.
const openSockets = new Set();
const trackServerSockets = (srv) => {
  srv.on('connection', (socket) => {
    openSockets.add(socket);
    socket.on('close', () => openSockets.delete(socket));
  });
};

// In development, wait until the previous nodemon process releases the port
// before binding. This prevents EADDRINUSE crashes during rapid restarts.
const waitForPortFree = (port, timeoutMs = 30000, intervalMs = 500) => {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tryBind = () => {
      const probe = net.createServer();
      probe.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          if (Date.now() - start > timeoutMs) {
            return reject(new Error(`Port ${port} is still in use after ${timeoutMs}ms`));
          }
          setTimeout(tryBind, intervalMs);
        } else {
          reject(err);
        }
      });
      probe.once('listening', () => {
        probe.close(() => resolve());
      });
      probe.listen(port);
    };
    tryBind();
  });
};

const listenWithRetry = (retries = 3) => {
  // Check for Let's Encrypt certificates
  const sslKeyPath = process.env.SSL_KEY_PATH || '/etc/letsencrypt/live/api.zettaz.com/privkey.pem';
  const sslCertPath = process.env.SSL_CERT_PATH || '/etc/letsencrypt/live/api.zettaz.com/fullchain.pem';
  
  let useHttps = false;
  let httpsOptions = {};
  
  try {
    if (process.env.BEHIND_REVERSE_PROXY === 'true') {
      console.log('⚠️  BEHIND_REVERSE_PROXY=true. Starting HTTP server for nginx/traefik...');
    } else if (fsSync.existsSync(sslKeyPath) && fsSync.existsSync(sslCertPath)) {
      httpsOptions = {
        key: fsSync.readFileSync(sslKeyPath),
        cert: fsSync.readFileSync(sslCertPath)
      };
      useHttps = true;
      console.log('✅ Let\'s Encrypt SSL certificates found. Starting HTTPS server...');
    } else {
      console.log('⚠️  SSL certificates not found. Starting HTTP server...');
      console.log(`Expected SSL files: ${sslKeyPath}, ${sslCertPath}`);
    }
  } catch (error) {
    console.log('Error reading SSL certificates, falling back to HTTP:', error.message);
  }
  
  if (useHttps) {
    server = https.createServer(httpsOptions, app).listen(PORT, () => {
      console.log(`🚀 HTTPS Server listening on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('🔐 Using Let\'s Encrypt SSL certificate');
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE' && retries > 0) {
        console.warn(`Port ${PORT} is in use. Retrying in 5 seconds... (${retries} retries left)`);
        setTimeout(() => {
          listenWithRetry(retries - 1);
        }, 5000);
      } else {
        console.error('HTTPS Server error:', err);
        safeExit(1, 'httpsServerError');
      }
    });
  } else {
    server = app.listen(PORT, () => {
      console.log(`🚀 HTTP Server listening on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('🔓 Running HTTP server - SSL certificates not available');
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE' && retries > 0) {
        console.warn(`Port ${PORT} is in use. Retrying in 5 seconds... (${retries} retries left)`);
        setTimeout(() => {
          listenWithRetry(retries - 1);
        }, 5000);
      } else {
        console.error('HTTP Server error:', err);
        safeExit(1, 'httpServerError');
      }
    });
  }

  if (server) trackServerSockets(server);
};

// Main application startup sequence
const start = async () => {
  try {
    console.log('Starting server...');

    // 1. Sequentially run database checks and initialization.
    // On a shared hosting MySQL server, "Too many connections"
    // (ER_CON_COUNT_ERROR) can happen transiently when other tenants on
    // the same server spike, or when leaked connections from a previous
    // crashed process haven't been reaped yet. Retry with backoff instead
    // of exiting immediately — a bare process.exit(1) here would leak the
    // pool's own connections too, making the problem worse (death spiral).
    const DB_STARTUP_RETRIES = parseInt(process.env.DB_STARTUP_RETRIES || '3', 10);
    const DB_STARTUP_DELAY_MS = parseInt(process.env.DB_STARTUP_DELAY_MS || '3000', 10);
    let dbReady = false;
    for (let attempt = 1; attempt <= DB_STARTUP_RETRIES; attempt++) {
      console.log(`Checking database setup... (attempt ${attempt}/${DB_STARTUP_RETRIES})`);
      dbReady = await checkDatabaseSetup();
      if (dbReady) break;
      if (attempt < DB_STARTUP_RETRIES) {
        console.warn(`Database setup failed, retrying in ${DB_STARTUP_DELAY_MS}ms...`);
        await new Promise(r => setTimeout(r, DB_STARTUP_DELAY_MS));
      }
    }
    if (!dbReady) {
      console.error('Halting server start due to database setup issues after retries.');
      await safeExit(1, 'checkDatabaseSetup');
    }
    console.log('Database setup check passed.');

    // Run lightweight column migrations (idempotent — safe to run on every startup)
    try {
      const [cols] = await pool.execute(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stores' AND COLUMN_NAME = 'theme'"
      );
      if (cols.length === 0) {
        await pool.execute("ALTER TABLE stores ADD COLUMN theme VARCHAR(10) NOT NULL DEFAULT 'light'");
        console.log('Schema migration: stores.theme column added.');
      } else {
        console.log('Schema migration: stores.theme column already exists.');
      }
    } catch (migErr) {
      console.warn('Schema migration warning (stores.theme):', migErr.message);
    }

    console.log('Initializing default user...');
    await initializeDefaultUser();
    console.log('Default user initialization complete.');

    // In development, wait for the port to be free so rapid nodemon restarts
    // don't crash with EADDRINUSE.
    if (process.env.NODE_ENV === 'development') {
      try {
        await waitForPortFree(PORT);
      } catch (err) {
        console.error(`Failed to start server: ${err.message}`);
        await safeExit(1, 'waitForPortFree');
      }
    }

    // 2. Start listening for requests
    listenWithRetry();

  } catch (error) {
    console.error('Failed to initialize server:', error);
    await safeExit(1, 'startCatch');
  }
};

// Graceful shutdown handler with re-entrancy guard and timeout
const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS || 10000);
let isShuttingDown = false;

const gracefulShutdown = (signal) => {
  if (isShuttingDown) {
    console.log(`[${new Date().toISOString()}] ${signal} received again: shutdown already in progress.`);
    return;
  }
  isShuttingDown = true;

  console.log(`\n[${new Date().toISOString()}] ${signal} received. Shutting down gracefully...`);

  // Safety net: close the MySQL pool exactly once, however this shutdown
  // ends up exiting (clean close, socket-destroy path, or the force-exit
  // timer below). Previously pool.end() only ran inside server.close()'s
  // callback, which never fires while ANY socket (e.g. a lingering
  // keep-alive connection) stays open — so a hung socket meant the force
  // timer fired process.exit(1) with the pool's connections never released
  // at all. Across several rapid nodemon restarts those abandoned
  // connections accumulate at the MySQL server until max_connections is
  // exhausted (this is what produced the "Too many connections" /
  // "Connection lost" errors after repeated restarts).
  let poolClosed = false;
  const closePoolOnce = () => {
    if (poolClosed) return;
    poolClosed = true;
    pool.end((err) => {
      if (err) console.error('Error closing the database connection pool:', err);
      else console.log(`[${new Date().toISOString()}] Database connection pool closed.`);
    });
  };

  // Force exit if shutdown takes too long
  const forceExitTimer = setTimeout(() => {
    console.error(`[${new Date().toISOString()}] Force exiting after ${SHUTDOWN_TIMEOUT_MS}ms shutdown timeout.`);
    closePoolOnce();
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  // Do not keep the event loop alive just for this timer
  if (forceExitTimer.unref) forceExitTimer.unref();

  if (server) {
    server.close(() => {
      console.log(`[${new Date().toISOString()}] HTTP server closed.`);
      closePoolOnce();
      clearTimeout(forceExitTimer);
      process.exit(0);
    });

    // Give in-flight requests a short grace period, then force-destroy any
    // remaining sockets (idle keep-alive connections, hung pollers) so
    // server.close()'s callback above actually fires instead of stalling
    // until the full SHUTDOWN_TIMEOUT_MS force-exit.
    const socketGraceTimer = setTimeout(() => {
      for (const socket of openSockets) {
        socket.destroy();
      }
    }, Math.min(3000, Math.floor(SHUTDOWN_TIMEOUT_MS / 2)));
    if (socketGraceTimer.unref) socketGraceTimer.unref();
  } else {
    closePoolOnce();
    clearTimeout(forceExitTimer);
    process.exit(0);
  }
};

// Handle process signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
  safeExit(1, 'uncaughtException');
});

// Kick off the startup sequence only when not running tests and when executed directly
if (require.main === module && process.env.NODE_ENV !== 'test') {
  start();
}

// Export the app for testing purposes (Supertest can import this without starting the server)
module.exports = app;