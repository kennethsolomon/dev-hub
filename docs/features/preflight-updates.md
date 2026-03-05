# Preflight & Updates

> **Status:** Complete
> **Web:** Complete
> **Mobile:** N/A

## Overview

Preflight checks validate that a project is ready to start (dependencies installed, env configured, ports available). The update advisor scans for outdated npm/composer packages and stores upgrade notes.

## Database Schema

### `upgrade_notes` table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `project_id` | TEXT | NOT NULL FK → projects(id) CASCADE | |
| `created_at` | TEXT | NOT NULL DEFAULT datetime('now') | |
| `tool` | TEXT | NOT NULL | `npm` or `composer` |
| `summary` | TEXT | NOT NULL | Human-readable summary |
| `details_json` | TEXT | nullable | JSON with full package list |

## Business Logic

### Preflight Checks

`runPreflightChecks(projectId)` in `src/lib/preflight/checks.ts` runs 6 checks:

| Check | Status | Condition |
|-------|--------|-----------|
| **Path** | `fail` | Project directory doesn't exist |
| **Env** | `fail` | `.env.example` exists but `.env` does not |
| **Deps (Node)** | `fail` | `node_modules` missing (for `node`/`expo` projects) |
| **Deps (Laravel)** | `fail` | `vendor` missing (for `laravel` projects) |
| **Toolchain (Node)** | `warn` | Node version mismatch between `.nvmrc`/`engines` and active `node --version` |
| **Toolchain (PHP)** | `warn` | PHP version mismatch (via Herd or Homebrew) |
| **Port** | `warn` | Desired port already in use by another process |
| **Required env keys** | `fail` | Required `env_definitions` key missing from `.env` file |

Each check returns `{ check, status, message, quickFix? }`.

### Quick Fixes

Some checks return a `quickFix` object:

| Action | Label | What it does |
|--------|-------|-------------|
| `copy-env` | "Copy .env.example to .env" | Copies the example file |
| `install-deps` | "Run npm install" / "Run composer install" | Installs dependencies |

### Toolchain Detection

`MacToolchainDetector.detect(projectPath)` in `src/lib/toolchain/detector.ts`:

**Node detection:**
1. Check `.nvmrc` for required version
2. Fallback to `package.json` `engines.node`
3. Get active version via `node --version`
4. Compare major versions for mismatch

**PHP detection (Laravel only):**
1. Read `composer.json` `require.php`
2. Check if `which php` points to Herd or Homebrew
3. Get active version via `php --version`

### Update Scanning

**npm:** `checkNodeUpdates(projectPath)` runs `npm outdated --json` and parses output into `OutdatedPackage[]` with major version detection.

**Composer:** `checkComposerUpdates(projectPath)` runs `composer outdated --format=json --direct` and parses output.

Both have 30-second timeouts and silently catch errors.

### Upgrade Notes

`saveUpgradeNote(projectId, tool, summary, details?)` persists scan results to DB.
`getUpgradeNotes(projectId)` retrieves notes ordered by `created_at DESC`.

## API Contract

### `GET /api/projects/[id]/preflight`

Run preflight checks for a project.

**Response:** `200 OK`
```json
[
  { "check": "path", "status": "pass", "message": "Project path exists" },
  { "check": "deps", "status": "fail", "message": "node_modules not found",
    "quickFix": { "label": "Run npm install", "action": "install-deps", "args": { "projectId": "uuid" } } }
]
```

### `POST /api/projects/[id]/quickfix`

Execute a quick fix action.

**Body:** `{ "action": "copy-env" }` or `{ "action": "install-deps" }`

### `GET /api/projects/[id]/updates`

Scan for outdated packages.

**Response:** `200 OK`
```json
{
  "npm": {
    "tool": "npm",
    "packages": [{ "name": "react", "current": "18.2.0", "wanted": "18.3.1", "latest": "19.0.0", "isMajor": true }],
    "scannedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

## Permissions & Access Control

Same as projects — requires auth if enabled.

## Edge Cases

- **Path check fails early:** If project path doesn't exist, remaining checks are skipped
- **npm outdated returns non-zero:** `|| true` appended to command to prevent throw
- **No `.nvmrc` or `engines`:** Node toolchain check skipped
- **No `composer.json`:** PHP detection skipped entirely
- **Timeout:** Both npm and composer commands have 30s timeout; toolchain detection has 5s timeout

## Error States

| Scenario | Behavior |
|----------|----------|
| Project not found | Returns `[{ check: "project", status: "fail", message: "Project not found" }]` |
| Toolchain detection fails | Silently caught, check omitted from results |
| npm/composer command fails | Returns empty packages array |

## UI/UX Behavior

### Web

- Preflight panel on project detail page shows check results as pass/warn/fail badges
- Quick fix buttons inline with failed checks
- Updates page (`/updates`) shows outdated packages across all projects
- Major version bumps highlighted differently from minor/patch

### Mobile

N/A

## Platform Notes

- Toolchain detection uses `execSync` with shell commands (macOS-specific paths for Herd)
- Port checks use OS adapter's `isPortInUse()` and `findProcessOnPort()`

## Related Docs

- [projects.md](projects.md) — Preflight runs per project
- [services.md](services.md) — Port checks validate service ports
- [environment-variables.md](environment-variables.md) — Required env keys checked during preflight
