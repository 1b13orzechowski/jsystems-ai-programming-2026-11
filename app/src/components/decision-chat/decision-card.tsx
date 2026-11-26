import { COPY } from "@/lib/domain/copy-pl";
import type { Decision } from "@/lib/domain/schemas";

import { DecisionBadge } from "./decision-badge";

export function DecisionCard({ decision }: { decision: Decision }) {
  const isUpdated = decision.kind === "updated";
  return (
    <section
      data-testid="decision-card"
      data-decision-label={decision.label}
      data-decision-kind={decision.kind}
      className="flex w-full flex-col gap-4 rounded-[20px] bg-background p-5 text-foreground shadow-[0_10px_24px_rgba(33,33,33,0.10)]"
    >
      <h2 className="text-lg font-semibold">{isUpdated ? COPY.decision.updatedTitle : COPY.decision.title}</h2>
      <DecisionBadge label={decision.label} />

      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">{COPY.decision.justification}</h3>
        <p className="text-sm leading-relaxed">{decision.justificationPl}</p>
      </div>

      {decision.photoProblemPl ? (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">{COPY.decision.photoProblem}</h3>
          <p className="text-sm leading-relaxed">{decision.photoProblemPl}</p>
        </div>
      ) : null}

      {isUpdated && decision.changeReasonPl ? (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">{COPY.decision.changeReason}</h3>
          <p className="text-sm leading-relaxed">{decision.changeReasonPl}</p>
        </div>
      ) : null}

      <p className="text-sm text-muted-foreground">{`${COPY.decision.citedRules}: ${decision.citedRuleIds.join(", ")}`}</p>

      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">{COPY.decision.nextSteps}</h3>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm leading-relaxed">
          {decision.nextStepsPl.map((step, index) => (
            <li key={`${index}-${step}`}>{step}</li>
          ))}
        </ol>
      </div>

      <p className="border-t border-border pt-3 text-xs text-muted-foreground">{decision.disclaimerPl}</p>
    </section>
  );
}
