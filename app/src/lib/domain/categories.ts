// PRD 8.2 fixed lists. Values are the exact strings sent by the form and stored in the case token.

/** Builds a readonly literal tuple without a type assertion (`as const` is banned by ESLint). */
export function literalTuple<const T extends readonly [string, ...string[]]>(...values: T): T {
  return values;
}

export const CASE_TYPES = literalTuple("zwrot", "reklamacja");
export type CaseType = (typeof CASE_TYPES)[number];

export const EQUIPMENT_CATEGORIES = literalTuple(
  "Smartfon",
  "Laptop",
  "Tablet",
  "Komputer stacjonarny",
  "Monitor",
  "Telewizor",
  "Słuchawki i audio",
  "Smartwatch i opaski",
  "Aparat i kamera",
  "Konsola do gier",
  "Akcesoria komputerowe",
  "Inne",
);
export type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number];
