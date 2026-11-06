import { describe, expect, it } from "vitest";
import { fmtDate, fyStart, iso, monthLabel } from "./dates";

describe("fyStart", () => {
  it("returns the start of the financial year containing the day (April year)", () => {
    expect(fyStart(4, new Date(2026, 4, 10))).toBe("2026-04-01"); // 10 May 2026
    expect(fyStart(4, new Date(2026, 3, 1))).toBe("2026-04-01"); // first day of the year
    expect(fyStart(4, new Date(2026, 2, 31))).toBe("2025-04-01"); // last day of the previous year
    expect(fyStart(4, new Date(2026, 1, 10))).toBe("2025-04-01");
  });
  it("works for calendar-year and other start months", () => {
    expect(fyStart(1, new Date(2026, 11, 31))).toBe("2026-01-01");
    expect(fyStart(10, new Date(2026, 8, 30))).toBe("2025-10-01");
    expect(fyStart(10, new Date(2026, 9, 1))).toBe("2026-10-01");
  });
});

describe("date formatting", () => {
  it("formats a local date as YYYY-MM-DD without timezone shifts", () => {
    expect(iso(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(iso(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
  it("parses ISO dates as local days (no off-by-one)", () => {
    expect(fmtDate("2026-04-30")).toContain("30");
    expect(fmtDate("2026-01-01")).toContain("2026");
  });
  it("labels months", () => {
    expect(monthLabel("2026-04").length).toBeGreaterThan(0);
  });
});
