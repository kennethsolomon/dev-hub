# Lessons Learned

Accumulated patterns from past bugs and corrections. Read this file at the **start of any task** and apply all active lessons before proceeding. Add a new entry whenever a recurrent mistake is identified.

## Entry Format

```markdown
### [YYYY-MM-DD] [Brief title]
**Bug:** What went wrong (symptom)
**Root cause:** Why it happened
**Prevention:** What to do differently next time
```

## Active Lessons

<!-- Add entries here. Remove a lesson only when the root cause is permanently fixed in the codebase. -->

### [2026-03-06] Use Haiku for commits and PRs
**Bug:** Using Opus for commits and PR creation is wasteful — these are simple templating tasks.
**Root cause:** Model not switched before running `/commit` or `/review` → create PR step.
**Prevention:** Before creating a commit or PR, remind the user to switch to Haiku for speed with `/model haiku`.

