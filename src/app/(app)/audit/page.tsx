"use client";

import { useState } from "react";
import { Title } from "@/components/page";
import { Badge, Button, Card, EmptyState, ErrorState, Input, Skeleton } from "@/components/ui";
import { useOrg, useOrgQuery } from "@/lib/org";
import type { Page } from "@/lib/types";

type Log = { id: string; actor_user_id: string | null; action: string; entity_type: string; entity_id: string; old_values: Record<string, unknown> | null; new_values: Record<string, unknown> | null; created_at: string };

export default function AuditPage() {
  const { can } = useOrg();
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const q = useOrgQuery<Page<Log>>(["audit"], "/audit-logs", { page: String(page), page_size: "25", action: action.trim() || undefined }, can("admin"));

  if (!can("admin")) return <Card><EmptyState title="Admins only" body="The audit trail is visible to organization admins and owners." /></Card>;
  const d = q.data;
  return (
    <div>
      <Title sub="An append-only record of every important action.">Audit history</Title>
      <Input aria-label="Filter by action" placeholder="Filter by action, e.g. journal or account" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} />
      <Card className="mt-4 overflow-hidden">
        {q.error ? <ErrorState message={(q.error as Error).message} retry={() => q.refetch()} /> : q.isLoading ? <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div> :
         d?.items.length === 0 ? <EmptyState title="No activity" body="Nothing matches that filter." /> : (
          <ul className="divide-y divide-border">
            {d?.items.map((l) => (
              <li key={l.id}>
                <button className="tap w-full px-4 py-3 text-left hover:bg-surface-muted" onClick={() => setOpen(open === l.id ? null : l.id)} aria-expanded={open === l.id}>
                  <div className="flex items-center justify-between gap-2"><Badge tone="brand">{l.action}</Badge><span className="text-xs text-muted">{new Date(l.created_at).toLocaleString()}</span></div>
                  <p className="mt-1 truncate text-xs text-muted">{l.entity_type} · {l.entity_id}{l.actor_user_id ? ` · by ${l.actor_user_id.slice(0, 8)}` : ""}</p>
                </button>
                {open === l.id && (
                  <div className="grid gap-2 bg-surface-muted px-4 pb-3 text-xs sm:grid-cols-2">
                    {([["Before", l.old_values], ["After", l.new_values]] as const).map(([t, v]) => <div key={t}><p className="mb-1 font-bold uppercase tracking-wider text-muted">{t}</p><pre className="overflow-x-auto rounded-xl bg-surface p-2.5">{v ? JSON.stringify(v, null, 2) : "—"}</pre></div>)}
                  </div>
                )}
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
