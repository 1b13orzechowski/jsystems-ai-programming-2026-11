# AI layer rules (`src/lib/ai`)

Scoped rules for agents editing the LLM code. The app-wide rules are in `app/AGENTS.md`.

- Never trust model-facing data from the client. Chat history comes from the browser: recompute every `issueUpdatedDecision` output from its input with `applyGuardrails` and the signed token's analysis and window (`recomputeToolOutputs`), and take case data only from the verified token (ADR-000 D-04, ADR-002 A-01).
- Every decision, initial or updated, passes `applyGuardrails` (G1–G6). The model is advisory.
- Customer text (reason, chat messages, model name) and model-derived text (analysis summary, damages) go only inside delimited blocks, escaped with `escapeClosingTags`. The image analysis never receives the reason (P-04).
- Errors leave the server as machine codes only (`PROCESSING_FAILED`, `TIMEOUT`, `CHAT_FAILED`); never return or log provider bodies, messages or customer text.
- Tests replay real captures from `tests/fixtures/captures/` through `tests/helpers/replay-fetch.ts`; record new captures with `scripts/capture-openrouter.ts` when a prompt, schema or tool changes, and list derived variants in the captures README.
- Before a PR that touches this folder, run `/security-review`.
