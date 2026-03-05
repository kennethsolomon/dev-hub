# Smart Env Editor + Process Resilience

**Date:** 2026-03-05
**Type:** New subsystem + behavioral fix
**Branch:** feat/smart-env-editor

## Summary

Added a smart environment variable editor and fixed process management resilience across page refreshes and server restarts.

## What Changed

### New: Env Parser Module (`src/lib/env/parser.ts`)
- Reads `.env`, `.env.local`, `.env.development` in priority order
- Detects port variables (key match or value in 1000-9999) and secret variables
- Never modifies `.env` files — read-only

### New: Env API Route (`src/app/api/projects/[id]/env/route.ts`)
- GET merges file entries with DB overrides, checks port status in parallel
- PUT upserts/deletes overrides in `env_overrides` table
- Uses existing `env_overrides` schema (migration v1)

### New: EnvPanel Component (`src/components/projects/env-panel.tsx`)
- Table with inline editing, secret masking, port status dots
- Override management (add/edit/remove) via PUT API

### Changed: Process Manager Resilience
- **Before:** Singleton lost on HMR, processes not detached, no rehydration
- **After:** `globalThis.__devhub_pm` singleton, `detached: true` + `unref()`, DB rehydration via PID checking on startup
- Stop path uses `setInterval` + `clearInterval` with resolved guard (no timer leaks)

### Changed: Port Detection (IPv4 + IPv6)
- **Before:** `isPortInUse` only checked `127.0.0.1` (IPv4)
- **After:** Checks both `0.0.0.0` and `::` in parallel — catches Next.js IPv6 bindings

### Changed: URL Display
- **Before:** Always showed subdomain proxy URL (e.g., `myapp.localhost:4400`)
- **After:** Shows direct `localhost:{port}` unless portless mode (Caddy) is active

## Affected Components
- `src/lib/process/manager.ts` — singleton pattern, spawn options, rehydration
- `src/lib/os/adapter.ts` — `isPortInUse` dual-stack check
- `src/lib/proxy/router.ts` — `resolveSubdomain` and `getRoutingTable` use actual running port
- `src/lib/db/index.ts` — `globalThis.__devhub_db` singleton
- `src/components/projects/project-detail.tsx` — env tab, URL display
- `src/components/dashboard/dashboard.tsx` — direct port URL
- `src/components/services/service-card.tsx` — clickable port link

## Impact
- Low risk: env editor is additive, process changes are backwards-compatible
- `env_overrides` table already exists in migration v1
- No breaking API changes
