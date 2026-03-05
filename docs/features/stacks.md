# Stacks

> **Status:** Complete
> **Web:** Complete
> **Mobile:** N/A

## Overview

Stacks are named groups of projects that can be started/stopped together. Useful for multi-project workflows (e.g., "Frontend + API + Worker").

## Database Schema

### `stacks` table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `name` | TEXT | NOT NULL UNIQUE | Display name |
| `created_at` | TEXT | NOT NULL DEFAULT datetime('now') | |

### `stack_items` table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `stack_id` | TEXT | NOT NULL FK → stacks(id) CASCADE | |
| `project_id` | TEXT | NOT NULL FK → projects(id) CASCADE | |
| `sort_order` | INTEGER | NOT NULL DEFAULT 0 | Start order |
| PRIMARY KEY | | `(stack_id, project_id)` | Composite |

## Business Logic

### Create Stack

1. Insert stack record with unique name
2. Insert stack_items for each project ID with sort order from array index

### Start Stack

`POST /api/stacks/[id]/start`:
1. Load all stack items ordered by `sort_order`
2. Start each project sequentially (respects dependency order within each project)

### Stop Stack

`POST /api/stacks/[id]/stop`:
1. Load all stack items
2. Stop all projects (parallel)

## API Contract

### `GET /api/stacks`

Returns all stacks with their items (joined with project info).

**Response:** `200 OK`
```json
{
  "stacks": [{ "id": "uuid", "name": "Full Stack", "created_at": "..." }],
  "items": [{ "stack_id": "uuid", "project_id": "uuid", "sort_order": 0, "project_name": "api", "slug": "api", "type": "node" }]
}
```

### `POST /api/stacks`

Create a new stack.

**Body:** `{ "name": "Full Stack", "project_ids": ["uuid1", "uuid2"] }`
**Response:** `200 OK` → `{ id: "uuid" }`

### `PUT /api/stacks/[id]`

Update stack name and/or project list.

### `DELETE /api/stacks/[id]`

Delete stack (cascades to stack_items).

### `POST /api/stacks/[id]/start`

Start all projects in the stack.

### `POST /api/stacks/[id]/stop`

Stop all projects in the stack.

## Permissions & Access Control

Same as projects — requires auth if enabled.

## Edge Cases

- **Duplicate stack name:** UNIQUE constraint returns error
- **Project deleted while in stack:** CASCADE delete removes the stack_item
- **Empty stack:** Start/stop are no-ops

## Error States

| Scenario | Response |
|----------|----------|
| Stack not found | `404` |
| Duplicate name | SQLite UNIQUE constraint error |

## UI/UX Behavior

### Web

- Stacks page (`/stacks`) lists all stacks with their projects
- Create/edit dialog with project multi-select
- One-click start/stop for entire stack
- Projects within a stack show their individual running status

### Mobile

N/A

## Platform Notes

N/A — web only.

## Related Docs

- [projects.md](projects.md) — Stacks group projects
- [services.md](services.md) — Starting a stack starts all services in each project
