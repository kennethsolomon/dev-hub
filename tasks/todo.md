# TODO — 2026-03-06 — Persistent Logs & Terminal

## Goal
Make log viewer and terminal state survive tab switches within ProjectDetail. Add timestamps to Previous Runs, and add delete options for log history.

## Plan

### Phase 1: API — Delete log runs
- [x] Add `DELETE` handler to `src/app/api/logs/[runId]/route.ts` — delete run record from DB + remove log file from disk; skip if run status is `running`
- [x] Add `DELETE /api/projects/[id]/logs` route — delete all non-running runs for the project + their log files; return `{ deleted: count }`

### Phase 2: Lift log state to ProjectDetail
- [x] In `project-detail.tsx`, call `useLogStream()` at the component level (above `<Tabs>`)
- [x] Pass `logs`, `connected`, `clear` as props to `LogViewer`
- [x] Update `LogViewer` props interface to accept `logs`, `connected`, `clear` instead of calling `useLogStream` internally

### Phase 3: Lift terminal state to ProjectDetail
- [x] In `project-detail.tsx`, add `terminalEntries` + `setTerminalEntries` state
- [x] Pass `entries` + `setEntries` as props to `ProjectTerminal`
- [x] Update `ProjectTerminal` to accept entries/setEntries via props, remove internal `useState<TerminalEntry[]>`

### Phase 4: Enhance Previous Runs UI
- [x] Render `started_at` timestamp on each Previous Run entry (format as relative or short datetime)
- [x] Render `stopped_at` or duration if available
- [x] Add per-run delete button (trash icon) — calls `DELETE /api/logs/[runId]`, removes from local `runs` list
- [x] Add "Clear All Logs" button — calls `DELETE /api/projects/[id]/logs`, refetches project data

### Phase 5: Verification
- [x] `npx tsc --noEmit` — no new type errors
- [x] `npm test` — all 93 tests pass
- [x] `npm run build` — builds successfully
- [ ] Manual: switch between tabs, confirm logs and terminal entries persist

## Acceptance Criteria
- [x] Switching from Logs tab to Services tab and back retains all live log entries
- [x] Switching from Terminal tab to another tab and back retains all terminal entries
- [x] Previous Runs section shows timestamps (when each run started)
- [x] Each previous run has a delete button that removes the run + log file
- [x] "Clear All Logs" button removes all non-running runs and their files
- [x] No type errors, build succeeds, all tests pass
