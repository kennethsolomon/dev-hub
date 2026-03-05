# DevHub Feature Specifications

Feature specs live in `docs/features/`. Each spec is the single source of truth for its feature's behavior across all platforms.

## How to Use

- **Read a spec** to understand how a feature works end-to-end
- **Update a spec** when changing feature behavior (run `/features` to auto-sync)
- **Create a spec** for new features using `docs/features/_template.md`

## Feature Index

### Core

| Feature | Spec | Web | Mobile |
|---------|------|-----|--------|
| Projects | [projects.md](features/projects.md) | Complete | N/A |
| Services | [services.md](features/services.md) | Complete | N/A |
| Environment Variables | [environment-variables.md](features/environment-variables.md) | Complete | N/A |
| Logs | [logs.md](features/logs.md) | Complete | N/A |

### Orchestration

| Feature | Spec | Web | Mobile |
|---------|------|-----|--------|
| Stacks | [stacks.md](features/stacks.md) | Complete | N/A |
| Discovery | [discovery.md](features/discovery.md) | Complete | N/A |
| Preflight & Updates | [preflight-updates.md](features/preflight-updates.md) | Complete | N/A |

### Infrastructure

| Feature | Spec | Web | Mobile |
|---------|------|-----|--------|
| Proxy & Routing | [proxy-routing.md](features/proxy-routing.md) | Complete | N/A |
| Auth | [auth.md](features/auth.md) | Complete | N/A |
| Settings | [settings.md](features/settings.md) | Complete | N/A |

## Settings Overview

| Key | Default | Purpose |
|-----|---------|---------|
| `workspace_roots` | `[]` | Directories to scan for projects |
| `subdomain_routing` | `true` | Enable `*.localhost` subdomain routing |
| `portless_mode` | `false` | Use Caddy proxy for port-free URLs |
| `base_domain` | `localhost` | Base domain for subdomain routing |
| `bind_mode` | `localhost` | Network bind mode |
| `proxy_port` | `4400` | Port for the proxy server |
| `lan_passcode_required` | `true` | Require passcode for LAN access |
| `auth_enabled` | `false` | Enable passcode authentication |
