/**
 * JWT Token Debugging Script
 * This script helps diagnose JWT verification issues by examining tokens
 * and verifying them with different secret keys
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');

// Function to inspect a JWT token without verification
function inspectToken(token) {
  try {
    // Just decode without verification to see what's in it
    const decoded = jwt.decode(token, { complete: true });
    console.log('\n===== TOKEN INSPECTION (No Verification) =====');
    console.log('Header:', JSON.stringify(decoded?.header, null, 2));
    console.log('Payload:', JSON.stringify(decoded?.payload, null, 2));
    console.log('Signature present:', !!decoded?.signature);
    
    // Check expiration
    const exp = decoded?.payload?.exp;
    if (exp) {
      const expiryDate = new Date(exp * 1000);
      const now = new Date();
      console.log('Expiration date:', expiryDate);
      console.log('Is expired:', expiryDate < now);
      console.log('Time until expiry:', expiryDate > now ? 
        `${Math.round((expiryDate - now) / 1000 / 60)} minutes` : 'Expired');
    }
    
    return decoded?.payload || null;
  } catch (e) {
    console.error('Error decoding token:', e.message);
    return null;
  }
}

// Function to verify a JWT token with different secrets
function verifyTokenWithDifferentSecrets(token) {
  console.log('\n===== VERIFICATION ATTEMPTS =====');
  
  // 1. Try with current JWT_SECRET from constants
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ VERIFIED with current JWT_SECRET from constants');
    return true;
  } catch (e) {
    console.error('❌ Failed with current JWT_SECRET:', e.message);
  }

  // 2. Try with common development fallback secrets we've found in the codebase
  const fallbackSecrets = [
    'your-secret-key',
    'your-secret-key-for-development-only',
    'your_jwt_secret'
  ];

  let succeeded = false;
  fallbackSecrets.forEach(secret => {
    try {
      const decoded = jwt.verify(token, secret);
      console.log(`✅ VERIFIED with fallback secret: '${secret}'`);
      succeeded = true;
    } catch (e) {
      console.error(`❌ Failed with '${secret}':`, e.message);
    }
  });

  return succeeded;
}

// Main execution
const token = process.argv[2];
if (!token) {
  console.error('Please provide a JWT token as argument');
  console.log('Usage: node debug_token.js <jwt_token>');
  process.exit(1);
}

// Step 1: Inspect token content without verification
const payload = inspectToken(token);

// Step 2: Try to verify with different secrets
const verified = verifyTokenWithDifferentSecrets(token);

// Summary
console.log('\n===== DIAGNOSIS SUMMARY =====');
console.log('Token inspection completed:', payload ? '✅ Success' : '❌ Failed');
console.log('Token verified with any secret:', verified ? '✅ Yes' : '❌ No');
console.log('\nRecommended Actions:');
if (!verified) {
  console.log('1. Check if frontend is using a different secret to generate tokens');
  console.log('2. Consider resetting all JWT_SECRET values to the same value in both frontend and backend');
  console.log('3. Clear browser localStorage to remove old tokens and re-login');
}
