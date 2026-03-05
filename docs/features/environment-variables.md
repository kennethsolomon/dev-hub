# Environment Variables

> **Status:** Complete
> **Web:** Complete
> **Mobile:** N/A

## Overview

DevHub manages environment variables at two levels: **definitions** (schema of expected keys) and **overrides** (runtime values stored in DB). These are merged with the process environment when starting services. An env editor UI parses `.env` files, detects ports and secrets, and allows in-app editing with DB-backed overrides.

## Database Schema

### `env_definitions` table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `project_id` | TEXT | NOT NULL FK → projects(id) CASCADE | |
| `service_id` | TEXT | nullable FK → services(id) CASCADE | null = project-wide |
| `key` | TEXT | NOT NULL | Env var name |
| `description` | TEXT | nullable | Human-readable description |
| `required` | INTEGER | NOT NULL DEFAULT 1 | 1 = required |
| `default_value` | TEXT | nullable | |
| `is_secret` | INTEGER | NOT NULL DEFAULT 0 | 1 = mask in UI |

### `env_overrides` table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `project_id` | TEXT | NOT NULL FK → projects(id) CASCADE | |
| `service_id` | TEXT | nullable FK → services(id) CASCADE | null = project-wide |
| `key` | TEXT | NOT NULL | Env var name |
| `value` | TEXT | NOT NULL | Override value |
| `source` | TEXT | NOT NULL DEFAULT 'db' | Origin of the override |

## Business Logic

### Env File Parsing (`src/lib/env/parser.ts`)

`parseEnvFile(content)` parses `.env` file content:
- Strips comments (`#` lines)
- Handles quoted values (single, double, backtick)
- Strips surrounding quotes from values
- Returns `EnvEntry[]` with key, value, and detected flags

### Port Detection

`isPortVar(key, value)`:
- **Key-based:** matches pattern `/(PORT|_PORT|port)$/i` — always detected regardless of value
- **Value-based:** if key doesn't match, checks if value is an integer in range 1000-9999 (tightened to avoid false positives like `TIMEOUT_MS=30000`)

### Secret Detection

`isSecretVar(key)`:
- Matches patterns: `SECRET`, `PASSWORD`, `TOKEN`, `KEY`, `CREDENTIAL`, `PRIVATE`, `API_KEY`

### Env Merge at Service Start

In `ProcessManager.startService()`, env is merged in priority order:
1. `process.env` (system environment)
2. `service.env_json` (inline service env)
3. `env_overrides` from DB (project-wide first, then service-specific)
4. `PORT` set to assigned port if applicable

### Override Persistence

When saving overrides via the API:
- **NULL service_id handling:** Uses separate SQL queries for `service_id IS NULL` vs `service_id = ?` to avoid SQL NULL comparison semantics (`NULL = NULL` is false in SQL)
- Deletes existing override for key, then inserts new one

## API Contract

### `GET /api/projects/[id]/env`

Returns parsed `.env` file entries merged with DB overrides and port status.

**Query params:** `serviceId` (optional) — filter overrides to specific service

**Response:** `200 OK`
```json
{
  "entries": [
    {
      "key": "PORT",
      "value": "3000",
      "isPort": true,
      "isSecret": false,
      "portInUse": true,
      "override": null
    }
  ],
  "overrides": [
    { "key": "DB_HOST", "value": "localhost", "source": "db" }
  ]
}
```

Port status checks run in parallel via `Promise.all` for performance.

### `PUT /api/projects/[id]/env`

Save env overrides.

**Body:**
```json
{
  "overrides": [
    { "key": "DB_HOST", "value": "127.0.0.1" }
  ],
  "serviceId": null
}
```

**Error:** `400` if body is malformed JSON.

## Permissions & Access Control

Same as projects — requires auth if enabled.

## Edge Cases

- **No .env file:** Returns empty entries array, overrides still work
- **Quoted values:** Parser handles `"value"`, `'value'`, `` `value` `` and strips quotes
- **Value-only port detection limited to 1000-9999:** Prevents false positives on `TIMEOUT_MS=30000`, `BATCH_SIZE=15000`, etc.
- **SQL NULL semantics:** `service_id IS NULL` requires separate query path, not `service_id = ?`

## Error States

| Scenario | Response |
|----------|----------|
| Malformed JSON body on PUT | `400 Invalid JSON body` |
| Project not found | `404 Not found` |
| `.env` file unreadable | Entries returned empty, no error thrown |

## UI/UX Behavior

### Web

- Env editor panel on project detail page
- Entries displayed in table with key, value, type badges (port/secret)
- Port entries show real-time "in use" / "available" status
- Secret values masked by default with reveal toggle
- Inline editing with save to DB overrides
- Service selector to filter overrides by service

### Mobile

N/A

## Platform Notes

- Port status checks use OS adapter's `isPortInUse()` which tests both IPv4 and IPv6
- `.env` file is read from the project's filesystem path (not from DB)

## Related Docs

- [projects.md](projects.md) — Env vars belong to projects
- [services.md](services.md) — Env vars injected at service start
- [preflight-updates.md](preflight-updates.md) — Required env keys checked during preflight
