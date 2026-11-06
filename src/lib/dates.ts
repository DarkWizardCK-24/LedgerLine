export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const today = () => iso(new Date());

/** First day of the financial year containing `day`, for an organization whose year starts in `startMonth` (1-12). */
export function fyStart(startMonth: number, day = new Date()): string {
  const y = day.getMonth() + 1 >= startMonth ? day.getFullYear() : day.getFullYear() - 1;
  return `${y}-${String(startMonth).padStart(2, "0")}-01`;
}

export function fmtDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short" });
}
