# TODO — 2026-03-05 — Project Detail Page Redesign

## Goal
Redesign `/projects/[id]` from a flat, utilitarian layout into a data-rich operations HUD with a compact hero header, inline quick stats, enriched tabs, and polished sub-panels.

## Plan

### Phase 1: Hero Header + Quick Stats
- [x] Add quick stats row below project name: Status (dot + text), Services (running/total + mini progress bar), Port (cyan mono, clickable), Uptime (live-ticking relative time)
- [x] Move status dot to left of project name (large, pulsing when running)
- [x] Badges row: colored type badge (matching dashboard `typeBadgeColor`), mono slug badge, URL with ExternalLink icon
- [x] Extract tab trigger className into a shared `const` to reduce repetition

### Phase 2: Loading + Error States
- [x] Replace "Loading..." text with skeleton shimmer (3 blocks: header, stats, tab placeholder) using `animate-pulse` divs
- [x] Improve "Not Found" error state: citrine diamond icon, rounded-xl border card wrapper

### Phase 3: Services Tab Polish
- [x] Add `animate-fade-up` stagger to service cards (40ms increments)
- [x] Add citrine left border to running service cards in `service-card.tsx` (`border-l-[3px] border-l-primary bg-primary/[0.02]`)
- [x] Replace empty services text with dashed border empty state card (diamond icon + "Add Service" button)

### Phase 4: Config Tab Refresh
- [x] Remove Card/CardHeader/CardContent wrapper from ConfigPanel, use bare panel style (rounded-xl border bg-card + header bar) matching preflight/env panels
- [x] Add live URL preview below slug field (`{slug}.localhost`)
- [x] Add Danger Zone section: red top border, "Delete Project" button with confirm dialog

### Phase 5: Tab Badge Counts
- [x] Services tab: show count `Services (N)`
- [x] Logs tab: show tiny green dot before "Logs" when connected (uses `anyRunning` as proxy for connection)

### Phase 6: Verification
- [x] Run `npx tsc --noEmit` — no type errors
- [x] Run `npm run build` — builds successfully
- [x] Run `npm test` — all existing tests pass

## Verification
- `npx tsc --noEmit` -> no type errors
- `npm run build` -> builds successfully
- `npm test` -> all existing tests pass

## Acceptance Criteria
- [x] Hero header shows large status dot, project name, path, quick stats row, and badges
- [x] Quick stats include live-ticking uptime counter
- [x] Loading state shows skeleton shimmer instead of plain text
- [x] Error state has citrine diamond icon and card wrapper
- [x] Running service cards have citrine left border glow
- [x] Services have staggered fade-up animation
- [x] Config panel uses bare panel style (no Card wrapper), has slug URL preview and Danger Zone
- [x] Tab bar has service count and logs connection indicator
- [x] No type errors, build succeeds, all tests pass

## Risks / Unknowns
- Frontend-only changes — no backend modifications needed
- Files to modify: `project-detail.tsx` (main), `service-card.tsx` (running border)
- Uptime counter uses `useEffect` interval — clean up on unmount
- Logs tab connection indicator requires accessing `connected` state from LogViewer (may need to lift state or use a simpler approach like checking `status?.running`)
