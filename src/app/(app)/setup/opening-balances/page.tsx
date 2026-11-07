"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Hint, GLOSSARY } from "@/components/hint";
import { Title } from "@/components/page";
import { Button, Card, Field, Input, ErrorState, useToast } from "@/components/ui";
import { fyStart } from "@/lib/dates";
import { useAccounts } from "@/lib/hooks";
import { money, toMinor } from "@/lib/money";
import { errorMessage, useOrg } from "@/lib/org";
import type { OpeningPreview } from "@/lib/types";

const GROUPS: [string, string, string][] = [["asset", "What you own", "Bank, cash, money customers owe you, equipment"], ["liability", "What you owe", "Loans, unpaid bills, tax payable"], ["equity", "Owner's money", "Capital already in the business"]];

export default function OpeningBalances() {
  const { org, call, can } = useOrg();
  const cur = org!.base_currency, dp = org!.decimal_places;
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { accounts, loading } = useAccounts();
  const dayBefore = useMemo(() => { const d = new Date(fyStart(org!.financial_year_start) + "T00:00:00"); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }, [org]);
  const [asOf, setAsOf] = useState(dayBefore);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<OpeningPreview | null>(null);
  const [busy, setBusy] = useState<null | "preview" | "save">(null);
  const [err, setErr] = useState<string | null>(null);

  if (!can("accountant")) return <ErrorState message="Your role can't enter opening balances." />;
  const rows = Object.entries(vals).filter(([, v]) => v.trim() !== "" && (toMinor(v, dp) ?? 0n) > 0n).map(([account_id, amount]) => ({ account_id, amount: amount.trim() }));
  const bad = Object.values(vals).some((v) => v.trim() !== "" && toMinor(v, dp) === null);

  const run = async (dry: boolean) => {
    setBusy(dry ? "preview" : "save"); setErr(null);
    try {
      const r = await call<OpeningPreview>("/accounting/opening-balances", { json: { as_of_date: asOf, balances: rows, dry_run: dry } });
      if (dry) setPreview(r); else { await qc.invalidateQueries(); toast("Opening balances saved."); router.push("/"); }
    } catch (e) { setErr(errorMessage(e)); setPreview(null); } finally { setBusy(null); }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Title sub="Tell us what you already have on the day you start. Leave anything blank that doesn't apply.">Opening balances</Title>
      <p className="text-sm"><Hint label="what is this?">{GLOSSARY.openingBalances}</Hint></p>
      <Card className="p-4"><Field label="As of" hint="Usually the day before your financial year starts.">{(id) => <Input id={id} type="date" value={asOf} onChange={(e) => { setAsOf(e.target.value); setPreview(null); }} />}</Field></Card>
      {loading ? null : GROUPS.map(([type, title, sub]) => {
        const list = accounts.filter((a) => a.account_type === type);
        return list.length ? (
          <section key={type}><h2 className="px-1 font-display text-lg font-semibold">{title}</h2><p className="mb-2 px-1 text-xs text-muted">{sub}</p>
            <Card className="divide-y divide-border overflow-hidden">
              {list.map((a) => (
                <label key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{a.account_name}</span><span className="text-xs text-muted">{a.account_code}</span></span>
                  <input inputMode="decimal" aria-label={`Opening balance for ${a.account_name}`} placeholder="0" value={vals[a.id] ?? ""} onChange={(e) => { setVals({ ...vals, [a.id]: e.target.value.replace(/[^\d.]/g, "") }); setPreview(null); }}
                    className="num h-11 w-36 rounded-xl border border-border bg-surface px-3 text-right focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30" />
                </label>
              ))}
            </Card></section>
        ) : null;
      })}
      {bad && <p role="alert" className="text-sm text-expense">Use at most {dp} decimal places.</p>}
      {err && <p role="alert" className="rounded-2xl bg-expense-soft p-3 text-sm text-expense">{err}</p>}
      {preview && (
        <Card className="space-y-2 p-4 anim-rise">
          <h2 className="font-display text-lg font-semibold">What will be recorded</h2>
          {preview.lines.map((l) => (
            <div key={l.account_id} className="flex justify-between gap-3 text-sm"><span className={l.is_balancing ? "italic" : ""}>{l.account_name}{l.is_balancing && " (balances the rest)"}</span>
              <span className="num">{Number(l.debit_amount) > 0 ? `${money(l.debit_amount, cur, dp)} Dr` : `${money(l.credit_amount, cur, dp)} Cr`}</span></div>
          ))}
          <p className="flex items-center gap-1.5 border-t border-border pt-2 text-sm font-semibold text-brand-strong"><CheckCircle2 className="size-4" /> Both sides total {money(preview.total_debit, cur, dp)}</p>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" loading={busy === "preview"} disabled={rows.length === 0 || bad || !!busy} onClick={() => run(true)}>Preview</Button>
        <Button loading={busy === "save"} disabled={!preview || !!busy} onClick={() => run(false)}>Save balances</Button>
      </div>
    </div>
  );
}
