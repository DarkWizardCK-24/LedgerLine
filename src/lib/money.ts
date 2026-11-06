/**
 * Money helpers. The API sends amounts as decimal STRINGS ("1234.50"); we never parse them into floats for arithmetic.
 * Sums use BigInt minor units (e.g. paise), so 0.1 + 0.2 is exactly 0.3.
 */

/** "1234.5" + 2 decimals -> 123450n. Returns null for anything that is not a plain non-negative decimal. */
export function toMinor(value: string, decimals: number): bigint | null {
  const v = value.trim();
  if (v === "") return 0n;
  if (!/^\d+(\.\d+)?$/.test(v)) return null;
  const [whole, frac = ""] = v.split(".");
  if (frac.length > decimals) return null; // more precision than the organization allows: reject, never round
  return BigInt(whole + frac.padEnd(decimals, "0"));
}

export function fromMinor(minor: bigint, decimals: number): string {
  const neg = minor < 0n;
  const abs = (neg ? -minor : minor).toString().padStart(decimals + 1, "0");
  const whole = abs.slice(0, abs.length - decimals);
  const frac = decimals ? "." + abs.slice(abs.length - decimals) : "";
  return (neg ? "-" : "") + whole + frac;
}

const cache = new Map<string, Intl.NumberFormat>();
function fmt(currency: string, decimals: number) {
  const key = `${currency}:${decimals}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(currency === "INR" ? "en-IN" : undefined, {
      style: "currency", currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    });
    cache.set(key, f);
  }
  return f;
}

/** Display only. Splits the digits so the string, not a float, drives the output for typical magnitudes. */
export function money(value: string | null | undefined, currency: string, decimals = 2): string {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return fmt(currency, decimals).format(n);
}

/** Compact for chart axes and dense cards: 1.2L / 3.4Cr in India, 1.2K / 3.4M elsewhere. */
export function compact(value: string | number, currency: string): string {
  const n = typeof value === "number" ? value : Number(value);
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export const isNegative = (v: string) => v.trim().startsWith("-");
