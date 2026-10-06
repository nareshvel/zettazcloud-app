#!/bin/bash

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Set default values if not set in .env
MYSQL_HOST=${MYSQL_HOST:-localhost}
MYSQL_USER=${MYSQL_USER:-root}
MYSQL_PASSWORD=${MYSQL_PASSWORD:-}
MYSQL_DATABASE=${MYSQL_DATABASE:-zettaz_pos}
MIGRATION_FILE="migrations/20250611003800_update_tax_tables_for_stores.sql"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to log messages
log() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Function to check if MySQL is available
check_mysql_connection() {
    log "Checking MySQL connection..."
    if ! mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" -e "SELECT 1" "$MYSQL_DATABASE" >/dev/null 2>&1; then
        log "${RED}Error: Could not connect to MySQL server${NC}"
        return 1
    fi
    log "${GREEN}✓ Connected to MySQL server${NC}"
    return 0
}

# Function to create a backup
create_backup() {
    local backup_file="backup_${MYSQL_DATABASE}_$(date +%Y%m%d%H%M%S).sql"
    log "Creating backup of database ${MYSQL_DATABASE}..."
    
    if ! mysqldump -h "$MYSQL_HOST" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" --single-transaction --routines --triggers "$MYSQL_DATABASE" > "$backup_file" 2>/dev/null; then
        log "${RED}Error: Failed to create database backup${NC}"
        return 1
    fi
    
    log "${GREEN}✓ Backup created successfully: ${backup_file}${NC}"
    echo "$backup_file"
    return 0
}

# Function to restore from backup
restore_backup() {
    local backup_file="$1"
    if [ ! -f "$backup_file" ]; then
        log "${RED}Error: Backup file not found: $backup_file${NC}"
        return 1
    fi
    
    log "Restoring database from backup: $backup_file"
    if ! mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" < "$backup_file" 2>/dev/null; then
        log "${RED}Error: Failed to restore database from backup${NC}"
        return 1
    fi
    
    log "${GREEN}✓ Database restored successfully from backup${NC}"
    return 0
}

# Main execution
log "${YELLOW}Starting database migration...${NC}"

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    log "${RED}Error: Migration file not found: $MIGRATION_FILE${NC}"
    exit 1
fi

# Check MySQL connection
if ! check_mysql_connection; then
    exit 1
fi

# Create backup
backup_file=$(create_backup)
if [ $? -ne 0 ]; then
    exit 1
fi

# Run migration
log "Running migration from $MIGRATION_FILE..."
if ! mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" < "$MIGRATION_FILE" 2>migration_errors.log; then
    log "${RED}Error: Migration failed. Check migration_errors.log for details.${NC}"
    
    # Restore from backup
    log "Attempting to restore from backup..."
    if ! restore_backup "$backup_file"; then
        log "${RED}Error: Failed to restore from backup. Please restore manually from $backup_file${NC}"
        exit 1
    fi
    
    exit 1
fi

# Verify migration
log "Verifying migration..."
if ! mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" -e "
    SELECT 
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$MYSQL_DATABASE' AND table_name = 'payment_methods') as payment_methods_exists,
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$MYSQL_DATABASE' AND table_name = 'payment_transactions') as payment_transactions_exists,
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$MYSQL_DATABASE' AND table_name = 'payment_terminals') as payment_terminals_exists,
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$MYSQL_DATABASE' AND table_name = 'tenant_payment_settings') as tenant_payment_settings_exists\G" "$MYSQL_DATABASE" 2>/dev/null | grep -v '\*\*\*' | grep -v '^$'; then
    
    log "${RED}Error: Failed to verify migration${NC}"
    log "Attempting to restore from backup..."
    if ! restore_backup "$backup_file"; then
        log "${RED}Error: Failed to restore from backup. Please restore manually from $backup_file${NC}"
        exit 1
    fi
    exit 1
fi

log "${GREEN}✓ Migration completed successfully!${NC}"
log "Backup file: $backup_file"
exit 0
