import { expect, test, type Dialog, type Page } from "@playwright/test";

import { COPY } from "@/lib/domain/copy-pl";

import { formField, submitCaseAndWaitForChat } from "./helpers/case-form";
import { daysAgo } from "./helpers/dates";
import { decisionCard } from "./helpers/decision";

async function startChat(page: Page): Promise<void> {
  await page.goto("/");
  await submitCaseAndWaitForChat(page, {
    caseType: COPY.caseTypes.zwrot,
    category: "Smartfon",
    model: "Galaxy S30",
    purchaseDate: daysAgo(2),
    photo: "phone-2.jpeg",
  });
  await expect(decisionCard(page, "initial")).toBeVisible({ timeout: 90_000 });
}

async function expectEmptyForm(page: Page): Promise<void> {
  await expect(page.getByTestId("case-summary")).toHaveCount(0);
  await expect(formField(page, COPY.form.labels.model)).toHaveValue("");
  await expect(formField(page, COPY.form.labels.purchaseDate)).toHaveValue("");
}

test("AC-31: reloading during an active chat raises a beforeunload dialog", async ({ page }) => {
  await startChat(page);

  const dialogTypes: string[] = [];
  page.on("dialog", (dialog: Dialog) => {
    dialogTypes.push(dialog.type());
    void dialog.accept();
  });

  await page.reload();
  await expect.poll(() => dialogTypes).toContain("beforeunload");
});

test("AC-30: after a reload and accepting the warning the empty form is shown", async ({ page }) => {
  await startChat(page);

  page.on("dialog", (dialog: Dialog) => {
    void dialog.accept();
  });

  await page.reload();
  await expect(formField(page, COPY.form.labels.model)).toBeVisible();
  await expectEmptyForm(page);
});

test("AC-32: new case dialog - cancel keeps the chat, confirm shows the empty form", async ({ page }) => {
  await startChat(page);

  await page.getByRole("button", { name: COPY.app.newCase, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: COPY.newCaseDialog.title });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: COPY.newCaseDialog.cancel, exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("case-summary")).toBeVisible();
  await expect(decisionCard(page, "initial")).toBeVisible();

  await page.getByRole("button", { name: COPY.app.newCase, exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: COPY.newCaseDialog.confirm, exact: true }).click();

  await expectEmptyForm(page);
});
