/**
 * Script to examine database tables and data for RBAC migration
 */
const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from backend/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function getConnection() {
  return await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: process.env.MYSQL_PORT || 3306
  });
}

async function showTables() {
  const connection = await getConnection();
  try {
    const [tables] = await connection.query('SHOW TABLES');
    console.log('\n--- DATABASE TABLES ---');
    tables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(tableName);
    });
    return tables.map(table => Object.values(table)[0]);
  } finally {
    await connection.end();
  }
}

async function describeTable(tableName) {
  const connection = await getConnection();
  try {
    console.log(`\n--- TABLE STRUCTURE: ${tableName} ---`);
    const [columns] = await connection.query(`DESCRIBE ${tableName}`);
    columns.forEach(column => {
      console.log(`${column.Field} (${column.Type})${column.Key === 'PRI' ? ' [PRIMARY KEY]' : ''}`);
    });
    return columns;
  } finally {
    await connection.end();
  }
}

async function sampleTableData(tableName, limit = 5) {
  const connection = await getConnection();
  try {
    console.log(`\n--- SAMPLE DATA: ${tableName} (${limit} rows) ---`);
    const [rows] = await connection.query(`SELECT * FROM ${tableName} LIMIT ${limit}`);
    if (rows.length === 0) {
      console.log('No data found');
    } else {
      console.table(rows);
    }
    return rows;
  } finally {
    await connection.end();
  }
}

async function countTableRows(tableName) {
  const connection = await getConnection();
  try {
    const [result] = await connection.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    console.log(`Total rows in ${tableName}: ${result[0].count}`);
    return result[0].count;
  } finally {
    await connection.end();
  }
}

async function examineRbacTables() {
  // Examine users table
  await describeTable('users');
  await countTableRows('users');
  await sampleTableData('users');
  
  // Examine roles table
  await describeTable('roles');
  await countTableRows('roles');
  await sampleTableData('roles');
  
  // Examine permissions table if it exists
  try {
    await describeTable('permissions');
    await countTableRows('permissions');
    await sampleTableData('permissions');
  } catch (error) {
    console.log('Permissions table not found or cannot be accessed');
  }
  
  // Examine role_permissions table if it exists
  try {
    await describeTable('role_permissions');
    await countTableRows('role_permissions');
    await sampleTableData('role_permissions');
  } catch (error) {
    console.log('Role_permissions table not found or cannot be accessed');
  }
  
  // Examine user_roles table if it exists
  try {
    await describeTable('user_roles');
    await countTableRows('user_roles');
    await sampleTableData('user_roles');
  } catch (error) {
    console.log('User_roles table not found or cannot be accessed');
  }
  
  // Examine system_roles table if it exists
  try {
    await describeTable('system_roles');
    await countTableRows('system_roles');
    await sampleTableData('system_roles');
  } catch (error) {
    console.log('System_roles table not found or cannot be accessed');
  }
}

async function findUserByEmail(email) {
  const connection = await getConnection();
  try {
    console.log(`\n--- SEARCHING FOR USER: ${email} ---`);
    const [users] = await connection.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      console.log('User not found');
      return null;
    } else {
      console.table(users);
      return users[0];
    }
  } finally {
    await connection.end();
  }
}

async function checkUserPermissions(userId) {
  const connection = await getConnection();
  try {
    console.log(`\n--- CHECKING ROLES FOR USER ID: ${userId} ---`);
    // Check user_roles table
    const [userRoles] = await connection.query(`
      SELECT 
        ur.*, r.name as role_name
      FROM 
        user_roles ur
      JOIN 
        roles r ON ur.role_id = r.id
      WHERE 
        ur.user_id = ?
    `, [userId]);
    
    if (userRoles.length === 0) {
      console.log('No roles assigned to this user');
    } else {
      console.table(userRoles);
    }
    
    return userRoles;
  } catch (error) {
    console.log('Error checking user roles:', error.message);
    return [];
  } finally {
    await connection.end();
  }
}

async function run() {
  try {
    console.log('---------------------------------------------');
    console.log('Database Examination for RBAC Migration');
    console.log('---------------------------------------------');
    console.log('Database:', process.env.MYSQL_DATABASE);
    console.log('---------------------------------------------');
    
    // Get all tables first
    const tables = await showTables();
    
    // Examine RBAC-related tables
    await examineRbacTables();
    
    // Check for a specific user if provided in command line arguments
    const userEmail = process.argv[2];
    if (userEmail) {
      const user = await findUserByEmail(userEmail);
      if (user) {
        await checkUserPermissions(user.id);
      }
    }
    
    console.log('\nDatabase examination complete');
    
  } catch (error) {
    console.error('Error examining database:', error);
    process.exit(1);
  }
}

// Run the script
run();
