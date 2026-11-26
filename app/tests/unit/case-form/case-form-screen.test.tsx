// PRD 4.6 / AC-12 / AC-13 and ADR-004 §3.1: processing panel, error banner and the form screen composition.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { CaseFormScreen } from "@/components/case-form/case-form-screen";
import { ErrorBanner } from "@/components/case-form/error-banner";
import { ProcessingPanel } from "@/components/case-form/processing-panel";
import { EMPTY_CASE_FORM_VALUES } from "@/components/case-form/types";
import { COPY } from "@/lib/domain/copy-pl";

beforeAll(() => {
  // jsdom lacks the APIs the Radix Select (rendered by CaseForm) uses.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

describe("ProcessingPanel (AC-12)", () => {
  it("shows the analyzing stage in a polite live region", () => {
    render(<ProcessingPanel stage="analyzing" />);
    const region = screen.getByText(COPY.processing.analyzing, { exact: true }).closest('[aria-live="polite"]');
    expect(region).not.toBeNull();
    expect(screen.queryByText(COPY.processing.deciding)).not.toBeInTheDocument();
  });

  it("shows the deciding stage text after the analyzing stage", () => {
    render(<ProcessingPanel stage="deciding" />);
    expect(screen.getByText(COPY.processing.deciding, { exact: true })).toBeVisible();
    expect(screen.getByText(COPY.processing.deciding, { exact: true }).closest('[aria-live="polite"]')).not.toBeNull();
  });
});

describe("ErrorBanner (AC-13)", () => {
  it("renders role=alert with the message and calls onRetry from the retry button", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorBanner onRetry={onRetry} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(COPY.errorBanner.message);
    await user.click(screen.getByRole("button", { name: COPY.errorBanner.retry }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("CaseFormScreen composition", () => {
  const baseProps = {
    initialValues: EMPTY_CASE_FORM_VALUES,
    initialPhoto: null,
    onSubmit: vi.fn(),
    onRetry: vi.fn(),
  };

  it("shows neither the banner nor the panel in the normal state", () => {
    render(<CaseFormScreen {...baseProps} processing={false} stage={null} submitError={null} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(COPY.processing.analyzing)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: COPY.form.submit })).toBeEnabled();
  });

  it("shows the processing panel and disables the form while processing", () => {
    render(<CaseFormScreen {...baseProps} processing stage="analyzing" submitError={null} />);
    expect(screen.getByText(COPY.processing.analyzing, { exact: true })).toBeVisible();
    expect(screen.getByRole("button", { name: COPY.form.submit })).toBeDisabled();
  });

  it("shows the error banner above the form when submitError is set", () => {
    render(<CaseFormScreen {...baseProps} processing={false} stage={null} submitError="PROCESSING_FAILED" />);
    expect(screen.getByRole("alert")).toHaveTextContent(COPY.errorBanner.message);
    expect(screen.getByRole("button", { name: COPY.form.submit })).toBeEnabled();
  });
});
