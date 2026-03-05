# Services

> **Status:** Complete
> **Web:** Complete
> **Mobile:** N/A

## Overview

Services are the executable units within a project. Each service has a shell command, optional port, restart policy, and dependency ordering. The ProcessManager singleton handles spawning, monitoring, and stopping service processes.

## Database Schema

### `services` table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `project_id` | TEXT | NOT NULL FK → projects(id) CASCADE | |
| `name` | TEXT | NOT NULL | e.g., "dev", "worker", "queue" |
| `type` | TEXT | NOT NULL DEFAULT 'command' | Currently only 'command' |
| `command` | TEXT | NOT NULL | Shell command; supports `$PORT` substitution |
| `cwd` | TEXT | nullable | Relative to project path |
| `env_json` | TEXT | DEFAULT '{}' | JSON object of env vars |
| `desired_port` | INTEGER | nullable | Preferred port |
| `assigned_port` | INTEGER | nullable | Actually assigned port (persisted by port allocator) |
| `is_primary` | INTEGER | NOT NULL DEFAULT 0 | 1 = primary service (used for subdomain routing) |
| `depends_on_json` | TEXT | DEFAULT '[]' | JSON array of service names this depends on |
| `readiness_json` | TEXT | nullable | Readiness check config (reserved for future use) |
| `restart_policy` | TEXT | NOT NULL DEFAULT 'no' | `no`, `always`, `on-failure` |
| `stop_signal` | TEXT | DEFAULT 'SIGINT' | Signal sent on stop |
| `stop_timeout` | INTEGER | DEFAULT 10000 | ms before escalating to SIGTERM/SIGKILL |
| `created_at` | TEXT | | |
| `updated_at` | TEXT | | |

### `runs` table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | TEXT | PRIMARY KEY | UUID v4, also used as log filename |
| `service_id` | TEXT | NOT NULL FK → services(id) CASCADE | |
| `status` | TEXT | NOT NULL DEFAULT 'pending' | `pending`, `running`, `stopped`, `failed` |
| `pid` | INTEGER | nullable | OS process ID |
| `assigned_port` | INTEGER | nullable | Port used for this run |
| `started_at` | TEXT | nullable | |
| `stopped_at` | TEXT | nullable | |
| `exit_code` | INTEGER | nullable | |
| `log_path` | TEXT | nullable | Absolute path to log file |
| `created_at` | TEXT | | |

## Business Logic

### Starting a Service

`ProcessManager.startService(serviceId)` in `src/lib/process/manager.ts`:

1. Check if already running — throw if so
2. Load service and project from DB
3. **Port allocation:** If `desired_port` is set or command contains `$PORT`, call `findFreePort()`. If desired port is in use, auto-assign a free port and report the conflict
4. Create log file at `data/logs/{runId}.log`
5. Substitute `$PORT` in command with assigned port
6. Merge env: `process.env` + `service.env_json` + `env_overrides` from DB
7. Set `PORT` env var if port was assigned
8. Resolve working directory (service `cwd` relative to project path)
9. Spawn via `zsh -lc` (wrapped by OS adapter) with `detached: true` + `unref()`
10. Stream stdout/stderr to log file and emit `'log'` events
11. Insert `runs` record with status `'running'`
12. On exit: update run status, handle restart policy

### Stopping a Service

`ProcessManager.stopService(serviceId)`:

Two paths based on whether we have the ChildProcess handle:

**With ChildProcess handle:**
1. Send configured `stop_signal` (default SIGINT)
2. After `stop_timeout` ms, escalate to SIGTERM
3. After 3 more seconds, escalate to SIGKILL

**Rehydrated (PID only, no handle):**
1. Send signal to process group (`-pid`) then fallback to direct PID
2. Poll `isProcessAlive()` every 500ms
3. After `stop_timeout + 3000` ms, force SIGKILL

### Rehydration

On ProcessManager creation, `rehydrateFromDb()` checks all runs with status `'running'`:
- If PID is still alive → re-track (without ChildProcess handle)
- If PID is dead → mark run as `'failed'`

### Restart Policy

| Policy | Behavior |
|--------|----------|
| `no` | Do not restart |
| `always` | Restart after any exit, with 2s delay |
| `on-failure` | Restart only if exit code !== 0, with 2s delay |

### Topological Sort

Services are started in dependency order using `topologicalSort()`. Dependencies are resolved by service name or ID from `depends_on_json`.

## API Contract

### `POST /api/services`

Create a service.

**Body:**
```json
{
  "project_id": "uuid",
  "name": "dev",
  "command": "npm run dev",
  "desired_port": 3000,
  "is_primary": true,
  "restart_policy": "no",
  "depends_on": ["db"],
  "env": { "NODE_ENV": "development" },
  "stop_signal": "SIGINT",
  "stop_timeout": 10000
}
```

**Response:** `200 OK` → `{ id: "uuid" }`

### `PUT /api/services/[id]`

Update allowed fields: `name`, `command`, `cwd`, `env_json`, `desired_port`, `is_primary`, `depends_on_json`, `readiness_json`, `restart_policy`, `stop_signal`, `stop_timeout`.

### `DELETE /api/services/[id]`

Delete service and cascade to runs.

### `POST /api/services/[id]/start`

Start individual service. Returns `{ runId, assignedPort, portConflict? }`.

### `POST /api/services/[id]/stop`

Stop individual service.

## Permissions & Access Control

Same as projects — requires auth if enabled.

## Edge Cases

- **Port conflict:** Auto-assigns free port from range 10000-65000 and returns `portConflict` info
- **`$PORT` substitution:** Replaced in command string before spawn
- **Working directory missing:** Throws error before spawning
- **Spawn failure (ENOENT):** Logs error, marks run as failed, emits error event
- **Process dies between rehydration checks:** `isRunning()` verifies PID liveness and cleans up if dead
- **Circular dependencies:** Topological sort handles visited set but does not detect cycles (will skip)

## Error States

| Scenario | Behavior |
|----------|----------|
| Service already running | Throws "Service X is already running" |
| Service not found | Throws "Service X not found" |
| Working directory missing | Throws "Working directory does not exist: path" |
| Spawn error (ENOENT) | Logs to run file, marks run as `failed` |
| Auto-restart failure | Logs error, does not crash |

## UI/UX Behavior

### Web

- Service cards show name, command, status (running/stopped), assigned port
- Start/stop buttons per service or for entire project
- Port conflict displayed as warning with original and assigned port
- Log viewer streams real-time output from running services

### Mobile

N/A

## Platform Notes

- Commands wrapped via `zsh -lc` on macOS for nvm/shell profile compatibility
- Processes spawned with `detached: true` to survive DevHub restarts
- ProcessManager singleton stored on `globalThis` to survive Next.js HMR

## Related Docs

- [projects.md](projects.md) — Services belong to projects
- [logs.md](logs.md) — Log streaming from service processes
- [environment-variables.md](environment-variables.md) — Env vars injected into service processes
