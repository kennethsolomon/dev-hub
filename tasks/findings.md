# Findings — 2026-03-05 — Error Diagnostics & Fix Suggestions

## Problem Statement
When a managed project crashes with a known error pattern (e.g., `NODE_MODULE_VERSION` mismatch for native modules), DevHub shows the raw error in the log viewer but doesn't recognize it or suggest a fix. Users must diagnose and fix manually.

## Requirements
- Detect known error patterns in real-time log streams
- Show inline diagnostic cards in the log viewer with step-by-step fix instructions
- Offer one-click quickfix buttons for actionable fixes (e.g., `npm rebuild`)
- Extensible pattern registry for adding new error types over time
- Server-side quickfix execution via existing quickfix API pattern

## Decisions
| Decision | Rationale |
|----------|-----------|
| Approach C: Hybrid client detection + server quickfixes | Best UX (real-time + actionable); builds on existing patterns; incrementally extensible |
| Client-side pattern matching in log stream | Immediate feedback as errors appear; no server roundtrip for detection |
| Server-side quickfix execution | Quickfixes need shell access (npm rebuild, etc.); reuse existing quickfix endpoint |
| Shared error pattern registry | Single source of truth for patterns, diagnostics, and fix metadata |
| Start with common Node.js errors | NODE_MODULE_VERSION mismatch, MODULE_NOT_FOUND, EADDRINUSE, command not found |

## Architecture

### Components

1. **Error Pattern Registry** (`src/lib/diagnostics/patterns.ts`)
   - Array of `{ id, regex, title, description, steps[], quickfix? }` objects
   - Each pattern has human-readable fix steps and optional quickfix action
   - Initial patterns: NODE_MODULE_VERSION, MODULE_NOT_FOUND, EADDRINUSE, EACCES, command not found

2. **Log Viewer Enhancement** (`src/components/logs/log-viewer.tsx`)
   - Import pattern registry; scan each log line against patterns
   - When matched, render an `ErrorDiagnostic` card inline in the log stream
   - Card shows: error title, description, numbered fix steps, optional "Fix" button
   - Deduplicate: only show diagnostic once per pattern per session (not on every matching line)

3. **Quickfix API Extension** (`src/app/api/projects/[id]/quickfix/route.ts`)
   - Add new actions: `rebuild-native-modules`, `reinstall-node-modules`
   - Runs `npm rebuild` or `rm -rf node_modules && npm install` in project directory
   - Returns success/failure message

4. **Process Manager Integration** (`src/lib/process/manager.ts`)
   - On stderr output, check against pattern registry
   - On process exit with non-zero code, emit `diagnostic` event with matched patterns
   - Log viewer can listen for diagnostic events via SSE

### Data Flow
1. Service writes to stderr -> log stream delivers to client
2. LogViewer scans line against pattern registry (client-side)
3. First match for a pattern -> render ErrorDiagnostic card
4. User clicks "Fix" -> POST to quickfix API with action + project context
5. Quickfix API executes fix command in project directory
6. User restarts service

### Initial Error Patterns
| Pattern | Regex | Quick Fix |
|---------|-------|-----------|
| Native module version mismatch | `NODE_MODULE_VERSION \d+.*requires.*NODE_MODULE_VERSION \d+` | `npm rebuild` |
| Module not found | `Cannot find module '(.+)'` | `npm install` |
| Port in use | `EADDRINUSE.*:(\d+)` | Kill process on port |
| Permission denied | `EACCES.*permission denied` | Show chmod instructions |
| Command not found | `command not found: (.+)` | Show install instructions |

## Open Questions
- None — ready for planning.

## Previous Findings

### Smart Env Editor (2026-03-05)
See git history for prior findings on the env editor feature (implemented).
