# Real OpenRouter captures (T10)

Recorded on 2026-11-26 with `scripts/capture-openrouter.ts` (run from `app/`: `npx tsx --env-file=.env.local scripts/capture-openrouter.ts [zwrot|reklamacja|chat|errors]`) against `https://openrouter.ai/api/v1/chat/completions`, client `ai@7.0.181` + `@openrouter/ai-sdk-provider@3.1.0`, requested model `openai/gpt-6-luna`, provider options `reasoning.effort` (analysis/chat `low`, decision `medium`) and `provider.require_parameters: true`.

Each JSON file holds: capture name, date, target, requested model, answering provider, the case input/window used, every HTTP exchange (request body, response status, response headers, raw response body — JSON or SSE text) and the AI SDK result (`sdkResult`). Unit/integration mocks are derived only from these files (AGENTS.md mock rule, ADR-000 §10).

Redactions (the only differences from the wire):
- request bodies: image data URLs replaced by `<redacted image data url: N chars, sha256 …>`;
- response headers: `set-cookie`, `authorization`, `cookie`, `cf-ray` removed;
- response bodies: `"user_id"` (OpenRouter account identifier) replaced by `"<redacted>"`.
The API key never appears (the script refuses to write a file containing it).

Prompts in this script are condensed versions of the ADR-002 instructions; the request/response **shapes** (structured output `json_schema`, SSE chunks, tool calls) are what mocks depend on. T13b/T14b record the full app prompts end to end through the real routes. Re-run this script whenever a schema, provider option or tool definition changes.

| File | Call | Input | Status | Notes |
|---|---|---|---|---|
| `analysis-zwrot-phone-1.json` | `generateText` + `Output.object(ImageAnalysisSchema)` | zwrot, Smartfon, "Galaxy S30", real photo `phone-1.jpg` (JPEG 900×1200, sent as is after the browser downscale rules) | 200 | provider Azure; model reported `model_mismatch` |
| `decision-zwrot-phone-1.json` | `generateText` + `Output.object(DecisionDraftSchema)` | return policy, analysis above, window within | 200 | provider Amazon Bedrock; `wymaga_weryfikacji` |
| `analysis-reklamacja-laptop-1.json` | analysis | reklamacja, Laptop, "ThinkBook 14", real photo `laptop-1.png` downscaled in headless Chromium to JPEG ≤ 1568 px (233 701 bytes) | 200 | response body starts with whitespace keep-alive lines (verbatim) |
| `decision-reklamacja-laptop-1.json` | decision | complaint policy, reason "Laptop przestał się ładować…", window within | 200 | `wymaga_weryfikacji`, cites R-1/R-3 |
| `chat-text.json` | `streamText` (SSE) with the `issueUpdatedDecision` tool available | "Jaki model zgłosiłem?" | 200 | plain text answer naming the model, no tool call |
| `chat-tool.json` | `streamText`, `isStepCount(2)` | new information: the laptop fell before the failure | 200, 200 | step 1 tool call `issueUpdatedDecision`, step 2 short text; the script's `execute` is a placeholder (guardrails run in the app) |
| `error-401-invalid-key.json` | `generateText` with an invalid key | — | 401 | `{"error":{"message":"Missing Authentication header","code":401}}` |
| `error-unknown-model.json` | `generateText` with `openai/this-model-does-not-exist` | — | 400 | provider error for an invalid model ID |

## Derived variants
Every derived mock (a capture replayed with a delay, or a minimal documented edit such as changed tool arguments or a truncated body) is listed here with its source file and reason.

| Source file | Derivation | Reason | Test |
|---|---|---|---|
| `analysis-zwrot-phone-1.json` | `editBody`: the response `content` string is cut after 20 characters, so the JSON is invalid | malformed provider body must become `ProcessingError` at step `analysis` | `tests/integration/ai/analyze-image.test.ts` |
| `analysis-zwrot-phone-1.json` | `delayMs: 500` replayed with `timeoutMs: 50` | a slow provider must become `ProcessingError` at step `timeout` well before 500 ms | `tests/integration/ai/analyze-image.test.ts` |
| `analysis-zwrot-phone-1.json` | `delayMs: 500`; the caller's `AbortController` aborts at 20 ms | a caller abort mid-request must become `ProcessingError` at step `timeout` | `tests/integration/ai/analyze-image.test.ts` |
| `chat-tool.json` (exchange 0) | tool-call arguments rejoined and re-emitted in the first argument fragment with `"label"` changed from `"odrzucono"` to `"zaakceptowano"`; other fragments emptied; exchange 1 unchanged | guardrail G1 (`window_expired`) must override the model's label inside the tool (expired window in the test payload) | `tests/integration/ai/chat-agent.test.ts` |
| `chat-tool.json` (exchange 0) | same re-emission with `"nextStepsPl"` removed from the arguments | invalid tool input must produce a tool error and no `Decision`, without throwing | `tests/integration/ai/chat-agent.test.ts` |
| `analysis-zwrot-phone-1.json` | `delayMs: 3000` replayed under `ALLOW_TEST_BUDGET=true`, `CASE_BUDGET_MS=1000` | the `/api/case` budget must end the stream with `TIMEOUT` and no `data-case` | `tests/integration/api/case.test.ts` |
