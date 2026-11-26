/**
 * T21a — scripted demo of the real app for the screen recording (not a test; no interception).
 * Drives a HEADED Chromium window at 0,0 sized 1280×800 on the current X display.
 * Requires: primary instance on :3000 (real key) and failure instance on :3001 (invalid key).
 * Run via scripts/record-demo.sh, or alone: `npx tsx scripts/demo-flow.ts`.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { chromium, type Page } from "@playwright/test";

const PRIMARY = "http://localhost:3000/";
const FAILURE = "http://localhost:3001/";
const PHOTOS = join(process.cwd(), "..", "assets", "example-images");
const PAUSE = 1800;

function warsaw(offsetDays: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(Date.now() + offsetDays * 86_400_000),
  );
}

async function pause(page: Page, ms = PAUSE): Promise<void> {
  await page.waitForTimeout(ms);
}

async function fill(page: Page, data: { type: string; category: string; model: string; date: string; reason?: string; photo: string }): Promise<void> {
  await page.getByRole("radio", { name: data.type, exact: true }).click();
  await page.getByRole("combobox", { name: /Kategoria sprzętu/ }).click();
  await page.getByRole("option", { name: data.category, exact: true }).click();
  await page.getByLabel(/Nazwa \/ model/).pressSequentially(data.model, { delay: 60 });
  await page.getByLabel(/Data zakupu/).fill(data.date);
  if (data.reason !== undefined) await page.getByLabel(/Powód zgłoszenia/).pressSequentially(data.reason, { delay: 25 });
  await page.getByTestId("photo-input").setInputFiles(join(PHOTOS, data.photo));
  await page.getByRole("img", { name: "Miniatura wybranego zdjęcia" }).waitFor({ timeout: 30_000 });
  await pause(page, 1000);
}

async function submitAndWaitForDecision(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Wyślij zgłoszenie" }).click();
  await page.getByTestId("decision-card").first().waitFor({ timeout: 90_000 });
  await pause(page, 2500);
  await page.getByTestId("decision-card").first().scrollIntoViewIfNeeded();
  await pause(page, 3000);
}

async function ask(page: Page, text: string): Promise<void> {
  const box = page.getByRole("textbox", { name: "Twoja wiadomość" });
  await box.pressSequentially(text, { delay: 40 });
  await box.press("Enter");
  await page.getByRole("button", { name: "Wyślij" }).and(page.locator(":enabled")).waitFor({ timeout: 60_000 });
  await page.locator('[data-testid="chat-message"]').last().scrollIntoViewIfNeeded();
  await pause(page, 3500);
}

async function newCase(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Nowe zgłoszenie" }).click();
  await pause(page);
  await page.getByRole("button", { name: "Rozpocznij nowe" }).click();
  await pause(page, 1200);
}

async function main(): Promise<void> {
  // A persistent context opens exactly one window, so --window-size/--app apply to the recorded window.
  const userDataDir = mkdtempSync(join(tmpdir(), "poc-demo-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: null,
    locale: "pl-PL",
    timezoneId: "Europe/Warsaw",
    args: ["--window-position=0,0", "--window-size=1280,800", `--app=${PRIMARY}`],
  });
  const page = context.pages()[0] ?? (await context.newPage());
  page.on("dialog", (dialog) => void dialog.accept());

  // Scene 1 — return, happy path to the decision.
  await page.goto(PRIMARY);
  await pause(page, 2500);
  await fill(page, { type: "Zwrot", category: "Smartfon", model: "Galaxy S30", date: warsaw(-3), photo: "phone-1.jpg" });
  await submitAndWaitForDecision(page);
  await newCase(page);

  // Scene 2 — complaint with photo, chat question, new information → updated decision.
  await fill(page, {
    type: "Reklamacja",
    category: "Laptop",
    model: "ThinkBook 14",
    date: warsaw(-330),
    reason: "Laptop przestał się ładować po kilku miesiącach normalnego używania.",
    photo: "laptop-1.png",
  });
  await submitAndWaitForDecision(page);
  await ask(page, "Jaki model zgłosiłem?");
  await ask(page, "Przypomniałem sobie, że tydzień przed awarią laptop spadł mi z biurka na podłogę.");
  await newCase(page);

  // Scene 3 — validation errors.
  await page.getByRole("button", { name: "Wyślij zgłoszenie" }).click();
  await pause(page, 3000);

  // Scene 4 — processing error on the failure instance, then "Spróbuj ponownie".
  await page.goto(FAILURE);
  await pause(page, 1200);
  await fill(page, { type: "Zwrot", category: "Smartfon", model: "Galaxy S30", date: warsaw(-3), photo: "phone-2.jpeg" });
  await page.getByRole("button", { name: "Wyślij zgłoszenie" }).click();
  await page.getByRole("alert").filter({ hasText: "Nie udało się przetworzyć zgłoszenia" }).waitFor({ timeout: 60_000 });
  await pause(page, 3000);
  await page.getByRole("button", { name: "Spróbuj ponownie" }).click();
  await page.getByRole("alert").filter({ hasText: "Nie udało się przetworzyć zgłoszenia" }).waitFor({ timeout: 60_000 });
  await pause(page, 2500);

  // Scene 5 — "Nowe zgłoszenie" dialog on the primary instance (cancel, then confirm).
  await page.goto(PRIMARY);
  await fill(page, { type: "Zwrot", category: "Smartfon", model: "Galaxy S30", date: warsaw(-30), photo: "phone-2.jpeg" });
  await submitAndWaitForDecision(page);
  await page.getByRole("button", { name: "Nowe zgłoszenie" }).click();
  await pause(page);
  await page.getByRole("button", { name: "Anuluj" }).click();
  await pause(page, 1200);
  await newCase(page);
  await pause(page, 1500);

  await context.close();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exit(1);
});
