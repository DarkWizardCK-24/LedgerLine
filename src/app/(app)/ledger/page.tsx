"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Title } from "@/components/page";
import { Button, Card, Chips, EmptyState, ErrorState, Field, Input, Select, Skeleton } from "@/components/ui";
import { fmtDate } from "@/lib/dates";
import { money } from "@/lib/money";
import { useOrg, useOrgQuery } from "@/lib/org";
import type { Account, LedgerPage, Page } from "@/lib/types";

function LedgerView() {
  const { org } = useOrg();
  const cur = org!.base_currency, dp = org!.decimal_places;
  const params = useSearchParams();
  const accounts = useOrgQuery<Page<Account>>(["accounts-all"], "/accounts", { page_size: "200" });
  const [account, setAccount] = useState(params.get("account") ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [side, setSide] = useState<"all" | "debit" | "credit">("all");
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  useEffect(() => { if (!account && accounts.data?.items.length) setAccount(accounts.data.items.find((a) => a.account_subtype === "bank")?.id ?? accounts.data.items[0].id); }, [accounts.data, account]);
  const led = useOrgQuery<LedgerPage>(["ledger", account], `/accounts/${account}/ledger`, { date_from: from || undefined, date_to: to || undefined, side: side === "all" ? undefined : side, sort, page: String(page), page_size: "30" }, !!account);
  const d = led.data;

  return (
    <div>
      <Title sub="Every posting to one account, with a running balance.">General ledger</Title>
      <Card className="space-y-3 p-4">
        <Field label="Account">{(id) => <Select id={id} value={account} onChange={(e) => { setAccount(e.target.value); setPage(1); }}>{accounts.data?.items.map((a) => <option key={a.id} value={a.id}>{a.account_code} · {a.account_name}</option>)}</Select>}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">{(id) => <Input id={id} type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />}</Field>
          <Field label="To">{(id) => <Input id={id} type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />}</Field>
        </div>
        <Chips value={side} onChange={(v) => { setSide(v); setPage(1); }} options={[{ value: "all", label: "All" }, { value: "debit", label: "Debits" }, { value: "credit", label: "Credits" }]} />
      </Card>

      {led.error ? <ErrorState message={(led.error as Error).message} retry={() => led.refetch()} /> : (
        <>
          <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[["Opening", d?.opening_balance], ["Debits", d?.period_debits], ["Credits", d?.period_credits], ["Closing", d?.closing_balance]].map(([l, v], i) => (
              <Card key={l} className={`p-3.5 ${i === 3 ? "bg-brand-gradient border-transparent text-white" : ""}`}>
                <p className={`text-xs font-semibold ${i === 3 ? "text-white/80" : "text-muted"}`}>{l}</p>
                {led.isLoading ? <Skeleton className="mt-1 h-6 w-24" /> : <p className="num truncate text-lg font-bold">{money(v, cur, dp)}</p>}
              </Card>
            ))}
          </section>

          <Card className="mt-4 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <p className="text-sm font-semibold">{d ? `${d.total} transaction${d.total === 1 ? "" : "s"}` : "Loading…"}</p>
              <button onClick={() => setSort((s) => (s === "asc" ? "desc" : "asc"))} className="tap text-sm font-semibold text-brand-strong">{sort === "asc" ? "Oldest first" : "Newest first"}</button>
            </div>
            {led.isLoading ? <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div> :
             d && d.items.length === 0 ? <EmptyState art="chart" title="No transactions" body="Nothing has been posted to this account in the selected range." /> : (
              <>
                {/* phone: transaction cards. desktop: dense table */}
                <ul className="divide-y divide-border lg:hidden">
                  {d?.items.map((r) => (
                    <li key={r.line_id}>
                      <Link href={`/journal/${r.entry_id}`} className="tap block px-4 py-3 hover:bg-surface-muted">
                        <div className="flex justify-between gap-3"><span className="min-w-0 truncate font-semibold">{r.description || "Journal entry"}</span>
                          <span className={`num shrink-0 font-bold ${Number(r.credit) > 0 ? "text-warning" : "text-brand-strong"}`}>{Number(r.debit) > 0 ? "+" : "−"}{money(Number(r.debit) > 0 ? r.debit : r.credit, cur, dp)}</span></div>
                        <div className="mt-0.5 flex justify-between text-xs text-muted"><span>{fmtDate(r.entry_date)} · {r.display_number}</span><span className="num">Bal {money(r.running_balance, cur, dp)}</span></div>
                      </Link>
                    </li>
                  ))}
                </ul>
                <table className="hidden w-full text-sm lg:table">
                  <thead className="bg-surface-muted text-left text-xs uppercase tracking-wider text-muted"><tr><th className="px-4 py-2.5">Date</th><th>Entry</th><th>Reference</th><th>Description</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="px-4 text-right">Balance</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {d?.items.map((r) => (
                      <tr key={r.line_id} className="hover:bg-surface-muted">
                        <td className="px-4 py-2.5">{fmtDate(r.entry_date)}</td>
                        <td><Link href={`/journal/${r.entry_id}`} className="font-semibold text-brand-strong hover:underline">{r.display_number}</Link></td>
                        <td className="text-muted">{r.reference_number}</td><td className="max-w-[28ch] truncate">{r.description}</td>
                        <td className="num text-right">{Number(r.debit) > 0 ? money(r.debit, cur, dp) : ""}</td><td className="num text-right">{Number(r.credit) > 0 ? money(r.credit, cur, dp) : ""}</td>
                        <td className="num px-4 text-right font-bold">{money(r.running_balance, cur, dp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </Card>
          {d && d.total > d.page_size && (
            <div className="mt-4 flex items-center justify-between">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="text-sm text-muted">Page {d.page} of {Math.ceil(d.total / d.page_size)}</span>
              <Button variant="secondary" size="sm" disabled={page * d.page_size >= d.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function LedgerPageRoute() {
  return <Suspense fallback={<Skeleton className="h-64" />}><LedgerView /></Suspense>;
}
