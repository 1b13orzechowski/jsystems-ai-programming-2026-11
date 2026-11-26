/**
 * T13b / T14b — record real responses of the app's own routes (AGENTS.md mock rule).
 *
 * Prerequisites (run from app/ after `npm run build`):
 *   npx next start -p 3000                                        # real .env.local
 *   OPENROUTER_API_KEY=invalid-capture-key npx next start -p 3001 # same build, invalid key
 * Then:
 *   npx tsx scripts/capture-routes.ts          # /api/case captures (T13b)
 *   npx tsx scripts/capture-routes.ts --chat   # /api/chat captures (T14b), uses tokens from the case captures
 *
 * Each file holds status, headers, the raw body (JSON or SSE text), date, commit SHA and the request
 * description. Photos follow assets/example-images/README.md: real photos only, downscaled in a real
 * browser with the app's client rules (JPEG, longest edge ≤ 1568 px, quality 0.82); nothing is said
 * to the model about what a photo shows. No secrets are written (tokens are HMAC-signed case data).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "@playwright/test";
import { z } from "zod";

const APP_DIR = process.cwd();
const PHOTOS_DIR = join(APP_DIR, "..", "assets", "example-images");
const CASE_DIR = join(APP_DIR, "tests", "fixtures", "captures", "api-case");
const CHAT_DIR = join(APP_DIR, "tests", "fixtures", "captures", "api-chat");
const PRIMARY = "http://localhost:3000";
const FAILURE = "http://localhost:3001";

const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();

function warsawDate(offsetDays: number): string {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

async function downscaleInBrowser(file: string, mime: string): Promise<Buffer> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const dataUrl = `data:${mime};base64,${readFileSync(join(PHOTOS_DIR, file)).toString("base64")}`;
    const jpegBase64 = await page.evaluate(async (src: string) => {
      const blob = await (await fetch(src)).blob();
      const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
      const scale = Math.min(1, 1568 / Math.max(bitmap.width, bitmap.height));
      const width = Math.round(bitmap.width * scale);
      const height = Math.round(bitmap.height * scale);
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext("2d");
      if (context === null) throw new Error("no 2d context");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);
      const jpeg = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.82 });
      const bytes = new Uint8Array(await jpeg.arrayBuffer());
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary);
    }, dataUrl);
    return Buffer.from(jpegBase64, "base64");
  } finally {
    await browser.close();
  }
}

type Saved = { status: number; headers: Record<string, string>; body: string };

async function record(dir: string, name: string, url: string, init: RequestInit, describe: Record<string, unknown>): Promise<Saved> {
  const started = Date.now();
  const response = await fetch(url, init);
  const body = await response.text();
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    if (!["set-cookie", "date"].includes(key.toLowerCase())) headers[key] = value;
  });
  const saved = { status: response.status, headers, body };
  writeFileSync(
    join(dir, `${name}.json`),
    `${JSON.stringify({ capture: name, capturedAt: new Date().toISOString(), commit, target: url, durationMs: Date.now() - started, request: describe, response: saved }, null, 2)}\n`,
  );
  console.log(`saved ${name}: ${response.status} (${Date.now() - started} ms)`);
  return saved;
}

function caseForm(fields: Record<string, string>, photo: { bytes: Buffer; type: string; name: string } | null): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  if (photo !== null) {
    form.set("photo", new File([new Uint8Array(photo.bytes)], photo.name, { type: photo.type }));
    form.set("photoName", photo.name);
  }
  return form;
}

async function captureCase(): Promise<void> {
  mkdirSync(CASE_DIR, { recursive: true });
  const phone = await downscaleInBrowser("phone-1.jpg", "image/jpeg");
  const laptop = await downscaleInBrowser("laptop-1.png", "image/png");
  const returnFields = { caseType: "zwrot", category: "Smartfon", model: "Galaxy S30", purchaseDate: warsawDate(-3), reason: "" };
  const complaintFields = {
    caseType: "reklamacja",
    category: "Laptop",
    model: "ThinkBook 14",
    purchaseDate: warsawDate(-330),
    reason: "Laptop przestał się ładować po kilku miesiącach normalnego używania.",
  };
  const phonePhoto = { bytes: phone, type: "image/jpeg", name: "phone-1.jpg" };
  const laptopPhoto = { bytes: laptop, type: "image/jpeg", name: "laptop-1.png" };

  await record(CASE_DIR, "success-zwrot-phone-1", `${PRIMARY}/api/case`, { method: "POST", body: caseForm(returnFields, phonePhoto) }, {
    fields: returnFields, photo: { source: "phone-1.jpg", sentBytes: phone.length, type: "image/jpeg" },
  });
  await record(CASE_DIR, "success-reklamacja-laptop-1", `${PRIMARY}/api/case`, { method: "POST", body: caseForm(complaintFields, laptopPhoto) }, {
    fields: complaintFields, photo: { source: "laptop-1.png", sentBytes: laptop.length, type: "image/jpeg" },
  });
  const invalidFields = { ...returnFields, model: "" };
  await record(CASE_DIR, "validation-400", `${PRIMARY}/api/case`, { method: "POST", body: caseForm(invalidFields, phonePhoto) }, {
    fields: invalidFields, note: "empty model",
  });
  await record(CASE_DIR, "unsupported-media-415", `${PRIMARY}/api/case`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(returnFields),
  }, { note: "JSON body instead of multipart" });
  await record(CASE_DIR, "processing-failed-invalid-key", `${FAILURE}/api/case`, { method: "POST", body: caseForm(returnFields, phonePhoto) }, {
    fields: returnFields, instance: "port 3001 started with an invalid OpenRouter key",
  });
}

const SavedCaseSchema = z.object({ response: z.object({ body: z.string() }) });
const DataCaseSchema = z.object({
  type: z.literal("data-case"),
  data: z.object({ caseId: z.string(), caseToken: z.string(), firstMessage: z.unknown() }),
});

function caseResult(name: string): z.infer<typeof DataCaseSchema>["data"] {
  const saved = SavedCaseSchema.parse(JSON.parse(readFileSync(join(CASE_DIR, `${name}.json`), "utf8")));
  for (const line of saved.response.body.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    try {
      const parsed = DataCaseSchema.safeParse(JSON.parse(line.slice(6)));
      if (parsed.success) return parsed.data.data;
    } catch {
      // not JSON ([DONE])
    }
  }
  throw new Error(`${name} has no data-case part; capture the case routes first`);
}

function chatBody(caseId: string, caseToken: string, firstMessage: unknown, text: string): string {
  return JSON.stringify({
    id: caseId,
    caseToken,
    trigger: "submit-message",
    messages: [firstMessage, { id: `user-${Date.now()}`, role: "user", parts: [{ type: "text", text }] }],
  });
}

async function captureChat(): Promise<void> {
  mkdirSync(CHAT_DIR, { recursive: true });
  const complaint = caseResult("success-reklamacja-laptop-1");
  const json = { "content-type": "application/json" };

  const ask = "Jaki model zgłosiłem?";
  await record(CHAT_DIR, "plain-answer", `${PRIMARY}/api/chat`, { method: "POST", headers: json, body: chatBody(complaint.caseId, complaint.caseToken, complaint.firstMessage, ask) }, {
    case: "success-reklamacja-laptop-1", userText: ask,
  });
  const newInfo = "Przypomniałem sobie, że tydzień przed awarią laptop spadł mi z biurka na podłogę i od tego czasu nie ładuje się.";
  await record(CHAT_DIR, "updated-decision", `${PRIMARY}/api/chat`, { method: "POST", headers: json, body: chatBody(complaint.caseId, complaint.caseToken, complaint.firstMessage, newInfo) }, {
    case: "success-reklamacja-laptop-1", userText: newInfo, note: "new information that may change the outcome; the model decides whether to call the tool",
  });
  const tampered = `${complaint.caseToken.slice(0, 10)}${complaint.caseToken[10] === "A" ? "B" : "A"}${complaint.caseToken.slice(11)}`;
  await record(CHAT_DIR, "invalid-token-401", `${PRIMARY}/api/chat`, { method: "POST", headers: json, body: chatBody(complaint.caseId, tampered, complaint.firstMessage, ask) }, {
    case: "success-reklamacja-laptop-1", note: "one character of the token payload changed",
  });
  await record(CHAT_DIR, "chat-failed-invalid-key", `${FAILURE}/api/chat`, { method: "POST", headers: json, body: chatBody(complaint.caseId, complaint.caseToken, complaint.firstMessage, ask) }, {
    case: "success-reklamacja-laptop-1", instance: "port 3001 started with an invalid OpenRouter key (same CASE_SIGNING_SECRET)",
  });
}

(process.argv.includes("--chat") ? captureChat() : captureCase()).catch((error: unknown) => {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exit(1);
});
