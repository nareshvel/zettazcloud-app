/**
 * Migration statement-splitter regression suite.
 *
 * WHY THIS EXISTS
 * ---------------
 * `scripts/migrate.js` splits a .sql file into statements on `;`, tracking quote
 * state so a semicolon inside a string literal is not treated as a terminator.
 * While authoring 2026-08-23_jurisdiction_profiles.sql this proved fragile: a
 * semicolon inside a COMMENT literal —
 *
 *     COMMENT 'ISO 4217; advisory - stores.currency_code wins'
 *
 * — split one CREATE TABLE into two fragments. Neither fragment is valid SQL, so
 * the migration would fail mid-file, leaving the schema partially applied.
 *
 * These tests pin the splitter's contract and check every pending migration
 * actually splits into runnable statements, so a bad literal is caught in CI
 * rather than against a live database.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// ---------------------------------------------------------------------------
// Load splitStatements() out of the migration runner without executing it.
// ---------------------------------------------------------------------------
function loadSplitter() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'migrate.js'), 'utf8');
  const start = src.indexOf('function splitStatements');
  assert.notStrictEqual(start, -1, 'splitStatements not found in scripts/migrate.js');
  const end = src.indexOf('\nfunction ', start + 10);
  const fnSrc = src.slice(start, end === -1 ? undefined : end);
  // eslint-disable-next-line no-new-func
  return new Function(`${fnSrc}; return splitStatements;`)();
}

const splitStatements = loadSplitter();

const MIGRATION_DIRS = [
  path.join(__dirname, '..', '..', 'database', 'migrations'),
  path.join(__dirname, '..', '..', 'database', 'seeds'),
];

/** A CREATE TABLE fragment that lost its tail will not contain ")ENGINE". */
const looksTruncated = (stmt) =>
  /CREATE\s+TABLE/i.test(stmt) && !/\)\s*ENGINE/i.test(stmt);

/** A statement that begins mid-literal is a split artefact, not real SQL. */
const startsWithKeyword = (stmt) =>
  /^\s*(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|SET|SELECT|PREPARE|EXECUTE|DEALLOCATE|START|COMMIT|ROLLBACK|USE|RENAME|TRUNCATE|CALL|GRANT|REVOKE|LOCK|UNLOCK|WITH|REPLACE)\b/i
    .test(stmt);

describe('Migration statement splitter', function () {
  describe('contract', function () {
    it('splits plain statements on semicolons', function () {
      const out = splitStatements('SELECT 1; SELECT 2;');
      assert.strictEqual(out.length, 2);
    });

    it('ignores whole-line comments', function () {
      const out = splitStatements('-- a comment\nSELECT 1;\n-- another\nSELECT 2;');
      assert.strictEqual(out.length, 2);
    });

    it('does NOT split on a semicolon inside a single-quoted literal', function () {
      // This is the exact failure that motivated the suite.
      const sql = "CREATE TABLE `t` (`c` varchar(3) COMMENT 'ISO 4217; advisory') ENGINE=InnoDB;";
      const out = splitStatements(sql);
      assert.strictEqual(
        out.length, 1,
        `Semicolon inside a string literal split the statement into ${out.length} fragments`
      );
      assert.ok(/\)\s*ENGINE/i.test(out[0]), 'statement lost its tail');
    });

    it('does NOT split on a semicolon inside a double-quoted literal', function () {
      const out = splitStatements('SELECT "a;b" AS x;');
      assert.strictEqual(out.length, 1);
    });

    it('does NOT split on a semicolon inside a backtick identifier', function () {
      const out = splitStatements('SELECT `weird;name` FROM t;');
      assert.strictEqual(out.length, 1);
    });

    it('handles doubled single-quote escapes', function () {
      const out = splitStatements("SELECT 'it''s fine; really' AS x;");
      assert.strictEqual(out.length, 1);
    });

    it('produces no empty statements', function () {
      const out = splitStatements('SELECT 1;;\n\n; SELECT 2;');
      assert.ok(out.every((s) => s.trim().length > 0), 'splitter emitted an empty statement');
    });
  });

  describe('every pending migration splits into runnable statements', function () {
    const files = [];
    MIGRATION_DIRS.forEach((dir) => {
      if (!fs.existsSync(dir)) return;
      fs.readdirSync(dir)
        .filter((f) => f.endsWith('.sql'))
        .forEach((f) => files.push(path.join(dir, f)));
    });

    if (files.length === 0) {
      it('no pending migrations to check', function () { this.skip(); });
      return;
    }

    files.forEach((file) => {
      const name = path.basename(file);

      it(`${name} — no truncated CREATE TABLE`, function () {
        const stmts = splitStatements(fs.readFileSync(file, 'utf8'));
        const bad = stmts.filter(looksTruncated);
        assert.strictEqual(
          bad.length, 0,
          `${bad.length} CREATE TABLE statement(s) lost their tail — almost always a ` +
          `semicolon inside a string literal. First offender:\n${(bad[0] || '').slice(0, 300)}`
        );
      });

      it(`${name} — every statement starts with a SQL keyword`, function () {
        const stmts = splitStatements(fs.readFileSync(file, 'utf8'));
        const bad = stmts.filter((s) => !startsWithKeyword(s));
        assert.strictEqual(
          bad.length, 0,
          `${bad.length} statement(s) begin mid-literal, meaning the splitter cut inside ` +
          `a string. First offender:\n${(bad[0] || '').slice(0, 300)}`
        );
      });
    });
  });
});
