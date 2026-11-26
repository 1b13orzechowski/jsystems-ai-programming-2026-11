"use client";

import { Button } from "@/components/ui/button";
import type { CaseType } from "@/lib/domain/categories";
import { COPY } from "@/lib/domain/copy-pl";

// Chat-screen top bar (ADR-004 §3.1 AppHeader, PRD 9.2): case type label + "Nowe zgłoszenie".
// The logo and product name are rendered by the root layout header.
export function AppHeader({ caseType, onNewCase }: { caseType: CaseType; onNewCase: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <p className="text-lg font-semibold">{COPY.caseTypes[caseType]}</p>
      <Button type="button" variant="outline" className="min-h-11" onClick={onNewCase}>
        {COPY.app.newCase}
      </Button>
    </div>
  );
}
