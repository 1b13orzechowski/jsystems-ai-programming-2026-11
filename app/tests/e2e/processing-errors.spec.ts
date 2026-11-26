import { expect, test, type Page } from "@playwright/test";

import { COPY } from "@/lib/domain/copy-pl";

import { FAILURE_URL, TIMEOUT_URL } from "../../playwright.config";
import { fillCase, formField, submitCase, waitForChat } from "./helpers/case-form";
import { daysAgo } from "./helpers/dates";

const MODEL = "Galaxy S30";
const PURCHASE_DATE = daysAgo(3);

async function fillValidReturn(page: Page): Promise<void> {
  await fillCase(page, {
    caseType: COPY.caseTypes.zwrot,
    category: "Smartfon",
    model: MODEL,
    purchaseDate: PURCHASE_DATE,
    photo: "phone-1.jpg",
  });
}

/** AC-13: after a failed case the banner is shown and every value and the photo are still there. */
async function expectErrorBannerWithValuesKept(page: Page): Promise<void> {
  // The Next.js route announcer is also role="alert"; select the AC-13 banner by its text.
  const banner = page.getByRole("alert").filter({ hasText: COPY.errorBanner.message });
  await expect(banner).toContainText(COPY.errorBanner.message, { timeout: 90_000 });
  await expect(banner.getByRole("button", { name: COPY.errorBanner.retry, exact: true })).toBeVisible();

  await expect(formField(page, COPY.form.labels.model)).toHaveValue(MODEL);
  await expect(formField(page, COPY.form.labels.purchaseDate)).toHaveValue(PURCHASE_DATE);
  await expect(page.getByRole("img", { name: COPY.form.photoThumbnailAlt })).toBeVisible();
  await expect(page.getByText("phone-1.jpg", { exact: false })).toBeVisible();
}

test("AC-13 failure: a real provider error shows the banner and keeps the values", async ({ page }) => {
  await page.goto(FAILURE_URL);

  await fillValidReturn(page);
  await submitCase(page);

  await expectErrorBannerWithValuesKept(page);
});

test("AC-13 timeout: a real 1 s budget shows the banner and keeps the values", async ({ page }) => {
  await page.goto(TIMEOUT_URL);

  await fillValidReturn(page);
  await submitCase(page);

  await expectErrorBannerWithValuesKept(page);
});

test("AC-13 network: an offline submit shows the banner, then a retry on the primary instance reaches the chat", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await fillValidReturn(page);

  await context.setOffline(true);
  await submitCase(page);
  await expectErrorBannerWithValuesKept(page);

  await context.setOffline(false);
  await page.getByRole("alert").filter({ hasText: COPY.errorBanner.message }).getByRole("button", { name: COPY.errorBanner.retry, exact: true }).click();
  await waitForChat(page);
  await expect(page.getByTestId("decision-card").first()).toBeVisible({ timeout: 90_000 });
});
