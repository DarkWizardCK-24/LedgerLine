"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Title } from "@/components/page";
import { Badge, Button, Card, Chips, EmptyState, ErrorState, Field, Input, Select, Sheet, Skeleton, useToast } from "@/components/ui";
import { money } from "@/lib/money";
import { errorMessage, useOrg, useOrgQuery } from "@/lib/org";
import type { Account, AccountType, Page } from "@/lib/types";

const TYPES: AccountType[] = ["asset", "liability", "equity", "revenue", "expense"];
const label = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export default function AccountsPage() {
  const { org, can, call } = useOrg();
  const cur = org!.base_currency, dp = org!.decimal_places;
  const qc = useQueryClient();
  const toast = useToast();
  const [type, setType] = useState<"all" | AccountType>("all");
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [open, setOpen] = useState(false);
  const query = useOrgQuery<Page<Account>>(["accounts"], "/accounts", { page_size: "200", q: q.trim() || undefined, account_type: type === "all" ? undefined : type, active: showInactive ? undefined : "true" });
  const subtypes = useOrgQuery<Record<string, string[]>>(["subtypes"], "/accounting/account-subtypes");

  const [form, setForm] = useState({ name: "", type: "asset" as AccountType, subtype: "other", code: "", parent: "", description: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const grouped = useMemo(() => TYPES.map((t) => [t, (query.data?.items ?? []).filter((a) => a.account_type === t)] as const).filter(([, l]) => l.length), [query.data]);
  const parents = (query.data?.items ?? []).filter((a) => a.account_type === form.type);

  const create = async () => {
    setBusy(true); setErr(null);
    try {
      await call("/accounts", { json: { account_name: form.name, account_type: form.type, account_subtype: form.subtype, account_code: form.code || null, parent_account_id: form.parent || null, description: form.description } });
      toast("Account created."); await qc.invalidateQueries(); setOpen(false); setForm({ name: "", type: "asset", subtype: "other", code: "", parent: "", description: "" });
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <div>
      <Title sub="Your chart of accounts." action={can("accountant") ? <Button onClick={() => setOpen(true)}><Plus className="size-5" /> <span className="hidden sm:inline">New account</span><span className="sm:hidden">New</span></Button> : undefined}>Accounts</Title>
      <div className="space-y-3">
        <div className="relative"><Search className="pointer-events-none absolute left-4 top-3.5 size-5 text-muted" /><Input aria-label="Search accounts" placeholder="Search by name or code" className="pl-12" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Chips value={type} onChange={setType} options={[{ value: "all", label: "All" }, ...TYPES.map((t) => ({ value: t, label: label(t) }))]} />
        <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="size-4 accent-[var(--brand)]" /> Show inactive</label>
      </div>

      {query.error ? <ErrorState message={(query.error as Error).message} retry={() => query.refetch()} /> :
       query.isLoading ? <div className="mt-4 space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16" />)}</div> :
       grouped.length === 0 ? <Card className="mt-4"><EmptyState title="No accounts found" body="Try a different search or filter." /></Card> :
       grouped.map(([t, list]) => (
        <section key={t} className="mt-5">
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-muted">{label(t)}</h2>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {list.map((a) => (
                <li key={a.id}>
                  <Link href={`/ledger?account=${a.id}`} className="tap flex items-center gap-3 px-4 py-3 transition hover:bg-surface-muted">
                    <span className="num w-12 shrink-0 text-sm font-bold text-muted">{a.account_code}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate font-semibold ${a.parent_account_id ? "pl-3" : ""}`}>{a.account_name}</span>
                      <span className="flex gap-1.5 pt-0.5">{a.is_system_account && <Badge tone="gold">System</Badge>}{!a.is_active && <Badge tone="muted">Inactive</Badge>}<span className="text-xs text-muted">{label(a.account_subtype)}</span></span>
                    </span>
                    <span className={`num text-right font-bold ${a.balance?.startsWith("-") ? "text-expense" : ""}`}>{money(a.balance, cur, dp)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ))}

      <Sheet open={open} onClose={() => setOpen(false)} title="New account" footer={<Button size="lg" className="w-full" loading={busy} disabled={!form.name.trim()} onClick={create}>Create account</Button>}>
        <div className="space-y-4 pb-2">
          <Field label="Name">{(id) => <Input id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} />}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">{(id) => <Select id={id} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AccountType, subtype: "other", parent: "" })}>{TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</Select>}</Field>
            <Field label="Subtype">{(id) => <Select id={id} value={form.subtype} onChange={(e) => setForm({ ...form, subtype: e.target.value })}>{(subtypes.data?.[form.type] ?? ["other"]).map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>}</Field>
          </div>
          <Field label="Code" hint="Leave blank to generate the next free code.">{(id) => <Input id={id} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} maxLength={20} inputMode="numeric" />}</Field>
          <Field label="Parent account">{(id) => <Select id={id} value={form.parent} onChange={(e) => setForm({ ...form, parent: e.target.value })}><option value="">None</option>{parents.map((p) => <option key={p.id} value={p.id}>{p.account_code} · {p.account_name}</option>)}</Select>}</Field>
          {err && <p role="alert" className="rounded-2xl bg-expense-soft p-3 text-sm text-expense">{err}</p>}
        </div>
      </Sheet>
    </div>
  );
}
