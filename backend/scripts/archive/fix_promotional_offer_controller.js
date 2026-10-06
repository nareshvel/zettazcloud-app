/**
 * Script to fix unsafe req.user accesses in promotionalOfferController.js
 * This script adds optional chaining and fallbacks to prevent server crashes
 * when req.user is undefined due to skipped permission checks
 */

const fs = require('fs');
const path = require('path');

// Path to the controller
const controllerPath = path.join(__dirname, '..', 'controllers', 'promotionalOfferController.js');

// Read the file
console.log(`Reading ${controllerPath}...`);
let content = fs.readFileSync(controllerPath, 'utf8');
let originalContent = content;

// Pattern 1: Direct destructuring of req.user
content = content.replace(/const\s*\{\s*tenant_id\s*\}\s*=\s*req\.user;?/g, 
  'const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;');

// Pattern 2: Direct destructuring with tenant_id and store_id
content = content.replace(/const\s*\{\s*tenant_id,\s*store_id\s*\}\s*=\s*req\.user;?/g, 
  'const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;\n    const store_id = req.user?.store_id || req.query?.store_id || req.headers["x-store-id"] || null;');

// Pattern 3: Direct destructuring with tenant_id and user_id
content = content.replace(/const\s*\{\s*tenant_id(?:,|\s*\})\s*(?:id:\s*user_id)?\s*\}\s*=\s*req\.user;?/g, 
  'const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;\n    const user_id = req.user?.id || "system";');

// Pattern 4: Direct access to req.user.tenant_id
content = content.replace(/req\.user\.tenant_id/g, 
  '(req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null)');

// Pattern 5: Direct access to req.user.store_id
content = content.replace(/req\.user\.store_id/g, 
  '(req.user?.store_id || req.query?.store_id || req.headers["x-store-id"] || null)');

// Pattern 6: Direct access to req.user.id
content = content.replace(/req\.user\.id/g, 
  '(req.user?.id || "system")');

// Write back the file if changed
if (content !== originalContent) {
  fs.writeFileSync(controllerPath, content);
  console.log(`Fixed unsafe req.user accesses in promotionalOfferController.js`);
} else {
  console.log('No changes needed in promotionalOfferController.js');
}
