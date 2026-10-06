/**
 * Application-wide constants
 * Centralizing configuration values to ensure consistency across the application
 */

// ---------------------------------------------------------------------------
// JWT Configuration
// ---------------------------------------------------------------------------
// SECURITY: the development fallback secret is a publicly known string committed
// to this repository. If it were ever used in production, anyone could forge a
// valid token for any tenant. We therefore fail fast rather than fall back when
// running outside development/test.
// ---------------------------------------------------------------------------

const DEV_FALLBACK_SECRET = 'your-secret-key-for-development-only';
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

if (IS_PRODUCTION && !process.env.JWT_SECRET) {
  throw new Error(
    '[FATAL] JWT_SECRET environment variable is required in production. ' +
    'Refusing to start with the public development fallback secret.'
  );
}

if (!process.env.JWT_SECRET) {
  console.warn(
    '[SECURITY WARNING] JWT_SECRET is not set — using the public development ' +
    `fallback secret. This is only permitted when NODE_ENV is "${NODE_ENV}". ` +
    'Never run production without a real JWT_SECRET.'
  );
}

const JWT_SECRET = process.env.JWT_SECRET || DEV_FALLBACK_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

module.exports = {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN,
  IS_PRODUCTION,
  NODE_ENV,
};
