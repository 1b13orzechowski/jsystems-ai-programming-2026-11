// T17 — page state machine (ADR-004 §4, AC-09, AC-12, AC-13, AC-21, AC-30…AC-32).
// Children are mocked (unit layer); the submitCase result is taken from the real capture
// tests/fixtures/captures/api-case/success-reklamacja-laptop-1.json (data-case part).
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { CaseSubmission } from "@/components/case-form/types";
import { COPY } from "@/lib/domain/copy-pl";
import type { CaseResult } from "@/lib/domain/schemas";
import type { SubmitCaseResult } from "@/lib/client/submit-case";

const captured = z
  .object({ response: z.object({ body: z.string() }) })
  .parse(JSON.parse(readFileSync(join(process.cwd(), "tests/fixtures/captures/api-case/success-reklamacja-laptop-1.json"), "utf8")));

function capturedCaseResult(): CaseResult {
  for (const line of captured.response.body.split("\n")) {
    if (!line.startsWith("data: {")) continue;
    const chunk: unknown = JSON.parse(line.slice(6));
    const parsed = z.object({ type: z.literal("data-case"), data: z.custom<CaseResult>() }).safeParse(chunk);
    if (parsed.success) return parsed.data.data;
  }
  throw new Error("capture has no data-case part");
}

const submission: CaseSubmission = {
  input: { caseType: "reklamacja", category: "Laptop", model: "ThinkBook 14", purchaseDate: "2026-01-01", reason: "Laptop przestał się ładować po kilku miesiącach." },
  photo: { originalFile: new File(["x"], "laptop-1.png", { type: "image/png" }), previewUrl: "blob:preview-1", jpegBlob: new Blob(["y"], { type: "image/jpeg" }), name: "laptop-1.png" },
};

type Deferred = { resolve: (value: SubmitCaseResult) => void };
const pending: Deferred[] = [];
const submitCase = vi.fn(
  (args: { onStage: (stage: "analyzing" | "deciding") => void }) =>
    new Promise<SubmitCaseResult>((resolve) => {
      args.onStage("analyzing");
      pending.push({ resolve });
    }),
);
vi.mock("@/lib/client/submit-case", () => ({ submitCase: (args: { onStage: (stage: "analyzing" | "deciding") => void }) => submitCase(args) }));

vi.mock("@/components/case-form/case-form-screen", () => ({
  CaseFormScreen: (props: { processing: boolean; stage: string | null; submitError: string | null; initialValues: { model: string }; onSubmit: (s: CaseSubmission) => void; onRetry: () => void }) => (
    <div data-testid="form-screen" data-processing={String(props.processing)} data-stage={props.stage ?? ""} data-error={props.submitError ?? ""} data-model={props.initialValues.model}>
      <button type="button" onClick={() => props.onSubmit(submission)}>submit</button>
      <button type="button" onClick={props.onRetry}>retry</button>
    </div>
  ),
}));
vi.mock("@/components/decision-chat/chat-panel", () => ({
  ChatPanel: (props: { caseId: string; caseToken: string }) => <div data-testid="chat-panel" data-case-id={props.caseId} data-token={props.caseToken} />,
}));
vi.mock("@/components/decision-chat/case-summary", () => ({
  CaseSummary: (props: { input: { model: string }; photoUrl: string | null }) => <div data-testid="case-summary" data-model={props.input.model} data-photo={props.photoUrl ?? ""} />,
}));

const { default: Home } = await import("@/app/page");

beforeEach(() => {
  submitCase.mockClear();
  pending.length = 0;
  URL.revokeObjectURL = vi.fn();
});

async function submitAndResolve(result: SubmitCaseResult): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: "submit" }));
  await act(async () => {
    pending[0]?.resolve(result);
  });
}

describe("Home page state machine", () => {
  it("starts on the empty form (AC-30)", () => {
    render(<Home />);
    expect(screen.getByTestId("form-screen")).toHaveAttribute("data-processing", "false");
    expect(screen.queryByTestId("chat-panel")).not.toBeInTheDocument();
  });

  it("shows processing with the stage and ignores a second submission (AC-09, AC-12)", async () => {
    render(<Home />);
    await userEvent.click(screen.getByRole("button", { name: "submit" }));
    expect(screen.getByTestId("form-screen")).toHaveAttribute("data-processing", "true");
    expect(screen.getByTestId("form-screen")).toHaveAttribute("data-stage", "analyzing");
    await userEvent.click(screen.getByRole("button", { name: "submit" }));
    expect(submitCase).toHaveBeenCalledTimes(1);
  });

  it("goes to the chat with the case summary and the token after success (AC-21)", async () => {
    const result = capturedCaseResult();
    render(<Home />);
    await submitAndResolve({ ok: true, result });
    expect(screen.getByTestId("chat-panel")).toHaveAttribute("data-case-id", result.caseId);
    expect(screen.getByTestId("chat-panel")).toHaveAttribute("data-token", result.caseToken);
    expect(screen.getByTestId("case-summary")).toHaveAttribute("data-model", "ThinkBook 14");
    expect(screen.getByTestId("case-summary")).toHaveAttribute("data-photo", "blob:preview-1");
    expect(screen.getByRole("button", { name: COPY.app.newCase })).toBeInTheDocument();
  });

  it("returns to the form with values kept and the error code on failure, and retry resubmits (AC-13)", async () => {
    render(<Home />);
    await submitAndResolve({ ok: false, code: "PROCESSING_FAILED" });
    const form = screen.getByTestId("form-screen");
    expect(form).toHaveAttribute("data-processing", "false");
    expect(form).toHaveAttribute("data-error", "PROCESSING_FAILED");
    expect(form).toHaveAttribute("data-model", "ThinkBook 14");
    await userEvent.click(screen.getByRole("button", { name: "retry" }));
    expect(submitCase).toHaveBeenCalledTimes(2);
  });

  it("asks before leaving during an active chat only (AC-31)", async () => {
    render(<Home />);
    const before = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(before);
    expect(before.defaultPrevented).toBe(false);
    await submitAndResolve({ ok: true, result: capturedCaseResult() });
    const during = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(during);
    expect(during.defaultPrevented).toBe(true);
  });

  it("new case: cancel keeps the chat, confirm clears it and revokes the photo URL (AC-32)", async () => {
    render(<Home />);
    await submitAndResolve({ ok: true, result: capturedCaseResult() });
    await userEvent.click(screen.getByRole("button", { name: COPY.app.newCase }));
    await userEvent.click(screen.getByRole("button", { name: COPY.newCaseDialog.cancel }));
    expect(screen.getByTestId("chat-panel")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: COPY.app.newCase }));
    await userEvent.click(screen.getByRole("button", { name: COPY.newCaseDialog.confirm }));
    expect(screen.queryByTestId("chat-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("form-screen")).toHaveAttribute("data-model", "");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
  });
});
