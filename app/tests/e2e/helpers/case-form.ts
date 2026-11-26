import { join } from "node:path";

import { expect, type Locator, type Page } from "@playwright/test";

import { COPY } from "@/lib/domain/copy-pl";

export type CaseInput = {
  caseType: typeof COPY.caseTypes.zwrot | typeof COPY.caseTypes.reklamacja;
  category: string;
  model: string;
  purchaseDate: string;
  reason?: string;
  photo?: string;
};

const CHAT_TIMEOUT = 90_000;

/** Absolute path of a real photo in assets/example-images (only the five real files are allowed). */
export function photoPath(name: string): string {
  // This file lives in app/tests/e2e/helpers, so four levels up reaches the repository root.
  return join(__dirname, "..", "..", "..", "..", "assets", "example-images", name);
}

export function formField(page: Page, label: string): Locator {
  return page.getByLabel(label);
}

/** Fills the case form through the real UI controls. Only the fields given are touched. */
export async function fillCase(page: Page, input: CaseInput): Promise<void> {
  await page.getByRole("radio", { name: input.caseType, exact: true }).click();

  await page.getByRole("combobox", { name: COPY.form.labels.category }).click();
  await page.getByRole("option", { name: input.category, exact: true }).click();

  await formField(page, COPY.form.labels.model).fill(input.model);
  await formField(page, COPY.form.labels.purchaseDate).fill(input.purchaseDate);

  if (input.reason !== undefined) {
    await formField(page, COPY.form.labels.reason).fill(input.reason);
  }
  if (input.photo !== undefined) {
    await page.getByTestId("photo-input").setInputFiles(photoPath(input.photo));
    // Like a person, wait until the photo is prepared (client downscaling) and its thumbnail is shown.
    await expect(page.getByRole("img", { name: COPY.form.photoThumbnailAlt })).toBeVisible({ timeout: 30_000 });
  }
}

export async function submitCase(page: Page): Promise<void> {
  await page.getByRole("button", { name: COPY.form.submit, exact: true }).click();
}

/** Waits for the chat screen (the case summary is rendered only there). Real LLM: generous timeout. */
export async function waitForChat(page: Page): Promise<void> {
  await expect(page.getByTestId("case-summary")).toBeVisible({ timeout: CHAT_TIMEOUT });
}

/** Fill, submit and wait for the chat screen with the first decision. */
export async function submitCaseAndWaitForChat(page: Page, input: CaseInput): Promise<void> {
  await fillCase(page, input);
  await submitCase(page);
  await waitForChat(page);
}
