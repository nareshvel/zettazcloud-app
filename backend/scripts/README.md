# Database Maintenance Scripts

This directory contains maintenance and operational scripts for the Zettaz Cloud POS backend.

## Active scripts

| Script | Purpose |
|---|---|
| `migrate.js` | Migration runner. Applies pending migrations in `migrations/` and seeds in `seeds/`. |
| `check_db_connection.js` | Quick connectivity check used during deployment. |
| `update_charge_account_history.js` | Recalculates customer outstanding credit from charge-account history. |
| `delete_tenant.js` | Hard-deletes a tenant and all related data without leaving orphan rows. |
| `generate_delete_tenant_sql.js` | Generates `delete_tenant.sql` from the live schema for running in TablePlus. |
| `delete_tenant.sql` | Generated SQL script for tenant hard-delete. Regenerate if schema changes. |

## Archived scripts

One-off fix/debug/test scripts from earlier development have been moved to `archive/` to keep the main directory clean. They are preserved for reference but are no longer maintained or run routinely.

## `delete_tenant.js` / `delete_tenant.sql`

Hard-deletes a tenant and all related data across tenant-scoped tables, child tables, and store-owned tables.

**IMPORTANT:** This permanently removes data. Always preview first.

### Option A: SQL script (recommended for shared hosting / long-running deletes)

```bash
# Generate an up-to-date SQL file from the live schema
node scripts/generate_delete_tenant_sql.js
```

Open `backend/scripts/delete_tenant.sql` in TablePlus (or any MySQL client), replace `__TENANT_ID__` with the UUID, and run it.

```sql
SET @tenant_id = '0d519435-73d5-40db-a0b3-684c0ca72bcf';
```

### Option B: Node script

```bash
# Preview what will be deleted
node scripts/delete_tenant.js <tenant-id> --dry-run

# Stop the backend app first to avoid lock contention, then delete
node scripts/delete_tenant.js <tenant-id>

# Delete without confirmation prompt
node scripts/delete_tenant.js <tenant-id> --force
```

### What it does
1. Connects to the database configured in `backend/.env`.
2. Discovers every table that has a `tenant_id` column.
3. Identifies child tables without `tenant_id` that reference tenant-scoped parents.
4. Prints a row-count preview.
5. Disables foreign-key checks for the session and runs all deletes.
6. Deletes the tenant record from `tenants` last.

## Creating new scripts

When adding a maintenance script:
1. Place it in this directory.
2. Follow the naming pattern `<action>_<target>_<qualifier>.js`.
3. Add a row to the active-scripts table above.
4. Include detailed comments and a dry-run mode for destructive operations.
