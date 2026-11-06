"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { errorMessage, useOrg } from "@/lib/org";
import type { Org } from "@/lib/types";
import { Button, Field, Input, Select, useToast } from "./ui";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const CURRENCIES = [["INR", "Indian Rupee (₹)"], ["USD", "US Dollar ($)"], ["EUR", "Euro (€)"], ["GBP", "British Pound (£)"], ["AED", "UAE Dirham"], ["SGD", "Singapore Dollar"], ["AUD", "Australian Dollar"], ["JPY", "Japanese Yen"]];

export function OrgForm({ onDone, submitLabel = "Create organization" }: { onDone?: (o: Org) => void; submitLabel?: string }) {
  const { callGlobal, setOrg, reload } = useOrg();
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState("");
  const [legal, setLegal] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [decimals, setDecimals] = useState(currencyDecimals("INR"));
  const [fy, setFy] = useState(4);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const org = await callGlobal<Org>("/organizations", {
        json: { name, legal_name: legal, base_currency: currency, decimal_places: decimals, financial_year_start: fy, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" },
      });
      await qc.invalidateQueries({ queryKey: ["orgs"] });
      await reload();
      setOrg(org.id);
      toast("Organization created with a default chart of accounts.");
      onDone?.(org);
    } catch (x) { setErr(errorMessage(x)); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Organization name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Traders" required maxLength={120} />}</Field>
      <Field label="Legal name" hint="Optional. Shown on exported reports.">{(id) => <Input id={id} value={legal} onChange={(e) => setLegal(e.target.value)} maxLength={160} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Currency" hint="Fixed once you post entries.">
          {(id) => <Select id={id} value={currency} onChange={(e) => { setCurrency(e.target.value); setDecimals(currencyDecimals(e.target.value)); }}>{CURRENCIES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</Select>}
        </Field>
        <Field label="Decimal places">{(id) => <Select id={id} value={decimals} onChange={(e) => setDecimals(Number(e.target.value))}>{[0, 1, 2, 3, 4].map((d) => <option key={d} value={d}>{d}</option>)}</Select>}</Field>
      </div>
      <Field label="Financial year starts in">{(id) => <Select id={id} value={fy} onChange={(e) => setFy(Number(e.target.value))}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</Select>}</Field>
      {err && <p role="alert" className="rounded-2xl bg-expense-soft p-3 text-sm text-expense">{err}</p>}
      <Button type="submit" size="lg" className="w-full" loading={busy}>{submitLabel}</Button>
    </form>
  );
}

function currencyDecimals(c: string) { return c === "JPY" ? 0 : 2; }
