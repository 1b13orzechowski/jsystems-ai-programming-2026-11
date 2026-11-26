// TAC-004-03: user-facing Polish copy comes from src/lib/domain/copy-pl.ts, not inline literals.
// Scope: .tsx files under src/app and src/components, excluding src/components/ui and src/components/ai-elements.
// Scanner limits (regex-based, not a TSX parser):
//   - JSX text is checked only when it sits on one line between `>` and `<`, and contains no `{ } ( ) [ ] ; =`.
//   - Attribute strings are checked only for aria-label, alt, placeholder and title with literal "..." or '...' values.
//   - Expression literals such as {"text"} and multi-line JSX text are not inspected.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

type Hit = { file: string; line: number; text: string };

const LETTER = /\p{L}/u;
// Text between `>` and `<` on one line, avoiding code characters. The `(?<!=)` guard skips `=>` arrows.
const JSX_TEXT = /(?<!=)>([^<>{}()[\];=\n]*)</g;
const ATTRIBUTE = /\b(?:aria-label|alt|placeholder|title)=(?:"([^"\n]*)"|'([^'\n]*)')/g;

export function findPolishLiteralViolations(file: string, content: string): Hit[] {
  const hits: Hit[] = [];
  content.split("\n").forEach((lineText, index) => {
    for (const match of lineText.matchAll(JSX_TEXT)) {
      const text = match[1] ?? "";
      if (LETTER.test(text)) hits.push({ file, line: index + 1, text: text.trim() });
    }
    for (const match of lineText.matchAll(ATTRIBUTE)) {
      const text = match[1] ?? match[2] ?? "";
      if (LETTER.test(text)) hits.push({ file, line: index + 1, text });
    }
  });
  return hits;
}

const UI_EXCLUDED = `src${sep}components${sep}ui${sep}`;
const AI_ELEMENTS_EXCLUDED = `src${sep}components${sep}ai-elements${sep}`;

function listTsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listTsxFiles(full));
    } else if (entry.name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

const ROOT = process.cwd();

describe("Polish literals guard (TAC-004-03)", () => {
  it("detects JSX text and attribute literals containing letters in an in-memory sample", () => {
    const sample = [
      "<button>Zapisz sprawę</button>",
      '<input placeholder="Imię i nazwisko" />',
      "<img alt='Logo firmy' />",
      '<button aria-label="Zamknij">x</button>',
      '<span title="Podpowiedź">?</span>',
    ].join("\n");

    const texts = findPolishLiteralViolations("sample.tsx", sample).map((hit) => hit.text);
    expect(texts).toEqual(
      expect.arrayContaining(["Zapisz sprawę", "Imię i nazwisko", "Logo firmy", "Zamknij", "Podpowiedź"]),
    );
  });

  it("does not flag copy references, expressions or non-letter content in an in-memory sample", () => {
    const clean = [
      "<button>{copy.submit}</button>",
      '<input placeholder={copy.placeholder} aria-label={copy.label} />',
      "<span>1234</span>",
      "<Icon aria-hidden='true' />",
      "const f = (x: number) => <p>{x}</p>;",
    ].join("\n");

    expect(findPolishLiteralViolations("clean.tsx", clean)).toEqual([]);
  });

  it("finds no inline Polish literals in src/app and src/components (excluding ui and ai-elements)", () => {
    const hits: Hit[] = [];
    for (const scope of ["src/app", "src/components"]) {
      for (const absolute of listTsxFiles(join(ROOT, scope))) {
        const rel = relative(ROOT, absolute);
        if (rel.startsWith(UI_EXCLUDED) || rel.startsWith(AI_ELEMENTS_EXCLUDED)) continue;
        hits.push(...findPolishLiteralViolations(rel, readFileSync(absolute, "utf8")));
      }
    }

    const report = hits.map((hit) => `${hit.file}:${hit.line} "${hit.text}"`).join("\n");
    expect(hits, report).toEqual([]);
  });
});
