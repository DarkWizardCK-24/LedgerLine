# Security notes (statement processing)

## Document passwords
- Sent once, in the multipart body over HTTPS, to `/statement-processing/process` only.
- Held in request memory (`Options`) for the duration of the call, then dropped. Never written to the database, disk, logs, error messages, analytics or browser storage. `Options.__repr__` masks it.
- Wrong passwords are rate-limited per user and per file hash (5 / 10 min), so the endpoint can't be used to brute-force a document.
- Verified: unit tests assert the password is absent from responses and captured logs; the Playwright run (`apps/statement_analyzer_web/e2e/phase5.js`) confirmed it is absent from browser storage and page content, and a grep of the real server log found zero occurrences.
- We never bypass or crack encryption — only a user-supplied password is used.

## Uploaded files
- Type is decided by **content** (magic bytes, OOXML structure), then must agree with the extension. Size, page, row and time limits apply; xlsx containers are checked for decompression bombs before being opened.
- Processed in memory; no decrypted copy is persisted. (Starlette may spool a large upload to a temporary file; it is removed when the request closes.)
- File names are display-only (`safe_name`) and never used as paths. Error responses never echo names or contents.
- Parsing never executes document content (no macros, scripts or external fetches).

## Logging
Only method, path, status, request id and aggregate counts are logged (e.g. "statement processed kind=pdf transactions=7"). No statement text, descriptions, account numbers or passwords.

## Known gaps (be aware)
- PyMuPDF/pypdf parse untrusted PDFs **in the API process**. Limits reduce risk, but a parser vulnerability would run with the API's privileges. Hardening option: run processing in a sandboxed subprocess/container with CPU/memory limits.
- The timeout is cooperative (checked between pages/rows); a single pathological page could still run long.
- Rate limiters are in-memory (single process). Use a shared store if you run several instances.
- No antivirus scanning of uploads.
- Sign-in tokens are kept in the browser's localStorage (an httpOnly-cookie design is a possible improvement). Sample-mode data stays in localStorage too; signed-in data lives on the server.
- Row-level security, role isolation (`anon`/`authenticated` cannot read domain tables) and DB constraints are tested on a real PostgreSQL, but against stand-ins for Supabase Auth/Storage — re-verify on your real project.

## Stored data (Phases 6-7)
- **Original files are never stored.** Only the extracted transactions (immutable), the user's corrections (separate table), report versions (JSON snapshots) and export metadata are kept.
- Every report/book/budget/import query is scoped to the signed-in user; another user's resource returns 404. Deleting a user cascades to all of their data.
- Imports are insert-only, atomic and idempotent; each imported row stores a fingerprint so a retry cannot duplicate it. Budgets, goals and recommendations never move money.
- CSV exports prefix cells that start with `=`, `+`, `-` or `@` so spreadsheets don't run them as formulas.

## Data controls (Phase 8)
- `GET /me/export` returns everything held for the signed-in user as JSON (no-store). `DELETE /me/data` needs `scope` and the literal `confirm=DELETE`; without it the API answers 422 and nothing is touched. Deletes are scoped to the caller and run in one transaction.
- `DELETE /me/account` first asks Supabase Auth (Admin API, service-role key, server-side only) to delete the user and only then wipes our rows; if the auth call fails nothing is deleted. Without the key it answers 501 instead of pretending.
- The Flutter and web apps never hold the service-role key.
- Accessibility is part of the safety story for money apps: contrast, focus visibility, keyboard-only operation and dialogs that trap focus were audited with axe-core; a screen-reader pass is still open.
