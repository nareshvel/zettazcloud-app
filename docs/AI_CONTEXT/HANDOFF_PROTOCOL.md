# AI Session Handoff Protocol

This project is worked on across multiple AI tools (Claude, Devin, Codex,
Cursor) in no fixed order. This file is the rulebook that keeps a session in
any one of them from disrupting or duplicating work started in another.

## Before starting nontrivial work

1. Read `/CLAUDE.md` (repo root) — conventions, module status, known pending
   work, and hard-won gotchas (collations, migration ordering, RBAC bypass
   logic, etc.).
2. Read the last 3-5 entries of `docs/AI_CONTEXT/SESSION_LOG.md` — what
   changed most recently, in which tool, and what was left unverified.
3. Run `cd backend && npm run migrate:status` before testing any feature that
   touches the database. A migration file existing and passing its own test
   is not the same claim as "applied to the database you're about to test
   against" — this has caused real bugs twice (see `HANDOFF/`).

## Before ending a session

1. Append an entry to `docs/AI_CONTEXT/SESSION_LOG.md` (format below).
2. If you changed module status or added to the pending-work list, update
   `CLAUDE.md`'s "Module status" / "Known pending work" tables to match —
   don't let those tables drift from reality.
3. If work is genuinely mid-task (not just "more could be done" but "this
   will break if left half-applied"), say so explicitly in the log entry's
   "In-flight" line — don't let it read as finished.

## Verified vs. unverified — say which

Every claim of "done" in the session log or in `CLAUDE.md` must say how it
was checked: `tsc --noEmit`, a test suite, `migrate:status` + a live query,
or an actual manual click-through. "Code complete" and "field-proven" are
different claims — this codebase has been burned by that gap before (Print
Module Phase 1's two live-only bugs, the Print Agent Go rework never
compiled by an AI session). If you didn't check it, write "unverified" and
say what would verify it.

## Session log entry format

Append to the bottom of `docs/AI_CONTEXT/SESSION_LOG.md`:

```
## 2026-09-09 — Claude (Cowork)
**Changed:** Added records-per-page dropdown to ReusableTable.tsx and
StockCountPage.tsx; fixed missing itemsPerPage dep in StockCountPage's
paginatedProducts memo.
**Files:** frontend/src/components/ReusableTable.tsx,
frontend/src/pages/StockCountPage.tsx, frontend/src/pages/CustomersPage.tsx
**Verified:** tsc --noEmit clean on all three files. Not manually
click-tested in a browser.
**In-flight:** none — this task is complete.
**Next:** none pending from this thread.
```

Keep entries short — 5-10 lines. The full narrative belongs in `HANDOFF/` as
a dated write-up if the session was substantial; the log entry just needs to
tell the next session where to look.

## `docs/` is now tracked in git (fixed 2026-09-09)

`.gitignore`'s `/docs/` exclusion was removed and the whole reorganized
folder committed as one baseline snapshot (225 files, single commit). Going
forward, `git log -- docs/<path>` and `git blame` work normally for doc
history — treat git as the ground truth for "what changed and when" the same
way it is for code. The session log above is still required (git doesn't
tell you what's *unverified* or *in-flight*, which is the whole point of the
log), but it's no longer the *only* record: if a doc looks wrong, check
`git log` on it before assuming the log entry is the full story.

Practical note: because the baseline was one big commit rather than
preserved per-file history from before the reorg, `git log` on any doc only
goes back to 2026-09-09 — it won't show pre-reorg authorship. That's a
one-time gap, not an ongoing one; every doc change from here on gets normal
history.
