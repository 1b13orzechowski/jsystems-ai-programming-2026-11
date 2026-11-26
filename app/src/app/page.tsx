"use client";

// Page state machine (ADR-004 §4): form → processing → chat. All state lives in memory only (AC-30).
import { useCallback, useEffect, useRef, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { CaseFormScreen } from "@/components/case-form/case-form-screen";
import { type CaseFormValues, type CaseSubmission, EMPTY_CASE_FORM_VALUES, type SelectedPhoto } from "@/components/case-form/types";
import { CaseSummary } from "@/components/decision-chat/case-summary";
import { ChatPanel } from "@/components/decision-chat/chat-panel";
import { NewCaseDialog } from "@/components/decision-chat/new-case-dialog";
import { submitCase } from "@/lib/client/submit-case";
import type { CaseInput, CaseResult } from "@/lib/domain/schemas";

type Phase = "form" | "processing" | "chat";
type Stage = "analyzing" | "deciding";
type CaseSession = CaseResult & { input: CaseInput };

function toFormValues(input: CaseInput): CaseFormValues {
  return { caseType: input.caseType, category: input.category, model: input.model, purchaseDate: input.purchaseDate, reason: input.reason };
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("form");
  const [formValues, setFormValues] = useState<CaseFormValues>(EMPTY_CASE_FORM_VALUES);
  const [photo, setPhoto] = useState<SelectedPhoto | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [caseSession, setCaseSession] = useState<CaseSession | null>(null);
  const [newCaseOpen, setNewCaseOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const submitting = useRef(false);
  const lastSubmission = useRef<CaseSubmission | null>(null);

  const handleSubmit = useCallback(async (submission: CaseSubmission) => {
    if (submitting.current) return; // AC-09: one submission at a time
    submitting.current = true;
    lastSubmission.current = submission;
    setFormValues(toFormValues(submission.input));
    setPhoto(submission.photo);
    setSubmitError(null);
    setStage("analyzing");
    setPhase("processing");
    try {
      const outcome = await submitCase({ input: submission.input, photo: submission.photo, onStage: setStage });
      if (outcome.ok) {
        setCaseSession({ ...outcome.result, input: submission.input });
        setPhase("chat");
      } else {
        setSubmitError(outcome.code);
        setPhase("form");
      }
    } finally {
      setStage(null);
      submitting.current = false;
    }
  }, []);

  const handleRetry = useCallback(() => {
    if (lastSubmission.current !== null) void handleSubmit(lastSubmission.current);
  }, [handleSubmit]);

  const startNewCase = useCallback(() => {
    if (photo !== null) URL.revokeObjectURL(photo.previewUrl);
    lastSubmission.current = null;
    setPhoto(null);
    setFormValues(EMPTY_CASE_FORM_VALUES);
    setSubmitError(null);
    setCaseSession(null);
    setNewCaseOpen(false);
    setFormKey((key) => key + 1);
    setPhase("form");
  }, [photo]);

  // AC-31: confirm before reload/close during an active chat.
  useEffect(() => {
    if (phase !== "chat") return undefined;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [phase]);

  if (phase === "chat" && caseSession !== null) {
    return (
      <main id="main-content" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
        <AppHeader caseType={caseSession.input.caseType} onNewCase={() => setNewCaseOpen(true)} />
        <div className="flex flex-1 flex-col gap-6 lg:flex-row">
          <aside className="lg:w-80 lg:shrink-0">
            <CaseSummary input={caseSession.input} photoUrl={photo?.previewUrl ?? null} />
          </aside>
          <section className="flex min-h-[60vh] min-w-0 flex-1 flex-col">
            <ChatPanel caseId={caseSession.caseId} caseToken={caseSession.caseToken} firstMessage={caseSession.firstMessage} />
          </section>
        </div>
        <NewCaseDialog open={newCaseOpen} onOpenChange={setNewCaseOpen} onConfirm={startNewCase} />
      </main>
    );
  }

  return (
    <main id="main-content" className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <CaseFormScreen
        key={formKey}
        initialValues={formValues}
        initialPhoto={photo}
        processing={phase === "processing"}
        stage={stage}
        submitError={submitError}
        onSubmit={(submission) => void handleSubmit(submission)}
        onRetry={handleRetry}
      />
    </main>
  );
}
