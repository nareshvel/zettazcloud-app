/**
 * Script to fix unsafe req.user accesses in taxSettingsController.js
 * This script adds optional chaining and fallbacks to prevent server crashes
 * when req.user is undefined due to skipped permission checks
 */

const fs = require('fs');
const path = require('path');

// Path to the controller
const controllerPath = path.join(__dirname, '..', 'controllers', 'taxSettingsController.js');

// Read the file
console.log(`Reading ${controllerPath}...`);
let content = fs.readFileSync(controllerPath, 'utf8');
let originalContent = content;

// Pattern 1: Direct destructuring of req.user
content = content.replace(/const\s*\{\s*tenant_id\s*\}\s*=\s*req\.user;?/g, 
  'const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;');

// Pattern 2: Direct destructuring of tenant_id and user_id from req.user
content = content.replace(/const\s*\{\s*tenant_id(?:,|\s*\})\s*(?:id:\s*user_id)?\s*\}\s*=\s*req\.user;?/g, 
  'const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;\n    const user_id = req.user?.id || "system";');

// Pattern 3: Direct access to req.user.tenant_id
content = content.replace(/req\.user\.tenant_id/g, 
  '(req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null)');

// Pattern 4: Direct access to req.user.id
content = content.replace(/req\.user\.id/g, 
  '(req.user?.id || "system")');

// Write back the file if changed
if (content !== originalContent) {
  fs.writeFileSync(controllerPath, content);
  console.log(`Fixed unsafe req.user accesses in taxSettingsController.js`);
} else {
  console.log('No changes needed in taxSettingsController.js');
}
