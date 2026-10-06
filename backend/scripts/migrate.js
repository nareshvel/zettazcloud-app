#!/usr/bin/env node
/**
 * Migration runner
 * -----------------------------------------------------------------------------
 * Applies every pending .sql file in database/migrations/ (and optionally
 * database/seeds/) in filename order, records it in a `schema_migrations` table,
 * and moves the file into the sibling `applied/` folder on success.
 *
 * Designed for the current workflow: manual, run from the backend folder against
 * the tunnelled PRODUCTION database.
 *
 * Usage (from backend/):
 *   node scripts/migrate.js --dry-run     # show what would run, change nothing
 *   node scripts/migrate.js               # run pending migrations (asks to confirm)
 *   node scripts/migrate.js --seeds       # include database/seeds/ as well
 *   node scripts/migrate.js --demo        # ALSO run *.demo.sql (demo tenants)
 *   node scripts/migrate.js --yes         # skip the confirmation prompt
 *   node scripts/migrate.js --no-move     # apply but leave files in place
 *   node scripts/migrate.js --status      # list applied + pending, run nothing
 *
 * Safety notes:
 *  - Each file runs inside a transaction where possible. MySQL performs an
 *    IMPLICIT COMMIT on DDL (CREATE/ALTER TABLE), so a failure midway through a
 *    multi-statement DDL file can leave it partially applied. Our migrations are
 *    written to be idempotent, so the fix is to correct the file and re-run.
 *  - Nothing is moved to applied/ unless the file executed without error AND was
 *    recorded in schema_migrations.
 *  - TAKE A DATABASE BACKUP BEFORE RUNNING AGAINST PRODUCTION.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mysql = require('mysql2/promise');
require('dotenv').config();

const ROOT = path.resolve(__dirname, '..', '..');
const MIGRATIONS_DIR = path.join(ROOT, 'database', 'migrations');
const SEEDS_DIR = path.join(ROOT, 'database', 'seeds');

const argv = process.argv.slice(2);
const FLAGS = {
  dryRun: argv.includes('--dry-run'),
  seeds: argv.includes('--seeds'),
  yes: argv.includes('--yes') || argv.includes('-y'),
  noMove: argv.includes('--no-move'),
  status: argv.includes('--status'),
  demo: argv.includes('--demo') || process.env.ALLOW_DEMO_SEED === '1',
};

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
};
const log = (...a) => console.log(...a);

function dbConfig() {
  const cfg = {
    host: process.env.MYSQL_HOST || process.env.DB_HOST,
    port: Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306),
    user: process.env.MYSQL_USER || process.env.DB_USER,
    password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.MYSQL_DATABASE || process.env.DB_NAME || process.env.DB_DATABASE,
  };
  if (!cfg.host || !cfg.user || !cfg.database) {
    throw new Error('Database config missing. Expected MYSQL_HOST / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE in backend/.env');
  }
  return cfg;
}

/**
 * Files named `*.demo.sql` carry demo/sample data, not schema.
 *
 * They are skipped unless demo seeding is explicitly requested, so that running
 * `npm run migrate` against a real database can never invent five fictional
 * companies in it. Opting in is deliberate and visible:
 *
 *   npm run migrate:demo            (or)   ALLOW_DEMO_SEED=1 npm run migrate
 *
 * The convention is enforced here rather than inside the SQL because gating
 * multi-row INSERTs from within MySQL requires wrapping every statement in a
 * PREPARE over a quoted string — which makes the seed unreadable and puts the
 * data one escaping mistake away from corruption.
 */
const DEMO_SUFFIX = '.demo.sql';
const isDemoFile = (f) => f.toLowerCase().endsWith(DEMO_SUFFIX);

/** List *.sql directly inside dir (not in applied/), sorted by filename. */
function pendingFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.sql'))
    .filter((f) => fs.statSync(path.join(dir, f)).isFile())
    .filter((f) => FLAGS.demo || !isDemoFile(f))
    .sort();
}

/**
 * Split a SQL file into executable statements.
 * Handles -- and # line comments, /* *\/ blocks, quoted strings, and DELIMITER.
 */
/**
 * Split a .sql file into individually executable statements.
 *
 * BUG HISTORY — read before editing.
 * The previous implementation tracked quote state correctly character-by-character,
 * then threw that knowledge away: it split by calling `buf.indexOf(delimiter)` on
 * the whole accumulated buffer, which happily matched a `;` *inside* a string
 * literal. A perfectly valid column comment such as
 *
 *     COMMENT 'ISO 4217; advisory'
 *
 * was therefore cut in half, producing two fragments that are not valid SQL. The
 * migration would fail partway through a file and leave the schema half-applied.
 *
 * This version does a single character-level pass and only ever splits at a
 * delimiter seen while OUTSIDE quotes and comments. Covered by
 * tests/migrationSplitter.test.js — do not "simplify" without running it.
 *
 * Handles: ' " ` quoting, doubled-quote escapes ('' and ""), backslash escapes,
 * -- and # line comments, block comments, and the client-side DELIMITER directive.
 */
function splitStatements(sql) {
  const statements = [];
  const push = (s) => { const t = s.trim(); if (t) statements.push(t); };

  let delimiter = ';';
  let buf = '';
  let i = 0;
  let inSingle = false, inDouble = false, inBacktick = false;

  const inLiteral = () => inSingle || inDouble || inBacktick;
  const atLineStart = () => buf.length === 0 || buf.endsWith('\n');

  while (i < sql.length) {
    const ch = sql[i];
    const next2 = sql.slice(i, i + 2);

    if (!inLiteral()) {
      // --- client-side DELIMITER directive (only meaningful at line start) ---
      if (atLineStart() && /^DELIMITER[ \t]/i.test(sql.slice(i, i + 10))) {
        const eol = sql.indexOf('\n', i);
        const line = sql.slice(i, eol === -1 ? sql.length : eol);
        push(buf); buf = '';
        delimiter = line.replace(/^DELIMITER[ \t]+/i, '').trim() || ';';
        i = eol === -1 ? sql.length : eol + 1;
        continue;
      }

      // --- line comments: -- (must be followed by space/EOL per MySQL) and # ---
      if (ch === '#' || (next2 === '--' && /[\s\r\n]|^$/.test(sql[i + 2] ?? '\n'))) {
        const eol = sql.indexOf('\n', i);
        i = eol === -1 ? sql.length : eol; // keep the newline for line-start tracking
        continue;
      }

      // --- block comment ---
      if (next2 === '/*') {
        const end = sql.indexOf('*/', i + 2);
        i = end === -1 ? sql.length : end + 2;
        buf += ' ';
        continue;
      }

      // --- statement delimiter, outside any literal: the only place we split ---
      if (sql.startsWith(delimiter, i)) {
        push(buf);
        buf = '';
        i += delimiter.length;
        continue;
      }
    }

    // --- quote state transitions ---
    if (ch === '\\' && (inSingle || inDouble)) {
      // Backslash escape inside a string consumes the next character.
      buf += sql.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (ch === "'" && !inDouble && !inBacktick) {
      if (inSingle && sql[i + 1] === "'") { buf += "''"; i += 2; continue; } // '' escape
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle && !inBacktick) {
      if (inDouble && sql[i + 1] === '"') { buf += '""'; i += 2; continue; } // "" escape
      inDouble = !inDouble;
    } else if (ch === '`' && !inSingle && !inDouble) {
      if (inBacktick && sql[i + 1] === '`') { buf += '``'; i += 2; continue; } // `` escape
      inBacktick = !inBacktick;
    }

    buf += ch;
    i++;
  }

  push(buf);
  return statements;
}

async function ensureTrackingTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    varchar(255) NOT NULL,
      kind        varchar(20)  NOT NULL DEFAULT 'migration',
      applied_at  timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
      statements  int          NOT NULL DEFAULT 0,
      duration_ms int          NOT NULL DEFAULT 0,
      PRIMARY KEY (filename)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function appliedSet(conn) {
  const [rows] = await conn.query('SELECT filename FROM schema_migrations');
  return new Set(rows.map((r) => r.filename));
}

function confirm(question) {
  if (FLAGS.yes) return Promise.resolve(true);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(/^y(es)?$/i.test(answer.trim())); });
  });
}

async function applyFile(conn, dir, file, kind) {
  const full = path.join(dir, file);
  const sql = fs.readFileSync(full, 'utf8');
  const statements = splitStatements(sql);
  const started = Date.now();

  log(`${c.cyan}▶ ${file}${c.reset} ${c.dim}(${statements.length} statements)${c.reset}`);

  let began = false;
  try {
    await conn.beginTransaction();
    began = true;
  } catch (_) { /* some servers disallow; continue without */ }

  try {
    for (const stmt of statements) {
      await conn.query(stmt);
    }
    if (began) { try { await conn.commit(); } catch (_) { /* implicit commit from DDL */ } }
  } catch (err) {
    if (began) { try { await conn.rollback(); } catch (_) { /* ignore */ } }
    throw err;
  }

  const duration = Date.now() - started;
  await conn.query(
    'INSERT INTO schema_migrations (filename, kind, statements, duration_ms) VALUES (?,?,?,?) ' +
    'ON DUPLICATE KEY UPDATE applied_at = CURRENT_TIMESTAMP, statements = VALUES(statements), duration_ms = VALUES(duration_ms)',
    [file, kind, statements.length, duration]
  );

  if (!FLAGS.noMove) {
    const appliedDir = path.join(dir, 'applied');
    fs.mkdirSync(appliedDir, { recursive: true });
    fs.renameSync(full, path.join(appliedDir, file));
  }

  log(`  ${c.green}✔ applied${c.reset} ${c.dim}in ${duration}ms${FLAGS.noMove ? '' : ' → applied/'}${c.reset}`);
}

(async function main() {
  let conn;
  try {
    const cfg = dbConfig();

    const targets = [
      { dir: MIGRATIONS_DIR, kind: 'migration', label: 'migrations' },
      ...(FLAGS.seeds ? [{ dir: SEEDS_DIR, kind: 'seed', label: 'seeds' }] : []),
    ];

    log(`\n${c.bold}Zettaz migration runner${c.reset}`);
    log(`${c.dim}database:${c.reset} ${cfg.database} ${c.dim}@${c.reset} ${cfg.host}:${cfg.port}\n`);

    // Say out loud when demo data is in scope. Seeding fictional companies into
    // a database should never be something that happened quietly.
    if (FLAGS.demo) {
      log(`${c.yellow}${c.bold}Demo seeding ENABLED${c.reset} ${c.dim}— *.demo.sql files are included in this run.${c.reset}\n`);
    } else {
      const skipped = targets
        .flatMap((t) => (fs.existsSync(t.dir) ? fs.readdirSync(t.dir) : []))
        .filter((f) => isDemoFile(f));
      if (skipped.length) {
        log(`${c.dim}Skipping ${skipped.length} demo file(s). Include them with: npm run migrate:demo${c.reset}\n`);
      }
    }

    conn = await mysql.createConnection({ ...cfg, multipleStatements: false });
    await ensureTrackingTable(conn);
    const done = await appliedSet(conn);

    // Build the work list
    const work = [];
    for (const t of targets) {
      for (const f of pendingFiles(t.dir)) {
        work.push({ ...t, file: f, alreadyRecorded: done.has(f) });
      }
    }

    if (FLAGS.status) {
      const [rows] = await conn.query('SELECT filename, kind, applied_at FROM schema_migrations ORDER BY applied_at');
      log(`${c.bold}Applied (${rows.length}):${c.reset}`);
      rows.forEach((r) => log(`  ${c.green}✔${c.reset} ${r.filename} ${c.dim}${new Date(r.applied_at).toISOString().slice(0, 19).replace('T', ' ')}${c.reset}`));
      log(`\n${c.bold}Pending (${work.length}):${c.reset}`);
      work.forEach((w) => log(`  ${c.yellow}•${c.reset} ${w.file}`));
      log('');
      return;
    }

    if (!work.length) {
      log(`${c.green}Nothing to do — no pending files.${c.reset}\n`);
      return;
    }

    log(`${c.bold}Pending (${work.length}):${c.reset}`);
    work.forEach((w) => log(`  ${c.yellow}•${c.reset} ${w.file}${w.alreadyRecorded ? `  ${c.dim}(already recorded — will re-run, migrations are idempotent)${c.reset}` : ''}`));
    log('');

    if (FLAGS.dryRun) {
      log(`${c.dim}--dry-run: nothing was executed or moved.${c.reset}\n`);
      return;
    }

    log(`${c.yellow}${c.bold}⚠  This runs against the database above. Take a backup first.${c.reset}`);
    const ok = await confirm(`${c.bold}Proceed? (y/N) ${c.reset}`);
    if (!ok) { log('Aborted.\n'); return; }
    log('');

    let applied = 0;
    for (const w of work) {
      try {
        await applyFile(conn, w.dir, w.file, w.kind);
        applied++;
      } catch (err) {
        log(`  ${c.red}✖ FAILED:${c.reset} ${err.message}`);
        log(`\n${c.red}${c.bold}Stopped.${c.reset} ${applied} file(s) applied before the failure.`);
        log(`${c.dim}"${w.file}" was NOT moved to applied/. Fix it and re-run — our migrations are idempotent.${c.reset}\n`);
        process.exitCode = 1;
        return;
      }
    }

    log(`\n${c.green}${c.bold}Done — ${applied} file(s) applied.${c.reset}\n`);
  } catch (err) {
    log(`${c.red}Error: ${err.message}${c.reset}\n`);
    process.exitCode = 1;
  } finally {
    if (conn) await conn.end();
  }
})();
