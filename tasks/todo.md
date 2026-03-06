# TODO — 2026-03-06 — Production Mode, Performance & Graceful Shutdown

## Goal
Run DevHub from production builds (eliminating "compiling..." delays), add graceful shutdown to kill all managed processes on exit (user-configurable), and optimize rendering performance with TanStack Query, server components, memoization, and code-splitting.

## Plan

### Phase 1: Graceful Shutdown Handler
- [x] 1.1 Add `stop_all_on_exit` to allowed settings keys in `src/app/api/settings/route.ts`
- [x] 1.2 Add "Stop all projects on exit" toggle to `src/app/settings/page.tsx` (default: enabled)
- [x] 1.3 Create `src/lib/process/shutdown.ts` — registers `SIGTERM`, `SIGINT` handlers:
  - Read `stop_all_on_exit` setting from DB
  - If enabled: call `pm.stopService()` on all running processes (with 30s global timeout)
  - If disabled: skip process cleanup
  - Close DB connection via `db.close()`
  - Call `process.exit()`
- [x] 1.4 Wire shutdown handler via `src/instrumentation.ts` (runs on server startup, before any request)
- [x] 1.5 Verify: kill the Next.js server with Ctrl+C, confirm child processes are stopped

### Phase 2: Production Build Infrastructure
- [x] 2.1 Add `build:watch` npm script — uses `nodemon` to watch `src/` and re-run `next build`
- [x] 2.2 Add `build:prod` npm script — alias for `next build`
- [x] 2.3 Create `scripts/devhub-launchagent.plist` — LaunchAgent that runs `npm start` via `zsh -lc`, sets `KeepAlive`, logs stdout/stderr
- [x] 2.4 Create `scripts/install-agent.sh` — substitutes DEVHUB_ROOT, copies plist to `~/Library/LaunchAgents/`, loads with `launchctl`
- [x] 2.5 Create `scripts/uninstall-agent.sh` — unloads and removes the plist
- [x] 2.6 Document usage in a comment block at top of each script
- [x] 2.7 Verify: `npx tsc --noEmit` passes, build verified in prior step

### Phase 3: TanStack Query Integration
- [x] 3.1 Install `@tanstack/react-query`
- [x] 3.2 Create `src/lib/query/provider.tsx` — `QueryClientProvider` wrapper with default config (staleTime, gcTime)
- [x] 3.3 Add `QueryProvider` to `src/app/layout.tsx` (wrap children)
- [x] 3.4 Create `src/lib/query/keys.ts` — query key factory
- [x] 3.5 Create `src/lib/query/hooks.ts` — typed hooks with shared types
- [x] 3.6 Create `src/lib/query/mutations.ts` — mutation hooks with query invalidation
- [x] 3.7 Migrate `src/components/dashboard/dashboard.tsx` — replace `useApi` with TanStack hooks + mutations
- [x] 3.8 Migrate `src/components/projects/project-detail.tsx` — replace `useApi` with TanStack hooks + mutations
- [x] 3.9 Migrate `src/components/projects/env-panel.tsx` — replace `useApi` with TanStack hook
- [x] 3.10 Migrate `src/components/projects/preflight-panel.tsx` — replace `useApi` with TanStack hook
- [x] 3.11 Migrate `src/app/settings/page.tsx` — replace `useApi` with TanStack hooks + mutations
- [x] 3.12 Migrate `src/app/stacks/page.tsx` — replace `useApi` with TanStack hooks + mutations
- [x] 3.13 Migrate `src/app/updates/page.tsx` — replace `useApi` with TanStack hook
- [x] 3.13a Migrate `src/components/services/service-card.tsx` + `src/app/login/page.tsx` — last consumers
- [x] 3.14 Remove `src/lib/hooks/use-api.ts` (all consumers migrated)
- [x] 3.15 Verify: `npx tsc --noEmit` — no type errors

### Phase 4: Server Component Migration
- [x] 4.1 Convert `src/app/page.tsx` — removed `"use client"`, server component shell
- [x] 4.2 Convert `src/app/projects/[id]/page.tsx` — removed `"use client"`, async server component with `await params`
- [x] 4.3 Convert `src/app/settings/page.tsx` — extract settings UI into `src/components/settings/settings-page.tsx` client component, page.tsx becomes server shell
- [x] 4.4 Convert `src/app/stacks/page.tsx` — extract into `src/components/stacks/stacks-page.tsx` client component
- [x] 4.5 Convert `src/app/updates/page.tsx` — extract into `src/components/updates/updates-page.tsx` client component
- [x] 4.6 Verify: `npx tsc --noEmit`, `npm run build` — all pass

### Phase 5: Component Performance Fixes
- [x] 5.1 Extract `<UptimeDisplay />` component in project-detail — isolate the 1s `setInterval` so only this small component re-renders
- [x] 5.2 Memoize `matchErrorPatterns()` results in log-viewer with `useMemo` keyed on `filteredLogs` (already done)
- [x] 5.3 Memoize `filteredProjects` in dashboard with `useMemo`
- [x] 5.4 Add `next/dynamic` code-splitting for ProjectDetail tab content: lazy-load `LogViewer`, `ProjectTerminal`, `EnvPanel`, `PreflightPanel`
- [x] 5.5 Verify: `npx tsc --noEmit`, `npm run build` — all pass

### Phase 6: Final Verification
- [x] 6.1 `npx tsc --noEmit` — no type errors
- [x] 6.2 `npm test` — all tests pass (109/109)
- [x] 6.3 `npm run build` — builds successfully
- [ ] 6.4 `npm start` — production server runs, no "compiling..." on navigation
- [ ] 6.5 Manual: start a project, close dev-hub (Ctrl+C), confirm project processes are terminated
- [ ] 6.6 Manual: toggle "Stop all on exit" off, restart + Ctrl+C, confirm processes survive

## Verification Commands
```bash
npx tsc --noEmit          # No type errors
npm test                   # All tests pass
npm run build              # Production build succeeds
npm start                  # Production server starts
```

## Acceptance Criteria
- [ ] No "compiling..." delays in production mode
- [ ] `build:watch` and `build:prod` npm scripts work
- [ ] LaunchAgent installs/uninstalls and auto-starts dev-hub on login
- [ ] "Stop all projects on exit" setting in UI, default enabled
- [ ] Ctrl+C on server kills all managed processes (when setting enabled)
- [ ] Ctrl+C on server leaves processes alive (when setting disabled)
- [ ] All `useApi` calls replaced with TanStack Query hooks
- [ ] Pages are server components; interactive parts are client components
- [ ] No 1-second full-tree re-renders in ProjectDetail
- [ ] Tab content in ProjectDetail is code-split (lazy loaded)
- [ ] All tests pass, build succeeds, no type errors

## Risks / Unknowns
| Risk | Mitigation |
|------|------------|
| Server component migration may break auth middleware | Test auth flow after migration; keep login page as client component |
| TanStack Query SSE interaction | Log stream hook (`useLogStream`) stays separate — it's already EventSource-based, not a query |
| `build:watch` tool choice | Evaluate `chokidar-cli` vs `nodemon` — pick whichever has simpler config |
| LaunchAgent env vars | Need to ensure `PATH` includes node/nvm in the plist; test with clean login |
| Shutdown handler in Next.js | `process.on('SIGINT')` may conflict with Next.js's own handler; test carefully |
