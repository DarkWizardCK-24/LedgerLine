"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { today } from "@/lib/dates";
import { fromMinor, money, toMinor } from "@/lib/money";
import { errorMessage, useOrg, useOrgQuery } from "@/lib/org";
import type { Account, Entry, Page } from "@/lib/types";
import { Hint, GLOSSARY } from "./hint";
import { Button, Card, Field, Input, Select, cx, useToast } from "./ui";

type Row = { key: number; account_id: string; side: "debit" | "credit"; amount: string; description: string };
const TYPE_ORDER = ["asset", "liability", "equity", "revenue", "expense"];
let seq = 0;
const blank = (side: Row["side"] = "debit"): Row => ({ key: ++seq, account_id: "", side, amount: "", description: "" });

export function EntryEditor({ entry, onSaved }: { entry?: Entry; onSaved?: () => void }) {
  const { org, call } = useOrg();
  const dp = org!.decimal_places, cur = org!.base_currency;
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const accounts = useOrgQuery<Page<Account>>(["accounts-active"], "/accounts", { page_size: "200", active: "true" });

  const [date, setDate] = useState(entry?.entry_date ?? today());
  const [description, setDescription] = useState(entry?.description ?? "");
  const [reference, setReference] = useState(entry?.reference_number ?? "");
  const [rows, setRows] = useState<Row[]>(() =>
    entry ? entry.lines.map((l) => ({ key: ++seq, account_id: l.account_id, side: Number(l.debit_amount) > 0 ? "debit" : "credit", amount: Number(l.debit_amount) > 0 ? l.debit_amount : l.credit_amount, description: l.description })) : [blank("debit"), blank("credit")]);
  const [busy, setBusy] = useState<null | "draft" | "post">(null);
  const [err, setErr] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const by: Record<string, Account[]> = {};
    for (const a of accounts.data?.items ?? []) (by[a.account_type] ??= []).push(a);
    return TYPE_ORDER.filter((t) => by[t]).map((t) => [t, by[t]] as const);
  }, [accounts.data]);

  const totals = useMemo(() => {
    let d = 0n, c = 0n, bad = false;
    for (const r of rows) {
      const m = toMinor(r.amount, dp);
      if (m === null) { bad = true; continue; }
      if (r.side === "debit") d += m; else c += m;
    }
    return { d, c, diff: d - c, bad };
  }, [rows, dp]);

  const usable = rows.filter((r) => r.account_id && (toMinor(r.amount, dp) ?? 0n) > 0n);
  const balanced = !totals.bad && totals.d === totals.c && totals.d > 0n && usable.length >= 2 && usable.length === rows.length;
  const set = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const payload = () => ({
    entry_date: date, description, reference_number: reference,
    lines: rows.filter((r) => r.account_id && (toMinor(r.amount, dp) ?? 0n) > 0n).map((r) => ({
      account_id: r.account_id, description: r.description,
      debit_amount: r.side === "debit" ? r.amount.trim() : "0", credit_amount: r.side === "credit" ? r.amount.trim() : "0",
    })),
  });

  const save = async (post: boolean) => {
    setErr(null);
    if (usable.length === 0) return setErr("Add at least one line with an account and an amount.");
    setBusy(post ? "post" : "draft");
    try {
      const saved = entry
        ? await call<Entry>(`/journal-entries/${entry.id}`, { method: "PATCH", json: payload() })
        : await call<Entry>("/journal-entries", { json: payload() });
      if (post) {
        await call<Entry>(`/journal-entries/${saved.id}/post`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() } });
        toast("Entry posted to the ledger.");
      } else toast("Draft saved.");
      await qc.invalidateQueries();
      if (onSaved) onSaved(); else router.replace(`/journal/${saved.id}`);
    } catch (e) {
      setErr(errorMessage(e));
      if (post) { await qc.invalidateQueries(); }
    } finally { setBusy(null); }
  };

  return (
    <div className="pb-44 lg:pb-0">
      <Card className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Date">{(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
          <Field label="Reference">{(id) => <Input id={id} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Invoice or cheque no." maxLength={60} />}</Field>
          <Field label="Description">{(id) => <Input id={id} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What happened?" maxLength={500} />}</Field>
        </div>
      </Card>

      <p className="mt-3 px-1 text-sm"><Hint label="What are debit and credit?">{GLOSSARY.debitCredit}</Hint></p>
      <div className="mt-4 space-y-3">
        {rows.map((r, i) => (
          <Card key={r.key} className="space-y-3 p-4 anim-rise">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Line {i + 1}</span>
              {rows.length > 2 && <button onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label={`Remove line ${i + 1}`} className="tap grid place-items-center rounded-xl text-muted hover:bg-expense-soft hover:text-expense"><Trash2 className="size-5" /></button>}
            </div>
            <Select aria-label={`Account for line ${i + 1}`} value={r.account_id} onChange={(e) => set(r.key, { account_id: e.target.value })}>
              <option value="">Select account…</option>
              {grouped.map(([t, list]) => <optgroup key={t} label={t[0].toUpperCase() + t.slice(1)}>{list.map((a) => <option key={a.id} value={a.id}>{a.account_code} · {a.account_name}</option>)}</optgroup>)}
            </Select>
            <div className="grid grid-cols-[auto_1fr] gap-3">
              <div role="radiogroup" aria-label={`Side for line ${i + 1}`} className="grid grid-cols-2 rounded-2xl bg-surface-muted p-1">
                {(["debit", "credit"] as const).map((s) => (
                  <button key={s} role="radio" aria-checked={r.side === s} onClick={() => set(r.key, { side: s })}
                    className={cx("tap rounded-xl px-4 text-sm font-bold transition", r.side === s ? (s === "debit" ? "bg-brand-gradient text-white" : "bg-gold-gradient text-[#3b2a05]") : "text-muted")}>
                    {s === "debit" ? "Dr" : "Cr"}
                  </button>
                ))}
              </div>
              <Input inputMode="decimal" aria-label={`Amount for line ${i + 1}`} placeholder={dp ? `0.${"0".repeat(dp)}` : "0"} value={r.amount}
                onChange={(e) => set(r.key, { amount: e.target.value.replace(/[^\d.]/g, "") })} className="num text-right text-lg font-semibold" />
            </div>
            {toMinor(r.amount, dp) === null && <p className="text-sm text-expense" role="alert">At most {dp} decimal places.</p>}
            <Input aria-label={`Note for line ${i + 1}`} placeholder="Line note (optional)" value={r.description} onChange={(e) => set(r.key, { description: e.target.value })} maxLength={500} />
          </Card>
        ))}
        <Button variant="secondary" className="w-full" onClick={() => setRows((rs) => [...rs, blank(totals.diff > 0n ? "credit" : "debit")])}><Plus className="size-5" /> Add line</Button>
      </div>

      {/* totals: pinned above the tab bar on phones */}
      <div className="fixed inset-x-0 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom,0px))] z-30 border-t border-border bg-surface/95 px-4 pb-3 pt-3 shadow-[0_-12px_30px_-20px_rgb(0_0_0/0.4)] backdrop-blur-xl lg:static lg:mt-4 lg:rounded-3xl lg:border lg:shadow-card">
        <div className="mx-auto max-w-[1180px]">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Tot label="Debit" value={money(fromMinor(totals.d, dp), cur, dp)} />
            <Tot label="Credit" value={money(fromMinor(totals.c, dp), cur, dp)} />
            <Tot label="Difference" value={money(fromMinor(totals.diff < 0n ? -totals.diff : totals.diff, dp), cur, dp)} tone={totals.diff === 0n ? "ok" : "bad"} />
          </div>
          <p className={cx("mt-2 flex items-center justify-center gap-1.5 text-sm font-semibold", balanced ? "text-income" : "text-warning")} role="status">
            {balanced ? <><CheckCircle2 className="size-4" /> Balanced, ready to post</> : <><TriangleAlert className="size-4" /> {totals.diff === 0n ? "Add accounts and amounts" : `${totals.diff > 0n ? "Credit" : "Debit"} ${money(fromMinor(totals.diff < 0n ? -totals.diff : totals.diff, dp), cur, dp)} more to balance`}</>}
          </p>
          {err && <p role="alert" className="mt-2 rounded-xl bg-expense-soft p-2.5 text-sm text-expense">{err}</p>}
          <div className="mt-3 grid grid-cols-2 gap-3 lg:max-w-md lg:ml-auto">
            <Button variant="secondary" loading={busy === "draft"} disabled={!!busy} onClick={() => save(false)}>Save draft</Button>
            <Button loading={busy === "post"} disabled={!!busy || !balanced} onClick={() => save(true)}>Post entry</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tot({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" }) {
  return (
    <div className={cx("rounded-2xl px-2 py-2", tone === "bad" ? "bg-expense-soft" : tone === "ok" ? "bg-brand-soft" : "bg-surface-muted")}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="num truncate text-[15px] font-bold">{value}</p>
    </div>
  );
}
