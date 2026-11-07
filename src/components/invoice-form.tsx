"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { today } from "@/lib/dates";
import { useAccounts } from "@/lib/hooks";
import { fromMinor, lineTotals, money } from "@/lib/money";
import { errorMessage, useOrg, useOrgQuery } from "@/lib/org";
import type { Contact, DocType, Invoice, TaxCode } from "@/lib/types";
import { NewContactSheet } from "./contacts-sheet";
import { Button, Card, Field, Input, Select, useToast } from "./ui";

type Row = { key: number; description: string; quantity: string; unit_price: string; account_id: string; tax_code_id: string };
let seq = 0;
const blank = (): Row => ({ key: ++seq, description: "", quantity: "1", unit_price: "", account_id: "", tax_code_id: "" });
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

export function InvoiceForm({ type, invoice, onSaved }: { type: DocType; invoice?: Invoice; onSaved: (i: Invoice) => void }) {
  const { org, call } = useOrg();
  const dp = org!.decimal_places, cur = org!.base_currency;
  const qc = useQueryClient();
  const toast = useToast();
  const { byType, money: moneyAccts } = useAccounts();
  const isInv = type === "invoice";
  const contacts = useOrgQuery<Contact[]>(["contacts", type], "/contacts", { kind: isInv ? "customer" : "vendor", active: "true" });
  const taxes = useOrgQuery<TaxCode[]>(["tax-codes"], "/tax-codes");
  const [contact, setContact] = useState(invoice?.contact_id ?? "");
  const [issue, setIssue] = useState(invoice?.issue_date ?? today());
  const [due, setDue] = useState(invoice?.due_date ?? addDays(today(), 30));
  const [ref, setRef] = useState(invoice?.reference ?? "");
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [rows, setRows] = useState<Row[]>(() => invoice ? invoice.lines.map((l) => ({ key: ++seq, description: l.description, quantity: l.quantity, unit_price: l.unit_price, account_id: l.account_id, tax_code_id: l.tax_code_id ?? "" })) : [blank()]);
  const [newContact, setNewContact] = useState(false);
  const [busy, setBusy] = useState<null | "draft" | "issue">(null);
  const [err, setErr] = useState<string | null>(null);

  const accountChoices = isInv ? byType("revenue") : [...byType("expense"), ...byType("asset").filter((a) => !moneyAccts.some((m) => m.id === a.id) && !["accounts_receivable", "accounts_payable"].includes(a.account_subtype))];
  const taxChoices = (taxes.data ?? []).filter((t) => t.kind === (isInv ? "output" : "input"));
  const set = (key: number, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const totals = useMemo(() => {
    let net = 0n, tax = 0n, ok = true;
    for (const r of rows) {
      const t = lineTotals(r.quantity, r.unit_price || "0", taxChoices.find((c) => c.id === r.tax_code_id)?.rate ?? null, dp);
      if (!t) { ok = false; continue; }
      net += t.net; tax += t.tax;
    }
    return { net, tax, ok };
  }, [rows, taxChoices, dp]);
  const ready = !!contact && totals.ok && rows.every((r) => r.account_id && Number(r.unit_price) >= 0 && r.unit_price !== "") && totals.net > 0n && due >= issue;

  const save = async (andIssue: boolean) => {
    setBusy(andIssue ? "issue" : "draft"); setErr(null);
    const payload = { contact_id: contact, issue_date: issue, due_date: due, reference: ref, notes,
      lines: rows.map((r) => ({ description: r.description, quantity: r.quantity, unit_price: r.unit_price, account_id: r.account_id, tax_code_id: r.tax_code_id || null })) };
    const base = isInv ? "/invoices" : "/bills";
    try {
      let doc = invoice ? await call<Invoice>(`${base}/${invoice.id}`, { method: "PATCH", json: payload }) : await call<Invoice>(base, { json: payload });
      if (andIssue) doc = await call<Invoice>(`${base}/${doc.id}/issue`, { method: "POST" });
      await qc.invalidateQueries();
      toast(andIssue ? `${doc.number} issued.` : "Draft saved.");
      onSaved(doc);
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4 pb-4">
      <Card className="space-y-3 p-4">
        <Field label={isInv ? "Customer" : "Supplier"}>
          {(id) => (
            <div className="flex gap-2">
              <Select id={id} value={contact} onChange={(e) => setContact(e.target.value)}><option value="">Choose…</option>{contacts.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
              <Button type="button" variant="secondary" aria-label="New contact" className="shrink-0 !px-3" onClick={() => setNewContact(true)}><UserPlus className="size-5" /></Button>
            </div>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">{(id) => <Input id={id} type="date" value={issue} onChange={(e) => { setIssue(e.target.value); if (due < e.target.value) setDue(e.target.value); }} />}</Field>
          <Field label="Due">{(id) => <Input id={id} type="date" min={issue} value={due} onChange={(e) => setDue(e.target.value)} />}</Field>
        </div>
        <Field label="Reference" hint="Your PO or their invoice number. Optional.">{(id) => <Input id={id} value={ref} onChange={(e) => setRef(e.target.value)} maxLength={60} />}</Field>
      </Card>

      {rows.map((r, i) => (
        <Card key={r.key} className="space-y-3 p-4">
          <div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-muted">Item {i + 1}</span>
            {rows.length > 1 && <button type="button" aria-label={`Remove item ${i + 1}`} onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))} className="tap grid place-items-center rounded-xl text-muted hover:bg-expense-soft hover:text-expense"><Trash2 className="size-5" /></button>}</div>
          <Input aria-label={`Description for item ${i + 1}`} placeholder="What is it?" value={r.description} onChange={(e) => set(r.key, { description: e.target.value })} maxLength={500} />
          <div className="grid grid-cols-[5.5rem_1fr] gap-3">
            <Input aria-label={`Quantity for item ${i + 1}`} inputMode="decimal" value={r.quantity} onChange={(e) => set(r.key, { quantity: e.target.value.replace(/[^\d.]/g, "") })} className="num text-right" />
            <Input aria-label={`Price for item ${i + 1}`} inputMode="decimal" placeholder={`Price${dp ? ` (0.${"0".repeat(dp)})` : ""}`} value={r.unit_price} onChange={(e) => set(r.key, { unit_price: e.target.value.replace(/[^\d.]/g, "") })} className="num text-right" />
          </div>
          <Select aria-label={`${isInv ? "Income" : "Expense"} account for item ${i + 1}`} value={r.account_id} onChange={(e) => set(r.key, { account_id: e.target.value })}><option value="">{isInv ? "Income account…" : "Expense account…"}</option>{accountChoices.map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}</Select>
          <Select aria-label={`Tax for item ${i + 1}`} value={r.tax_code_id} onChange={(e) => set(r.key, { tax_code_id: e.target.value })}><option value="">No tax</option>{taxChoices.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
        </Card>
      ))}
      <Button type="button" variant="secondary" className="w-full" onClick={() => setRows((r) => [...r, blank()])}><Plus className="size-5" /> Add item</Button>
      {taxChoices.length === 0 && <p className="text-xs text-muted">No tax codes yet. Add the standard GST rates from Reports, GST.</p>}

      <Card className="space-y-1.5 p-4 text-sm">
        <div className="flex justify-between"><span className="text-muted">Subtotal</span><span className="num font-semibold">{money(fromMinor(totals.net, dp), cur, dp)}</span></div>
        <div className="flex justify-between"><span className="text-muted">{isInv ? "Tax to collect" : "Tax you can claim"}</span><span className="num font-semibold">{money(fromMinor(totals.tax, dp), cur, dp)}</span></div>
        <div className="flex justify-between border-t border-border pt-2 text-base"><span className="font-bold">Total</span><span className="num font-bold">{money(fromMinor(totals.net + totals.tax, dp), cur, dp)}</span></div>
      </Card>
      <Field label="Notes">{(id) => <Input id={id} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Shown on the document. Optional." maxLength={1000} />}</Field>
      {err && <p role="alert" className="rounded-2xl bg-expense-soft p-3 text-sm text-expense">{err}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" loading={busy === "draft"} disabled={!ready || !!busy} onClick={() => save(false)}>Save draft</Button>
        <Button loading={busy === "issue"} disabled={!ready || !!busy} onClick={() => save(true)}>{isInv ? "Save & issue" : "Save & record"}</Button>
      </div>
      <NewContactSheet open={newContact} onClose={() => setNewContact(false)} defaultKind={isInv ? "customer" : "vendor"} onCreated={(c) => setContact(c.id)} />
    </div>
  );
}
