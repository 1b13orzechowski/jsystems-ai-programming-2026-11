import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { loadPolicy, extractRuleIds } from "@/lib/ai/policies";

const FORBIDDEN_PATTERNS: ReadonlyArray<RegExp | string> = [
  /\d+[\s,.]*(zł|pln|eur|€|\$)(?![\p{L}\p{N}])/iu,
  "zwrot pieniędzy w ciągu",
  "odszkodowanie",
  "rekompensata",
  "prawnie wiążąc",
  "@",
  "http",
];

function matchesForbidden(text: string, pattern: RegExp | string): boolean {
  return typeof pattern === "string" ? text.toLowerCase().includes(pattern.toLowerCase()) : pattern.test(text);
}

describe("loadPolicy", () => {
  it("returns the return policy with rule IDs Z-1…Z-8 and no R- IDs for zwrot", () => {
    const policy = loadPolicy("zwrot");

    expect(policy.caseType).toBe("zwrot");
    const zIds = [...policy.ruleIds].filter((id) => id.startsWith("Z-"));
    const rIds = [...policy.ruleIds].filter((id) => id.startsWith("R-"));
    expect(zIds.length).toBeGreaterThanOrEqual(8);
    expect(rIds).toEqual([]);
    for (let n = 1; n <= 8; n += 1) {
      expect(policy.ruleIds.has(`Z-${n}`)).toBe(true);
    }
    expect(policy.text).toContain("# Zasady zwrotów");
  });

  it("returns the complaint policy with rule IDs R-1…R-9 and no Z- IDs for reklamacja", () => {
    const policy = loadPolicy("reklamacja");

    expect(policy.caseType).toBe("reklamacja");
    const rIds = [...policy.ruleIds].filter((id) => id.startsWith("R-"));
    const zIds = [...policy.ruleIds].filter((id) => id.startsWith("Z-"));
    expect(rIds.length).toBeGreaterThanOrEqual(9);
    expect(zIds).toEqual([]);
    for (let n = 1; n <= 9; n += 1) {
      expect(policy.ruleIds.has(`R-${n}`)).toBe(true);
    }
    expect(policy.text).toContain("# Zasady reklamacji");
  });

  it("caches the policy per case type", () => {
    expect(loadPolicy("zwrot")).toBe(loadPolicy("zwrot"));
  });

  it("throws an error naming the missing file when the directory has no policy files", () => {
    const emptyDir = join(tmpdir(), `policies-missing-${randomUUID()}`);

    expect(() => loadPolicy("zwrot", emptyDir)).toThrow(/return-policy\.md/);
  });

  it("throws when a policy file has no rule IDs (ADR-002 §3: fail on a file without rule IDs)", () => {
    const dir = join(tmpdir(), `policies-no-ids-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "complaint-policy.md"), "# Zasady reklamacji\n\nBrak reguł.\n");

    expect(() => loadPolicy("reklamacja", dir)).toThrow(/complaint-policy\.md.*no rule IDs/);
  });

  it("every case type file contains a sample/PoC note and no forbidden content", () => {
    for (const caseType of ["zwrot", "reklamacja"] as const) {
      const { text } = loadPolicy(caseType);
      expect(/przykładow|PoC/.test(text)).toBe(true);
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(matchesForbidden(text, pattern), `${caseType} matches ${String(pattern)}`).toBe(false);
      }
    }
  });
});

describe("extractRuleIds", () => {
  it("returns heading rule IDs in order without duplicates and ignores IDs in body text", () => {
    const markdown = [
      "# Tytuł",
      "",
      "### Z-2 Drugi punkt",
      "Odwołanie do Z-9 w treści nie tworzy reguły.",
      "",
      "### Z-1 Pierwszy punkt",
      "Tekst.",
      "",
      "### Z-2 Powtórzony punkt",
      "",
      "### R-10 Inny typ",
      "",
    ].join("\n");

    expect(extractRuleIds(markdown)).toEqual(["Z-2", "Z-1", "R-10"]);
  });

  it("returns an empty array when there are no rule headings", () => {
    expect(extractRuleIds("# Bez reguł\n\nZ-1 w zwykłym tekście.")).toEqual([]);
  });
});
