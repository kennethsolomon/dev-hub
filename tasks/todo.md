# TODO — Auto Build & Restart (File Watcher)

## Goal

Add a file watcher that detects code changes in managed projects and automatically rebuilds + restarts flagged services. Toggleable per project, with per-service opt-in and a manual "Build & Restart" button.

## Plan

### Phase 1: DB Migration

- [x] 1.1 Add migration v2 to `src/lib/db/schema.ts`
- [x] 1.2 Update `Project` and `Service` interfaces in `src/lib/db/index.ts` with new fields
- [x] 1.3 Verify: `npm test` passes, dev server starts (migration auto-applies)

### Phase 2: File Watcher Module

- [x] 2.1 Create `src/lib/process/file-watcher.ts`
- [x] 2.2 Wire rehydration in `src/instrumentation.node.ts`
- [x] 2.3 Verify: `npx tsc --noEmit` passes

### Phase 3: API Endpoints

- [x] 3.1 Extend `PUT /api/projects/[id]` — add new fields + watcher start/stop on toggle
- [x] 3.2 Extend `PUT /api/services/[id]` — add `restart_on_watch`, `watch_build_command`
- [x] 3.3 Create `POST /api/projects/[id]/build` — manual trigger
- [x] 3.4 Verify: `npx tsc --noEmit` passes

### Phase 4: Hook into Process Lifecycle

- [x] 4.1 In ProcessManager `startProject()` — start watcher if `auto_build_enabled`
- [x] 4.2 In ProcessManager `stopProject()` — stop watcher
- [x] 4.3 Verify: `npx tsc --noEmit` passes

### Phase 5: Build Status SSE + Hook

- [x] 5.1 Create `src/app/api/build/stream/route.ts` — SSE endpoint for build status events
- [x] 5.2 Create `src/lib/hooks/use-build-status.ts` — client hook for build status
- [x] 5.3 Verify: `npx tsc --noEmit` passes

### Phase 6: UI — Project Header & Config

- [x] 6.1 Update `ProjectData` interface in hooks.ts
- [x] 6.2 Add `useBuildRestart` mutation hook
- [x] 6.3 Extend `useUpdateProject` mutation type
- [x] 6.4 Update project-detail.tsx header — Build & Restart button + auto-build toggle
- [x] 6.5 Add build progress banner in project-detail.tsx
- [x] 6.6 Update ConfigPanel — Build & Watch settings section
- [x] 6.7 Verify: `npx tsc --noEmit` passes

### Phase 7: UI — Service Card

- [x] 7.1 Update service type in hooks.ts
- [x] 7.2 Extend `useUpdateService` mutation type
- [x] 7.3 Update service-card.tsx — watch checkbox + build command override + watch badge
- [x] 7.4 Verify: `npx tsc --noEmit` passes

### Phase 8: Final Verification

- [x] 8.1 `npx tsc --noEmit` — no type errors
- [x] 8.2 `npm test` — all 130 tests pass
- [x] 8.3 `npm run build` — production build succeeds
- [ ] 8.4 Manual: import a project, enable auto-build, flag a service, edit a file → confirm rebuild + restart triggers
- [ ] 8.5 Manual: toggle auto-build OFF → confirm file changes no longer trigger restart
- [ ] 8.6 Manual: click "Build & Restart" button → confirm manual trigger works with auto-build OFF

## Verification Commands

```bash
npx tsc --noEmit          # No type errors
npm test                   # All tests pass
npm run build              # Production build succeeds
```

## Acceptance Criteria

- [x] DB migration adds new columns without breaking existing data
- [x] File watcher starts/stops when auto-build is toggled
- [x] Only services with `restart_on_watch = 1` are restarted on file change
- [x] Build command runs before restart (service override > project-level > skip)
- [x] Debounce prevents rapid-fire restarts (default 2s)
- [x] "Build & Restart" button works independently of auto-build toggle
- [x] Watcher ignores `node_modules`, `.git`, `.next`, `dist`, etc.
- [x] Watchers rehydrate on dev-hub restart for projects with auto-build enabled + running services
- [x] Auto-build toggle and build command visible in project config
- [x] Per-service "restart on file change" checkbox in service card edit mode
- [x] Build progress banner shows in project header during auto-build (phase text + animation)
- [x] All existing tests pass, build succeeds, no type errors
