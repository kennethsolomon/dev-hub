# DevHub - Local Development Manager

A local-first web app to manage your macOS development projects from one dashboard.

## Features

- **Project Discovery** - Auto-scan workspace roots for Node, Laravel, and Expo projects
- **Multi-Service Orchestration** - Define multiple services per project with dependency ordering, readiness checks, and restart policies
- **Port Conflict Handling** - Automatic free port assignment when desired ports are busy, with clear notifications
- **Subdomain Routing** - Access projects via `http://myapp.localhost` (portless mode with Caddy, or `http://myapp.localhost:4400` without)
- **Stacks** - Group projects for one-click start/stop
- **Preflight Checks** - Detect missing `.env`, uninstalled deps, wrong Node/PHP versions, port conflicts
- **Unified Logs** - Per-service and combined log streaming with search, filter, and error highlighting
- **Update Advisor** - Scan `npm outdated` / `composer outdated`, flag major updates, track upgrade notes
- **Passcode Auth** - Simple bcrypt-based authentication with httpOnly cookie sessions

## Tech Stack

- Next.js (TypeScript, App Router)
- shadcn/ui + Tailwind CSS v4
- SQLite (via better-sqlite3)
- SSE for real-time log streaming

## Setup

```bash
# Install dependencies
npm install

# Run in development
npm run dev

# Build for production
npm run build
npm start
```

DevHub runs on `http://localhost:9000` by default.

## Configuration

### Workspace Roots

Go to **Settings > Workspace Roots** and add directories to scan. DevHub will auto-discover:
- Node/JS projects (has `package.json`)
- Laravel projects (has `artisan` + `composer.json`)
- Expo/React Native projects (has `app.json` + expo dependency)

### Subdomain Routing

Access projects via `http://<slug>.localhost:4400` (default proxy port).

To remove the port from URLs (portless mode):

1. Install Caddy: `brew install caddy`
2. Run the install script with sudo:
   ```bash
   sudo ./scripts/install-portless.sh
   ```
3. Enable "Portless Mode" in Settings
4. Access projects at `http://<slug>.localhost`

To uninstall portless mode:
```bash
sudo ./scripts/uninstall-portless.sh
```

### devhub.yml

Projects can include a `devhub.yml` config file for auto-import:

```yaml
services:
  - name: dev
    command: npm run dev
    port: 3000
    primary: true
  - name: worker
    command: npm run worker
    dependsOn: [dev]
  - name: redis
    command: redis-server
    port: 6379
    readiness:
      type: tcp
      port: 6379
```

### Security

- **Default**: Binds to `localhost` only (127.0.0.1)
- **LAN Mode**: Toggle in Settings to bind to 0.0.0.0 (enables network access)
- **Passcode**: Set in Settings; required when LAN mode is active

## Running Tests

```bash
npm test           # Run once
npm run test:watch # Watch mode
```

## Data Storage

All data is stored in `data/devhub.db` (SQLite) and `data/logs/` (log files).
The `data/` directory is gitignored.

## Architecture

```
src/
  app/                    # Next.js App Router pages + API routes
  components/             # React components (shadcn/ui)
  lib/
    db/                   # SQLite database + migrations
    os/                   # OS adapter layer (macOS-first, cross-platform ready)
    process/              # Process manager + port allocator
    proxy/                # Subdomain router + Caddyfile generator
    discovery/            # Project scanner
    toolchain/            # Node/PHP version detection
    updates/              # npm/composer outdated advisor
    preflight/            # Pre-start checks
    auth/                 # Passcode + session management
    hooks/                # React hooks for API + log streaming
scripts/
  install-portless.sh     # Caddy setup (requires sudo)
  uninstall-portless.sh   # Caddy teardown
```
