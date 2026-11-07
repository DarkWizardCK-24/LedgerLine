"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileUp, Layers, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Title } from "@/components/page";
import { Badge, Button, Card, Chips, EmptyState, ErrorState, Field, Select, Skeleton, cx, useToast } from "@/components/ui";
import { fmtDate } from "@/lib/dates";
import { useAccounts } from "@/lib/hooks";
import { money } from "@/lib/money";
import { errorMessage, useOrg, useOrgQuery } from "@/lib/org";
import type { JournalImportResult, PlatformImportResult, SourcePreview, SourceReport } from "@/lib/types";

type Tab = "lensly" | "ledgerly" | "file";

export default function ImportPage() {
  const { can } = useOrg();
  const [tab, setTab] = useState<Tab>("lensly");
  if (!can("accountant")) return <ErrorState message="Your role can't import entries." />;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Title sub="Bring in entries from your other apps or from a spreadsheet. Everything arrives as drafts you can review first.">Import</Title>
      <Chips value={tab} onChange={setTab} options={[{ value: "lensly", label: "Lensly statements" }, { value: "ledgerly", label: "Ledgerly CashBooks" }, { value: "file", label: "Excel or CSV file" }]} />
      {tab === "file" ? <FileImport /> : <PlatformImporter key={tab} source={tab} />}
    </div>
  );
}

function AfterImport({ ids, label }: { ids: string[]; label: string }) {
  const { call } = useOrg();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  if (ids.length === 0) return null;
  const postAll = async () => {
    setBusy(true);
    try { const r = await call<{ posted: number; results: { status: string; message?: string }[] }>("/journal-entries/bulk-post", { json: { entry_ids: ids } }); setDone(r.posted); await qc.invalidateQueries(); toast(`${r.posted} entries posted.`); }
    catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };
  return (
    <Card className="space-y-3 border-brand/40 p-4">
      <p className="flex items-center gap-2 font-semibold text-brand-strong"><CheckCircle2 className="size-5" /> {ids.length} {label} saved as drafts</p>
      <p className="text-sm text-muted">Drafts don't change any report yet. Look them over, then post them all at once or one by one.</p>
      {done === null ? <div className="grid grid-cols-2 gap-3"><Link href="/journal?status=draft"><Button variant="secondary" className="w-full">Review drafts</Button></Link><Button loading={busy} onClick={postAll}>Post all {ids.length}</Button></div>
        : <p className="text-sm font-semibold text-income">{done} posted. <Link href="/journal" className="underline">Open the journal</Link></p>}
    </Card>
  );
}

function PlatformImporter({ source }: { source: "lensly" | "ledgerly" }) {
  const { org, call } = useOrg();
  const cur = org!.base_currency, dp = org!.decimal_places;
  const toast = useToast();
  const qc = useQueryClient();
  const { money: moneyAccts, byType } = useAccounts();
  const lens = source === "lensly";
  const list = useOrgQuery<SourceReport[]>(["src", source], lens ? "/integrations/lensly/reports" : "/integrations/ledgerly/books");
  const [sel, setSel] = useState<string | null>(null);
  const pv = useOrgQuery<SourcePreview>(["src-preview", source, sel], `/integrations/${source}/${lens ? "reports" : "books"}/${sel}/preview`, undefined, !!sel);
  const [bank, setBank] = useState("");
  const [inc, setInc] = useState("");
  const [exp, setExp] = useState("");
  const [map, setMap] = useState<Record<string, string>>({});
  const [onlyReviewed, setOnlyReviewed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<PlatformImportResult | null>(null);

  const rows = pv.data?.rows ?? [];
  const todo = rows.filter((r) => !r.already_imported && (!lens || !onlyReviewed || r.reviewed)).length;
  const bankId = bank || moneyAccts.find((a) => a.account_subtype === "bank")?.id || moneyAccts[0]?.id || "";
  const incId = inc || byType("revenue")[0]?.id || "";
  const expId = exp || byType("expense").find((a) => a.account_subtype === "operating_expenses")?.id || byType("expense")[0]?.id || "";
  const mismatch = pv.data?.currency && pv.data.currency !== cur;

  const run = async () => {
    setBusy(true); setErr(null);
    try {
      const category_map = Object.fromEntries(Object.entries(map).filter(([, v]) => v));
      const r = await call<PlatformImportResult>("/integrations/import", { json: { source, source_ref: sel, bank_account_id: bankId, default_income_account_id: incId, default_expense_account_id: expId, category_map, only_reviewed: onlyReviewed } });
      setRes(r); await qc.invalidateQueries(); toast(`${r.created} drafts created.`);
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };

  if (list.error) return <ErrorState message={(list.error as Error).message} retry={() => list.refetch()} />;
  if (list.isLoading) return <Skeleton className="h-32" />;
  if ((list.data?.length ?? 0) === 0) return <Card><EmptyState title={lens ? "No Lensly reports yet" : "No CashBooks yet"} body={lens ? "Upload and review a bank statement in Lensly, then come back to turn it into entries here." : "Create a CashBook in Ledgerly and add some transactions, then import them here."} /></Card>;

  return (
    <div className="space-y-4">
      <ul className="space-y-2">{list.data!.map((r) => (
        <li key={r.id}><button onClick={() => { setSel(r.id); setRes(null); setMap({}); }} className={cx("tap flex w-full items-center gap-3 rounded-2xl border bg-surface p-3.5 text-left transition", sel === r.id ? "border-brand ring-2 ring-brand/30" : "border-border hover:bg-surface-muted")}>
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand-strong"><Layers className="size-5" /></span>
          <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{r.name}</span><span className="text-xs text-muted">{r.period_start ? `${fmtDate(r.period_start)} to ${fmtDate(r.period_end!)} · ` : ""}{r.transactions} transactions{lens ? `, ${r.reviewed} reviewed` : ""}</span></span>
          {r.already_imported > 0 && <Badge tone="muted">{r.already_imported} imported</Badge>}</button></li>))}</ul>

      {sel && (pv.isLoading ? <Skeleton className="h-48" /> : pv.error ? <ErrorState message={(pv.error as Error).message} /> : pv.data && (
        <Card className="space-y-4 p-4">
          <h2 className="font-display text-lg font-semibold">Where should it go?</h2>
          {mismatch && <p role="alert" className="flex gap-2 rounded-2xl bg-expense-soft p-3 text-sm text-expense"><TriangleAlert className="size-5 shrink-0" /> This source is in {pv.data.currency} but your organization uses {cur}, so it can't be imported.</p>}
          <Field label="Bank or cash account">{(id) => <Select id={id} value={bankId} onChange={(e) => setBank(e.target.value)}>{moneyAccts.map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}</Select>}</Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Other money in goes to">{(id) => <Select id={id} value={incId} onChange={(e) => setInc(e.target.value)}>{byType("revenue").map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}</Select>}</Field>
            <Field label="Other money out goes to">{(id) => <Select id={id} value={expId} onChange={(e) => setExp(e.target.value)}>{byType("expense").map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}</Select>}</Field>
          </div>
          <div><p className="mb-1 text-sm font-semibold">Match categories to accounts <span className="font-normal text-muted">(optional)</span></p>
            <ul className="space-y-2">{pv.data.categories.map((c) => (
              <li key={c} className="grid grid-cols-[1fr_1.4fr] items-center gap-3"><span className="truncate text-sm">{c}</span>
                <Select aria-label={`Account for ${c}`} value={map[c] ?? ""} onChange={(e) => setMap({ ...map, [c]: e.target.value })} className="!h-10 text-sm"><option value="">Use the default</option>{[...byType("expense"), ...byType("revenue")].map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}</Select></li>))}</ul></div>
          {lens && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyReviewed} onChange={(e) => setOnlyReviewed(e.target.checked)} className="size-4 accent-[var(--brand)]" /> Only rows I reviewed in Lensly</label>}
          <div className="max-h-56 overflow-y-auto rounded-2xl border border-border"><ul className="divide-y divide-border">{rows.slice(0, 60).map((r) => (
            <li key={r.source_id} className={cx("flex items-center gap-3 px-3 py-2 text-sm", r.already_imported && "opacity-50")}><span className="w-16 shrink-0 text-xs text-muted">{fmtDate(r.date).replace(/ \d{4}$/, "")}</span><span className="min-w-0 flex-1 truncate">{r.description}</span><span className={cx("num shrink-0 font-semibold", Number(r.amount) < 0 ? "text-expense" : "text-income")}>{money(r.amount, cur, dp)}</span></li>))}</ul></div>
          <p className="text-sm text-muted">{todo} of {rows.length} rows will be imported{rows.length > 60 ? " (first 60 shown)" : ""}. Rows imported before are skipped.</p>
          {err && <p role="alert" className="rounded-2xl bg-expense-soft p-3 text-sm text-expense">{err}</p>}
          <Button size="lg" className="w-full" loading={busy} disabled={todo === 0 || !!mismatch || !bankId || !incId || !expId} onClick={run}>Create {todo} draft{todo === 1 ? "" : "s"}</Button>
        </Card>
      ))}
      {res && (<>
        <AfterImport ids={res.entry_ids} label="entries" />
        {(res.skipped_existing > 0 || res.skipped_unreviewed > 0) && <p className="text-sm text-muted">{res.skipped_existing} already imported, {res.skipped_unreviewed} not reviewed.</p>}
        {res.errors.length > 0 && <Card className="p-4 text-sm text-expense"><p className="font-semibold">{res.errors.length} row(s) could not be imported</p><ul className="mt-1 list-disc pl-5">{res.errors.slice(0, 8).map((e) => <li key={e.source_id}>{e.message}</li>)}</ul></Card>}
      </>)}
    </div>
  );
}

const SAMPLE = "Date,Voucher No,Ledger,Debit,Credit,Narration\n2026-04-01,V1,Bank Account,5000,,Owner capital\n,,Owner's Capital,,5000,\n2026-04-03,V2,Rent,1200,,April rent\n,,Bank Account,,1200,\n";

function FileImport() {
  const { call } = useOrg();
  const qc = useQueryClient();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; type: "csv" | "xlsx"; text?: string; b64?: string } | null>(null);
  const [fmt, setFmt] = useState("auto");
  const [pre, setPre] = useState<JournalImportResult | null>(null);
  const [res, setRes] = useState<JournalImportResult | null>(null);
  const [busy, setBusy] = useState<null | "preview" | "import">(null);
  const [err, setErr] = useState<string | null>(null);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setPre(null); setRes(null); setErr(null);
    if (f.size > 5_000_000) return setErr("That file is larger than 5 MB. Split it into parts.");
    if (/\.xlsx$/i.test(f.name)) {
      const buf = new Uint8Array(await f.arrayBuffer());
      let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      setFile({ name: f.name, type: "xlsx", b64: btoa(bin) });
    } else setFile({ name: f.name, type: "csv", text: await f.text() });
  };
  const send = async (dry: boolean) => {
    if (!file) return;
    setBusy(dry ? "preview" : "import"); setErr(null);
    try {
      const r = await call<JournalImportResult>("/journal-entries/import-file", { json: { file_type: file.type, content_text: file.text, content_base64: file.b64, date_format: fmt, dry_run: dry } });
      if (dry) setPre(r); else { setRes(r); await qc.invalidateQueries(); toast(`${r.created} drafts created.`); }
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <p className="text-sm text-muted">Use an Excel (.xlsx) or CSV file with the columns <b>Date</b>, <b>Voucher No</b> (optional), <b>Ledger</b> (an account name or code), <b>Debit</b>, <b>Credit</b> and <b>Narration</b> (optional). A Tally-style day book works too. Each entry must balance.</p>
        <a download="ledgerline-sample.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE)}`} className="text-sm font-semibold text-brand-strong underline">Download a sample file</a>
        <input ref={input} type="file" accept=".csv,.xlsx,text/csv" className="sr-only" aria-label="Choose a file to import" onChange={(e) => pick(e.target.files?.[0])} />
        <Button variant="secondary" className="w-full" onClick={() => input.current?.click()}><FileUp className="size-4" /> {file?.name ?? "Choose a file"}</Button>
        <Field label="Date format">{(id) => <Select id={id} value={fmt} onChange={(e) => { setFmt(e.target.value); setPre(null); }}><option value="auto">Automatic (2026-04-30 or 30/04/2026)</option><option value="dmy">Day / month / year</option><option value="mdy">Month / day / year</option><option value="ymd">Year-month-day</option></Select>}</Field>
        {err && <p role="alert" className="rounded-2xl bg-expense-soft p-3 text-sm text-expense">{err}</p>}
        <Button size="lg" className="w-full" loading={busy === "preview"} disabled={!file || !!busy} onClick={() => send(true)}>Check the file</Button>
      </Card>
      {pre && (
        <Card className="space-y-3 p-4">
          <p className={cx("flex items-center gap-2 font-semibold", pre.errors.length ? "text-expense" : "text-brand-strong")}>{pre.errors.length ? <TriangleAlert className="size-5" /> : <CheckCircle2 className="size-5" />}{pre.entries.length} entr{pre.entries.length === 1 ? "y" : "ies"} found{pre.errors.length ? `, ${pre.errors.length} problem${pre.errors.length === 1 ? "" : "s"}` : ", all balanced"}</p>
          {pre.errors.length > 0 && <ul className="max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 text-sm text-expense">{pre.errors.slice(0, 20).map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}</ul>}
          <ul className="divide-y divide-border">{pre.entries.slice(0, 8).map((e, i) => <li key={i} className="flex justify-between gap-3 py-2 text-sm"><span className="truncate">{fmtDate(e.entry_date)} · {e.description || e.reference || `${e.lines} lines`}</span><span className="num font-semibold">{e.total}</span></li>)}</ul>
          {pre.entries.length > 8 && <p className="text-xs text-muted">and {pre.entries.length - 8} more.</p>}
          <Button size="lg" className="w-full" loading={busy === "import"} disabled={pre.errors.length > 0 || pre.entries.length === 0 || !!busy} onClick={() => send(false)}>{pre.errors.length ? "Fix the file to continue" : `Import ${pre.entries.length} as drafts`}</Button>
          <p className="text-xs text-muted">Nothing is saved unless every entry is correct.</p>
        </Card>
      )}
      {res && <AfterImport ids={res.entry_ids} label="entries" />}
    </div>
  );
}
