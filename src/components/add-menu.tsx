"use client";

import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, BookOpen, FileInput, FileText, Receipt } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { QuickKind } from "@/lib/types";
import { QuickForm } from "./quick-form";
import { Sheet, cx } from "./ui";

const TITLE: Record<QuickKind, string> = { money_in: "Money in", money_out: "Money out", transfer: "Transfer" };

/** What the big "+" button opens: the everyday things first, the full journal last. */
export function AddMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [kind, setKind] = useState<QuickKind | null>(null);
  const close = () => { setKind(null); onClose(); };
  const Item = ({ icon: Icon, title, sub, tone, onClick, href }: { icon: typeof BookOpen; title: string; sub: string; tone: string; onClick?: () => void; href?: string }) => {
    const inner = <><span className={cx("grid size-11 shrink-0 place-items-center rounded-2xl", tone)}><Icon className="size-5" /></span><span className="min-w-0"><span className="block font-semibold">{title}</span><span className="block text-xs text-muted">{sub}</span></span></>;
    const cls = "tap flex w-full items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-3 text-left transition hover:bg-surface-muted";
    return href ? <Link href={href} onClick={close} className={cls}>{inner}</Link> : <button type="button" onClick={onClick} className={cls}>{inner}</button>;
  };
  return (
    <Sheet open={open} onClose={close} title={kind ? TITLE[kind] : "Add"}>
      {kind ? <div className="pb-3"><QuickForm initialKind={kind} onDone={close} compact /></div> : (
        <div className="space-y-2 pb-3">
          <Item icon={ArrowDownLeft} title="Money in" sub="Sales, customer payments, loans received" tone="bg-brand-soft text-brand-strong" onClick={() => setKind("money_in")} />
          <Item icon={ArrowUpRight} title="Money out" sub="Rent, salaries, supplies, purchases" tone="bg-expense-soft text-expense" onClick={() => setKind("money_out")} />
          <Item icon={ArrowLeftRight} title="Transfer" sub="Between your own bank and cash" tone="bg-gold-soft text-warning" onClick={() => setKind("transfer")} />
          <p className="px-1 pt-2 text-xs font-bold uppercase tracking-widest text-muted">Documents</p>
          <Item icon={FileText} title="Invoice" sub="Bill a customer" tone="bg-brand-soft text-brand-strong" href="/invoices/new?type=invoice" />
          <Item icon={Receipt} title="Bill" sub="Record what you owe a supplier" tone="bg-surface-muted text-foreground" href="/invoices/new?type=bill" />
          <p className="px-1 pt-2 text-xs font-bold uppercase tracking-widest text-muted">More</p>
          <Item icon={BookOpen} title="Journal entry" sub="Debits and credits, full control" tone="bg-surface-muted text-foreground" href="/journal/new" />
          <Item icon={FileInput} title="Import" sub="From Lensly, Ledgerly, Excel or CSV" tone="bg-surface-muted text-foreground" href="/import" />
        </div>
      )}
    </Sheet>
  );
}
