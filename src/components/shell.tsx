"use client";

import { ArrowLeftRight, BookOpen, CalendarClock, Check, ChevronsUpDown, FileBarChart, FileInput, FileText, History, Home, ListTree, LogOut, MoreHorizontal, Plus, ScrollText, Search, Settings, ShieldCheck, Target } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";
import { Logo, Glyph } from "./logo";
import { AddMenu } from "./add-menu";
import { SearchSheet, useSearchShortcut } from "./search";
import { Sheet, cx } from "./ui";

const MAIN = [
  { href: "/", label: "Home", icon: Home },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/ledger", label: "Ledger", icon: ScrollText },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/reconciliation", label: "Reconcile", icon: ArrowLeftRight },
  { href: "/accounts", label: "Accounts", icon: ListTree },
  { href: "/recurring", label: "Recurring", icon: CalendarClock },
  { href: "/budgets", label: "Budgets", icon: Target },
  { href: "/import", label: "Import", icon: FileInput },
  { href: "/approvals", label: "Approvals", icon: ShieldCheck },
  { href: "/audit", label: "Audit", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];
const MORE = MAIN.filter((i) => ["/invoices", "/ledger", "/accounts", "/reconciliation", "/recurring", "/budgets", "/import", "/approvals", "/audit", "/settings"].includes(i.href));

const active = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

function Avatar({ name }: { name: string }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gold-gradient text-sm font-bold text-[#3b2a05]">
      {(name || "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}

function OrgSwitcher({ compact }: { compact?: boolean }) {
  const { orgs, org, setOrg } = useOrg();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  if (!org) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className={cx("tap flex items-center gap-2 rounded-2xl text-left transition hover:bg-surface-muted", compact ? "px-2 py-1" : "w-full border border-border bg-surface px-3 py-2")}>
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand-soft text-sm font-bold text-brand-strong">{org.name.charAt(0).toUpperCase()}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold leading-tight">{org.name}</span>
          {!compact && <span className="block text-xs capitalize text-muted">{org.role} · {org.base_currency}</span>}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Switch organization">
        <ul className="space-y-2 pb-2">
          {orgs.map((o) => (
            <li key={o.id}>
              <button onClick={() => { setOrg(o.id); setOpen(false); router.push("/"); }} className="tap flex w-full items-center gap-3 rounded-2xl border border-border px-4 py-3 text-left hover:bg-surface-muted">
                <span className="grid size-9 place-items-center rounded-xl bg-brand-soft font-bold text-brand-strong">{o.name.charAt(0).toUpperCase()}</span>
                <span className="flex-1"><span className="block font-semibold">{o.name}</span><span className="text-xs capitalize text-muted">{o.role} · {o.base_currency}</span></span>
                {o.id === org.id && <Check className="size-5 text-brand" />}
              </button>
            </li>
          ))}
        </ul>
        <Link href="/settings?new=1" onClick={() => setOpen(false)} className="tap mt-1 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3 text-sm font-semibold text-brand-strong">
          <Plus className="size-4" /> New organization
        </Link>
      </Sheet>
    </>
  );
}

export function AppShell({ children, title }: { children: React.ReactNode; title?: string }) {
  const path = usePathname();
  const { displayName, email, signOut } = useAuth();
  const [more, setMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const { can } = useOrg();
  useSearchShortcut(() => setSearching(true));
  const router = useRouter();
  const moreActive = MORE.some((m) => active(path, m.href));

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-5 border-r border-border bg-surface/80 p-5 backdrop-blur lg:flex">
        <Link href="/" aria-label="Ledgerline home"><Logo tagline /></Link>
        <OrgSwitcher />
        <button onClick={() => setSearching(true)} className="tap flex h-11 items-center gap-3 rounded-2xl border border-border bg-surface px-3 text-sm text-muted transition hover:text-foreground"><Search className="size-5" /> Search<kbd className="ml-auto rounded-md bg-surface-muted px-1.5 py-0.5 text-[11px] font-semibold">Ctrl K</kbd></button>
        <nav className="flex-1 space-y-1" aria-label="Main">
          {MAIN.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={active(path, href) ? "page" : undefined}
              className={cx("flex h-11 items-center gap-3 rounded-2xl px-3 text-[15px] font-semibold transition",
                active(path, href) ? "bg-brand-gradient text-white shadow-[0_8px_18px_-10px_rgb(14_138_91/0.8)]" : "text-muted hover:bg-surface-muted hover:text-foreground")}>
              <Icon className="size-5" />{label}
            </Link>
          ))}
        </nav>
        <button type="button" onClick={() => setAdding(true)} disabled={!can("accountant")} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-gold-gradient font-bold text-[#3b2a05] shadow-[0_10px_22px_-10px_rgb(217_154_27/0.8)] transition hover:brightness-105 disabled:opacity-50">
          <Plus className="size-5" /> Add transaction
        </button>
        <div className="flex items-center gap-3 rounded-2xl border border-border p-2.5">
          <Avatar name={displayName} />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{displayName}</p><p className="truncate text-xs text-muted">{email}</p></div>
          <button onClick={async () => { await signOut(); router.replace("/login"); }} aria-label="Sign out" className="tap grid place-items-center rounded-xl text-muted hover:bg-surface-muted hover:text-expense"><LogOut className="size-5" /></button>
        </div>
      </aside>

      <div className="min-w-0">
        {/* mobile app bar */}
        <header className="pt-safe sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl lg:hidden">
          <div className="flex h-14 items-center gap-2 px-3">
            <Glyph size={32} />
            <div className="min-w-0 flex-1"><OrgSwitcher compact /></div>
            <button onClick={() => setSearching(true)} aria-label="Search" className="tap grid place-items-center rounded-full text-muted hover:bg-surface-muted"><Search className="size-5" /></button>
            <button onClick={() => setMore(true)} aria-label="Account menu"><Avatar name={displayName} /></button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1180px] px-4 pb-[calc(var(--nav-h)+env(safe-area-inset-bottom,0px)+24px)] pt-5 lg:px-8 lg:pb-12 lg:pt-8">
          {title && <h1 className="font-display mb-5 text-[1.75rem] font-semibold leading-tight lg:text-4xl">{title}</h1>}
          {children}
        </main>
      </div>

      {/* mobile bottom tab bar: a real app navigation, thumb-reachable, with a raised "new entry" action */}
      <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/92 backdrop-blur-xl lg:hidden">
        <ul className="mx-auto grid h-[var(--nav-h)] max-w-md grid-cols-5 items-center">
          {[MAIN[0], MAIN[1]].map(({ href, label, icon: Icon }) => (
            <li key={href}><Tab href={href} label={label} Icon={Icon} on={active(path, href)} /></li>
          ))}
          <li className="grid place-items-center">
            {can("accountant") ? (
              <button type="button" onClick={() => setAdding(true)} aria-label="Add a transaction" className="-mt-7 grid size-[58px] place-items-center rounded-full bg-gold-gradient text-[#3b2a05] shadow-[0_12px_24px_-8px_rgb(217_154_27/0.9)] ring-4 ring-background transition active:scale-95">
                <Plus className="size-7" strokeWidth={2.6} />
              </button>
            ) : <span aria-hidden className="size-[58px]" />}
          </li>
          <li><Tab href="/reports" label="Reports" Icon={FileBarChart} on={active(path, "/reports")} /></li>
          <li>
            <button onClick={() => setMore(true)} className={cx("tap flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", moreActive ? "text-brand-strong" : "text-muted")}>
              <MoreHorizontal className="size-6" />More
            </button>
          </li>
        </ul>
      </nav>

      <SearchSheet open={searching} onClose={() => setSearching(false)} />
      <AddMenu open={adding} onClose={() => setAdding(false)} />
      <Sheet open={more} onClose={() => setMore(false)} title="More">
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-surface-muted p-3">
          <Avatar name={displayName} />
          <div className="min-w-0"><p className="truncate font-semibold">{displayName}</p><p className="truncate text-xs text-muted">{email}</p></div>
        </div>
        <ul className="grid gap-2 pb-2">
          {MORE.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} onClick={() => setMore(false)} className="tap flex items-center gap-3 rounded-2xl border border-border px-4 py-3.5 font-semibold hover:bg-surface-muted">
                <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand-strong"><Icon className="size-5" /></span>{label}
              </Link>
            </li>
          ))}
          <li>
            <button onClick={async () => { setMore(false); await signOut(); router.replace("/login"); }} className="tap flex w-full items-center gap-3 rounded-2xl border border-border px-4 py-3.5 text-left font-semibold text-expense hover:bg-expense-soft">
              <span className="grid size-9 place-items-center rounded-xl bg-expense-soft"><LogOut className="size-5" /></span>Sign out
            </button>
          </li>
        </ul>
      </Sheet>
    </div>
  );
}

function Tab({ href, label, Icon, on }: { href: string; label: string; Icon: typeof Home; on: boolean }) {
  return (
    <Link href={href} aria-current={on ? "page" : undefined} className={cx("tap flex h-[var(--nav-h)] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition", on ? "text-brand-strong" : "text-muted")}>
      <span className={cx("grid h-7 w-12 place-items-center rounded-full transition", on && "bg-brand-soft")}><Icon className="size-[22px]" /></span>
      {label}
    </Link>
  );
}
