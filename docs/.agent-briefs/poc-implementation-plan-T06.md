# Brief T06 — Sample policies and server-only loader

## Goal and observable outcome
Two Polish sample policy documents with stable rule IDs, and a server-only loader that returns the policy text and its set of rule IDs per case type (used by the decision step, the chat agent and guardrail G5).

## Editable files
- `app/content/policies/return-policy.md`
- `app/content/policies/complaint-policy.md`
- `app/src/lib/ai/policies.ts`
- `app/tests/unit/ai/policies.test.ts`

## Specification
ADR-002 §3.6: Write both files in Polish, each rule as a heading `### Z-1 <short title>` / `### R-1 <short title>` followed by 1–3 short sentences. Required minimum content:

| File | Rules |
|---|---|
| `return-policy.md` | Z-1 return window 14 calendar days from purchase date, no reason required, applies to all purchase channels (online and in store); Z-2 item complete with accessories and packaging; Z-3 no signs of use beyond what is needed to check the item; Z-4 no damage; Z-5 how to pack and send (in general terms, no address); Z-6 keep the proof of purchase; Z-7 final assessment after physical inspection; Z-8 options after rejection: complaint path if the item is defective, otherwise no return |
| `complaint-policy.md` | R-1 complaint period 24 months from purchase date; R-2 presumption that a defect existed at delivery within the period; R-3 exclusions: mechanical impact, liquid, misuse, unauthorized repair; R-4 normal wear is not a defect unless premature; R-5 description of the defect required; R-6 how to send the device for inspection; R-7 options after rejection: paid repair quote; R-8 final assessment after physical inspection; R-9 seller responds within 14 days (general statement, no dates promised) |

Each file starts with a title (`# Zasady zwrotów` / `# Zasady reklamacji`) and a note that it is a sample company document created for a proof of concept and not legal advice. **No amounts, prices, bank details, addresses, phone numbers, e-mails or real company names.** No promises of refunds within a specific time, compensation, or legally binding statements (AC-20 forbidden content: currency amounts, "zwrot pieniędzy w ciągu", "odszkodowanie", "rekompensata", "prawnie wiążąc").

Loader (`app/src/lib/ai/policies.ts`, starts with `import "server-only";`):
```ts
export type Policy = { caseType: CaseType; text: string; ruleIds: ReadonlySet<string> };
export function loadPolicy(caseType: CaseType, dir?: string): Policy; // dir defaults to join(process.cwd(), "content", "policies")
export function extractRuleIds(markdown: string): string[]; // IDs from headings matching /^###\s+([ZR]-\d{1,2})\b/m, in order, unique
```
`zwrot` → `return-policy.md`, `reklamacja` → `complaint-policy.md`. Read with `node:fs` `readFileSync` (UTF-8) and cache per case type after the first successful read (in a module-level Map). A missing file throws an `Error` naming the file path (TAC-002-05: startup fails when a file is missing). Rule IDs must match the `RULE_ID_PATTERN` exported from `@/lib/domain/schemas`.

## TDD cases (write first; they fail because the module/files are missing)
- `loadPolicy("zwrot")` → ruleIds contains Z-1…Z-8 (≥ 8 `Z-` IDs) and no `R-` IDs; `loadPolicy("reklamacja")` → R-1…R-9 (≥ 9 `R-` IDs) (TAC-002-05). Tests run with cwd `app/`, so the default dir works.
- `extractRuleIds` on a sample string returns IDs in order without duplicates and ignores IDs mentioned in body text.
- missing directory (pass a temp dir from `node:os` `tmpdir()` + a random name) → throws an error whose message contains `return-policy.md`.
- forbidden content: neither file matches `/\d+[\s,.]*(zł|pln|eur|€|\$)/i`, "zwrot pieniędzy w ciągu", "odszkodowanie", "rekompensata", "prawnie wiążąc", "@", "http".
- each file contains a note that it is a sample/PoC document (e.g. contains "przykładowy" or "PoC").
Then: `npm run test`, `npm run typecheck`, `npm run lint`.

## Rules (all workers)
- Repository root: `/home/labuser/jsystems-ai-programming-2026-11/.claude/worktrees/skills-lock`; run npm commands inside `app/`. Stack: Next.js 16, TypeScript strict (`noUncheckedIndexedAccess`), Zod 4.6.7, Vitest 5 (`unit` project = jsdom, `tests/unit/**`; `integration` = node). Network is blocked in tests.
- Shared contracts are read-only for you: `app/src/lib/domain/{schemas,categories,copy-pl,errors}.ts`. Import types from there; if you need a change, report it.
- Library facts: Context7 first (`resolve-library-id` → `query-docs`); CLI facts: `--help`. Never guess APIs.
- TDD: write the behavioral tests first, run them, record the failure reason, then implement the minimum, then run the full checks.
- No `any`, no type assertions (`as`, including `as const`) — ESLint enforces it. Use Zod parsing, type guards, `satisfies`.
- Server-only modules start with `import "server-only";` and tests mock it with `vi.mock("server-only", () => ({}));`. The unit project runs in jsdom; `node:fs` still works there. If it does not, add `// @vitest-environment node` at the top of your test file.
- Edit only the files listed in your brief. Never `npm install`, never touch `package.json`, the lockfile, configs, `globals.css`, `layout.tsx`, `page.tsx`, docs. `curl`, `wget`, `sudo` are denied.
- Report contradictions instead of guessing. Do not commit; the orchestrator reviews and commits.
- Concurrent workers (do not edit their files): T03 `app/src/app/layout.tsx`, `globals.css`, `app/src/fonts/*`, `app/public/*`, `app/tests/e2e/smoke.spec.ts`; T05 `app/src/lib/domain/policy-window.ts` + test; T08 `app/src/lib/security/case-token.ts` + test; T09 `app/src/lib/image/downscale.ts` + test. Other workers' tests may be red while they work; judge only your own files, but report full-suite results.

## Report
Files changed; the red run and its failure reason; final outputs of `npm run test` (files/tests counts, skips), `npm run typecheck`, `npm run lint`; assumptions and contradictions.
