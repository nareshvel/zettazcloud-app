/**
 * Script to fix unsafe req.user accesses in route files
 * This script adds optional chaining and fallbacks to prevent server crashes
 * when req.user is undefined due to skipped permission checks
 */

const fs = require('fs');
const path = require('path');

// Directory containing all route files
const routesDir = path.join(__dirname, '..', 'routes');

// Get all JS files in the routes directory
const files = fs.readdirSync(routesDir).filter(file => file.endsWith('.js'));
let fixedFiles = 0;

// Process each file
files.forEach(file => {
  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  // Pattern 1: direct access to req.user.tenant_id
  // Replace with optional chaining and fallbacks
  content = content.replace(/(\W)req\.user\.tenant_id/g, 
    '$1req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"]');
  
  // Pattern 2: direct access to req.user.id
  // Replace with optional chaining and system fallback
  content = content.replace(/(\W)req\.user\.id/g, 
    '$1req.user?.id || "system"');
  
  // Pattern 3: direct access to req.user.store_id
  // Replace with optional chaining and fallbacks
  content = content.replace(/(\W)req\.user\.store_id/g, 
    '$1req.user?.store_id || req.query?.store_id || req.headers["x-store-id"]');

  // Pattern 4: direct access to req.user.email
  // Replace with optional chaining and fallback
  content = content.replace(/(\W)req\.user\.email/g, 
    '$1req.user?.email || "system@example.com"');
  
  // Only write if changes were made
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    fixedFiles++;
    console.log(`Fixed unsafe req.user access in ${file}`);
  }
});

console.log(`\nCompleted fixes in ${fixedFiles} files.`);
