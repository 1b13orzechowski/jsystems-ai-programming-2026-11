# Brief T12 — Chat agent with the updated-decision tool

## Goal and observable outcome
`createChatStream` answers customer chat messages with the full case context rebuilt from the verified token (AC-24), declines off-topic requests (AC-26), never follows customer instructions (AC-36), and issues an updated decision only through the `issueUpdatedDecision` tool whose result always passes the same guardrails G1–G6 (AC-25, P-03).

## Editable files
- `app/src/lib/ai/chat-agent.ts`
- `app/src/lib/ai/tools/issue-updated-decision.ts`
- `app/tests/integration/ai/chat-agent.test.ts`
(Do **not** edit the captures README — T11b edits it concurrently. List each derived variant you introduce — source capture, edit, reason — in your report; the orchestrator adds them.)

## Inputs (read only)
- `app/src/lib/ai/models.ts` (`ModelSet`, `createModels(env, { fetch })`, `OPENROUTER_PROVIDER_OPTIONS.chat`), `app/src/lib/ai/prompts/chat.ts` (`buildChatInstructions({ payload, currentDecision, policy })`), `app/src/lib/ai/policies.ts` (`loadPolicy`), `app/src/lib/domain/guardrails.ts` (`applyGuardrails`), `app/src/lib/domain/schemas.ts` (`ChatUIMessage`, `CaseTokenPayload`, `Decision`, `DecisionSchema`, `UpdatedDecisionInputSchema`, `CHAT_MESSAGE_MAX`, `CHAT_MESSAGES_MAX`).
- `app/tests/helpers/replay-fetch.ts` and the example `app/tests/integration/ai/replay-smoke.test.ts`.
- Captures `chat-text.json` (plain answer, 1 exchange) and `chat-tool.json` (2 exchanges: tool call, then text) + README in `app/tests/fixtures/captures/openrouter/`.
- `docs/ADR/002-ai-pipeline.md` §3.5, P-03; `docs/ADR/003-api-routes.md` §4 (`POST /api/chat` request rules).

## Specification
```ts
// tools/issue-updated-decision.ts (import "server-only")
export function createIssueUpdatedDecisionTool(ctx: { payload: CaseTokenPayload; ruleIds: ReadonlySet<string> }): Tool; // AI SDK `tool({ description, inputSchema: UpdatedDecisionInputSchema, execute })`
// execute(input) → applyGuardrails({ draft: input, analysis: payload.analysis, window: payload.window, ruleIds, caseType: payload.input.caseType, kind: "updated" }) → Decision

// chat-agent.ts (import "server-only")
export const CHAT_TIMEOUT = { totalMs: 45_000, firstChunkMs: 15_000 };
export type ChatValidationError = "too_many_messages" | "too_few_messages" | "last_not_user" | "invalid_text" | "file_part" | "invalid_message";
export async function prepareChatMessages(uiMessages: unknown): Promise<{ ok: true; messages: ChatUIMessage[] } | { ok: false; reason: ChatValidationError }>;
export function currentDecision(payload: CaseTokenPayload, messages: ChatUIMessage[]): Decision; // latest valid tool output, else payload.decision
export function createChatStream(args: { payload: CaseTokenPayload; messages: ChatUIMessage[]; models: ModelSet; signal?: AbortSignal }): StreamTextResult<…>; // returns the AI SDK streamText result
```
`prepareChatMessages` (ADR-002 §3.5, ADR-003 §4, AC-22, AC-27): validate with `safeValidateUIMessages` from `ai` (check its AI SDK 7 signature via Context7/types; pass the data part schema `{ decision: DecisionSchema }` and the tool's schemas if supported); 2–40 messages; last message role `user`; every user text part 1–2000 chars and not whitespace-only; any `file` part → `file_part`; **drop** `system` role messages; then keep only `user` text parts and assistant `text` + `tool-issueUpdatedDecision` parts (data parts are dropped for the model — the first decision comes from the token).
`createChatStream`: `streamText({ model: models.chat, instructions: buildChatInstructions({ payload, currentDecision: currentDecision(payload, messages), policy: loadPolicy(payload.input.caseType) }), messages: await convertToModelMessages(messages), tools: { issueUpdatedDecision: createIssueUpdatedDecisionTool({ payload, ruleIds: policy.ruleIds }) }, stopWhen: isStepCount(2), timeout: CHAT_TIMEOUT, maxRetries: 1, abortSignal: signal, providerOptions: OPENROUTER_PROVIDER_OPTIONS.chat })`. (If `convertToModelMessages` is async in AI SDK 7, make `createChatStream` async and return a Promise — check the types.) Use `instructions`, never a `system:` key; use `onEnd`, never `onFinish`.

## TDD (integration project, node environment; write first — red because modules are missing)
Use the real provider with `replayFetch` (see `replay-smoke.test.ts`). Build a synthetic `CaseTokenPayload` in the test from the capture inputs (reklamacja, Laptop, "ThinkBook 14", the analysis `sdkResult` of `analysis-reklamacja-laptop-1.json`, a `Decision` from `decision-reklamacja-laptop-1.json` `sdkResult` + `kind: "initial"` + `disclaimerPl`, a window within 24 months). Consume the result with `await result.text`, `await result.steps`, or `result.toUIMessageStream()` read to the end.
- plain answer: replay `chat-text` → text equals the capture's `sdkResult.text`; request body (`requests[0].body`) contains the model name and the analysis summary in the system/instructions message, `reasoning.effort: "low"`, `provider.require_parameters: true`, a `tools` array with `issueUpdatedDecision`.
- tool path: replay `chat-tool` (2 exchanges) → one tool call; the tool result is a `Decision` with `kind: "updated"`, the disclaimer, and label equal to what guardrails produce for the recorded arguments.
- tool path with guardrails (derived variant, minimal documented edit): `chat-tool` with the tool-call arguments' `"label"` changed to `"zaakceptowano"` (edit the SSE text of exchange 0 via `editBody`) and a payload whose window is **expired** → tool result label `odrzucono`, `guardrailApplied: "window_expired"`.
- invalid tool input (derived variant: an argument removed from the recorded tool call, e.g. `nextStepsPl`) → no `Decision` result is produced for that call (AI SDK reports a tool input error); the stream does not throw.
- `prepareChatMessages`: 41 messages → `too_many_messages`; last message assistant → `last_not_user`; whitespace-only user text and 2001 chars → `invalid_text`; a `file` part → `file_part`; a `system` message is dropped; a `data-decision` part is removed from the output messages.
- `currentDecision`: returns the latest `tool-issueUpdatedDecision` output with `state: "output-available"` that parses with `DecisionSchema`, else the token decision.
Then `npm run test`, `npm run typecheck`, `npm run lint`.

## Rules
- Repository root: `/home/labuser/jsystems-ai-programming-2026-11/.claude/worktrees/skills-lock`; npm commands in `app/`. AI SDK `ai@7.0.181`: use Context7 `/vercel/ai` and the installed types; never use v5/v6 names (`system:` key, `onFinish`, `generateObject`, `stepCountIs`, `fullStream`, `type: "image"`) — a guard test fails on them.
- No `any`, no type assertions (`as`, `as const`).
- Edit only the listed files. Never `npm install`, never touch `package.json`, lockfile, configs, `src/app/*`, `src/components/*`, shared contracts, `models.ts`, prompts, guardrails, other captures, docs. `curl`, `wget`, `sudo` denied. No real network calls. If you create a file by mistake, report it — do not try `rm`.
- Concurrent work (do not edit): T11b `app/src/lib/ai/{errors,analyze-image,decide}.ts`, `app/tests/integration/ai/{analyze-image,decide}.test.ts`. If you need `ChatError` from `errors.ts` before T11b finishes, do not create the file — use a plain `Error` and report it.
- Report contradictions instead of guessing. Do not commit.

## Report
Files; red run reason; final `npm run test` (counts, skips), `typecheck`, `lint`; derived variants added; assumptions/contradictions.
