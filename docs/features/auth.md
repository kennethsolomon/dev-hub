# Auth

> **Status:** Complete
> **Web:** Complete
> **Mobile:** N/A

## Overview

DevHub has optional passcode-based authentication. When enabled, users must enter a passcode to access the UI. Sessions are stored in-memory with a 24-hour TTL. Auth is disabled by default.

## Database Schema

### `auth` table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INTEGER | PRIMARY KEY CHECK (id = 1) | Singleton row |
| `passcode_hash` | TEXT | NOT NULL | bcrypt hash (12 rounds) |
| `created_at` | TEXT | NOT NULL DEFAULT datetime('now') | |

Auth state is also tracked in the `settings` table via `auth_enabled` key.

## Business Logic

### Passcode Management

`setPasscode(passcode)` in `src/lib/auth/session.ts`:
1. Hash passcode with bcrypt (12 rounds)
2. Upsert into `auth` table (singleton row with `id = 1`)
3. Set `auth_enabled = 'true'` in settings

`verifyPasscode(passcode)`:
1. Load hash from `auth` table
2. Compare with bcrypt

### Session Management

- **Store:** In-memory `Map<string, { createdAt: number }>`
- **Create:** `createSession()` generates UUID v4 session ID
- **Validate:** `validateSession(sessionId)` checks existence and TTL (24 hours)
- **Destroy:** `destroySession(sessionId)` removes from map
- **Cookie:** `devhub_session`, httpOnly, sameSite=lax, path=/, maxAge=86400

### Auth Check Flow

`requireAuth()`:
1. If auth is not enabled → return `true` (allow access)
2. Read `devhub_session` cookie
3. Validate session → return `true`/`false`

### Middleware Behavior

The Next.js middleware does NOT perform auth checks (Edge Runtime lacks DB access). Auth is checked:
- Client-side on page load
- Server-side in individual API route handlers via `requireAuth()`

## API Contract

### `GET /api/auth`

Check auth state.

**Response:** `200 OK`
```json
{
  "authEnabled": false,
  "hasPasscode": false
}
```

### `POST /api/auth`

Three actions:

**Setup (first-time passcode):**
```json
{ "action": "setup", "passcode": "mypasscode" }
```
- Passcode must be >= 4 characters
- Sets cookie on success
- Error: `400` if too short

**Login:**
```json
{ "action": "login", "passcode": "mypasscode" }
```
- Sets cookie on success
- Error: `401` if invalid

**Logout:**
```json
{ "action": "logout" }
```
- Clears cookie and destroys session

**Unknown action:** Returns `400 Unknown action`

## Permissions & Access Control

- Auth is globally on/off via `auth_enabled` setting
- Single passcode for all users (no user accounts in V1)
- All API routes can use `requireAuth()` to gate access
- `/login` page and `/api/auth` are always accessible (not auth-gated)

## Edge Cases

- **Auth disabled:** All requests pass through, no login required
- **No passcode set:** `hasPasscode` returns false, UI shows setup flow
- **Session expired:** 24-hour TTL, user must re-login
- **Server restart:** All sessions lost (in-memory store), users must re-login
- **Multiple tabs:** Same cookie, same session

## Error States

| Scenario | Response |
|----------|----------|
| Passcode too short (<4 chars) | `400 Passcode must be at least 4 characters` |
| Wrong passcode | `401 Invalid passcode` |
| Unknown action | `400 Unknown action` |
| No passcode set + login attempt | `verifyPasscode` returns false → `401` |

## UI/UX Behavior

### Web

- Login page at `/login` with passcode input
- First-time setup flow when no passcode exists
- Redirect to `/login` when session is invalid/expired
- Settings page shows auth toggle and passcode change option

### Mobile

N/A

## Platform Notes

- bcrypt via `bcryptjs` (pure JS, no native bindings)
- In-memory session store means sessions don't persist across server restarts — acceptable for V1 local dev tool
- Cookie is `httpOnly` to prevent XSS access

## Related Docs

- [settings.md](settings.md) — `auth_enabled` setting
