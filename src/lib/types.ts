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
  reversed_by_entry_id: string | null; posted_at: string | null; created_at: string; source_id?: string | null; is_closing?: boolean; submitted_at?: string | null; review_note?: string;
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

export type Member = { id: string; user_id: string; email: string | null; invited?: boolean; role: Role; status: string; created_at: string };
export type Period = { id: string; name: string; start_date: string; end_date: string; status: "open" | "closed"; closed_at: string | null };
export type ExportRow = { id: string; report_type: string; export_format: string; params: Record<string, unknown>; requested_by: string | null; created_at: string };
export type Overview = {
  draft_count: number; oldest_draft_date: string | null;
  attention: { kind: string; title: string; detail: string; href: string | null }[];
  open_reconciliations: ReconSession[];
  reconcilable_accounts: { account_id: string; account_code: string; account_name: string; last_reconciled_to: string | null; days_since: number | null; open: boolean }[];
  current_period: Period | null;
};


// ---- quick entry, templates, recurring
export type QuickKind = "money_in" | "money_out" | "transfer";
export type Template = {
  id: string; name: string; kind: QuickKind | "journal"; description: string; reference_number: string;
  lines: { account_id: string; account_code: string | null; account_name: string | null; debit_amount: string; credit_amount: string; description: string }[];
  total: string; is_recurring: boolean; frequency: "weekly" | "monthly" | "quarterly" | "yearly" | null; next_run_date: string | null;
  end_date: string | null; auto_post: boolean; last_run_date: string | null; is_active: boolean; is_due: boolean;
};
export type QuickResult = { entry: Entry; status: "posted" | "draft" | "pending_approval" };
export type RunResult = { template_id: string; template_name: string; entry: Entry | null; error: string | null };
export type RecentSimple = {
  entry_id: string; display_number: string; entry_date: string; description: string; kind: QuickKind; amount: string;
  paid_account_id: string; paid_account_name: string; other_account_id: string; other_account_name: string;
};

// ---- setup, settings
export type SetupStatus = { steps: { key: string; title: string; hint: string; done: boolean; required: boolean; href: string }[]; done_count: number; total: number; complete: boolean };
export type OpeningPreview = {
  as_of_date: string; total_debit: string; total_credit: string; entry: Entry | null;
  lines: { account_id: string; account_code: string; account_name: string; debit_amount: string; credit_amount: string; is_balancing: boolean }[];
};
export type ApprovalMode = "off" | "different_user" | "admin_only";
export type Capabilities = { email_configured: boolean; invites_configured: boolean };
export type Attachment = { id: string; file_name: string; content_type: string; size_bytes: number; created_at: string };

// ---- contacts, tax, invoices
export type Contact = { id: string; name: string; kind: "customer" | "vendor" | "both"; email: string; phone: string; tax_id: string; address: string; is_active: boolean };
export type TaxCode = { id: string; name: string; rate: string; kind: "output" | "input"; tax_account_id: string; is_active: boolean };
export type DocType = "invoice" | "bill";
export type InvoiceLine = { id: string; description: string; quantity: string; unit_price: string; account_id: string; account_name: string | null; tax_code_id: string | null; tax_code_name: string | null; net_amount: string; tax_amount: string };
export type Payment = { id: string; payment_date: string; amount: string; account_id: string; account_name: string | null; reference: string; journal_entry_id: string; is_void: boolean };
export type Invoice = {
  id: string; doc_type: DocType; number: string; contact_id: string; contact_name: string; issue_date: string; due_date: string;
  status: "draft" | "open" | "paid" | "void"; reference: string; notes: string; subtotal: string; tax_total: string; total: string;
  amount_paid: string; balance: string; is_overdue: boolean; journal_entry_id: string | null; lines: InvoiceLine[]; payments: Payment[];
};
export type AgingRow = { contact_id: string; contact_name: string; current: string; d1_30: string; d31_60: string; d61_90: string; d90_plus: string; total: string };
export type Aging = { doc_type: DocType; as_of: string; currency: string; rows: AgingRow[]; totals: AgingRow };
export type GstSummary = {
  start_date: string; end_date: string; currency: string; output_tax: string; input_tax: string; net_payable: string; output_taxable: string; input_taxable: string;
  rows: { tax_code_id: string; name: string; kind: "output" | "input"; rate: string; taxable_value: string; tax: string }[];
};

// ---- cash flow, budgets
export type CashFlow = {
  start_date: string; end_date: string; currency: string; opening_cash: string; net_change: string; closing_cash: string; reconciles: boolean;
  operating: ReportSection; investing: ReportSection; financing: ReportSection;
};
export type BudgetLine = { account_id: string; account_code: string; account_name: string; account_type: "revenue" | "expense"; budget: string; actual: string; variance: string; percent_used: string | null; favourable: boolean };
export type BudgetReport = { start_date: string; end_date: string; currency: string; lines: BudgetLine[]; total_budget_income: string; total_actual_income: string; total_budget_expense: string; total_actual_expense: string };
export type BudgetRow = { account_id: string; account_code: string; account_name: string; account_type: string; months: Record<string, string> };

// ---- imports
export type SourceReport = { id: string; name: string; bank: string | null; period_start: string | null; period_end: string | null; transactions: number; reviewed: number; already_imported: number; currency: string | null };
export type SourceRow = { source_id: string; date: string; description: string; reference: string; amount: string; category: string; reviewed: boolean; already_imported: boolean };
export type SourcePreview = { source: "lensly" | "ledgerly"; source_name: string; currency: string | null; rows: SourceRow[]; categories: string[] };
export type PlatformImportResult = { created: number; skipped_existing: number; skipped_unreviewed: number; errors: { source_id: string; message: string }[]; entry_ids: string[] };
export type JournalImportResult = { entries: { entry_date: string; reference: string; description: string; lines: number; total: string }[]; errors: { row: number; message: string }[]; created: number; entry_ids: string[] };

// ---- schedules, year-end
export type Schedule = { id: string; report_type: string; frequency: string; recipients: string[]; next_run_date: string; is_active: boolean; last_run_at: string | null };
export type YearEndPreview = {
  fiscal_year_start: string; fiscal_year_end: string; total_income: string; total_expenses: string; net_profit: string; retained_earnings_account: string;
  drafts_in_year: number; already_closed: boolean; can_close: boolean; blockers: string[];
  lines: { account_id: string; account_code: string; account_name: string; debit_amount: string; credit_amount: string; is_balancing: boolean }[];
};
