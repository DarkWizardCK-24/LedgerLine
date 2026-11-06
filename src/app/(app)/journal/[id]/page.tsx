"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Pencil, RotateCcw, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { EntryEditor } from "@/components/entry-editor";
import { Amt } from "@/components/page";
import { Badge, Button, Card, ConfirmSheet, ErrorState, Field, Input, Sheet, Skeleton, useToast } from "@/components/ui";
import { fmtDate, today } from "@/lib/dates";
import { money } from "@/lib/money";
import { errorMessage, useOrg, useOrgQuery } from "@/lib/org";
import type { Entry } from "@/lib/types";

export default function EntryPage() {
  const { id } = useParams<{ id: string }>();
  const { org, call, can } = useOrg();
  const cur = org!.base_currency, dp = org!.decimal_places;
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const q = useOrgQuery<Entry>(["entry", id], `/journal-entries/${id}`);
  const e = q.data;
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<null | "post" | "discard">(null);
  const [revOpen, setRevOpen] = useState(false);
  const [revDate, setRevDate] = useState(e?.entry_date ?? today());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>, ok: string, after?: () => void) => {
    setBusy(true); setErr(null);
    try { await fn(); toast(ok); await qc.invalidateQueries(); after?.(); } catch (x) { setErr(errorMessage(x)); toast(errorMessage(x), "error"); } finally { setBusy(false); setConfirm(null); }
  };

  if (q.isLoading) return <div className="space-y-3"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-40" /></div>;
  if (q.error || !e) return <ErrorState message={q.error ? (q.error as Error).message : "Entry not found."} retry={() => q.refetch()} />;
  const canEdit = can("accountant");

  return (
    <div className="space-y-4">
      <Link href="/journal" className="tap -ml-2 inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="size-4" /> Journal</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold">{e.display_number}</h1>
        <Badge tone={e.status === "posted" ? "brand" : e.status === "draft" ? "gold" : "muted"}>{e.status}</Badge>
      </div>

      {editing && e.status === "draft" ? (
        <EntryEditor entry={e} onSaved={() => setEditing(false)} />
      ) : (
        <>
          <Card className="space-y-1 p-4">
            <p className="text-lg font-semibold">{e.description || "Journal entry"}</p>
            <p className="text-sm text-muted">{fmtDate(e.entry_date)}{e.reference_number && ` · Ref ${e.reference_number}`}{e.posted_at && ` · posted ${new Date(e.posted_at).toLocaleString()}`}</p>
            {e.reverses_entry_id && <p className="text-sm"><Link className="font-semibold text-brand-strong" href={`/journal/${e.reverses_entry_id}`}>This entry reverses an earlier one →</Link></p>}
            {e.reversed_by_entry_id && <p className="text-sm"><Link className="font-semibold text-expense" href={`/journal/${e.reversed_by_entry_id}`}>This entry was reversed →</Link></p>}
          </Card>

          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {e.lines.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/ledger?account=${l.account_id}`} className="block truncate font-semibold hover:underline">{l.account_code} · {l.account_name}</Link>
                    {l.description && <p className="truncate text-xs text-muted">{l.description}</p>}
                  </div>
                  <div className="text-right">
                    {Number(l.debit_amount) > 0 ? <p className="num font-bold">{money(l.debit_amount, cur, dp)}<span className="ml-1.5 text-xs font-bold text-brand-strong">Dr</span></p>
                      : <p className="num font-bold">{money(l.credit_amount, cur, dp)}<span className="ml-1.5 text-xs font-bold text-warning">Cr</span></p>}
                  </div>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-2 gap-2 border-t border-border bg-surface-muted px-4 py-3 text-sm font-bold">
              <span>Total debit <Amt value={money(e.total_debit, cur, dp)} className="block text-base" /></span>
              <span className="text-right">Total credit <Amt value={money(e.total_credit, cur, dp)} className="block text-base" /></span>
            </div>
          </Card>

          {err && <p role="alert" className="rounded-2xl bg-expense-soft p-3 text-sm text-expense">{err}</p>}

          {canEdit && e.status === "draft" && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="size-4" /> Edit</Button>
              <Button variant="secondary" onClick={() => setConfirm("discard")}><Trash2 className="size-4" /> Discard</Button>
              <Button disabled={!e.is_balanced} onClick={() => setConfirm("post")}><CheckCircle2 className="size-5" /> Post entry</Button>
            </div>
          )}
          {canEdit && e.status === "posted" && !e.reverses_entry_id && (
            <Button variant="secondary" className="w-full sm:w-auto" onClick={() => { setRevDate(e.entry_date); setRevOpen(true); }}><Undo2 className="size-4" /> Reverse entry</Button>
          )}
          {e.status !== "draft" && <p className="flex items-center gap-1.5 text-xs text-muted"><RotateCcw className="size-3.5" /> Posted entries can&apos;t be edited. Corrections are made by reversal, which keeps a full audit trail.</p>}
        </>
      )}

      <ConfirmSheet open={confirm === "post"} title="Post this entry?" body="It will be numbered and written to the general ledger. This can only be undone by a reversal." confirmLabel="Post entry" busy={busy}
        onClose={() => setConfirm(null)} onConfirm={() => run(() => call(`/journal-entries/${e.id}/post`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() } }), "Entry posted.")} />
      <ConfirmSheet open={confirm === "discard"} danger title="Discard this draft?" body="The draft will be deleted. Posted entries are never deleted." confirmLabel="Discard" busy={busy}
        onClose={() => setConfirm(null)} onConfirm={() => run(() => call(`/journal-entries/${e.id}`, { method: "DELETE" }), "Draft discarded.", () => router.replace("/journal"))} />
      <Sheet open={revOpen} onClose={() => setRevOpen(false)} title="Reverse entry"
        footer={<Button className="w-full" size="lg" loading={busy} onClick={() => run(async () => { const r = await call<Entry>(`/journal-entries/${e.id}/reverse`, { method: "POST", json: { reversal_date: revDate, reason }, headers: { "Idempotency-Key": crypto.randomUUID() } }); setRevOpen(false); router.replace(`/journal/${r.id}`); }, "Entry reversed.")}>Create reversal</Button>}>
        <div className="space-y-4 pb-2">
          <p className="text-sm text-muted">A new entry with debits and credits swapped is posted and linked to this one.</p>
          <Field label="Reversal date">{(i) => <Input id={i} type="date" value={revDate} onChange={(x) => setRevDate(x.target.value)} />}</Field>
          <Field label="Reason (optional)">{(i) => <Input id={i} value={reason} onChange={(x) => setReason(x.target.value)} maxLength={400} />}</Field>
          {err && <p role="alert" className="text-sm text-expense">{err}</p>}
        </div>
      </Sheet>
    </div>
  );
}
