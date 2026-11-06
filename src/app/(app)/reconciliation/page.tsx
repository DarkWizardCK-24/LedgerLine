"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Landmark, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Title } from "@/components/page";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Select, Sheet, Skeleton, useToast } from "@/components/ui";
import { fmtDate } from "@/lib/dates";
import { money } from "@/lib/money";
import { errorMessage, useOrg, useOrgQuery } from "@/lib/org";
import type { Overview, ReconSession } from "@/lib/types";

export default function ReconciliationList() {
  const { org, can, call } = useOrg();
  const cur = org!.base_currency, dp = org!.decimal_places;
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const sessions = useOrgQuery<ReconSession[]>(["recons"], "/reconciliations");
  const overview = useOrgQuery<Overview>(["overview"], "/accounting/overview");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ account_id: "", start: "", end: "", closing: "", opening: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const accounts = overview.data?.reconcilable_accounts ?? [];
  const previous = sessions.data?.find((s) => s.account_id === form.account_id && s.status === "completed");

  const create = async () => {
    setBusy(true); setErr(null);
    try {
      const s = await call<ReconSession>("/reconciliations", { json: {
        account_id: form.account_id, statement_start_date: form.start, statement_end_date: form.end,
        closing_balance: form.closing || "0", opening_balance: form.opening === "" ? null : form.opening } });
      await qc.invalidateQueries();
      toast("Reconciliation started.");
      router.push(`/reconciliation/${s.id}`);
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };

  const inProgress = sessions.data?.filter((s) => s.status === "in_progress") ?? [];
  const history = sessions.data?.filter((s) => s.status !== "in_progress") ?? [];

  return (
    <div>
      <Title sub="Match your bank, cash and card statements to the books."
        action={can("accountant") ? <Button onClick={() => setOpen(true)}><Plus className="size-5" /> <span className="hidden sm:inline">New reconciliation</span><span className="sm:hidden">New</span></Button> : undefined}>Reconciliation</Title>

      {sessions.error ? <ErrorState message={(sessions.error as Error).message} retry={() => sessions.refetch()} /> :
       sessions.isLoading ? <div className="space-y-2"><Skeleton className="h-24" /><Skeleton className="h-24" /></div> :
       (sessions.data?.length ?? 0) === 0 ? (
        <Card><EmptyState title="No reconciliations yet" body="Start one when your bank statement arrives: import the CSV, match each line to a ledger entry and finish when the difference is zero."
          action={can("accountant") ? <Button onClick={() => setOpen(true)}>Start a reconciliation</Button> : undefined} /></Card>
      ) : (
        <div className="space-y-6">
          {inProgress.length > 0 && (
            <section><h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-muted">In progress</h2>
              <div className="space-y-3">{inProgress.map((s) => <SessionCard key={s.id} s={s} cur={cur} dp={dp} />)}</div></section>
          )}
          {history.length > 0 && (
            <section><h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-muted">History</h2>
              <div className="space-y-3">{history.map((s) => <SessionCard key={s.id} s={s} cur={cur} dp={dp} />)}</div></section>
          )}
        </div>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="New reconciliation"
        footer={<Button size="lg" className="w-full" loading={busy} disabled={!form.account_id || !form.start || !form.end || form.closing === ""} onClick={create}>Start</Button>}>
        <div className="space-y-4 pb-2">
          <Field label="Account">{(id) => <Select id={id} value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}>
            <option value="">Select an account…</option>
            {accounts.map((a) => <option key={a.account_id} value={a.account_id} disabled={a.open}>{a.account_code} · {a.account_name}{a.open ? " (open)" : a.last_reconciled_to ? ` · done to ${a.last_reconciled_to}` : ""}</option>)}
          </Select>}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Statement from">{(id) => <Input id={id} type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />}</Field>
            <Field label="Statement to">{(id) => <Input id={id} type="date" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />}</Field>
          </div>
          <Field label="Closing balance on the statement" hint="Use a minus sign for an overdrawn account.">
            {(id) => <Input id={id} inputMode="decimal" value={form.closing} onChange={(e) => setForm({ ...form, closing: e.target.value.replace(/[^\d.-]/g, "") })} className="num text-right text-lg font-semibold" />}
          </Field>
          <Field label="Opening balance" hint={previous ? `Leave blank to continue from ${money(previous.closing_balance, cur, dp)}.` : "Leave blank for 0 on a first reconciliation."}>
            {(id) => <Input id={id} inputMode="decimal" value={form.opening} onChange={(e) => setForm({ ...form, opening: e.target.value.replace(/[^\d.-]/g, "") })} className="num text-right" />}
          </Field>
          {err && <p role="alert" className="rounded-2xl bg-expense-soft p-3 text-sm text-expense">{err}</p>}
        </div>
      </Sheet>
    </div>
  );
}

function SessionCard({ s, cur, dp }: { s: ReconSession; cur: string; dp: number }) {
  const balanced = s.difference != null && Number(s.difference) === 0;
  return (
    <Link href={`/reconciliation/${s.id}`} className="block">
      <Card className="flex items-center gap-3 p-4 transition hover:bg-surface-muted">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand-strong">{s.status === "completed" ? <CheckCircle2 className="size-6" /> : <Landmark className="size-6" />}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{s.account_name}</span>
          <span className="text-xs text-muted">{fmtDate(s.statement_start_date)} to {fmtDate(s.statement_end_date)}</span>
        </span>
        <span className="text-right">
          <span className="num block font-bold">{money(s.closing_balance, cur, dp)}</span>
          {s.status === "completed" ? <Badge tone="brand">Reconciled</Badge> : s.status === "cancelled" ? <Badge tone="muted">Cancelled</Badge>
            : <Badge tone={balanced && s.unmatched_count === 0 ? "brand" : "gold"}>{s.unmatched_count ?? 0} to match · {balanced ? "balanced" : `off ${money(String(Math.abs(Number(s.difference ?? 0))), cur, dp)}`}</Badge>}
        </span>
      </Card>
    </Link>
  );
}
