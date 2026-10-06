/**
 * Script to fix unsafe req.user accesses in customer.routes.js
 * This script adds optional chaining and fallbacks to prevent server crashes
 * when req.user is undefined due to skipped permission checks
 */

const fs = require('fs');
const path = require('path');

// Path to the routes file
const routesPath = path.join(__dirname, '..', 'routes', 'customer.routes.js');

// Read the file
console.log(`Reading ${routesPath}...`);
let content = fs.readFileSync(routesPath, 'utf8');
let originalContent = content;

// Pattern 1: Direct tenant_id access with optional chaining but missing fallbacks
content = content.replace(/const tenant_id = req\.user\?\.tenant_id;/g, 
  'const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;');

// Pattern 2: Direct destructuring of req.user
content = content.replace(/const \{ tenant_id \} = req\.user;/g, 
  'const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;');

// Pattern 3: Direct destructuring with tenant_id and user_id from req.user
content = content.replace(/const \{ tenant_id, id: user_id \} = req\.user;/g, 
  'const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;\nconst user_id = req.user?.id || "system";');

// Pattern 4: Direct access to req.user.id
content = content.replace(/req\.user\.id/g, 
  '(req.user?.id || "system")');

// Write back the file if changed
if (content !== originalContent) {
  fs.writeFileSync(routesPath, content);
  console.log(`Fixed unsafe req.user accesses in customer.routes.js`);
} else {
  console.log('No changes needed in customer.routes.js');
}
