import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CaseSummary } from "@/components/decision-chat/case-summary";
import { COPY } from "@/lib/domain/copy-pl";
import type { CaseInput } from "@/lib/domain/schemas";

const longReason = "Syntetyczny powód zgłoszenia. ".repeat(12).trim();

const input: CaseInput = {
  caseType: "reklamacja",
  category: "Laptop",
  model: "Model Testowy X1",
  purchaseDate: "2026-03-07",
  reason: longReason,
};

describe("CaseSummary", () => {
  it("shows the case data with the purchase date formatted dd.MM.yyyy", () => {
    render(<CaseSummary input={input} photoUrl="blob:test-photo" />);
    const summary = screen.getByTestId("case-summary");
    expect(within(summary).getByText(COPY.caseTypes.reklamacja)).toBeInTheDocument();
    expect(within(summary).getByText("Laptop")).toBeInTheDocument();
    expect(within(summary).getByText("Model Testowy X1")).toBeInTheDocument();
    expect(within(summary).getByText("07.03.2026")).toBeInTheDocument();
  });

  it("clamps a long reason and toggles it with Pokaż więcej / Pokaż mniej", async () => {
    const user = userEvent.setup();
    render(<CaseSummary input={input} photoUrl="blob:test-photo" />);
    const toggle = screen.getByRole("button", { name: COPY.summary.showMore });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(screen.getByRole("button", { name: COPY.summary.showLess })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("shows the no-reason copy when the reason is empty", () => {
    render(<CaseSummary input={{ ...input, caseType: "zwrot", reason: "" }} photoUrl="blob:test-photo" />);
    expect(screen.getByText(COPY.summary.noReason)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: COPY.summary.showMore })).not.toBeInTheDocument();
  });

  it("opens the large photo in a dialog from the thumbnail (AC-21)", async () => {
    const user = userEvent.setup();
    render(<CaseSummary input={input} photoUrl="blob:test-photo" />);
    await user.click(screen.getByRole("button", { name: COPY.summary.photoOpen }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("img", { name: COPY.summary.photoAlt })).toHaveAttribute("src", "blob:test-photo");
    await user.click(within(dialog).getByRole("button", { name: COPY.summary.close }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("toggles the details on mobile through the collapse button", async () => {
    const user = userEvent.setup();
    render(<CaseSummary input={input} photoUrl="blob:test-photo" />);
    const toggle = screen.getByRole("button", { name: COPY.summary.toggle });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
});
