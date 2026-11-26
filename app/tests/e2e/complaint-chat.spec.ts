import { expect, test } from "@playwright/test";

import { COPY } from "@/lib/domain/copy-pl";

import { assistantMessages, chatInput, chatMessages, sendButton, sendChatMessage, waitForReply } from "./helpers/chat";
import { submitCaseAndWaitForChat } from "./helpers/case-form";
import { collectErrors } from "./helpers/console";
import { monthsAgo } from "./helpers/dates";
import { decisionCard, decisionCards, expectDecisionStructure } from "./helpers/decision";

const COMPLAINT_REASON = "Laptop przestał się ładować po kilku tygodniach od zakupu.";

// PRD flows 4.2 (complaint) and 4.4 (follow-up questions in the chat), one real case.
test("flows 4.2 and 4.4: complaint decision, follow-up questions and composer rules", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");

  await submitCaseAndWaitForChat(page, {
    caseType: COPY.caseTypes.reklamacja,
    category: "Laptop",
    model: "ThinkBook 14",
    purchaseDate: monthsAgo(11),
    reason: COMPLAINT_REASON,
    photo: "laptop-1.png",
  });

  const initial = decisionCard(page, "initial");
  await expect(initial).toBeVisible({ timeout: 90_000 });
  await expectDecisionStructure(initial, "initial");

  // AC-27: the chat composer has no file input or attach button.
  const composer = chatInput(page).locator("xpath=ancestor::form[1]");
  await expect(composer).toHaveCount(1);
  await expect(composer.locator('input[type="file"]')).toHaveCount(0);
  await expect(composer.getByRole("button", { name: /załącz|dołącz|plik|zdjęci|attach|upload/i })).toHaveCount(0);

  // AC-23, AC-24: the send button is disabled and the typing indicator shows while the reply is generated.
  await sendChatMessage(page, "Jaki model zgłosiłem?");
  await expect(sendButton(page)).toBeDisabled();
  await expect(page.getByText(COPY.chat.typing, { exact: true })).toBeVisible();
  await waitForReply(page);

  // AC-24: the reply uses the model the user entered.
  await expect(assistantMessages(page).last()).toContainText("ThinkBook");

  // AC-26: an off-topic request gets a short reply that offers help with the case, not a poem.
  await sendChatMessage(page, "Napisz wiersz o kotach");
  await waitForReply(page);
  const offTopic = (await assistantMessages(page).last().innerText()).trim();
  expect(offTopic.length).toBeLessThanOrEqual(400);
  expect(offTopic).toMatch(/zgłoszen|sprawy|reklamacj|pomóc|pomoc/i);

  // AC-25: new information may change the decision. Earlier messages must stay unchanged.
  const messagesBefore = await chatMessages(page).allInnerTexts();
  await sendChatMessage(page, "Laptop spadł mi wcześniej na podłogę i od tego czasu się nie ładuje.");
  await waitForReply(page);

  const updated = decisionCard(page, "updated");
  if ((await updated.count()) > 0) {
    await expectDecisionStructure(updated, "updated");
  } else {
    test.info().annotations.push({
      type: "note",
      description: "AC-25: the model kept the initial decision; no updated decision card was shown.",
    });
  }
  const messagesAfter = await chatMessages(page).allInnerTexts();
  expect(messagesAfter.slice(0, messagesBefore.length)).toEqual(messagesBefore);

  // AC-29: assistant messages contain no raw Markdown markers.
  for (const text of await assistantMessages(page).allInnerTexts()) {
    expect(text).not.toContain("**");
    expect(text).not.toContain("##");
  }

  await expect(decisionCards(page).first()).toBeVisible();
  expect(errors).toEqual([]);
});
