// TAC-002-07: no AI SDK v5/v6 names in application source. The project targets AI SDK v7 names only.
// Scanner limits: line-based regexes. It does not parse TypeScript, so `system:` is matched as an
// object key only when it starts a line or follows `{` or `,`. Multi-line string literals are not inspected.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

type Hit = { file: string; line: number; pattern: string };

const FORBIDDEN: ReadonlyArray<{ pattern: string; regex: RegExp }> = [
  { pattern: "generateObject", regex: /\bgenerateObject\b/ },
  { pattern: "streamObject", regex: /\bstreamObject\b/ },
  { pattern: "stepCountIs", regex: /\bstepCountIs\b/ },
  { pattern: "fullStream", regex: /\bfullStream\b/ },
  { pattern: "type: 'image'", regex: /type:\s*['"]image['"]/ },
  { pattern: "system: (object key)", regex: /(^|[{,])\s*system\s*:/ },
  { pattern: "onFinish", regex: /\bonFinish\b/ },
];

export function scanForForbiddenNames(file: string, content: string): Hit[] {
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
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const SRC_DIR = join(process.cwd(), "src");
const EXCLUDED_PREFIX = `src${sep}components${sep}ui${sep}`;

describe("AI SDK names guard (TAC-002-07)", () => {
  it("detects every forbidden name in an in-memory sample", () => {
    const sample = [
      "const r = generateObject({ model, schema });",
      "const s = streamObject({ model });",
      "stopWhen: stepCountIs(3),",
      "for await (const part of result.fullStream) {}",
      "content: [{ type: 'image', image: url }],",
      "const cfg = { model, system: 'You are helpful' };",
      "streamText({ model, onFinish: () => {} });",
    ].join("\n");

    const patterns = scanForForbiddenNames("sample.ts", sample).map((hit) => hit.pattern);
    expect(patterns).toEqual(
      expect.arrayContaining([
        "generateObject",
        "streamObject",
        "stepCountIs",
        "fullStream",
        "type: 'image'",
        "system: (object key)",
        "onFinish",
      ]),
    );
  });

  it("does not flag the v7 equivalents in an in-memory sample", () => {
    const clean = [
      "const r = generateText({ model, output: Output.object({ schema }) });",
      "stopWhen: isStepCount(3),",
      "const cfg = { model, instructions: 'You are helpful' };",
      "streamText({ model, onStepFinish: () => {} });",
      "const label = 'system status';",
    ].join("\n");

    expect(scanForForbiddenNames("clean.ts", clean)).toEqual([]);
  });

  it("finds no forbidden names in src/ (excluding components/ui)", () => {
    const hits: Hit[] = [];
    for (const absolute of listSourceFiles(SRC_DIR)) {
      const rel = relative(process.cwd(), absolute);
      if (rel.startsWith(EXCLUDED_PREFIX)) continue;
      hits.push(...scanForForbiddenNames(rel, readFileSync(absolute, "utf8")));
    }

    const report = hits.map((hit) => `${hit.file}:${hit.line} ${hit.pattern}`).join("\n");
    expect(hits, report).toEqual([]);
  });
});
