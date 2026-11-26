# Brief T08 — Signed case token

## Goal and observable outcome
A stateless, tamper-evident case token (HMAC-SHA256) that carries the case context from `/api/case` to `/api/chat`. Any changed byte, wrong secret, expired token or unsupported version is rejected with a typed reason.

## Editable files
- `app/src/lib/security/case-token.ts`
- `app/tests/unit/security/case-token.test.ts`

## Specification
ADR-003 §4 `CaseToken`: payload `{ v: 1, caseId, input (no photo), analysis, decision, window, issuedAt, expiresAt }` → JSON → base64url; signature = HMAC-SHA256(secret, payloadB64) → base64url; token = `payloadB64 + "." + signatureB64`. Expiry 2 hours. The payload is readable by the client (not encrypted).
ADR-003 §3: `verifyCaseToken(token, now)` → payload or typed failure (malformed, bad_signature, expired, unsupported_version). Uses `timingSafeEqual`.
TAC-003-03: any token whose payload or signature differs by one byte, or whose `expiresAt` is past, is rejected.
Use `CaseTokenPayload`, `CaseTokenPayloadSchema`, `CASE_TOKEN_VERSION`, `CASE_TOKEN_TTL_MS` from `@/lib/domain/schemas` (times are epoch milliseconds). Use `node:crypto` (`createHmac`, `timingSafeEqual`) and `Buffer.from(..., "base64url")`.

Required API (`import "server-only";` first; the secret is passed in so the module stays pure — routes pass `getEnv().caseSigningSecret`):
```ts
export type CaseTokenFailure = "malformed" | "bad_signature" | "expired" | "unsupported_version";
export type VerifyResult = { ok: true; payload: CaseTokenPayload } | { ok: false; reason: CaseTokenFailure };
export function createCaseTokenPayload(args: Omit<CaseTokenPayload, "v" | "issuedAt" | "expiresAt">, now: Date): CaseTokenPayload; // v=1, issuedAt=now, expiresAt=now+2h
export function signCaseToken(payload: CaseTokenPayload, secret: string): string;
export function verifyCaseToken(token: string, secret: string, now: Date): VerifyResult;
```
Verification order: split on exactly one `.` (else malformed) → recompute HMAC over the payload part and compare with `timingSafeEqual` after checking equal lengths (else bad_signature) → decode base64url + `JSON.parse` in try/catch (else malformed) → if `v !== 1` → unsupported_version → parse with `CaseTokenPayloadSchema` (else malformed) → `now.getTime() >= expiresAt` → expired. Tokens over 16 KB → malformed (ADR-003 §4 limit).

## TDD cases (write first; they fail because the module is missing)
Build a synthetic valid payload in the test (UUID from `crypto.randomUUID()`, a valid `CaseInput`, `ImageAnalysis`, `Decision` with `disclaimerPl: DECISION_DISCLAIMER_PL`, `PolicyWindow`) and a synthetic secret `Buffer.alloc(32, 9).toString("base64")`.
- round-trip: sign then verify → ok with a deep-equal payload; the token has exactly one `.` and only base64url characters.
- one-byte change in the payload part (flip one character) → bad_signature; one-byte change in the signature part → bad_signature.
- wrong secret → bad_signature.
- expired: verify at `issuedAt + 2h` → expired; at `issuedAt + 2h - 1 ms` → ok.
- `v: 2` payload signed with the right secret (build it by hand: base64url JSON + HMAC in the test) → unsupported_version.
- garbage inputs: `""`, `"abc"`, `"a.b.c"`, a correctly signed non-JSON payload → malformed; a token longer than 16384 characters → malformed.
Then: `npm run test`, `npm run typecheck`, `npm run lint`.

## Rules (all workers)
- Repository root: `/home/labuser/jsystems-ai-programming-2026-11/.claude/worktrees/skills-lock`; run npm commands inside `app/`. Stack: Next.js 16, TypeScript strict (`noUncheckedIndexedAccess`), Zod 4.6.7, Vitest 5 (`unit` project = jsdom, `tests/unit/**`; `integration` = node). Network is blocked in tests.
- Shared contracts are read-only for you: `app/src/lib/domain/{schemas,categories,copy-pl,errors}.ts`. Import types from there; if you need a change, report it.
- Library facts: Context7 first (`resolve-library-id` → `query-docs`); CLI facts: `--help`. Never guess APIs.
- TDD: write the behavioral tests first, run them, record the failure reason, then implement the minimum, then run the full checks.
- No `any`, no type assertions (`as`, including `as const`) — ESLint enforces it. Use Zod parsing, type guards, `satisfies`.
- Server-only modules start with `import "server-only";` and tests mock it with `vi.mock("server-only", () => ({}));`. If `node:crypto`/`Buffer` behave oddly in jsdom, add `// @vitest-environment node` at the top of your test file.
- Edit only the files listed in your brief. Never `npm install`, never touch `package.json`, the lockfile, configs, `globals.css`, `layout.tsx`, `page.tsx`, docs. `curl`, `wget`, `sudo` are denied.
- Report contradictions instead of guessing. Do not commit; the orchestrator reviews and commits.
- Concurrent workers (do not edit their files): T03 `app/src/app/layout.tsx`, `globals.css`, `app/src/fonts/*`, `app/public/*`, `app/tests/e2e/smoke.spec.ts`; T05 `app/src/lib/domain/policy-window.ts` + test; T06 `app/content/policies/*`, `app/src/lib/ai/policies.ts` + test; T09 `app/src/lib/image/downscale.ts` + test. Other workers' tests may be red while they work; judge only your own files, but report full-suite results.

## Report
Files changed; the red run and its failure reason; final outputs of `npm run test` (files/tests counts, skips), `npm run typecheck`, `npm run lint`; assumptions and contradictions.
