import { expect, type Locator, type Page } from "@playwright/test";

import { COPY } from "@/lib/domain/copy-pl";

export function chatMessages(page: Page): Locator {
  return page.getByRole("list", { name: COPY.chat.messagesLabel }).getByTestId("chat-message");
}

export function assistantMessages(page: Page): Locator {
  return page.getByTestId("chat-message").and(page.locator('[data-role="assistant"]'));
}

export function userMessages(page: Page): Locator {
  return page.getByTestId("chat-message").and(page.locator('[data-role="user"]'));
}

export function chatInput(page: Page): Locator {
  return page.getByRole("textbox", { name: COPY.chat.inputLabel });
}

export function sendButton(page: Page): Locator {
  return page.getByRole("button", { name: COPY.chat.send, exact: true });
}

/** Types a message in the chat input and sends it with the send button. */
export async function sendChatMessage(page: Page, text: string): Promise<void> {
  await chatInput(page).fill(text);
  await sendButton(page).click();
}

/** Waits until the assistant has finished replying (typing indicator gone, send button enabled again). */
export async function waitForReply(page: Page, timeout = 90_000): Promise<void> {
  await expect(page.getByText(COPY.chat.typing, { exact: true })).toHaveCount(0, { timeout });
  await expect(sendButton(page)).toBeEnabled({ timeout });
}
