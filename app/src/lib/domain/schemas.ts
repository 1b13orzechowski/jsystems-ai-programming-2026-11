// Shared contracts (ADR-000 §5, ADR-002 §4, ADR-003 §4). Zod schemas are the single source of TS types.
import type { UIMessage } from "ai";
import { z } from "zod";

import { CASE_TYPES, EQUIPMENT_CATEGORIES, literalTuple } from "./categories";
import { COPY } from "./copy-pl";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MIN_PURCHASE_DATE = "2000-01-01";

export const MODEL_MIN = 2;
export const MODEL_MAX = 100;
export const REASON_MAX = 2000;
export const COMPLAINT_REASON_MIN_NON_WHITESPACE = 10;
export const CHAT_MESSAGE_MAX = 2000;
export const CHAT_MESSAGES_MAX = 40;

/** True when `value` is a real calendar date in `YYYY-MM-DD` form. */
export function isCalendarDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function countNonWhitespace(value: string): number {
  return value.replace(/\s/g, "").length;
}

const requiredString = z.string({ error: COPY.form.errors.required }).trim().min(1, COPY.form.errors.required);

const caseTypeField = requiredString.pipe(z.enum(CASE_TYPES, { error: COPY.form.errors.invalidOption }));
const categoryField = requiredString.pipe(z.enum(EQUIPMENT_CATEGORIES, { error: COPY.form.errors.invalidOption }));
const modelField = requiredString.pipe(
  z.string().min(MODEL_MIN, COPY.form.errors.modelLength).max(MODEL_MAX, COPY.form.errors.modelLength),
);
const reasonField = z.string().max(REASON_MAX, COPY.form.errors.reasonTooLong);

/** Stored case data (inside the case token): structure only, no "today" check. */
export const CaseInputDataSchema = z.object({
  caseType: z.enum(CASE_TYPES),
  category: z.enum(EQUIPMENT_CATEGORIES),
  model: z.string().min(MODEL_MIN).max(MODEL_MAX),
  purchaseDate: z.string().refine(isCalendarDate),
  reason: z.string().max(REASON_MAX),
});
export type CaseInput = z.infer<typeof CaseInputDataSchema>;

/**
 * Form/route validation (AC-02…AC-06). `today` is `YYYY-MM-DD` in APP_TIMEZONE (Europe/Warsaw),
 * computed by the caller so the schema stays pure.
 */
export function createCaseInputSchema({ today }: { today: string }) {
  const purchaseDateField = requiredString
    .refine(isCalendarDate, COPY.form.errors.invalidDate)
    .refine((value) => value >= MIN_PURCHASE_DATE, COPY.form.errors.invalidDate)
    .refine((value) => value <= today, COPY.form.errors.futureDate);

  return z
    .object({
      caseType: caseTypeField,
      category: categoryField,
      model: modelField,
      purchaseDate: purchaseDateField,
      reason: reasonField.default(""),
    })
    .superRefine((value, ctx) => {
      if (value.caseType === "reklamacja" && countNonWhitespace(value.reason) < COMPLAINT_REASON_MIN_NON_WHITESPACE) {
        ctx.addIssue({ code: "custom", path: ["reason"], message: COPY.form.errors.complaintReason });
      }
    });
}

// ---- Image analysis (ADR-000 §5) ----

export const PHOTO_PROBLEMS = literalTuple(
  "none",
  "blurred",
  "too_dark",
  "no_equipment",
  "category_mismatch",
  "model_mismatch",
  "other",
);
export type PhotoProblem = (typeof PHOTO_PROBLEMS)[number];

export const PROBABLE_CAUSES = literalTuple(
  "manufacturing_defect",
  "normal_wear",
  "mechanical_impact",
  "liquid",
  "unknown",
  "not_applicable",
);
export const CONFIDENCE_LEVELS = literalTuple("low", "medium", "high");
export const SEVERITIES = literalTuple("low", "medium", "high");

export const DamageSchema = z.object({
  type: z.string().min(1).max(120),
  location: z.string().min(1).max(120),
  severity: z.enum(SEVERITIES),
});

export const ImageAnalysisSchema = z.object({
  photoUsable: z.boolean(),
  photoProblem: z.enum(PHOTO_PROBLEMS),
  itemVisible: z.boolean(),
  matchesCategory: z.boolean(),
  signsOfUse: z.array(z.string().min(1).max(200)).max(10),
  damages: z.array(DamageSchema).max(10),
  probableCause: z.enum(PROBABLE_CAUSES),
  resellableAsNew: z.boolean().nullable(),
  confidence: z.enum(CONFIDENCE_LEVELS),
  summaryPl: z.string().min(1).max(600),
});
export type ImageAnalysis = z.infer<typeof ImageAnalysisSchema>;

// ---- Decision (ADR-002 §4, PRD 11.4) ----

export const DECISION_LABELS = literalTuple("zaakceptowano", "odrzucono", "wymaga_weryfikacji");
export type DecisionLabel = (typeof DECISION_LABELS)[number];

export const DECISION_KINDS = literalTuple("initial", "updated");
export type DecisionKind = (typeof DECISION_KINDS)[number];

export const GUARDRAILS = literalTuple(
  "window_expired", // G1
  "photo_unusable", // G2
  "return_signs_of_use", // G3
  "low_confidence", // G4
  "unknown_rule_ids", // G5
  "forbidden_content", // G6
);
export type Guardrail = (typeof GUARDRAILS)[number];

export const DECISION_DISCLAIMER_PL =
  "To jest wstępna decyzja wygenerowana automatycznie. Ostateczne rozpatrzenie zgłoszenia nastąpi po fizycznej weryfikacji sprzętu przez nasz serwis.";

export const RULE_ID_PATTERN = /^[ZR]-\d{1,2}$/;

export const DecisionDraftSchema = z.object({
  label: z.enum(DECISION_LABELS),
  justificationPl: z.string().min(1).max(900),
  citedRuleIds: z.array(z.string().regex(RULE_ID_PATTERN)).min(1).max(5),
  nextStepsPl: z.array(z.string().min(1).max(200)).min(1).max(6),
  photoProblemPl: z.string().min(1).max(300).optional(),
});
export type DecisionDraft = z.infer<typeof DecisionDraftSchema>;

export const DecisionSchema = DecisionDraftSchema.extend({
  // Guardrail G1 prefixes a code-generated window sentence to the model's ≤ 900-char justification.
  justificationPl: z.string().min(1).max(1200),
  kind: z.enum(DECISION_KINDS),
  changeReasonPl: z.string().min(1).max(600).optional(),
  guardrailApplied: z.enum(GUARDRAILS).optional(),
  disclaimerPl: z.literal(DECISION_DISCLAIMER_PL),
});
export type Decision = z.infer<typeof DecisionSchema>;

/** Input of the chat tool `issueUpdatedDecision` (ADR-002 §3.5): a new draft plus why it changed. */
export const UpdatedDecisionInputSchema = DecisionDraftSchema.extend({
  changeReasonPl: z.string().min(1).max(400),
});
export type UpdatedDecisionInput = z.infer<typeof UpdatedDecisionInputSchema>;

// ---- Policy window (ADR-002 §4) ----

export const PolicyWindowSchema = z.object({
  submissionDate: z.string().refine(isCalendarDate),
  purchaseDate: z.string().refine(isCalendarDate),
  elapsedDays: z.number().int().min(0),
  elapsedMonths: z.number().int().min(0),
  limitUnit: z.enum(literalTuple("days", "months")),
  limitValue: z.union([z.literal(14), z.literal(24)]),
  withinWindow: z.boolean(),
});
export type PolicyWindow = z.infer<typeof PolicyWindowSchema>;

// ---- Case token payload (ADR-003 §4) ----

export const CASE_TOKEN_VERSION = 1;
export const CASE_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

export const CaseTokenPayloadSchema = z.object({
  v: z.literal(CASE_TOKEN_VERSION),
  caseId: z.uuid(),
  input: CaseInputDataSchema,
  analysis: ImageAnalysisSchema,
  decision: DecisionSchema,
  window: PolicyWindowSchema,
  issuedAt: z.number().int(), // epoch ms
  expiresAt: z.number().int(), // epoch ms = issuedAt + 2 h
});
export type CaseTokenPayload = z.infer<typeof CaseTokenPayloadSchema>;

// ---- UI message types (ADR-000 §5, ADR-003 §4) ----

export const STAGES = literalTuple("analyzing", "deciding");
export type Stage = (typeof STAGES)[number];
export const StageDataSchema = z.object({ stage: z.enum(STAGES) });

/** Data parts of chat messages: `data-decision`. */
export type ChatDataParts = {
  decision: Decision;
};

/** UI tools of the chat agent: `tool-issueUpdatedDecision`. */
export type ChatTools = {
  issueUpdatedDecision: { input: UpdatedDecisionInput; output: Decision };
};

export type ChatUIMessage = UIMessage<never, ChatDataParts, ChatTools>;

/** Final payload of `/api/case` (`data-case`). */
export type CaseResult = {
  caseId: string;
  firstMessage: ChatUIMessage;
  decision: Decision;
  analysisSummaryPl: string;
  caseToken: string;
};

/** Data parts of the `/api/case` stream: transient `data-stage`, final `data-case`. */
export type CaseStreamDataParts = {
  stage: z.infer<typeof StageDataSchema>;
  case: CaseResult;
};
export type CaseStreamMessage = UIMessage<never, CaseStreamDataParts>;
