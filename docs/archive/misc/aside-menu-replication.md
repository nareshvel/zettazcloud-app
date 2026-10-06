# Prompt — Replicate the Zettaz VoterMatrix-Style Aside / Sidebar Menu

Use this prompt to replicate the native, VoterMatrix-inspired aside menu we built for Zettaz Cloud in another React + Tailwind application. The implementation intentionally avoids Metronic or Bootstrap; it is built with React, TypeScript, Tailwind CSS, `lucide-react`, `react-router-dom`, and `react-i18next`.

## Context / Goal

Build a native left sidebar that matches the visual hierarchy and behavior we designed for Zettaz Cloud:

- Dark navy floating card with rounded corners.
- Dashboard as a standalone, top-level, highlighted item.
- Grouped sections with uppercase section headers and chevron accordions.
- Only **one** accordion group may be open at a time.
- Permission- and industry-gated navigation.
- Active route auto-expansion and active-state highlighting.
- Responsive mobile drawer, collapse/expand toggle, and collapsed-mode flyouts.

## Visual & Layout Specs

| Element | Tailwind / Style |
|---|---|
| Sidebar panel | `fixed top-3 left-3 h-[calc(100%-1.5rem)] w-64 md:w-72 bg-slate-900 rounded-3xl shadow-sidebar z-50` |
| Item padding / rounding | `px-4 py-3 rounded-2xl` for both leaf links and group headers |
| Active leaf | `bg-blue-600 text-white font-semibold shadow-sm` |
| Active / open group header | `bg-white/5 text-white font-semibold` |
| Inactive items | `text-gray-300 hover:bg-white/5 hover:text-white` |
| Section headers | `text-gray-500 uppercase text-xs tracking-wider` with small icon |
| Chevron | `text-gray-500` |
| Main content offset | `md:pl-[19.5rem]` when expanded, `md:pl-[5.5rem]` when collapsed (add left/right margin equal to the sidebar float spacing) |

## Structural Requirements

1. **Navigation data model**

   Define a raw navigation tree with:
   - `titleKey` and `icon` on sections.
   - `nameKey`, `path`, `icon`, optional `children`, `permissions`, `roles`, `industries`, `excludeIndustries` on items.
   - English fallback dictionaries for section and nav labels so the menu renders even when i18n is still loading.

2. **Computed visible tree**

   Use `useMemo` to build the translated, permission-filtered, industry-filtered tree.
   - Grant `Tenant Admin` full access.
   - Use `hasAnyPermission` for permission checks.
   - Support legacy `role` fallback.
   - Recursively filter nested children.
   - Remove empty groups and sections.

3. **Active route detection**

   Use `matchPath({ path, end: false }, pathname)` from `react-router-dom` so parent groups are considered active when a child route is visited.

4. **Single-accordion behavior**

   - Store `expandedGroups` as `Record<string, boolean>`.
   - `toggleGroup(key)`: if the clicked group is already open, close it; otherwise, open it and close **all** other groups.
   - `useEffect` on `pathname` and `visibleNavigation`: find the deepest active group and set `expandedGroups = { [deepestKey]: true }`. If no group is active, collapse all groups.

5. **Collapsed / mobile behavior**

   - `w-16` collapsed sidebar shows only section icons.
   - Clicking a section icon opens a flyout panel with that section’s items.
   - Single-item sections (e.g., Dashboard) navigate directly in collapsed mode.
   - Mobile: hamburger toggle opens the sidebar over the content with an overlay.

## Implementation Notes

- Use `NavLink` from `react-router-dom` for leaf items; pass a function to `className` to derive the active state.
- Use `lucide-react` icons only; no Metronic / Bootstrap icon system.
- Use a Zettaz-style `Avatar` component for the user profile card only if the target app already has a top-bar user menu; otherwise, keep the footer minimal (just app version).
- Expose a stable `t` function from a `useI18n` hook via `useCallback` so it can be used safely in `useMemo` dependency arrays.
- In `i18n` custom backend: always invoke the read callback, even when the tab is hidden. Ignoring the callback while `document.hidden` can leave i18next stuck and produce a blank menu after a tab becomes visible.

## Reminders

- Do **not** import Metronic, Bootstrap, or VoterMatrix SASS.
- Keep the implementation native to the target app’s component system.
- Preserve the target app’s existing authentication, authorization, and industry gating.
- Verify with `tsc`, `eslint`, and a production build before finishing.

## Reference files in Zettaz Cloud

- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/components/layout/MainLayout.tsx`
- `frontend/src/hooks/useI18n.ts`
- `frontend/src/i18n/index.ts`
- `frontend/src/utils/permissionUtils.ts`
