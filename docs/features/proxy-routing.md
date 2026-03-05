# Proxy & Routing

> **Status:** Complete
> **Web:** Complete
> **Mobile:** N/A

## Overview

DevHub supports subdomain-based routing so projects can be accessed via `myapp.localhost` instead of `localhost:3000`. This works in two modes: middleware-based rewriting (always available) and portless mode via Caddy reverse proxy (optional).

## Database Schema

No dedicated tables. Uses `settings` for configuration and `projects`/`services` for routing targets. See [settings.md](settings.md).

Relevant settings: `subdomain_routing`, `portless_mode`, `base_domain`, `proxy_port`.

## Business Logic

### Subdomain Resolution

`resolveSubdomain(hostname)` in `src/lib/proxy/router.ts`:

1. Load `base_domain` from settings (default: `localhost`)
2. Extract subdomain from hostname (e.g., `myapp.localhost` → `myapp`)
3. Skip `devhub` subdomain (serves DevHub UI)
4. Look up project by slug matching subdomain
5. Find primary service for that project
6. Verify service is running via ProcessManager
7. Get actual running port from `pm.getRunning()` (more accurate than DB's `assigned_port`)
8. Return `{ host: '127.0.0.1', port }` or `null`

### Routing Table

`getRoutingTable()` returns all projects with their routing info:
- If `subdomain_routing` AND `portless_mode`: URL is `http://{slug}.{base_domain}`
- Otherwise: URL is `http://localhost:{port}`

### Middleware Rewriting

`src/middleware.ts`:
1. Match hostname against pattern `^([a-z0-9-]+)\.(localhost|127\.0\.0\.1)(?::(\d+))?$`
2. Skip `devhub` subdomain
3. Rewrite other subdomains to `/api/proxy/forward?subdomain={slug}&path={path}`

### Caddyfile Generation

`generateCaddyfile()` creates a Caddy config that reverse-proxies all subdomain traffic to DevHub's proxy port:

```
*.localhost, localhost {
  reverse_proxy 127.0.0.1:4400
}
```

### Portless Mode

Optional Caddy-based setup (scripts in `scripts/`):
- `install-portless.sh` — installs Caddy as a macOS LaunchDaemon
- `uninstall-portless.sh` — removes the LaunchDaemon

When enabled, browsers can access `myapp.localhost` on port 80 (no port number needed).

## API Contract

### `GET /api/proxy/caddyfile`

Returns generated Caddyfile content.

**Response:** `200 OK` with `text/plain` body.

### `GET /api/proxy/forward`

Internal proxy handler (called by middleware rewrite).

**Query params:** `subdomain`, `path`

Proxies the request to the resolved service port.

### `GET /api/status`

Returns running processes and routing table.

**Response includes:**
```json
{
  "routes": [{
    "slug": "my-app",
    "projectName": "My App",
    "port": 3000,
    "running": true,
    "url": "http://my-app.localhost"
  }]
}
```

## Permissions & Access Control

- Middleware runs on all requests (Edge Runtime, no DB access for auth)
- Auth check happens at the API route level, not in middleware
- Proxy forward handler inherits auth from the middleware skip for `/api/` routes

## Edge Cases

- **No primary service:** Subdomain resolution returns null
- **Service not running:** Subdomain resolution returns null
- **Port changed since DB write:** Uses `pm.getRunning()` for actual port, not stale `assigned_port`
- **DevHub subdomain:** Always passes through to Next.js (not proxied)
- **Non-matching hostname:** Middleware passes through via `NextResponse.next()`

## Error States

| Scenario | Behavior |
|----------|----------|
| Unknown subdomain | Returns null, middleware falls through |
| Service running but port unavailable | Proxy request fails |
| Caddy not installed | Portless mode unavailable, direct port URLs used |

## UI/UX Behavior

### Web

- Project URLs displayed as clickable links
- Subdomain URL shown when portless mode is enabled
- Direct port URL shown otherwise
- Settings page allows toggling subdomain routing and portless mode

### Mobile

N/A

## Platform Notes

- Caddy LaunchDaemon setup is macOS-specific (`scripts/` directory)
- Middleware uses Next.js Edge Runtime (no Node.js APIs)
- Subdomain routing works with `localhost` without `/etc/hosts` changes (browsers resolve `*.localhost` to 127.0.0.1)

## Related Docs

- [services.md](services.md) — Routing targets are running services
- [settings.md](settings.md) — Routing configuration
