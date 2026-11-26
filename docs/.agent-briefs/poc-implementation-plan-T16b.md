# Brief T16b — `ChatPanel` with `useChat` and the real chat transport

## Goal and observable outcome
`ChatPanel` connects the presentational chat components (T16a) to `POST /api/chat` with `useChat` from `@ai-sdk/react` and `DefaultChatTransport`, sending `{ id, messages, caseToken, trigger }`, streaming replies progressively (AC-23), rendering updated decisions from the tool (AC-25), and offering retry on failure with the user message kept (AC-28).

## Editable files
- `app/src/components/decision-chat/chat-panel.tsx`
- `app/tests/unit/decision-chat/chat-panel.test.tsx`

## Inputs (read only)
- T16a components in `app/src/components/decision-chat/`: `ChatMessages({ messages, status, error, onRetry })`, `ChatInput({ disabled, onSend })` — read their props before wiring.
- `app/src/lib/domain/schemas.ts` (`ChatUIMessage`, `DecisionSchema`, `UpdatedDecisionInputSchema`), `app/src/lib/domain/copy-pl.ts`.
- Real route captures `app/tests/fixtures/captures/api-chat/` (`plain-answer.json`, `updated-decision.json`, `chat-failed-invalid-key.json`, `invalid-token-401.json`) and `api-case/success-reklamacja-laptop-1.json` (its `data-case` part holds the `firstMessage`, `caseId` and `caseToken` the chat captures were made with) + `app/tests/fixtures/captures/README.md`.
- `docs/ADR/004-frontend.md` §3.3; `docs/ADR/003-api-routes.md` §4 (`POST /api/chat`).

## Specification (ADR-004 §3.3)
```tsx
export function ChatPanel(props: { caseId: string; caseToken: string; firstMessage: ChatUIMessage; fetchImpl?: typeof fetch }): JSX.Element;
```
- `"use client"`. `useChat<ChatUIMessage>({ id: caseId, messages: [firstMessage], transport: new DefaultChatTransport({ api: "/api/chat", fetch: fetchImpl, prepareSendMessagesRequest }) , dataPartSchemas: { decision: DecisionSchema } })` — check the exact AI SDK 7 / `@ai-sdk/react@4` option names (data part schemas, typed tools) with Context7 `/vercel/ai` ("useChat", "DefaultChatTransport prepareSendMessagesRequest", "dataPartSchemas") and the installed types. Create the transport once (`useMemo`/`useState`) so it is not rebuilt each render.
- `prepareSendMessagesRequest({ id, messages, trigger })` → `{ body: { id, messages, caseToken, trigger } }` with `caseToken` from props (never from a hidden input).
- Sending: `sendMessage({ text })` only when `status === "ready"` (and after an error, the retry path). `ChatInput disabled` while `status` is `submitted` or `streaming`.
- Errors: when `error` is set, `ChatMessages` shows `ChatError`; `onRetry` → `regenerate()`. The user message stays (AC-28).
- Layout: the panel fills the available height; `ChatMessages` scrolls, `ChatInput` stays at the bottom.

## TDD (unit project, RTL + user-event; write first — red because the component is missing)
`fetchImpl` returns `new Response(capture.response.body, { status: capture.response.status, headers: capture.response.headers })` from the real capture files (read with `node:fs`; name the capture in each test); also record the request body it received.
- renders the first message (decision card from the `data-decision` part of the `firstMessage` in `success-reklamacja-laptop-1.json`).
- send "Jaki model zgłosiłem?" → the request body has `id === caseId`, `caseToken` from props, `trigger: "submit-message"`, messages = first message + the user message; the reply text from `plain-answer.json` appears; the input is disabled while streaming and enabled after `finish` (a replay with a small delay between chunks is a derived variant — only add it if needed, and list it in your report).
- `updated-decision.json` → an updated decision card (`data-decision-kind="updated"`, `COPY.decision.updatedTitle`) and the follow-up text.
- `chat-failed-invalid-key.json` → `COPY.chat.error` with `COPY.chat.retry`, user message still visible; clicking retry calls `fetchImpl` again with `trigger: "regenerate-message"` (second response: `plain-answer.json`) and the reply appears.
- `invalid-token-401.json` (HTTP 401 JSON) → error state shown, user message kept.
- whitespace-only input is not sent (no fetch call).
Then `npm run test`, `npm run typecheck`, `npm run lint`.

## Rules
- Repository root: `/home/labuser/jsystems-ai-programming-2026-11/.claude/worktrees/skills-lock`; npm commands in `app/`. `@ai-sdk/react@4.0.186`, `ai@7.0.181` — Context7 `/vercel/ai` + installed types; never v5/v6 names (`onFinish` etc. — a guard test scans `src/`).
- No `any`, no type assertions (`as`, `as const`). No letter-containing literals in JSX text or `aria-*`/`alt`/`placeholder`/`title` (use `COPY`). No browser storage. No imports from `@/lib/ai`, `@/lib/security`, `@/lib/server`, `@/lib/env`.
- Edit only the listed files. Do not modify T16a components; if one needs a change, report it. Never `npm install`, never touch `package.json`, lockfile, configs, `page.tsx`, captures, docs. `curl`, `wget`, `sudo` denied. Do not start servers. If you create a file by mistake, report it — do not try `rm`.
- Concurrent work (do not edit): T15b `app/src/lib/client/submit-case.ts`, its test, and the captures README.
- List any derived capture variant in your report; the orchestrator adds it to the README.
- Report contradictions instead of guessing. Do not commit.

## Report
Files; red run reason; final `npm run test` (counts, skips), `typecheck`, `lint`; derived variants; assumptions/contradictions.
