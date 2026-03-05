# Findings — 2026-03-06 — Persistent Logs & Terminal

## Problem Statement
Live logs in the LogViewer and terminal entries in ProjectTerminal are stored in React component state. Navigating away from the tab (e.g., switching from Logs to Services) resets all state — logs disappear, terminal history is lost. Additionally, the "Previous Runs" section lacks timestamps and has no option to delete old log files.

## Requirements
| Requirement | Details |
|-------------|---------|
| Logs: session persistence | Live log viewer retains entries when switching between tabs within ProjectDetail |
| Logs: disk persistence + delete | Log files on disk survive indefinitely; user can delete individual runs or clear all |
| Logs: timestamps on Previous Runs | Show started_at / stopped_at so user knows when each run happened |
| Terminal: tab-switch persistence | Terminal history survives navigating between tabs within the same browser session |
| Terminal: per-project | Terminal history is scoped per project (already the case) |
| Terminal: clear all | "Clear all" button wipes terminal history (already exists, just needs to work with lifted state) |

## Chosen Approach: Lift State to Parent

Move log and terminal state up to `ProjectDetail` so it lives above the `<Tabs>` component and survives tab switches.

### Changes

1. **`project-detail.tsx`**
   - Call `useLogStream()` here; hold `logs`, `connected`, `clear` at this level
   - Hold `terminalEntries` + `setTerminalEntries` state here
   - Pass both down as props to child components

2. **`log-viewer.tsx`**
   - Receive `logs`, `connected`, `clear` as props (remove internal `useLogStream` call)
   - Render `started_at` / `stopped_at` timestamps on each Previous Run entry
   - Add per-run delete button (calls `DELETE /api/logs/[runId]`)
   - Add "Clear All Logs" button (calls `DELETE /api/projects/[id]/logs`)

3. **`project-terminal.tsx`**
   - Receive `entries` + `setEntries` as props instead of local `useState`
   - Keep all other logic (input, running state, history navigation) internal

4. **New API: `DELETE /api/logs/[runId]/route.ts`**
   - Deletes the run record from DB + removes log file from disk
   - Returns 200 on success

5. **New API: `DELETE /api/projects/[id]/logs/route.ts`**
   - Deletes all non-running runs for the project + their log files
   - Returns count of deleted runs

### Key Decisions
| Decision | Rationale |
|----------|-----------|
| Lift state to parent | Simplest way to survive tab switches; no DB changes needed for session state |
| No DB for terminal history | Only tab-switch persistence needed, not cross-refresh |
| Delete individual + bulk | Per-run delete for surgical cleanup; clear-all for housekeeping |
| Timestamps from existing `runs` table | Data already exists (`started_at`, `stopped_at`), just not rendered |

## Open Questions
- None — ready for planning.

## Previous Findings

### Error Diagnostics (2026-03-05)
See git history for prior findings on error diagnostics feature (implemented).

### Smart Env Editor (2026-03-05)
See git history for prior findings on the env editor feature (implemented).
