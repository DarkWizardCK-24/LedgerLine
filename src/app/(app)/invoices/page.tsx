"use client";

import { Download, Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ContactsSheet } from "@/components/contacts-sheet";
import { Hint, GLOSSARY } from "@/components/hint";
import { Title } from "@/components/page";
import { Badge, Button, Card, Chips, EmptyState, ErrorState, Input, Skeleton, cx, useToast } from "@/components/ui";
import { downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtDate } from "@/lib/dates";
import { money } from "@/lib/money";
import { errorMessage, useOrg, useOrgQuery } from "@/lib/org";
import type { Aging, DocType, Invoice, Page } from "@/lib/types";

type Tab = "invoice" | "bill" | "aging";
const TONE = { draft: "gold", open: "brand", paid: "muted", void: "muted" } as const;

function InvoicesView() {
  const { org, can } = useOrg();
  const cur = org!.base_currency, dp = org!.decimal_places;
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get("tab") === "bill" ? "bill" : params.get("tab") === "aging" ? "aging" : "invoice");
  const [status, setStatus] = useState<"all" | "draft" | "open" | "paid" | "void" | "overdue">("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [contacts, setContacts] = useState(false);
  const type: DocType = tab === "bill" ? "bill" : "invoice";
  const list = useOrgQuery<Page<Invoice>>(["docs", type], type === "invoice" ? "/invoices" : "/bills",
    { page: String(page), page_size: "20", status: status === "all" || status === "overdue" ? undefined : status, overdue: status === "overdue" ? "true" : undefined, q: q.trim() || undefined }, tab !== "aging");
  const sales = useOrgQuery<Aging>(["aging", "invoice"], "/reports/aging", { doc_type: "invoice" });
  const purchases = useOrgQuery<Aging>(["aging", "bill"], "/reports/aging", { doc_type: "bill" });
  const d = list.data;
  const noun = type === "invoice" ? "invoice" : "bill";

  return (
    <div className="space-y-4">
      <Title sub="Bill customers, record what you owe, and see who is late." action={<div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => setContacts(true)}><Users className="size-4" /> <span className="hidden sm:inline">Contacts</span></Button>
        {can("accountant") && <Link href={`/invoices/new?type=${type}`}><Button size="sm"><Plus className="size-4" /> New {noun}</Button></Link>}</div>}>Invoices & bills</Title>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3.5"><p className="text-xs font-semibold text-muted">Customers owe you</p><p className="num text-lg font-bold">{sales.data ? money(sales.data.totals.total, cur, dp) : "…"}</p>
          {sales.data && Number(sales.data.totals.total) > 0 && <p className="text-xs text-expense">{money(String(Number(sales.data.totals.total) - Number(sales.data.totals.current)), cur, dp)} late</p>}</Card>
        <Card className="p-3.5"><p className="text-xs font-semibold text-muted">You owe suppliers</p><p className="num text-lg font-bold">{purchases.data ? money(purchases.data.totals.total, cur, dp) : "…"}</p>
          {purchases.data && Number(purchases.data.totals.total) > 0 && <p className="text-xs text-expense">{money(String(Number(purchases.data.totals.total) - Number(purchases.data.totals.current)), cur, dp)} late</p>}</Card>
      </div>

      <Chips value={tab} onChange={(t) => { setTab(t); setPage(1); }} options={[{ value: "invoice", label: "Sales invoices" }, { value: "bill", label: "Purchase bills" }, { value: "aging", label: "Who owes whom" }]} />

      {tab === "aging" ? <AgingView sales={sales.data} purchases={purchases.data} loading={sales.isLoading || purchases.isLoading} cur={cur} dp={dp} /> : (
        <>
          <div className="relative"><Search className="pointer-events-none absolute left-4 top-3.5 size-5 text-muted" /><Input aria-label={`Search ${noun}s`} placeholder={`Search number, ${type === "invoice" ? "customer" : "supplier"} or reference`} className="pl-12" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
          <Chips value={status} onChange={(s) => { setStatus(s); setPage(1); }} options={[{ value: "all", label: "All" }, { value: "draft", label: "Drafts" }, { value: "open", label: "Open" }, { value: "overdue", label: "Overdue" }, { value: "paid", label: "Paid" }, { value: "void", label: "Void" }]} />
          <Card className="overflow-hidden">
            {list.error ? <ErrorState message={(list.error as Error).message} retry={() => list.refetch()} /> : list.isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-16" /><Skeleton className="h-16" /></div> :
             d && d.items.length === 0 ? <EmptyState title={`No ${noun}s found`} body={q || status !== "all" ? "Try a different search or filter." : type === "invoice" ? "Create your first invoice and we'll track when it's paid." : "Record a supplier bill and we'll remind you what is due."} action={can("accountant") && !q && status === "all" ? <Link href={`/invoices/new?type=${type}`}><Button>New {noun}</Button></Link> : undefined} /> : (
              <ul className="divide-y divide-border">{d?.items.map((i) => (
                <li key={i.id}><Link href={`/invoices/${i.id}?type=${i.doc_type}`} className="tap flex items-center gap-3 px-4 py-3.5 hover:bg-surface-muted">
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{i.contact_name}</span>
                    <span className="text-xs text-muted">{i.number} · due {fmtDate(i.due_date)}</span></span>
                  <span className="text-right"><span className="num block font-bold">{money(i.total, cur, dp)}</span>
                    {i.is_overdue ? <Badge tone="expense">overdue</Badge> : <Badge tone={TONE[i.status]}>{i.status}</Badge>}</span></Link></li>))}</ul>
            )}
          </Card>
          {d && d.total > d.page_size && (
            <div className="flex items-center justify-between"><Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button><span className="text-sm text-muted">Page {d.page} of {Math.ceil(d.total / d.page_size)}</span><Button variant="secondary" size="sm" disabled={page * d.page_size >= d.total} onClick={() => setPage((p) => p + 1)}>Next</Button></div>
          )}
        </>
      )}
      <ContactsSheet open={contacts} onClose={() => setContacts(false)} />
    </div>
  );
}

function AgingView({ sales, purchases, loading, cur, dp }: { sales?: Aging; purchases?: Aging; loading: boolean; cur: string; dp: number }) {
  const { org, can } = useOrg();
  const { getToken } = useAuth();
  const toast = useToast();
  const [which, setWhich] = useState<"invoice" | "bill">("invoice");
  const a = which === "invoice" ? sales : purchases;
  const exp = async () => { try { const t = await getToken(); if (t) await downloadFile(t, `/reports/aging?doc_type=${which}&format=csv`, "aging.csv", org!.id); } catch (e) { toast(errorMessage(e), "error"); } };
  const cols: [keyof Aging["totals"], string][] = [["current", "Not due"], ["d1_30", "1-30 days"], ["d31_60", "31-60"], ["d61_90", "61-90"], ["d90_plus", "90+"]];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2"><Chips value={which} onChange={setWhich} options={[{ value: "invoice", label: "Customers owe you" }, { value: "bill", label: "You owe suppliers" }]} />
        {can("accountant") && <Button variant="secondary" size="sm" onClick={exp}><Download className="size-4" /> CSV</Button>}</div>
      <p className="text-sm"><Hint label="what is aging?">{GLOSSARY.aging}</Hint></p>
      {loading ? <Skeleton className="h-40" /> : !a || a.rows.length === 0 ? <Card><EmptyState art="chart" title="Nothing outstanding" body={which === "invoice" ? "No customer owes you anything right now." : "You don't owe any supplier right now."} /></Card> : (
        <>
          <Card className="overflow-hidden"><ul className="divide-y divide-border">{a.rows.map((r) => (
            <li key={r.contact_id} className="space-y-1.5 px-4 py-3"><div className="flex justify-between gap-3"><span className="truncate font-semibold">{r.contact_name}</span><span className="num font-bold">{money(r.total, cur, dp)}</span></div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">{cols.map(([k, label]) => Number(r[k]) > 0 && <span key={k} className={cx(k === "current" ? "text-muted" : "text-expense")}>{label}: <span className="num font-semibold">{money(r[k], cur, dp)}</span></span>)}</div></li>))}</ul></Card>
          <Card className="grid grid-cols-2 gap-2 bg-surface-muted p-4 text-sm sm:grid-cols-6">
            {cols.map(([k, label]) => <div key={k}><p className="text-xs text-muted">{label}</p><p className="num font-bold">{money(a.totals[k], cur, dp)}</p></div>)}
            <div><p className="text-xs text-muted">Total</p><p className="num font-bold text-brand-strong">{money(a.totals.total, cur, dp)}</p></div></Card>
        </>
      )}
    </div>
  );
}

export default function InvoicesPage() {
  return <Suspense fallback={null}><InvoicesView /></Suspense>;
}
