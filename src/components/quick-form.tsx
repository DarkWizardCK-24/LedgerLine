"use client";

import { useQueryClient } from "@tanstack/react-query";
import { History, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { today } from "@/lib/dates";
import { useAccounts } from "@/lib/hooks";
import { money, toMinor } from "@/lib/money";
import { errorMessage, useOrg, useOrgQuery } from "@/lib/org";
import type { Account, QuickKind, QuickResult, RecentSimple, Template } from "@/lib/types";
import { Hint, GLOSSARY } from "./hint";
import { ReceiptPicker, useUploadReceipts } from "./receipts";
import { Button, Chips, Field, Input, Select, cx, useToast } from "./ui";

const COPY: Record<QuickKind, { from: string; what: string; button: string; done: string; hint: string }> = {
  money_in: { from: "Received into", what: "What was it for?", button: "Record money in", done: "Money in recorded.", hint: "Sales, payments from customers, a loan received, money the owner put in." },
  money_out: { from: "Paid from", what: "What was it for?", button: "Record money out", done: "Money out recorded.", hint: "Rent, salaries, supplies, a purchase, a loan repayment, money the owner took out." },
  transfer: { from: "From", what: "To", button: "Record transfer", done: "Transfer recorded.", hint: "Moving money between your own accounts, such as bank to cash." },
};
const TYPE_LABEL: Record<string, string> = { revenue: "Income", expense: "Expenses", asset: "Things you own", liability: "Loans and bills", equity: "Owner's money" };

function Options({ groups }: { groups: [string, Account[]][] }) {
  return <>{groups.filter(([, l]) => l.length).map(([t, list]) => <optgroup key={t} label={TYPE_LABEL[t] ?? t}>{list.map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}</optgroup>)}</>;
}

export function QuickForm({ initialKind = "money_out", onDone, compact }: { initialKind?: QuickKind; onDone?: (r: QuickResult) => void; compact?: boolean }) {
  const { org, call } = useOrg();
  const dp = org!.decimal_places, cur = org!.base_currency;
  const qc = useQueryClient();
  const toast = useToast();
  const { accounts, money: moneyAccts, byType } = useAccounts();
  const upload = useUploadReceipts();
  const templates = useOrgQuery<Template[]>(["templates-quick"], "/templates", { recurring: "false" });
  const recent = useOrgQuery<RecentSimple[]>(["recent-simple"], "/accounting/recent-simple", { limit: "5" });

  const [kind, setKind] = useState<QuickKind>(initialKind);
  const [amount, setAmount] = useState("");
  const [paid, setPaid] = useState("");
  const [other, setOther] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [post, setPost] = useState(true);
  const [saveName, setSaveName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (!paid && moneyAccts.length) setPaid((moneyAccts.find((a) => a.account_subtype === "bank") ?? moneyAccts[0]).id); }, [moneyAccts, paid]);
  const pickKind = (k: QuickKind) => { setKind(k); setOther(""); };  // a different kind needs a different "what for" list

  const otherGroups = useMemo<[string, Account[]][]>(() => {
    if (kind === "transfer") return [["asset", moneyAccts.filter((a) => a.id !== paid)]];
    const notMoney = (list: Account[]) => list.filter((a) => !moneyAccts.some((m) => m.id === a.id));
    return kind === "money_in"
      ? [["revenue", byType("revenue")], ["liability", notMoney(byType("liability"))], ["equity", byType("equity")], ["asset", notMoney(byType("asset"))]]
      : [["expense", byType("expense")], ["asset", notMoney(byType("asset"))], ["liability", notMoney(byType("liability"))], ["equity", byType("equity")]];
  }, [kind, moneyAccts, byType, paid]);

  const minor = toMinor(amount, dp);
  const valid = minor !== null && minor > 0n && !!paid && !!other && paid !== other;
  const tplHere = (templates.data ?? []).filter((t) => t.kind === kind);

  const fromTemplate = (t: Template) => {
    const d = t.lines.find((l) => Number(l.debit_amount) > 0), c = t.lines.find((l) => Number(l.credit_amount) > 0);
    if (!d || !c || t.kind === "journal") return;
    setKind(t.kind); setAmount(t.total); setNote(t.description);
    if (t.kind === "money_in") { setPaid(d.account_id); setOther(c.account_id); } else if (t.kind === "money_out") { setOther(d.account_id); setPaid(c.account_id); } else { setPaid(c.account_id); setOther(d.account_id); }
  };
  const repeat = (r: RecentSimple) => { setKind(r.kind); setAmount(r.amount); setPaid(r.paid_account_id); setOther(r.other_account_id); setNote(r.description); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await call<QuickResult>("/journal-entries/quick", { json: {
        kind, entry_date: date, amount: amount.trim(), paid_account_id: paid, other_account_id: other, description: note, post, save_as_template: saveName.trim() || null } });
      if (files.length) { const bad = await upload(res.entry.id, files); if (bad) toast(`Saved, but a receipt failed: ${bad}`, "error"); }
      await qc.invalidateQueries();
      toast(res.status === "posted" ? COPY[kind].done : res.status === "pending_approval" ? "Sent for approval." : "Saved as a draft.");
      setAmount(""); setNote(""); setFiles([]); setSaveName("");
      onDone?.(res);
    } catch (x) { setErr(errorMessage(x)); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Chips value={kind} onChange={pickKind} options={[{ value: "money_in", label: "Money in" }, { value: "money_out", label: "Money out" }, { value: "transfer", label: "Transfer" }]} />
      <p className="text-sm text-muted">{COPY[kind].hint}</p>

      {(tplHere.length > 0 || (recent.data?.length ?? 0) > 0) && (
        <div className="space-y-2">
          {tplHere.length > 0 && <div className="flex flex-wrap gap-2">{tplHere.slice(0, 6).map((t) => <button type="button" key={t.id} onClick={() => fromTemplate(t)} className="tap inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-sm font-semibold hover:bg-brand-soft"><Sparkles className="size-4 text-gold" />{t.name}</button>)}</div>}
          {(recent.data?.length ?? 0) > 0 && <div className="scroll-hide -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">{recent.data!.map((r) => <button type="button" key={r.entry_id} onClick={() => repeat(r)} className="tap inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-muted px-3 text-sm hover:bg-brand-soft"><History className="size-4 text-brand" />Repeat: {r.description || r.other_account_name} · {money(r.amount, cur, dp)}</button>)}</div>}
        </div>
      )}

      <Field label="Amount">
        {(id) => (
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl font-semibold text-muted">{cur === "INR" ? "₹" : cur}</span>
            <Input id={id} inputMode="decimal" autoFocus placeholder={dp ? `0.${"0".repeat(dp)}` : "0"} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              className={cx("num !h-16 text-right !text-3xl font-semibold", cur === "INR" ? "pl-10" : "pl-16")} />
          </div>
        )}
      </Field>
      {amount && minor === null && <p role="alert" className="-mt-2 text-sm text-expense">At most {dp} decimal places.</p>}

      <Field label={COPY[kind].from}>{(id) => <Select id={id} value={paid} onChange={(e) => setPaid(e.target.value)}><Options groups={[["asset", moneyAccts.filter((a) => a.account_type === "asset")], ["liability", moneyAccts.filter((a) => a.account_type === "liability")]]} /></Select>}</Field>
      <Field label={COPY[kind].what}>{(id) => <Select id={id} value={other} onChange={(e) => setOther(e.target.value)}><option value="">Choose…</option><Options groups={otherGroups} /></Select>}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">{(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Field label="Note">{(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" maxLength={500} />}</Field>
      </div>

      {!compact && (
        <>
          <div><p className="mb-1.5 text-sm font-semibold">Receipt</p><ReceiptPicker files={files} onChange={setFiles} /></div>
          <Field label="Save as a shortcut" hint="Next time, one tap fills this in.">{(id) => <Input id={id} value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="e.g. Monthly rent" maxLength={80} />}</Field>
        </>
      )}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={post} onChange={(e) => setPost(e.target.checked)} className="size-4 accent-[var(--brand)]" /> Record it now <Hint label="draft">{GLOSSARY.draft}</Hint></label>
      {err && <p role="alert" className="rounded-2xl bg-expense-soft p-3 text-sm text-expense">{err}</p>}
      <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!valid}>{post ? COPY[kind].button : "Save as draft"}</Button>
      <p className="text-center text-xs text-muted">Behind the scenes this makes a balanced entry. <Link href="/journal/new" className="font-semibold text-brand-strong">Need full control? Use the journal.</Link></p>
    </form>
  );
}
