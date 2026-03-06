# Architectural Change: Auto-Build File Watcher

**Date:** 2026-03-06
**Type:** New Subsystem + Schema Extension + New API Pattern
**Branch:** feat/auto-build-watcher

## Summary

Added `FileWatcherManager` — a new singleton subsystem that monitors project directories for file changes and triggers automatic rebuilds and service restarts. Extends the existing database schema (migration v2) and introduces SSE streaming for build status events.

## What Changed

### New Module: `src/lib/process/file-watcher.ts`
- `FileWatcherManager` singleton stored on `globalThis.__devhub_fw` (same pattern as ProcessManager)
- Extends `EventEmitter` to emit `build-status` events consumed by the SSE endpoint
- Uses Node.js `fs.watch` with `{ recursive: true }` for directory monitoring
- Debounce pattern: 2000ms default, configurable per-project via `watch_debounce_ms`
- Hardcoded ignore list: node_modules, .git, .next, dist, build, vendor, .turbo, __pycache__, .cache, coverage, .output, .nuxt, .svelte-kit, .DS_Store, .env*
- `rehydrate()` called on startup to auto-start watchers for projects with `auto_build_enabled=1`

### Database Schema (migration v2)
**projects table:**
- `auto_build_enabled INTEGER DEFAULT 0`
- `build_command TEXT`
- `watch_debounce_ms INTEGER DEFAULT 2000`

**services table:**
- `restart_on_watch INTEGER DEFAULT 0`
- `watch_build_command TEXT` (overrides project-level command per-service)

### New API Routes
- `POST /api/projects/[id]/build` — manual trigger; calls `fw.triggerBuildRestart(id)`, returns `{ ok, restarted: string[] }`
- `GET /api/build/stream` — SSE endpoint returning `text/event-stream`; subscribes to `fw.on('build-status')`, sends keepalive every 15s, removes listener on `AbortSignal`

### Client-Side Additions
- `src/lib/hooks/use-build-status.ts` — `EventSource` subscriber to `/api/build/stream`; manages `BuildStatus` state; auto-hides after 3s on complete/error
- `useBuildRestart` mutation in `mutations.ts` — calls POST endpoint

### Process Manager Integration
- `startProject()` calls `fw.startWatching(projectId)` when `auto_build_enabled` is set
- `stopProject()` calls `fw.stopWatching(projectId)`
- `instrumentation.node.ts` calls `fw.rehydrate()` on server startup

## Before & After

**Before:** No file watching. Developers had to manually rebuild and restart services after code changes.

**After:** File changes automatically trigger the build pipeline:
1. `change-detected` — file change detected after debounce
2. `building` — running project/service build command via `exec` (optional)
3. `restarting` — stopping and starting each service with `restart_on_watch=1`
4. `complete` — all services restarted, returns list of restarted service names
5. `error` — build command failed or service restart failed (continues to next service)

## Affected Components

- `src/lib/process/file-watcher.ts` (new)
- `src/lib/process/manager.ts` (startProject/stopProject integration)
- `src/lib/db/schema.ts` + `src/lib/db/index.ts` (migration v2)
- `src/app/api/projects/[id]/build/route.ts` (new)
- `src/app/api/build/stream/route.ts` (new)
- `src/app/api/projects/[id]/route.ts` (accepts new config fields)
- `src/app/api/services/[id]/route.ts` (accepts new config fields)
- `src/lib/hooks/use-build-status.ts` (new)
- `src/lib/query/mutations.ts` (useBuildRestart)
- `src/components/projects/project-detail.tsx` (build banner, config section)
- `src/components/services/service-card.tsx` (restart_on_watch checkbox)
- `src/instrumentation.node.ts` (rehydrate on startup)

## Migration / Compatibility

- Migration v2 runs automatically on first boot (additive columns, backward compatible)
- Auto-build is disabled by default (`auto_build_enabled=0`) — no behavior change for existing projects
- `restart_on_watch=0` by default — services must opt in explicitly

## Known Issues (Future PRs)

1. **Command Injection:** `execAsync` uses manual arg quoting; should use centralized `exec.ts` utility
2. **Shutdown Cleanup:** `fileWatcher.stopAll()` not called in shutdown handler; debounce timers may fire after stop
