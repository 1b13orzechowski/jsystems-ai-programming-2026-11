import { expect, test } from "@playwright/test";

import { COPY } from "@/lib/domain/copy-pl";
import { DECISION_DISCLAIMER_PL } from "@/lib/domain/schemas";

import { assistantMessages, chatMessages } from "./helpers/chat";
import { fillCase, formField, submitCase, waitForChat } from "./helpers/case-form";
import { collectErrors } from "./helpers/console";
import { daysAgo } from "./helpers/dates";
import { decisionCard, decisionCards, expectDecisionStructure } from "./helpers/decision";

// PRD flow 4.1: return of a smartphone with a real photo, purchased 3 days ago.
test("flow 4.1: return of a smartphone from form to decision card", async ({ page }) => {
  const errors = collectErrors(page);
  const purchaseDate = daysAgo(3);
  await page.goto("/");

  await fillCase(page, {
    caseType: COPY.caseTypes.zwrot,
    category: "Smartfon",
    model: "Galaxy S30",
    purchaseDate,
    photo: "phone-1.jpg",
  });
  await submitCase(page);

  // AC-12: stage text appears in the aria-live region while the case is processed.
  await expect(page.getByText(COPY.processing.analyzing, { exact: true })).toBeVisible({ timeout: 30_000 });

  // AC-09: fields are disabled while processing, if the form is still on screen.
  const model = formField(page, COPY.form.labels.model);
  if (await model.isVisible()) {
    await expect(model).toBeDisabled();
  }

  await waitForChat(page);

  // AC-21: the case summary shows case type, category, model, purchase date (dd.MM.yyyy) and the photo.
  const summary = page.getByTestId("case-summary");
  await expect(summary).toContainText(COPY.caseTypes.zwrot);
  await expect(summary).toContainText("Smartfon");
  await expect(summary).toContainText("Galaxy S30");
  await expect(summary).toContainText(toPolishDate(purchaseDate));
  // On narrow screens the summary details are collapsed behind a toggle (PRD 9.2); open them like a user.
  const toggle = summary.getByRole("button", { name: COPY.summary.toggle });
  if (await toggle.isVisible()) await toggle.click();
  await expect(summary.getByRole("button", { name: COPY.summary.photoOpen }).locator("img")).toBeVisible();

  // AC-15: the first assistant message is the greeting and sits above the decision card.
  const firstAssistant = assistantMessages(page).first();
  await expect(firstAssistant).toContainText(COPY.decision.greeting);

  // AC-14, AC-15: exactly one initial decision card with one allowed label, justification,
  // numbered steps and the disclaimer, in that order.
  const card = decisionCard(page, "initial");
  await expect(card).toBeVisible({ timeout: 90_000 });
  await expect(decisionCards(page)).toHaveCount(1);
  await expectDecisionStructure(card, "initial");

  const greetingBox = await firstAssistant.boundingBox();
  const cardBox = await card.boundingBox();
  expect(greetingBox).not.toBeNull();
  expect(cardBox).not.toBeNull();
  expect((greetingBox?.y ?? Number.NaN) < (cardBox?.y ?? Number.NaN)).toBe(true);

  const stepsBox = await card.locator("ol").first().boundingBox();
  const disclaimerBox = await card.getByText(DECISION_DISCLAIMER_PL, { exact: true }).boundingBox();
  expect((stepsBox?.y ?? Number.NaN) < (disclaimerBox?.y ?? Number.NaN)).toBe(true);

  // AC-20: no monetary amounts appear anywhere in the chat.
  for (const text of await chatMessages(page).allInnerTexts()) {
    expect(text).not.toMatch(/\d+\s*(zł|pln|€)/i);
  }

  expect(errors).toEqual([]);
});

/** YYYY-MM-DD to the dd.MM.yyyy format shown in the case summary. */
function toPolishDate(isoDate: string): string {
  const [year = "", month = "", day = ""] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}
