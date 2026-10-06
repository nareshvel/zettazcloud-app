#!/bin/bash

# Load environment variables from .env file
set -a
source /Users/nareshvelusamy/Herd/zettaz-cloud-enterprize/backend/.env
set +a

# Set database connection variables from .env
DB_HOST=${MYSQL_HOST}
DB_PORT=3306
DB_USER=${MYSQL_USER}
DB_PASSWORD=${MYSQL_PASSWORD}
DB_NAME=${MYSQL_DATABASE}

# Function to run SQL query
run_query() {
    MYSQL_PWD=$DB_PASSWORD mysql -h $DB_HOST -P $DB_PORT -u $DB_USER --silent --skip-column-names $DB_NAME -e "$1"
}

# Check if tenants table exists
TENANTS_EXIST=$(run_query "SHOW TABLES LIKE 'tenants';")

if [ -z "$TENANTS_EXIST" ]; then
    echo "Error: 'tenants' table does not exist in the database."
    exit 1
fi

# Check structure of tenants table
echo "=== Tenants Table Structure ==="
run_query "DESCRIBE tenants;"

# Check if sales table exists
SALES_EXIST=$(run_query "SHOW TABLES LIKE 'sales';")

if [ -z "$SALES_EXIST" ]; then
    echo "\nError: 'sales' table does not exist in the database."
    exit 1
fi

# Check structure of sales table
echo "\n=== Sales Table Structure ==="
run_query "DESCRIBE sales;"

# Check existing constraints
echo "\n=== Foreign Key Constraints ==="
run_query "SELECT * FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = '$DB_NAME' AND REFERENCED_TABLE_NAME IS NOT NULL;"

echo "\n=== Database Character Set and Collation ==="
run_query "SELECT @@character_set_database, @@collation_database;"

echo "\n=== Recommended Fixes ==="
echo "1. Ensure the 'id' column in the 'tenants' table is VARCHAR(36)"
echo "2. Make sure the 'id' column in the 'sales' table is VARCHAR(36)"
echo "3. Consider running the migration with foreign key checks disabled if needed:"
echo "   SET FOREIGN_KEY_CHECKS=0;"

# Check if payment tables already exist
echo "\n=== Existing Payment Tables ==="
run_query "SHOW TABLES LIKE 'payment_%';"

# Check if we have any data in the tenants table
echo "\n=== Sample Tenant Data ==="
run_query "SELECT id, name FROM tenants LIMIT 5;"

echo "\nTo run the migration with foreign key checks disabled, use:"
echo "MYSQL_PWD=$DB_PASSWORD mysql -h $DB_HOST -P $DB_PORT -u $DB_NAME $DB_NAME -e \"SET FOREIGN_KEY_CHECKS=0; SOURCE /path/to/migration.sql;\""
