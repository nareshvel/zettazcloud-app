/**
 * Rate Limiting Middleware
 * Simple in-memory rate limiter for API endpoints
 * For production, consider using Redis-based rate limiting
 */

const logger = require('../utils/logger');

// In-memory store for rate limits (reset on server restart)
const rateLimitStore = new Map();

/**
 * Rate limit middleware factory
 * @param {Object} options - Configuration options
 * @param {number} options.windowMs - Time window in milliseconds (default: 60000 = 1 minute)
 * @param {number} options.max - Maximum requests per window (default: 100)
 * @param {string} options.keyGenerator - Function to generate limit key (default: user ID or IP)
 */
function rateLimit(options = {}) {
  const {
    windowMs = 60000,
    max = 100,
    keyGenerator = (req) => req.user?.id || req.ip
  } = options;

  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();

    // Get or create rate limit entry
    let entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetTime) {
      // Create new entry or reset expired one
      entry = {
        count: 0,
        resetTime: now + windowMs
      };
      rateLimitStore.set(key, entry);
    }

    // Check if limit exceeded
    if (entry.count >= max) {
      const resetIn = Math.ceil((entry.resetTime - now) / 1000);
      logger.warn(`Rate limit exceeded for ${key}: ${entry.count}/${max} requests`);
      return res.status(429).json({
        status: 'error',
        message: 'Too many requests. Please try again later.',
        retryAfter: resetIn
      });
    }

    // Increment count
    entry.count++;

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', max - entry.count);
    res.setHeader('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());

    next();
  };
}

/**
 * Stricter rate limit for print operations (prevent abuse)
 */
const printRateLimit = rateLimit({
  windowMs: 60000, // 1 minute
  max: 30, // 30 prints per minute per user
  keyGenerator: (req) => `print:${req.user?.id || req.ip}`
});

/**
 * Rate limit for settings operations
 */
const settingsRateLimit = rateLimit({
  windowMs: 60000, // 1 minute
  max: 20, // 20 settings updates per minute per user
  keyGenerator: (req) => `settings:${req.user?.id || req.ip}`
});

/**
 * Clean up expired entries (call periodically)
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Clean up every 5 minutes
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);

module.exports = {
  rateLimit,
  printRateLimit,
  settingsRateLimit
};
