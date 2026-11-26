import { expect, test } from "@playwright/test";

import { COPY } from "@/lib/domain/copy-pl";

import { assistantMessages, sendChatMessage, waitForReply } from "./helpers/chat";
import { submitCaseAndWaitForChat } from "./helpers/case-form";
import { daysAgo } from "./helpers/dates";
import { decisionCard } from "./helpers/decision";

const QUESTION = "Czy mogę jeszcze dosłać zdjęcie opakowania?";

test("AC-28: a chat message sent offline keeps the text, shows the chat error and retry resumes the reply", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await submitCaseAndWaitForChat(page, {
    caseType: COPY.caseTypes.zwrot,
    category: "Smartfon",
    model: "Galaxy S30",
    purchaseDate: daysAgo(2),
    photo: "phone-2.jpeg",
  });
  await expect(decisionCard(page, "initial")).toBeVisible({ timeout: 90_000 });
  await waitForReply(page);

  const repliesBefore = await assistantMessages(page).count();

  await context.setOffline(true);
  await sendChatMessage(page, QUESTION);

  // The user's message stays on screen and the chat error with the retry button appears.
  await expect(page.getByText(QUESTION, { exact: true })).toBeVisible();
  await expect(page.getByText(COPY.chat.error, { exact: false })).toBeVisible({ timeout: 30_000 });
  const retry = page.getByRole("button", { name: COPY.chat.retry, exact: true });
  await expect(retry).toBeVisible();

  await context.setOffline(false);
  await retry.click();

  // The assistant reply arrives: one more assistant message than before, and the input is usable again.
  await expect(assistantMessages(page)).toHaveCount(repliesBefore + 1, { timeout: 90_000 });
  await waitForReply(page);
  await expect(page.getByText(COPY.chat.error, { exact: false })).toHaveCount(0);
});
