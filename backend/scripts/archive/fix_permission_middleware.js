/**
 * Script to fix permission middleware and JWT extraction issues
 * This ensures tenant_id and store_id are extracted from JWT even when permission checks are skipped
 */

const fs = require('fs');
const path = require('path');

// Update the unified auth middleware to ensure JWT is parsed even when permission checks are skipped
const unifiedAuthMiddlewarePath = path.join(__dirname, '../middleware/unifiedAuthMiddleware.js');
let unifiedAuthContent = fs.readFileSync(unifiedAuthMiddlewarePath, 'utf8');

// Find and modify the authenticate middleware to extract tenant_id and store_id from JWT
// even when SKIP_PERMISSION_CHECKS is true
console.log('Updating unifiedAuthMiddleware.js...');

// If the middleware already skips the permission check but still extracts JWT data, we don't need to modify it
if (unifiedAuthContent.includes('// Extract user ID from JWT even when skipping permission checks')) {
  console.log('Auth middleware already fixed. Skipping update.');
} else {
  // Try to find the authenticate middleware and add JWT extraction code
  const pattern = /exports\.authenticate = async \(req, res, next\) => \{[^}]*?if\s*\(process\.env\.NODE_ENV === ['"]development['"]\s*&&\s*process\.env\.SKIP_PERMISSION_CHECKS === ['"]true['"]\)\s*\{\s*.*?console\.log\([^)]*\);\s*return\s+next\(\);/s;
  
  const replacement = `exports.authenticate = async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_PERMISSION_CHECKS === 'true') {
      console.log('RBAC MIDDLEWARE: Skipping permission checks in development mode');
      
      // Extract user ID from JWT even when skipping permission checks
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          const jwt = require('jsonwebtoken');
          // Use centralized JWT_SECRET from constants file
          const { JWT_SECRET } = require('../config/constants');
          const decoded = jwt.verify(token, JWT_SECRET);
          
          // Attach user data to req.user even in development mode
          req.user = decoded;
          
          // Extract key IDs into headers for routes that might need them directly
          if (decoded.tenant_id) req.headers['x-tenant-id'] = decoded.tenant_id;
          if (decoded.store_id) req.headers['x-store-id'] = decoded.store_id;
          if (decoded.id) req.headers['x-user-id'] = decoded.id;
          
          console.log('RBAC MIDDLEWARE: User data extracted from JWT in development mode');
        } catch (err) {
          // Don't block request if JWT is invalid in development mode
          console.log('RBAC MIDDLEWARE: JWT extraction failed, proceeding without authentication');
        }
      }
      
      return next();`;
  
  unifiedAuthContent = unifiedAuthContent.replace(pattern, replacement);
  
  fs.writeFileSync(unifiedAuthMiddlewarePath, unifiedAuthContent, 'utf8');
  console.log('Updated unifiedAuthMiddleware.js with JWT extraction in development mode');
}

// Fix the store routes to handle missing tenant_id and store_id
const storeRoutesPath = path.join(__dirname, '../routes/store.routes.js');
let storeRoutesContent = fs.readFileSync(storeRoutesPath, 'utf8');

// Update the '/current' route to better handle missing tenant_id
console.log('Updating store.routes.js...');

// Find the '/current' route handler
const storeCurrentPattern = /router\.get\(['"]\/current['"]\s*,\s*requirePermission\(['"]stores\.view['"]\)\s*,\s*async\s*\(\s*req\s*,\s*res\s*\)\s*=>\s*\{[\s\S]*?const tenantId\s*=\s*req\.user\?\.tenant_id[^}]*?}\s*\)\s*;/;

const storeCurrentReplacement = `router.get('/current', requirePermission('stores.view'), async (req, res) => {
  // Safe access to req.user which might be undefined when permission checks are skipped
  const tenantId = req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'];
  const storeId = req.user?.store_id || req.query?.store_id || req.headers['x-store-id'];

  console.log('[DEBUG] /api/stores/current - Headers:', req.headers);
  console.log('[DEBUG] /api/stores/current - User:', req.user);
  console.log('[DEBUG] /api/stores/current - Using tenantId:', tenantId);

  if (!tenantId) {
    return res.status(403).json({ status: 'error', message: 'Tenant information is missing or user is not authorized.' });
  }

  try {
    // Get the default store for this tenant
    // In a multi-store setup, you might want to get the store from user preferences or session
    const query = 'SELECT id, name, currency_code, tenant_id, tax_config, default_tax_basis FROM stores WHERE tenant_id = ? LIMIT 1';
    const [rows] = await pool.execute(query, [tenantId]);

    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No store found for this tenant.' });
    }

    const store = rows[0];

    // Parse tax_config JSON if it exists
    if (store.tax_config && typeof store.tax_config === 'string') {
      try {
        store.tax_config = JSON.parse(store.tax_config);
      } catch (e) {
        console.error('Error parsing tax_config JSON:', e);
      }
    }

    res.json({ status: 'success', data: store });
  } catch (error) {
    console.error('Error fetching current store:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch current store details.' });
  }
});`;

storeRoutesContent = storeRoutesContent.replace(storeCurrentPattern, storeCurrentReplacement);
fs.writeFileSync(storeRoutesPath, storeRoutesContent, 'utf8');
console.log('Updated store.routes.js with better tenant_id handling');

// Create a fix script for the reports routes
const reportsRoutesPath = path.join(__dirname, '../routes/reports.routes.js');
let reportsRoutesContent = fs.readFileSync(reportsRoutesPath, 'utf8');

// Add middleware to extract tenant_id and store_id for the /sales/transactions route
console.log('Updating reports.routes.js...');

// Find the '/sales/transactions' route
const transactionsRoutePattern = /router\.get\(['"]\/sales\/transactions['"]\s*,\s*requirePermission\(['"]reports\.view['"]\)\s*,\s*reportsController\.getSalesTransactions\);/;

const transactionsRouteReplacement = `router.get('/sales/transactions', requirePermission('reports.view'), (req, res, next) => {
  // Extract tenant_id and store_id before passing to controller
  // This ensures they're available even when permission checks are skipped
  req.headers['x-tenant-id'] = req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'];
  req.headers['x-store-id'] = req.user?.store_id || req.query?.store_id || req.headers['x-store-id'];
  next();
}, reportsController.getSalesTransactions);`;

reportsRoutesContent = reportsRoutesContent.replace(transactionsRoutePattern, transactionsRouteReplacement);

// Find the '/sales/chart' route
const chartRoutePattern = /router\.get\(['"]\/sales\/chart['"]\s*,\s*requirePermission\(['"]reports\.view['"]\)\s*,\s*reportsController\.getSalesChartData\);/;

const chartRouteReplacement = `router.get('/sales/chart', requirePermission('reports.view'), (req, res, next) => {
  // Extract tenant_id and store_id before passing to controller
  // This ensures they're available even when permission checks are skipped
  req.headers['x-tenant-id'] = req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'];
  req.headers['x-store-id'] = req.user?.store_id || req.query?.store_id || req.headers['x-store-id'];
  next();
}, reportsController.getSalesChartData);`;

reportsRoutesContent = reportsRoutesContent.replace(chartRoutePattern, chartRouteReplacement);

fs.writeFileSync(reportsRoutesPath, reportsRoutesContent, 'utf8');
console.log('Updated reports.routes.js with explicit tenant_id and store_id extraction');

console.log('Fixes applied successfully!');
