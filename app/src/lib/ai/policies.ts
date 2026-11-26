import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { CaseType } from "@/lib/domain/categories";
import { RULE_ID_PATTERN } from "@/lib/domain/schemas";

export type Policy = { caseType: CaseType; text: string; ruleIds: ReadonlySet<string> };

const FILE_BY_CASE_TYPE: Record<CaseType, string> = {
  zwrot: "return-policy.md",
  reklamacja: "complaint-policy.md",
};

const RULE_HEADING = /^###\s+([ZR]-\d{1,2})\b/gm;

// Cache only the default directory; an explicit `dir` always reads from disk.
const defaultCache = new Map<CaseType, Policy>();

/** Rule IDs from `### Z-1 …` / `### R-1 …` headings, in order, without duplicates. */
export function extractRuleIds(markdown: string): string[] {
  const ids: string[] = [];
  for (const match of markdown.matchAll(RULE_HEADING)) {
    const id = match[1];
    if (id !== undefined && RULE_ID_PATTERN.test(id) && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

export function loadPolicy(caseType: CaseType, dir?: string): Policy {
  const useCache = dir === undefined;
  const cached = useCache ? defaultCache.get(caseType) : undefined;
  if (cached) return cached;

  // Static literal paths for the default directory so Next/Turbopack can trace the files into the build.
  const path =
    dir !== undefined
      ? join(/* turbopackIgnore: true */ dir, FILE_BY_CASE_TYPE[caseType]) // test-only directory, not traced
      : caseType === "zwrot"
        ? join(process.cwd(), "content/policies/return-policy.md")
        : join(process.cwd(), "content/policies/complaint-policy.md");

  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (cause) {
    throw new Error(`Policy file missing or unreadable: ${path}`, { cause });
  }

  const ruleIds = extractRuleIds(text);
  if (ruleIds.length === 0) {
    throw new Error(`Policy file ${path} has no rule IDs`);
  }

  const policy: Policy = { caseType, text, ruleIds: new Set(ruleIds) };
  if (useCache) defaultCache.set(caseType, policy);
  return policy;
}
