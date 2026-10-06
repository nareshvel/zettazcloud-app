/**
 * Script to run a SQL migration file using the database configuration from .env
 * Usage: node run-migration.js <migration-file-path>
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Get the migration file path from command line arguments
const migrationFilePath = process.argv[2];

if (!migrationFilePath) {
  console.error('Please provide a migration file path');
  process.exit(1);
}

// Resolve the full path to the migration file
const fullPath = path.resolve(migrationFilePath);

// Check if the migration file exists
if (!fs.existsSync(fullPath)) {
  console.error(`Migration file not found: ${fullPath}`);
  process.exit(1);
}

// Read the migration SQL
const migrationSql = fs.readFileSync(fullPath, 'utf8');

// Database configuration from environment variables
const dbConfig = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: process.env.MYSQL_PORT || 3306,
  connectTimeout: 20000,
};

console.log(`Applying migration: ${path.basename(fullPath)}`);
console.log(`Database: ${dbConfig.host}/${dbConfig.database}`);

// Run the migration
async function runMigration() {
  let connection;
  try {
    // Create database connection
    connection = await mysql.createConnection(dbConfig);
    
    // Split the SQL script into individual statements
    const statements = migrationSql
      .replace(/^\s*--.*$/gm, '') // Remove comments
      .split(';')
      .filter(statement => statement.trim().length > 0);
    
    console.log(`Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}`);
      try {
        await connection.query(statement);
        console.log(`✓ Statement ${i + 1} completed successfully`);
      } catch (error) {
        console.error(`✗ Error executing statement ${i + 1}:`, error.message);
        throw error;
      }
    }
    
    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration();
