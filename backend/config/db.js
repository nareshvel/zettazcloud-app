const mysql = require('mysql2/promise');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Database configuration optimized for distributed architecture
//
// IMPORTANT: The MySQL user `digitpulse_zcloud` has max_user_connections=20
// on the shared hosting MySQL server (mysql.us.cloudlogin.co). This budget
// is shared across ALL clients using that user — the production backend
// (185.75.21.46), this local dev backend, migration scripts, and any
// ad-hoc check scripts. A pool of 8 here + 8 in production = 16, leaving
// only 4 for everything else, and any leaked connections from crashed
// processes stay for 8 hours (wait_timeout=28800s) eating into that 20.
//
// Default to 3 for development (env override: DB_CONNECTION_LIMIT). Production
// should set DB_CONNECTION_LIMIT=5 to stay well under the 20-user cap.
const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'digitpulse_zcloud',
  port: process.env.MYSQL_PORT || 3306,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '3', 10),
  // maxIdle caps the number of idle connections kept in the pool. On a
  // shared MySQL server with a tight per-user connection limit, idle
  // connections still count against max_user_connections. Default to 1
  // so we don't hold more than necessary when traffic is low.
  maxIdle: parseInt(process.env.DB_MAX_IDLE || '1', 10),
  queueLimit: 0,
  connectTimeout: 30000, // 30 seconds for remote connections
  timezone: 'Z', // Use UTC timezone
  decimalNumbers: true, // Return numbers as numbers, not strings
  typeCast: (field, next) => {
    // Convert TINYINT(1) to boolean
    if (field.type === 'TINY' && field.length === 1) {
      return field.string() === '1';
    }
    return next();
  },
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  // idleTimeout: how long an idle connection sits before mysql2 closes it.
  // The MySQL server's wait_timeout is 28800s (8h), but we want to return
  // idle connections to the server much faster so they stop counting
  // against max_user_connections. 60s is aggressive but appropriate for
  // a shared server with a 20-connection user budget.
  idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '60000', 10),
  ssl: false,
  multipleStatements: false,
  supportBigNumbers: true,
  bigNumberStrings: false
};

// Only log database config in development mode when debug is enabled
if (process.env.NODE_ENV === 'development' && process.env.DEBUG_DB === 'true') {
  // Log config with masked password
  const logConfig = {
    ...dbConfig,
    password: dbConfig.password ? '******' : '(empty string)'
  };
  console.log('Database configuration:', logConfig);
}

// Check if .env file exists but don't log
const envPath = path.join(__dirname, '..', '.env');
const envExists = fs.existsSync(envPath);

// Create the connection pool with more error handling
const pool = mysql.createPool(dbConfig);

// Handle pool errors gracefully
pool.on('error', (err) => {
  console.error('\n❌ Unexpected database pool error:', err);
  // Don't crash the server, just log the error
});

// Function to get a connection from the pool with retry logic
const getConnection = async (retries = 3, delay = 1000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await pool.getConnection();
    } catch (error) {
      const isLastAttempt = attempt === retries;
      console.error(`Error getting database connection (attempt ${attempt}/${retries}):`, error);

      // ER_CON_COUNT_ERROR ("Too many connections") is transient on a
      // shared MySQL server with a tight per-user connection limit —
      // a concurrent request finishing and releasing its connection
      // frees up a slot. Retry with backoff.
      if (error.code === 'ER_CON_COUNT_ERROR' && !isLastAttempt) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5;
        continue;
      }

      if (isLastAttempt) {
        throw error;
      } else {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        // Increase delay for next attempt
        delay *= 1.5;
      }
    }
  }
};

// Function to execute a query with retry logic and proper connection handling
// Default 3 retries (up from 2) to better handle transient ER_CON_COUNT_ERROR
// on the shared MySQL server with max_user_connections=20.
const query = async (sql, params = [], retries = 3, delay = 500) => {
  // Always use a dedicated connection and release it when done
  let connection;
  
  try {
    // Ensure params is an array
    if (!Array.isArray(params)) {
      params = [params];
    }
    
    // Process parameters to ensure numeric values are properly typed for MySQL
    const processedParams = params.map(param => {
      // For LIMIT and OFFSET values, ensure they're proper numbers
      if (typeof param === 'number' || (typeof param === 'string' && !isNaN(param))) {
        // If it looks like a number, convert it to a proper Number
        return Number(param);
      }
      return param;
    });
    
    connection = await pool.getConnection();
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Add query logging only when explicitly enabled via DEBUG_DB flag
        // This prevents excessive logging by default
        if (process.env.DEBUG_DB === 'true') {
          console.log(`Executing SQL (attempt ${attempt}/${retries}):`, sql);
          console.log('Parameters:', processedParams);
        }
        
        const [results] = await connection.execute(sql, processedParams);
        return results;
      } catch (error) {
        const isLastAttempt = attempt === retries;
        console.error(`Error executing query (attempt ${attempt}/${retries}):`, error);

        // For specific errors that require special handling
        if (error.code === 'ER_LOCK_WAIT_TIMEOUT' || error.code === 'ER_LOCK_DEADLOCK') {
          // These errors are often transient - wait longer before retry
          await new Promise(resolve => setTimeout(resolve, delay * 2));
        } else if (error.code === 'ER_CON_COUNT_ERROR' || error.code === 'PROTOCOL_CONNECTION_LOST') {
          // "Too many connections" (ER_CON_COUNT_ERROR) or a dropped
          // connection (PROTOCOL_CONNECTION_LOST) are transient on a
          // shared MySQL server with a tight per-user connection limit.
          // Wait before retrying so a concurrent request can finish and
          // release its connection back to the pool / server.
          await new Promise(resolve => setTimeout(resolve, delay * 2));
        } else if (isLastAttempt) {
          // On the last attempt, rethrow the error
          throw error;
        } else {
          // For other errors, just wait the standard delay
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Increase delay for next attempt
        delay *= 1.5;
      }
    }
  } finally {
    // Always release the connection back to the pool
    if (connection) {
      connection.release();
    }
  }
};

// Function to execute a transaction with proper connection management
const executeTransaction = async (callback) => {
  let connection;
  
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Error during transaction rollback:', rollbackError);
      }
    }
    throw error;
  } finally {
    // Always release the connection back to the pool
    if (connection) {
      connection.release();
    }
  }
};

// Resolve an IANA zone (e.g. 'America/Antigua') to the fixed UTC offset MySQL
// understands (e.g. '-04:00') using Node's own Intl/ICU data — no MySQL tz
// tables required. Returns null if the name isn't a real IANA zone at all.
// Note this computes the offset AT THE CURRENT MOMENT: for zones that
// observe DST, the offset can be wrong for stored past/future timestamps —
// this is only meant as a fallback for MySQL installs missing
// mysql.time_zone_name, which otherwise silently used UTC (a full,
// sometimes multi-hour, error) for every single such store.
const ianaToFixedOffset = (tz) => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(new Date());
    const part = parts.find((p) => p.type === 'timeZoneName')?.value; // e.g. "GMT-04:00" or "GMT"
    if (!part) return null;
    const match = part.match(/^GMT([+-]\d{2}:\d{2})$/);
    if (match) return match[1];
    if (part === 'GMT') return '+00:00';
    return null;
  } catch (_) {
    return null; // Intl doesn't recognize `tz` as a valid IANA zone at all
  }
};

// Set the session time_zone for a given connection. Accepts IANA TZ names (requires tz tables) or offsets like '+05:30'.
const _warnedTimezones = new Set();
const setSessionTimeZone = async (connection, tz) => {
  if (!tz) tz = 'UTC';
  const zone = typeof tz === 'string' && tz.trim() ? tz.trim() : 'UTC';
  try {
    // Normalize common header casing like 'utc'
    await connection.query('SET time_zone = ?', [zone]);
  } catch (err) {
    // MySQL doesn't have `zone` loaded (no mysql.time_zone_name rows — common
    // on shared hosting). Rather than falling straight back to UTC — which
    // is simply wrong for any store not actually in UTC — resolve the IANA
    // name to its current fixed offset via Node's own Intl data and use
    // that instead. Only fall back to UTC if that resolution also fails.
    const offset = ianaToFixedOffset(zone);
    if (offset) {
      try {
        await connection.query('SET time_zone = ?', [offset]);
        if (!_warnedTimezones.has(tz)) {
          _warnedTimezones.add(tz);
          console.warn(`[DB] MySQL has no tz table entry for '${tz}' — using resolved offset ${offset} instead of UTC. Load mysql.time_zone_name (mysql_tzinfo_to_sql) to use the IANA name directly and get correct DST handling.`);
        }
        return;
      } catch (_) {
        // fall through to UTC fallback below
      }
    }
    // Warn once per unique timezone to avoid log spam during bulk operations
    if (!_warnedTimezones.has(tz)) {
      _warnedTimezones.add(tz);
      console.warn(`[DB] Failed to set session time_zone='${tz}', falling back to UTC:`, err.message);
    }
    try { await connection.query('SET time_zone = ?', ['UTC']); } catch (_) {}
  }
};

// Obtain a connection and set its session time_zone before returning.
const getConnectionWithTimeZone = async (tz) => {
  const connection = await pool.getConnection();
  await setSessionTimeZone(connection, tz);
  return connection;
};

// Execute a transaction ensuring all queries run with the provided session time_zone.
const executeTransactionWithTimeZone = async (tz, callback) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await setSessionTimeZone(connection, tz);
    await connection.beginTransaction();

    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (rollbackError) { console.error('Error during transaction rollback:', rollbackError); }
    }
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Test database connection - only runs if DEBUG_DB_CONNECTION=true in .env
const testConnection = async (retries = 3) => {
  // Skip detailed connection testing unless explicitly enabled
  if (process.env.DEBUG_DB_CONNECTION !== 'true') {
    return true;
  }
  
  // Both pools created below are ad-hoc, separate from the module's real
  // singleton `pool` (declared further down this file) — they MUST be
  // explicitly `.end()`'d here, in a `finally`, or every server start with
  // DEBUG_DB_CONNECTION=true leaks 2× connectionLimit MySQL connections that
  // are never released for the lifetime of the process (compounding across
  // nodemon restarts toward MySQL's max_connections).
  let tempPool;
  let fullPool;
  try {
    // First create a connection without database to test server connection
    const baseConfig = {
      ...dbConfig,
      database: undefined // Remove database from config
    };

    console.log('Testing database connection...');

    tempPool = mysql.createPool(baseConfig);
    const connection = await tempPool.getConnection();

    // Check if our database exists
    const [databases] = await connection.query('SHOW DATABASES');
    const dbExists = databases.some(db => db.Database.toLowerCase() === dbConfig.database.toLowerCase());
    connection.release();

    if (!dbExists) {
      throw new Error(`Database '${dbConfig.database}' does not exist`);
    }

    // Try to connect with full config including database
    fullPool = mysql.createPool(dbConfig);
    const dbConnection = await fullPool.getConnection();
    await dbConnection.query('SELECT 1 AS test');

    console.log(`✅ Connected to database '${dbConfig.database}'`);
    dbConnection.release();

    // Check collation settings - minimal logging
    try {
      const [collationResults] = await fullPool.query(
        `SELECT * FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`,
        [dbConfig.database]
      );

      if (collationResults.length > 0) {
        const dbCollation = collationResults[0].DEFAULT_COLLATION_NAME;
        console.log(`Database collation: ${dbCollation}`);

        return true;
      } else {
        console.log('\n⚠️ Could not get database collation information');
        return false;
      }
    } catch (error) {
      console.error('Database connection test failed:', error.message);
      return false;
    }
  } catch (error) {
    console.error('\n❌ Database connection failed:', error);
    
    // Special handling for different error codes
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n🔑 Authentication failed: Check your MySQL username and password');
      console.log('\nTip: Make sure your .env file has the correct DB_USER and DB_PASSWORD values');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n🔌 Connection refused: Make sure MySQL server is running');
      console.log(`\nTip: Check if MySQL is running on ${dbConfig.host}:${dbConfig.port}`);
    }

    return false;
  } finally {
    // Always release both ad-hoc pools' connections back to the OS, whether
    // the test above succeeded, failed, or threw partway through.
    if (tempPool) await tempPool.end().catch(() => {});
    if (fullPool) await fullPool.end().catch(() => {});
  }
};

module.exports = {
  getConnection,
  query,
  executeTransaction,  // Export our new improved transaction function
  testConnection,
  pool,
  setSessionTimeZone,
  getConnectionWithTimeZone,
  executeTransactionWithTimeZone
};
