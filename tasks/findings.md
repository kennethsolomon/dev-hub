# Findings — 2026-03-06 — Production Mode, Performance & Graceful Shutdown

## Problem Statement

DevHub runs in dev mode (`npm run dev` with Turbopack), causing visible "compiling..." delays on every navigation. All pages are client-rendered with no code-splitting, heavy re-render loops, and no data caching. Additionally, when the dev-hub server closes, all managed project processes remain orphaned — there's no shutdown handler. The app should behave like a production application.

## Requirements

| Requirement | Details |
|-------------|---------|
| Production build mode | Run from `npm run build` + `npm start` to eliminate compilation delays |
| Build modes | Toggle between `--watch` (auto-rebuild on changes) and manual build |
| Auto-start on login | LaunchAgent to start dev-hub on macOS login |
| Menu bar indicator | Deferred to future — too large a scope (native app needed) |
| Graceful shutdown | User-configurable: "Stop all projects on exit" toggle in settings |
| Shutdown escalation | SIGINT -> SIGTERM -> SIGKILL with stop_timeout respected |
| Server components | Migrate pages to server components where possible for less JS |
| TanStack Query | Replace raw `useApi()` hooks with TanStack Query for caching/dedup |
| Memoization | Fix re-render issues (1s timer, log pattern matching, filtering) |
| Code-splitting | Lazy-load tab content in ProjectDetail via `next/dynamic` |

## Chosen Approach: Full Production Optimization (Approach C)

### Work Streams

#### 1. Production Build Infrastructure
- Add npm scripts: `build:watch` (rebuild on file changes) and `build:prod` (one-shot)
- Create LaunchAgent plist to auto-start dev-hub on login (`~/Library/LaunchAgents/`)
- Add install/uninstall scripts for the LaunchAgent
- Add a "Stop all projects on exit" toggle to settings (DB-backed)

#### 2. Graceful Shutdown Handler
- Register `SIGTERM`, `SIGINT`, `beforeExit` handlers on the ProcessManager
- On shutdown signal: check "stop all on exit" setting
  - If enabled: call `stopService()` on all running processes with escalation
  - If disabled: just close DB connection and exit (processes stay alive)
- Close DB connection explicitly on shutdown
- Force-close all SSE streams on shutdown
- Add a global timeout (e.g., 30s) so shutdown doesn't hang indefinitely

#### 3. Server Component Migration
- Convert page components from `"use client"` to server components
- Pages fetch data server-side, pass as props to client components
- Keep interactive parts (tabs, buttons, filters, modals) as client components
- Pattern: `page.tsx` (server) -> `dashboard.tsx` (client, receives initial data as props)

#### 4. TanStack Query Integration
- Install `@tanstack/react-query`
- Add `QueryClientProvider` to app layout
- Replace `useApi()` calls with `useQuery()` / `useMutation()`
- Configure stale times appropriate for each data type:
  - Projects list: staleTime ~5s (changes rarely)
  - Status: staleTime ~2s (changes on start/stop)
  - Settings: staleTime ~30s
- Invalidate relevant queries after mutations (start/stop/delete)

#### 5. Component Performance Fixes
- **ProjectDetail 1s timer**: Scope `setInterval` to only the uptime display component, not the entire tree
- **LogViewer pattern matching**: Memoize `matchErrorPatterns()` results with `useMemo` keyed on log entry
- **Dashboard filtering**: Memoize `filteredProjects` computation
- **Code-splitting**: Use `next/dynamic` for ProjectDetail tab content (LogViewer, ProjectTerminal, EnvEditor, ProjectConfig)

### Key Decisions

| Decision | Rationale |
|----------|-----------|
| Run production builds | Eliminates 100% of "compiling..." delays; appropriate for a tool that's always running |
| `build:watch` toggle | Developers working on dev-hub itself need fast iteration; toggle between watch and manual |
| LaunchAgent (not LaunchDaemon) | Runs in user context, not root; appropriate for a dev tool |
| Defer menu bar icon | Requires a native Swift/Electron app; out of scope for this iteration |
| "Stop all on exit" as setting | User choice (option C); some may want processes to survive server restarts |
| TanStack Query over SWR | More features (optimistic updates, devtools, mutation helpers); ~5KB larger, negligible for local app |
| Server components for pages | Less JS shipped, faster initial paint; interactive parts stay client-side |
| Scoped timer component | Prevents entire ProjectDetail tree from re-rendering every second |

## Open Questions
- None — ready for planning.

## Previous Findings

### Persistent Logs & Terminal (2026-03-06)
See git history for prior findings on persistent logs feature (implemented).

### Error Diagnostics (2026-03-05)
See git history for prior findings on error diagnostics feature (implemented).

### Smart Env Editor (2026-03-05)
See git history for prior findings on the env editor feature (implemented).
