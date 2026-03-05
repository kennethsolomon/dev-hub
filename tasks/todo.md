# TODO — 2026-03-05 — Smart Env Editor

## Goal
Replace the placeholder Environment tab with a smart env editor that reads `.env` files, overlays DB overrides, detects ports/secrets, and lets users manage env vars from the UI.

## Plan

### Backend: Env Parser Utility
- [x] Create `src/lib/env/parser.ts` — utility to read and parse `.env` files from a project path
  - Reads `.env`, `.env.local`, `.env.development` (in priority order)
  - Returns `Array<{ key, value, source }>` (source = filename)
  - Handles comments, empty lines, quoted values
- [x] Add helpers: `isPortVar(key, value)` and `isSecretVar(key)` to the same file
  - Port: key matches `/PORT/i` OR value is numeric 1000-65535
  - Secret: key matches `/(SECRET|KEY|TOKEN|PASSWORD|PRIVATE)/i`

### Backend: API Routes
- [x] Create `src/app/api/projects/[id]/env/route.ts` — GET handler
  - Parse `.env` files from project path
  - Query `env_overrides` for this project
  - Merge into unified list: `{ key, fileValue, source, override, effective, isPort, isSecret }`
  - For port vars: check if port is in use via `os.isPortInUse()`
  - Return JSON with `{ files: string[], variables: EnvVariable[] }`
- [x] Add PUT handler to same route file
  - Body: `{ key: string, value: string | null, service_id?: string }`
  - If `value` is non-null: upsert into `env_overrides`
  - If `value` is null: delete from `env_overrides` (revert to .env)
  - Return updated variable entry

### Frontend: EnvPanel Component
- [x] Replace `EnvPanel` placeholder in `src/components/projects/project-detail.tsx`
  - Extract to `src/components/projects/env-panel.tsx`
  - Uses `useApi('/api/projects/{id}/env')` to fetch merged env data
  - Displays table: Key | .env Value | Override | Port | Actions
- [x] Implement inline edit flow
  - Click "Edit" on a row -> input field appears with current effective value
  - Save -> PUT to API -> refetch
  - "Remove override" (x button) -> PUT with `value: null` -> refetch
- [x] Implement "Add Override" dialog
  - Button at bottom of table
  - Key + Value inputs
  - Saves via PUT
- [x] Port var styling
  - Green dot: port is free
  - Red dot: port is in use by another process
  - Clickable port number linking to `http://localhost:{port}` when running
- [x] Secret var masking
  - Default: show `••••••••` with eye toggle to reveal
  - Override input still shows full value when editing

### Integration: Verify Runtime Injection
- [x] Confirm `manager.ts` reads `env_overrides` at start time (already does — verified lines 86-93)
- [ ] Test: set a PORT override in the UI, start the service, confirm it uses the overridden port

## Verification
- `npx tsc --noEmit` → no type errors
- `npm test` → all 12+ tests pass
- `npm run build` → builds successfully
- Manual: open project detail → Environment tab → see vars from `.env`
- Manual: edit a PORT var → start service → confirm it uses the new port
- Manual: add an override for a var not in `.env` → confirm it appears
- Manual: remove an override → confirm it reverts to `.env` value
- Manual: secret vars are masked by default

## Acceptance Criteria
- [ ] Environment tab shows all vars from `.env` files merged with DB overrides
- [ ] Users can set/edit/remove overrides from the UI
- [ ] Port vars have colored status dots and are clickable when running
- [ ] Secret vars are masked by default with reveal toggle
- [ ] Overrides are injected at runtime when starting services
- [ ] No `.env` files are ever modified by DevHub
- [ ] All existing tests still pass

## Risks / Unknowns
- `.env` parsing edge cases (multiline values, export prefix, interpolation) — keep parser simple, handle common cases
- Port status check adds latency to GET — acceptable for small var count; could add `?skipPortCheck=true` if needed

## Results
- (fill after execution)

## Errors
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |
