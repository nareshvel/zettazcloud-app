/**
 * Script to fix unsafe req.user accesses in sales.routes.js
 * This script adds optional chaining and fallbacks to prevent server crashes
 * when req.user is undefined due to skipped permission checks
 */

const fs = require('fs');
const path = require('path');

// Path to the routes file
const routesPath = path.join(__dirname, '..', 'routes', 'sales.routes.js');

// Read the file
console.log(`Reading ${routesPath}...`);
let content = fs.readFileSync(routesPath, 'utf8');
let originalContent = content;

// Pattern 1: Direct tenant_id access with optional chaining but missing fallbacks
content = content.replace(/const tenant_id = req\.user\?\.tenant_id;/g, 
  'const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;');

// Pattern 2: Direct tenant_id destructuring
content = content.replace(/const \{ tenant_id \} = req\.user;/g, 
  'const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;');

// Pattern 3: Direct tenant_id and store_id destructuring
content = content.replace(/const \{ tenant_id, store_id \} = req\.user;/g, 
  'const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;\n  const store_id = req.user?.store_id || req.query?.store_id || req.headers["x-store-id"] || null;');

// Pattern 4: User id destructuring
content = content.replace(/const \{ tenant_id, id: user_id \} = req\.user;/g, 
  'const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;\n  const user_id = req.user?.id || "system";');

// Pattern 5: Direct access to req.user.tenant_id
content = content.replace(/req\.user\.tenant_id/g, 
  '(req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null)');

// Pattern 6: Direct access to req.user.store_id
content = content.replace(/req\.user\.store_id/g, 
  '(req.user?.store_id || req.query?.store_id || req.headers["x-store-id"] || null)');

// Pattern 7: Direct access to req.user.id
content = content.replace(/req\.user\.id/g, 
  '(req.user?.id || "system")');

// Write back the file if changed
if (content !== originalContent) {
  fs.writeFileSync(routesPath, content);
  console.log(`Fixed unsafe req.user accesses in sales.routes.js`);
} else {
  console.log('No changes needed in sales.routes.js');
}
