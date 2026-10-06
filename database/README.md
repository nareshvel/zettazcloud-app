# Database — Migrations & Seeds Workflow

This project uses a simple, explicit **file-move** migration practice (no ORM
migration runner yet). It makes "what has been applied" obvious at a glance.

## Directory layout

```
database/
├── migrations/            # PENDING migrations (not yet applied to the DB)
│   └── applied/           # migrations that HAVE been applied
├── seeds/                 # PENDING seeds (not yet applied)
│   └── applied/           # seeds that HAVE been applied
└── backup/                # full DB dumps / reference snapshots (not migrations)
```

- **migrations/** = schema changes (CREATE/ALTER TABLE, indexes, constraints).
- **seeds/** = data inserts (reference/lookup data, defaults).
- A file lives in `migrations/` or `seeds/` until it is run against the DB; then
  it is **moved** into the corresponding `applied/` folder. So anything sitting
  directly in `migrations/` or `seeds/` is, by definition, still pending.

## Naming convention

`YYYY-MM-DD_short_snake_case_description.sql`

Example: `2026-08-08_serialized_inventory.sql`. The date prefix keeps files in
apply order when listed alphabetically.

## Authoring rules

0. **Backtick-quote every identifier that could be a reserved word.**
   MySQL 8 reserved a batch of window-function names. `last_value` bit us in
   production — it is the `LAST_VALUE()` function, so
   `INSERT INTO seq (tenant_id, last_value)` is a **syntax error** while
   `` INSERT INTO seq (tenant_id, `last_value`) `` is fine.
   Watch for: `last_value`, `first_value`, `nth_value`, `rank`, `dense_rank`,
   `row_number`, `lead`, `lag`, `over`, `window`, `groups`, `cume_dist`,
   `percent_rank`, `recursive`, `system`.
   This applies to **application SQL too**, not just migrations — a `CREATE TABLE`
   with backticks will succeed and then every runtime `INSERT` will fail.
   In JS, backticks can't sit inside a template literal: use a single-quoted
   string (`'INSERT INTO t (`col`) ...'`) instead.

1. **Idempotent.** Guard every statement so re-running is safe:
   - `CREATE TABLE IF NOT EXISTS ...`
   - For `ALTER TABLE ADD COLUMN`, check `INFORMATION_SCHEMA.COLUMNS` first and
     run via a prepared statement (see existing files for the pattern).
   - Seeds use `INSERT IGNORE` or `INSERT ... ON DUPLICATE KEY UPDATE`.
2. **One concern per file.** Keep a migration focused on a single feature/change.
3. **No destructive drops** without an explicit, reviewed reason.

## Apply workflow — use the runner

A runner script does the whole flow: applies every pending file in filename
order, records it in a `schema_migrations` table, and **moves it to `applied/`**
on success. Run it from the `backend/` folder (it reads `backend/.env`, so it
works over your DB tunnel).

```bash
cd backend

npm run migrate:status   # what's applied vs pending — runs nothing
npm run migrate:dry      # show what would run — changes nothing
npm run migrate          # apply pending migrations (asks to confirm)
npm run migrate:seeds    # include database/seeds/ as well
```

Extra flags: `--yes` (skip the prompt, for scripted runs), `--no-move` (apply but
leave files in place).

**Before running against production: take a database backup.** The script prints
the target host/database and asks for confirmation precisely so a wrong tunnel is
caught before anything executes.

Behaviour on failure: the runner stops at the first error, leaves that file in
`migrations/` (not moved, not recorded), and reports which files already
succeeded. Because migrations are idempotent, fix the file and re-run.

> Order matters: a feature's migration must run **before** its seed. Filename
> dates handle this as long as you name files correctly.

### Manual fallback (TablePlus)

Still fine for a one-off: run the file, then move it to `applied/` yourself. The
runner and the manual route are interchangeable — `schema_migrations` simply
won't have a row for manually applied files, which is harmless since everything
is idempotent.

See [MIGRATIONS_LOG.md](./MIGRATIONS_LOG.md) for the applied history.
