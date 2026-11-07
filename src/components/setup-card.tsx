"use client";

import { CheckCircle2, ChevronRight, Circle, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useOrg, useOrgQuery } from "@/lib/org";
import type { SetupStatus } from "@/lib/types";
import { Card } from "./ui";

/** First-run checklist on the dashboard. It disappears once the essentials are done, or when dismissed. */
export function SetupCard() {
  const { org } = useOrg();
  const q = useOrgQuery<SetupStatus>(["setup-status"], "/accounting/setup-status");
  const key = `ll_setup_dismissed_${org?.id}`;
  const [hidden, setHidden] = useState(true);
  useEffect(() => { try { setHidden(localStorage.getItem(key) === "1"); } catch { setHidden(false); } }, [key]);
  const s = q.data;
  if (!s || hidden || s.done_count === s.total) return null;
  const pct = Math.round((s.done_count / s.total) * 100);
  return (
    <Card className="overflow-hidden anim-rise">
      <div className="flex items-start justify-between gap-3 bg-brand-gradient p-4 text-white">
        <div><p className="font-display text-lg font-semibold">{s.complete ? "Nicely done, a few optional extras" : "Get set up in a few minutes"}</p>
          <p className="text-sm text-white/80">{s.done_count} of {s.total} done</p>
          <div className="mt-2 h-2 w-48 max-w-full overflow-hidden rounded-full bg-white/25" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-[#ffe08a]" style={{ width: `${pct}%` }} /></div></div>
        <button onClick={() => { try { localStorage.setItem(key, "1"); } catch { /* ignore */ } setHidden(true); }} aria-label="Hide the setup checklist" className="tap grid place-items-center rounded-full text-white/80 hover:bg-white/15"><X className="size-5" /></button>
      </div>
      <ul className="divide-y divide-border">
        {s.steps.map((st) => (
          <li key={st.key}>
            <Link href={st.href} className="tap flex items-center gap-3 px-4 py-3 hover:bg-surface-muted">
              {st.done ? <CheckCircle2 className="size-6 shrink-0 text-income" /> : <Circle className="size-6 shrink-0 text-muted" />}
              <span className="min-w-0 flex-1"><span className={`block text-sm font-semibold ${st.done ? "text-muted line-through" : ""}`}>{st.title}{!st.required && !st.done && <span className="ml-2 text-xs font-normal text-muted">optional</span>}</span>{!st.done && <span className="block text-xs text-muted">{st.hint}</span>}</span>
              {!st.done && <ChevronRight className="size-5 shrink-0 text-muted" />}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
