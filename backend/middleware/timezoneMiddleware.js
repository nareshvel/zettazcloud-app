const { getStoreTimezone } = require('../services/timeService');

/**
 * Resolve store timezone for the request and attach to req.storeTz.
 * Looks at req.user.store_id, headers: x-store-id|store-id|store_id, query/body as fallback.
 */
module.exports = async function timezoneMiddleware(req, res, next) {
  try {
    const {
      store_id: storeIdSnake,
      storeId: storeIdCamel,
    } = req.user || {};

    const storeId =
      storeIdSnake || storeIdCamel ||
      req.headers['x-store-id'] || req.headers['store-id'] || req.headers['store_id'] ||
      req.query.store_id || req.query.storeId || req.body.store_id || req.body.storeId;

    const tz = await getStoreTimezone(storeId);
    req.storeTz = tz || 'UTC';
  } catch (err) {
    console.warn('[timezoneMiddleware] Failed to resolve store timezone:', err.message);
    req.storeTz = 'UTC';
  }
  next();
};
