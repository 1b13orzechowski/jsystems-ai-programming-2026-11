import { describe, expect, it } from "vitest";

import type { CaseType } from "@/lib/domain/categories";
import { COPY } from "@/lib/domain/copy-pl";
import { applyGuardrails } from "@/lib/domain/guardrails";
import { computePolicyWindow } from "@/lib/domain/policy-window";
import {
  DECISION_DISCLAIMER_PL,
  DecisionSchema,
  type DecisionDraft,
  type DecisionKind,
  type ImageAnalysis,
  type PolicyWindow,
} from "@/lib/domain/schemas";

const NOW = new Date("2026-11-26T12:00:00Z");
const WARSAW = "Europe/Warsaw";
const RULE_IDS: ReadonlySet<string> = new Set(["Z-1", "Z-2", "Z-3", "R-1", "R-2"]);
const NEW_CASE_STEP = COPY.decision.newCaseWithBetterPhoto;
const SAFE_JUSTIFICATION = "Nie możemy przygotować wstępnej decyzji automatycznie. Zgłoszenie oceni pracownik serwisu.";
const SAFE_NEXT_STEP = "Pracownik serwisu skontaktuje się w sprawie zgłoszenia.";
const RETURN_STEP = "Wyślij sprzęt na adres serwisu.";

type Draft = DecisionDraft & { changeReasonPl?: string };

const DEFAULT_PURCHASE: Record<CaseType, string> = { zwrot: "2026-11-12", reklamacja: "2025-06-01" };

function analysis(overrides: Partial<ImageAnalysis> = {}): ImageAnalysis {
  return {
    photoUsable: true,
    photoProblem: "none",
    itemVisible: true,
    matchesCategory: true,
    signsOfUse: [],
    damages: [],
    probableCause: "not_applicable",
    resellableAsNew: true,
    confidence: "high",
    summaryPl: "Sprzęt bez widocznych uszkodzeń.",
    ...overrides,
  };
}

function draft(overrides: Partial<Draft> = {}): Draft {
  return {
    label: "zaakceptowano",
    justificationPl: "Sprzęt kwalifikuje się do zwrotu.",
    citedRuleIds: ["Z-3"],
    nextStepsPl: [RETURN_STEP],
    ...overrides,
  };
}

function windowFor(caseType: CaseType, purchaseDate: string): PolicyWindow {
  return computePolicyWindow({ caseType, purchaseDate, now: NOW, timeZone: WARSAW });
}

type RunOptions = {
  caseType?: CaseType;
  draft?: Partial<Draft>;
  analysis?: Partial<ImageAnalysis>;
  purchaseDate?: string;
  kind?: DecisionKind;
};

function run(options: RunOptions = {}) {
  const caseType = options.caseType ?? "zwrot";
  return applyGuardrails({
    draft: draft(options.draft),
    analysis: analysis(options.analysis),
    window: windowFor(caseType, options.purchaseDate ?? DEFAULT_PURCHASE[caseType]),
    ruleIds: RULE_IDS,
    caseType,
    kind: options.kind ?? "initial",
  });
}

describe("applyGuardrails: untouched drafts", () => {
  it("keeps an approved return unchanged when no guardrail applies", () => {
    const result = run();

    expect(result).toEqual({
      label: "zaakceptowano",
      justificationPl: "Sprzęt kwalifikuje się do zwrotu.",
      citedRuleIds: ["Z-3"],
      nextStepsPl: [RETURN_STEP],
      kind: "initial",
      disclaimerPl: DECISION_DISCLAIMER_PL,
    });
    expect(result.guardrailApplied).toBeUndefined();
  });

  it.each([
    { name: "approved return", options: {} },
    { name: "rejected complaint inside the window", options: { caseType: "reklamacja" as const, draft: { label: "odrzucono" as const } } },
    { name: "unusable photo", options: { analysis: { photoUsable: false, photoProblem: "too_dark" as const } } },
    { name: "updated decision", options: { kind: "updated" as const, draft: { changeReasonPl: "Klient dodał zdjęcie." } } },
  ])("always parses with DecisionSchema and the exact disclaimer ($name)", ({ options }) => {
    const result = run(options);

    expect(() => DecisionSchema.parse(result)).not.toThrow();
    expect(result.disclaimerPl).toBe(DECISION_DISCLAIMER_PL);
  });

  it("keeps kind updated and the change reason", () => {
    const result = run({ kind: "updated", draft: { changeReasonPl: "Klient dodał zdjęcie." } });

    expect(result.kind).toBe("updated");
    expect(result.changeReasonPl).toBe("Klient dodał zdjęcie.");
  });
});

describe("applyGuardrails G1: window expired", () => {
  it("rejects an expired return, prefixes the day count and cites Z-1 first", () => {
    const result = run({ purchaseDate: "2026-11-05", draft: { citedRuleIds: ["Z-3"] } });

    expect(result.label).toBe("odrzucono");
    expect(result.guardrailApplied).toBe("window_expired");
    expect(result.justificationPl).toBe(
      "Zwrot jest możliwy w ciągu 14 dni od daty zakupu, a od zakupu minęło 21 dni. Sprzęt kwalifikuje się do zwrotu.",
    );
    expect(result.citedRuleIds).toEqual(["Z-1", "Z-3"]);
  });

  it("uses the 24-month sentence and R-1 for an expired complaint", () => {
    const result = run({
      caseType: "reklamacja",
      purchaseDate: "2024-10-15",
      draft: { justificationPl: "Sprzęt kwalifikuje się do naprawy.", citedRuleIds: ["R-2"] },
    });

    expect(result.label).toBe("odrzucono");
    expect(result.guardrailApplied).toBe("window_expired");
    expect(result.justificationPl).toBe(
      "Reklamację można zgłosić w ciągu 24 miesięcy od daty zakupu, a od zakupu minęło 25 miesięcy. Sprzęt kwalifikuje się do naprawy.",
    );
    expect(result.citedRuleIds).toEqual(["R-1", "R-2"]);
  });

  it("does not touch a complaint that is still inside the 24-month window", () => {
    const result = run({ caseType: "reklamacja", purchaseDate: "2024-12-01" });

    expect(result.label).toBe("zaakceptowano");
    expect(result.guardrailApplied).toBeUndefined();
    expect(result.justificationPl).toBe("Sprzęt kwalifikuje się do zwrotu.");
  });

  it("caps cited rule IDs at five after adding the general rule", () => {
    const result = run({
      purchaseDate: "2026-11-05",
      draft: { citedRuleIds: ["Z-1", "Z-2", "Z-3", "R-1", "R-2"] },
    });

    expect(result.citedRuleIds).toHaveLength(5);
    expect(result.citedRuleIds[0]).toBe("Z-1");
  });

  it("has priority over G2: an expired window with an unusable photo is odrzucono without the photo problem", () => {
    const result = run({
      purchaseDate: "2026-11-05",
      analysis: { photoUsable: false, photoProblem: "blurred" },
    });

    expect(result.label).toBe("odrzucono");
    expect(result.guardrailApplied).toBe("window_expired");
    expect(result.photoProblemPl).toBeUndefined();
    expect(result.nextStepsPl).not.toContain(NEW_CASE_STEP);
  });

  it("has priority over G3 and G4", () => {
    const result = run({
      purchaseDate: "2026-11-05",
      analysis: { signsOfUse: ["rysy"], confidence: "low" },
    });

    expect(result.label).toBe("odrzucono");
    expect(result.guardrailApplied).toBe("window_expired");
  });
});

describe("applyGuardrails G2: unusable photo", () => {
  it("sends the case to verification with the photo problem text and the new-case step", () => {
    const result = run({ analysis: { photoUsable: false, photoProblem: "blurred" } });

    expect(result.label).toBe("wymaga_weryfikacji");
    expect(result.guardrailApplied).toBe("photo_unusable");
    expect(result.photoProblemPl).toBe(COPY.decision.photoProblems.blurred);
    expect(result.nextStepsPl).toEqual([RETURN_STEP, NEW_CASE_STEP]);
  });

  it("uses the other-problem text when the photo problem is none", () => {
    const result = run({ analysis: { photoUsable: false, photoProblem: "none" } });

    expect(result.photoProblemPl).toBe(COPY.decision.photoProblems.other);
  });

  it("replaces the last next step when six are already present", () => {
    const steps = ["Krok 1.", "Krok 2.", "Krok 3.", "Krok 4.", "Krok 5.", "Krok 6."];
    const result = run({ analysis: { photoUsable: false, photoProblem: "too_dark" }, draft: { nextStepsPl: steps } });

    expect(result.nextStepsPl).toHaveLength(6);
    expect(result.nextStepsPl.slice(0, 5)).toEqual(steps.slice(0, 5));
    expect(result.nextStepsPl[5]).toBe(NEW_CASE_STEP);
  });
});

describe("applyGuardrails G3: return with signs of use", () => {
  it("sends a return with signs of use to verification", () => {
    const result = run({ analysis: { signsOfUse: ["rysy"] } });

    expect(result.label).toBe("wymaga_weryfikacji");
    expect(result.guardrailApplied).toBe("return_signs_of_use");
  });

  it("sends a return that is not resellable as new to verification", () => {
    const result = run({ analysis: { resellableAsNew: false } });

    expect(result.label).toBe("wymaga_weryfikacji");
    expect(result.guardrailApplied).toBe("return_signs_of_use");
  });

  it("does not affect a complaint", () => {
    const result = run({ caseType: "reklamacja", analysis: { signsOfUse: ["rysy"], resellableAsNew: false } });

    expect(result.label).toBe("zaakceptowano");
    expect(result.guardrailApplied).toBeUndefined();
  });
});

describe("applyGuardrails G4: low confidence", () => {
  it("sends a low-confidence approval to verification", () => {
    const result = run({ analysis: { confidence: "low" } });

    expect(result.label).toBe("wymaga_weryfikacji");
    expect(result.guardrailApplied).toBe("low_confidence");
  });

  it("does not change a rejection", () => {
    const result = run({ analysis: { confidence: "low" }, draft: { label: "odrzucono" } });

    expect(result.label).toBe("odrzucono");
    expect(result.guardrailApplied).toBeUndefined();
  });
});

describe("applyGuardrails G5: unknown rule IDs", () => {
  it("replaces an only unknown ID with the general return rule", () => {
    const result = run({ draft: { citedRuleIds: ["Z-99"] } });

    expect(result.citedRuleIds).toEqual(["Z-1"]);
    expect(result.guardrailApplied).toBe("unknown_rule_ids");
    expect(result.label).toBe("zaakceptowano");
  });

  it("drops unknown IDs and keeps the known ones", () => {
    const result = run({ draft: { citedRuleIds: ["Z-3", "Z-99"] } });

    expect(result.citedRuleIds).toEqual(["Z-3"]);
    expect(result.guardrailApplied).toBe("unknown_rule_ids");
  });

  it("does not override a rule that already fired", () => {
    const result = run({ analysis: { photoUsable: false, photoProblem: "blurred" }, draft: { citedRuleIds: ["Z-99"] } });

    expect(result.citedRuleIds).toEqual(["Z-1"]);
    expect(result.guardrailApplied).toBe("photo_unusable");
  });
});

describe("applyGuardrails G6: forbidden commitments", () => {
  it.each(["499 zł", "100 PLN", "50 €", "20 EUR", "300 $"])(
    "removes a sentence with the amount %s and sends the case to verification",
    (amount) => {
      const result = run({ draft: { justificationPl: `Zwrócimy ${amount} w ciągu tygodnia. Sprzęt kwalifikuje się do zwrotu.` } });

      expect(result.justificationPl).toBe("Sprzęt kwalifikuje się do zwrotu.");
      expect(result.label).toBe("wymaga_weryfikacji");
      expect(result.guardrailApplied).toBe("forbidden_content");
    },
  );

  it.each(["499.00 zł", "1 299,99 PLN", "49.5 €"])(
    "removes the whole sentence when the amount %s has a decimal point (no partial amount left)",
    (amount) => {
      const result = run({ draft: { justificationPl: `Zwrócimy ${amount} na konto. Sprzęt kwalifikuje się do zwrotu.` } });

      expect(result.justificationPl).toBe("Sprzęt kwalifikuje się do zwrotu.");
      expect(result.justificationPl).not.toMatch(/\d/);
    },
  );

  it.each(["Rekompensata", "odszkodowanie", "prawnie wiążąca decyzja", "Zwrot pieniędzy w ciągu tygodnia"])(
    "removes a sentence containing %s",
    (phrase) => {
      const result = run({ draft: { justificationPl: `Mamy ${phrase}. Sprzęt kwalifikuje się do zwrotu.` } });

      expect(result.justificationPl).toBe("Sprzęt kwalifikuje się do zwrotu.");
      expect(result.label).toBe("wymaga_weryfikacji");
      expect(result.guardrailApplied).toBe("forbidden_content");
    },
  );

  it("removes a next-step item that contains a forbidden commitment", () => {
    const result = run({ draft: { nextStepsPl: ["Zwrócimy 100 PLN na konto.", RETURN_STEP] } });

    expect(result.nextStepsPl).toEqual([RETURN_STEP]);
    expect(result.guardrailApplied).toBe("forbidden_content");
  });

  it("removes a forbidden sentence from the change reason and keeps kind updated", () => {
    const result = run({
      kind: "updated",
      draft: { changeReasonPl: "Klient podał nowe dane. Rekompensata należy się od razu." },
    });

    expect(result.changeReasonPl).toBe("Klient podał nowe dane.");
    expect(result.kind).toBe("updated");
    expect(result.guardrailApplied).toBe("forbidden_content");
  });

  it("overrides the earlier G1 label and flag", () => {
    const result = run({ purchaseDate: "2026-11-05", draft: { justificationPl: "Zwrócimy 499 zł." } });

    expect(result.label).toBe("wymaga_weryfikacji");
    expect(result.guardrailApplied).toBe("forbidden_content");
  });

  it("uses the safe justification when the whole justification is removed", () => {
    const result = run({ draft: { justificationPl: "Zwrócimy 499 zł." } });

    expect(result.justificationPl).toBe(SAFE_JUSTIFICATION);
    expect(result.nextStepsPl).toEqual([RETURN_STEP]);
  });

  it("uses the safe next step when all next steps are removed", () => {
    const result = run({ draft: { nextStepsPl: ["Zwrócimy 100 PLN."] } });

    expect(result.nextStepsPl).toEqual([SAFE_NEXT_STEP]);
    expect(result.justificationPl).toBe("Sprzęt kwalifikuje się do zwrotu.");
  });
});

describe("applyGuardrails length limits", () => {
  it("truncates the final justification to 1200 characters", () => {
    const result = run({ draft: { justificationPl: "a".repeat(1300) } });

    expect(result.justificationPl).toHaveLength(1200);
    expect(() => DecisionSchema.parse(result)).not.toThrow();
  });
});
