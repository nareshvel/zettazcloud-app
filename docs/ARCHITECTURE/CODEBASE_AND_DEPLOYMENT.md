> **SUPERSEDED (2026-10):** This document describes the pre-migration production layout — backend at `/var/www/app-zettaz-cloud/repo`, remote MySQL `mysql.us.cloudlogin.co` (some docs also show the old shared-hosting frontend and port 3001). Current layout: everything on the VPS at `/var/www/zettazcloud-app` with MySQL `zettazcloud_prod @ localhost:3306`; deploy via `bash /var/www/zettazcloud-app/deploy.sh` or `deploy-quick.sh` (see `AGENTS.md` at the repo root). Kept for historical reference only.
>

# Codebase Management, Deployment & Maintenance Practices

A pragmatic plan to keep the app easy to maintain, improve and ship. Ordered by
impact-per-effort. Items are marked **P0** (do soon) → **P2** (nice to have).

## Current state (audit)

| Area | Today | Gap |
|---|---|---|
| CI | Only `.github/workflows/build-print-agent.yml` | No lint / typecheck / test on PRs |
| Tests | Backend `mocha` (some need a live DB); pure-logic tests pass | No coverage gate; few unit tests; no frontend tests |
| Lint | `backend/.eslintrc.js`, frontend `eslint .` | No Prettier, no pre-commit hook |
| Migrations | Manual, now foldered (`migrations/ → applied/`) | No automated runner yet (planned) |
| Deploy | `deploy-backend.sh`, `deploy-backend-simple.sh` (manual) | No staging gate, no documented rollback |
| Env | `backend/.env.example` exists | No `frontend/.env.example`; secrets handling undocumented |
| Repo hygiene | 4 stray `*.broken/.fixed/.backup` files in source; multiple dated SQL dumps | Dead files confuse; remove |
| Dependencies | Manual | No Dependabot/renovate; no update cadence |

## P0 — highest impact

1. **CI on every PR.** Add a workflow that runs, for both apps:
   `npm ci` → `npm run lint` → (frontend) `tsc --noEmit && npm run build` →
   (backend) `npm test`. Block merge on failure. This alone prevents most
   regressions.
2. **Branch + PR discipline.** `main` is protected and always deployable. Work on
   `feature/*` / `fix/*` branches → PR → 1 review → squash-merge. No direct pushes
   to `main`.
3. **Remove dead files.** Delete `*.broken`, `*.fixed`, `*.backup`,
   `*.js.backup` from source (git history retains them). Examples seen:
   `routes/userRoutes.js.broken`, `userRoutes.js.fixed`, `grnController.js.backup`.
4. **`frontend/.env.example`** committed; document required `VITE_*` vars.
   Never commit real `.env`. Rotate any secrets that were ever committed.
5. **Follow the migration practice** in `database/README.md` (pending →
   `applied/`) for every schema/data change. Never hand-edit prod schema.

## P1 — consistency & safety

6. **Pre-commit hooks** (`husky` + `lint-staged`): run ESLint + Prettier on staged
   files, and `tsc --noEmit` on the frontend. Stops style drift at the source —
   supports the goal of "not having to instruct styling every time"
   (see `FRONTEND_STANDARDS.md`).
7. **Prettier** with a shared config; format-on-save in the repo's `.editorconfig`.
8. **Automated DB migration runner.** A tiny script that records applied files in a
   `schema_migrations` table and applies anything left in `database/migrations/` in
   filename order — a drop-in for the manual move step. Run it as a deploy step.
9. **Staging environment** that mirrors prod. Deploy + run migrations there first,
   smoke-test, then promote. Never run an unproven migration on prod.
10. **Documented rollback.** For each release: DB backup taken immediately before
    migrations (we already keep dumps in `database/backup/`), and a tagged previous
    build to redeploy. Write the 3-command rollback in the deploy doc.
11. **Grow the test suite.** Prioritise pure-logic unit tests (fast, no DB) like
    `costCodeService`/`oldGoldService`, plus a few API integration tests against a
    disposable test DB. Aim for a modest coverage gate (e.g. 40% then ratchet up).

## P2 — scale & upkeep

12. **Dependabot / Renovate** for weekly dependency PRs; batch and review monthly.
13. **Release versioning + changelog.** Semantic version tags; keep
    `docs/13-changelog/` current (a `CHANGELOG.md` per release).
14. **Error monitoring & health checks.** Sentry (or similar) on backend + frontend;
    a `/health` endpoint hit by uptime monitoring; structured logs.
15. **Perf budget.** Watch the Vite bundle size; code-split heavy routes (many are
    already lazy). Add indexes via migrations as query patterns grow.
16. **CODEOWNERS + PR template** so reviews route correctly and checklists are
    consistent.

## Suggested deploy flow (target)

```
open PR ─▶ CI (lint + typecheck + build + test) ─▶ review ─▶ merge to main
   └▶ deploy to STAGING ─▶ run migrations (staging) ─▶ smoke test
        └▶ tag release ─▶ backup prod DB ─▶ deploy PROD ─▶ run migrations (prod) ─▶ verify
             └▶ rollback = redeploy previous tag + restore pre-deploy backup if needed
```

## Definition of done (per change)

- Lint + typecheck clean; relevant tests pass.
- Any schema change has an idempotent migration in `database/migrations/`.
- UI follows `FRONTEND_STANDARDS.md` (tokens, `ui/` primitives, i18n).
- Docs/changelog updated when behaviour or schema changes.
