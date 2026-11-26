"use client";

import { Spinner } from "@/components/ui/spinner";
import { COPY } from "@/lib/domain/copy-pl";

export function ProcessingPanel({ stage }: { stage: "analyzing" | "deciding" | null }) {
  // The first stage is shown until the server reports the second one (AC-12).
  const text = stage === "deciding" ? COPY.processing.deciding : COPY.processing.analyzing;
  return (
    <section
      aria-live="polite"
      className="flex items-center gap-3 rounded-[20px] border border-status-info-border bg-status-info-bg p-4 text-status-info-text"
    >
      <Spinner aria-hidden="true" className="shrink-0" />
      <p className="text-base">{text}</p>
    </section>
  );
}
