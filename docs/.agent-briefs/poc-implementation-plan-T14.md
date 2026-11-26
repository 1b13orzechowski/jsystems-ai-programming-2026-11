# Brief T14 — `POST /api/chat` token-verified streaming route

## Goal and observable outcome
`POST /api/chat` accepts `{ id, messages, caseToken, trigger }`, rejects a missing/invalid/expired token with 401 **before any LLM call**, rejects invalid messages with 400, and otherwise streams the chat agent's reply as an AI SDK UI message stream for `useChat`; a failure mid-stream yields an error chunk with only the code `CHAT_FAILED` (AC-22…AC-28, ADR-003 §3–§5, A-04, TAC-003-03).

## Editable files
- `app/src/app/api/chat/route.ts`
- `app/tests/integration/api/chat.test.ts`

## Inputs (read only)
`@/lib/env` (`getEnv`, `EnvError`), `@/lib/server/request-guards` (`checkContentLength`, `CHAT_BODY_LIMIT_BYTES`, `failureResponse`), `@/lib/server/log` (`logEvent`), `@/lib/security/case-token` (`verifyCaseToken`, `createCaseTokenPayload`, `signCaseToken` for tests), `@/lib/ai/chat-agent` (`prepareChatMessages`, `createChatStream` — async in AI SDK 7), `@/lib/ai/models` (`getModels`, `setModelsForTesting`, `createModels`), `@/lib/domain/schemas`. Test helpers: `app/tests/helpers/replay-fetch.ts`; `app/tests/helpers/ui-stream.ts` (`readUiStream(response)` → parsed SSE chunks) is being written concurrently by T13 — if it does not exist yet when you need it, wait/poll for it rather than creating it; if it is still missing at the end, inline an equivalent private helper in your test file and report it. Captures `chat-text.json`, `chat-tool.json`, `error-401-invalid-key.json` (+ README). `app/tests/integration/ai/chat-agent.test.ts` shows how a valid `CaseTokenPayload` is built from the capture inputs. Docs: `docs/ADR/003-api-routes.md` §3, §4 (`POST /api/chat` request), §5, §8, A-04.

## Specification
- `export const maxDuration = 60;` and only `POST` (Node runtime).
- `getEnv()` in try/catch → 500 `{ error: "CONFIG_ERROR" }`.
- `checkContentLength(request, CHAT_BODY_LIMIT_BYTES)` → 413; read `await request.text()`; if its UTF-8 byte length > 256 KB → 413; `JSON.parse` in try/catch → 400 `{ error: "INVALID_MESSAGES" }`; validate the envelope with Zod: `id` string, `caseToken` string ≤ 16 384 chars, `trigger` optional enum `submit-message | regenerate-message`, `messages` unknown → envelope failure: missing/oversized token → 401 `{ error: "INVALID_CASE_TOKEN" }`, other envelope errors → 400 `INVALID_MESSAGES`.
- `verifyCaseToken(caseToken, env.caseSigningSecret, new Date())` → any failure → 401 `{ error: "INVALID_CASE_TOKEN" }` (no LLM call; log `chat_rejected` with `code`).
- `prepareChatMessages(body.messages)` → failure → 400 `{ error: "INVALID_MESSAGES" }`.
- `result = await createChatStream({ payload, messages, models: getModels(), signal: request.signal })`; return `createUIMessageStreamResponse({ stream: <the result's UI message stream with onError: () => "CHAT_FAILED">, headers: { "Cache-Control": "no-store" } })` — or `result.toUIMessageStreamResponse({ onError, headers })` if that is the AI SDK 7 equivalent; check Context7 `/vercel/ai` and the installed types for the exact method names and that `onError` returns the error text. Original messages for `useChat` should be passed so the UI keeps message ids consistent (check the SDK option, e.g. `originalMessages`).
- All JSON error responses carry `Cache-Control: no-store`. Logging only via `logEvent` (`chat_received` with messageCount, `chat_completed`, `chat_failed` with errorName, `chat_rejected` with code) — never message text or token.

## TDD (integration project, node environment; write first — red because the route is missing)
Env via `vi.stubEnv` before a dynamic import of the route (or `vi.resetModules()`), synthetic secret `Buffer.alloc(32, 5).toString("base64")`. Models: `setModelsForTesting(createModels({...}, { fetch: replay.fetch }))` with `replayFetch(...)`; assert `replay.requests.length` for "no LLM call". Build a valid token with `signCaseToken(createCaseTokenPayload({...capture-derived payload...}, now), secret)`. Request body like `useChat`'s `DefaultChatTransport`: `{ id, messages: [firstAssistantMessage, { id, role: "user", parts: [{ type: "text", text: "Jaki model zgłosiłem?" }] }], caseToken, trigger: "submit-message" }`.
Rows from ADR-003 §8 and TAC-003-03:
- valid: replay `chat-text` → 200, `Cache-Control: no-store`, chunks include `text-delta`s whose concatenation equals the capture's `sdkResult.text`, then `finish`; one replay request.
- tool: replay `chat-tool` → chunks include a `tool-input-available` (or the AI SDK 7 equivalent) for `issueUpdatedDecision` and a `tool-output-available` whose output is a `Decision` with `kind: "updated"` and the disclaimer.
- `regenerate-message` trigger with the last message being the user message works the same.
- bad token: payload part changed by one character, signature changed by one character, wrong secret, expired (issued 3 h ago), missing token → 401 `INVALID_CASE_TOKEN` and **zero** replay requests.
- message rules: user text 2001 chars, whitespace-only text, a `file` part, 41 messages → 400 `INVALID_MESSAGES`, zero replay requests; a `system` message in the history is dropped and the request still succeeds.
- provider failure: replay `error-401-invalid-key` → 200 stream with an error chunk whose `errorText` is exactly `CHAT_FAILED`, no provider text in the body.
- 413 for a body over 256 KB.
Then `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Rules
- Repository root: `/home/labuser/jsystems-ai-programming-2026-11/.claude/worktrees/skills-lock`; npm commands in `app/`. AI SDK `ai@7.0.181` (Context7 `/vercel/ai` + installed types); never v5/v6 names (`system:` key, `onFinish`, `generateObject`, `stepCountIs`, `fullStream`, `type: "image"`).
- No `any`, no type assertions (`as`, `as const`).
- Edit only the listed files. Never `npm install`, never touch `package.json`, lockfile, configs, `src/lib/*`, `src/components/*`, `page.tsx`, captures, docs. `curl`, `wget`, `sudo` denied. No real network calls; do not start servers. If you create a file by mistake, report it — do not try `rm`.
- Concurrent work (do not edit): T13 `app/src/app/api/case/route.ts`, `app/tests/integration/api/case.test.ts`, `app/tests/helpers/ui-stream.ts`.
- List any derived capture variant in your report; the orchestrator adds it to the captures README.
- Report contradictions instead of guessing. Do not commit.

## Report
Files; red run reason; final `npm run test` (counts, skips), `typecheck`, `lint`, `build`; derived variants; assumptions/contradictions.
