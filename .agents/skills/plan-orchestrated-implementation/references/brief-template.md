# Brief template (compiled at dispatch time, after plan approval)

Path: `docs/.agent-briefs/<plan-name>-<task-id>.md`. Self-contained: a small worker must not need to read the whole plan, PRD or ADRs. Link sources for traceability, but paste the excerpts the task needs.

```markdown
# Brief <task-id> — <title>
Plan: <link> · Worker: <tool/model> · Attempt: <n> · Concurrent tasks: <ids + their files (do not touch)>

## Goal and observable outcome
## Scope
- Editable files (exact list). Everything else is read-only.
- Out of scope / non-goals.
## Sources (excerpts)
- PRD criteria <ids>: <quoted text>
- ADR <section>: <quoted text>
- Current contracts: <paste the relevant types/schemas as they exist now>
- Predecessor outputs: <commit SHAs, capture file paths>
## Rules
- Context7 for library facts, `<tool> --help` for CLI facts, web search last; delegate long research.
- TDD: write the failing test, run it, report the failure; minimal code; full scoped verification.
- Mocks only from the named captures. No `npm install`, no edits to shared files, no commits unless told.
- Report contradictions; do not guess or change scope.
## Steps (ordered)
## Test inputs and expected results
## Commands to run
## Report
Files changed · Red evidence (command + failing assertion) · Green evidence · Contradictions · Open questions
```

The orchestrator reads the diff, re-runs the checks, updates the plan Status and commits the task together with this brief.
