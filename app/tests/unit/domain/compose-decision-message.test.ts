import { describe, expect, it } from "vitest";

import { COPY } from "@/lib/domain/copy-pl";
import { composeFirstMessage } from "@/lib/domain/compose-decision-message";
import { DECISION_DISCLAIMER_PL, type CaseInput, type Decision } from "@/lib/domain/schemas";

const CASE_INPUT: CaseInput = {
  caseType: "reklamacja",
  category: "Smartfon",
  model: "Galaxy S30",
  purchaseDate: "2025-06-01",
  reason: "Ekran miga po upadku.",
};

const NEXT_STEPS = ["Krok 1.", "Krok 2.", "Krok 3.", "Krok 4.", "Krok 5.", "Krok 6."];

const DECISION: Decision = {
  label: "wymaga_weryfikacji",
  justificationPl: "Sprzęt wymaga sprawdzenia przez pracownika.",
  citedRuleIds: ["R-1"],
  nextStepsPl: NEXT_STEPS,
  kind: "initial",
  disclaimerPl: DECISION_DISCLAIMER_PL,
};

function firstText(message: ReturnType<typeof composeFirstMessage>): string {
  const part = message.parts[0];
  if (part?.type !== "text") throw new Error("first part is not a text part");
  return part.text;
}

describe("composeFirstMessage", () => {
  it("returns an assistant message with the given id and exactly two parts in order", () => {
    const message = composeFirstMessage({ caseInput: CASE_INPUT, decision: DECISION, id: "msg-1" });

    expect(message.id).toBe("msg-1");
    expect(message.role).toBe("assistant");
    expect(message.parts).toHaveLength(2);
    expect(message.parts[0]?.type).toBe("text");
    expect(message.parts[1]?.type).toBe("data-decision");
  });

  it("starts the text part with the greeting on its own line", () => {
    const text = firstText(composeFirstMessage({ caseInput: CASE_INPUT, decision: DECISION, id: "msg-1" }));
    const [firstLine] = text.split("\n");

    expect(firstLine).toBe(COPY.decision.greeting);
    expect(firstLine).toBe("Dzień dobry,");
  });

  it("names the case type in lower case and the model in the sentence", () => {
    const text = firstText(composeFirstMessage({ caseInput: CASE_INPUT, decision: DECISION, id: "msg-1" }));

    expect(text).toBe(
      "Dzień dobry,\nPrzygotowaliśmy wstępną decyzję w sprawie zgłoszenia: reklamacja — Galaxy S30.",
    );
  });

  it("puts the decision with its disclaimer in the data-decision part", () => {
    const message = composeFirstMessage({ caseInput: CASE_INPUT, decision: DECISION, id: "msg-1" });

    expect(message.parts[1]).toEqual({ type: "data-decision", id: "decision-initial", data: DECISION });
    const data = message.parts[1]?.type === "data-decision" ? message.parts[1].data : undefined;
    expect(data?.disclaimerPl).toBe(DECISION_DISCLAIMER_PL);
  });

  it("preserves all six next steps in the decision part", () => {
    const message = composeFirstMessage({ caseInput: CASE_INPUT, decision: DECISION, id: "msg-1" });
    const data = message.parts[1]?.type === "data-decision" ? message.parts[1].data : undefined;

    expect(data?.nextStepsPl).toEqual(NEXT_STEPS);
  });
});
