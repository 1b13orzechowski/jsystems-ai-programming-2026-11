// ADR-000 §10: E2E specs run against the real stack and never intercept or fake requests.
// Scanner limits: plain regex search over the spec and helper files; dynamic construction is not detected.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

type Hit = { file: string; line: number; pattern: string };

const FORBIDDEN: ReadonlyArray<{ pattern: string; regex: RegExp }> = [
  { pattern: "page.route(", regex: /\bpage\.route\(/ },
  { pattern: "context.route(", regex: /\bcontext\.route\(/ },
  { pattern: ".route(", regex: /\.route\(/ },
  { pattern: "route.fulfill", regex: /\broute\.fulfill\b/ },
  { pattern: "routeFromHAR", regex: /\brouteFromHAR\b/ },
  { pattern: "msw", regex: /\bmsw\b/ },
  { pattern: "nock", regex: /\bnock\b/ },
  { pattern: "createServer(", regex: /\bcreateServer\(/ },
];

export function scanForInterception(file: string, content: string): Hit[] {
  const hits: Hit[] = [];
  content.split("\n").forEach((text, index) => {
    for (const { pattern, regex } of FORBIDDEN) {
      if (regex.test(text)) hits.push({ file, line: index + 1, pattern });
    }
  });
  return hits;
}

function listSpecFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSpecFiles(full));
    } else if (/\.(ts|tsx|js|jsx|mjs|mts)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const E2E_DIR = join(process.cwd(), "tests", "e2e");

describe("real-stack E2E guard (ADR-000 §10)", () => {
  it("detects request interception and fake servers in an in-memory sample", () => {
    const sample = [
      "await page.route('**/api/cases', (route) => route.fulfill({ status: 200 }));",
      "await context.route('**/*', handler);",
      "await routeFromHAR('recording.har');",
      "import { setupServer } from 'msw/node';",
      "import nock from 'nock';",
      "const server = createServer((req, res) => res.end());",
    ].join("\n");

    const patterns = scanForInterception("sample.spec.ts", sample).map((hit) => hit.pattern);
    expect(patterns).toEqual(
      expect.arrayContaining([
        "page.route(",
        "context.route(",
        "route.fulfill",
        "routeFromHAR",
        "msw",
        "nock",
        "createServer(",
      ]),
    );
  });

  it("does not flag real-stack code in an in-memory sample", () => {
    const clean = [
      "await page.goto(FAILURE_URL);",
      "await context.setOffline(true);",
      "await page.getByRole('button', { name: 'Wyślij zgłoszenie' }).click();",
    ].join("\n");
    expect(scanForInterception("clean.spec.ts", clean)).toEqual([]);
  });

  it("finds no interception or fake-server code in app/tests/e2e", () => {
    const hits = listSpecFiles(E2E_DIR).flatMap((absolute) =>
      scanForInterception(relative(process.cwd(), absolute), readFileSync(absolute, "utf8")),
    );
    expect(hits).toEqual([]);
  });
});
