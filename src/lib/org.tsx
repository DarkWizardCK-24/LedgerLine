"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError } from "./api";
import { useAuth } from "./auth";
import type { Org } from "./types";

const ORG_KEY = "ll_org";

type Init = { method?: string; json?: unknown; query?: Record<string, string | undefined>; headers?: Record<string, string> };

type OrgValue = {
  orgs: Org[];
  org: Org | null;
  loading: boolean;
  error: string | null;
  setOrg: (id: string) => void;
  reload: () => Promise<unknown>;
  /** Authenticated call scoped to the active organization. */
  call: <T>(path: string, init?: Init) => Promise<T>;
  /** Authenticated call that is NOT scoped to an organization (list/create organizations). */
  callGlobal: <T>(path: string, init?: Init) => Promise<T>;
  can: (min: "viewer" | "accountant" | "admin" | "owner") => boolean;
};

const Ctx = createContext<OrgValue | null>(null);
const RANK = { viewer: 0, accountant: 1, admin: 2, owner: 3 } as const;

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { getToken, status } = useAuth();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    try { setActiveId(localStorage.getItem(ORG_KEY)); } catch { /* storage unavailable */ }
  }, []);

  const callGlobal = useCallback(async <T,>(path: string, init: Init = {}): Promise<T> => {
    const token = await getToken();
    if (!token) throw new ApiError("unauthorized", "Please sign in again.", 401);
    return apiFetch<T>(token, path, init);
  }, [getToken]);

  const orgsQ = useQuery({
    queryKey: ["orgs"],
    queryFn: () => callGlobal<Org[]>("/organizations"),
    enabled: status === "signedIn",
  });
  const orgs = useMemo(() => orgsQ.data ?? [], [orgsQ.data]);
  const org = useMemo(() => orgs.find((o) => o.id === activeId) ?? orgs[0] ?? null, [orgs, activeId]);

  const setOrg = useCallback((id: string) => {
    setActiveId(id);
    try { localStorage.setItem(ORG_KEY, id); } catch { /* ignore */ }
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "orgs" });
  }, [qc]);

  const call = useCallback(async <T,>(path: string, init: Init = {}): Promise<T> => {
    const token = await getToken();
    if (!token) throw new ApiError("unauthorized", "Please sign in again.", 401);
    if (!org) throw new ApiError("organization_required", "Create an organization first.", 400);
    return apiFetch<T>(token, path, { ...init, org: org.id });
  }, [getToken, org]);

  const value = useMemo<OrgValue>(() => ({
    orgs, org, loading: status === "loading" || orgsQ.isLoading,
    error: orgsQ.error instanceof Error ? orgsQ.error.message : null,
    setOrg, reload: orgsQ.refetch, call, callGlobal,
    can: (min) => (org?.role ? RANK[org.role] >= RANK[min] : false),
  }), [orgs, org, status, orgsQ.isLoading, orgsQ.error, orgsQ.refetch, setOrg, call, callGlobal]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOrg(): OrgValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOrg must be used inside <OrgProvider>");
  return v;
}

/** Query scoped to the active organization; refetches when the organization changes. */
export function useOrgQuery<T>(key: unknown[], path: string, query?: Record<string, string | undefined>, enabled = true) {
  const { call, org } = useOrg();
  return useQuery({
    queryKey: [key[0], org?.id, ...key.slice(1), query ?? null],
    queryFn: () => call<T>(path, { query }),
    enabled: enabled && !!org,
  });
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return e instanceof Error ? e.message : "Something went wrong.";
}
