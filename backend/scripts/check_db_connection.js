#!/usr/bin/env node

/**
 * Database Connection Health Check Script
 * Run this before deploying to ensure database connectivity
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'digitpulse_zcloud',
  port: process.env.MYSQL_PORT || 3306,
  connectTimeout: 10000, // 10 seconds
};

async function checkDatabaseConnection() {
  let connection;
  
  try {
    console.log('🔍 Checking database connection...');
    console.log(`Host: ${dbConfig.host}:${dbConfig.port}`);
    console.log(`Database: ${dbConfig.database}`);
    console.log(`User: ${dbConfig.user}`);
    
    connection = await mysql.createConnection(dbConfig);
    
    // Test basic query
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('✅ Database connection successful');
    
    // Test application tables
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME IN ('users', 'sales', 'products', 'stores')
    `, [dbConfig.database]);
    
    console.log(`📊 Found ${tables.length}/4 core tables`);
    
    if (tables.length < 4) {
      console.warn('⚠️  Some core tables are missing. Database may need migration.');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error(`Error: ${error.message}`);
    console.error(`Code: ${error.code}`);
    
    if (error.code === 'ETIMEDOUT') {
      console.log('\n💡 Suggestions for ETIMEDOUT:');
      console.log('1. Check if MySQL server is running');
      console.log('2. Verify firewall settings');
      console.log('3. Check if host/port are correct');
      console.log('4. Increase timeout values in .env');
    }
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n💡 Suggestions for access denied:');
      console.log('1. Verify username and password');
      console.log('2. Check user permissions');
      console.log('3. Ensure user can connect from this host');
    }
    
    return false;
    
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the check
if (require.main === module) {
  checkDatabaseConnection()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { checkDatabaseConnection };
