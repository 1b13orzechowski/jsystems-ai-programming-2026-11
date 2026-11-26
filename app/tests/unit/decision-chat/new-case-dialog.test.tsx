import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NewCaseDialog } from "@/components/decision-chat/new-case-dialog";
import { COPY } from "@/lib/domain/copy-pl";

describe("NewCaseDialog", () => {
  it("renders nothing when closed", () => {
    render(<NewCaseDialog open={false} onOpenChange={() => undefined} onConfirm={() => undefined} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the title, description and both buttons with no English close control", () => {
    render(<NewCaseDialog open onOpenChange={() => undefined} onConfirm={() => undefined} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: COPY.newCaseDialog.title })).toBeInTheDocument();
    expect(screen.getByText(COPY.newCaseDialog.description)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: COPY.newCaseDialog.cancel })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: COPY.newCaseDialog.confirm })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });

  it("calls onConfirm when confirmed", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn<() => void>();
    render(<NewCaseDialog open onOpenChange={() => undefined} onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: COPY.newCaseDialog.confirm }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("closes without confirming when cancelled", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn<() => void>();
    const onOpenChange = vi.fn<(open: boolean) => void>();
    render(<NewCaseDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: COPY.newCaseDialog.cancel }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
