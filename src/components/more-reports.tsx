"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fyStart, today } from "@/lib/dates";
import { money } from "@/lib/money";
import { errorMessage, useOrg, useOrgQuery } from "@/lib/org";
import type { BudgetReport, CashFlow, GstSummary, ReportSection, TaxCode } from "@/lib/types";
import { Hint, GLOSSARY } from "./hint";
import { Badge, Button, Card, ErrorState, Field, Input, Skeleton, cx, useToast } from "./ui";

export type ExtraTab = "cf" | "bud" | "gst";

function Range({ from, to, setFrom, setTo }: { from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void }) {
  return <Card className="mt-4 grid grid-cols-2 gap-3 p-4"><Field label="From">{(id) => <Input id={id} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}</Field><Field label="To">{(id) => <Input id={id} type="date" value={to} onChange={(e) => setTo(e.target.value)} />}</Field></Card>;
}

export function ExtraReports({ tab }: { tab: ExtraTab }) {
  return tab === "cf" ? <CashFlowView /> : tab === "bud" ? <BudgetView /> : <GstView />;
}

function FlowSection({ s, cur, dp }: { s: ReportSection; cur: string; dp: number }) {
  return (
    <Card className="p-4">
      <p className="mb-1 text-sm font-bold text-brand-strong">{s.label}</p>
      {s.lines.length === 0 && <p className="py-1 text-sm text-muted">No cash movements.</p>}
      {s.lines.map((l) => <div key={l.account_id ?? l.account_name} className="flex items-baseline justify-between gap-3 py-1 text-sm"><span className="min-w-0 truncate">{l.account_name}</span><span className={cx("num shrink-0", l.amount.startsWith("-") && "text-expense")}>{money(l.amount, cur, dp)}</span></div>)}
      <div className="mt-1 flex justify-between border-t border-dashed border-border pt-1.5 text-sm font-bold"><span>Net from {s.label.toLowerCase().replace(" activities", "")}</span><span className={cx("num", s.total.startsWith("-") && "text-expense")}>{money(s.total, cur, dp)}</span></div>
    </Card>
  );
}

export function CashFlowView() {
  const { org } = useOrg();
  const cur = org!.base_currency, dp = org!.decimal_places;
  const [from, setFrom] = useState(fyStart(org!.financial_year_start));
  const [to, setTo] = useState(today());
  const q = useOrgQuery<CashFlow>(["r-cf"], "/reports/cash-flow", { start_date: from, end_date: to });
  const d = q.data;
  return (
    <div>
      <Range from={from} to={to} setFrom={setFrom} setTo={setTo} />
      <div className="mt-4 space-y-4">
        {q.error ? <ErrorState message={(q.error as Error).message} retry={() => q.refetch()} /> : q.isLoading || !d ? <Skeleton className="h-48" /> : (
          <>
            <p className="text-sm text-muted">Where your cash and bank balances actually came from and went to. <Hint label="how to read this">Operating is day-to-day business (sales, bills, salaries). Investing is buying or selling equipment. Financing is loans and the owner's own money. Moving money between your own bank and cash accounts is not shown, because nothing was gained or lost.</Hint></p>
            <Card className="flex items-baseline justify-between p-4"><span className="font-semibold">Cash at the start</span><span className="num text-lg font-bold">{money(d.opening_cash, cur, dp)}</span></Card>
            <FlowSection s={d.operating} cur={cur} dp={dp} /><FlowSection s={d.investing} cur={cur} dp={dp} /><FlowSection s={d.financing} cur={cur} dp={dp} />
            <div className="bg-brand-gradient rounded-3xl p-5 text-white"><p className="text-sm font-semibold text-white/80">{Number(d.net_change) < 0 ? "Cash went down by" : "Cash went up by"}</p>
              <p className="num font-display text-4xl font-semibold">{money(String(Math.abs(Number(d.net_change))), cur, dp)}</p><p className="mt-1 text-sm text-white/80">Cash at the end: {money(d.closing_cash, cur, dp)}</p></div>
            <p role="status" className={cx("flex items-center gap-2 rounded-2xl p-3 text-sm font-semibold", d.reconciles ? "bg-brand-soft text-brand-strong" : "bg-expense-soft text-expense")}>{d.reconciles ? <CheckCircle2 className="size-5" /> : <TriangleAlert className="size-5" />}{d.reconciles ? "Matches your bank and cash balances exactly." : "Does not match your bank and cash balances. Please review recent entries."}</p>
          </>
        )}
      </div>
    </div>
  );
}

export function BudgetView() {
  const { org, can } = useOrg();
  const cur = org!.base_currency, dp = org!.decimal_places;
  const [from, setFrom] = useState(fyStart(org!.financial_year_start));
  const [to, setTo] = useState(today());
  const q = useOrgQuery<BudgetReport>(["r-bud"], "/reports/budget-vs-actual", { start_date: from, end_date: to });
  const d = q.data;
  return (
    <div>
      <Range from={from} to={to} setFrom={setFrom} setTo={setTo} />
      <div className="mt-4 space-y-4">
        {q.error ? <ErrorState message={(q.error as Error).message} retry={() => q.refetch()} /> : q.isLoading || !d ? <Skeleton className="h-48" /> : d.lines.length === 0 ? (
          <Card className="p-6 text-center"><p className="font-semibold">No budgets set yet</p><p className="mt-1 text-sm text-muted">Set a monthly budget for your income and expense accounts to see how you are doing against the plan.</p>{can("accountant") && <Link href="/budgets"><Button className="mt-4">Set budgets</Button></Link>}</Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-3.5"><p className="text-xs font-semibold text-muted">Income vs plan</p><p className="num text-lg font-bold">{money(d.total_actual_income, cur, dp)}</p><p className="text-xs text-muted">planned {money(d.total_budget_income, cur, dp)}</p></Card>
              <Card className="p-3.5"><p className="text-xs font-semibold text-muted">Spending vs plan</p><p className="num text-lg font-bold">{money(d.total_actual_expense, cur, dp)}</p><p className="text-xs text-muted">planned {money(d.total_budget_expense, cur, dp)}</p></Card>
            </div>
            <Card className="divide-y divide-border overflow-hidden">
              {d.lines.map((l) => {
                const pct = l.percent_used ? Math.min(Number(l.percent_used), 100) : 0;
                return (
                  <div key={l.account_id} className="space-y-1.5 px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3"><span className="min-w-0 truncate font-semibold">{l.account_name}</span><span className="num text-sm"><b>{money(l.actual, cur, dp)}</b> <span className="text-muted">of {money(l.budget, cur, dp)}</span></span></div>
                    {Number(l.budget) > 0 && <div className="h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${l.account_name} budget used`}><div className={cx("h-full rounded-full", l.favourable ? "bg-brand" : "bg-expense")} style={{ width: `${pct}%` }} /></div>}
                    <div className="flex items-center justify-between text-xs"><span className="text-muted">{l.percent_used ? `${l.percent_used}% of plan` : "No budget"}</span><Badge tone={l.favourable ? "brand" : "expense"}>{l.account_type === "expense" ? (l.favourable ? "within budget" : "over budget") : l.favourable ? "on or above plan" : "below plan"}</Badge></div>
                  </div>
                );
              })}
            </Card>
            {can("accountant") && <Link href="/budgets" className="block text-center text-sm font-semibold text-brand-strong">Change budgets</Link>}
          </>
        )}
      </div>
    </div>
  );
}

export function GstView() {
  const { org, can, call } = useOrg();
  const { getToken } = useAuth();
  const cur = org!.base_currency, dp = org!.decimal_places;
  const qc = useQueryClient();
  const toast = useToast();
  const [from, setFrom] = useState(today().slice(0, 8) + "01");
  const [to, setTo] = useState(today());
  const q = useOrgQuery<GstSummary>(["r-gst"], "/reports/gst-summary", { start_date: from, end_date: to });
  const codes = useOrgQuery<TaxCode[]>(["tax-codes"], "/tax-codes");
  const d = q.data;
  const seed = async () => { try { await call("/tax-codes/seed-gst", { method: "POST" }); await qc.invalidateQueries(); toast("Standard GST rates added."); } catch (e) { toast(errorMessage(e), "error"); } };
  const csv = async () => { try { const t = await getToken(); if (t) await downloadFile(t, `/reports/gst-summary?format=csv&start_date=${from}&end_date=${to}`, "gst-summary.csv", org!.id); } catch (e) { toast(errorMessage(e), "error"); } };
  return (
    <div>
      <Range from={from} to={to} setFrom={setFrom} setTo={setTo} />
      <div className="mt-4 space-y-4">
        <p className="text-sm text-muted">GST you charged and GST you can claim, from issued invoices and bills. <Hint label="what is this?">{GLOSSARY.gst}</Hint></p>
        {(codes.data?.length ?? 1) === 0 && can("accountant") && <Card className="flex items-center justify-between gap-3 p-4"><p className="text-sm">No tax rates yet. Add the standard GST slabs (0, 5, 12, 18 and 28%) to use on invoices and bills.</p><Button size="sm" onClick={seed}>Add GST rates</Button></Card>}
        {q.error ? <ErrorState message={(q.error as Error).message} retry={() => q.refetch()} /> : q.isLoading || !d ? <Skeleton className="h-40" /> : (
          <>
            <div className="bg-brand-gradient rounded-3xl p-5 text-white"><p className="text-sm font-semibold text-white/80">{Number(d.net_payable) < 0 ? "Credit to carry forward" : "GST to pay"}</p><p className="num font-display text-4xl font-semibold">{money(String(Math.abs(Number(d.net_payable))), cur, dp)}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm"><span className="rounded-2xl bg-white/12 p-2.5">Collected<br /><b className="num">{money(d.output_tax, cur, dp)}</b></span><span className="rounded-2xl bg-white/12 p-2.5">Claimable<br /><b className="num">{money(d.input_tax, cur, dp)}</b></span></div></div>
            {d.rows.length === 0 ? <Card className="p-6 text-center text-sm text-muted">No taxed invoices or bills in this period.</Card> : (
              <Card className="divide-y divide-border overflow-hidden">{d.rows.map((r) => (
                <div key={r.tax_code_id} className="flex items-center gap-3 px-4 py-3"><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{r.name}</span><span className="text-xs text-muted">on {money(r.taxable_value, cur, dp)}</span></span><span className="num font-bold">{money(r.tax, cur, dp)}</span></div>))}</Card>
            )}
            <Button variant="secondary" size="sm" onClick={csv}><Download className="size-4" /> Download CSV</Button>
          </>
        )}
      </div>
    </div>
  );
}
