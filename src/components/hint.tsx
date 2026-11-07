"use client";

import { CircleHelp } from "lucide-react";
import { useState } from "react";
import { cx } from "./ui";

/** A small "what does this mean?" helper that explains accounting words in plain language. */
export function Hint({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className={cx("inline-block align-middle", className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`What is ${label}?`}
        className="tap inline-flex items-center gap-1 rounded-full px-1.5 text-xs font-semibold text-brand-strong hover:bg-brand-soft">
        <CircleHelp className="size-4" /> {label}
      </button>
      {open && <span role="note" className="mt-1.5 block max-w-prose rounded-2xl bg-brand-soft p-3 text-sm font-normal leading-relaxed text-foreground anim-rise">{children}</span>}
    </span>
  );
}

export const GLOSSARY = {
  debitCredit: "Every transaction has two sides. A debit puts value into an account (like cash arriving or an expense being incurred); a credit takes it out of one (like income being earned or money going out of the bank). They always add up to the same total, which is how your books stay correct.",
  trialBalance: "A list of every account with its balance, split into a debit column and a credit column. If the two columns have the same total, your books are in balance.",
  reconciliation: "Checking that what your bank statement says matches what your books say, line by line, until the difference is zero.",
  draft: "A draft is saved but not counted yet. It does not change any report until you post it.",
  posted: "Once posted, an entry is permanent and counts in every report. To fix a mistake you reverse it, which keeps a clear history.",
  receivable: "Money your customers owe you for invoices you have sent.",
  payable: "Money you owe your suppliers for bills you have received.",
  aging: "How long invoices have been waiting to be paid, grouped into current, 1 to 30 days late, 31 to 60, and so on.",
  gst: "Output tax is GST you charged customers (you owe it to the government). Input tax is GST you paid on purchases (you can claim it back). The difference is what you pay.",
  openingBalances: "What you already own and owe on the day you start using Ledgerline: money in the bank, what customers owe you, loans. The leftover goes to the owner's capital.",
  recurring: "Entries that repeat on a schedule, such as rent or salaries. You get a reminder when one is due and create it with one tap.",
  approval: "A second person checks entries before they count. Useful when more than one person works on the books.",
  yearEnd: "At the end of the financial year, the year's profit is moved into retained earnings and the year is locked.",
} as const;
