# Brief T13 — `POST /api/case` streaming route

## Goal and observable outcome
`POST /api/case` validates the multipart case, runs analysis → decision → guardrails → first message → signed token, and streams transient `data-stage` parts (`analyzing`, then `deciding`) followed by exactly one `data-case` part; any failure ends the stream with only an error code (`PROCESSING_FAILED` or `TIMEOUT`) and no partial decision (AC-09…AC-13, ADR-003 §3–§5, A-01, A-02, A-05).

## Editable files
- `app/src/app/api/case/route.ts`
- `app/tests/integration/api/case.test.ts`
- `app/tests/helpers/ui-stream.ts` (small helper: read a `Response` body to the end and parse SSE `data:` lines into JSON chunks; shared later by T14 — keep it generic)

## Inputs (read only)
`@/lib/env` (`getEnv`, `EnvError`), `@/lib/server/request-guards` (`parseCaseRequest`, `failureResponse`), `@/lib/server/log` (`logEvent`), `@/lib/domain/policy-window` (`computePolicyWindow`, `todayInTimeZone`), `@/lib/ai/policies` (`loadPolicy`), `@/lib/ai/models` (`getModels`, `setModelsForTesting`, `createModels`), `@/lib/ai/analyze-image`, `@/lib/ai/decide`, `@/lib/ai/errors` (`ProcessingError`), `@/lib/domain/guardrails` (`applyGuardrails`), `@/lib/domain/compose-decision-message` (`composeFirstMessage`), `@/lib/security/case-token` (`createCaseTokenPayload`, `signCaseToken`), `@/lib/domain/schemas` (`CaseStreamMessage`, `CaseResult`). Test helpers `app/tests/helpers/replay-fetch.ts`, example `app/tests/integration/ai/replay-smoke.test.ts`, captures in `app/tests/fixtures/captures/openrouter/` (+ README). Docs: `docs/ADR/003-api-routes.md` §3, §4, §5, §8, A-01, A-02, A-04, A-05.

## Specification
- `export const maxDuration = 60;` and only `export async function POST(request: Request): Promise<Response>` (Next returns 405 for other methods; Node runtime — no `runtime` export).
- `getEnv()` in try/catch: `EnvError` → 500 JSON `{ error: "CONFIG_ERROR" }` (no variable values).
- `now = new Date()`, `today = todayInTimeZone(now, env.appTimezone)`; `parseCaseRequest(request, today)` → on failure return `failureResponse(failure)` (no stream, no LLM call).
- `signal = AbortSignal.any([request.signal, AbortSignal.timeout(env.caseBudgetMs)])`.
- `createUIMessageStream<CaseStreamMessage>({ execute, onError })` (AI SDK 7 — check Context7 `/vercel/ai` "createUIMessageStream" and "transient data parts"): in `execute({ writer })`: write `{ type: "data-stage", id: "stage", data: { stage: "analyzing" }, transient: true }`; `analysis = await analyzeImage({ caseInput, jpegBytes, models: getModels(), signal })`; write stage `deciding` (same id, transient); `policy = loadPolicy(caseType)`; `window = computePolicyWindow({ caseType, purchaseDate, now, timeZone: env.appTimezone })`; `draft = await decide({...})`; `decision = applyGuardrails({ draft, analysis, window, ruleIds: policy.ruleIds, caseType, kind: "initial" })`; `caseId = crypto.randomUUID()`; `firstMessage = composeFirstMessage({ caseInput, decision, id: caseId })`; `caseToken = signCaseToken(createCaseTokenPayload({ caseId, input: caseInput, analysis, decision, window }, now), env.caseSigningSecret)`; write `{ type: "data-case", id: "case", data: { caseId, firstMessage, decision, analysisSummaryPl: analysis.summaryPl, caseToken } }`. If `signal` aborted at any point → `TIMEOUT`.
- `onError(error)` returns **only** the code: `ProcessingError` with step `timeout` (or `signal.aborted`) → `"TIMEOUT"`, everything else → `"PROCESSING_FAILED"` (A-04: no messages, provider names or stacks).
- `return createUIMessageStreamResponse({ stream, headers: { "Cache-Control": "no-store" } })`.
- Logging with `logEvent` only: `case_received` (caseType, category), `case_stage` (stage, durationMs), `case_completed` (caseId, label, guardrailApplied, durationMs), `case_failed` (code, errorName, durationMs). Never reason, model text, photo, token.

## TDD (integration project, node environment; write first — red because the route is missing)
Call `POST(new Request("http://localhost/api/case", { method: "POST", body: formData }))` directly. Env via `vi.stubEnv` **before** importing the route (dynamic `await import(...)` after stubbing, or `vi.resetModules()` between env-dependent tests because `getEnv` memoizes): `OPENROUTER_API_KEY=test-key-not-sent`, `LLM_MODEL=openai/gpt-6-luna`, `CASE_SIGNING_SECRET=<Buffer.alloc(32, 5) base64>`, `APP_TIMEZONE=Europe/Warsaw`. Models: `setModelsForTesting(createModels({ ... }, { fetch: replayFetch([...analysis.exchanges, ...decision.exchanges]).fetch }))` — one replay fetch answering the analysis call then the decision call (name both captures in the test). Photo: real bytes of `assets/example-images/phone-1.jpg` (`join(process.cwd(), "..", "assets", "example-images", "phone-1.jpg")`) as `image/jpeg` File; complaint flow with the `laptop-1` captures may reuse the same photo bytes (the replay ignores the image). Purchase dates relative to today in Warsaw so the window is deterministic.
Rows from ADR-003 §8:
- happy path zwrot (reason empty): chunks contain `data-stage` analyzing then deciding (transient parts are still sent on the wire), then one `data-case` whose `decision` parses with `DecisionSchema`, `firstMessage.parts[0].type === "text"`, `parts[1].type === "data-decision"`, and `caseToken` verifies with `verifyCaseToken(token, secret, now)`; response header `Cache-Control: no-store`; the replay saw exactly 2 requests.
- happy path reklamacja with the `laptop-1` captures; and an expired window (zwrot, purchase today−30) → decision `odrzucono`, `guardrailApplied` `window_expired` (guardrails run on the replayed draft).
- missing `model` → 400 `{ error: "VALIDATION_FAILED", fields: ["model"] }` and zero replay requests; reklamacja reason "abc" → 400; future date (tomorrow in Warsaw) → 400; PNG/WebP bytes labelled `image/jpeg` (use the real `laptop-2.webp` bytes) → 415; > 2 MB → 413 (repeat real JPEG bytes); `application/json` → 415.
- analysis fails: replay `error-401-invalid-key` → stream contains an error chunk whose `errorText` is exactly `PROCESSING_FAILED`, no `data-case`, and no provider text anywhere in the body.
- budget: env `ALLOW_TEST_BUDGET=true`, `CASE_BUDGET_MS=1000` (A-05) and the analysis capture replayed with `delayMs: 3000` (derived variant: same capture, delayed) → error chunk `TIMEOUT` within ~1.5 s, no `data-case`.
- config error: missing `CASE_SIGNING_SECRET` → 500 `{ error: "CONFIG_ERROR" }`.
- logging: spy `console.info`; after the happy path, log lines include `case_completed` with caseId and label, and do not contain the reason text or the token.
Then `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Rules
- Repository root: `/home/labuser/jsystems-ai-programming-2026-11/.claude/worktrees/skills-lock`; npm commands in `app/`. AI SDK `ai@7.0.181` (Context7 `/vercel/ai` + installed types); never v5/v6 names (`system:` key, `onFinish`, `generateObject`, `stepCountIs`, `fullStream`, `type: "image"`). Next 16 route handlers: read `node_modules/next/dist/docs/` (search "route handler") if unsure.
- No `any`, no type assertions (`as`, `as const`).
- Edit only the listed files. Never `npm install`, never touch `package.json`, lockfile, configs, `src/lib/*`, `src/components/*`, `page.tsx`, captures, docs. `curl`, `wget`, `sudo` denied. No real network calls; do not start servers. If you create a file by mistake, report it — do not try `rm`.
- Concurrent work (do not edit): T14 `app/src/app/api/chat/route.ts`, `app/tests/integration/api/chat.test.ts`. T14 will import your `tests/helpers/ui-stream.ts` — write it first and keep its API stable: `export async function readUiStream(response: Response): Promise<UiChunk[]>` where `UiChunk = { type: string } & Record<string, unknown>` (parsed with a Zod `z.object({ type: z.string() }).passthrough()` or `z.looseObject`).
- List any derived capture variant (source, edit/delay, reason) in your report; the orchestrator adds it to the captures README.
- Report contradictions instead of guessing. Do not commit.

## Report
Files; red run reason; final `npm run test` (counts, skips), `typecheck`, `lint`, `build`; derived variants; assumptions/contradictions.
