import { CircleCheck, CircleX, Clock } from "lucide-react";

import { cn } from "cn";
import { COPY } from "@/lib/domain/copy-pl";
import type { DecisionLabel } from "@/lib/domain/schemas";

// ADR-004 §3.4: badge = icon + text + color, never color alone; colors are status tokens from globals.css.
const LABEL_STYLES: Record<DecisionLabel, { icon: typeof CircleCheck; className: string }> = {
  zaakceptowano: {
    icon: CircleCheck,
    className: "border-status-approved-border bg-status-approved-bg text-status-approved-text",
  },
  odrzucono: {
    icon: CircleX,
    className: "border-status-rejected-border bg-status-rejected-bg text-status-rejected-text",
  },
  wymaga_weryfikacji: {
    icon: Clock,
    className: "border-status-review-border bg-status-review-bg text-status-review-text",
  },
};

export function DecisionBadge({ label }: { label: DecisionLabel }) {
  const { icon: Icon, className } = LABEL_STYLES[label];
  return (
    <span
      data-slot="decision-badge"
      className={cn(
        "inline-flex min-h-8 w-fit items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-semibold",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {COPY.decision.labels[label]}
    </span>
  );
}
