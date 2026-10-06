/**
 * Database Helper Module
 * 
 * This module centralizes database operations and provides a consistent interface
 * for all database queries throughout the application.
 * 
 * Benefits:
 * - Consistent connection handling
 * - Centralized error handling
 * - Standardized transaction management
 * - Logging and debugging support
 */

const { pool } = require('../config/db');
const logger = console; // Replace with your actual logging system if available

/**
 * Execute a database query
 * 
 * @param {String} sql - SQL query string with placeholders
 * @param {Array} params - Parameters for the query
 * @returns {Promise<Array>} Result and fields
 */
const query = async (sql, params = []) => {
  try {
    logger.debug('[DB] Executing query:', { 
      sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
      paramCount: params.length
    });
    
    const start = Date.now();
    const result = await pool.query(sql, params);
    const duration = Date.now() - start;
    
    if (duration > 500) {
      // Log slow queries for optimization
      logger.warn(`[DB] Slow query (${duration}ms):`, { 
        sql: sql.substring(0, 200),
        paramCount: params.length
      });
    }
    
    return result;
  } catch (error) {
    logger.error('[DB] Query error:', { 
      message: error.message,
      code: error.code,
      sql: sql.substring(0, 200),
      params: params.length > 10 ? `${params.length} params` : params
    });
    throw error;
  }
};

/**
 * Execute a database query with a single result expected
 * 
 * @param {String} sql - SQL query string with placeholders
 * @param {Array} params - Parameters for the query
 * @returns {Object|null} First result row or null
 */
const queryOne = async (sql, params = []) => {
  const [rows] = await query(sql, params);
  return rows.length ? rows[0] : null;
};

/**
 * Execute a transaction with multiple queries
 * 
 * @param {Function} callback - Function that receives a connection and executes queries
 * @returns {Promise<any>} Result from the callback
 */
const transaction = async (callback) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    logger.error('[DB] Transaction error:', { message: error.message });
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Insert a record into a table
 * 
 * @param {String} table - Table name
 * @param {Object} data - Data to insert (object with column names as keys)
 * @returns {Promise<Object>} Result with insertId
 */
const insert = async (table, data) => {
  const columns = Object.keys(data).join(', ');
  const placeholders = Object.keys(data).map(() => '?').join(', ');
  const values = Object.values(data);
  
  const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
  const [result] = await query(sql, values);
  
  return result;
};

/**
 * Update records in a table
 * 
 * @param {String} table - Table name
 * @param {Object} data - Data to update (object with column names as keys)
 * @param {String} whereClause - WHERE clause without the "WHERE" keyword
 * @param {Array} whereParams - Parameters for the WHERE clause
 * @returns {Promise<Object>} Result with affectedRows
 */
const update = async (table, data, whereClause, whereParams = []) => {
  const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
  const values = [...Object.values(data), ...whereParams];
  
  const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
  const [result] = await query(sql, values);
  
  return result;
};

/**
 * Delete records from a table
 * 
 * @param {String} table - Table name
 * @param {String} whereClause - WHERE clause without the "WHERE" keyword
 * @param {Array} whereParams - Parameters for the WHERE clause
 * @returns {Promise<Object>} Result with affectedRows
 */
const del = async (table, whereClause, whereParams = []) => {
  const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
  const [result] = await query(sql, whereParams);
  
  return result;
};

module.exports = {
  pool,
  query,
  queryOne,
  transaction,
  insert,
  update,
  delete: del // rename to avoid keyword conflict
};
