import { describe, expect, it } from "vitest";

import { PolicyWindowSchema } from "@/lib/domain/schemas";
import { computePolicyWindow, todayInTimeZone } from "@/lib/domain/policy-window";

const WARSAW = "Europe/Warsaw";

/** Noon UTC keeps the calendar date stable for any zone between UTC-11 and UTC+11. */
function noonOn(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

describe("todayInTimeZone", () => {
  it("uses the calendar date of the instant in Warsaw just after midnight", () => {
    expect(todayInTimeZone(new Date("2026-11-25T23:30:00Z"), WARSAW)).toBe("2026-11-26");
  });

  it("uses the UTC calendar date for the same instant in UTC", () => {
    expect(todayInTimeZone(new Date("2026-11-25T23:30:00Z"), "UTC")).toBe("2026-11-25");
  });
});

describe("computePolicyWindow: zwrot (return, 14 days)", () => {
  it("is within on day 14 after purchase", () => {
    const window = computePolicyWindow({
      caseType: "zwrot",
      purchaseDate: "2026-11-12",
      now: noonOn("2026-11-26"),
      timeZone: WARSAW,
    });
    expect(window.elapsedDays).toBe(14);
    expect(window.withinWindow).toBe(true);
  });

  it("is outside on day 15 after purchase", () => {
    const window = computePolicyWindow({
      caseType: "zwrot",
      purchaseDate: "2026-11-11",
      now: noonOn("2026-11-26"),
      timeZone: WARSAW,
    });
    expect(window.elapsedDays).toBe(15);
    expect(window.withinWindow).toBe(false);
  });

  it("counts the purchase day itself as day 0", () => {
    const window = computePolicyWindow({
      caseType: "zwrot",
      purchaseDate: "2026-11-26",
      now: noonOn("2026-11-26"),
      timeZone: WARSAW,
    });
    expect(window.elapsedDays).toBe(0);
    expect(window.withinWindow).toBe(true);
  });

  it("reports days/14 as the limit", () => {
    const window = computePolicyWindow({
      caseType: "zwrot",
      purchaseDate: "2026-11-12",
      now: noonOn("2026-11-26"),
      timeZone: WARSAW,
    });
    expect(window.limitUnit).toBe("days");
    expect(window.limitValue).toBe(14);
  });
});

describe("computePolicyWindow: reklamacja (complaint, 24 months)", () => {
  it("is within on exactly 24 months after purchase", () => {
    const window = computePolicyWindow({
      caseType: "reklamacja",
      purchaseDate: "2024-11-26",
      now: noonOn("2026-11-26"),
      timeZone: WARSAW,
    });
    expect(window.elapsedMonths).toBe(24);
    expect(window.withinWindow).toBe(true);
    expect(window.limitUnit).toBe("months");
    expect(window.limitValue).toBe(24);
  });

  it("is outside one day after 24 months", () => {
    const window = computePolicyWindow({
      caseType: "reklamacja",
      purchaseDate: "2024-11-25",
      now: noonOn("2026-11-26"),
      timeZone: WARSAW,
    });
    expect(window.withinWindow).toBe(false);
  });

  it("counts 12 whole months one year after purchase", () => {
    const window = computePolicyWindow({
      caseType: "reklamacja",
      purchaseDate: "2025-11-26",
      now: noonOn("2026-11-26"),
      timeZone: WARSAW,
    });
    expect(window.elapsedMonths).toBe(12);
    expect(window.withinWindow).toBe(true);
  });
});

describe("computePolicyWindow: 29 February", () => {
  it("clamps 2024-02-29 + 24 months to 2026-02-28 (within on that day)", () => {
    const window = computePolicyWindow({
      caseType: "reklamacja",
      purchaseDate: "2024-02-29",
      now: noonOn("2026-02-28"),
      timeZone: WARSAW,
    });
    expect(window.withinWindow).toBe(true);
  });

  it("is outside on 2026-03-01", () => {
    const window = computePolicyWindow({
      caseType: "reklamacja",
      purchaseDate: "2024-02-29",
      now: noonOn("2026-03-01"),
      timeZone: WARSAW,
    });
    expect(window.withinWindow).toBe(false);
  });
});

describe("computePolicyWindow: month end", () => {
  it("clamps 2024-08-31 + 24 months to 2026-08-31 (within on that day)", () => {
    const window = computePolicyWindow({
      caseType: "reklamacja",
      purchaseDate: "2024-08-31",
      now: noonOn("2026-08-31"),
      timeZone: WARSAW,
    });
    expect(window.withinWindow).toBe(true);
  });

  it("is outside on 2026-09-01", () => {
    const window = computePolicyWindow({
      caseType: "reklamacja",
      purchaseDate: "2024-08-31",
      now: noonOn("2026-09-01"),
      timeZone: WARSAW,
    });
    expect(window.withinWindow).toBe(false);
  });
});

describe("computePolicyWindow: time zone and DST", () => {
  it("takes the submission date from the Warsaw calendar, not UTC", () => {
    const window = computePolicyWindow({
      caseType: "zwrot",
      purchaseDate: "2026-11-01",
      now: new Date("2026-11-25T23:30:00Z"),
      timeZone: WARSAW,
    });
    expect(window.submissionDate).toBe("2026-11-26");
  });

  it("takes the submission date from the UTC calendar when asked for UTC", () => {
    const window = computePolicyWindow({
      caseType: "zwrot",
      purchaseDate: "2026-11-01",
      now: new Date("2026-11-25T23:30:00Z"),
      timeZone: "UTC",
    });
    expect(window.submissionDate).toBe("2026-11-25");
  });

  it("does not shift day counts across the Warsaw DST switch", () => {
    const window = computePolicyWindow({
      caseType: "zwrot",
      purchaseDate: "2026-03-20",
      now: new Date("2026-04-03T10:00:00Z"),
      timeZone: WARSAW,
    });
    expect(window.elapsedDays).toBe(14);
    expect(window.withinWindow).toBe(true);
  });
});

describe("computePolicyWindow: output contract", () => {
  it("parses with PolicyWindowSchema and echoes the dates", () => {
    const window = computePolicyWindow({
      caseType: "reklamacja",
      purchaseDate: "2025-05-10",
      now: noonOn("2026-11-26"),
      timeZone: WARSAW,
    });
    expect(PolicyWindowSchema.parse(window)).toEqual(window);
    expect(window.purchaseDate).toBe("2025-05-10");
    expect(window.submissionDate).toBe("2026-11-26");
  });
});
