import { expect, test, type Page } from "@playwright/test";

const INTRO = "Sprawdź, czy Twój zwrot lub reklamacja może zostać przyjęta";

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("home page renders the branded shell from the production build", async ({ page }) => {
  const consoleErrors = collectErrors(page);

  const response = await page.goto("/");
  expect(response?.status()).toBe(200);

  await expect(page.locator("html")).toHaveAttribute("lang", "pl");

  const bodyFontFamily = await page.evaluate(
    () => getComputedStyle(document.body).fontFamily,
  );
  expect(bodyFontFamily).toMatch(/titillium/i);

  // next/font/local generates the family name, so match it by name rather than hard-coding it.
  const titilliumFaceStatuses = await page.evaluate(async () => {
    await document.fonts.ready;
    return Array.from(document.fonts)
      .filter((face) => /titillium/i.test(face.family))
      .map((face) => face.status);
  });
  expect(titilliumFaceStatuses).toContain("loaded");

  await expect(page.getByRole("img", { name: "Logo" })).toBeVisible();
  await expect(page.getByRole("banner").getByText("Hardware Service Decision Copilot")).toBeVisible();
  await expect(page.getByText(INTRO)).toBeVisible();

  const skipLink = page.getByRole("link", { name: "Przejdź do treści" });
  await expect(skipLink).toHaveAttribute("href", "#main-content");

  expect(consoleErrors).toEqual([]);
});

test("home page does not scroll horizontally at 360 px width", async ({ page }) => {
  const consoleErrors = collectErrors(page);
  await page.setViewportSize({ width: 360, height: 740 });

  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByText(INTRO)).toBeVisible();

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(360);

  expect(consoleErrors).toEqual([]);
});
