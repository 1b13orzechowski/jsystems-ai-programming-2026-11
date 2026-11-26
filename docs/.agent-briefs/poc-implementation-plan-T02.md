# Brief T02 — Env validation and repository guard tests

Repository root: `/home/labuser/jsystems-ai-programming-2026-11/.claude/worktrees/skills-lock`. App: `app/` (Next.js 16, TypeScript strict, Vitest 5, Zod 4.6.7). Run all npm commands inside `app/`.

## Goal and observable outcome
1. `app/src/lib/env.ts`: a server-only module that reads `process.env`, validates it with Zod once, and exports a typed config. Missing/invalid required variables throw an error that names the variable but never prints its value.
2. Guard tests that scan `app/src/` and fail when forbidden code appears.

## Editable files (only these)
- `app/src/lib/env.ts`
- `app/tests/unit/env.test.ts`
- `app/tests/unit/guards/ai-sdk-names.test.ts`
- `app/tests/unit/guards/browser-storage.test.ts`
- `app/tests/unit/guards/polish-literals.test.ts`

Do not touch `package.json`, the lockfile, configs, `src/app/*`, `src/components/*`, docs. Do not run `npm install`. If you need a change elsewhere, report it.

Concurrent work: another worker edits `app/src/app/layout.tsx`, `app/src/app/globals.css`, `app/src/fonts/*`, `app/public/*`, `app/tests/e2e/smoke.spec.ts`; the orchestrator edits `app/src/lib/domain/*` and `app/tests/unit/domain/*`. Do not edit those.

## Specification excerpts

ADR-000 §7 environment variables:

| Variable | Required | Rule |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | non-empty string |
| `LLM_MODEL` | Yes | non-empty string (e.g. `openai/gpt-6-luna`) |
| `VISION_MODEL`, `DECISION_MODEL`, `CHAT_MODEL` | No | default to `LLM_MODEL` |
| `CASE_SIGNING_SECRET` | Yes | at least 32 bytes when base64-decoded (generated with `openssl rand -base64 32`); reject shorter |
| `APP_TIMEZONE` | No | default `Europe/Warsaw`; must be a valid IANA zone (check with `Intl.DateTimeFormat(undefined, { timeZone })` in try/catch) |
| `ALLOW_TEST_BUDGET` | No | test-only flag |
| `CASE_BUDGET_MS` | No | test-only |

Empty strings count as unset (ADR-001 §8: "Overrides empty strings treated as unset").

ADR-003 A-05: `/api/case` reads `CASE_BUDGET_MS` only when `ALLOW_TEST_BUDGET=true`. The value must be an integer from 1000 to 55000; it replaces the 55 s total budget (55000). If `CASE_BUDGET_MS` is set without the flag or out of range, it is ignored and the env validator logs **one** warning (`console.warn`) naming the variable (never secret values).

### Required API of `env.ts`
```ts
import "server-only";
export type AppEnv = {
  openRouterApiKey: string;
  models: { vision: string; decision: string; chat: string };
  caseSigningSecret: string;
  appTimezone: string;
  caseBudgetMs: number; // 55000 unless the valid test override applies
};
export const DEFAULT_CASE_BUDGET_MS = 55_000;
export function parseEnv(source: Record<string, string | undefined>): AppEnv; // pure, throws EnvError
export class EnvError extends Error { readonly variables: string[] } // names of invalid/missing vars
export function getEnv(): AppEnv; // memoized parseEnv(process.env)
```
`server-only` throws when imported outside a React Server environment. In Vitest, mock it at the top of `env.test.ts`: `vi.mock("server-only", () => ({}));`.

## Guard tests (scan files under `app/src/` with `node:fs` / `node:path`; resolve paths from `process.cwd()`, which is `app/` when running `npm run test`)
1. `ai-sdk-names.test.ts` (TAC-002-07): no AI SDK v5/v6 names appear in `src/`: `generateObject`, `streamObject`, `stepCountIs`, `fullStream`, `type: 'image'` / `type: "image"`, `system:` as an object key, `onFinish`. Scan `.ts`/`.tsx` under `src/` excluding `src/components/ui/**`. Report offending file and line.
2. `browser-storage.test.ts` (TAC-004-06): no `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie` anywhere in `src/`.
3. `polish-literals.test.ts` (TAC-004-03): in `.tsx` files under `src/app/**` and `src/components/**`, excluding `src/components/ui/**` and `src/components/ai-elements/**`, fail when a JSX text literal (text between `>` and `<` containing a letter) or an `aria-label=`, `alt=`, `placeholder=`, `title=` string literal (`"..."` or `'...'`) contains letters. All such strings must come from `src/lib/domain/copy-pl.ts`. A regex-based scan is acceptable; keep it simple and document its limits in a comment.

Each guard test must also prove it detects a violation: include a test case that runs the scanner function on an in-memory sample string containing the forbidden pattern and expects a hit (so the guard cannot be silently empty).

## TDD steps
1. Write `env.test.ts` first, covering:
   - valid minimal env → models all equal `LLM_MODEL`, timezone `Europe/Warsaw`, budget 55000;
   - per-step model overrides applied;
   - missing `OPENROUTER_API_KEY` → `EnvError` whose message contains `OPENROUTER_API_KEY` and does **not** contain any provided secret value;
   - empty string `OPENROUTER_API_KEY=""` → treated as missing;
   - `CASE_SIGNING_SECRET` decoding to 16 bytes → error naming the variable;
   - invalid `APP_TIMEZONE` → error;
   - `ALLOW_TEST_BUDGET=true`, `CASE_BUDGET_MS=1000` → 1000; `=55000` → 55000;
   - `CASE_BUDGET_MS=1000` without the flag → 55000 and exactly one `console.warn` naming `CASE_BUDGET_MS` (spy with `vi.spyOn(console, "warn")`);
   - flag set, `CASE_BUDGET_MS=999` or `55001` or `abc` → 55000 and one warning.
   Use a synthetic secret such as `Buffer.alloc(32, 7).toString("base64")`. Never use real keys.
2. Run `npm run test -- tests/unit/env.test.ts` and confirm it fails because the module is missing. Record the failure.
3. Implement `env.ts`.
4. Write the guard tests, run them; they must pass on the current code base.
5. Run `npm run test`, `npm run typecheck`, `npm run lint` — all must pass.

## Rules
- Library facts: use Context7 (`resolve-library-id` → `query-docs`) for Zod 4 or Vitest 5 questions; do not guess APIs.
- No `any`, no type assertions (`as`, including `as const`): ESLint enforces this. Use Zod parsing, type guards and `satisfies`.
- Report contradictions instead of guessing. Do not commit; the orchestrator reviews and commits.

## Report
Return: files changed; the red run output (failing reason); the final outputs of `npm run test` (file and test counts), `typecheck`, `lint`; any assumptions or contradictions.
