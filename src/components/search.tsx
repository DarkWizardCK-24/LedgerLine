"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpen, ListTree, Search as SearchIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fmtDate } from "@/lib/dates";
import { useOrg } from "@/lib/org";
import type { Account, Entry, Page } from "@/lib/types";
import { Input, Sheet } from "./ui";

/** Global search over accounts and journal entries. Opens with the search button or Ctrl/Cmd+K. */
export function SearchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { call, org } = useOrg();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebounced(term.trim()), 250); return () => clearTimeout(t); }, [term]);
  useEffect(() => { if (!open) setTerm(""); }, [open]);

  const accounts = useQuery({ queryKey: ["search-acc", org?.id, debounced], enabled: open && debounced.length > 0, queryFn: () => call<Page<Account>>("/accounts", { query: { q: debounced, page_size: "6" } }) });
  const entries = useQuery({ queryKey: ["search-je", org?.id, debounced], enabled: open && debounced.length > 0, queryFn: () => call<Page<Entry>>("/journal-entries", { query: { q: debounced, page_size: "6" } }) });
  const none = debounced && !accounts.isLoading && !entries.isLoading && !accounts.data?.items.length && !entries.data?.items.length;

  return (
    <Sheet open={open} onClose={onClose} title="Search">
      <div className="space-y-4 pb-3">
        <div className="relative"><SearchIcon className="pointer-events-none absolute left-4 top-3.5 size-5 text-muted" />
          <Input autoFocus aria-label="Search accounts and entries" placeholder="Account, description, reference or JE-000012" className="pl-12" value={term} onChange={(e) => setTerm(e.target.value)} /></div>
        {!debounced && <p className="text-sm text-muted">Find an account by name or code, or a journal entry by description, reference or number.</p>}
        {none && <p className="text-sm text-muted">Nothing matches &ldquo;{debounced}&rdquo;.</p>}
        {!!accounts.data?.items.length && (
          <div><p className="mb-1 text-xs font-bold uppercase tracking-widest text-muted">Accounts</p>
            <ul className="space-y-1">{accounts.data.items.map((a) => (
              <li key={a.id}><Link onClick={onClose} href={`/ledger?account=${a.id}`} className="tap flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-muted"><ListTree className="size-5 text-brand" /><span className="num text-sm text-muted">{a.account_code}</span><span className="truncate font-semibold">{a.account_name}</span></Link></li>))}</ul></div>
        )}
        {!!entries.data?.items.length && (
          <div><p className="mb-1 text-xs font-bold uppercase tracking-widest text-muted">Journal entries</p>
            <ul className="space-y-1">{entries.data.items.map((e) => (
              <li key={e.id}><Link onClick={onClose} href={`/journal/${e.id}`} className="tap flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-muted"><BookOpen className="size-5 text-brand" /><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{e.description || "Journal entry"}</span><span className="text-xs text-muted">{e.display_number} · {fmtDate(e.entry_date)}</span></span></Link></li>))}</ul></div>
        )}
      </div>
    </Sheet>
  );
}

export function useSearchShortcut(onOpen: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); onOpen(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onOpen]);
}
