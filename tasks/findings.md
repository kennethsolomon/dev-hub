# Findings — 2026-03-06 — Auto Build & Restart (File Watcher)

## Problem Statement

When code changes are made to a managed project, some services (e.g., workers) don't auto-reload — the user must manually stop and restart them. There's no file-watching mechanism in dev-hub to detect changes and trigger rebuilds/restarts. The user wants a toggleable auto-build feature with manual trigger support.

## Requirements

| Requirement | Details |
|-------------|---------|
| File watcher | Single `fs.watch` (recursive) per project directory |
| Auto-build toggle | Project-level master toggle (`auto_build_enabled`) |
| Build command | Optional project-level `build_command` (e.g., `pnpm build`) |
| Per-service opt-in | Each service has `restart_on_watch` boolean |
| Per-service build override | Optional `watch_build_command` per service (overrides project-level) |
| Debounce | Default 2000ms, configurable per project |
| Manual trigger | "Build & Restart" button in project header (works even with auto-build off) |
| Ignore patterns | Hardcoded sensible defaults: `node_modules`, `.git`, `.next`, `dist`, `build`, `vendor`, `.turbo`, `*.log`, `.env*` |

## Chosen Approach: Hybrid — Project Watcher + Per-Service Opt-in (Approach C)

### Architecture

#### 1. DB Changes (Migration v2)

**Projects table — new columns:**
- `auto_build_enabled` INTEGER DEFAULT 0
- `build_command` TEXT (nullable)
- `watch_debounce_ms` INTEGER DEFAULT 2000

**Services table — new columns:**
- `restart_on_watch` INTEGER DEFAULT 0
- `watch_build_command` TEXT (nullable)

#### 2. File Watcher Module (`src/lib/process/file-watcher.ts`)

- Singleton manager (like ProcessManager) stored on `globalThis`
- Uses Node `fs.watch` with `{ recursive: true }` (macOS supports this natively)
- Maintains one watcher per project (keyed by project ID)
- Debounce logic: on file change, reset a timer; when timer fires, trigger build+restart
- Ignore filter: skip events for paths matching hardcoded ignore patterns
- Flow on trigger:
  1. For each service with `restart_on_watch = 1`:
     a. Run `watch_build_command` (or project `build_command`, or skip if both empty)
     b. Stop the service
     c. Start the service
  2. Emit events for UI feedback (build started, build complete, restart complete)

#### 3. Watcher Lifecycle

- **Start watching:** When auto-build is toggled ON or when a project with `auto_build_enabled` starts
- **Stop watching:** When auto-build is toggled OFF or when all services in the project are stopped
- **Rehydration:** On dev-hub startup, start watchers for projects that have `auto_build_enabled = 1` AND have running services

#### 4. API Endpoints

- `PUT /api/projects/[id]` — Already supports updating project fields; extend to handle `auto_build_enabled`, `build_command`, `watch_debounce_ms`
- `PUT /api/services/[id]` — Extend to handle `restart_on_watch`, `watch_build_command`
- `POST /api/projects/[id]/build` — New endpoint: manual "Build & Restart" trigger (runs build + restarts flagged services regardless of auto-build toggle)

#### 5. UI Changes

**Project header (project-detail.tsx):**
- Add "Build & Restart" button next to Start/Stop buttons
- Add auto-build toggle switch (small, inline)

**Project Config tab:**
- `build_command` input field
- `watch_debounce_ms` input (or preset dropdown: 1s / 2s / 5s)
- Auto-build enabled toggle with description

**Service card (service-card.tsx):**
- "Restart on file change" checkbox (visible in edit mode)
- Optional `watch_build_command` input (visible in edit mode)

### Example Configuration

| Service | `restart_on_watch` | Build command |
|---------|--------------------|---------------|
| `pnpm dev` | OFF | — (Next.js hot-reloads) |
| `ngrok http 43435` | OFF | — (tunnel, no rebuild) |
| `pnpm worker` | ON | `pnpm build` (or blank if self-compiles) |

### Key Decisions

| Decision | Rationale |
|----------|-----------|
| Single watcher per project | Efficient — one `fs.watch` recursive call vs. per-service watchers |
| Per-service `restart_on_watch` | Granular control — skip ngrok, skip dev server that already hot-reloads |
| Optional build command | Some services self-compile on start; forcing a build step would be wasteful |
| 2s default debounce | Long enough to batch rapid saves, short enough to feel responsive; configurable |
| Hardcoded ignore list | Covers 99% of cases; no need for user config in v1 |
| Manual button always available | Works even with auto-build OFF — useful for one-off rebuilds |
| Build runs per-service (not once globally) | Service override build command needs per-service execution |

### Ignore Patterns (Hardcoded)

```
node_modules, .git, .next, dist, build, vendor, .turbo, *.log, .env*,
.DS_Store, __pycache__, .cache, coverage, .output, .nuxt, .svelte-kit
```

## Open Questions

- None — ready for planning.

## Previous Findings

### Production Mode, Performance & Graceful Shutdown (2026-03-06)
See git history for prior findings on production build infra, graceful shutdown, server components, TanStack Query, and component performance (planned, not yet implemented).

### Persistent Logs & Terminal (2026-03-06)
See git history for prior findings on persistent logs feature (implemented).

### Error Diagnostics (2026-03-05)
See git history for prior findings on error diagnostics feature (implemented).

### Smart Env Editor (2026-03-05)
See git history for prior findings on the env editor feature (implemented).
