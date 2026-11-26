// TAC-004-06: the application keeps no state in browser storage. Case state lives on the server.
// Scanner limits: plain text search over src/. Dynamic access such as window["local" + "Storage"] is not detected.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

type Hit = { file: string; line: number; pattern: string };

const FORBIDDEN: ReadonlyArray<{ pattern: string; regex: RegExp }> = [
  { pattern: "localStorage", regex: /\blocalStorage\b/ },
  { pattern: "sessionStorage", regex: /\bsessionStorage\b/ },
  { pattern: "indexedDB", regex: /\bindexedDB\b/ },
  { pattern: "document.cookie", regex: /\bdocument\.cookie\b/ },
];

export function scanForBrowserStorage(file: string, content: string): Hit[] {
  const hits: Hit[] = [];
  content.split("\n").forEach((text, index) => {
    for (const { pattern, regex } of FORBIDDEN) {
      if (regex.test(text)) hits.push({ file, line: index + 1, pattern });
    }
  });
  return hits;
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx|js|jsx|mjs|mts)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const SRC_DIR = join(process.cwd(), "src");

describe("browser storage guard (TAC-004-06)", () => {
  it("detects every forbidden storage API in an in-memory sample", () => {
    const sample = [
      "localStorage.setItem('case', id);",
      "const s = window.sessionStorage.getItem('x');",
      "indexedDB.open('cases');",
      "document.cookie = 'session=1';",
    ].join("\n");

    const patterns = scanForBrowserStorage("sample.tsx", sample).map((hit) => hit.pattern);
    expect(patterns).toEqual(
      expect.arrayContaining(["localStorage", "sessionStorage", "indexedDB", "document.cookie"]),
    );
  });

  it("does not flag unrelated code in an in-memory sample", () => {
    const clean = "const storageLabel = 'Zapisz'; const cookieBanner = null;";
    expect(scanForBrowserStorage("clean.tsx", clean)).toEqual([]);
  });

  it("finds no browser storage access anywhere in src/", () => {
    const hits: Hit[] = [];
    for (const absolute of listSourceFiles(SRC_DIR)) {
      hits.push(...scanForBrowserStorage(relative(process.cwd(), absolute), readFileSync(absolute, "utf8")));
    }

    const report = hits.map((hit) => `${hit.file}:${hit.line} ${hit.pattern}`).join("\n");
    expect(hits, report).toEqual([]);
  });
});
