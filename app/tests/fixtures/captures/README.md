# Captures

Real recorded responses used to derive unit/integration mocks (AGENTS.md mock rule, ADR-000 §10). Nothing here is written by hand.

| Folder | What | Recorded by |
|---|---|---|
| `openrouter/` | Raw OpenRouter HTTP exchanges (analysis, decision, chat text, chat tool call, 401, 400) — see its README | `scripts/capture-openrouter.ts` (T10) |
| `api-case/` | Real `POST /api/case` responses of the production build (`next start`) | `scripts/capture-routes.ts` (T13b) |
| `api-chat/` | Real `POST /api/chat` responses, using the token from `api-case/success-reklamacja-laptop-1.json` | `scripts/capture-routes.ts --chat` (T14b) |

## `api-case/` and `api-chat/` (recorded 2026-11-26)

Setup (from `app/`, after `npm run build`): primary instance `npx next start -p 3000` with the real `.env.local`; failure instance `OPENROUTER_API_KEY=invalid-capture-key npx next start -p 3001` (same build, same `CASE_SIGNING_SECRET`). Requests are sent with Node `fetch` (`curl` is denied by project settings). Photos are the real `phone-1.jpg` and `laptop-1.png`, downscaled in headless Chromium with the client rules (JPEG, longest edge ≤ 1568 px, quality 0.82). Each file stores the request description, status, response headers (without `set-cookie`/`date`), the raw body (SSE text or JSON), date, duration and the commit SHA of the build.

| File | Request | Status | Body |
|---|---|---|---|
| `api-case/success-zwrot-phone-1.json` | zwrot, Smartfon, "Galaxy S30", purchase today−3, `phone-1.jpg` | 200 | `data-stage` analyzing → deciding → `data-case` |
| `api-case/success-reklamacja-laptop-1.json` | reklamacja, Laptop, "ThinkBook 14", purchase today−330, reason, `laptop-1.png` | 200 | same sequence |
| `api-case/validation-400.json` | empty model | 400 | `{"error":"VALIDATION_FAILED","fields":["model"]}` |
| `api-case/unsupported-media-415.json` | JSON body | 415 | `{"error":"UNSUPPORTED_MEDIA_TYPE"}` |
| `api-case/processing-failed-invalid-key.json` | valid zwrot on port 3001 | 200 | `data-stage` analyzing → `error` `PROCESSING_FAILED` |
| `api-chat/plain-answer.json` | "Jaki model zgłosiłem?" | 200 | text stream naming the model |
| `api-chat/updated-decision.json` | new information (the laptop fell) | 200 | `tool-input-*` + `tool-output-available` (`issueUpdatedDecision`, guardrailed `Decision`) + text |
| `api-chat/invalid-token-401.json` | token with one payload character changed | 401 | `{"error":"INVALID_CASE_TOKEN"}` |
| `api-chat/chat-failed-invalid-key.json` | valid token on port 3001 | 200 | `error` `CHAT_FAILED` |

The tokens inside these files are signed with the local development `CASE_SIGNING_SECRET` and expire 2 hours after recording; client tests replay the stream text and never verify them. Re-record (both scripts) whenever a route contract, prompt or schema changes.

## Derived variants
Listed in `openrouter/README.md` for LLM captures. Route-capture variants used by client tests (a delay or a minimal edit) are listed here with source file, edit and reason.

| Source file | Derivation | Reason | Test |
|---|---|---|---|
| `api-case/success-zwrot-phone-1.json` | In-test cut: body truncated before the first `data-case` line (the `[DONE]` line is removed too) | Stream ends without a result → `PROCESSING_FAILED` (ADR-004 §3.2 step 4) | `tests/unit/client/submit-case.test.ts` "returns PROCESSING_FAILED when the stream ends before data-case" |
| `api-case/success-zwrot-phone-1.json` | In-test delay: the body is enqueued only after 1000 ms and errors on the abort signal; `timeoutMs: 50` | Client 60 s timer aborts the request → `TIMEOUT` (AC-13) | `tests/unit/client/submit-case.test.ts` "aborts the request after timeoutMs and returns TIMEOUT" |
