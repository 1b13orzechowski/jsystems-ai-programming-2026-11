# Brief T13a — Request guards and allow-listed logging (part of T13 that needs no captures)

T13 is split while the OpenRouter key is being fixed: this part builds the server helpers both routes use. The `/api/case` route itself (integration tests replay real OpenRouter captures) follows in T13b-route.

## Goal and observable outcome
Server-only helpers that reject oversized, wrongly typed or invalid `/api/case` requests with the ADR-003 codes before any LLM call, and a logger that can only ever write allow-listed fields (no customer text, tokens, photos or secrets).

## Editable files
- `app/src/lib/server/request-guards.ts`
- `app/src/lib/server/log.ts`
- `app/tests/unit/server/request-guards.test.ts`
- `app/tests/unit/server/log.test.ts`

## Specification (ADR-003 §3, §4, §5)
`POST /api/case` request is `multipart/form-data` with fields `caseType`, `category`, `model`, `purchaseDate`, `reason`, `photo` (file: `image/jpeg`, starts with bytes `FF D8 FF`, size ≤ 2 MB — the client sends ≤ 1.5 MB), `photoName` (≤ 200 chars, display only). The server rejects requests whose `Content-Length` exceeds 2.2 MB before parsing (413 `PAYLOAD_TOO_LARGE`). Wrong content type → 415 `UNSUPPORTED_MEDIA_TYPE`; photo not JPEG (type or magic bytes) → 415; photo > 2 MB → 413; field validation failures → 400 JSON `{ error: "VALIDATION_FAILED", fields: [names] }`. `/api/chat` body limit 256 KB → 413.
Use `createCaseInputSchema({ today })` from `@/lib/domain/schemas` for field validation (`today` passed in by the caller — computed with `todayInTimeZone(now, env.appTimezone)`).

Required API (`import "server-only";` at the top of both files):
```ts
export const CASE_BODY_LIMIT_BYTES = 2.2 * 1024 * 1024;
export const CASE_PHOTO_LIMIT_BYTES = 2 * 1024 * 1024;
export const CHAT_BODY_LIMIT_BYTES = 256 * 1024;
export type GuardFailure = { status: 400 | 413 | 415; code: "VALIDATION_FAILED" | "PAYLOAD_TOO_LARGE" | "UNSUPPORTED_MEDIA_TYPE"; fields?: string[] };
export function checkContentLength(request: Request, limitBytes: number): GuardFailure | null; // missing header → null (the body read is still bounded by later checks)
export function isMultipart(request: Request): boolean;
export function isJpegBytes(bytes: Uint8Array): boolean; // FF D8 FF
export type ParsedCase = { input: CaseInput; photo: Uint8Array; photoName: string };
export async function parseCaseRequest(request: Request, today: string): Promise<{ ok: true; value: ParsedCase } | { ok: false; failure: GuardFailure }>;
export function failureResponse(failure: GuardFailure): Response; // JSON { error: code, fields? } with the status
```
Order in `parseCaseRequest`: content length → multipart → `request.formData()` (catch → 400 VALIDATION_FAILED) → photo present and a `File`/`Blob` (missing → 400 with `fields: ["photo"]`) → photo size (413) → photo type `image/jpeg` and magic bytes (415) → fields via the schema (400 with field names from issue paths, unique, in schema order) → `photoName` trimmed, cut to 200 chars (missing → "zdjecie.jpg").

`log.ts`:
```ts
export type LogEvent = "case_received" | "case_stage" | "case_completed" | "case_failed" | "chat_received" | "chat_completed" | "chat_failed" | "chat_rejected";
export type LogFields = Partial<{ caseId: string; caseType: string; category: string; stage: string; label: string; guardrailApplied: string; code: string; status: number; durationMs: number; messageCount: number; errorName: string }>;
export function logEvent(event: LogEvent, fields: LogFields): void; // console.info(JSON.stringify({ ts, event, ...allowed }))
```
Only the keys above are written, even if a caller passes extra keys at runtime (filter by an allow-list, so a test passing `{ reason: "..." }` through an untyped object proves it is dropped). `errorName` is an error class name, never an error message (messages can contain customer text or provider details). Strings are cut to 100 characters.

## Test inputs
Build `Request` objects with real `FormData` in the test. For a valid photo use the bytes of the real photo `assets/example-images/phone-1.jpg` (read with `node:fs` from `join(process.cwd(), "..", "assets", "example-images", "phone-1.jpg")`; it is a real JPEG ≤ 2 MB) wrapped in `new File([bytes], "phone-1.jpg", { type: "image/jpeg" })`. For non-JPEG content use the real `laptop-2.webp` bytes with type `image/webp` (and a variant with type `image/jpeg` to prove the magic-byte check). For the size limit use a `File` whose `size` exceeds 2 MB built from repeated real JPEG bytes (concatenate the photo bytes until > 2 MB; it is only checked by size, never decoded or sent anywhere). Do not generate images. Set `Content-Length` explicitly in tests that check the header.

## TDD (write first; red because modules are missing)
- 413 when Content-Length > 2.2 MB, before `formData()` is called (spy or a body that would throw);
- 415 for `application/json` content type;
- valid request → ok with parsed input, `Uint8Array` photo starting `FF D8 FF`, photoName;
- missing photo → 400 `fields: ["photo"]`; photo > 2 MB → 413; webp type → 415; webp bytes labelled `image/jpeg` → 415;
- invalid fields (empty model, future date, reklamacja with short reason) → 400 with those field names;
- `failureResponse` JSON body and status;
- `logEvent`: writes JSON with `event`, `ts` and allowed fields; drops unknown keys (`reason`, `caseToken`, `message`); truncates long strings; never writes `error.message`.
Use `// @vitest-environment node` at the top of these test files (Request/FormData/File behave like the server there). Mock `server-only` with `vi.mock("server-only", () => ({}));`.
Then `npm run test`, `npm run typecheck`, `npm run lint`.

## Rules
- Repository root: `/home/labuser/jsystems-ai-programming-2026-11/.claude/worktrees/skills-lock`; npm commands in `app/`. Node 24 web APIs (`Request`, `FormData`, `File`).
- Library facts: Context7 first; never guess APIs.
- No `any`, no type assertions (`as`, `as const`). Use type guards (`value instanceof File`).
- Edit only the listed files. Never `npm install`, never touch `package.json`, lockfile, configs, `src/app/*`, `src/components/*`, shared contracts, docs. `curl`, `wget`, `sudo` denied. Do not start servers.
- Concurrent work (do not edit): T15a `app/src/components/case-form/*` + tests; T16a `app/src/components/decision-chat/*` + tests; orchestrator `app/scripts/*`, `app/tests/fixtures/*`, `app/src/lib/ai/*`.
- Report contradictions instead of guessing. Do not commit.

## Report
Files; red run reason; final `npm run test` (counts, skips), `typecheck`, `lint`; assumptions/contradictions.
