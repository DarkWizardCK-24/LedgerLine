"use client";

import { cx } from "./ui";

export function Title({ children, sub, action }: { children: React.ReactNode; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight lg:text-4xl">{children}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/** Colours a signed amount: expenses/credits out in coral, income in green. */
export function Amt({ value, className, tone }: { value: string; className?: string; tone?: "income" | "expense" | "plain" }) {
  const neg = value.trim().startsWith("-");
  const color = tone === "plain" ? "" : tone === "expense" ? "text-expense" : tone === "income" ? "text-income" : neg ? "text-expense" : "";
  return <span className={cx("num", color, className)}>{value}</span>;
}

export const PALETTE = ["#0E8A5B", "#F2B536", "#E2674F", "#8CCB5E", "#C98F2B", "#2F9E7A", "#F08C6B", "#B5C94B"];
