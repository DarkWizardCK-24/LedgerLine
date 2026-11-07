# Ledgerline: double-entry accounting

Ledgerline is the third app on the Finance Platform. It reuses the **same FastAPI service and the same Supabase project** (Auth + Postgres) as Ledgerly and Lensly. Everything is under `/api/v1`; the browser never talks to the database.

| Piece | Where |
|---|---|
| Web app (Next.js 16, Tailwind 4) | `apps/ledgerline_web` |
| API routers | `backend/app/api/accounting.py` |
| Accounting engine (no HTTP in here) | `backend/app/services/accounting/` |
| Models / schemas | `backend/app/models_ledger.py`, `backend/app/schemas_ledger.py` |
| Organization + role dependencies | `backend/app/auth/org.py` |
| SQL | `supabase/migrations/20261022000004_ledger_core.sql`, `…0005_ledger_reconciliation.sql` |
| Brand | `brand/ledgerline-logo.svg`, `brand/ledgerline-glyph.svg` |

## Screenshots

Captured by `npm run screenshots` from a seeded demo book (Sharma Traders, INR).

### Phone (390 px)

| | |
|:--|:--|
| **Sign in**<br><img src="screenshots/ledgerline/mobile/01-sign-in.png" width="300"> | **Overview, live from the ledger**<br><img src="screenshots/ledgerline/mobile/02-dashboard.png" width="300"> |
| **Journal**<br><img src="screenshots/ledgerline/mobile/03-journal.png" width="300"> | **New entry: balanced, ready to post**<br><img src="screenshots/ledgerline/mobile/04-journal-entry-balanced.png" width="300"> |
| **New entry: shows what is missing**<br><img src="screenshots/ledgerline/mobile/05-journal-entry-unbalanced.png" width="300"> | **A posted entry (immutable)**<br><img src="screenshots/ledgerline/mobile/06-journal-entry-posted.png" width="300"> |
| **Chart of accounts**<br><img src="screenshots/ledgerline/mobile/07-chart-of-accounts.png" width="300"> | **General ledger with running balance**<br><img src="screenshots/ledgerline/mobile/08-general-ledger.png" width="300"> |
| **Profit & loss**<br><img src="screenshots/ledgerline/mobile/09-profit-and-loss.png" width="300"> | **Balance sheet**<br><img src="screenshots/ledgerline/mobile/10-balance-sheet.png" width="300"> |
| **Trial balance**<br><img src="screenshots/ledgerline/mobile/11-trial-balance.png" width="300"> | **Reconciliations**<br><img src="screenshots/ledgerline/mobile/12-reconciliation-list.png" width="300"> |
| **Reconciliation workspace**<br><img src="screenshots/ledgerline/mobile/13-reconciliation-workspace.png" width="300"> | **Match, draft an entry, or ignore a line**<br><img src="screenshots/ledgerline/mobile/14-reconciliation-match-sheet.png" width="300"> |
| **Settings: team, periods, exports**<br><img src="screenshots/ledgerline/mobile/15-settings.png" width="300"> | **More menu**<br><img src="screenshots/ledgerline/mobile/16-more-menu.png" width="300"> |
| **Global search**<br><img src="screenshots/ledgerline/mobile/17-search.png" width="300"> |  |

### Desktop (1440 px)

| | |
|:--|:--|
| **Overview**<br><img src="screenshots/ledgerline/desktop/01-dashboard.png" width="460"> | **Overview, dark mode**<br><img src="screenshots/ledgerline/desktop/10-dashboard-dark.png" width="460"> |
| **Journal**<br><img src="screenshots/ledgerline/desktop/02-journal.png" width="460"> | **New journal entry**<br><img src="screenshots/ledgerline/desktop/03-journal-entry.png" width="460"> |
| **General ledger**<br><img src="screenshots/ledgerline/desktop/04-general-ledger.png" width="460"> | **Chart of accounts**<br><img src="screenshots/ledgerline/desktop/05-chart-of-accounts.png" width="460"> |
| **Profit & loss**<br><img src="screenshots/ledgerline/desktop/06-profit-and-loss.png" width="460"> | **Balance sheet**<br><img src="screenshots/ledgerline/desktop/07-balance-sheet.png" width="460"> |
| **Reconciliation**<br><img src="screenshots/ledgerline/desktop/08-reconciliation.png" width="460"> | **Settings**<br><img src="screenshots/ledgerline/desktop/09-settings.png" width="460"> |
| **Tablet (820 px)**<br><img src="screenshots/ledgerline/desktop/11-tablet-dashboard.png" width="460"> |  |

## Decisions that differ from the original brief
| Brief | What was built | Why |
|---|---|---|
| Application-managed auth | Supabase Auth, verified by the existing JWT code | One sign-in across the platform |
| Alembic migrations | Plain SQL in `supabase/migrations` | Matches the repo; RLS, triggers and partial indexes live in one place |
| NUMERIC money | `NUMERIC(19,4)` in the `ledger` schema (rest of the platform uses integer paise) | Isolated schema; amounts are strings in the API and BigInt minor units in the browser |
| `account_period_balances` cache | Not built | Every figure is computed from posted lines; nothing stored can drift |
| Account closing records | Not built | Prior-year profit is rolled into retained earnings on the balance sheet at report time |
| Stand-alone `idempotency_keys` table | `journal_entries.idempotency_key` (unique per organization) | Posting and reversal are the only idempotent operations |

## Accounting rules (enforced twice: in the service, and by the database)
- A line has exactly one positive side (`CHECK`), at the organization's decimal precision. An entry needs ≥ 2 lines and debits = credits (`Decimal`).
- Posting locks the entry row (`SELECT … FOR UPDATE`), numbers it gaplessly from a locked counter row, writes the audit row and commits once. Any failure rolls everything back.
- Posted entries are immutable. Triggers reject `UPDATE`/`DELETE` of a posted entry or its lines; the only allowed change is `posted → reversed`. Corrections are a **new, linked, balanced reversal** (a unique index allows one reversal per entry; a reversal cannot be reversed).
- Reports use posted (and reversed) lines only. Drafts never appear. The balance sheet shows the real difference if the books are out of balance; it never plugs.
- Cross-organization references are impossible at the database level (composite foreign keys). Non-members get `404`, not `403`.
- Closed financial periods reject posting and reversal into their dates (`409 period_closed`).
- Reconciliation: statement and ledger amounts must be exactly equal to match; completion needs difference = 0 and no unmatched lines; a ledger line can clear once; a completed reconciliation is immutable (trigger). Adjustments are created as **drafts**, never posted automatically.
- The audit log is append-only (trigger). Keys containing `password`, `token`, `secret`, `authorization`, `api_key` or `jwt` are redacted before storage.

## Roles
`viewer` < `accountant` < `admin` < `owner`. Viewers read and export. Accountants record, post, reverse and reconcile. Admins manage members, periods, settings and see the audit trail. Only owners grant admin/owner; the last owner cannot be removed or demoted.

## Entity relationships
```
organizations 1─┬─* organization_members (user_id → auth.users)
                ├─1 organization_settings (gapless entry counter)
                ├─* financial_periods
                ├─* accounts (self-parent)              unique(org, code)
                ├─* journal_entries ─* journal_entry_lines → accounts
                │        reverses_entry_id → journal_entries (unique)
                ├─* reconciliation_sessions → accounts   one open per account
                │        └─* reconciliation_items → journal_entry_lines (unique)
                ├─* audit_logs (append-only)
                └─* export_history
```

## API (all need `Authorization: Bearer <supabase token>`; org-scoped routes need `X-Organization-Id`)
Interactive docs: `/docs`. Errors are `{ "error": { "code", "message", "request_id", "details"? } }`.

| Area | Endpoints |
|---|---|
| Organizations | `GET/POST /organizations`, `GET/PATCH /organizations/{id}`, `GET/POST /organizations/{id}/members` (by `user_id` or `email`), `PATCH/DELETE …/members/{mid}` |
| Chart of accounts | `GET/POST /accounts`, `GET/PATCH/DELETE /accounts/{id}`, `POST /accounts/{id}/activate|deactivate`, `GET /accounts/{id}/ledger`, `GET /accounting/account-subtypes` |
| Journal | `GET/POST /journal-entries`, `GET/PATCH/DELETE /journal-entries/{id}`, `POST …/post`, `POST …/reverse` (both honour `Idempotency-Key`) |
| Periods | `GET/POST /financial-periods`, `POST …/{id}/close|reopen` |
| Reports | `GET /reports/trial-balance|profit-loss|balance-sheet?format=json|csv|pdf` |
| Reconciliation | `GET/POST /reconciliations`, `GET /reconciliations/{id}`, `…/suggestions`, `POST …/items|import|match|unmatch|ignore|restore|adjustment-draft|complete|cancel`, `DELETE …/items/{item}` |
| Insight | `GET /accounting/overview`, `GET /audit-logs`, `GET /exports` |

CSV statement import accepts `Date` + `Amount` or `Debit/Credit` (`Withdrawal/Deposit`) columns, `dd/mm/yyyy` or ISO dates, `1,250.50`, `(75.00)`, `300 Dr/Cr`, and comma/semicolon/tab delimiters (max 5,000 rows, 3 MB).

## How the apps connect to the shared backend and Supabase

All three apps use the same Supabase project and the same FastAPI service. **Only public values live in a client**; the service-role key and database URL exist only in `backend/.env` on the server.

| App | Where its configuration comes from | Keys |
|---|---|---|
| Ledgerly (Flutter, `apps/cashbook_flutter`) | **No env file.** Build-time `--dart-define`, read in `lib/core/config/app_config.dart`. `flutter_dotenv` is listed in `pubspec.yaml` but is not used anywhere. | `API_BASE_URL` (defaults to the deployed backend, `https://finance-backend-miln.onrender.com`), `SUPABASE_URL`, `SUPABASE_ANON_KEY` (no defaults: without them the sign-in screen offers sample mode) |
| Lensly (`apps/statement_analyzer_web`) | `.env.local` (git-ignored; template `.env.example`), read in `src/lib/supabase-auth.ts` | `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Ledgerline (`apps/ledgerline_web`) | `.env.local`, same three variables, same code path (`src/lib/supabase-auth.ts`) | as Lensly |
| Backend (`backend/`) | `backend/.env` (git-ignored; template `.env.example`), server only | `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ORIGINS`, ... |

Because they share one Supabase project, one account signs in to all three apps. Run Ledgerly against a local backend with
`flutter run --dart-define=API_BASE_URL=http://localhost:8000 --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...`.

**Before Ledgerline works against the deployed backend:** the instance at `https://finance-backend-miln.onrender.com` serves the CashBook and Analyzer routes only (checked via its `/openapi.json`: no `/organizations`, `/accounts`, `/journal-entries`, `/reconciliations` or `/reports/trial-balance`). To enable Ledgerline you must (1) apply `20261022000004_ledger_core.sql` and `20261023000005_ledger_reconciliation.sql` to the Supabase database, (2) deploy the updated `backend/` (it is its own git repository, `Finance-Backend`), and (3) add the Ledgerline web origin to the backend's `CORS_ORIGINS`. Until then, sign-in succeeds but every accounting request returns 404.

### Endpoints added in the second release
| Area | Endpoints |
|---|---|
| Quick entry | `POST /journal-entries/quick`, `GET /accounting/recent-simple` |
| Templates and recurring | `GET/POST /templates`, `PATCH/DELETE /templates/{id}`, `POST /templates/{id}/use|run`, `GET /recurring/due`, `POST /recurring/run-due` |
| Setup and settings | `GET /accounting/setup-status`, `POST /accounting/opening-balances`, `GET/PATCH /accounting/settings`, `GET /accounting/capabilities` |
| Approvals | `POST /journal-entries/{id}/submit|reject`, `POST /journal-entries/bulk-post`, `GET /journal-entries?pending=true` |
| Receipts | `GET/POST /journal-entries/{id}/attachments`, `GET/DELETE /journal-entries/{id}/attachments/{aid}` |
| Contacts and tax | `GET/POST /contacts`, `PATCH /contacts/{id}`, `GET/POST /tax-codes`, `POST /tax-codes/seed-gst` |
| Invoices and bills | `GET/POST /invoices|bills`, `GET/PATCH/DELETE /invoices|bills/{id}`, `POST …/{id}/issue|void|payments`, `POST …/{id}/payments/{pid}/void` |
| Reports | `GET /reports/aging`, `/reports/gst-summary` (CSV too), `/reports/cash-flow`, `/reports/budget-vs-actual` |
| Budgets | `GET/PUT /account-budgets` |
| Import | `GET /integrations/lensly/reports`, `/integrations/ledgerly/books` (+ `/{id}/preview`), `POST /integrations/import`, `POST /journal-entries/import-file` |
| E-mail and year-end | `GET/POST /report-schedules`, `DELETE /report-schedules/{id}`, `POST /report-schedules/run-due`, `GET /accounting/year-end/preview`, `POST /accounting/year-end` |

Note: budgets live at `/account-budgets` because `/budgets` already belongs to Lensly.

## Running the SQL in Supabase

Ledgerline lives in its own Postgres schema, `ledger`, in the **same Supabase project** as Ledgerly and Lensly. It needs **three** SQL files, run **once each, in this order**. The first three migrations (foundation, CashBook, Analyzer) are prerequisites and are already applied if Ledgerly and Lensly work.

| Order | File (in `supabase/migrations/`) | What it creates |
|---|---|---|
| 1 | `20261022000004_ledger_core.sql` | the `ledger` schema: organizations, members, accounts, journal entries and lines, financial periods, audit log, plus the triggers that make posted entries immutable |
| 2 | `20261023000005_ledger_reconciliation.sql` | bank reconciliation and export history |
| 3 | `20261024000006_ledger_features.sql` | templates and recurring entries, receipts, contacts, tax codes, invoices and bills with payments, budgets, scheduled reports, approvals and year-end closing columns |

**How:** Supabase dashboard, SQL Editor, New query. Paste one file, press Run, wait for "Success", then do the next file. (Or, with the Supabase CLI linked to the project, `supabase db push` runs whatever is missing in order.) The files are not re-runnable: a second run fails with "already exists". That is safe, it changes nothing.

**Check it worked** (SQL Editor):

```sql
select count(*) from information_schema.tables where table_schema = 'ledger';   -- expect 20
select tablename from pg_tables where schemaname = 'ledger' and not rowsecurity; -- expect no rows (RLS is on everywhere)
```

**Then:**
1. Do **not** add `ledger` to Settings, API, "Exposed schemas". All access goes through the backend.
2. Redeploy the backend (it must include the new routes) and add the Ledgerline web address to its `CORS_ORIGINS`.
3. Optional, for e-mail features: configure SMTP in Supabase Auth (so invitations are delivered) and set `SMTP_HOST`, `SMTP_FROM` (and user, password) on the backend for scheduled report e-mails.

## Running it locally
```
# backend (real Postgres 16 bundled via pgserver; sign-in is NOT real here)
cd backend && python scripts/dev_server.py --port 8010 --seed-user <uuid>
# web
cd apps/ledgerline_web && cp .env.example .env.local   # fill in the three NEXT_PUBLIC_* values
npm install && npm run dev
```

## Tests
| Suite | Command | Covers |
|---|---|---|
| Backend (SQLite **and** real Postgres 16) | `cd backend && pytest` | engine rules, posting, reversal, periods, ledger, reports, reconciliation, CSV parsing, PDF/CSV exports, roles, cross-organization attacks, audit redaction, DB triggers/constraints, concurrent posting/reversal/matching |
| Web unit | `cd apps/ledgerline_web && npm test` | money (exact decimals) and date helpers |
| Web end-to-end | `npm run e2e` (needs the dev server + a production build, see the header of `e2e/ledgerline.e2e.js`) | full flows at 360/390/768/1440 px, reconciliation, periods, members, PDF/CSV download, search, dark mode, no horizontal overflow |

## Production
1. **Database.** Apply `supabase/migrations/*.sql` in order (the two `…ledger…` files are new). They enable RLS on every `ledger` table and grant `anon`/`authenticated` nothing. Do not expose the `ledger` schema in the Supabase Data API. The API connects with a server-side role that can read `auth.users` (needed only to add members by email).
2. **API.** Same container and variables as the rest of the platform (`docs/deployment.md`). Add the web app's exact origin to `CORS_ORIGINS`. The API exposes `Content-Disposition` so downloads keep their file names.
3. **Web.** `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` at build time, then `npm ci && npm run build && npm start` (or Vercel). HTTPS only. Add the web origin to Supabase Auth's redirect allow-list.
4. **Monitoring.** Every request logs method, path, status and `x-request-id`, never bodies or tokens. Alert on 5xx rate and on `/api/v1/ready` ≠ 200. Business signals worth alerting on: any `unbalanced` or `posting_failed` / `reversal_failed` response (should be 0 in normal use), and the balance sheet / trial balance `balanced: false`.
5. **Backup and recovery.** Enable Supabase point-in-time recovery (or scheduled `pg_dump` of the `ledger`, `public.profiles` and `auth` schemas). The ledger is the source of truth and is append-mostly, so a restore to a point in time is consistent. Rehearse a restore into a scratch project, then run `GET /reports/trial-balance` for each organization and confirm `balanced: true`. Entry numbers are gapless; a gap after a restore means data was lost.
6. **Scaling note.** The platform's in-memory rate limiters are per-process. Before running more than one API instance, move them to a shared store, and consider limiting `/reconciliations/*/import` and the PDF exports.

## Known limits
- Sign-in against a real Supabase project, and the Supabase-hosted database, have **not** been exercised from this machine (see the platform README). Everything else ran on SQLite and a real PostgreSQL 16.
- No year-end closing entries (retained earnings are derived at report time). One base currency per organization. PDF uses built-in Latin-1 fonts, so currency prints as its ISO code and non-Latin names are replaced with `?`.
- Invitation e-mails and scheduled report e-mails need Supabase Auth e-mail and an SMTP server; they were tested against mocks, not against a real mail server.
- Multi-currency is not built: each organization has one base currency.
- Receipts are stored in PostgreSQL (up to 5 MB each, 10 per entry), which keeps them in the same backups as the ledger.
- Not verified: iOS Safari / real devices, browsers other than Chromium, a screen-reader pass.
