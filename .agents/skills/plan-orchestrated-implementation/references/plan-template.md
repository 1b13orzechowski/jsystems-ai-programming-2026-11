# Plan template

Keep the plan readable in one sitting: links instead of copied specs, one matrix, short sections. Replace `<…>`.

````markdown
# Implementation Plan — <application or feature>

**Status:** DRAFT — awaiting human review. Planning does not authorize execution, new agents, publication or merge.
**Date:** <YYYY-MM-DD> (revision <n>: <what changed>)
**Scope:** <whole application from PRD | named part>; link PRD flows and AC range. Context and scale: link PRD section.
**Architecture:** links to ADRs. **Design guidance:** links. **Run mode:** autonomous (`/goal implement this plan: @<path>`) with gates, or phase by phase.

## 1. Baseline
Table: checkout/branch/HEAD, working tree, application state, specification files, missing inputs, tracker, CI/review automation, agent roles.
Table "Commands verified": command → observed result (include expected baseline failures).

## 2. Instructions in force
Table: level (organization, user cloud, user local, project root, path-scoped, module, folder) → source file (exists/absent) → which agents read it → effect on the plan.

## 3. Execution model
- Roles table: orchestrator, default worker, escalation worker, always-available fallback (OpenCode headless), alternatives, reviewer, final acceptance — mechanism (verified?), model/provider, responsibility. Headless commands written out.
- Budget constraint and escalation path.
- Rules every agent follows (research order, TDD, file scope, mocks from captures, report contradictions).
- Checkout and branch; brief path `docs/.agent-briefs/<plan-name>-<task-id>.md`; lifecycle (commit during work, delete after DoD); acceptance procedure.

## 4. Phases
Table: phase → goal → tasks → exit gate.

## 5. Dependency picture (non-authoritative)
Mermaid flowchart of task dependencies.

## 6. Dependency matrix (authoritative)
| Task | Observable outcome | PRD/ADR links | Prerequisites | Owner/model | Editable files | Verification and handoff | Status | Issue |
Rows include: prerequisites done by the human (secrets, tool installs such as ffmpeg), scaffold/bootstrap, shared contracts (orchestrator), real-capture tasks before dependent mocks, implementation tasks (Red → Green → commit), integration, E2E (real), manual QA (real; screenshots committed to `docs/qa/screenshots/`), independent review, final demo video (ffmpeg, real app, `docs/qa/video/`), PR with links to QA report and video (separate approval), cleanup (delete plan + briefs, keep `docs/qa/`).

## 6a. Test reality rules
Table: test type → what is real → what may be mocked (E2E and manual: nothing).

## 7. Critical path, hotspots, failure handling
Critical path; parallel windows; serialized tasks; hotspot table (file → owner → rule); failure/rollback/escalation; smaller fallback slices with deferred ACs.

## 8. Unresolved decisions (human)

## 9. Definition of Done and review gates
DoD bullets; numbered gates (plan approval, secrets, QA review, push/PR approval, merge); first bounded task.

## 10. Change log
Table: review finding → fix (documents changed).
````
