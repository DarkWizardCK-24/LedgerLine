import { describe, expect, it } from "vitest";
import { compact, fromMinor, isNegative, money, toMinor } from "./money";

describe("toMinor / fromMinor (exact decimal arithmetic)", () => {
  it("parses plain decimals into integer minor units", () => {
    expect(toMinor("1234.5", 2)).toBe(123450n);
    expect(toMinor("0.07", 2)).toBe(7n);
    expect(toMinor("100", 2)).toBe(10000n);
    expect(toMinor("", 2)).toBe(0n);
    expect(toMinor("100", 0)).toBe(100n);
  });

  it("rejects more precision than the organization allows instead of rounding", () => {
    expect(toMinor("10.005", 2)).toBeNull();
    expect(toMinor("100.5", 0)).toBeNull();
  });

  it("rejects anything that is not a plain non-negative decimal", () => {
    for (const bad of ["abc", "1,000", "-5", "1e3", "1.2.3", ".5", "5."]) expect(toMinor(bad, 2)).toBeNull();
  });

  it("adds exactly where floating point does not", () => {
    expect(0.1 + 0.2).not.toBe(0.3); // the hazard
    expect(toMinor("0.10", 2)! + toMinor("0.20", 2)!).toBe(toMinor("0.30", 2));
    let sum = 0n;
    for (let i = 0; i < 100; i++) sum += toMinor("0.01", 2)!;
    expect(fromMinor(sum, 2)).toBe("1.00");
  });

  it("formats minor units back, including negatives and small values", () => {
    expect(fromMinor(123450n, 2)).toBe("1234.50");
    expect(fromMinor(5n, 2)).toBe("0.05");
    expect(fromMinor(-5n, 2)).toBe("-0.05");
    expect(fromMinor(0n, 2)).toBe("0.00");
    expect(fromMinor(42n, 0)).toBe("42");
    expect(fromMinor(1234567n, 3)).toBe("1234.567");
  });

  it("round-trips", () => {
    for (const v of ["0.00", "0.01", "99999999999999.99", "12500.75"]) expect(fromMinor(toMinor(v, 2)!, 2)).toBe(v);
  });
});

describe("display formatting", () => {
  it("groups INR the Indian way and keeps the fixed number of decimals", () => {
    expect(money("100000", "INR", 2).replace(/\s/g, "")).toBe("₹1,00,000.00");
    expect(money("8200.5", "INR", 2).replace(/\s/g, "")).toBe("₹8,200.50");
  });
  it("handles zero decimals and empty values", () => {
    expect(money("100", "JPY", 0).replace(/\s/g, "")).toMatch(/100$/);
    expect(money(null, "INR")).toBe("—");
    expect(money("", "INR")).toBe("—");
  });
  it("compacts chart ticks and detects negatives", () => {
    expect(compact(240000, "INR")).toMatch(/2\.4L/);
    expect(isNegative("-2000.00")).toBe(true);
    expect(isNegative("2000.00")).toBe(false);
  });
});
