"use client";

import { CaseForm } from "@/components/case-form/case-form";
import { ErrorBanner } from "@/components/case-form/error-banner";
import { ProcessingPanel } from "@/components/case-form/processing-panel";
import type { CaseFormValues, CaseSubmission, SelectedPhoto } from "@/components/case-form/types";

type CaseFormScreenProps = {
  initialValues: CaseFormValues;
  initialPhoto: SelectedPhoto | null;
  processing: boolean;
  stage: "analyzing" | "deciding" | null;
  submitError: string | null;
  onSubmit: (submission: CaseSubmission) => void;
  onRetry: () => void;
};

// Intro text lives in the layout. The banner sits above the form; the panel shows while processing.
export function CaseFormScreen({
  initialValues,
  initialPhoto,
  processing,
  stage,
  submitError,
  onSubmit,
  onRetry,
}: CaseFormScreenProps) {
  return (
    <div className="flex flex-col gap-6">
      {submitError !== null ? <ErrorBanner onRetry={onRetry} /> : null}
      {processing ? <ProcessingPanel stage={stage} /> : null}
      <CaseForm initialValues={initialValues} initialPhoto={initialPhoto} disabled={processing} onSubmit={onSubmit} />
    </div>
  );
}
