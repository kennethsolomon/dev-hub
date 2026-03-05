# Settings

> **Status:** Complete
> **Web:** Complete
> **Mobile:** N/A

## Overview

DevHub stores app-wide configuration in a key-value `settings` table. Settings control workspace scanning, subdomain routing, proxy behavior, and authentication.

## Database Schema

### `settings` table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `key` | TEXT | PRIMARY KEY | Setting identifier |
| `value` | TEXT | NOT NULL | String value (JSON-encoded for complex types) |

### Default Values (seeded in migration)

| Key | Default | Type | Purpose |
|-----|---------|------|---------|
| `workspace_roots` | `[]` | JSON array | Directories to scan for projects |
| `subdomain_routing` | `true` | boolean string | Enable `*.localhost` routing |
| `portless_mode` | `false` | boolean string | Use Caddy for port-free URLs |
| `base_domain` | `localhost` | string | Base domain for subdomains |
| `bind_mode` | `localhost` | string | Network bind mode |
| `proxy_port` | `4400` | number string | Port for proxy server |
| `lan_passcode_required` | `true` | boolean string | Require passcode for LAN |
| `auth_enabled` | `false` | boolean string | Enable passcode auth |

## Business Logic

### Allowed Keys Whitelist

The PUT endpoint only accepts these keys: `workspace_roots`, `subdomain_routing`, `portless_mode`, `base_domain`, `bind_mode`, `proxy_port`, `lan_passcode_required`, `auth_enabled`.

Any other keys in the request body are silently ignored.

### Value Serialization

Non-string values are JSON-stringified before storage. All values are stored and returned as strings.

## API Contract

### `GET /api/settings`

Returns all settings as a flat key-value object.

**Response:** `200 OK`
```json
{
  "workspace_roots": "[]",
  "subdomain_routing": "true",
  "portless_mode": "false",
  "base_domain": "localhost",
  "bind_mode": "localhost",
  "proxy_port": "4400",
  "lan_passcode_required": "true",
  "auth_enabled": "false"
}
```

### `PUT /api/settings`

Update one or more settings.

**Body:**
```json
{
  "workspace_roots": "[\"/Users/me/projects\"]",
  "subdomain_routing": "true"
}
```

**Response:** `200 OK` → `{ ok: true }`

Unknown keys are silently dropped.

## Permissions & Access Control

Settings endpoint should be auth-gated when auth is enabled (settings can toggle auth itself).

## Edge Cases

- **Unknown keys:** Silently ignored by whitelist filter
- **Non-string values:** Auto-serialized to JSON string
- **Missing settings:** `INSERT OR IGNORE` in migration seeds defaults; reads use fallback values in consuming code

## Error States

Settings operations are simple key-value writes and reads — no expected error states beyond database failures.

## UI/UX Behavior

### Web

- Settings page at `/settings`
- Form fields for each setting
- Workspace roots as editable list (add/remove directories)
- Toggle switches for boolean settings
- Save button applies all changes at once

### Mobile

N/A

## Platform Notes

- Settings values are read throughout the codebase via `getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key)`
- Boolean settings stored as `"true"`/`"false"` strings, compared with `=== 'true'`

## Related Docs

- [auth.md](auth.md) — `auth_enabled` setting
- [proxy-routing.md](proxy-routing.md) — Routing settings
- [discovery.md](discovery.md) — `workspace_roots` setting
