"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, FileUp, Link2, Plus, Sparkles, TriangleAlert, Unlink2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Hint, GLOSSARY } from "@/components/hint";
import { Badge, Button, Card, Chips, ConfirmSheet, ErrorState, Field, Input, Select, Sheet, Skeleton, cx, useToast } from "@/components/ui";
import { fmtDate, today } from "@/lib/dates";
import { money } from "@/lib/money";
import { errorMessage, useOrg, useOrgQuery } from "@/lib/org";
import type { Account, Entry, Page, ReconDetail, ReconItem, ReconSuggestion } from "@/lib/types";

type Tab = "statement" | "ledger";

export default function ReconWorkspace() {
  const { id } = useParams<{ id: string }>();
  const { org, call, can } = useOrg();
  const cur = org!.base_currency, dp = org!.decimal_places;
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useOrgQuery<ReconDetail>(["recon", id], `/reconciliations/${id}`);
  const open = q.data?.session.status === "in_progress";
  const sugg = useOrgQuery<ReconSuggestion[]>(["recon-sugg", id], `/reconciliations/${id}/suggestions`, undefined, !!open);
  const accounts = useOrgQuery<Page<Account>>(["accounts-active"], "/accounts", { page_size: "200", active: "true" }, !!open);

  const [tab, setTab] = useState<Tab>("statement");
  const [sel, setSel] = useState<ReconItem | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | "complete" | "cancel">(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries();
  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try { await fn(); await refresh(); if (ok) toast(ok); return true; } catch (e) { toast(errorMessage(e), "error"); return false; } finally { setBusy(false); }
  };
  const confident = useMemo(() => (sugg.data ?? []).filter((s) => s.confident), [sugg.data]);

  if (q.isLoading) return <div className="space-y-3"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-44" /><Skeleton className="h-24" /></div>;
  if (q.error || !q.data) return <ErrorState message={q.error ? (q.error as Error).message : "Not found."} retry={() => q.refetch()} />;
  const { session: s, summary: sm, items, ledger_lines } = q.data;
  const balanced = Number(sm.difference) === 0;
  const canEdit = can("accountant") && open;

  const acceptSuggestions = () => act(async () => {
    for (const g of confident) await call(`/reconciliations/${id}/match`, { json: { item_id: g.item_id, journal_entry_line_id: g.candidates[0].line_id } });
  }, `${confident.length} line(s) matched.`);

  return (
    <div className="space-y-4">
      <Link href="/reconciliation" className="tap -ml-2 inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="size-4" /> Reconciliation</Link>
      <div>
        <div className="flex flex-wrap items-center gap-2"><h1 className="font-display text-2xl font-semibold lg:text-3xl">{s.account_name}</h1>
          <Badge tone={s.status === "completed" ? "brand" : s.status === "cancelled" ? "muted" : "gold"}>{s.status.replace("_", " ")}</Badge></div>
        <p className="text-sm text-muted">{fmtDate(s.statement_start_date)} to {fmtDate(s.statement_end_date)} <Hint label="what is this?">{GLOSSARY.reconciliation}</Hint></p>
      </div>

      {/* the number that matters */}
      <section className={cx("rounded-[28px] p-5 text-white shadow-lg", balanced && sm.unmatched_count === 0 ? "bg-brand-gradient" : "bg-[linear-gradient(135deg,#3a2c08,#a8760f_60%,#d99a1b)]")}>
        <p className="text-sm font-semibold text-white/80">{s.status === "completed" ? "Reconciled" : "Difference to explain"}</p>
        <p className="num font-display text-4xl font-semibold">{money(String(Math.abs(Number(sm.difference))), cur, dp)}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <Stat label="Statement" value={money(sm.closing_balance, cur, dp)} />
          <Stat label="Cleared in books" value={money(sm.reconciled_balance, cur, dp)} />
          <Stat label="Books today" value={money(sm.ledger_balance, cur, dp)} />
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Pill n={sm.matched_count} label="Matched" tone="brand" /><Pill n={sm.unmatched_count} label="To match" tone={sm.unmatched_count ? "gold" : "brand"} /><Pill n={sm.ignored_count} label="Ignored" tone="muted" />
      </div>

      {open && sm.blockers.length > 0 && (
        <div role="status" className="space-y-1 rounded-2xl bg-gold-soft p-3.5 text-sm text-warning">
          {sm.blockers.map((b) => <p key={b} className="flex gap-2"><TriangleAlert className="mt-0.5 size-4 shrink-0" />{b}</p>)}
          {Number(sm.statement_gap) !== 0 && <p className="flex gap-2"><TriangleAlert className="mt-0.5 size-4 shrink-0" />The statement lines add up to {money(sm.statement_items_total, cur, dp)}, but the opening and closing balances imply {money(sm.expected_statement_total, cur, dp)}. A line may be missing from the import.</p>}
        </div>
      )}
      {open && balanced && sm.unmatched_count === 0 && <p role="status" className="flex items-center gap-2 rounded-2xl bg-brand-soft p-3.5 text-sm font-semibold text-brand-strong"><CheckCircle2 className="size-5" /> Everything matches. You can complete this reconciliation.</p>}

      {canEdit && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}><FileUp className="size-4" /> Import CSV</Button>
          <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}><Plus className="size-4" /> Add line</Button>
          <Button variant="gold" size="sm" disabled={confident.length === 0 || busy} onClick={acceptSuggestions}><Sparkles className="size-4" /> Match {confident.length || ""} sure</Button>
          <Button size="sm" disabled={!sm.can_complete || busy} onClick={() => setConfirm("complete")}><CheckCircle2 className="size-4" /> Complete</Button>
        </div>
      )}

      <Chips value={tab} onChange={setTab} options={[{ value: "statement", label: `Statement lines (${items.length})` }, { value: "ledger", label: `Not yet cleared (${sm.unmatched_ledger_count})` }]} />

      {tab === "statement" ? (
        <Card className="overflow-hidden">
          {items.length === 0 ? <p className="p-6 text-center text-sm text-muted">No statement lines yet. Import your bank&apos;s CSV or add lines by hand.</p> : (
            <ul className="divide-y divide-border">
              {items.map((i) => (
                <li key={i.id}>
                  <button onClick={() => setSel(i)} className="tap flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-muted">
                    <span className={cx("grid size-10 shrink-0 place-items-center rounded-xl", i.match_status === "matched" ? "bg-brand-soft text-brand-strong" : i.match_status === "ignored" ? "bg-surface-muted text-muted" : "bg-gold-soft text-warning")}>
                      {i.match_status === "matched" ? <Link2 className="size-5" /> : i.match_status === "ignored" ? <Unlink2 className="size-5" /> : <TriangleAlert className="size-5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{i.description || i.statement_reference || "Statement line"}</span>
                      <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted">{fmtDate(i.statement_date)}{i.statement_reference && ` · ${i.statement_reference}`}
                        {i.possible_duplicate && <Badge tone="gold">possible duplicate</Badge>}{i.matched_entry_number && <span>→ {i.matched_entry_number}</span>}</span>
                    </span>
                    <span className={cx("num shrink-0 font-bold", Number(i.statement_amount) < 0 ? "text-expense" : "text-income")}>{money(i.statement_amount, cur, dp)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {!open ? <p className="p-6 text-center text-sm text-muted">Not tracked for a closed reconciliation.</p> : ledger_lines.length === 0 ? <p className="p-6 text-center text-sm text-muted">Every ledger entry up to the statement date has cleared.</p> : (
            <ul className="divide-y divide-border">
              {ledger_lines.map((l) => (
                <li key={l.line_id}>
                  <Link href={`/journal/${l.entry_id}`} className="tap flex items-center gap-3 px-4 py-3 hover:bg-surface-muted">
                    <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{l.description || "Journal entry"}</span><span className="text-xs text-muted">{fmtDate(l.entry_date)} · {l.display_number}</span></span>
                    <span className={cx("num font-bold", Number(l.amount) < 0 ? "text-expense" : "text-income")}>{money(l.amount, cur, dp)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {open && <p className="border-t border-border bg-surface-muted p-3 text-xs text-muted">Outstanding items such as uncashed cheques stay here and carry forward to the next statement.</p>}
        </Card>
      )}

      {canEdit && <Button variant="ghost" className="w-full text-expense" onClick={() => setConfirm("cancel")}>Cancel this reconciliation</Button>}

      {sel && <ItemSheet key={sel.id} item={sel} detail={q.data} suggestion={sugg.data?.find((x) => x.item_id === sel.id)} canEdit={canEdit} busy={busy} accounts={accounts.data?.items ?? []} onClose={() => setSel(null)}
        act={act} call={call} id={id} cur={cur} dp={dp} />}

      <ImportSheet open={importOpen} onClose={() => setImportOpen(false)} id={id} onDone={refresh} />
      <AddSheet open={addOpen} onClose={() => setAddOpen(false)} id={id} start={s.statement_start_date} end={s.statement_end_date} onDone={refresh} />

      <ConfirmSheet open={confirm === "complete"} title="Complete reconciliation?" body={`This freezes the reconciliation at ${money(sm.reconciled_balance, cur, dp)}. A completed reconciliation can't be edited.`} confirmLabel="Complete" busy={busy}
        onClose={() => setConfirm(null)} onConfirm={async () => { if (await act(() => call(`/reconciliations/${id}/complete`, { method: "POST" }), "Reconciliation completed.")) setConfirm(null); }} />
      <ConfirmSheet open={confirm === "cancel"} danger title="Cancel reconciliation?" body="All statement lines and matches in this reconciliation are discarded. Your journal entries are not touched." confirmLabel="Cancel reconciliation" busy={busy}
        onClose={() => setConfirm(null)} onConfirm={async () => { if (await act(() => call(`/reconciliations/${id}/cancel`, { method: "POST" }), "Reconciliation cancelled.")) router.replace("/reconciliation"); }} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-white/12 px-1.5 py-2"><p className="font-semibold text-white/75">{label}</p><p className="num truncate text-[13px] font-bold">{value}</p></div>;
}
function Pill({ n, label, tone }: { n: number; label: string; tone: "brand" | "gold" | "muted" }) {
  return <div className={cx("rounded-2xl py-2.5", tone === "brand" ? "bg-brand-soft text-brand-strong" : tone === "gold" ? "bg-gold-soft text-warning" : "bg-surface-muted text-muted")}><p className="num text-xl font-bold">{n}</p><p className="text-[11px] font-semibold uppercase tracking-wider">{label}</p></div>;
}

/* ---- match / adjust / ignore a single statement line */
function ItemSheet({ item, detail, suggestion, canEdit, busy, accounts, onClose, act, call, id, cur, dp }: {
  item: ReconItem; detail: ReconDetail; suggestion?: ReconSuggestion; canEdit: boolean; busy: boolean; accounts: Account[]; onClose: () => void;
  act: (fn: () => Promise<unknown>, ok?: string) => Promise<boolean>; call: <T>(p: string, i?: { method?: string; json?: unknown }) => Promise<T>; id: string; cur: string; dp: number;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"match" | "adjust" | "ignore">("match");
  const [counter, setCounter] = useState("");
  const [reason, setReason] = useState("");
  const same = detail.ledger_lines.filter((l) => l.amount === item.statement_amount)
    .sort((a, b) => Math.abs(+new Date(a.entry_date) - +new Date(item.statement_date)) - Math.abs(+new Date(b.entry_date) - +new Date(item.statement_date)));

  return (
    <Sheet open onClose={onClose} title="Statement line">
      <div className="space-y-4 pb-3">
        <div className="rounded-2xl bg-surface-muted p-4">
          <p className="font-semibold">{item.description || "Statement line"}</p>
          <p className="text-sm text-muted">{fmtDate(item.statement_date)}{item.statement_reference && ` · ${item.statement_reference}`}</p>
          <p className={cx("num mt-1 text-2xl font-bold", Number(item.statement_amount) < 0 ? "text-expense" : "text-income")}>{money(item.statement_amount, cur, dp)}</p>
        </div>

        {item.match_status === "matched" && (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-brand-strong"><Link2 className="size-4" /> Matched to <Link className="underline" href={`/journal/${item.matched_entry_id}`}>{item.matched_entry_number}</Link></p>
            {canEdit && <Button variant="secondary" className="w-full" loading={busy} onClick={async () => { if (await act(() => call(`/reconciliations/${id}/unmatch`, { json: { item_id: item.id } }), "Unmatched.")) onClose(); }}>Unmatch</Button>}
          </div>
        )}
        {item.match_status === "ignored" && (
          <div className="space-y-3"><p className="text-sm text-muted">Ignored: {item.ignore_reason}</p>
            {canEdit && <Button variant="secondary" className="w-full" loading={busy} onClick={async () => { if (await act(() => call(`/reconciliations/${id}/restore`, { json: { item_id: item.id } }), "Restored.")) onClose(); }}>Restore this line</Button>}</div>
        )}

        {item.match_status === "unmatched" && canEdit && (
          <>
            <Chips value={mode} onChange={setMode} options={[{ value: "match", label: "Match" }, { value: "adjust", label: "Not in books" }, { value: "ignore", label: "Ignore" }]} />
            {mode === "match" && (
              <div className="space-y-2">
                {suggestion && !suggestion.confident && <p className="rounded-xl bg-gold-soft p-2.5 text-xs text-warning">More than one entry could match. Pick the right one.</p>}
                {same.length === 0 ? <p className="text-sm text-muted">No uncleared ledger entry has exactly this amount. If the transaction is missing from your books, use &ldquo;Not in books&rdquo;.</p> : same.map((l) => (
                  <div key={l.line_id} className="flex items-center gap-3 rounded-2xl border border-border p-3">
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{l.description || "Journal entry"}</p><p className="text-xs text-muted">{fmtDate(l.entry_date)} · {l.display_number}</p></div>
                    <Button size="sm" loading={busy} onClick={async () => { if (await act(() => call(`/reconciliations/${id}/match`, { json: { item_id: item.id, journal_entry_line_id: l.line_id } }), "Matched.")) onClose(); }}>Match</Button>
                  </div>
                ))}
              </div>
            )}
            {mode === "adjust" && (
              <div className="space-y-3">
                <p className="text-sm text-muted">Creates a <b>draft</b> journal entry for this line. Nothing is posted until you review and post it.</p>
                <Field label="Other side of the entry">{(i) => <Select id={i} value={counter} onChange={(e) => setCounter(e.target.value)}><option value="">Choose an account…</option>
                  {accounts.filter((a) => a.id !== detail.session.account_id).map((a) => <option key={a.id} value={a.id}>{a.account_code} · {a.account_name}</option>)}</Select>}</Field>
                <Button className="w-full" loading={busy} disabled={!counter} onClick={async () => {
                  let draftId = "";
                  const ok = await act(async () => { const e = await call<Entry>(`/reconciliations/${id}/adjustment-draft`, { json: { item_id: item.id, counter_account_id: counter } }); draftId = e.id; }, "Draft entry created. Post it, then match.");
                  if (ok && draftId) router.push(`/journal/${draftId}`);
                }}>Create draft entry</Button>
              </div>
            )}
            {mode === "ignore" && (
              <div className="space-y-3">
                <p className="text-sm text-muted">Only for lines that are not really on the statement, such as a row duplicated in the import. A real transaction needs a ledger entry.</p>
                <Field label="Reason">{(i) => <Input id={i} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Duplicate row in the file" maxLength={300} />}</Field>
                <Button variant="secondary" className="w-full" loading={busy} disabled={reason.trim().length < 3} onClick={async () => { if (await act(() => call(`/reconciliations/${id}/ignore`, { json: { item_id: item.id, reason } }), "Line ignored.")) onClose(); }}>Ignore line</Button>
                <Button variant="ghost" className="w-full text-expense" loading={busy} onClick={async () => { if (await act(() => call(`/reconciliations/${id}/items/${item.id}`, { method: "DELETE" }), "Line removed.")) onClose(); }}>Remove line entirely</Button>
              </div>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

/* ---- import a statement CSV */
function ImportSheet({ open, onClose, id, onDone }: { open: boolean; onClose: () => void; id: string; onDone: () => void }) {
  const { call } = useOrg();
  const toast = useToast();
  const [fmt, setFmt] = useState("auto");
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ imported: number; skipped: { row: number; message: string }[]; possible_duplicates: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const run = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await call<NonNullable<typeof res>>(`/reconciliations/${id}/import`, { json: { csv_text: text, date_format: fmt } });
      setRes(r); onDone();
      toast(`${r.imported} line(s) imported.`);
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };
  const close = () => { setText(""); setName(""); setRes(null); setErr(null); onClose(); };

  return (
    <Sheet open={open} onClose={close} title="Import statement CSV" footer={res ? <Button className="w-full" size="lg" onClick={close}>Done</Button> : <Button className="w-full" size="lg" loading={busy} disabled={!text} onClick={run}>Import</Button>}>
      <div className="space-y-4 pb-2">
        {!res ? (
          <>
            <p className="text-sm text-muted">Needs a header row with a date column and either <b>Amount</b> or <b>Debit/Credit</b> (Withdrawal/Deposit) columns. Amounts like 1,250.50, (75.00) and 300 Dr are understood.</p>
            <input ref={file} type="file" accept=".csv,text/csv,text/plain" className="sr-only" aria-label="Choose CSV file"
              onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 2_500_000) { setErr("That file is larger than 2.5 MB."); return; } setName(f.name); setText(await f.text()); setErr(null); }} />
            <Button variant="secondary" className="w-full" onClick={() => file.current?.click()}><FileUp className="size-4" /> {name || "Choose a CSV file"}</Button>
            <Field label="Date format">{(i) => <Select id={i} value={fmt} onChange={(e) => setFmt(e.target.value)}>
              <option value="auto">Automatic (2026-04-30 or 30/04/2026)</option><option value="dmy">Day / month / year</option><option value="mdy">Month / day / year</option><option value="ymd">Year-month-day</option></Select>}</Field>
            {err && <p role="alert" className="rounded-2xl bg-expense-soft p-3 text-sm text-expense">{err}</p>}
          </>
        ) : (
          <div className="space-y-3">
            <p className="flex items-center gap-2 font-semibold text-brand-strong"><CheckCircle2 className="size-5" /> {res.imported} line(s) imported</p>
            {res.possible_duplicates > 0 && <p className="rounded-xl bg-gold-soft p-3 text-sm text-warning">{res.possible_duplicates} line(s) look like duplicates. They are flagged in the list so you can ignore them.</p>}
            {res.skipped.length > 0 && <div className="rounded-xl bg-expense-soft p-3 text-sm text-expense"><p className="font-semibold">{res.skipped.length} row(s) skipped</p>
              <ul className="mt-1 max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5">{res.skipped.map((s) => <li key={s.row}>Row {s.row}: {s.message}</li>)}</ul></div>}
          </div>
        )}
      </div>
    </Sheet>
  );
}

function AddSheet({ open, onClose, id, start, end, onDone }: { open: boolean; onClose: () => void; id: string; start: string; end: string; onDone: () => void }) {
  const { call } = useOrg();
  const toast = useToast();
  const [f, setF] = useState({ date: today() > end ? end : today() < start ? start : today(), amount: "", ref: "", desc: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true); setErr(null);
    try { await call(`/reconciliations/${id}/items`, { json: { statement_date: f.date, statement_amount: f.amount, statement_reference: f.ref, description: f.desc } }); onDone(); toast("Line added."); setF({ ...f, amount: "", ref: "", desc: "" }); onClose(); }
    catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Add statement line" footer={<Button size="lg" className="w-full" loading={busy} disabled={!f.amount || f.amount === "-"} onClick={submit}>Add line</Button>}>
      <div className="space-y-4 pb-2">
        <Field label="Date">{(i) => <Input id={i} type="date" min={start} max={end} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />}</Field>
        <Field label="Amount" hint="Positive = money in (or a card charge). Negative = money out.">{(i) => <Input id={i} inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.-]/g, "") })} className="num text-right text-lg font-semibold" />}</Field>
        <Field label="Reference">{(i) => <Input id={i} value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} maxLength={120} />}</Field>
        <Field label="Description">{(i) => <Input id={i} value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} maxLength={500} />}</Field>
        {err && <p role="alert" className="rounded-2xl bg-expense-soft p-3 text-sm text-expense">{err}</p>}
      </div>
    </Sheet>
  );
}
