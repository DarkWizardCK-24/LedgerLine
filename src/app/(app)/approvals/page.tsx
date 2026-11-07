"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Hint, GLOSSARY } from "@/components/hint";
import { Title } from "@/components/page";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Sheet, Skeleton, useToast } from "@/components/ui";
import { fmtDate } from "@/lib/dates";
import { money } from "@/lib/money";
import { errorMessage, useOrg, useOrgQuery } from "@/lib/org";
import type { ApprovalMode, Entry, Page } from "@/lib/types";

const MODE_TEXT: Record<ApprovalMode, string> = {
  off: "Approvals are off: anyone who can record entries can post them.",
  different_user: "Someone other than the person who created an entry must post it. Owners are exempt.",
  admin_only: "Only admins and owners can post entries.",
};

export default function ApprovalsPage() {
  const { org, can, call } = useOrg();
  const cur = org!.base_currency, dp = org!.decimal_places;
  const qc = useQueryClient();
  const toast = useToast();
  const mode = useOrgQuery<{ approval_mode: ApprovalMode }>(["settings"], "/accounting/settings");
  const q = useOrgQuery<Page<Entry>>(["pending"], "/journal-entries", { pending: "true", page_size: "50" });
  const [rej, setRej] = useState<Entry | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const admin = can("admin");
  const refresh = () => qc.invalidateQueries();

  const approve = async (e: Entry) => {
    setBusy(e.id);
    try { await call(`/journal-entries/${e.id}/post`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() } }); await refresh(); toast("Approved and posted."); }
    catch (x) { toast(errorMessage(x), "error"); } finally { setBusy(null); }
  };
  const reject = async () => {
    if (!rej) return;
    setBusy(rej.id);
    try { await call(`/journal-entries/${rej.id}/reject`, { json: { note } }); await refresh(); toast("Sent back to the preparer."); setRej(null); setNote(""); }
    catch (x) { toast(errorMessage(x), "error"); } finally { setBusy(null); }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Title sub="Entries waiting for a second pair of eyes.">Approvals</Title>
      <Card className="flex items-start gap-3 p-4"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand" /><div className="text-sm"><p className="font-semibold">{mode.data ? MODE_TEXT[mode.data.approval_mode] : "…"}</p><p className="mt-1 text-muted"><Hint label="what is this?">{GLOSSARY.approval}</Hint> {admin && <Link href="/settings" className="font-semibold text-brand-strong">Change in Settings</Link>}</p></div></Card>
      {q.error ? <ErrorState message={(q.error as Error).message} retry={() => q.refetch()} /> : q.isLoading ? <Skeleton className="h-32" /> : (q.data?.items.length ?? 0) === 0 ? <Card><EmptyState title="Nothing waiting" body="When someone submits an entry for approval it will appear here." /></Card> : (
        <Card className="divide-y divide-border overflow-hidden">
          {q.data!.items.map((e) => (
            <div key={e.id} className="space-y-2 px-4 py-3">
              <div className="flex items-start justify-between gap-3"><Link href={`/journal/${e.id}`} className="min-w-0"><span className="block truncate font-semibold hover:underline">{e.description || "Journal entry"}</span><span className="text-xs text-muted">{fmtDate(e.entry_date)} · submitted {e.submitted_at ? new Date(e.submitted_at).toLocaleDateString() : ""}</span></Link><span className="num font-bold">{money(e.total_debit, cur, dp)}</span></div>
              {admin ? <div className="grid grid-cols-2 gap-2"><Button size="sm" variant="secondary" onClick={() => { setRej(e); setNote(""); }}><X className="size-4" /> Send back</Button><Button size="sm" loading={busy === e.id} onClick={() => approve(e)}><Check className="size-4" /> Approve</Button></div> : <Badge tone="gold">waiting for an admin</Badge>}
            </div>))}
        </Card>
      )}
      <Sheet open={!!rej} onClose={() => setRej(null)} title="Send back" footer={<Button size="lg" className="w-full" loading={!!busy} onClick={reject}>Send back</Button>}>
        <div className="space-y-3 pb-2"><p className="text-sm text-muted">It returns to a normal draft, with your note attached so the preparer knows what to fix.</p>
          <Field label="What needs fixing?">{(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Wrong account" maxLength={500} />}</Field></div>
      </Sheet>
    </div>
  );
}
