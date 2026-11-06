"use client";

import { ArrowDownRight, ArrowUpRight, CircleCheck, Landmark, Lock, PiggyBank, Scale, TriangleAlert, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PALETTE, Title } from "@/components/page";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { fmtDate, fyStart, monthLabel, today } from "@/lib/dates";
import { compact, fromMinor, money, toMinor } from "@/lib/money";
import { useOrg, useOrgQuery } from "@/lib/org";
import type { BalanceSheet, Entry, Overview, Page, ProfitLoss } from "@/lib/types";

export default function Dashboard() {
  const { org, can } = useOrg();
  const cur = org!.base_currency, dp = org!.decimal_places;
  const start = fyStart(org!.financial_year_start), end = today();
  const bs = useOrgQuery<BalanceSheet>(["dash-bs"], "/reports/balance-sheet", { as_of: end });
  const pl = useOrgQuery<ProfitLoss>(["dash-pl"], "/reports/profit-loss", { start_date: start, end_date: end, monthly: "true" });
  const recent = useOrgQuery<Page<Entry>>(["dash-recent"], "/journal-entries", { page_size: "5", status: "posted" });
  const ov = useOrgQuery<Overview>(["overview"], "/accounting/overview");

  const cash = useMemo(() => {
    if (!bs.data) return "0";
    let t = 0n;
    for (const s of bs.data.assets) for (const l of s.lines) if (l.account_subtype === "cash" || l.account_subtype === "bank") t += toMinor(l.amount.replace("-", ""), dp)! * (l.amount.startsWith("-") ? -1n : 1n);
    return fromMinor(t, dp);
  }, [bs.data, dp]);

  const monthly = useMemo(() => {
    const p = pl.data;
    if (!p?.months) return [];
    const sum = (secs: typeof p.income, i: number) => secs.reduce((a, s) => a + Number(s.monthly_totals?.[i] ?? 0), 0);
    return p.months.map((m, i) => ({ month: monthLabel(m), Income: sum(p.income, i), Expenses: sum(p.expenses, i) }));
  }, [pl.data]);

  const spend = useMemo(() => {
    const p = pl.data;
    if (!p) return [];
    return p.expenses.flatMap((s) => s.lines).map((l) => ({ name: l.account_name, value: Number(l.amount) })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [pl.data]);

  const loading = bs.isLoading || pl.isLoading;
  const error = bs.error ?? pl.error;
  const empty = !loading && !error && recent.data?.total === 0;

  return (
    <div className="min-w-0 space-y-5">
      <Title sub={`${org!.name} · FY from ${fmtDate(start)}`}>Overview</Title>
      {error && <ErrorState message={(error as Error).message} retry={() => { bs.refetch(); pl.refetch(); }} />}

      {empty ? (
        <Card><EmptyState art="chart" title="Your books are empty" body="Record your first journal entry, for example the owner's capital investment, and this page will fill with live figures." action={can("accountant") ? <Link href="/journal/new"><Button>Record first entry</Button></Link> : undefined} /></Card>
      ) : (
        <>
          {/* net profit hero */}
          <section className="bg-brand-gradient relative overflow-hidden rounded-[28px] p-5 text-white shadow-[0_18px_40px_-18px_rgb(6_78_59/0.8)] lg:p-7 anim-rise">
            <div className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full bg-[#ffe08a]/25 blur-2xl" />
            <p className="text-sm font-semibold text-white/80">Net profit this financial year</p>
            {loading ? <Skeleton className="mt-2 h-10 w-48 !bg-white/20" /> : (
              <p className="num font-display mt-1 text-4xl font-semibold lg:text-5xl">{money(pl.data?.net_profit, cur, dp)}</p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Mini icon={<ArrowUpRight className="size-4" />} label="Income" value={loading ? null : money(pl.data?.total_income, cur, dp)} />
              <Mini icon={<ArrowDownRight className="size-4" />} label="Expenses" value={loading ? null : money(pl.data?.total_expenses, cur, dp)} />
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={<Wallet />} label="Cash & bank" value={loading ? null : money(cash, cur, dp)} />
            <Stat icon={<Landmark />} label="Total assets" value={loading ? null : money(bs.data?.total_assets, cur, dp)} />
            <Stat icon={<Scale />} label="Liabilities" value={loading ? null : money(bs.data?.total_liabilities, cur, dp)} />
            <Stat icon={<PiggyBank />} label="Equity" value={loading ? null : money(bs.data?.total_equity, cur, dp)} />
          </section>

          {bs.data && !bs.data.balanced && (
            <div role="alert" className="rounded-2xl bg-expense-soft p-4 text-sm text-expense"><b>The books are out of balance</b> by {money(bs.data.difference, cur, dp)}. Review recent entries.</div>
          )}

          {ov.data && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="min-w-0 p-4 lg:col-span-2">
                <h2 className="font-display text-lg font-semibold">Needs attention</h2>
                {ov.data.attention.length === 0 ? (
                  <p className="mt-3 flex items-center gap-2 text-sm text-muted"><CircleCheck className="size-5 text-income" /> Nothing needs attention right now.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-border">
                    {ov.data.attention.map((a, i) => (
                      <li key={i}><Link href={a.href ?? "#"} className="tap flex items-start gap-3 py-3 hover:opacity-80"><TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" /><span className="min-w-0"><span className="block text-sm font-semibold">{a.title}</span><span className="block text-xs text-muted">{a.detail}</span></span></Link></li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card className="min-w-0 space-y-3 p-4">
                <h2 className="font-display text-lg font-semibold">Books status</h2>
                <Link href="/reconciliation" className="tap flex items-center justify-between rounded-2xl bg-surface-muted px-3 py-2.5 text-sm"><span className="font-semibold">Reconciliations</span><span className="text-muted">{ov.data.open_reconciliations.length ? `${ov.data.open_reconciliations.length} in progress` : "none open"}</span></Link>
                <Link href="/journal?status=draft" className="tap flex items-center justify-between rounded-2xl bg-surface-muted px-3 py-2.5 text-sm"><span className="font-semibold">Draft entries</span><span className="text-muted">{ov.data.draft_count}</span></Link>
                <Link href="/settings" className="tap flex items-center justify-between rounded-2xl bg-surface-muted px-3 py-2.5 text-sm"><span className="font-semibold">Current period</span><span className="flex items-center gap-1 text-muted">{ov.data.current_period ? <>{ov.data.current_period.status === "closed" && <Lock className="size-3.5" />}{ov.data.current_period.name}</> : "not set"}</span></Link>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <Card className="min-w-0 p-4 lg:col-span-3">
              <h2 className="font-display text-lg font-semibold">Income vs expenses</h2>
              <div className="mt-3 h-56">
                {loading ? <Skeleton className="h-full w-full" /> : monthly.length === 0 ? <p className="grid h-full place-items-center text-sm text-muted">No activity yet.</p> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthly} margin={{ left: -12, right: 4, top: 8 }} barGap={4}>
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} tickFormatter={(v) => compact(v, cur)} width={52} />
                      <Tooltip cursor={{ fill: "var(--surface-muted)" }} formatter={(v) => money(String(v), cur, dp)} contentStyle={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)" }} />
                      <Bar dataKey="Income" fill="#0E8A5B" radius={[8, 8, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                      <Bar dataKey="Expenses" fill="#E2674F" radius={[8, 8, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card className="min-w-0 p-4 lg:col-span-2">
              <h2 className="font-display text-lg font-semibold">Where the money goes</h2>
              {loading ? <Skeleton className="mt-3 h-56 w-full" /> : spend.length === 0 ? <p className="grid h-56 place-items-center text-sm text-muted">No expenses yet.</p> : (
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-40 w-40 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={spend} dataKey="value" innerRadius={44} outerRadius={70} paddingAngle={3} stroke="none" isAnimationActive={false}>{spend.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}</Pie></PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
                    {spend.map((s, i) => (
                      <li key={s.name} className="flex items-center gap-2"><span className="size-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} /><span className="truncate">{s.name}</span><span className="num ml-auto text-muted">{compact(s.value, cur)}</span></li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-4 pb-1 pt-4"><h2 className="font-display text-lg font-semibold">Recent entries</h2><Link href="/journal" className="text-sm font-semibold text-brand-strong">View all</Link></div>
            {recent.isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-14" /><Skeleton className="h-14" /></div> : (
              <ul className="divide-y divide-border">
                {recent.data?.items.map((e) => (
                  <li key={e.id}>
                    <Link href={`/journal/${e.id}`} className="tap flex items-center gap-3 px-4 py-3 hover:bg-surface-muted">
                      <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-xs font-bold text-brand-strong">{e.entry_number ? `#${e.entry_number}` : "—"}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{e.description || "Journal entry"}</span><span className="text-xs text-muted">{fmtDate(e.entry_date)}</span></span>
                      <span className="num font-semibold">{money(e.total_debit, cur, dp)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
      <Badge tone="muted">All figures are calculated live from posted journal entries.</Badge>
    </div>
  );
}

function Mini({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  return (
    <div className="rounded-2xl bg-white/12 p-3 backdrop-blur-sm">
      <p className="flex items-center gap-1 text-xs font-semibold text-white/80">{icon}{label}</p>
      {value === null ? <Skeleton className="mt-1 h-6 w-24 !bg-white/20" /> : <p className="num mt-0.5 truncate text-lg font-bold">{value}</p>}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  return (
    <Card className="p-4 anim-rise">
      <span className="grid size-9 place-items-center rounded-xl bg-gold-soft text-warning [&>svg]:size-5">{icon}</span>
      <p className="mt-3 text-xs font-semibold text-muted">{label}</p>
      {value === null ? <Skeleton className="mt-1 h-6 w-24" /> : <p className="num truncate text-lg font-bold">{value}</p>}
    </Card>
  );
}
