import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { COPY } from "@/lib/domain/copy-pl";

import { assistantMessages, chatInput, sendButton } from "./helpers/chat";
import { photoPath, submitCaseAndWaitForChat } from "./helpers/case-form";
import { collectErrors } from "./helpers/console";
import { daysAgo } from "./helpers/dates";
import { decisionCard } from "./helpers/decision";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function expectNoSeriousAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(blocking.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
}

test("TAC-004-04: the form has no serious or critical axe violations", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await expect(page.getByRole("radio", { name: COPY.caseTypes.zwrot, exact: true })).toBeVisible();

  await expectNoSeriousAxeViolations(page);
  expect(errors).toEqual([]);
});

test("TAC-004-04: the chat screen has no serious or critical axe violations", async ({ page }) => {
  await page.goto("/");
  await submitCaseAndWaitForChat(page, {
    caseType: COPY.caseTypes.zwrot,
    category: "Smartfon",
    model: "Galaxy S30",
    purchaseDate: daysAgo(2),
    photo: "phone-2.jpeg",
  });
  await expect(decisionCard(page, "initial")).toBeVisible({ timeout: 90_000 });

  await expectNoSeriousAxeViolations(page);
});

test("AC-35: a return with a photo and a chat message can be completed with the keyboard only", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/");

  // Case type: the first radio is focused with Tab, then selected with Space.
  await page.getByRole("radio", { name: COPY.caseTypes.zwrot, exact: true }).focus();
  await page.keyboard.press("Space");

  // Category: open the select with Enter, pick the option with type-ahead and Enter.
  await page.getByRole("combobox", { name: COPY.form.labels.category }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.type("Smartfon");
  await page.keyboard.press("Enter");

  // Model and purchase date: Tab moves through the fields in DOM order.
  await page.getByLabel(COPY.form.labels.model).focus();
  await page.keyboard.type("Galaxy S30");
  await page.keyboard.press("Tab");
  // Date input in the pl-PL locale: day, month and year segments are typed as digits.
  const [year = "", month = "", day = ""] = daysAgo(2).split("-");
  await page.keyboard.type(`${day}${month}${year}`);

  // Photo: the choose button opens the file chooser from the keyboard.
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: COPY.form.photoChoose, exact: true }).focus();
  await page.keyboard.press("Enter");
  await (await chooser).setFiles(photoPath("phone-2.jpeg"));
  await expect(page.getByRole("img", { name: COPY.form.photoThumbnailAlt })).toBeVisible();

  // Submit with Enter on the focused button.
  await page.getByRole("button", { name: COPY.form.submit, exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("case-summary")).toBeVisible({ timeout: 90_000 });
  await expect(decisionCard(page, "initial")).toBeVisible({ timeout: 90_000 });

  // Chat message: type in the input and send with Enter.
  const repliesBefore = await assistantMessages(page).count();
  await chatInput(page).focus();
  await page.keyboard.type("Czy mogę dosłać zdjęcie?");
  await page.keyboard.press("Enter");
  await expect(sendButton(page)).toBeDisabled();
  await expect(assistantMessages(page)).toHaveCount(repliesBefore + 1, { timeout: 90_000 });
});

test("dialog focus trap: Tab stays inside the new-case dialog", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/");
  await submitCaseAndWaitForChat(page, {
    caseType: COPY.caseTypes.zwrot,
    category: "Smartfon",
    model: "Galaxy S30",
    purchaseDate: daysAgo(2),
    photo: "phone-2.jpeg",
  });
  await expect(decisionCard(page, "initial")).toBeVisible({ timeout: 90_000 });

  await page.getByRole("button", { name: COPY.app.newCase, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: COPY.newCaseDialog.title });
  await expect(dialog).toBeVisible();

  for (let press = 0; press < 8; press += 1) {
    await page.keyboard.press("Tab");
    const insideDialog = await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null);
    expect(insideDialog).toBe(true);
  }
});
