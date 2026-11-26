// ADR-002 §3.4: the first assistant message. Order and disclaimer are guaranteed by code:
// part 1 is the greeting text, part 2 is the decision card (rendered with the disclaimer).
import { COPY } from "./copy-pl";
import type { CaseInput, ChatUIMessage, Decision } from "./schemas";

export function composeFirstMessage(args: { caseInput: CaseInput; decision: Decision; id: string }): ChatUIMessage {
  const { caseInput, decision, id } = args;
  const caseTypeLabel = COPY.caseTypes[caseInput.caseType].toLowerCase();

  return {
    id,
    role: "assistant",
    parts: [
      {
        type: "text",
        text: `${COPY.decision.greeting}\n\nPrzygotowaliśmy wstępną decyzję w sprawie zgłoszenia: ${caseTypeLabel} — ${caseInput.model}.`,
      },
      { type: "data-decision", id: "decision-initial", data: decision },
    ],
  };
}
