// JWT Authentication Diagnostics
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('./config/constants'); // Import centralized JWT constants

console.log('==== JWT Authentication Diagnostics ====');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('SKIP_PERMISSION_CHECKS:', process.env.SKIP_PERMISSION_CHECKS);
console.log('JWT_SECRET defined:', process.env.JWT_SECRET ? 'Yes' : 'No');

// Create a test token with all required fields
const testToken = jwt.sign({
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  tenant_id: 'test-tenant-id',
  store_id: 'test-store-id',
  permissions: ['stores.view', 'tax.manage']
}, JWT_SECRET, {
  expiresIn: '1h'
});

console.log('Test token created:', testToken);

// Verify the token
try {
  const decoded = jwt.verify(testToken, JWT_SECRET); // Using centralized JWT_SECRET
  console.log('Token verification successful');
  console.log('Decoded token:', decoded);
} catch (err) {
  console.error('Token verification failed:', err.message);
}

console.log('\nDevelopment Mode Check:');
console.log('isDev && skipChecks:', 
  (process.env.NODE_ENV === 'development' && 
  process.env.SKIP_PERMISSION_CHECKS === 'true') ? 'Will skip permissions' : 'Will check permissions');
