# Frontend Standards & Design System

The single source of truth for how we build UI. Follow this and you shouldn't
need per-task styling instructions. New code that diverges should be corrected in
review.

## 1. Audit findings (why this doc exists)

The app already has a solid foundation that was being bypassed by newer code:

- **Design system present:** `src/components/ui/` is a shadcn/ui set (`button`,
  `card`, `table`, `dialog`, `input`, `select`, `badge`, `tabs`, `checkbox`,
  `switch`, `tooltip`, …) built with `class-variance-authority` + `cn()`.
- **Semantic theme tokens present:** `tailwind.config.js` defines HSL tokens
  (`primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`,
  `foreground`, `background`, `card`, …). Dark-mode-ready.
- **The gap:** several pages (including recently added ones) used **raw Tailwind
  colours** (`bg-blue-600`, `text-gray-500`), **hand-rolled modals/buttons/badges**,
  and **hardcoded strings** instead of i18n. That is the inconsistency to stop.

These have now been aligned and shared primitives added; see §4–§6.

## 2. Golden rules

1. **Use semantic tokens, not raw palette colours.**
   - ✅ `text-foreground`, `text-muted-foreground`, `bg-primary`, `bg-card`,
     `border-border`, `bg-destructive`.
   - ❌ `text-gray-500`, `bg-blue-600`, `text-red-700`.
2. **Use the `ui/` primitives, don't re-implement them.**
   - Buttons → `Button` (`variant`: default/secondary/outline/ghost/destructive/link; `size`).
   - Dialogs/modals → `Dialog` (or `ModalBase`), never a bespoke fixed-overlay div.
   - Tables → `ui/table` (`Table`, `TableHeader`, `TableRow`, `TableCell`).
   - Inputs/selects/checkboxes/switches/tabs → the matching `ui/` component.
   - Status pills → `StatusBadge` (see §5), which wraps `ui/badge`.
3. **Compose classes with `cn()`** (`@/lib/utils`) — never string-concatenate
   class names.
4. **All user-facing text goes through i18n** (`useI18n` / `t()`), with keys in
   `public/locales/<lng>/*.json`. No hardcoded English in components.
5. **Icons:** `lucide-react` only. Verify an icon exists before using it (some
   names differ by version, e.g. use `Contact`, not `IdCard`).
6. **Page shell:** every top-level page starts with `PageHeader` (§4) and pads
   with `p-6`.

## 3. File & naming conventions

- Components: `PascalCase.tsx`, one component per file, default export for pages.
- Reusable, app-agnostic primitives → `src/components/ui/`.
- Reusable, app-specific building blocks → `src/components/common/`.
- Feature components → `src/components/<feature>/`.
- Pages → `src/pages/`, route wired in `AppRoutes.tsx`, nav in `Sidebar.tsx`.
- Data access → `src/services/<name>Service.ts` (typed, uses `fetchApi`).

## 4. `PageHeader` (`components/common/PageHeader.tsx`)

```tsx
<PageHeader
  icon={Coins}
  title="Old Gold Exchange"
  subtitle="Buy customer metal, value by purity, issue a credit voucher."
  actions={<Button onClick={openNew}><Plus className="h-4 w-4" /> New Exchange</Button>}
/>
```

## 5. `StatusBadge` (`components/common/StatusBadge.tsx`)

Maps a domain status string to a consistent `ui/badge` variant. Extend the map in
one place instead of colouring spans by hand.

```tsx
<StatusBadge status={order.status} />   // received / in_progress / ready / …
```

## 6. Data-fetching pattern

- One typed `*Service.ts` per domain, calling `fetchApi` from `services/api.ts`.
- **The api client auto-converts** request bodies camelCase→snake_case and
  responses snake_case→camelCase. So: send/receive **camelCase** in components;
  the backend speaks snake_case. (Exception: `FormData` bodies are NOT converted —
  append backend `snake_case` keys yourself, and JSON-stringify nested objects.)
- Unwrap `{ status, data }` envelopes in the service, return clean typed data.

## 7. Adding a new page — checklist

1. `services/xxxService.ts` (types + fetchApi calls).
2. `pages/XxxPage.tsx` starting with `PageHeader`; use `Button`, `ui/table`,
   `Dialog`/`ModalBase`, `StatusBadge`, semantic tokens.
3. Add i18n keys to `public/locales/en/common.json` (+ other locales) — nav label
   under `nav.*`, section title under `sections.*`.
4. Route in `AppRoutes.tsx`; nav item in `Sidebar.tsx` with `permissions`.
5. `npx tsc --noEmit` clean before commit.

## 8. Known follow-ups (tech debt to burn down)

- Modals in the four jewelry pages still use a local overlay `div`; migrate them to
  `Dialog`/`ModalBase` for full consistency.
- Tables in those pages are plain `<table>`; migrate to `ui/table`.
- New nav items were briefly hardcoded; now use `nav.*` keys — keep it that way.
- Consider an ESLint rule to flag raw palette colours (`bg-(red|blue|green|gray)-\d`)
  in `.tsx` to enforce token usage automatically.
