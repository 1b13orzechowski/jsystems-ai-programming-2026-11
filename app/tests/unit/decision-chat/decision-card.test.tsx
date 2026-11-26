import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DecisionCard } from "@/components/decision-chat/decision-card";
import { COPY } from "@/lib/domain/copy-pl";
import { DECISION_DISCLAIMER_PL, type Decision, type DecisionLabel } from "@/lib/domain/schemas";

const base: Decision = {
  label: "zaakceptowano",
  justificationPl: "Syntetyczne uzasadnienie testowe.",
  citedRuleIds: ["Z-1", "R-2"],
  nextStepsPl: ["Wyślij sprzęt na adres serwisu", "Zachowaj paragon"],
  kind: "initial",
  disclaimerPl: DECISION_DISCLAIMER_PL,
};

describe("DecisionCard", () => {
  it.each<DecisionLabel>(["zaakceptowano", "odrzucono", "wymaga_weryfikacji"])(
    "shows the visible label text and a data-decision-label for %s",
    (label) => {
      render(<DecisionCard decision={{ ...base, label }} />);
      const card = screen.getByTestId("decision-card");
      expect(card).toHaveAttribute("data-decision-label", label);
      expect(card).toHaveAttribute("data-decision-kind", "initial");
      expect(within(card).getByText(COPY.decision.labels[label])).toBeInTheDocument();
    },
  );

  it("gives each label a distinct badge with an icon and a status color class", () => {
    const classes = new Set<string>();
    const texts = new Set<string>();
    for (const label of ["zaakceptowano", "odrzucono", "wymaga_weryfikacji"] as const) {
      const { unmount } = render(<DecisionCard decision={{ ...base, label }} />);
      const badge = screen.getByTestId("decision-card").querySelector('[data-slot="decision-badge"]');
      expect(badge).not.toBeNull();
      expect(badge?.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
      expect(badge?.textContent).toBe(COPY.decision.labels[label]);
      const colorClass = Array.from(badge?.classList ?? []).find((name) => name.includes("status-"));
      expect(colorClass).toBeDefined();
      classes.add(colorClass ?? "");
      texts.add(badge?.textContent ?? "");
      unmount();
    }
    expect(classes.size).toBe(3);
    expect(texts.size).toBe(3);
  });

  it("renders the initial heading, justification, cited rules, numbered steps and disclaimer", () => {
    render(<DecisionCard decision={base} />);
    expect(screen.getByRole("heading", { name: COPY.decision.title })).toBeInTheDocument();
    expect(screen.getByText(COPY.decision.justification, { exact: true })).toBeInTheDocument();
    expect(screen.getByText(base.justificationPl)).toBeInTheDocument();
    expect(screen.getByText(`${COPY.decision.citedRules}: Z-1, R-2`)).toBeInTheDocument();
    expect(screen.getByText(COPY.decision.nextSteps, { exact: true })).toBeInTheDocument();
    const items = screen.getByTestId("decision-card").querySelectorAll("ol > li");
    expect(Array.from(items).map((item) => item.textContent)).toEqual(base.nextStepsPl);
    expect(screen.getByText(DECISION_DISCLAIMER_PL)).toBeInTheDocument();
  });

  it("shows the updated heading and the change reason for kind updated", () => {
    render(
      <DecisionCard
        decision={{ ...base, kind: "updated", label: "odrzucono", changeReasonPl: "Klient podał nowe informacje." }}
      />,
    );
    expect(screen.getByRole("heading", { name: COPY.decision.updatedTitle })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: COPY.decision.title })).not.toBeInTheDocument();
    expect(screen.getByText(COPY.decision.changeReason, { exact: true })).toBeInTheDocument();
    expect(screen.getByText("Klient podał nowe informacje.")).toBeInTheDocument();
    expect(screen.getByTestId("decision-card")).toHaveAttribute("data-decision-kind", "updated");
  });

  it("shows the photo problem only when it is present", () => {
    const { unmount } = render(<DecisionCard decision={base} />);
    expect(screen.queryByText(COPY.decision.photoProblem)).not.toBeInTheDocument();
    unmount();
    render(<DecisionCard decision={{ ...base, photoProblemPl: "Zdjęcie jest nieostre." }} />);
    expect(screen.getByText(COPY.decision.photoProblem, { exact: true })).toBeInTheDocument();
    expect(screen.getByText("Zdjęcie jest nieostre.")).toBeInTheDocument();
  });
});
