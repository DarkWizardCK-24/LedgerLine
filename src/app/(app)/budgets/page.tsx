"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Title } from "@/components/page";
import { Button, Card, ErrorState, Skeleton, useToast } from "@/components/ui";
import { fyStart } from "@/lib/dates";
import { useAccounts } from "@/lib/hooks";
import { toMinor } from "@/lib/money";
import { errorMessage, useOrg, useOrgQuery } from "@/lib/org";
import type { BudgetRow } from "@/lib/types";

const addMonths = (ym: string, n: number) => { const [y, m] = ym.split("-").map(Number); const t = y * 12 + (m - 1) + n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`; };

export default function BudgetsPage() {
  const { org, can, call } = useOrg();
  const dp = org!.decimal_places;
  const qc = useQueryClient();
  const toast = useToast();
  const { byType, loading } = useAccounts();
  const start = fyStart(org!.financial_year_start).slice(0, 7), end = addMonths(start, 11);
  const rows = useOrgQuery<BudgetRow[]>(["budgets"], "/account-budgets", { start_month: start, end_month: end });
  const current = useMemo(() => { const m: Record<string, string> = {}; for (const r of rows.data ?? []) m[r.account_id] = r.months[start] ?? Object.values(r.months)[0] ?? ""; return m; }, [rows.data, start]);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const value = (id: string) => vals[id] ?? (current[id] ? String(Number(current[id])) : "");
  const dirty = Object.entries(vals).filter(([id, v]) => v !== (current[id] ? String(Number(current[id])) : ""));
  const bad = dirty.some(([, v]) => v !== "" && toMinor(v, dp) === null);

  const save = async () => {
    setBusy(true);
    try {
      for (const [account_id, v] of dirty) await call("/account-budgets", { method: "PUT", json: { account_id, start_month: start, end_month: end, amount: v === "" ? "0" : v } });
      await qc.invalidateQueries(); setVals({}); toast("Budgets saved for the whole financial year.");
    } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };

  if (!can("accountant")) return <ErrorState message="Your role can view budgets but not change them." />;
  const groups: [string, ReturnType<typeof byType>][] = [["Income you expect", byType("revenue")], ["Spending you plan", byType("expense")]];
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Title sub={`A monthly amount for each account, applied to every month from ${start} to ${end}. Leave blank for no budget.`}>Budgets</Title>
      {rows.error ? <ErrorState message={(rows.error as Error).message} retry={() => rows.refetch()} /> : loading || rows.isLoading ? <Skeleton className="h-64" /> : groups.map(([title, list]) => (
        <section key={title}><h2 className="mb-2 px-1 font-display text-lg font-semibold">{title}</h2>
          <Card className="divide-y divide-border overflow-hidden">{list.map((a) => (
            <label key={a.id} className="flex items-center gap-3 px-4 py-2.5"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{a.account_name}</span><span className="text-xs text-muted">per month</span></span>
              <input inputMode="decimal" aria-label={`Monthly budget for ${a.account_name}`} placeholder="0" value={value(a.id)} onChange={(e) => setVals({ ...vals, [a.id]: e.target.value.replace(/[^\d.]/g, "") })}
                className="num h-11 w-36 rounded-xl border border-border bg-surface px-3 text-right focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30" /></label>))}</Card></section>
      ))}
      {bad && <p role="alert" className="text-sm text-expense">Use at most {dp} decimal places.</p>}
      <div className="sticky bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom,0px)+8px)] z-10 grid grid-cols-2 gap-3 lg:static">
        <Link href="/reports" className="contents"><Button variant="secondary">See budget vs actual</Button></Link>
        <Button loading={busy} disabled={dirty.length === 0 || bad} onClick={save}>Save {dirty.length > 0 ? `(${dirty.length})` : ""}</Button>
      </div>
    </div>
  );
}
