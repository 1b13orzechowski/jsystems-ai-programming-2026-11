---
name: plan-orchestrated-implementation
description: Write a reviewable implementation plan for a whole application (or a requested part) from its approved PRD, ADRs and design guidance, for execution by a strong orchestrator with cheap bounded workers. Use when the user asks for an implementation plan, a task breakdown, a dependency matrix, agent briefs or a "software factory" run after PRD/ADR work. Stops for human review before any execution.
---

# Plan an orchestrated implementation

Produce one plan document that a strong orchestrator can execute autonomously (for example with `/goal`) and a human can review in one sitting. Planning never implements, installs, launches workers, pushes or merges.

Read before writing: `references/plan-template.md` (structure), `references/review-checklist.md` (pre-save review), `references/worker-cli.md` (worker selection and headless commands). `references/brief-template.md` is used later, at dispatch time.

## Hard rules

1. **Whole application by default.** Cover every flow and acceptance criterion in the PRD, in phases. Plan only a part when the user asks; then list what is out of the plan.
2. **Real sources only.** Locate the PRD, ADRs, design guidance and agent instructions in the repository. Ask for paths only if missing or ambiguous. Teaching examples, other projects and old plans are not requirements.
3. **Inspect before planning.** Report what exists: branch, HEAD, working-tree changes, app entry points, build descriptors, tests, lockfiles, env files (names only), trackers, CI, agent role folders. Run the project's real commands (or show they cannot run yet) and record the baseline result, including failures. Use the existing scaffold or legacy checkout; never plan a replacement app.
4. **Ask only consequential questions**, in one batch, each standing alone: branch/PR base, tracker, missing business context (company, scale, regulated sector, data rules), budget, which worker tools are allowed. Do not ask what the repository, PRD or ADRs already answer. Make cheap decisions yourself and record them.
5. **Check what the documents say** about the problem, users, scale (PoC, internal app, enterprise, global), company specifics (regulated sector, data protection) and diagrams (Mermaid). Propose PRD/ADR additions for gaps; missing architecture becomes a **proposed ADR**, never a plan assumption.
6. **Consistency review before saving** (checklist in `references/review-checklist.md`): plan, PRD, ADRs, every applicable AGENTS.md/CLAUDE.md level, path-scoped instructions. Fix document defects you can fix factually; list decisions only the human can make. Record the findings and fixes in a change log at the end of the plan.
7. **Real tests.** End-to-end and manual tests exercise the real application: every endpoint, LLM call and decision method runs for real — no request interception, stub servers or recorded LLM output. Unit/integration mocks of any endpoint (external or the app's own) are built only from real recorded calls made by a capture task in the plan, never from documentation. Plan capture tasks before the tasks that need them and refresh them when contracts change.
8. **One authoritative dependency matrix** with columns: Task · Observable outcome · PRD/ADR links · Prerequisites · Owner/model · Editable files · Verification and handoff · Status · Issue. Link exact PRD criteria and ADR sections; never copy their text. Each row: bounded deliverable, failing behavioral test first (where code is involved), acceptance evidence, one commit. Status lives only in this column. Issue IDs are filled after approval if GitHub Issues are enabled; the agent's task list then uses the same IDs. A Mermaid dependency picture may accompany the matrix and is marked non-authoritative.
9. **Definition of Done** section for the whole plan: all rows done or explicitly descoped, ACs/TACs covered, build + tests + startup + E2E + manual QA recorded separately, independent review resolved, PR open, human approval, cleanup done.
10. **Workers from tools that actually exist.** Verify each candidate with `--version`/`--help` (never assume). Default: strong orchestrator + cheapest suitable bounded worker. OpenCode headless is the always-available fallback (free models after install; provider via `/connect`) — if not installed, plan its install as a human-approved prerequisite and mark the command unverified. Check official pricing pages on the day for paid pickers (billing models change). Record model, provider, budget and escalation path. Review and acceptance never go to small models.
11. **Agents' research rules** in the plan and every brief: Context7 for library facts and `<tool> --help` for CLI facts before web search; delegate multi-page research to subagents or headless CLI agents and keep only conclusions.
12. **Parallelism only with disjoint editable files**; tell each worker what runs concurrently. Serialize shared contracts, lockfiles, migrations, configs, integration files and secret-using tasks. One checkout by default; worktrees only when parallel edits to the same file are unavoidable, with approval.
13. **Briefs and lifecycle.** Briefs are compiled just before dispatch (never during planning) and saved as `docs/.agent-briefs/<plan-name>-<task-id>.md`. The plan and briefs are committed during the work (brief in its task commit, status update in the same commit). A final cleanup task deletes the plan and its briefs after the Definition of Done.
14. **Secrets** never pass through chat: the human creates env files with `! <command>`; agents check variable names, never print values.
15. **Stop for review.** Save the plan as `DRAFT — awaiting human review`, report, and end the turn. Approval authorizes only what it names; pushing, PRs and merges need separate approval. A positive self-review is not approval.

## Procedure

1. Read the applicable instructions (all levels: organization/managed, user cloud preferences if visible, local user files, project root, path-scoped, module folders) and note which exist.
2. Read the PRD, ADRs and design guidance fully. Inspect the repository (rule 3) with simple, separate shell commands.
3. Verify tools and models (rule 10). Delegate pricing or docs research to a subagent when it needs several pages.
4. Ask the consequential questions (rule 4); wait for answers.
5. Draft the plan from `references/plan-template.md` at the destination the user named; otherwise at the repository's configured plans directory (for example `plansDirectory` in `.claude/settings.json`) or `docs/plans/`, named `<plan-name>-implementation-plan.md`. If the user's destination looks like a template with an empty name, choose a short name and say so.
6. Run `references/review-checklist.md` against the draft and the source documents; apply factual fixes, list human decisions.
7. Check relative links resolve and Mermaid blocks are well formed.
8. Save, do not commit unless asked, and report: path, baseline, verified commands, decisions needed, first bounded task, review gate. End the turn.

## Report format

- Saved plan path and status (draft).
- Baseline: what exists, commands run with results, baseline failures.
- Document fixes made during review (or "none") and decisions still needed.
- First bounded task after approval and the gate that authorizes it.
- Short coaching tips (fresh session for execution, `/goal`, skill reuse).
