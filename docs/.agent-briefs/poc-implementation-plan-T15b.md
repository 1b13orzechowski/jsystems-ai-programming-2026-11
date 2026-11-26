# Brief T15b — `submitCase` client stream reader

## Goal and observable outcome
A browser function that sends the validated case and the downscaled JPEG to `POST /api/case`, reports the real stage progress (`analyzing` → `deciding`, AC-12), and resolves with the case result or a machine error code; a 60 s client timer aborts the request (AC-13). Only one call runs at a time — the caller guarantees it (AC-09).

## Editable files
- `app/src/lib/client/submit-case.ts`
- `app/tests/unit/client/submit-case.test.ts`
- `app/tests/fixtures/captures/README.md` — only the "Derived variants" table at the end (one row per delay/edit you introduce)

## Inputs (read only)
- `app/src/lib/domain/schemas.ts` (`CaseInput`, `CaseResult`, `CaseStreamMessage`, `DecisionSchema`, `StageDataSchema`), `app/src/lib/domain/errors.ts` (`CaseErrorCode`), `app/src/components/case-form/types.ts` (`SelectedPhoto`).
- Real route captures in `app/tests/fixtures/captures/api-case/` (+ `app/tests/fixtures/captures/README.md`): `success-zwrot-phone-1.json`, `success-reklamacja-laptop-1.json`, `validation-400.json`, `unsupported-media-415.json`, `processing-failed-invalid-key.json` — each has `response.status`, `response.headers`, `response.body` (raw SSE text or JSON).
- `docs/ADR/004-frontend.md` §3.2, §8; `docs/ADR/003-api-routes.md` §4.

## Specification (ADR-004 §3.2)
```ts
export const CLIENT_TIMEOUT_MS = 60_000;
export type SubmitCaseResult = { ok: true; result: CaseResult } | { ok: false; code: CaseErrorCode | "NETWORK_ERROR" };
export async function submitCase(args: {
  input: CaseInput;
  photo: Pick<SelectedPhoto, "jpegBlob" | "name">;
  onStage: (stage: "analyzing" | "deciding") => void;
  fetchImpl?: typeof fetch;   // default globalThis.fetch (injected in tests)
  timeoutMs?: number;         // default CLIENT_TIMEOUT_MS
}): Promise<SubmitCaseResult>;
```
- Build `FormData`: `caseType`, `category`, `model`, `purchaseDate`, `reason`, `photo` (the JPEG blob as a `File` named after `photo.name` with type `image/jpeg`), `photoName`.
- `AbortController` + `setTimeout(timeoutMs)`; on timeout → `{ ok: false, code: "TIMEOUT" }`. Always clear the timer.
- `fetch("/api/case", { method: "POST", body, signal })`; network failure (fetch rejects, e.g. offline) → `NETWORK_ERROR`; HTTP ≥ 400 → read JSON `{ error }` and map it to a known `CaseErrorCode` (fallback `PROCESSING_FAILED`).
- Read the body as an AI SDK UI message stream (AI SDK 7: find the supported reader — e.g. `parseJsonEventStream` with `uiMessageChunkSchema`, or `readUIMessageStream` — via Context7 `/vercel/ai` "read UI message stream without useChat" and the installed `ai` types). Handle chunks: `data-stage` → `onStage(data.stage)` (validate with `StageDataSchema`); `data-case` → validate the payload with Zod (`caseId` uuid, `caseToken` string, `decision` with `DecisionSchema`, `analysisSummaryPl` string, `firstMessage` with id/role/parts) and keep it; `error` chunk → its `errorText` as the code (`TIMEOUT` or `PROCESSING_FAILED`); end of stream without `data-case` → `PROCESSING_FAILED`.
- No browser storage. No imports from `@/lib/ai`, `@/lib/security`, `@/lib/server`, `@/lib/env`.

## TDD (unit project; write first — red because the module is missing)
`fetchImpl` returns `new Response(capture.response.body, { status, headers })` built from the real capture files (read with `node:fs`; name the capture in each test). Replaying the SSE text verbatim:
- success zwrot and reklamacja → `onStage` called with `analyzing` then `deciding` (in order), result `ok` with the capture's `data-case` content.
- 400 validation capture → `{ ok: false, code: "VALIDATION_FAILED" }`; 415 capture → `UNSUPPORTED_MEDIA_TYPE`.
- invalid-key stream capture → `onStage("analyzing")` then `{ ok: false, code: "PROCESSING_FAILED" }`.
- truncated stream (derived variant: the success capture with everything from the `data-case` line on removed — list it in the README table) → `PROCESSING_FAILED`.
- client timeout (derived variant: the success capture delayed — the fake fetch waits on the abort signal and never answers within `timeoutMs`) with `timeoutMs: 50` → `TIMEOUT`, and the fetch received an aborted signal.
- fetch rejects with `TypeError("Failed to fetch")` → `NETWORK_ERROR`.
- TAC-004-02 request assertion: the `FormData` sent contains a `photo` `File` with type `image/jpeg` and size ≤ 1.5 MB (use a real downscaled JPEG: the bytes of `assets/example-images/phone-1.jpg`, 107 KB) and the six text fields.
Then `npm run test`, `npm run typecheck`, `npm run lint`.

## Rules
- Repository root: `/home/labuser/jsystems-ai-programming-2026-11/.claude/worktrees/skills-lock`; npm commands in `app/`. AI SDK `ai@7.0.181` (Context7 `/vercel/ai` + installed types); never v5/v6 names.
- No `any`, no type assertions (`as`, `as const`).
- Edit only the listed files. Never `npm install`, never touch `package.json`, lockfile, configs, components, `page.tsx`, other captures, docs. `curl`, `wget`, `sudo` denied. Do not start servers. If you create a file by mistake, report it — do not try `rm`.
- Concurrent work (do not edit): T16b `app/src/components/decision-chat/chat-panel.tsx`, `app/tests/unit/decision-chat/chat-panel.test.tsx`.
- Report contradictions instead of guessing. Do not commit.

## Report
Files; red run reason; final `npm run test` (counts, skips), `typecheck`, `lint`; derived variants; assumptions/contradictions.
