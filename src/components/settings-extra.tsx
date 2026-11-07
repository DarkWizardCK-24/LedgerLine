"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Mail, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { fmtDate, fyStart } from "@/lib/dates";
import { money } from "@/lib/money";
import { errorMessage, useOrg, useOrgQuery } from "@/lib/org";
import type { ApprovalMode, Capabilities, Schedule, YearEndPreview } from "@/lib/types";
import { Hint, GLOSSARY } from "./hint";
import { Badge, Button, Card, ConfirmSheet, Field, Input, Select, Sheet, Skeleton, useToast } from "./ui";

const MODES: [ApprovalMode, string, string][] = [
  ["off", "Off", "Anyone who can record entries can post them."],
  ["different_user", "A second person approves", "Whoever created an entry can't post it. Owners are exempt."],
  ["admin_only", "Admins approve everything", "Only admins and owners can post."],
];

export function ApprovalSettings() {
  const { call } = useOrg();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useOrgQuery<{ approval_mode: ApprovalMode }>(["settings"], "/accounting/settings");
  const mode = q.data?.approval_mode;
  const set = async (m: ApprovalMode) => { try { await call("/accounting/settings", { method: "PATCH", json: { approval_mode: m } }); await qc.invalidateQueries(); toast("Approval setting saved."); } catch (e) { toast(errorMessage(e), "error"); } };
  return (
    <section>
      <h2 className="mb-2 px-1 font-display text-xl font-semibold">Approvals <Hint label="what is this?">{GLOSSARY.approval}</Hint></h2>
      <Card className="space-y-3 p-4">
        {!mode ? <Skeleton className="h-12" /> : (
          <Field label="Who can post entries?" hint={MODES.find((m) => m[0] === mode)?.[2]}>
            {(id) => <Select id={id} value={mode} onChange={(e) => set(e.target.value as ApprovalMode)}>{MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>}
          </Field>
        )}
      </Card>
    </section>
  );
}

const REPORTS: Record<string, string> = { trial_balance: "Trial balance", profit_loss: "Profit & loss", balance_sheet: "Balance sheet" };

export function ScheduledReports() {
  const { call } = useOrg();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useOrgQuery<Schedule[]>(["schedules"], "/report-schedules");
  const caps = useOrgQuery<Capabilities>(["capabilities"], "/accounting/capabilities");
  const tomorrow = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }, []);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ report: "profit_loss", freq: "monthly", to: "", next: tomorrow });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const emails = f.to.split(/[,\s;]+/).filter(Boolean);
  const refresh = () => qc.invalidateQueries();

  const create = async () => {
    setBusy(true); setErr(null);
    try { await call("/report-schedules", { json: { report_type: f.report, frequency: f.freq, recipients: emails, next_run_date: f.next } }); await refresh(); toast("Schedule saved."); setOpen(false); setF({ ...f, to: "" }); }
    catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };
  const sendDue = async () => {
    try { const r = await call<{ ran: number }>("/report-schedules/run-due", { method: "POST" }); await refresh(); toast(r.ran ? `${r.ran} report${r.ran > 1 ? "s" : ""} sent.` : "Nothing is due yet."); } catch (e) { toast(errorMessage(e), "error"); }
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1"><h2 className="font-display text-xl font-semibold">Reports by e-mail</h2><Button size="sm" variant="secondary" onClick={() => setOpen(true)}><Plus className="size-4" /> Add</Button></div>
      <Card className="divide-y divide-border overflow-hidden">
        {caps.data && !caps.data.email_configured && <p className="bg-gold-soft p-3 text-sm text-warning">E-mail isn&apos;t set up on the server yet, so reports can&apos;t be sent. Ask whoever runs the server to configure SMTP.</p>}
        {q.isLoading ? <div className="p-4"><Skeleton className="h-12" /></div> : (q.data?.length ?? 0) === 0 ? <p className="p-5 text-sm text-muted">No scheduled reports. Add one to have a PDF sent to your accountant every week or month.</p> : q.data!.map((s) => (
          <div key={s.id} className="flex items-center gap-3 px-4 py-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong"><Mail className="size-5" /></span>
            <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{REPORTS[s.report_type]} · {s.frequency}</span><span className="block truncate text-xs text-muted">to {s.recipients.join(", ")} · next {fmtDate(s.next_run_date)}</span></span>
            <button aria-label="Delete schedule" onClick={async () => { await call(`/report-schedules/${s.id}`, { method: "DELETE" }); await refresh(); toast("Removed."); }} className="tap grid place-items-center rounded-xl text-muted hover:bg-expense-soft hover:text-expense"><Trash2 className="size-5" /></button>
          </div>
        ))}
      </Card>
      {(q.data?.length ?? 0) > 0 && caps.data?.email_configured && <Button variant="ghost" size="sm" className="mt-2" onClick={sendDue}>Send anything that is due now</Button>}
      <Sheet open={open} onClose={() => setOpen(false)} title="E-mail a report" footer={<Button size="lg" className="w-full" loading={busy} disabled={emails.length === 0} onClick={create}>Save schedule</Button>}>
        <div className="space-y-4 pb-2">
          <Field label="Report">{(id) => <Select id={id} value={f.report} onChange={(e) => setF({ ...f, report: e.target.value })}>{Object.entries(REPORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="How often">{(id) => <Select id={id} value={f.freq} onChange={(e) => setF({ ...f, freq: e.target.value })}><option value="weekly">Every week</option><option value="monthly">Every month</option></Select>}</Field>
            <Field label="First one">{(id) => <Input id={id} type="date" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />}</Field>
          </div>
          <Field label="Send to" hint="One or more e-mail addresses, separated by commas.">{(id) => <Input id={id} type="email" multiple inputMode="email" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} placeholder="accountant@example.com" />}</Field>
          {err && <p role="alert" className="rounded-2xl bg-expense-soft p-3 text-sm text-expense">{err}</p>}
        </div>
      </Sheet>
    </section>
  );
}

export function YearEndClose() {
  const { org, call } = useOrg();
  const cur = org!.base_currency, dp = org!.decimal_places;
  const qc = useQueryClient();
  const toast = useToast();
  const prevYear = useMemo(() => { const d = new Date(fyStart(org!.financial_year_start) + "T00:00:00"); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }, [org]);
  const [on, setOn] = useState(prevYear);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const q = useOrgQuery<YearEndPreview>(["year-end", on], "/accounting/year-end/preview", { on });
  const d = q.data;
  const close = async () => {
    setBusy(true);
    try { await call("/accounting/year-end", { json: { fiscal_year_end: on } }); await qc.invalidateQueries(); toast("Year closed. The profit moved to retained earnings."); setConfirm(false); }
    catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };
  return (
    <section>
      <h2 className="mb-2 px-1 font-display text-xl font-semibold">Close a financial year <Hint label="what happens?">{GLOSSARY.yearEnd}</Hint></h2>
      <Card className="space-y-3 p-4">
        <Field label="The year that includes">{(id) => <Input id={id} type="date" value={on} onChange={(e) => setOn(e.target.value)} />}</Field>
        {q.isLoading || !d ? <Skeleton className="h-20" /> : (
          <>
            <p className="text-sm text-muted">{fmtDate(d.fiscal_year_start)} to {fmtDate(d.fiscal_year_end)}</p>
            <div className="grid grid-cols-3 gap-2 text-center text-sm"><div className="rounded-2xl bg-surface-muted p-2.5"><p className="text-xs text-muted">Income</p><p className="num font-bold">{money(d.total_income, cur, dp)}</p></div><div className="rounded-2xl bg-surface-muted p-2.5"><p className="text-xs text-muted">Expenses</p><p className="num font-bold">{money(d.total_expenses, cur, dp)}</p></div><div className="rounded-2xl bg-brand-soft p-2.5"><p className="text-xs text-brand-strong">Profit</p><p className="num font-bold text-brand-strong">{money(d.net_profit, cur, dp)}</p></div></div>
            {d.blockers.length > 0 && <ul className="space-y-1 rounded-2xl bg-gold-soft p-3 text-sm text-warning">{d.blockers.map((b) => <li key={b}>{b}</li>)}</ul>}
            <Button className="w-full" disabled={!d.can_close} onClick={() => setConfirm(true)}><CalendarCheck className="size-5" /> Close this year</Button>
            {d.already_closed && <Badge tone="brand">already closed</Badge>}
          </>
        )}
      </Card>
      <ConfirmSheet open={confirm} title="Close this financial year?" body={`${d ? money(d.net_profit, cur, dp) : ""} of profit moves into retained earnings and the year is locked. To undo it, reopen the period and reverse the closing entry.`} confirmLabel="Close the year" busy={busy} onClose={() => setConfirm(false)} onConfirm={close} />
    </section>
  );
}
