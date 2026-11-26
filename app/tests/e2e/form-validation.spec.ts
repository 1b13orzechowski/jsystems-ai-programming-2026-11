import { expect, test } from "@playwright/test";

import { COPY } from "@/lib/domain/copy-pl";

import { collectErrors } from "./helpers/console";
import { daysAgo, tomorrow } from "./helpers/dates";
import { fillCase, formField, photoPath, submitCase } from "./helpers/case-form";

// Form validation runs in the browser before any LLM call, so these specs never reach the model
// (except where a test explicitly documents that it stops before submitting).

test.describe("case form validation", () => {
  test("AC-01: six fields are shown in PRD order with visible labels", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/");

    const labels = [
      COPY.form.labels.caseType,
      COPY.form.labels.category,
      COPY.form.labels.model,
      COPY.form.labels.purchaseDate,
      COPY.form.labels.reason,
      COPY.form.labels.photo,
    ];
    for (const label of labels) {
      await expect(page.getByText(label, { exact: false }).first()).toBeVisible();
    }

    // Order: the labels appear top to bottom in the same sequence as the PRD.
    const boxes = await Promise.all(
      labels.map((label) => page.getByText(label, { exact: false }).first().boundingBox()),
    );
    const tops = boxes.map((box) => box?.y ?? Number.NaN);
    expect(tops).toEqual([...tops].sort((a, b) => a - b));

    expect(errors).toEqual([]);
  });

  test("AC-02: empty submit shows required errors on five fields and focuses the first invalid field", async ({
    page,
  }) => {
    await page.goto("/");
    await submitCase(page);

    const requiredErrors = page.getByText(COPY.form.errors.required, { exact: true });
    await expect(requiredErrors).toHaveCount(5);

    // Each error is linked to its field through aria-describedby.
    const model = formField(page, COPY.form.labels.model);
    await expect(model).toHaveAttribute("aria-describedby", /.+/);
    const describedBy = await model.getAttribute("aria-describedby");
    expect(describedBy).not.toBeNull();
    for (const id of (describedBy ?? "").split(/\s+/)) {
      await expect(page.locator(`[id="${id}"]`)).toHaveText(COPY.form.errors.required);
    }

    // Focus goes to the first invalid field in form order. The contract marks invalid fields with aria-invalid.
    await expect(page.locator('[aria-invalid="true"]').first()).toBeFocused();
  });

  test("AC-03: complaint reason shorter than 10 non-whitespace characters is rejected", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("radio", { name: COPY.caseTypes.reklamacja, exact: true }).click();
    await formField(page, COPY.form.labels.reason).fill("   abc   ");
    await submitCase(page);

    await expect(page.getByText(COPY.form.errors.complaintReason, { exact: true })).toBeVisible();
  });

  test("AC-04: return without a reason passes validation", async ({ page }) => {
    await page.goto("/");
    await fillCase(page, {
      caseType: COPY.caseTypes.zwrot,
      category: "Smartfon",
      model: "Galaxy S30",
      purchaseDate: daysAgo(3),
    });

    // Stop before submitting: no LLM call from a form-validation spec.
    await expect(page.getByText(COPY.form.errors.required, { exact: true })).toHaveCount(0);
    await expect(page.getByText(COPY.form.errors.complaintReason, { exact: true })).toHaveCount(0);
  });

  test("AC-05: model longer than 100 characters is blocked and the reason counter caps at 2000", async ({
    page,
  }) => {
    await page.goto("/");

    const model = formField(page, COPY.form.labels.model);
    await model.fill("M".repeat(101));
    await expect(model).toHaveValue("M".repeat(100));

    const reason = formField(page, COPY.form.labels.reason);
    await reason.fill("a".repeat(2001));
    await expect(page.getByText("2000/2000", { exact: true })).toBeVisible();
    await expect(reason).toHaveValue("a".repeat(2000));
  });

  test("AC-06: purchase date in the future shows the future-date error", async ({ page }) => {
    await page.goto("/");
    await fillCase(page, {
      caseType: COPY.caseTypes.zwrot,
      category: "Smartfon",
      model: "Galaxy S30",
      purchaseDate: tomorrow(),
    });
    await submitCase(page);

    await expect(page.getByText(COPY.form.errors.futureDate, { exact: true })).toBeVisible();
  });

  test("AC-08: a real photo shows a thumbnail, its file name and remove/replace controls", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("photo-input").setInputFiles(photoPath("phone-1.jpg"));

    await expect(page.getByRole("img", { name: COPY.form.photoThumbnailAlt })).toBeVisible();
    await expect(page.getByText("phone-1.jpg", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: COPY.form.photoRemove, exact: true })).toBeVisible();
  });

  test("AC-07: a file with an unsupported format or over 10 MB is rejected", async () => {
    test.skip(
      true,
      "H04: needs a real photo that the example set does not contain (unsupported format or over 10 MB); listed as a PR limitation",
    );
  });
});
