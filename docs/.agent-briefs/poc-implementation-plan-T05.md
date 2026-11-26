# Brief T05 — Policy window calculation

## Goal and observable outcome
A pure function `computePolicyWindow` that decides whether a case is inside the return (14 days) or complaint (24 months) window, counted in calendar days/months in `APP_TIMEZONE` (default `Europe/Warsaw`). Used later by guardrail G1 (AC-16, AC-17).

## Editable files
- `app/src/lib/domain/policy-window.ts`
- `app/tests/unit/domain/policy-window.test.ts`

## Specification
ADR-002 §4: `PolicyWindow` = `submissionDate` (YYYY-MM-DD), `purchaseDate`, `elapsedDays`, `elapsedMonths`, `limitUnit` (days | months), `limitValue` (14 | 24), `withinWindow`. Use the exported type `PolicyWindow` and `PolicyWindowSchema` from `@/lib/domain/schemas` (the result must parse with it).
Window rule: return (`zwrot`) within window iff `elapsedDays ≤ 14` (purchase day = day 0). Complaint (`reklamacja`) within window iff the purchase date plus 24 calendar months is on or after the submission date. Adding months to a day that does not exist in the target month clamps to that month's last day (2024-02-29 + 24 months = 2026-02-28; 2024-08-31 + 24 months = 2026-08-31).
`elapsedMonths` = number of whole calendar months from purchase date to submission date (same clamping rule: the month counts once `purchase + n months ≤ submission`).
"Today" (`submissionDate`) is the calendar date of `now` in the given IANA time zone (use `Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })`, which formats as `YYYY-MM-DD`). Do date arithmetic on calendar dates (e.g. `Date.UTC` day numbers), never on local time, so DST does not shift days.

Required API:
```ts
export function todayInTimeZone(now: Date, timeZone: string): string; // YYYY-MM-DD
export function computePolicyWindow(args: {
  caseType: CaseType; // from @/lib/domain/categories
  purchaseDate: string; // YYYY-MM-DD, already validated
  now: Date;
  timeZone: string;
}): PolicyWindow;
```

## TDD cases (write first, see them fail because the module is missing)
- zwrot: purchase 2026-11-12, today 2026-11-26 → elapsedDays 14, within; purchase 2026-11-11 → 15, outside; same day → 0, within.
- reklamacja: purchase 2024-11-26, today 2026-11-26 → elapsedMonths 24, within; purchase 2024-11-25 → outside (24 months + 1 day); purchase 2025-11-26 → 12 months, within.
- 29 Feb: purchase 2024-02-29; today 2026-02-28 → within; today 2026-03-01 → outside.
- month end: purchase 2024-08-31; today 2026-08-31 → within; 2026-09-01 → outside.
- Warsaw midnight: `now = new Date("2026-11-25T23:30:00Z")` with `Europe/Warsaw` → submissionDate `2026-11-26`; the same instant with `UTC` → `2026-11-25`.
- DST: purchase 2026-03-20, now `2026-04-03T10:00:00Z` (Warsaw switched to summer time on 2026-03-29) → elapsedDays 14, within.
- result parses with `PolicyWindowSchema`; limitUnit/limitValue are days/14 for zwrot and months/24 for reklamacja.
Then: `npm run test`, `npm run typecheck`, `npm run lint`.

## Rules (all workers)
- Repository root: `/home/labuser/jsystems-ai-programming-2026-11/.claude/worktrees/skills-lock`; run npm commands inside `app/`. Stack: Next.js 16, TypeScript strict (`noUncheckedIndexedAccess`), Zod 4.6.7, Vitest 5 (`unit` project = jsdom, `tests/unit/**`; `integration` = node). Network is blocked in tests.
- Shared contracts are read-only for you: `app/src/lib/domain/{schemas,categories,copy-pl,errors}.ts`. Import types from there; if you need a change, report it.
- Library facts: Context7 first (`resolve-library-id` → `query-docs`); CLI facts: `--help`. Never guess APIs.
- TDD: write the behavioral tests first, run them, record the failure reason, then implement the minimum, then run the full checks.
- No `any`, no type assertions (`as`, including `as const`) — ESLint enforces it. Use Zod parsing, type guards, `satisfies`. To build a literal tuple use `literalTuple(...)` from `@/lib/domain/categories`.
- Edit only the files listed in your brief. Never `npm install`, never touch `package.json`, the lockfile, configs, `globals.css`, `layout.tsx`, `page.tsx`, docs. `curl`, `wget`, `sudo` are denied.
- Report contradictions instead of guessing. Do not commit; the orchestrator reviews and commits.
- Concurrent workers (do not edit their files): T03 `app/src/app/layout.tsx`, `globals.css`, `app/src/fonts/*`, `app/public/*`, `app/tests/e2e/smoke.spec.ts`; T06 `app/content/policies/*`, `app/src/lib/ai/policies.ts`, `app/tests/unit/ai/policies.test.ts`; T08 `app/src/lib/security/case-token.ts`, `app/tests/unit/security/case-token.test.ts`; T09 `app/src/lib/image/downscale.ts`, `app/tests/unit/image/downscale.test.ts`. Other workers' tests may be red while they work; judge only your own files, but report full-suite results.

## Report
Files changed; the red run and its failure reason; final outputs of `npm run test` (files/tests counts, skips), `npm run typecheck`, `npm run lint`; assumptions and contradictions.
