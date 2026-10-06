const { pool } = require('../config/db');

/**
 * Fetch the store's timezone from DB. Fallback to 'UTC'.
 * @param {string} storeId
 * @returns {Promise<string>} timezone string (e.g., 'UTC' or 'America/Chicago')
 */
async function getStoreTimezone(storeId) {
  if (!storeId) return 'UTC';
  try {
    const [rows] = await pool.query('SELECT timezone FROM stores WHERE id = ? LIMIT 1', [storeId]);
    if (rows && rows.length && rows[0].timezone) {
      return rows[0].timezone;
    }
  } catch (err) {
    console.error('[timeService] Failed to fetch store timezone:', err.message);
  }
  return 'UTC';
}

module.exports = {
  getStoreTimezone,
};
