/**
 * Authentication Middleware Fix Script
 * 
 * This script:
 * 1. Updates the server.js file to register authentication middleware properly
 * 2. Ensures middleware is applied in the correct order:
 *    - JWT extraction (jwtMiddleware.js)
 *    - ID extraction (idExtractorMiddleware.js)
 *    - Route-specific permission checks (requirePermission.js)
 */

const fs = require('fs');
const path = require('path');

// Define paths
const serverPath = path.join(__dirname, '../server.js');

// Read server.js
let serverContent = fs.readFileSync(serverPath, 'utf8');

// Find where to insert the global middleware
const corsContent = serverContent.includes('app.use(cors({') 
  ? 'app.use(cors({'
  : 'const limiter = rateLimit({';

const afterCorsSection = serverContent.split(corsContent)[1].split('});')[0] + '});';
const insertionPoint = serverContent.indexOf(corsContent) + corsContent.length + afterCorsSection.length;

// Create the middleware registration code
const middlewareRegistration = `

// ======================================================
// AUTHENTICATION MIDDLEWARE CHAIN
// ======================================================
// This middleware chain ensures proper authentication flow:
// 1. JWT extraction and verification (sets req.user if token is valid)
// 2. ID extraction (ensures tenant_id and store_id are available in headers)
// 3. Route-specific permission checks (handled by the requirePermission middleware)

// Import authentication middlewares
const jwtMiddleware = require('./middleware/jwtMiddleware');
const idExtractorMiddleware = require('./middleware/idExtractorMiddleware');

// Global JWT middleware - extracts and validates JWT tokens, populates req.user
app.use(jwtMiddleware);

// Global ID extractor middleware - ensures tenant_id and store_id are available
app.use(idExtractorMiddleware);

// IMPORTANT: Individual routes will use requirePermission for specific permission checks
// requirePermission is imported in route files directly
// This separation ensures JWT extraction occurs even when permission checks are skipped

// Debug middleware to log JWT and ID extraction results
if (process.env.NODE_ENV === 'development' && process.env.DEBUG === 'auth') {
  app.use((req, res, next) => {
    console.log(\`[AUTH DEBUG] \${req.method} \${req.path}\`);
    console.log('  User:', req.user ? \`\${req.user.email} (ID: \${req.user.id})\` : 'Not authenticated');
    console.log('  Tenant:', req.headers['x-tenant-id'] || 'Not available');
    console.log('  Store:', req.headers['x-store-id'] || 'Not available');
    next();
  });
}
`;

// Insert the middleware registration
const newServerContent = 
  serverContent.slice(0, insertionPoint) + 
  middlewareRegistration + 
  serverContent.slice(insertionPoint);

// Write the updated server.js file
fs.writeFileSync(serverPath, newServerContent, 'utf8');

console.log('Authentication middleware chain successfully registered in server.js');
console.log('Changes made:');
console.log('1. Added global JWT middleware');
console.log('2. Added global ID extractor middleware');
console.log('3. Added debug middleware for development mode');
console.log('');
console.log('Please restart the server to apply these changes.');
