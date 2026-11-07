"use client";

import { useMemo } from "react";
import { useOrgQuery } from "./org";
import type { Account, Page } from "./types";

export const MONEY_SUBTYPES = ["cash", "bank", "credit_card"];

/** Every active account of the organization, plus the groupings the simple forms need. */
export function useAccounts() {
  const q = useOrgQuery<Page<Account>>(["accounts-active"], "/accounts", { page_size: "200", active: "true" });
  const accounts = useMemo(() => q.data?.items ?? [], [q.data]);
  return useMemo(() => ({
    accounts,
    loading: q.isLoading,
    money: accounts.filter((a) => MONEY_SUBTYPES.includes(a.account_subtype)),
    byType: (...types: string[]) => accounts.filter((a) => types.includes(a.account_type)),
  }), [accounts, q.isLoading]);
}

export const kindLabel = { money_in: "Money in", money_out: "Money out", transfer: "Transfer", journal: "Journal" } as const;
