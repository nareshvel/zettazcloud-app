/**
 * Script to fix unsafe req.user accesses in category.routes.js
 * This script adds optional chaining and fallbacks to prevent server crashes
 * when req.user is undefined due to skipped permission checks
 */

const fs = require('fs');
const path = require('path');

// Path to the category routes file
const routesPath = path.join(__dirname, '..', 'routes', 'category.routes.js');

// Read the file
console.log(`Reading ${routesPath}...`);
let content = fs.readFileSync(routesPath, 'utf8');
let originalContent = content;

// Pattern 1: const { tenant_id, id: user_id } = req.user; 
content = content.replace(/const \{ tenant_id, id: user_id \} = req\.user;/g, 
  'const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"];\n    const user_id = req.user?.id || "system";');

// Pattern 2: const { tenant_id } = req.user;
content = content.replace(/const \{ tenant_id \} = req\.user;/g, 
  'const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"];');

// Write back the file if changed
if (content !== originalContent) {
  fs.writeFileSync(routesPath, content);
  console.log(`Fixed unsafe req.user accesses in category.routes.js`);
} else {
  console.log('No changes needed in category.routes.js');
}
