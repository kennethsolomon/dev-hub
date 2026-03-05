# TODO — 2026-03-05 — Button & Action Feedback (UX)

## Goal
Add loading states and inline feedback to all async action buttons across the app, so users always know an action is in progress and can't accidentally double-trigger it.

## Plan

### Phase 1: Dashboard (`src/components/dashboard/dashboard.tsx`)
- [x] Add `startingId`, `stoppingId`, `deletingId` (string | null) and `importing`, `refreshing` (boolean) states
- [x] Start/Stop buttons: show `Loader2` spinner + "Starting..."/"Stopping..." text, disable during call
- [x] Import Project button: show spinner + "Importing..." text, disable during call
- [x] Remove button: show spinner + "Removing..." text, disable during call
- [x] Refresh icon button: add `animate-spin` to `RefreshCw` icon while fetching

### Phase 2: ServiceCard (`src/components/services/service-card.tsx`)
- [x] Add `starting`, `stopping`, `saving`, `deleting` boolean states
- [x] Start/Stop: spinner + "Starting..."/"Stopping...", disabled
- [x] Save: spinner + "Saving...", disabled
- [x] Delete: spinner + "Removing...", disabled

### Phase 3: ProjectDetail (`src/components/projects/project-detail.tsx`)
- [x] Add `startingAll`, `stoppingAll`, `addingService` boolean states
- [x] Start All / Stop All: spinner + "Starting..."/"Stopping...", disabled
- [x] Add Service dialog "Add" button: spinner + "Adding...", disabled
- [x] ConfigPanel: add `saving` state, Save Changes button shows spinner + "Saving...", disabled

### Phase 4: EnvPanel (`src/components/projects/env-panel.tsx`)
- [x] Add `savingKey`, `removingKey` (string | null), `refreshing` (boolean) states
- [x] Save override: spinner + "Saving...", disabled
- [x] Remove override: spinner + "Removing...", disabled
- [x] Refresh button: spinner + "Refreshing..." text, disabled
- [x] Add Override dialog: spinner + "Adding...", disabled

### Phase 5: Verification
- [x] `npx tsc --noEmit` — no new type errors (pre-existing error in checks.test.ts)
- [x] `npm run build` — builds successfully
- [x] `npm test` — all 71 tests pass

## Acceptance Criteria
- [x] Every async button shows a Loader2 spinner + changed label while its action is in flight
- [x] Every async button is disabled during its action (no double-clicks)
- [x] Per-row actions (Dashboard start/stop, EnvPanel save/remove) only affect the clicked row's button
- [x] Refresh/icon-only buttons spin their icon during fetch
- [x] No layout shift when buttons transition between idle and loading states
- [x] No type errors, build succeeds, all tests pass
