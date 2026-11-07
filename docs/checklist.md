# Checklist
## Phase 1 — Foundation
- [x] Environment inspected; monorepo + git init
- [x] Flutter / Next.js / FastAPI scaffolded
- [x] Design system (colors, Plus Jakarta Sans, responsive shell) in both apps
- [x] Health + readiness endpoints, tests
- [x] Initial migration written
- [x] Supabase project exists; the foundation migration (public.profiles + new-user trigger + RLS) is applied (checked 2026-10-20)
- [x] Migrations 2 and 3 (`cashbook`, `analyzer` schemas) applied to the real project (verified 2026-10-20 against the real project: schemas, 3 cashbook + 12 analyzer tables, RLS on every table, 17 built-in categories; API /ready = 200)
- [x] DB connectivity verified (`/ready` returns 200) (verified 2026-10-20 against the real project: schemas, 3 cashbook + 12 analyzer tables, RLS on every table, 17 built-in categories; API /ready = 200)
## Phase 2 — CashBook UI (sample data, INR)
- [x] Dashboard, Insights, CashBooks grid + detail, transaction timeline, details view, add/edit form
- [x] Donut, bar, progress-bar and ring charts; animations; page transitions; reduced-motion support
- [x] Full CRUD for books, transactions, categories and tags (in memory)
- [x] 10 Flutter tests
- [ ] Not yet: onboarding/sign-in screens, calendar, notifications, attachments, transfers, bulk actions, export
## Analyzer UI design pass
- [x] Gradient design system, animated landing, sample report (labelled), pipeline timeline
- [ ] Real Analyzer screens (upload, review, reports library): Phase 4
## Phase 3 — Auth + real CashBook API (in progress)
- [x] Migration `20261020000002_cashbook_core.sql` (books, categories, transactions, indexes, RLS, built-in categories)
- [x] Supabase JWT verification (HS256 + JWKS), consistent error format
- [x] CashBook / category / transaction / profile endpoints with ownership checks, derived balances, safety rules
- [x] 20 backend tests (auth, cross-user denial, balances, validation, filters, categories, profile)
- [x] Sign-in / register / forgot password / sign-out / session refresh in **both apps** (Supabase Auth REST), profile card + shared profile sync
- [x] Flutter: 19 tests incl. auth service with mock HTTP; Web: 35 Playwright checks with mocked Supabase/API
- [x] Real Supabase Auth verified with a throwaway user (deleted afterwards): admin create, password sign-in, refresh, metadata update, wrong-password refusal, recovery without account enumeration, ES256 tokens verified by our API against the project JWKS (tampered and forged tokens rejected), profile trigger, RLS on profiles, Admin API delete cascading to the profile
- [x] E-mail confirmation turned off on the real project (owner, 2026-10-20); verified: public auth settings show `mailer_autoconfirm: true`, only the e-mail provider enabled, signups open; a real sign-up returns a session immediately and password sign-in works straight after (test user deleted). `/ready` = 200 verified.
- [ ] Consequence to accept: with confirmation off, anyone can register with an address they do not own. E-mail delivery (password reset) is still untested.
- [x] The SQL migrations run on real PostgreSQL 16 (bundled pgserver) with Supabase stand-ins; the real project has so far only been checked for the foundation migration
- [ ] Flutter: replace the sample store with API repositories (needs the above)
## Phase 4 — Analyzer UI (sample statements)
- [x] Report Books, upload center, encrypted-PDF password prompt, processing progress, settings
- [x] Transaction review workspace (filters, inline edits, bulk actions, export, flags, original vs corrected)
- [x] Reconciliation screen (reconciled / warnings / not reconciled / unable) with row-level checks
- [x] Report overview, savings ideas (evidence, assumptions, status, feedback), report comparison with coverage warning
- [x] Import-to-CashBook flow (reviewed-only, mapping, preview, confirm, idempotent, audit)
- [x] Budgets and savings tracker (starts empty)
- [x] 16 unit tests + 66 Playwright e2e checks
- [x] Sample workspace (not signed in) still uses generated, clearly labelled sample statements; signed-in users get real data (Phases 5-7)
- [ ] Phase 4 acceptance on a real device/browser matrix not done (Chromium only)
## Phase 5 — Document-processing engine (built; see docs/document-processing.md)
- [x] PDF (text layer, multi-page, repeated headers, column-position parsing), CSV, XLSX, XLS
- [x] Password-protected PDF (AES-256, RC4-128) and Excel: required / incorrect / retry without duplicates; passwords never stored or logged
- [x] Scanned-PDF detection, OCR fallback behind an injectable engine, per-row confidence, honest `ocr_required` / `ocr_unavailable` errors
- [x] Exact `Decimal` normalization (Indian/Western/European formats, Dr/Cr, negatives), day-/month-first inference
- [x] Debit/credit direction with refusal when ambiguous; newest-first reordering; derived-vs-printed opening balance disclosed
- [x] Categorization suggestions, duplicate flags, reconciliation (reconciled / warnings / not reconciled / unknown)
- [x] Limits: size, pages, rows, time (cooperative), zip-bomb guard; per-user and per-file rate limits
- [x] API `/statement-processing/inspect|process`; Analyzer upload center uses it for signed-in users; duplicate-upload detection by SHA-256
- [x] 117 new backend tests with real generated files (137 total); mutation-checked (leaking a password / hiding a reconciliation difference fails the suite); 20 real end-to-end checks (real API + real files)
- [ ] **Real Tesseract not exercised** (not installed here) — OCR accuracy on real scans is unmeasured
- [ ] Not built: bank-specific adapters beyond labels, credit-card statement semantics, multi-currency detection, headers split across lines
- [ ] Untrusted PDFs are parsed in-process (see docs/security.md for the hardening option)
## Phase 6 — Persistence, analysis, versions, exports (built)
- [x] Tables in the `analyzer` schema (report books, statements, extracted transactions, reviews, reports, versions, recommendation state, exports, budgets, goals), RLS on, no client policies
- [x] Extracted transactions are immutable; user corrections live in `transaction_reviews`; original files are **not** stored
- [x] Server-side analysis (Python port of the TypeScript analysis, golden-file parity test), immutable report versions, comparison, recommendation status/feedback
- [x] CSV (formula-safe), Excel and PDF export; budgets and goals via the API
- [x] Web app: signed-in users use the API for everything above; sample mode keeps local behaviour
## Phase 7 — Analyzer → CashBook import (built)
- [x] Reviewed rows only; flagged duplicates never; own report + own active INR CashBook; insert-only; one DB transaction; idempotency key; stable per-row fingerprint; audit batch + link rows
- [x] Re-importing creates nothing; a CashBook row the user deleted can be deliberately re-imported
- [x] Verified on a **real PostgreSQL 16** (bundled `pgserver`): 222 backend tests (SQLite + Postgres), DB-enforced constraints, role isolation, RLS on every table; mutation-checked import safeguards
- [x] End-to-end against the real API on real Postgres: 20 (phase 5) + 23 (phase 6/7: persistence, versions, exports, compare, import, ownership); 66 mocked checks still pass
- [x] Real Supabase Auth and JWKS verified (see Phase 3); **Storage** still not exercised (no bucket is used yet); API-against-real-database still needs the connection string
- [ ] PDF export uses a built-in font: ₹ is printed as "Rs"; Excel/CSV keep ₹ amounts as numbers
- [x] Flutter CashBook uses the API when signed in (sample store only in sample mode); imported rows are recognisable
- [ ] Imported CashBook rows show an "Imported" source and tag, but there is no link back to the statement row in the UI (the link table exists server-side)
## Phase 8 — Polish, data controls, accessibility (built)
- [x] Web: `Ctrl/⌘ K` quick actions, `G`-then-key navigation, `?` help, skip link, focus styling, reduced-motion respected
- [x] Accessibility audit with axe-core (WCAG 2.1 A/AA) on every Analyzer page; real contrast and list-structure defects found and fixed (all pages: no serious/critical violations)
- [x] Data controls: `GET /me/export` (JSON), `GET /me/data-summary`, `DELETE /me/data?scope=&confirm=DELETE`, `DELETE /me/account` (via Supabase Admin API; refuses with 501 unless the service-role key is configured); typed-confirmation UI in both apps
- [x] Flutter: repository + live ledger (optimistic UI, ordered sync, rollback with error banner and Retry), skeleton until first load, Data & privacy card; fake-server tests, signed-in UI tests, and a test that drives the data layer against the real API on Postgres
- [x] Deployment guide: `docs/deployment.md`
- [x] Verified: backend 246 tests (SQLite + Postgres); web 133 e2e + 17 unit; Flutter 31 tests (+1 real-backend test, run with a token); Flutter web and Windows builds succeed
- [ ] **Not verified here:** Analyzer flows against the real project database (CashBook + privacy + `DELETE /me/account` are verified there), real e-mail delivery; Android and iOS builds (Android licences not accepted on this machine, no macOS); Windows build needs a short project path (260-character limit); cross-browser (Chromium only) and real-device testing; real Tesseract OCR
- [ ] Not built: screen-reader pass with NVDA/VoiceOver/TalkBack (axe cannot judge reading order or wording), Flutter semantics audit, localisation, push/e-mail notifications, scheduled retention jobs (deletion is on demand)

## Extra features (2026-10-20)
- [x] CashBook: date-range and payment-method filters beside search/type/category, "Clear all", and CSV export of exactly the filtered list (formula-injection safe, plain-number signed amounts, UTF-8 BOM); 4 new Flutter tests (35 total)
- [x] Analyzer: "Spending patterns" on the report overview (weekday totals, largest payments + peak day, cumulative cash-flow line with text alternative); pure `spendingPatterns()` with 3 unit tests (20 total) and `e2e/phase9.js` (12 checks incl. axe, desktop + mobile)
- [ ] Not exercised: the CashBook CSV save on a real device/browser (file_saver is platform-specific; only the CSV content is unit-tested)

- [x] Real-project end-to-end (2026-10-20): 23 checks with two throwaway real Supabase users through the real API on the real database - ES256 auth, profile trigger, CashBook CRUD, derived balance, search, cross-user isolation (404s), data summary/export, typed-confirmation delete, `DELETE /me/account` through the API; users cleaned up
- [ ] Still not run against the real project: Analyzer upload/report/import flows and the Playwright suites (only CashBook + privacy endpoints were exercised)
- [ ] Rotate the DB password, service_role key and JWT secret (they were shared in chat)
## Branding + onboarding (2026-10-20)
- [x] Apps renamed: **Ledgerly** (Flutter CashBook app) and **Lensly** (Next.js statement analyzer); applied to window/page titles, manifests, Android/iOS/Windows display names, sign-in copy, data-controls labels and all three READMEs. "CashBook" stays as the name of a ledger inside Ledgerly. Package ids, folder names and the `cashbook` Dart package name are unchanged. No trademark/domain search done.
- [x] Ledgerly onboarding: five gradient slides with animated, code-drawn illustrations (logo orbit, fanned books, transaction feed, animated donut + bars, privacy/sync), parallax, blended gradients, animated dots, Skip, arrow-key support, reduced-motion respected; shown once before sign-in (flag in the secure store), "Replay intro" in Settings; 5 new tests (40 total)
- [ ] Onboarding not checked on a real phone/tablet; screenshots were taken from the Flutter web build in headless Chromium only
## Ledgerline (double-entry accounting) - see docs/ledgerline.md
- [x] Phase 2: `ledger` schema, organizations, members, roles, organization isolation (composite FKs, 404 for non-members)
- [x] Phase 3: chart of accounts, atomic gapless posting, idempotency, reversal, closed periods, audit trail
- [x] Phase 4: general ledger (window-function running balance), trial balance, profit & loss, balance sheet, CSV
- [x] Phase 5: bank/cash/card reconciliation (CSV import, matching, suggestions, draft adjustments), PDF export, export history, overview
- [x] Phase 6: Next.js app, mobile-first (bottom tab bar, sheets), dark mode, Emerald & Gold theme, logo
- [x] Phase 7: backend 390 tests (SQLite + real Postgres 16), web 14 unit tests, 31 end-to-end checks at 360/390/768/1440 px
- [x] Phase 8: production documentation (deployment, monitoring, backup/recovery)
- [ ] Not verified: real Supabase sign-in/hosting, real devices, iOS Safari, screen reader; rate limits for import/export; e-mailed invitations
## Ledgerline, second release
- [x] Money in / out / transfer quick entry, shortcuts, repeat last, plain-language hints, guided setup, opening balances
- [x] Templates and recurring entries (reminders, catch-up, one occurrence per period)
- [x] Receipts (photo or PDF) on entries, checked by file content
- [x] Contacts, invoices and bills with payments, void, aging, GST codes and GST summary
- [x] Cash-flow statement (reconciles to the books) and budgets with budget vs actual
- [x] Import from Lensly, Ledgerly and Excel/CSV as drafts; bulk post
- [x] Approvals (second-person or admin-only), send back with a note
- [x] Year-end close with preview; reversible
- [x] Invitation e-mails and scheduled report e-mails (tested with mocks)
- [ ] Not built: multi-currency; not verified: real SMTP / Supabase invitation delivery, real devices
