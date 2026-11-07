"use client";

import { CheckCircle2, Download, FileText, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Title } from "@/components/page";
import { Button, Card, Chips, ErrorState, Field, Input, Skeleton, cx, useToast } from "@/components/ui";
import { Hint, GLOSSARY } from "@/components/hint";
import { ExtraReports, type ExtraTab } from "@/components/more-reports";
import { downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fyStart, today } from "@/lib/dates";
import { money } from "@/lib/money";
import { errorMessage, useOrg, useOrgQuery } from "@/lib/org";
import type { BalanceSheet, ProfitLoss, ReportSection, TrialBalance } from "@/lib/types";

type Tab = "pl" | "bs" | "tb" | ExtraTab;

export default function ReportsPage() {
  const { org } = useOrg();
  const { getToken } = useAuth();
  const toast = useToast();
  const cur = org!.base_currency, dp = org!.decimal_places;
  const [tab, setTab] = useState<Tab>("pl");
  const [from, setFrom] = useState(fyStart(org!.financial_year_start));
  const [to, setTo] = useState(today());
  const [compare, setCompare] = useState(false);
  const [zero, setZero] = useState(false);

  const pl = useOrgQuery<ProfitLoss>(["r-pl"], "/reports/profit-loss", { start_date: from, end_date: to, compare: compare ? "true" : undefined }, tab === "pl");
  const bs = useOrgQuery<BalanceSheet>(["r-bs"], "/reports/balance-sheet", { as_of: to }, tab === "bs");
  const tb = useOrgQuery<TrialBalance>(["r-tb"], "/reports/trial-balance", { as_of: to, include_zero: zero ? "true" : undefined }, tab === "tb");
  const extra = tab === "cf" || tab === "bud" || tab === "gst";
  const active = tab === "pl" ? pl : tab === "bs" ? bs : tb;

  const exportAs = async (format: "csv" | "pdf") => {
    try {
      const token = await getToken();
      if (!token) return;
      const q = tab === "pl" ? `/reports/profit-loss?start_date=${from}&end_date=${to}${compare ? "&compare=true" : ""}` : tab === "bs" ? `/reports/balance-sheet?as_of=${to}` : `/reports/trial-balance?as_of=${to}${zero ? "&include_zero=true" : ""}`;
      await downloadFile(token, `${q}${q.includes("?") ? "&" : "?"}format=${format}`, `report.${format}`, org!.id);
      toast(`${format.toUpperCase()} downloaded.`);
    } catch (e) { toast(errorMessage(e), "error"); }
  };

  return (
    <div>
      <Title sub="Calculated live from posted entries." action={extra ? undefined : <div className="flex gap-2"><Button variant="secondary" size="sm" onClick={() => exportAs("pdf")}><FileText className="size-4" /> PDF</Button><Button variant="secondary" size="sm" onClick={() => exportAs("csv")}><Download className="size-4" /> CSV</Button></div>}>Reports</Title>
      <Chips value={tab} onChange={setTab} options={[{ value: "pl", label: "Profit & loss" }, { value: "bs", label: "Balance sheet" }, { value: "tb", label: "Trial balance" }, { value: "cf", label: "Cash flow" }, { value: "bud", label: "Budget vs actual" }, { value: "gst", label: "GST" }]} />

      {extra ? <ExtraReports tab={tab as ExtraTab} /> : (<>
      <Card className="mt-4 space-y-3 p-4">
        <div className={tab === "pl" ? "grid grid-cols-2 gap-3" : "grid gap-3"}>
          {tab === "pl" ? <Field label="From">{(id) => <Input id={id} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}</Field> : null}
          <Field label={tab === "pl" ? "To" : "As of"}>{(id) => <Input id={id} type="date" value={to} onChange={(e) => setTo(e.target.value)} />}</Field>
        </div>
        {tab === "pl" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="size-4 accent-[var(--brand)]" /> Compare with the previous period</label>}
        {tab === "tb" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={zero} onChange={(e) => setZero(e.target.checked)} className="size-4 accent-[var(--brand)]" /> Include zero-balance accounts</label>}
      </Card>

      <div className="mt-4">
        {active.error ? <ErrorState message={(active.error as Error).message} retry={() => active.refetch()} /> :
         active.isLoading ? <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div> : (
          <>
            {tab === "pl" && pl.data && (
              <div className="space-y-4">
                <Sections title="Income" sections={pl.data.income} cur={cur} dp={dp} compare={compare} />
                <Total label="Total income" value={pl.data.total_income} cmp={compare ? pl.data.compare_total_income : null} cur={cur} dp={dp} />
                <Sections title="Expenses" sections={pl.data.expenses} cur={cur} dp={dp} compare={compare} />
                <Total label="Total expenses" value={pl.data.total_expenses} cmp={compare ? pl.data.compare_total_expenses : null} cur={cur} dp={dp} />
                <Card className="grid grid-cols-2 gap-3 p-4 text-sm">
                  <span className="text-muted">Gross profit</span><span className="num text-right font-bold">{money(pl.data.gross_profit, cur, dp)}</span>
                  <span className="text-muted">Operating profit</span><span className="num text-right font-bold">{money(pl.data.operating_profit, cur, dp)}</span>
                </Card>
                <Hero label={Number(pl.data.net_profit) < 0 ? "Net loss" : "Net profit"} value={pl.data.net_profit} cmp={compare ? pl.data.compare_net_profit : null} cur={cur} dp={dp} />
              </div>
            )}
            {tab === "bs" && bs.data && (
              <div className="space-y-4">
                <Sections title="Assets" sections={bs.data.assets} cur={cur} dp={dp} />
                <Total label="Total assets" value={bs.data.total_assets} cur={cur} dp={dp} />
                <Sections title="Liabilities" sections={bs.data.liabilities} cur={cur} dp={dp} />
                <Total label="Total liabilities" value={bs.data.total_liabilities} cur={cur} dp={dp} />
                <Sections title="Equity" sections={bs.data.equity} cur={cur} dp={dp} />
                <Total label="Total equity" value={bs.data.total_equity} cur={cur} dp={dp} />
                <Total label="Total liabilities + equity" value={bs.data.total_liabilities_and_equity} cur={cur} dp={dp} />
                <Check ok={bs.data.balanced} text={bs.data.balanced ? "Assets equal liabilities plus equity." : `Out of balance by ${money(bs.data.difference, cur, dp)}.`} />
              </div>
            )}
            {tab === "tb" && tb.data && (
              <div className="space-y-4">
                <p className="text-sm"><Hint label="What is a trial balance?">{GLOSSARY.trialBalance}</Hint></p>
                <Card className="overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 bg-surface-muted px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted"><span>Account</span><span className="w-24 text-right sm:w-32">Debit</span><span className="w-24 text-right sm:w-32">Credit</span></div>
                  <ul className="divide-y divide-border">
                    {tb.data.rows.map((r) => (
                      <li key={r.account_id}><Link href={`/ledger?account=${r.account_id}`} className="tap grid grid-cols-[1fr_auto_auto] items-center gap-x-4 px-4 py-2.5 text-sm hover:bg-surface-muted">
                        <span className="min-w-0 truncate"><span className="num mr-2 text-muted">{r.account_code}</span><span className="font-semibold">{r.account_name}</span></span>
                        <span className="num w-24 text-right sm:w-32">{Number(r.debit) > 0 ? money(r.debit, cur, dp) : ""}</span><span className="num w-24 text-right sm:w-32">{Number(r.credit) > 0 ? money(r.credit, cur, dp) : ""}</span>
                      </Link></li>
                    ))}
                    {tb.data.rows.length === 0 && <li className="p-6 text-center text-sm text-muted">No balances as of this date.</li>}
                  </ul>
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-t-2 border-border bg-surface-muted px-4 py-3 text-sm font-bold"><span>Total</span><span className="num w-24 text-right sm:w-32">{money(tb.data.total_debit, cur, dp)}</span><span className="num w-24 text-right sm:w-32">{money(tb.data.total_credit, cur, dp)}</span></div>
                </Card>
                <Check ok={tb.data.balanced} text={tb.data.balanced ? "Debits equal credits." : `Unbalanced by ${money(tb.data.difference, cur, dp)}.`} />
              </div>
            )}
          </>
        )}
      </div>
      </>)}
    </div>
  );
}

function Sections({ title, sections, cur, dp, compare }: { title: string; sections: ReportSection[]; cur: string; dp: number; compare?: boolean }) {
  const shown = sections.filter((s) => s.lines.length > 0);
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-muted">{title}</h2>
      <Card className="divide-y divide-border overflow-hidden">
        {shown.length === 0 && <p className="p-4 text-sm text-muted">Nothing to show.</p>}
        {shown.map((s) => (
          <div key={s.key} className="p-4">
            <p className="mb-1 text-sm font-bold text-brand-strong">{s.label}</p>
            {s.lines.map((l) => (
              <div key={l.account_id ?? l.account_name} className="flex items-baseline justify-between gap-3 py-1 text-sm">
                {l.account_id ? <Link href={`/ledger?account=${l.account_id}`} className="min-w-0 truncate hover:underline">{l.account_name}</Link> : <span className="min-w-0 truncate italic">{l.account_name}</span>}
                <span className="num shrink-0">
                  <span className={l.amount.startsWith("-") ? "text-expense" : ""}>{money(l.amount, cur, dp)}</span>
                  {compare && l.compare_amount != null && <span className="ml-3 text-xs text-muted">{money(l.compare_amount, cur, dp)}</span>}
                </span>
              </div>
            ))}
            <div className="mt-1 flex justify-between border-t border-dashed border-border pt-1.5 text-sm font-bold"><span>Total {s.label.toLowerCase()}</span><span className="num">{money(s.total, cur, dp)}</span></div>
          </div>
        ))}
      </Card>
    </section>
  );
}

function Total({ label, value, cmp, cur, dp }: { label: string; value: string; cmp?: string | null; cur: string; dp: number }) {
  return <div className="flex items-baseline justify-between rounded-2xl bg-brand-soft px-4 py-3 font-bold text-brand-strong"><span>{label}</span><span className="num text-lg">{money(value, cur, dp)}{cmp != null && <span className="ml-3 text-xs font-semibold opacity-70">{money(cmp, cur, dp)}</span>}</span></div>;
}

function Hero({ label, value, cmp, cur, dp }: { label: string; value: string; cmp?: string | null; cur: string; dp: number }) {
  return (
    <div className={cx("rounded-3xl p-5 text-white", value.startsWith("-") ? "bg-[linear-gradient(135deg,#8c2a1f,#d2493b)]" : "bg-brand-gradient")}>
      <p className="text-sm font-semibold text-white/80">{label}</p>
      <p className="num font-display text-4xl font-semibold">{money(value, cur, dp)}</p>
      {cmp != null && <p className="mt-1 text-sm text-white/80">Previous period: {money(cmp, cur, dp)}</p>}
    </div>
  );
}

function Check({ ok, text }: { ok: boolean; text: string }) {
  return <p role="status" className={cx("flex items-center gap-2 rounded-2xl p-3 text-sm font-semibold", ok ? "bg-brand-soft text-brand-strong" : "bg-expense-soft text-expense")}>{ok ? <CheckCircle2 className="size-5" /> : <TriangleAlert className="size-5" />}{text}</p>;
}
