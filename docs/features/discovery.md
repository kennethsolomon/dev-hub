# Discovery

> **Status:** Complete
> **Web:** Complete
> **Mobile:** N/A

## Overview

Discovery scans configured workspace roots to find local development projects. It detects project types (Node.js, Laravel, Expo) and allows one-click import into DevHub with automatic service creation.

## Database Schema

Discovery itself has no dedicated table. It reads `settings.workspace_roots` and writes to `projects` + `services` on import. See [projects.md](projects.md) for schema.

## Business Logic

### Project Type Detection

`detectProjectType(dir)` in `src/lib/discovery/scanner.ts`:

| Detection | Condition | Type |
|-----------|-----------|------|
| Laravel | `artisan` + `composer.json` exist | `laravel` |
| Expo/RN | `app.json`/`app.config.js`/`app.config.ts` + `package.json` with `expo` or `react-native` dep | `expo` |
| Node.js | `package.json` exists | `node` |
| None | No markers found | `null` |

Detection priority: Laravel > Expo > Node.js (first match wins).

### Workspace Scanning

`scanWorkspaceRoot(rootPath, maxDepth = 2)`:

1. Load existing project paths from DB to mark `alreadyImported`
2. Recursively scan directories up to `maxDepth`
3. At each directory, run `detectProjectType()`
4. If a project is detected, add to results and **stop recursing** into that directory
5. Skip directories: `node_modules`, `.git`, `vendor`, `.next`, `dist`, `build`, `.cache`, dot-prefixed

Returns `DiscoveredProject[]` with `name`, `path`, `type`, `alreadyImported`.

### devhub.yml Config Import

When importing a project, if `devhub.yml` exists in the project root, services are created from its `services` array:

```yaml
services:
  - name: dev
    command: npm run dev
    port: 3000
    primary: true
  - name: worker
    command: npm run worker
    dependsOn: [dev]
    restart: on-failure
```

Supported fields: `name`, `type`, `command`, `cwd`, `env`, `port`, `primary`, `dependsOn`, `readiness`, `restart`.

## API Contract

### `POST /api/discovery`

Scan workspace roots for projects.

**Body:** `{ "roots": ["/Users/me/projects"] }` or uses `settings.workspace_roots`

**Response:** `200 OK`
```json
[{
  "name": "my-app",
  "path": "/Users/me/projects/my-app",
  "type": "node",
  "alreadyImported": false
}]
```

## Permissions & Access Control

Same as projects — requires auth if enabled.

## Edge Cases

- **Deeply nested projects:** `maxDepth` defaults to 2, preventing excessive scanning
- **Project inside project:** Detection stops recursion, so inner projects won't be found if parent is a project
- **Unreadable directories:** Silently caught, scanning continues
- **No workspace roots configured:** Returns empty array

## Error States

| Scenario | Behavior |
|----------|----------|
| Root path doesn't exist | Silently returns empty results for that root |
| Permission denied on directory | Silently skipped |
| Invalid `devhub.yml` | Import proceeds without services; default service created |

## UI/UX Behavior

### Web

- Settings page has workspace roots configuration
- Discovery button scans all configured roots
- Results shown as list with project name, type badge, and import status
- "Import" button for each discovered project
- Already-imported projects shown as disabled/checked

### Mobile

N/A

## Platform Notes

N/A — filesystem operations are platform-independent via Node.js `fs` module.

## Related Docs

- [projects.md](projects.md) — Discovery imports create projects
- [settings.md](settings.md) — Workspace roots configured in settings
