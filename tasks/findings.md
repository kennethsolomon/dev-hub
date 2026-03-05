# Findings — 2026-03-05 — Smart Env Editor

## Problem Statement
When DevHub assigns a random port (due to conflict), webhooks, OAuth redirects, and other external integrations break because they point to a hardcoded port. Users must manually edit `.env` files every time. DevHub should let users manage env vars (especially ports) from the UI.

## Requirements
- Read `.env` files from project directory and display all vars in the Environment tab
- Allow overriding any var from the UI (stored in DevHub DB, never modifies `.env`)
- Auto-detect port vars by key pattern (`*PORT*`) or numeric value (1000-65535)
- Port vars get special treatment: conflict checks, colored status dots, clickable links
- Secret vars (`*SECRET*`, `*KEY*`, `*TOKEN*`, `*PASSWORD*`) masked by default
- DB overrides injected at runtime via spawn env, taking precedence over `.env`
- "Add Override" for vars not in `.env` (e.g., vars you don't want committed)

## Decisions
| Decision | Rationale |
|----------|-----------|
| Read `.env` + overlay from DB (option 3) | Project files stay untouched (no surprise git diffs), existing `env_overrides` table supports this |
| Never write to `.env` files | Avoids mutating project files; overrides are DevHub-specific |
| Port detection by key pattern + value range | Covers both explicit port names and numeric env vars |
| Single GET + PUT endpoint pair | Simple API; GET merges file+DB, PUT saves to DB only |

## Architecture

### Data Flow
1. **Read:** Parse `.env`, `.env.local`, `.env.development` from project path
2. **Merge:** Query `env_overrides` table for project overrides
3. **Display:** Unified table showing key, file value, override value, effective value
4. **Write:** PUT saves override to `env_overrides` table (or deletes if value is null)
5. **Runtime:** `manager.ts` already injects `env_overrides` at spawn time (no changes needed)

### API
- `GET /api/projects/[id]/env` — returns merged env vars with port status + secret detection
- `PUT /api/projects/[id]/env` — create/update/remove a single override

### UI
- Replaces placeholder EnvPanel in project-detail.tsx
- Table: Key | .env Value | Override | Port Status | Actions
- Edit inline, add new overrides, remove overrides (reverts to .env value)
- Port vars: green dot (free), red (in use), blue (assigned to this service)
- Secret vars: masked with reveal toggle

## Resources
- `src/lib/db/schema.ts` — `env_overrides` table already exists
- `src/lib/process/manager.ts:86-93` — already reads env_overrides and injects at spawn
- `src/components/projects/project-detail.tsx:200-216` — current EnvPanel placeholder
- `src/app/api/projects/[id]/` — existing project API routes
