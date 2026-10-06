# Zettaz Cloud Documentation

Reorganized 2026-09-09 into a fixed, tool-agnostic taxonomy so any AI session
(Claude, Devin, Codex, Cursor) or human can find current state without
guessing which of 30+ old numbered folders to check.

## Structure

| Folder | What lives here |
|---|---|
| `AI_CONTEXT/` | The cross-tool handoff mechanism itself: `SESSION_LOG.md` (append-only, dated, tool-tagged log of what changed) and `HANDOFF_PROTOCOL.md` (the rules every tool follows before ending a session). **Start here in any new session.** |
| `ARCHITECTURE/` | System architecture, codebase structure, environment setup, deployment/infrastructure, print-module blueprint, dev standards (CORS, frontend standards, responsive standards). How the system is built and run. |
| `archive/` | Superseded or historical docs kept for reference only — old GRN drafts, old RBAC migration-history docs, `OLD_FILES_FOR_REFERENCE_ONLY/`, one-off dead prompts. Nothing here is current; check `MODULES/` or `FEATURES/` for the live version first. |
| `CLIENTS/` | End-user / tenant-facing docs — onboarding guide, printer user manual, legal. |
| `DECISIONS/` | ADRs and "why we chose X" write-ups (employees-vs-users, promotions persistence design, catalog sync adapter choice, tenant-vs-store identity). |
| `FEATURES/` | Feature specs and implementation plans, historical or in-progress — GRN, promotions, tax module, POS/Sales Hub, print templates, payment/return plans. |
| `HANDOFF/` | Dated session/fix records — `18-errors-fixes`-style write-ups, the old implementation changelog, resolved dashboard/i18n/onboarding fix logs. Read alongside `AI_CONTEXT/SESSION_LOG.md` for "what happened and when." |
| `ISSUES_FIXES/` | Symptom-indexed bug write-ups and root-cause analyses — timezone cluster, DB schema fixes, production incidents, mobile UI fixes. |
| `MODULES/` | Current-state reference docs for how a system actually works today — API reference (`api/`), RBAC (`rbac/`), print module (`print-module/`), cached data fetching. This is the "how does X work right now" shelf, as opposed to `FEATURES/`'s "how X was built / is planned." |
| `STRATEGY/` | Roadmap-level plans — the full `17-migration-and-roadmap` series (multi-store, Stripe billing, plan limits, signup/onboarding audits), project overview, deployment strategy comparison. |
| `TESTING/` | Test plans, QA checklists, testing strategy docs. |

## Where to look for what

- **Picking up mid-task from another tool?** Read `AI_CONTEXT/SESSION_LOG.md` first (last 3-5 entries), then `CLAUDE.md` at the repo root.
- **"How does RBAC/print/the API actually work today?"** → `MODULES/`
- **"Why did we build it this way?"** → `DECISIONS/`
- **"What's planned but not built?"** → `STRATEGY/` and the "Known pending work" section of `CLAUDE.md`.
- **"Something broke, has this happened before?"** → `ISSUES_FIXES/`
- **Old numbered folder reference in a stale doc or commit message?** It's gone — check the table above or `archive/` for where its contents landed.

## Conventions

- Every AI tool working on this repo reads `CLAUDE.md` (root) and `AI_CONTEXT/HANDOFF_PROTOCOL.md` before starting nontrivial work, and appends to `AI_CONTEXT/SESSION_LOG.md` before ending a session.
- Nothing gets hard-deleted from docs — superseded content moves to `archive/` instead, so history is never lost even though `docs/` itself is currently gitignored (see note in `HANDOFF_PROTOCOL.md`).
- New docs go directly into the right category above — don't recreate a numbered top-level folder.
