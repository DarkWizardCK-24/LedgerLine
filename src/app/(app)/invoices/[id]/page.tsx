"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, CheckCircle2, Pencil, Send, Trash2, Undo2, Wallet } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { InvoiceForm } from "@/components/invoice-form";
import { Badge, Button, Card, ConfirmSheet, ErrorState, Field, Input, Select, Sheet, Skeleton, useToast } from "@/components/ui";
import { fmtDate, today } from "@/lib/dates";
import { useAccounts } from "@/lib/hooks";
import { money } from "@/lib/money";
import { errorMessage, useOrg, useOrgQuery } from "@/lib/org";
import type { DocType, Invoice } from "@/lib/types";

function DocView() {
  const { id } = useParams<{ id: string }>();
  const type: DocType = useSearchParams().get("type") === "bill" ? "bill" : "invoice";
  const base = type === "invoice" ? "/invoices" : "/bills";
  const { org, call, can } = useOrg();
  const cur = org!.base_currency, dp = org!.decimal_places;
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { money: moneyAccts } = useAccounts();
  const q = useOrgQuery<Invoice>(["doc", id], `${base}/${id}`);
  const inv = q.data;
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<null | "issue" | "delete" | "void">(null);
  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState({ date: today(), amount: "", account: "", ref: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>, ok: string, after?: () => void) => {
    setBusy(true); setErr(null);
    try { await fn(); await qc.invalidateQueries(); toast(ok); after?.(); return true; } catch (e) { setErr(errorMessage(e)); toast(errorMessage(e), "error"); return false; } finally { setBusy(false); setConfirm(null); }
  };

  if (q.isLoading) return <div className="space-y-3"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-56" /></div>;
  if (q.error || !inv) return <ErrorState message={q.error ? (q.error as Error).message : "Document not found."} retry={() => q.refetch()} />;
  const canEdit = can("accountant");
  const payAccounts = type === "invoice" ? moneyAccts.filter((a) => a.account_subtype !== "credit_card") : moneyAccts;
  const label = type === "invoice" ? "invoice" : "bill";

  if (editing && inv.status === "draft") return (
    <div className="mx-auto max-w-2xl"><h1 className="font-display mb-4 text-2xl font-semibold">Edit draft</h1>
      <InvoiceForm type={type} invoice={inv} onSaved={() => setEditing(false)} /></div>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href={`/invoices?tab=${type}`} className="tap -ml-2 inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="size-4" /> Invoices & bills</Link>
      <div className="flex flex-wrap items-center gap-3"><h1 className="font-display text-3xl font-semibold">{inv.number}</h1>
        {inv.is_overdue ? <Badge tone="expense">overdue</Badge> : <Badge tone={inv.status === "open" ? "brand" : inv.status === "draft" ? "gold" : "muted"}>{inv.status}</Badge>}</div>

      <Card className="space-y-1 p-4">
        <p className="text-lg font-semibold">{inv.contact_name}</p>
        <p className="text-sm text-muted">Dated {fmtDate(inv.issue_date)} · due {fmtDate(inv.due_date)}{inv.reference && ` · ref ${inv.reference}`}</p>
        {inv.notes && <p className="pt-1 text-sm">{inv.notes}</p>}
      </Card>

      <Card className="overflow-hidden">
        <ul className="divide-y divide-border">{inv.lines.map((l) => (
          <li key={l.id} className="flex items-start gap-3 px-4 py-3"><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{l.description || l.account_name}</span>
            <span className="text-xs text-muted">{l.quantity} × {money(l.unit_price, cur, dp)}{l.tax_code_name && ` · ${l.tax_code_name}`}</span></span>
            <span className="text-right"><span className="num block font-bold">{money(l.net_amount, cur, dp)}</span>{Number(l.tax_amount) > 0 && <span className="num text-xs text-muted">+ {money(l.tax_amount, cur, dp)} tax</span>}</span></li>))}</ul>
        <div className="space-y-1 border-t border-border bg-surface-muted px-4 py-3 text-sm">
          <div className="flex justify-between"><span className="text-muted">Subtotal</span><span className="num">{money(inv.subtotal, cur, dp)}</span></div>
          <div className="flex justify-between"><span className="text-muted">Tax</span><span className="num">{money(inv.tax_total, cur, dp)}</span></div>
          <div className="flex justify-between text-base font-bold"><span>Total</span><span className="num">{money(inv.total, cur, dp)}</span></div>
          {inv.status !== "draft" && <><div className="flex justify-between"><span className="text-muted">{type === "invoice" ? "Received" : "Paid"}</span><span className="num">{money(inv.amount_paid, cur, dp)}</span></div>
            <div className="flex justify-between font-bold text-brand-strong"><span>Still {type === "invoice" ? "owed to you" : "to pay"}</span><span className="num">{money(inv.balance, cur, dp)}</span></div></>}
        </div>
      </Card>

      {inv.payments.length > 0 && (
        <Card className="overflow-hidden"><h2 className="px-4 pt-3 font-display text-lg font-semibold">Payments</h2>
          <ul className="divide-y divide-border">{inv.payments.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3"><span className="min-w-0 flex-1"><span className={`num block font-semibold ${p.is_void ? "text-muted line-through" : ""}`}>{money(p.amount, cur, dp)}</span><span className="text-xs text-muted">{fmtDate(p.payment_date)} · {p.account_name}{p.reference && ` · ${p.reference}`}</span></span>
              {p.is_void ? <Badge tone="muted">voided</Badge> : canEdit && inv.status !== "void" && <Button size="sm" variant="ghost" onClick={() => run(() => call(`${base}/${inv.id}/payments/${p.id}/void`, { method: "POST" }), "Payment voided.")}><Undo2 className="size-4" /> Void</Button>}</li>))}</ul></Card>
      )}

      {err && <p role="alert" className="rounded-2xl bg-expense-soft p-3 text-sm text-expense">{err}</p>}
      {canEdit && (
        <div className="grid gap-3 sm:grid-cols-3">
          {inv.status === "draft" && <><Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="size-4" /> Edit</Button><Button variant="secondary" onClick={() => setConfirm("delete")}><Trash2 className="size-4" /> Delete</Button><Button onClick={() => setConfirm("issue")}><Send className="size-4" /> {type === "invoice" ? "Issue" : "Record"}</Button></>}
          {inv.status === "open" && <><Button onClick={() => { setPay({ date: today() < inv.issue_date ? inv.issue_date : today(), amount: inv.balance, account: payAccounts.find((a) => a.account_subtype === "bank")?.id ?? payAccounts[0]?.id ?? "", ref: "" }); setPayOpen(true); }}><Wallet className="size-4" /> {type === "invoice" ? "Record payment received" : "Record payment made"}</Button>
            {Number(inv.amount_paid) === 0 && <Button variant="secondary" onClick={() => setConfirm("void")}><Ban className="size-4" /> Void</Button>}</>}
          {inv.status === "paid" && <p className="flex items-center gap-2 text-sm font-semibold text-income sm:col-span-3"><CheckCircle2 className="size-5" /> Fully {type === "invoice" ? "received" : "paid"}.</p>}
        </div>
      )}
      {inv.journal_entry_id && <p className="text-center text-xs text-muted">Recorded in your books as <Link href={`/journal/${inv.journal_entry_id}`} className="font-semibold text-brand-strong">this journal entry</Link>.</p>}

      <ConfirmSheet open={confirm === "issue"} title={`${type === "invoice" ? "Issue" : "Record"} this ${label}?`} body={type === "invoice" ? "It gets its number and is added to what customers owe you. You can't edit it afterwards; to change it, void it and create a new one." : "It is added to what you owe suppliers. You can't edit it afterwards."} confirmLabel={type === "invoice" ? "Issue" : "Record"} busy={busy} onClose={() => setConfirm(null)} onConfirm={() => run(() => call(`${base}/${inv.id}/issue`, { method: "POST" }), `${label[0].toUpperCase() + label.slice(1)} issued.`)} />
      <ConfirmSheet open={confirm === "delete"} danger title="Delete this draft?" body="The draft is removed. Nothing was recorded in your books." confirmLabel="Delete" busy={busy} onClose={() => setConfirm(null)} onConfirm={() => run(() => call(`${base}/${inv.id}`, { method: "DELETE" }), "Draft deleted.", () => router.replace(`/invoices?tab=${type}`))} />
      <ConfirmSheet open={confirm === "void"} danger title={`Void ${inv.number}?`} body="The entry in your books is reversed, so it no longer counts. The document stays in the list marked void." confirmLabel="Void" busy={busy} onClose={() => setConfirm(null)} onConfirm={() => run(() => call(`${base}/${inv.id}/void`, { method: "POST" }), "Voided.")} />
      <Sheet open={payOpen} onClose={() => setPayOpen(false)} title={type === "invoice" ? "Payment received" : "Payment made"}
        footer={<Button size="lg" className="w-full" loading={busy} disabled={!pay.amount || !pay.account} onClick={async () => { if (await run(() => call(`${base}/${inv.id}/payments`, { json: { payment_date: pay.date, amount: pay.amount, account_id: pay.account, reference: pay.ref } }), "Payment recorded.")) setPayOpen(false); }}>Record payment</Button>}>
        <div className="space-y-4 pb-2">
          <Field label="Amount" hint={`${money(inv.balance, cur, dp)} is still ${type === "invoice" ? "owed" : "to pay"}.`}>{(i) => <Input id={i} inputMode="decimal" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value.replace(/[^\d.]/g, "") })} className="num text-right text-xl font-semibold" />}</Field>
          <Field label="Date">{(i) => <Input id={i} type="date" min={inv.issue_date} value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} />}</Field>
          <Field label={type === "invoice" ? "Received into" : "Paid from"}>{(i) => <Select id={i} value={pay.account} onChange={(e) => setPay({ ...pay, account: e.target.value })}>{payAccounts.map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}</Select>}</Field>
          <Field label="Reference">{(i) => <Input id={i} value={pay.ref} onChange={(e) => setPay({ ...pay, ref: e.target.value })} placeholder="Cheque or UPI reference. Optional." maxLength={60} />}</Field>
          {err && <p role="alert" className="text-sm text-expense">{err}</p>}
        </div>
      </Sheet>
    </div>
  );
}

export default function DocPage() {
  return <Suspense fallback={null}><DocView /></Suspense>;
}
