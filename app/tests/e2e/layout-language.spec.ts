import { expect, test, type Page } from "@playwright/test";

import { COPY } from "@/lib/domain/copy-pl";

import { formField, submitCaseAndWaitForChat } from "./helpers/case-form";
import { daysAgo } from "./helpers/dates";
import { decisionCard } from "./helpers/decision";

// A 100-character model name is the longest allowed value (AC-05) and the stress case for layout (AC-34).
const LONG_MODEL = `Model-${"x".repeat(94)}`;
const ENGLISH_UI_WORDS = /\b(Close|Send|Submit|Loading|Error|Cancel|Upload)\b/;

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth);
}

async function expectPolishUiOnly(page: Page): Promise<void> {
  const text = await page.evaluate(() => document.body.innerText);
  expect(text).not.toMatch(ENGLISH_UI_WORDS);
}

test.describe("layout and language at 360 px", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("AC-34, AC-33: the form screen fits 360 px with a 100-character model and shows Polish UI only", async ({
    page,
  }) => {
    await page.goto("/");
    await formField(page, COPY.form.labels.model).fill(LONG_MODEL);
    await formField(page, COPY.form.labels.purchaseDate).fill(daysAgo(2));

    await expectNoHorizontalScroll(page);
    await expectPolishUiOnly(page);
  });

  test("AC-34, AC-33: the chat screen fits 360 px with a 100-character model and shows Polish UI only", async ({
    page,
  }) => {
    await page.goto("/");
    await submitCaseAndWaitForChat(page, {
      caseType: COPY.caseTypes.zwrot,
      category: "Smartfon",
      model: LONG_MODEL,
      purchaseDate: daysAgo(2),
      photo: "phone-2.jpeg",
    });
    await expect(decisionCard(page, "initial")).toBeVisible({ timeout: 90_000 });

    await expectNoHorizontalScroll(page);
    await expectPolishUiOnly(page);
  });
});
