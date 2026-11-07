"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Lock, LockOpen, Plus, Trash2, UserPlus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { OrgForm } from "@/components/org-form";
import { ApprovalSettings, ScheduledReports, YearEndClose } from "@/components/settings-extra";
import { Title } from "@/components/page";
import { Badge, Button, Card, ConfirmSheet, Field, Input, Select, Sheet, Skeleton, useToast } from "@/components/ui";
import { fmtDate } from "@/lib/dates";
import { errorMessage, useOrg, useOrgQuery } from "@/lib/org";
import type { ExportRow, Member, Period, Role } from "@/lib/types";

const ROLES: Role[] = ["viewer", "accountant", "admin", "owner"];
const ROLE_HELP: Record<Role, string> = { viewer: "Read-only", accountant: "Records and posts entries, reconciles", admin: "Also manages members, periods and settings", owner: "Full control" };

function SettingsView() {
  const { org, can, call, callGlobal, reload } = useOrg();
  const qc = useQueryClient();
  const toast = useToast();
  const params = useSearchParams();
  const [creating, setCreating] = useState(params.get("new") === "1");
  const [name, setName] = useState(org!.name);
  const [legal, setLegal] = useState(org!.legal_name);
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries();
  const guard = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); await refresh(); toast(ok); return true; } catch (e) { toast(errorMessage(e), "error"); return false; } };

  const save = async () => { setBusy(true); await guard(async () => { await call(`/organizations/${org!.id}`, { method: "PATCH", json: { name, legal_name: legal } }); await reload(); }, "Settings saved."); setBusy(false); };

  return (
    <div className="space-y-6">
      <Title sub="Organization, team and accounting periods.">Settings</Title>

      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap gap-2"><Badge tone="brand">{org!.base_currency}</Badge><Badge tone="neutral">{org!.decimal_places} decimals</Badge><Badge tone="gold">Your role: {org!.role}</Badge></div>
        <Field label="Organization name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} disabled={!can("admin")} />}</Field>
        <Field label="Legal name" hint="Printed on exported PDF reports.">{(id) => <Input id={id} value={legal} onChange={(e) => setLegal(e.target.value)} disabled={!can("admin")} />}</Field>
        {can("admin") ? <Button loading={busy} onClick={save}>Save changes</Button> : <p className="text-sm text-muted">Only admins and owners can change these.</p>}
        <p className="text-xs text-muted">Currency and decimal places are locked once journal entries exist.</p>
      </Card>

      {can("admin") && <Members call={call} callGlobal={callGlobal} guard={guard} orgId={org!.id} isOwner={org!.role === "owner"} />}
      <Periods canManage={can("admin")} call={call} guard={guard} />
      {can("admin") && <ApprovalSettings />}
      {can("admin") && <ScheduledReports />}
      {can("admin") && <YearEndClose />}
      {can("accountant") && <Exports />}

      <Button variant="secondary" onClick={() => setCreating(true)}><Plus className="size-4" /> New organization</Button>
      <Sheet open={creating} onClose={() => setCreating(false)} title="New organization"><div className="pb-2"><OrgForm onDone={() => setCreating(false)} /></div></Sheet>
    </div>
  );
}

type Call = <T>(p: string, i?: { method?: string; json?: unknown }) => Promise<T>;
type Guard = (fn: () => Promise<unknown>, ok: string) => Promise<boolean>;

function Members({ call, guard, orgId, isOwner }: { call: Call; callGlobal: Call; guard: Guard; orgId: string; isOwner: boolean }) {
  const q = useOrgQuery<Member[]>(["members"], `/organizations/${orgId}/members`);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("accountant");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [remove, setRemove] = useState<Member | null>(null);
  const grantable = isOwner ? ROLES : ROLES.filter((r) => r === "viewer" || r === "accountant");

  const add = async () => {
    setBusy(true); setErr(null);
    try { const m = await call<Member>(`/organizations/${orgId}/members`, { json: { email, role } }); await guard(async () => {}, m.invited ? "Invitation e-mail sent." : "Member added."); setOpen(false); setEmail(""); }
    catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1"><h2 className="font-display text-xl font-semibold">Team</h2><Button size="sm" variant="secondary" onClick={() => setOpen(true)}><UserPlus className="size-4" /> Add</Button></div>
      <Card className="divide-y divide-border overflow-hidden">
        {q.isLoading ? <div className="p-4"><Skeleton className="h-12" /></div> : q.data?.map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gold-gradient font-bold text-[#3b2a05]">{(m.email ?? m.user_id).charAt(0).toUpperCase()}</span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{m.email ?? `User ${m.user_id.slice(0, 8)}`}</p><p className="text-xs text-muted">{ROLE_HELP[m.role]}</p></div>
            <Select aria-label={`Role for ${m.email ?? m.user_id}`} value={m.role} className="!h-10 !w-32 !px-2 text-sm" disabled={m.role === "owner" && !isOwner}
              onChange={(e) => guard(() => call(`/organizations/${orgId}/members/${m.id}`, { method: "PATCH", json: { role: e.target.value } }), "Role updated.")}>
              {ROLES.filter((r) => grantable.includes(r) || r === m.role).map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
            <button onClick={() => setRemove(m)} aria-label="Remove member" className="tap grid place-items-center rounded-xl text-muted hover:bg-expense-soft hover:text-expense"><Trash2 className="size-5" /></button>
          </div>
        ))}
      </Card>
      <Sheet open={open} onClose={() => setOpen(false)} title="Add a team member" footer={<Button size="lg" className="w-full" loading={busy} disabled={!email.includes("@")} onClick={add}>Add member</Button>}>
        <div className="space-y-4 pb-2">
          <p className="text-sm text-muted">They sign in with the same account used for Ledgerly and Lensly. If they don&apos;t have one yet and your server is set up for it, we e-mail them an invitation.</p>
          <Field label="Email">{(id) => <Input id={id} type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />}</Field>
          <Field label="Role" hint={ROLE_HELP[role]}>{(id) => <Select id={id} value={role} onChange={(e) => setRole(e.target.value as Role)}>{grantable.map((r) => <option key={r} value={r}>{r}</option>)}</Select>}</Field>
          {err && <p role="alert" className="rounded-2xl bg-expense-soft p-3 text-sm text-expense">{err}</p>}
        </div>
      </Sheet>
      <ConfirmSheet open={!!remove} danger title="Remove this member?" body={`${remove?.email ?? "This user"} will lose access to the organization immediately.`} confirmLabel="Remove" onClose={() => setRemove(null)}
        onConfirm={async () => { if (remove && await guard(() => call(`/organizations/${orgId}/members/${remove.id}`, { method: "DELETE" }), "Member removed.")) setRemove(null); }} />
    </section>
  );
}

function Periods({ canManage, call, guard }: { canManage: boolean; call: Call; guard: Guard }) {
  const q = useOrgQuery<Period[]>(["periods"], "/financial-periods");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", start: "", end: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState<Period | null>(null);
  const add = async () => {
    setBusy(true); setErr(null);
    try { await call("/financial-periods", { json: { name: f.name, start_date: f.start, end_date: f.end } }); await guard(async () => {}, "Period created."); setOpen(false); setF({ name: "", start: "", end: "" }); }
    catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1"><h2 className="font-display text-xl font-semibold">Financial periods</h2>{canManage && <Button size="sm" variant="secondary" onClick={() => setOpen(true)}><Plus className="size-4" /> Add</Button>}</div>
      <Card className="divide-y divide-border overflow-hidden">
        {q.isLoading ? <div className="p-4"><Skeleton className="h-12" /></div> : (q.data?.length ?? 0) === 0 ? <p className="p-5 text-sm text-muted">No periods defined. Entries can be posted on any date. Create a period and close it to lock its dates.</p> : q.data?.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
            <span className={`grid size-10 place-items-center rounded-xl ${p.status === "closed" ? "bg-expense-soft text-expense" : "bg-brand-soft text-brand-strong"}`}>{p.status === "closed" ? <Lock className="size-5" /> : <LockOpen className="size-5" />}</span>
            <div className="min-w-0 flex-1"><p className="truncate font-semibold">{p.name}</p><p className="text-xs text-muted">{fmtDate(p.start_date)} to {fmtDate(p.end_date)}</p></div>
            <Badge tone={p.status === "closed" ? "expense" : "brand"}>{p.status}</Badge>
            {canManage && (p.status === "open"
              ? <Button size="sm" variant="secondary" onClick={() => setClosing(p)}>Close</Button>
              : <Button size="sm" variant="secondary" onClick={() => guard(() => call(`/financial-periods/${p.id}/reopen`, { method: "POST" }), "Period reopened.")}>Reopen</Button>)}
          </div>
        ))}
      </Card>
      <Sheet open={open} onClose={() => setOpen(false)} title="New financial period" footer={<Button size="lg" className="w-full" loading={busy} disabled={!f.name || !f.start || !f.end} onClick={add}>Create period</Button>}>
        <div className="space-y-4 pb-2">
          <Field label="Name">{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="April 2026" maxLength={60} />}</Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Starts">{(id) => <Input id={id} type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />}</Field><Field label="Ends">{(id) => <Input id={id} type="date" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} />}</Field></div>
          {err && <p role="alert" className="rounded-2xl bg-expense-soft p-3 text-sm text-expense">{err}</p>}
        </div>
      </Sheet>
      <ConfirmSheet open={!!closing} title={`Close ${closing?.name}?`} body="No entries can be posted or reversed on dates inside a closed period. You can reopen it later; both actions are recorded in the audit trail." confirmLabel="Close period" onClose={() => setClosing(null)}
        onConfirm={async () => { if (closing && await guard(() => call(`/financial-periods/${closing.id}/close`, { method: "POST" }), "Period closed.")) setClosing(null); }} />
    </section>
  );
}

function Exports() {
  const q = useOrgQuery<ExportRow[]>(["exports"], "/exports");
  const NAMES: Record<string, string> = { profit_loss: "Profit & loss", balance_sheet: "Balance sheet", trial_balance: "Trial balance" };
  const label = (t: string) => NAMES[t] ?? t.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  return (
    <section>
      <h2 className="mb-2 px-1 font-display text-xl font-semibold">Export history</h2>
      <Card className="divide-y divide-border overflow-hidden">
        {q.isLoading ? <div className="p-4"><Skeleton className="h-12" /></div> : (q.data?.length ?? 0) === 0 ? <p className="p-5 text-sm text-muted">Nothing exported yet.</p> : q.data?.slice(0, 15).map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"><span className="font-semibold">{label(e.report_type)}</span><span className="flex items-center gap-2 text-xs text-muted"><Badge tone="neutral">{e.export_format.toUpperCase()}</Badge>{new Date(e.created_at).toLocaleString()}</span></div>
        ))}
      </Card>
    </section>
  );
}

export default function SettingsPage() {
  return <Suspense fallback={null}><SettingsView /></Suspense>;
}
