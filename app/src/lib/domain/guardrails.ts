// ADR-002 §3.3: guardrails G1–G6 applied in order to every decision draft (initial and updated).
// Pure function: no I/O, no runtime AI SDK imports. Output always satisfies DecisionSchema.
import type { CaseType } from "./categories";
import { COPY } from "./copy-pl";
import {
  DECISION_DISCLAIMER_PL,
  DecisionSchema,
  type Decision,
  type DecisionDraft,
  type DecisionKind,
  type DecisionLabel,
  type Guardrail,
  type ImageAnalysis,
  type PolicyWindow,
} from "./schemas";

type Draft = DecisionDraft & { changeReasonPl?: string };

const MAX_CITED_RULE_IDS = 5;
const MAX_NEXT_STEPS = 6;
const MAX_JUSTIFICATION = 1200;

const GENERAL_RULE: Record<CaseType, string> = { zwrot: "Z-1", reklamacja: "R-1" };

const SAFE_JUSTIFICATION = "Nie możemy przygotować wstępnej decyzji automatycznie. Zgłoszenie oceni pracownik serwisu.";
const SAFE_NEXT_STEP = "Pracownik serwisu skontaktuje się w sprawie zgłoszenia.";

// G6 patterns: currency amounts and forbidden commitments (case-insensitive).
const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /\d+[\s,.]*(zł|pln|eur|€|\$)/i,
  /zwrot pieniędzy w ciągu/i,
  /odszkodowanie/i,
  /rekompensata/i,
  /prawnie wiążąc/i,
];

function containsForbidden(text: string): boolean {
  return FORBIDDEN_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Removes every sentence that contains a forbidden commitment. A sentence ends at `.`, `!` or `?`
 * followed by whitespace or the end of the text, so decimal amounts such as "499.00 zł" stay in one sentence.
 */
function stripForbiddenSentences(text: string): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => sentence.trim() !== "" && !containsForbidden(sentence))
    .join(" ")
    .trim();
}

function uniq(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export function applyGuardrails(args: {
  draft: Draft;
  analysis: ImageAnalysis;
  window: PolicyWindow;
  ruleIds: ReadonlySet<string>;
  caseType: CaseType;
  kind: DecisionKind; // "initial" for /api/case, "updated" for the chat tool
}): Decision {
  const { draft, analysis, window, ruleIds, caseType, kind } = args;
  const generalRule = GENERAL_RULE[caseType];

  let label: DecisionLabel = draft.label;
  let guardrail: Guardrail | undefined;
  let justification = draft.justificationPl;
  let cited = uniq(draft.citedRuleIds);
  let nextSteps = [...draft.nextStepsPl];
  let photoProblemPl = draft.photoProblemPl;
  let changeReasonPl = draft.changeReasonPl;

  // G1: window expired. Has priority over G2–G4.
  const windowExpired = !window.withinWindow;
  if (windowExpired) {
    guardrail = "window_expired";
    label = "odrzucono";
    const sentence =
      caseType === "zwrot"
        ? `Zwrot jest możliwy w ciągu 14 dni od daty zakupu, a od zakupu minęło ${window.elapsedDays} dni.`
        : `Reklamację można zgłosić w ciągu 24 miesięcy od daty zakupu, a od zakupu minęło ${window.elapsedMonths} miesięcy.`;
    justification = `${sentence} ${justification}`;
    cited = [generalRule, ...cited.filter((id) => id !== generalRule)].slice(0, MAX_CITED_RULE_IDS);
  }

  // G2: photo unusable (only when G1 did not apply).
  if (!windowExpired && !analysis.photoUsable) {
    guardrail ??= "photo_unusable";
    label = "wymaga_weryfikacji";
    photoProblemPl =
      COPY.decision.photoProblems[analysis.photoProblem === "none" ? "other" : analysis.photoProblem];
    if (!nextSteps.includes(COPY.decision.newCaseWithBetterPhoto)) {
      if (nextSteps.length >= MAX_NEXT_STEPS) {
        nextSteps = [...nextSteps.slice(0, MAX_NEXT_STEPS - 1), COPY.decision.newCaseWithBetterPhoto];
      } else {
        nextSteps = [...nextSteps, COPY.decision.newCaseWithBetterPhoto];
      }
    }
  }

  // G3: return with signs of use or damage (zwrot only).
  if (
    !windowExpired &&
    caseType === "zwrot" &&
    label === "zaakceptowano" &&
    (analysis.signsOfUse.length > 0 || analysis.damages.length > 0 || analysis.resellableAsNew === false)
  ) {
    guardrail ??= "return_signs_of_use";
    label = "wymaga_weryfikacji";
  }

  // G4: low confidence approval.
  if (!windowExpired && analysis.confidence === "low" && label === "zaakceptowano") {
    guardrail ??= "low_confidence";
    label = "wymaga_weryfikacji";
  }

  // G5: unknown rule IDs are dropped; if none remain, the general rule is cited.
  const knownCited = cited.filter((id) => ruleIds.has(id));
  if (knownCited.length !== cited.length) {
    guardrail ??= "unknown_rule_ids";
  }
  cited = knownCited.length > 0 ? knownCited : [generalRule];

  // G6: forbidden commitments. Always wins over earlier labels and flags.
  const forbiddenFound =
    containsForbidden(justification) ||
    nextSteps.some(containsForbidden) ||
    (photoProblemPl !== undefined && containsForbidden(photoProblemPl)) ||
    (changeReasonPl !== undefined && containsForbidden(changeReasonPl));

  if (forbiddenFound) {
    guardrail = "forbidden_content";
    label = "wymaga_weryfikacji";
    justification = stripForbiddenSentences(justification) || SAFE_JUSTIFICATION;
    nextSteps = nextSteps.filter((step) => !containsForbidden(step));
    if (nextSteps.length === 0) nextSteps = [SAFE_NEXT_STEP];
    if (photoProblemPl !== undefined) photoProblemPl = stripForbiddenSentences(photoProblemPl) || undefined;
    if (changeReasonPl !== undefined) changeReasonPl = stripForbiddenSentences(changeReasonPl) || undefined;
  }

  return DecisionSchema.parse({
    label,
    justificationPl: justification.slice(0, MAX_JUSTIFICATION),
    citedRuleIds: cited.slice(0, MAX_CITED_RULE_IDS),
    nextStepsPl: nextSteps.slice(0, MAX_NEXT_STEPS),
    photoProblemPl,
    kind,
    changeReasonPl,
    guardrailApplied: guardrail,
    disclaimerPl: DECISION_DISCLAIMER_PL,
  });
}
