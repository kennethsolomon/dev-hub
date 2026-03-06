# Architectural Change: Production Mode, Performance & Graceful Shutdown

**Date:** 2026-03-06
**Type:** New subsystem + Major refactor
**Branch:** feat/production-mode-performance-shutdown

## Summary

Three interconnected changes to make DevHub production-ready: graceful shutdown system, TanStack Query migration for performance, and server component conversion for faster page loads.

## What Changed

### 1. Graceful Shutdown System
- **New:** `src/lib/process/shutdown.ts` — async shutdown handler with configurable stop-all-on-exit
- **New:** `src/instrumentation.ts` — Next.js instrumentation hook for eager server-side initialization
- **New:** `src/lib/db/index.ts` — added `closeDb()` for clean DB teardown
- **Modified:** `src/app/api/settings/route.ts` — `stop_all_on_exit` added to allowed settings keys

**How it works:** `instrumentation.ts` registers signal handlers via `process.prependListener` for SIGINT/SIGTERM. On signal, the handler reads the `stop_all_on_exit` setting from the DB, stops all running services if enabled (with 30s timeout), closes the DB, then re-raises the signal via `setImmediate` so Next.js can do its own cleanup.

### 2. TanStack Query Migration
- **New:** `src/lib/query/keys.ts` — query key factory
- **New:** `src/lib/query/hooks.ts` — 8 typed query hooks (useProjects, useStatus, useProject, etc.)
- **New:** `src/lib/query/mutations.ts` — 16 mutation hooks with automatic query invalidation
- **New:** `src/lib/query/provider.tsx` — QueryClientProvider wrapper
- **Deleted:** `src/lib/hooks/use-api.ts` — replaced entirely

**Before:** Custom `useApi` hook with manual `refetch()` calls, no caching, no deduplication.
**After:** TanStack Query with 5s stale time, automatic cache invalidation on mutations, shared cache across components.

### 3. Server Component Conversion
- **New:** `src/components/settings/settings-page.tsx`, `stacks-page.tsx`, `updates-page.tsx` — client shell components
- **Modified:** `src/app/settings/page.tsx`, `stacks/page.tsx`, `updates/page.tsx` — converted to server components importing client shells

**Before:** Pages were `'use client'` with all logic inline.
**After:** Pages are server components that render a single client shell. Reduces initial JS bundle.

### 4. Production Infrastructure
- **New:** `scripts/devhub-launchagent.plist` — macOS LaunchAgent template
- **New:** `scripts/install-agent.sh` — installer with validation
- **New:** `scripts/uninstall-agent.sh` — clean uninstaller

## Impact

- **Process lifecycle:** DevHub now cleanly stops child processes on exit instead of orphaning them
- **Data fetching:** All components share a query cache; mutations auto-invalidate relevant queries
- **Bundle size:** Server component pages don't ship JS to the client; tab content is code-split via `next/dynamic`
- **Rendering:** `UptimeDisplay` isolated to prevent 1s interval from re-rendering the entire project detail page

## Affected Components

- All page components (settings, stacks, updates, dashboard, project-detail)
- All components that fetch data (env-panel, preflight-panel, service-card)
- Process manager (shutdown integration)
- Database module (closeDb export)
- Root layout (QueryProvider wrapper)

## Migration/Compatibility

- No breaking API changes
- `stop_all_on_exit` defaults to `true` (enabled) — existing users get the new behavior automatically
- LaunchAgent is opt-in (manual install via script)
