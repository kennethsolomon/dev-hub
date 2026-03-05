# Projects

> **Status:** Complete
> **Web:** Complete
> **Mobile:** N/A

## Overview

Projects are the top-level entity in DevHub. Each project represents a local development project (Node.js, Laravel, Expo) with a unique slug used for subdomain routing. Projects contain services, environment configurations, and run history.

## Database Schema

### `projects` table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `name` | TEXT | NOT NULL | Display name (derived from directory basename on import) |
| `slug` | TEXT | NOT NULL UNIQUE | URL-safe identifier for subdomain routing |
| `path` | TEXT | NOT NULL UNIQUE | Absolute filesystem path |
| `type` | TEXT | NOT NULL DEFAULT 'node' | One of: `node`, `laravel`, `expo`, `unknown` |
| `config_json` | TEXT | nullable | Arbitrary JSON config |
| `created_at` | TEXT | NOT NULL DEFAULT datetime('now') | |
| `updated_at` | TEXT | NOT NULL DEFAULT datetime('now') | |

### Relationships

- One project has many **services** (`services.project_id` → `projects.id`, CASCADE delete)
- One project has many **stack_items** (`stack_items.project_id` → `projects.id`, CASCADE delete)
- One project has many **upgrade_notes** (`upgrade_notes.project_id`)
- One project has many **env_definitions** and **env_overrides**

## Business Logic

### Import

`importProject(projectPath, type?)` in `src/lib/discovery/scanner.ts`:

1. Check if project already exists at path — return existing if so
2. Detect project type via `detectProjectType()` if not provided
3. Generate slug from directory basename (`slugify()`)
4. Ensure slug uniqueness by appending counter suffix (`-1`, `-2`, etc.)
5. Insert project record
6. If `devhub.yml` exists in project root, import services from it via `importServicesFromConfig()`
7. If no services were imported, create a default service based on project type

### Default Services by Type

| Type | Command | Default Port |
|------|---------|-------------|
| `node` | `npm run dev` | 3000 |
| `laravel` | `php artisan serve --port=$PORT` | 8000 |
| `expo` | `npx expo start` | 8081 |
| `unknown` | (empty) | null |

### Start/Stop

Starting a project starts all its services in topological order (respecting `depends_on_json`). Stopping a project stops all services in parallel via `Promise.all`.

## API Contract

### `GET /api/projects`

Returns all projects with service count and primary port.

**Response:** `200 OK`
```json
[{
  "id": "uuid",
  "name": "my-app",
  "slug": "my-app",
  "path": "/Users/me/projects/my-app",
  "type": "node",
  "service_count": 2,
  "primary_port": 3000,
  "created_at": "2026-01-01T00:00:00",
  "updated_at": "2026-01-01T00:00:00"
}]
```

### `POST /api/projects`

Two modes:
- **Import:** `{ action: "import", path: "/abs/path", type?: "node" }` → `{ id, slug }`
- **Manual add:** `{ name: "My App", path: "/abs/path", type?: "node" }` → `{ id, slug }`

### `GET /api/projects/[id]`

Returns project with its services and recent runs (last 50).

**Response:** `200 OK` → `{ project, services, runs }`
**Error:** `404` → `{ error: "Not found" }`

### `PUT /api/projects/[id]`

Update allowed fields: `name`, `slug`, `path`, `type`, `config_json`.

**Response:** `200 OK` → `{ ok: true }`

### `DELETE /api/projects/[id]`

Deletes project and cascades to services, runs, stack_items, env_definitions, env_overrides, upgrade_notes.

**Response:** `200 OK` → `{ ok: true }`

### `POST /api/projects/[id]/start`

Starts all project services in dependency order.

### `POST /api/projects/[id]/stop`

Stops all project services.

## Permissions & Access Control

All project endpoints require auth if `auth_enabled` is `true` (checked via `requireAuth()` in individual routes or client-side).

## Edge Cases

- **Duplicate path:** Import returns existing project instead of creating duplicate
- **Slug collision:** Auto-appends `-1`, `-2`, etc. for uniqueness
- **Missing project path:** Preflight check catches this before starting services
- **CASCADE delete:** Deleting a project removes all services, runs, stack items, env data, and upgrade notes

## Error States

| Scenario | Response |
|----------|----------|
| Import non-existent path | `400` with error message |
| GET non-existent project | `404 Not found` |
| Import already-imported project | Returns existing `{ id, slug }` (idempotent) |

## UI/UX Behavior

### Web

- Dashboard shows all projects as cards with name, type badge, service count, and running status
- Project detail page (`/projects/[id]`) shows services, run history, preflight checks, env editor
- Project URL is displayed as clickable link (subdomain URL if portless mode, otherwise `localhost:port`)

### Mobile

N/A

## Platform Notes

N/A — web only.

## Related Docs

- [services.md](services.md) — Services belong to projects
- [discovery.md](discovery.md) — Workspace scanning discovers and imports projects
- [stacks.md](stacks.md) — Projects can be grouped into stacks
- [environment-variables.md](environment-variables.md) — Per-project env configuration
