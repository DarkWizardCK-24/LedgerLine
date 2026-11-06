"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Title } from "@/components/page";
import { Badge, Button, Card, Chips, EmptyState, ErrorState, Input, Skeleton } from "@/components/ui";
import { fmtDate } from "@/lib/dates";
import { money } from "@/lib/money";
import { useOrg, useOrgQuery } from "@/lib/org";
import type { Entry, EntryStatus, Page } from "@/lib/types";

const tone = { draft: "gold", posted: "brand", reversed: "muted" } as const;

function JournalView() {
  const { org, can } = useOrg();
  const params = useSearchParams();
  const initial = params.get("status");
  const cur = org!.base_currency, dp = org!.decimal_places;
  const [status, setStatus] = useState<"all" | EntryStatus>(initial === "draft" || initial === "posted" || initial === "reversed" ? initial : "all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const query = useOrgQuery<Page<Entry>>(["journal"], "/journal-entries", { page: String(page), page_size: "20", status: status === "all" ? undefined : status, q: q.trim() || undefined });
  const d = query.data;

  return (
    <div>
      <Title sub="Every transaction, as balanced debits and credits." action={can("accountant") ? <Link href="/journal/new" className="hidden lg:block"><Button><Plus className="size-5" /> New entry</Button></Link> : undefined}>Journal</Title>
      <div className="space-y-3">
        <div className="relative"><Search className="pointer-events-none absolute left-4 top-3.5 size-5 text-muted" /><Input aria-label="Search entries" placeholder="Search description, reference or JE-000012" className="pl-12" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        <Chips value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: "all", label: "All" }, { value: "draft", label: "Drafts" }, { value: "posted", label: "Posted" }, { value: "reversed", label: "Reversed" }]} />
      </div>

      <Card className="mt-4 overflow-hidden">
        {query.error ? <ErrorState message={(query.error as Error).message} retry={() => query.refetch()} /> :
         query.isLoading ? <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div> :
         d && d.items.length === 0 ? <EmptyState title={q || status !== "all" ? "No matching entries" : "No journal entries yet"} body={q || status !== "all" ? "Try a different search or filter." : "Record the first transaction to start your ledger."} action={!q && status === "all" && can("accountant") ? <Link href="/journal/new"><Button>New entry</Button></Link> : undefined} /> : (
          <ul className="divide-y divide-border">
            {d?.items.map((e) => (
              <li key={e.id}>
                <Link href={`/journal/${e.id}`} className="tap flex items-center gap-3 px-4 py-3.5 transition hover:bg-surface-muted">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-[11px] font-bold text-brand-strong">{e.entry_number ? `#${e.entry_number}` : "DRAFT"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{e.description || "Journal entry"}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">{fmtDate(e.entry_date)}{e.reference_number && <span>· {e.reference_number}</span>}</span>
                  </span>
                  <span className="text-right"><span className="num block font-bold">{money(e.total_debit, cur, dp)}</span><Badge tone={tone[e.status]}>{e.status}</Badge></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {d && d.total > d.page_size && (
        <div className="mt-4 flex items-center justify-between">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-sm text-muted">Page {d.page} of {Math.ceil(d.total / d.page_size)}</span>
          <Button variant="secondary" size="sm" disabled={page * d.page_size >= d.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

export default function JournalPage() {
  return <Suspense fallback={null}><JournalView /></Suspense>;
}
