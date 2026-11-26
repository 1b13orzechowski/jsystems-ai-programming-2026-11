import { expect, type Locator, type Page } from "@playwright/test";

import { COPY } from "@/lib/domain/copy-pl";
import { DECISION_DISCLAIMER_PL } from "@/lib/domain/schemas";

export type DecisionKind = "initial" | "updated";

// Machine labels from the decision contract (data-decision-label); the visible text comes from COPY.
const LABEL_TEXT: Record<string, string> = {
  zaakceptowano: COPY.decision.labels.zaakceptowano,
  odrzucono: COPY.decision.labels.odrzucono,
  wymaga_weryfikacji: COPY.decision.labels.wymaga_weryfikacji,
};

export const DECISION_LABELS: string[] = Object.keys(LABEL_TEXT);

export function decisionCards(page: Page): Locator {
  return page.getByTestId("decision-card");
}

export function decisionCard(page: Page, kind: DecisionKind = "initial"): Locator {
  return page.locator(`[data-testid="decision-card"][data-decision-kind="${kind}"]`);
}

/** Asserts the decision card structure (AC-14, AC-15) without depending on the model's prose. */
export async function expectDecisionStructure(card: Locator, kind: DecisionKind = "initial"): Promise<void> {
  await expect(card).toHaveAttribute("data-decision-kind", kind);

  const label = await card.getAttribute("data-decision-label");
  expect(label).not.toBeNull();
  expect(DECISION_LABELS).toContain(label);
  await expect(card).toContainText(LABEL_TEXT[label ?? ""] ?? "");

  const title = kind === "initial" ? COPY.decision.title : COPY.decision.updatedTitle;
  await expect(card.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(card.getByText(COPY.decision.justification, { exact: true })).toBeVisible();
  await expect(card.getByText(COPY.decision.nextSteps, { exact: true })).toBeVisible();
  await expect(card.locator("ol li").first()).toBeVisible();
  await expect(card.getByText(DECISION_DISCLAIMER_PL, { exact: true })).toBeVisible();
}

/** The visible text of the decision label as shown in the card (for label-specific assertions). */
export function labelText(label: string): string {
  return LABEL_TEXT[label] ?? "";
}
