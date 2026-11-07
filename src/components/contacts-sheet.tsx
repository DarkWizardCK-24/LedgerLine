"use client";

import { useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { errorMessage, useOrg, useOrgQuery } from "@/lib/org";
import type { Contact } from "@/lib/types";
import { Button, Chips, Field, Input, Sheet } from "./ui";

/** Add a customer or supplier. `onCreated` lets a form pick the new contact straight away. */
export function NewContactSheet({ open, onClose, defaultKind = "customer", onCreated }: { open: boolean; onClose: () => void; defaultKind?: "customer" | "vendor"; onCreated?: (c: Contact) => void }) {
  const { call } = useOrg();
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", kind: defaultKind as "customer" | "vendor" | "both", email: "", phone: "", tax_id: "", address: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const c = await call<Contact>("/contacts", { json: f });
      await qc.invalidateQueries({ queryKey: ["contacts"] });
      setF({ ...f, name: "", email: "", phone: "", tax_id: "", address: "" });
      onCreated?.(c); onClose();
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="New contact" footer={<Button size="lg" className="w-full" loading={busy} disabled={!f.name.trim()} onClick={save}>Save contact</Button>}>
      <div className="space-y-4 pb-2">
        <Chips value={f.kind} onChange={(kind) => setF({ ...f, kind })} options={[{ value: "customer", label: "Customer" }, { value: "vendor", label: "Supplier" }, { value: "both", label: "Both" }]} />
        <Field label="Name">{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={120} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">{(id) => <Input id={id} type="email" inputMode="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
          <Field label="Phone">{(id) => <Input id={id} type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />}</Field>
        </div>
        <Field label="GSTIN / tax ID" hint="Optional.">{(id) => <Input id={id} value={f.tax_id} onChange={(e) => setF({ ...f, tax_id: e.target.value })} maxLength={40} />}</Field>
        <Field label="Address">{(id) => <Input id={id} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} maxLength={400} />}</Field>
        {err && <p role="alert" className="rounded-2xl bg-expense-soft p-3 text-sm text-expense">{err}</p>}
      </div>
    </Sheet>
  );
}

export function ContactsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const q = useOrgQuery<Contact[]>(["contacts", "all"], "/contacts", undefined, open);
  const [adding, setAdding] = useState(false);
  return (
    <>
      <Sheet open={open && !adding} onClose={onClose} title="Customers & suppliers" footer={<Button className="w-full" size="lg" onClick={() => setAdding(true)}><UserPlus className="size-5" /> New contact</Button>}>
        <ul className="divide-y divide-border pb-2">
          {q.data?.length === 0 && <li className="py-6 text-center text-sm text-muted">No contacts yet.</li>}
          {q.data?.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-3"><span className="grid size-10 place-items-center rounded-full bg-gold-gradient font-bold text-[#3b2a05]">{c.name.charAt(0).toUpperCase()}</span>
              <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{c.name}</span><span className="text-xs capitalize text-muted">{c.kind === "vendor" ? "supplier" : c.kind}{c.email && ` · ${c.email}`}</span></span></li>
          ))}
        </ul>
      </Sheet>
      <NewContactSheet open={adding} onClose={() => setAdding(false)} />
    </>
  );
}
