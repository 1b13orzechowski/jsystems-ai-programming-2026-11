# Pre-save review checklist

Run against the draft plan **and** the source documents (PRD, ADRs, design guidance, every applicable instruction file). Read the documents themselves, not summaries. Fix factual defects; list human decisions; log both in the plan's change log.

## Coverage
- Every PRD flow and acceptance criterion maps to at least one task's verification (whole app unless a part was requested).
- Every ADR technical acceptance criterion maps to a task.
- PRD states the problem, users, scale, company specifics (regulated sector, data protection) — ask if missing.
- Diagrams exist where they help (architecture, data flow, sequences, state in ADRs; dependency picture in the plan).

## Cross-document consistency (typical defects found in practice)
- Same thing named differently: module paths, env module, file locations (PRD path vs ADR path), error codes.
- An ADR decision contradicted elsewhere in the same ADR set (for example "server sends codes only" vs "server sends localized text").
- Open questions in the PRD that the ADRs already decided — close them in the PRD.
- Repository coding rules vs generated/vendor code (for example "no type assertions" vs CLI-generated components) — decide scope explicitly.
- Settings the chosen model or provider does not support (check the provider's model capability list); option names not yet verified in the installed package — mark "verify before use".
- Acceptance criteria no planned test can prove (for example a browser not available to the test runner) — plan how, or report the gap.
- Localization rules vs vendor component defaults.
- Data-protection or residency triggers for production.
- Version numbers consistent across ADRs and plan.

## Plan quality
- One matrix; IDs unique; no cycles; prerequisites checked in both directions.
- Each row: bounded deliverable, editable files listed, failing test first, evidence, one commit.
- Parallel tasks have disjoint files; shared contracts, lockfiles, configs, integration files and secret-using tasks are serialized; each worker told about concurrent work.
- E2E and manual QA use the real application with no mocks or interception; a guard test forbids interception in the E2E folder.
- Every failure/error acceptance criterion claimed by E2E has a real trigger named in the plan (for example a second app instance with an invalid provider key, real browser offline mode, real invalid inputs). If a condition cannot be produced for real (for example a slow provider), state the known limit and propose an ADR amendment for a test seam instead of mocking.
- Every mock of an endpoint is derived from a capture task that precedes it — including real error responses — and is either the recording, the recording replayed with a delay, or a minimal documented edit listed in a captures README; captures are refreshed when contracts change. Scan the ADR test tables too: phrases like "mock throws", "never resolves" or "mock stream error" without a capture source are defects.
- Worker tools verified on this machine; unverified ones marked and gated; pricing checked on official pages on the day.
- Every command the plan prescribes is allowed by the agent permission configs (for example a denied `curl`, `wget` or `sudo` → use a script or a human `!` step).
- Fixture and test-data choices obey folder-level rules (READMEs next to sample data); no generated inputs where forbidden; no assertions that presume a model's conclusion about a given input.
- The request does not contradict the PRD's out-of-scope list or constraints (or a PRD/ADR change is proposed first).
- Feature mode: cross-plan file ownership clear; predecessor tasks that create the files are named and gated.
- Baseline (HEAD, working tree, installed tools) is current at the time of saving.
- Research rules (Context7, `--help`, delegation) stated.
- Brief path, commit-during-work and delete-after-DoD lifecycle stated; cleanup task exists.
- Status column is the only tracker (plus Issue IDs if enabled).
- Definition of Done and human gates present; push, PR and merge require separate approval.
- Secrets handled by the human outside chat.
- Relative links resolve; Mermaid blocks well formed.
