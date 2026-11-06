export type Role = "owner" | "admin" | "accountant" | "viewer";
export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";
export type EntryStatus = "draft" | "posted" | "reversed";

export type Org = {
  id: string; name: string; legal_name: string; business_type: string; base_currency: string;
  decimal_places: number; financial_year_start: number; timezone: string; role: Role | null;
};
export type Account = {
  id: string; account_code: string; account_name: string; account_type: AccountType; account_subtype: string;
  parent_account_id: string | null; normal_balance: "debit" | "credit"; description: string;
  is_system_account: boolean; is_active: boolean; balance: string | null;
};
export type Line = {
  id: string; account_id: string; account_code: string | null; account_name: string | null;
  description: string; debit_amount: string; credit_amount: string; line_number: number;
};
export type Entry = {
  id: string; entry_number: number | null; display_number: string; entry_date: string; description: string;
  reference_number: string; status: EntryStatus; source_type: string; reverses_entry_id: string | null;
  reversed_by_entry_id: string | null; posted_at: string | null; created_at: string;
  total_debit: string; total_credit: string; is_balanced: boolean; lines: Line[];
};
export type Page<T> = { items: T[]; total: number; page: number; page_size: number };

export type LedgerRow = {
  line_id: string; entry_id: string; entry_number: number; display_number: string; entry_date: string;
  reference_number: string; description: string; debit: string; credit: string; running_balance: string;
};
export type LedgerPage = {
  account: Account; opening_balance: string; period_debits: string; period_credits: string; closing_balance: string;
  items: LedgerRow[]; total: number; page: number; page_size: number;
};

export type ReportLine = {
  account_id: string | null; account_code: string; account_name: string; account_subtype: string;
  amount: string; compare_amount: string | null; monthly: string[] | null;
};
export type ReportSection = { key: string; label: string; lines: ReportLine[]; total: string; compare_total: string | null; monthly_totals?: string[] | null };
export type TrialBalance = {
  as_of: string; currency: string; total_debit: string; total_credit: string; difference: string; balanced: boolean;
  rows: { account_id: string; account_code: string; account_name: string; account_type: string; debit: string; credit: string }[];
};
export type ProfitLoss = {
  start_date: string; end_date: string; currency: string; months: string[] | null;
  income: ReportSection[]; expenses: ReportSection[]; total_income: string; total_expenses: string;
  gross_profit: string; operating_profit: string; net_profit: string;
  compare_total_income: string | null; compare_total_expenses: string | null; compare_net_profit: string | null;
  monthly_net_profit: string[] | null;
};
export type BalanceSheet = {
  as_of: string; currency: string; assets: ReportSection[]; liabilities: ReportSection[]; equity: ReportSection[];
  total_assets: string; total_liabilities: string; total_equity: string; total_liabilities_and_equity: string;
  difference: string; balanced: boolean;
};

export type ReconSession = {
  id: string; account_id: string; account_code: string | null; account_name: string | null;
  statement_start_date: string; statement_end_date: string; opening_balance: string; closing_balance: string;
  reconciled_balance: string | null; status: "in_progress" | "completed" | "cancelled"; note: string;
  completed_at: string | null; created_at: string; difference: string | null; unmatched_count: number | null;
  previous_closing_balance: string | null;
};
export type ReconItem = {
  id: string; statement_date: string; statement_amount: string; statement_reference: string; description: string;
  match_status: "unmatched" | "matched" | "ignored"; ignore_reason: string | null; journal_entry_line_id: string | null;
  matched_entry_id: string | null; matched_entry_number: string | null; possible_duplicate: boolean;
};
export type ReconLedgerLine = {
  line_id: string; entry_id: string; display_number: string; entry_date: string; description: string; reference_number: string; amount: string;
};
export type ReconSummary = {
  opening_balance: string; closing_balance: string; cleared_total: string; reconciled_balance: string; difference: string;
  ledger_balance: string; matched_count: number; unmatched_count: number; ignored_count: number; unmatched_total: string;
  unmatched_ledger_count: number; unmatched_ledger_total: string; expected_statement_total: string; statement_items_total: string;
  statement_gap: string; can_complete: boolean; blockers: string[];
};
export type ReconDetail = { session: ReconSession; summary: ReconSummary; items: ReconItem[]; ledger_lines: ReconLedgerLine[] };
export type ReconSuggestion = { item_id: string; confident: boolean; candidates: ReconLedgerLine[] };

export type Member = { id: string; user_id: string; email: string | null; role: Role; status: string; created_at: string };
export type Period = { id: string; name: string; start_date: string; end_date: string; status: "open" | "closed"; closed_at: string | null };
export type ExportRow = { id: string; report_type: string; export_format: string; params: Record<string, unknown>; requested_by: string | null; created_at: string };
export type Overview = {
  draft_count: number; oldest_draft_date: string | null;
  attention: { kind: string; title: string; detail: string; href: string | null }[];
  open_reconciliations: ReconSession[];
  reconcilable_accounts: { account_id: string; account_code: string; account_name: string; last_reconciled_to: string | null; days_since: number | null; open: boolean }[];
  current_period: Period | null;
};
