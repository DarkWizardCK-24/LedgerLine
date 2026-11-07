"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Pause, Play, Plus, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Hint, GLOSSARY } from "@/components/hint";
import { Title } from "@/components/page";
import { Badge, Button, Card, Chips, ConfirmSheet, EmptyState, ErrorState, Field, Input, Select, Sheet, Skeleton, useToast } from "@/components/ui";
import { fmtDate, today } from "@/lib/dates";
import { useAccounts } from "@/lib/hooks";
import { money, toMinor } from "@/lib/money";
import { errorMessage, useOrg, useOrgQuery } from "@/lib/org";
import type { QuickResult, RunResult, Template } from "@/lib/types";

const FREQ = { weekly: "Every week", monthly: "Every month", quarterly: "Every 3 months", yearly: "Every year" } as const;

export default function RecurringPage() {
  const { org, can, call } = useOrg();
  const cur = org!.base_currency, dp = org!.decimal_places;
  const qc = useQueryClient();
  const toast = useToast();
  const { accounts, money: moneyAccts, byType } = useAccounts();
  const rec = useOrgQuery<Template[]>(["templates-rec"], "/templates", { recurring: "true" });
  const shortcuts = useOrgQuery<Template[]>(["templates-short"], "/templates", { recurring: "false" });
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<Template | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", kind: "money_out" as "money_in" | "money_out", amount: "", paid: "", other: "", freq: "monthly" as keyof typeof FREQ, first: today(), end: "", auto: false });
  const [err, setErr] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries();
  const due = (rec.data ?? []).filter((t) => t.is_due);
  const act = async (id: string, fn: () => Promise<unknown>, ok: string) => { setBusy(id); try { await fn(); await refresh(); toast(ok); } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(null); } };
  const minor = toMinor(f.amount, dp);
  const valid = f.name.trim() && minor !== null && minor > 0n && (f.paid || moneyAccts[0]) && f.other && f.first;

  const create = async () => {
    setBusy("create"); setErr(null);
    const paid = f.paid || moneyAccts[0]?.id;
    const amt = f.amount.trim();
    const lines = f.kind === "money_in" ? [{ account_id: paid, debit_amount: amt }, { account_id: f.other, credit_amount: amt }] : [{ account_id: f.other, debit_amount: amt }, { account_id: paid, credit_amount: amt }];
    try {
      await call<Template>("/templates", { json: { name: f.name, kind: f.kind, description: f.name, lines, is_recurring: true, frequency: f.freq, next_run_date: f.first, end_date: f.end || null, auto_post: f.auto } });
      await refresh(); toast("Recurring entry saved."); setOpen(false); setF({ ...f, name: "", amount: "" });
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-5">
      <Title sub="Rent, salaries, EMIs and anything else that repeats." action={can("accountant") ? <Button onClick={() => setOpen(true)}><Plus className="size-5" /> <span className="hidden sm:inline">New recurring entry</span><span className="sm:hidden">New</span></Button> : undefined}>Recurring</Title>
      <p className="-mt-3 text-sm"><Hint label="how does this work?">{GLOSSARY.recurring}</Hint></p>

      {due.length > 0 && (
        <Card className="overflow-hidden border-gold/50">
          <div className="flex items-center justify-between gap-3 bg-gold-soft px-4 py-3"><p className="flex items-center gap-2 font-semibold text-warning"><CalendarClock className="size-5" /> {due.length} due now</p>
            {can("accountant") && <Button size="sm" variant="gold" loading={busy === "all"} onClick={() => act("all", async () => { const r = await call<RunResult[]>("/recurring/run-due", { method: "POST" }); const bad = r.filter((x) => x.error); if (bad.length) throw new Error(bad[0].error!); }, "Entries created.")}>Create all</Button>}</div>
          <ul className="divide-y divide-border">{due.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-3"><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{t.name}</span><span className="text-xs text-muted">Due {fmtDate(t.next_run_date!)} · {money(t.total, cur, dp)}</span></span>
              {can("accountant") && <Button size="sm" loading={busy === t.id} onClick={() => act(t.id, () => call<QuickResult>(`/templates/${t.id}/run`, { method: "POST" }), t.auto_post ? "Entry posted." : "Draft entry created. Review and post it in the journal.")}>Create entry</Button>}</li>))}</ul>
        </Card>
      )}

      {rec.error ? <ErrorState message={(rec.error as Error).message} retry={() => rec.refetch()} /> : rec.isLoading ? <Skeleton className="h-28" /> :
       (rec.data?.length ?? 0) === 0 ? <Card><EmptyState title="Nothing repeats yet" body="Add your rent, salaries or loan instalments once and we'll remind you every time they're due." action={can("accountant") ? <Button onClick={() => setOpen(true)}>Add a recurring entry</Button> : undefined} /></Card> : (
        <Card className="divide-y divide-border overflow-hidden">
          {rec.data!.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand-strong"><CalendarClock className="size-5" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{t.name}</span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">{t.frequency && FREQ[t.frequency]} · {money(t.total, cur, dp)}{t.is_active && t.next_run_date && <span>· next {fmtDate(t.next_run_date)}</span>}{t.auto_post && <Badge tone="brand">auto-posts</Badge>}{!t.is_active && <Badge tone="muted">paused</Badge>}</span></span>
              {can("accountant") && <div className="flex gap-1">
                <button aria-label={t.is_active ? `Pause ${t.name}` : `Resume ${t.name}`} onClick={() => act(t.id, () => call(`/templates/${t.id}`, { method: "PATCH", json: { is_active: !t.is_active } }), t.is_active ? "Paused." : "Resumed.")} className="tap grid place-items-center rounded-xl text-muted hover:bg-surface-muted">{t.is_active ? <Pause className="size-5" /> : <Play className="size-5" />}</button>
                <button aria-label={`Delete ${t.name}`} onClick={() => setDel(t)} className="tap grid place-items-center rounded-xl text-muted hover:bg-expense-soft hover:text-expense"><Trash2 className="size-5" /></button></div>}
            </div>))}
        </Card>
      )}

      {(shortcuts.data?.length ?? 0) > 0 && (
        <section><h2 className="mb-2 px-1 font-display text-lg font-semibold">Shortcuts</h2>
          <p className="mb-2 px-1 text-xs text-muted">Saved from Add, one tap to fill the form again.</p>
          <Card className="divide-y divide-border overflow-hidden">{shortcuts.data!.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3"><Sparkles className="size-5 text-gold" /><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{t.name}</span><span className="text-xs text-muted">{money(t.total, cur, dp)}</span></span>
              {can("accountant") && <button aria-label={`Delete ${t.name}`} onClick={() => setDel(t)} className="tap grid place-items-center rounded-xl text-muted hover:text-expense"><Trash2 className="size-5" /></button>}</div>))}</Card></section>
      )}
      <p className="text-center text-xs text-muted">Need the entry right now instead? <Link href="/quick" className="font-semibold text-brand-strong">Add a transaction</Link></p>

      <Sheet open={open} onClose={() => setOpen(false)} title="New recurring entry" footer={<Button size="lg" className="w-full" loading={busy === "create"} disabled={!valid} onClick={create}>Save</Button>}>
        <div className="space-y-4 pb-2">
          <Chips value={f.kind} onChange={(kind) => setF({ ...f, kind, other: "" })} options={[{ value: "money_out", label: "Money out" }, { value: "money_in", label: "Money in" }]} />
          <Field label="Name">{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Shop rent" maxLength={80} />}</Field>
          <Field label="Amount">{(id) => <Input id={id} inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, "") })} className="num text-right text-lg font-semibold" />}</Field>
          <Field label={f.kind === "money_in" ? "Received into" : "Paid from"}>{(id) => <Select id={id} value={f.paid || moneyAccts[0]?.id || ""} onChange={(e) => setF({ ...f, paid: e.target.value })}>{moneyAccts.map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}</Select>}</Field>
          <Field label="What is it for?">{(id) => <Select id={id} value={f.other} onChange={(e) => setF({ ...f, other: e.target.value })}><option value="">Choose…</option>
            {(f.kind === "money_in" ? byType("revenue") : byType("expense")).map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}
            {accounts.length === 0 && null}</Select>}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Repeats">{(id) => <Select id={id} value={f.freq} onChange={(e) => setF({ ...f, freq: e.target.value as keyof typeof FREQ })}>{Object.entries(FREQ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
            <Field label="First date">{(id) => <Input id={id} type="date" value={f.first} onChange={(e) => setF({ ...f, first: e.target.value })} />}</Field>
          </div>
          <Field label="Stop after" hint="Optional.">{(id) => <Input id={id} type="date" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} />}</Field>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={f.auto} onChange={(e) => setF({ ...f, auto: e.target.checked })} className="mt-0.5 size-4 accent-[var(--brand)]" /> <span>Record it automatically when I create it. Leave off to review each one first.</span></label>
          {err && <p role="alert" className="rounded-2xl bg-expense-soft p-3 text-sm text-expense">{err}</p>}
        </div>
      </Sheet>
      <ConfirmSheet open={!!del} danger title={`Delete ${del?.name}?`} body="Entries it already created stay in your books." confirmLabel="Delete" onClose={() => setDel(null)}
        onConfirm={async () => { if (del) { await act(del.id, () => call(`/templates/${del.id}`, { method: "DELETE" }), "Deleted."); setDel(null); } }} />
    </div>
  );
}
