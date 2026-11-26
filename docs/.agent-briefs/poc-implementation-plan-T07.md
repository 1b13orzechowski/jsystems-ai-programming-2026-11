# Brief T07 — Decision guardrails and first-message composer

## Goal and observable outcome
Two pure functions in `lib/domain`: `applyGuardrails` turns a model `DecisionDraft` into a final `Decision` that always satisfies AC-14…AC-20 regardless of what the model said; `composeFirstMessage` builds the first assistant chat message whose order and disclaimer are guaranteed by code (AC-15, TAC-07).

## Editable files
- `app/src/lib/domain/guardrails.ts`
- `app/src/lib/domain/compose-decision-message.ts`
- `app/tests/unit/domain/guardrails.test.ts`
- `app/tests/unit/domain/compose-decision-message.test.ts`

## Inputs you build on (read them, do not edit)
- `app/src/lib/domain/schemas.ts`: `DecisionDraft`, `Decision`, `DecisionSchema`, `DecisionKind`, `ImageAnalysis`, `PolicyWindow`, `Guardrail` (values `window_expired` G1, `photo_unusable` G2, `return_signs_of_use` G3, `low_confidence` G4, `unknown_rule_ids` G5, `forbidden_content` G6), `DECISION_DISCLAIMER_PL`, `ChatUIMessage`, `CaseInput`.
- `app/src/lib/domain/copy-pl.ts`: `COPY.decision.photoProblems[photoProblem]` (Polish text per `photoProblem`), `COPY.decision.newCaseWithBetterPhoto`, `COPY.decision.greeting` ("Dzień dobry,"), `COPY.caseTypes`.
- `app/src/lib/domain/policy-window.ts` (`computePolicyWindow`) can help build test windows.

## Specification — ADR-002 §3.3 guardrails, applied in this order to every draft (initial and updated)

| # | Rule | Effect | AC |
|---|---|---|---|
| G1 | `window.withinWindow == false` | label = odrzucono; justification prefixed by a code-generated Polish sentence stating the window (14 dni / 24 miesiące) and elapsed days/months; cite `Z-1` (zwrot) or `R-1` (reklamacja) | AC-16, AC-17 |
| G2 | `analysis.photoUsable == false` (and G1 not applied) | label = wymaga_weryfikacji; `photoProblemPl` filled from `COPY.decision.photoProblems[analysis.photoProblem]` (use the `other` text when the problem is `none`); next steps include `COPY.decision.newCaseWithBetterPhoto` ("Może Pan/Pani rozpocząć nowe zgłoszenie z lepszym zdjęciem.") | AC-18 |
| G3 | case = zwrot, label = zaakceptowano, and (`signsOfUse` non-empty or `damages` non-empty or `resellableAsNew == false`) | label = wymaga_weryfikacji | AC-19 |
| G4 | `analysis.confidence == low` and label = zaakceptowano | label = wymaga_weryfikacji | PRD 11.5 |
| G5 | Cited rule IDs not in the policy's ID set | drop unknown IDs; if none remain, add the policy's general rule (`Z-1`/`R-1`) | AC-15 |
| G6 | Forbidden commitments in justification, next steps, photoProblemPl or changeReasonPl: regex for currency amounts `/\d+[\s,.]*(zł|pln|eur|€|\$)/i`, and (case-insensitive) "zwrot pieniędzy w ciągu", "odszkodowanie", "rekompensata", "prawnie wiążąc" | label = wymaga_weryfikacji and every offending sentence is removed (split on sentence ends `.`, `!`, `?`; a next-step item containing it is removed entirely); flag `guardrailApplied = forbidden_content` | AC-20 |

Details you must follow:
- G1 sentences (exact templates): zwrot → `Zwrot jest możliwy w ciągu 14 dni od daty zakupu, a od zakupu minęło ${elapsedDays} dni.`; reklamacja → `Reklamację można zgłosić w ciągu 24 miesięcy od daty zakupu, a od zakupu minęło ${elapsedMonths} miesięcy.` The sentence is placed before the model's justification (separated by one space). `citedRuleIds` must include `Z-1`/`R-1` (put it first, keep other known IDs, max 5).
- When G1 applies, G2–G4 do not change the label any more (G1 has priority, ADR §8 "G1 has priority when both apply"); G5 and G6 still run.
- `guardrailApplied` records the first rule that changed the label (G1–G4), but G6 always sets `forbidden_content` when it fires (it overrides earlier values). G5 alone sets `unknown_rule_ids` only if no other rule fired.
- If G6 removes all next steps or the whole justification, use a safe fallback: justification `Nie możemy przygotować wstępnej decyzji automatycznie. Zgłoszenie oceni pracownik serwisu.` and one next step `Pracownik serwisu skontaktuje się w sprawie zgłoszenia.`
- Keep `nextStepsPl` at most 6 items (when G2 appends the new-case step and there are already 6, replace the last one). Truncate the final justification to 1200 characters if needed.
- Output is validated with `DecisionSchema.parse(...)`, `disclaimerPl` = `DECISION_DISCLAIMER_PL`, `kind` from the argument.

Required API:
```ts
export function applyGuardrails(args: {
  draft: DecisionDraft & { changeReasonPl?: string };
  analysis: ImageAnalysis;
  window: PolicyWindow;
  ruleIds: ReadonlySet<string>;
  caseType: CaseType;
  kind: DecisionKind; // "initial" for /api/case, "updated" for the chat tool
}): Decision;
```

## Specification — ADR-002 §3.4 first message
`composeFirstMessage({ caseInput, decision, id })` returns a `ChatUIMessage` `{ id, role: "assistant", parts }` with exactly two parts in this order:
1. `{ type: "text", text }` where text = `Dzień dobry,` + newline + one sentence naming the case type and model, e.g. `Przygotowaliśmy wstępną decyzję w sprawie zgłoszenia: ${COPY.caseTypes[caseType].toLowerCase()} — ${model}.`
2. `{ type: "data-decision", id: "decision-initial", data: decision }` (the `Decision` with `kind: "initial"`).
The UI renders part 2 as the decision card (label, "Uzasadnienie", numbered "Kolejne kroki", disclaimer); together this guarantees the AC-15 order. Signature: `export function composeFirstMessage(args: { caseInput: CaseInput; decision: Decision; id: string }): ChatUIMessage`.

## TDD (write all tests first, see them fail because modules are missing)
One test per G-rule plus: G1 complaint variant (24 miesięcy text, R-1); G1 priority over G2 (photoUsable false + window false → odrzucono, guardrailApplied window_expired); G2 photoProblemPl and the new-case step; G3 for zwrot with `signsOfUse: ["rysy"]` and with `resellableAsNew: false`; G3 does not affect reklamacja; G4 low confidence; G5 `["Z-99"]` → `["Z-1"]`, mixed `["Z-3","Z-99"]` → `["Z-3"]`; G6 "Zwrócimy 499 zł w ciągu tygodnia." removed, also "100 PLN", "50 €", "odszkodowanie", "rekompensata", "prawnie wiążąca"; G6 next-step item removal; G6 fallback when everything is removed; untouched approve stays zaakceptowano with no `guardrailApplied`; output always parses with `DecisionSchema` and has the exact disclaimer; `kind: "updated"` preserved with `changeReasonPl`. Composer: part order, greeting first line, case type + model in the sentence, data part holds the decision with disclaimer, 6 next steps preserved.
After green, the orchestrator will run a mutation check (remove each rule → its test must fail), so make each test fail if its rule is removed.
Then: `npm run test`, `npm run typecheck`, `npm run lint`.

## Rules (all workers)
- Repository root: `/home/labuser/jsystems-ai-programming-2026-11/.claude/worktrees/skills-lock`; run npm commands inside `app/`. TypeScript strict (`noUncheckedIndexedAccess`), Zod 4.6.7, Vitest 5 (`unit` project = jsdom, `tests/unit/**`). Network is blocked in tests.
- Shared contracts are read-only: `app/src/lib/domain/{schemas,categories,copy-pl,errors}.ts`. If you need a change, report it.
- Library facts: Context7 first; never guess APIs. These modules are pure TS: no I/O, no `server-only`, no AI SDK runtime imports (type imports from `@/lib/domain/schemas` are fine).
- TDD: tests first, record the red run, implement the minimum, run full checks.
- No `any`, no type assertions (`as`, including `as const`). Use `literalTuple(...)` from `@/lib/domain/categories` for literal tuples.
- Edit only the files listed. Never `npm install`, never touch `package.json`, the lockfile, configs, `globals.css`, `layout.tsx`, `page.tsx`, docs. `curl`, `wget`, `sudo` are denied.
- Report contradictions instead of guessing. Do not commit.
- Concurrent work (do not edit): T03 `app/src/app/layout.tsx`, `globals.css`, `app/src/fonts/*`, `app/public/*`, `app/tests/e2e/smoke.spec.ts`; the orchestrator works on `app/scripts/*` and `app/tests/fixtures/*`.

## Report
Files changed; the red run and its failure reason; final outputs of `npm run test` (files/tests counts, skips), `npm run typecheck`, `npm run lint`; assumptions and contradictions.
