const pool = require('../config/db');

/**
 * Generates a unique, sequential return number for a given tenant.
 * @param {string} tenantId - The ID of the tenant.
 * @param {object} connection - The database connection object for transactions.
 * @returns {Promise<string>} The next sequential return number (e.g., RTN-00001).
 */
const generateReturnNumber = async (tenantId, connection) => {
  const db = connection || pool;
  const [maxNumRow] = await db.query(
    'SELECT MAX(CAST(SUBSTRING(return_number, 5) AS UNSIGNED)) as max_num FROM sales_returns WHERE tenant_id = ?',
    [tenantId]
  );

  let nextNum = 1;
  if (maxNumRow && maxNumRow.length > 0 && maxNumRow[0].max_num) {
    nextNum = parseInt(maxNumRow[0].max_num, 10) + 1;
  }

  const returnNumber = `RTN-${String(nextNum).padStart(5, '0')}`;
  return returnNumber;
};

module.exports = {
  generateReturnNumber,
};
