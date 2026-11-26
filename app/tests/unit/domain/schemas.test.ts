import { describe, expect, it } from "vitest";

import { CASE_TYPES, EQUIPMENT_CATEGORIES } from "@/lib/domain/categories";
import { COPY } from "@/lib/domain/copy-pl";
import { ERROR_CODES, errorCopyFor } from "@/lib/domain/errors";
import {
  CaseTokenPayloadSchema,
  DECISION_DISCLAIMER_PL,
  DECISION_LABELS,
  DecisionDraftSchema,
  DecisionSchema,
  ImageAnalysisSchema,
  createCaseInputSchema,
} from "@/lib/domain/schemas";

const TODAY = "2026-11-26";
const schema = createCaseInputSchema({ today: TODAY });

const validReturn = {
  caseType: "zwrot",
  category: "Smartfon",
  model: "Galaxy S30",
  purchaseDate: "2026-11-20",
  reason: "",
};

function fieldErrors(input: Record<string, unknown>): Record<string, string[]> {
  const result = schema.safeParse(input);
  if (result.success) return {};
  const errors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "");
    errors[key] = [...(errors[key] ?? []), issue.message];
  }
  return errors;
}

describe("PRD 8.2 fixed lists", () => {
  it("has the two case types and the 12 categories in PRD order", () => {
    expect(CASE_TYPES).toEqual(["zwrot", "reklamacja"]);
    expect(EQUIPMENT_CATEGORIES).toEqual([
      "Smartfon",
      "Laptop",
      "Tablet",
      "Komputer stacjonarny",
      "Monitor",
      "Telewizor",
      "Słuchawki i audio",
      "Smartwatch i opaski",
      "Aparat i kamera",
      "Konsola do gier",
      "Akcesoria komputerowe",
      "Inne",
    ]);
  });
});

describe("CaseInput (AC-02…AC-06)", () => {
  it("accepts a valid return without a reason (AC-04)", () => {
    expect(schema.safeParse(validReturn).success).toBe(true);
  });

  it("AC-02: every required field reports 'To pole jest wymagane' when empty", () => {
    const errors = fieldErrors({ caseType: "", category: "", model: "", purchaseDate: "", reason: "" });
    for (const field of ["caseType", "category", "model", "purchaseDate"]) {
      expect(errors[field]).toContain(COPY.form.errors.required);
    }
    expect(COPY.form.errors.required).toBe("To pole jest wymagane");
  });

  it("AC-03: a complaint needs at least 10 non-whitespace characters in the reason", () => {
    const tooShort = fieldErrors({ ...validReturn, caseType: "reklamacja", reason: "a b c d e f g h i" });
    expect(tooShort.reason).toEqual([COPY.form.errors.complaintReason]);
    expect(COPY.form.errors.complaintReason).toBe("Opisz powód reklamacji (min. 10 znaków)");
    const ok = schema.safeParse({ ...validReturn, caseType: "reklamacja", reason: "Ekran miga po upadku" });
    expect(ok.success).toBe(true);
  });

  it("AC-05: model name 2–100 characters (trimmed) and reason at most 2000", () => {
    expect(fieldErrors({ ...validReturn, model: " a " }).model).toBeDefined();
    expect(fieldErrors({ ...validReturn, model: "x".repeat(101) }).model).toBeDefined();
    expect(schema.safeParse({ ...validReturn, model: "x".repeat(100) }).success).toBe(true);
    expect(fieldErrors({ ...validReturn, reason: "x".repeat(2001) }).reason).toBeDefined();
    expect(schema.safeParse({ ...validReturn, reason: "x".repeat(2000) }).success).toBe(true);
  });

  it("AC-06: purchase date cannot be after today; today itself is allowed", () => {
    expect(fieldErrors({ ...validReturn, purchaseDate: "2026-11-27" }).purchaseDate).toEqual([
      COPY.form.errors.futureDate,
    ]);
    expect(COPY.form.errors.futureDate).toBe("Data zakupu nie może być z przyszłości");
    expect(schema.safeParse({ ...validReturn, purchaseDate: TODAY }).success).toBe(true);
  });

  it("rejects dates before 2000-01-01, malformed dates and unknown category/case type", () => {
    expect(fieldErrors({ ...validReturn, purchaseDate: "1999-12-31" }).purchaseDate).toBeDefined();
    expect(fieldErrors({ ...validReturn, purchaseDate: "2026-02-30" }).purchaseDate).toBeDefined();
    expect(fieldErrors({ ...validReturn, category: "Lodówka" }).category).toBeDefined();
    expect(fieldErrors({ ...validReturn, caseType: "wymiana" }).caseType).toBeDefined();
  });
});

describe("ImageAnalysis", () => {
  const analysis = {
    photoUsable: true,
    photoProblem: "none",
    itemVisible: true,
    matchesCategory: true,
    signsOfUse: [],
    damages: [{ type: "pęknięcie", location: "ekran", severity: "medium" }],
    probableCause: "mechanical_impact",
    resellableAsNew: null,
    confidence: "high",
    summaryPl: "Widoczne pęknięcie ekranu.",
  };

  it("accepts a complete analysis and rejects a summary over 600 characters", () => {
    expect(ImageAnalysisSchema.safeParse(analysis).success).toBe(true);
    expect(ImageAnalysisSchema.safeParse({ ...analysis, summaryPl: "x".repeat(601) }).success).toBe(false);
  });

  it("rejects values outside the closed enums", () => {
    expect(ImageAnalysisSchema.safeParse({ ...analysis, confidence: "certain" }).success).toBe(false);
    expect(ImageAnalysisSchema.safeParse({ ...analysis, photoProblem: "glare" }).success).toBe(false);
  });
});

describe("Decision (AC-14)", () => {
  const draft = {
    label: "zaakceptowano",
    justificationPl: "Zwrot mieści się w terminie.",
    citedRuleIds: ["Z-1"],
    nextStepsPl: ["Spakuj sprzęt."],
  };

  it("has exactly the three labels", () => {
    expect(DECISION_LABELS).toEqual(["zaakceptowano", "odrzucono", "wymaga_weryfikacji"]);
    expect(COPY.decision.labels).toEqual({
      zaakceptowano: "Zaakceptowano",
      odrzucono: "Odrzucono",
      wymaga_weryfikacji: "Wymaga weryfikacji pracownika",
    });
  });

  it("validates cited rule ID format and counts", () => {
    expect(DecisionDraftSchema.safeParse(draft).success).toBe(true);
    expect(DecisionDraftSchema.safeParse({ ...draft, citedRuleIds: [] }).success).toBe(false);
    expect(DecisionDraftSchema.safeParse({ ...draft, citedRuleIds: ["X-1"] }).success).toBe(false);
    expect(DecisionDraftSchema.safeParse({ ...draft, citedRuleIds: ["Z-1", "Z-2", "Z-3", "Z-4", "Z-5", "Z-6"] }).success).toBe(false);
    expect(DecisionDraftSchema.safeParse({ ...draft, nextStepsPl: [] }).success).toBe(false);
    expect(DecisionDraftSchema.safeParse({ ...draft, nextStepsPl: Array(7).fill("Krok") }).success).toBe(false);
  });

  it("a Decision carries the fixed PRD 11.4 disclaimer", () => {
    expect(DECISION_DISCLAIMER_PL).toBe(
      "To jest wstępna decyzja wygenerowana automatycznie. Ostateczne rozpatrzenie zgłoszenia nastąpi po fizycznej weryfikacji sprzętu przez nasz serwis.",
    );
    const decision = { ...draft, kind: "initial", disclaimerPl: DECISION_DISCLAIMER_PL };
    expect(DecisionSchema.safeParse(decision).success).toBe(true);
    expect(DecisionSchema.safeParse({ ...decision, disclaimerPl: "inny" }).success).toBe(false);
  });
});

describe("CaseToken payload", () => {
  it("accepts only version 1", () => {
    const result = CaseTokenPayloadSchema.shape.v.safeParse(2);
    expect(result.success).toBe(false);
    expect(CaseTokenPayloadSchema.shape.v.safeParse(1).success).toBe(true);
  });
});

describe("error codes (ADR-003, ADR-004 A-04)", () => {
  it("maps every case code to the AC-13 banner and chat codes to the AC-28 text", () => {
    for (const code of ["VALIDATION_FAILED", "PROCESSING_FAILED", "TIMEOUT", "PAYLOAD_TOO_LARGE", "UNSUPPORTED_MEDIA_TYPE"] satisfies string[]) {
      expect(errorCopyFor(code)).toBe("Nie udało się przetworzyć zgłoszenia. Spróbuj ponownie.");
    }
    expect(errorCopyFor("CHAT_FAILED")).toBe("Nie udało się wysłać odpowiedzi");
    expect(errorCopyFor("something unexpected")).toBe("Nie udało się przetworzyć zgłoszenia. Spróbuj ponownie.");
    expect(ERROR_CODES).toContain("INVALID_CASE_TOKEN");
  });
});
