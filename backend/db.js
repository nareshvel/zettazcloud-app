/**
 * Thin re-export from config/db.js — ensures a single MySQL connection pool
 * for the entire process. Both `require('./db')` and `require('./config/db')`
 * resolve to the same module instance via Node's module cache.
 */
const configDb = require('./config/db');

const { pool, query, getConnection, executeTransaction, testConnection,
        setSessionTimeZone, getConnectionWithTimeZone, executeTransactionWithTimeZone } = configDb;

/**
 * Execute a query and return only the first row (or null).
 */
const queryOne = async (sql, params = []) => {
  const results = await query(sql, params);
  return (results && results[0]) || null;
};

/**
 * Execute an async callback inside a transaction; commits on success,
 * rolls back on error. Callback receives a transaction object with .query().
 */
const withTransaction = async (callback) => {
  return executeTransaction(async (connection) => {
    const trx = {
      query: (sql, params = []) => connection.query(sql, params).then(([r]) => r),
      getConnection: () => connection,
      commit: () => Promise.resolve(),   // handled by executeTransaction
      rollback: () => Promise.resolve(), // handled by executeTransaction
    };
    return callback(trx);
  });
};

/**
 * beginTransaction — kept for backward-compat; prefer withTransaction or executeTransaction.
 */
const beginTransaction = async () => {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  return {
    query: async (sql, params = []) => {
      const [results] = await connection.query(sql, params);
      return results;
    },
    commit: async () => {
      try { await connection.commit(); } finally { connection.release(); }
    },
    rollback: async () => {
      try { await connection.rollback(); } finally { connection.release(); }
    },
    getConnection: () => connection,
  };
};

module.exports = {
  pool,
  testConnection,
  query,
  queryOne,
  getConnection,
  beginTransaction,
  withTransaction,
  executeTransaction,
  setSessionTimeZone,
  getConnectionWithTimeZone,
  executeTransactionWithTimeZone,
};
