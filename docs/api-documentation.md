# API documentation (Phase 3 — implemented and tested)

Base path: `/api/v1`. Interactive docs: `/docs`. All endpoints except `/health` and `/ready` require
`Authorization: Bearer <Supabase access token>`.

Money is **integer minor units** (paise/cents). `amount_minor` is always positive; `type` carries the sign.
Another user's resources always return **404** (never 403) so existence is not leaked.

## Errors
```json
{ "error": { "code": "book_has_transactions", "message": "…", "request_id": "…", "details": [ {"field": "…", "message": "…"} ] } }
```
Codes: `unauthorized` 401 · `not_found` 404 · `validation_error` 422 · `book_has_transactions` 409 · `currency_locked` 409 ·
`currency_mismatch` 409 · `book_archived` 409 · `category_exists` 409 · `category_kind_mismatch` 422 · `category_archived` 422 ·
`builtin_category` 403 · `database_unavailable` 503. Validation errors never echo submitted values.

## Endpoints
| Method | Path | Notes |
|---|---|---|
| GET | `/auth/me` | Verified user id/email |
| GET / PATCH | `/profiles/me` | The shared profile row (`public.profiles`) used by **both** apps: `display_name`, `default_currency` (INR default), `timezone`. Created on first read if the auth trigger hasn't run. A name change in either app is visible in the other |
| GET / POST | `/cashbooks` | List (`?archived=`) / create. Responses include derived `balance_minor`, `transaction_count`, `last_activity` |
| GET / PATCH / DELETE | `/cashbooks/{id}` | Archive = `PATCH {archived:true}`. Delete is refused (409) when transactions exist. Currency locks after the first transaction |
| GET / POST | `/categories` | Built-in + own (`?kind=`). Duplicate names (case-insensitive) → 409 |
| PATCH | `/categories/{id}` | Own only. Archiving keeps history valid; archived categories cannot be used for new transactions |
| GET / POST | `/transactions` | Filters: `book_id,type,category_id,q,date_from,date_to`; `limit` (1–100) / `offset`; newest first |
| GET / PATCH / DELETE | `/transactions/{id}` | Balances are derived from rows, so edit/delete can never double-adjust. Moving between books requires the same currency |

Not yet implemented: transfers between books, attachments, recurring rules, bulk actions, import links (later phases).
Tags are stored as a JSON array on the transaction for now (the master plan's normalized `tags` tables are deferred).

## Auth
Tokens are verified server-side: HS256 with `SUPABASE_JWT_SECRET`, or ES256/RS256/EdDSA through the project's JWKS endpoint
(`SUPABASE_URL`). `alg: none`, wrong audience (`authenticated` required), expired and badly signed tokens are rejected.


# Statement processing (Phase 5 — implemented and tested)

Stateless: a file is processed **in memory** and nothing about it is stored by this endpoint. Auth required.

| Method | Path | Body (multipart) | Notes |
|---|---|---|---|
| POST | `/statement-processing/inspect` | `file` | Type, size, SHA-256, whether a password is needed, page count (PDF). Lets the UI prompt before processing |
| POST | `/statement-processing/process` | `file`, `password?` (≤256 chars), `ocr?` (bool) | Full pipeline. Returns transactions, metadata, reconciliation, warnings |

**Result (`/process`)** — all money is integer minor units (paise):
`meta{bank, account_mask, opening, opening_source (printed|derived), closing, closing_source (printed|last-row), start, end}`,
`transactions[{id, date, raw, ref, debit, credit, balance|null, source (text|ocr), confidence, merchant, suggested (category id), category_confidence, method, duplicate_of|null}]`,
`reconciliation{status (reconciled|warnings|not_reconciled|unknown), credits, debits, expected_closing, statement_closing, difference, basis (printed|derived|none), row_issues[{index, expected, printed}]}`,
`sha256, kind, pages, encrypted, ocr_used, parser, warnings[], rows_skipped`.

**Sign convention:** credits add to the balance, debits subtract, exactly as printed. Discrepancies are reported, never adjusted away.

**Errors** (same envelope as everywhere; messages are fixed strings that never include file contents, names or passwords):

| Code | HTTP | Meaning |
|---|---|---|
| `file_too_large` | 413 | Over the size limit (default 25 MB) |
| `too_many_rows` | 413 | Over the row limit (default 20,000) |
| `unsupported_file_type` | 415 | Not PDF/CSV/XLSX/XLS by **content**, or content doesn't match the extension |
| `corrupted_file` | 422 | Damaged, empty, truncated, or a decompression bomb |
| `password_required` / `password_incorrect` | 422 | Encrypted PDF / Excel — retry with the password |
| `unsupported_encryption` | 422 | Encryption we can't open |
| `too_many_pages` | 422 | Over the page limit (default 100) |
| `ocr_required` | 422 | Scanned PDF and `ocr` wasn't requested |
| `ocr_unavailable` | 422 | `ocr=true` but OCR isn't enabled/installed on the server |
| `no_transactions` | 422 | No recognisable transaction table |
| `ambiguous_amounts` | 422 | Debits and credits can't be told apart (refused rather than guessed) |
| `processing_timeout` | 504 | Exceeded the time limit (default 30 s) |
| `too_many_attempts` | 429 | 5 wrong passwords for the same file in 10 minutes |
| `rate_limited` | 429 | 20 uploads per user per 10 minutes |

Config (env): `OCR_ENABLED`, `MAX_UPLOAD_MB`, `MAX_PDF_PAGES`, `PROCESSING_TIMEOUT_S`.

# Analyzer persistence, exports and import (Phases 6-7 — implemented and tested)

All amounts are integer paise. Resources are per-user (another user's id → 404).

| Endpoint | Purpose |
|---|---|
| `GET/POST /report-books`, `PATCH/DELETE /report-books/{id}` | Report Books (unique name per user, case-insensitive; a book holding reports can't be deleted) |
| `POST /statement-processing/process` + form `report_book_id`, `report_name` | Process **and save** the statement (report, transactions, version 1). Without a book it only returns the parse |
| `GET /reports?book_id=&q=`, `GET/PATCH/DELETE /reports/{id}` | Library; rename / move; delete cascades to everything derived |
| `GET /reports/{id}/transactions` | Extracted values + effective values (corrections applied), reviewed flag, duplicate flag |
| `PUT /reports/{id}/reviews` | `{items:[{transaction_id, category?, merchant?, reviewed?}]}`; explicit `null` clears a correction |
| `GET /reports/{id}/recommendations`, `PUT …/{key}` | Savings ideas computed server-side; `{status, helpful}` is remembered |
| `GET/POST /reports/{id}/versions`, `GET …/{n}` | Immutable analysis snapshots |
| `GET /reports/{id}/export?format=csv\|xlsx\|pdf` | File download (metadata row recorded, file not stored) |
| `GET /reports/compare?a=&b=` | Totals, per-day average, per-category; `comparable=false` + warning when periods differ by >20% |
| `GET/POST/DELETE /budgets`, `GET/POST/PATCH/DELETE /goals` | Monthly category limits and savings goals |
| `POST /imports/preview`, `POST /imports/confirm`, `GET /imports?report_id=` | Analyzer → CashBook import (below) |

**Import** body: `{report_id, cashbook_id, transaction_ids?, category_map?, method_map?}`; `confirm` also needs `idempotency_key` (8-100 chars). Only reviewed, non-duplicate rows are imported; rows already imported (and still present in the CashBook) are skipped; the whole confirm is one transaction. Replaying the same key returns the original result with `replayed: true`.

Error codes: `duplicate_statement` 409 (`details.report_id` = the existing report) · `book_exists` 409 · `book_has_reports` 409 · `invalid_category` 422 · `category_kind_mismatch` 422 · `unknown_recommendation` 422 · `same_report` 422 · `idempotency_key_reused` 409 · `currency_mismatch` 409 · `book_archived` 409 · `import_conflict` 409 · `invalid_transaction` 422 · `invalid_format` 422 · `budget_exists` 409.

# Data controls (Phase 8 — implemented and tested)
| Endpoint | Purpose |
|---|---|
| `GET /me/data-summary` | Row counts (CashBooks, transactions, custom categories, reports, report books, statement transactions, budgets, goals) |
| `GET /me/export` | Everything stored for the user as one JSON download |
| `DELETE /me/data?scope=all\|cashbook\|analyzer&confirm=DELETE` | Deletes that scope for the caller. Missing/wrong `confirm` → 422 `confirmation_required`; bad scope → 422 |
| `DELETE /me/account?confirm=DELETE` | Deletes the Supabase Auth user (Admin API) and then all rows. 501 `account_deletion_unavailable` when not configured; 502 `auth_unreachable` / `auth_error` leave data untouched |
