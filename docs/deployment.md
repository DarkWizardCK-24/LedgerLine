# Deployment guide

This is the path from this repository to a running system. Nothing here has been run against a real Supabase project or a
production host from this development machine, so treat it as a checklist to follow and verify, not a record of something done.

## 0. What you need
- A **Supabase** project (Auth, Postgres). From it: project URL, **anon/publishable key**, **JWT secret or JWKS** (new projects use asymmetric keys, which the API supports), **service-role key** (server only), and the **database connection string** (use the pooler URL in production).
- A host for the **FastAPI** container (any container platform), a host for the **Next.js** app (Vercel, a container, ...), and app-store accounts if you ship the Flutter apps.
- Optional: **Tesseract** installed in the API image if you want OCR for scanned statements (`OCR_ENABLED=true`).

## 1. Database
1. Apply `supabase/migrations/*.sql` in order (SQL editor or `supabase db push`). They create the `cashbook` and `analyzer` schemas, enable RLS on every table and grant nothing to `anon`/`authenticated`: all access goes through the API.
2. Do **not** expose the custom schemas in the Supabase Data API.
3. Confirm: `/api/v1/ready` returns 200 once the API is running.
4. Backups: turn on Supabase point-in-time recovery or scheduled backups. Deleting a user in Supabase cascades to all of their rows.

## 2. API (`backend/`)
Environment (never commit; see `backend/.env.example`):

| Variable | Notes |
|---|---|
| `APP_ENV` | `production` |
| `DATABASE_URL` | `postgresql+psycopg://...` (pooler URL) |
| `SUPABASE_URL` | used for JWKS and for the Admin API (account deletion) |
| `SUPABASE_JWT_SECRET` | only for legacy HS256 projects; leave empty when using JWKS |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only**; enables `DELETE /me/account`. Without it that endpoint answers 501 |
| `CORS_ORIGINS` | exact origins of the web app (and Flutter web), comma-separated |
| `OCR_ENABLED`, `MAX_UPLOAD_MB`, `MAX_PDF_PAGES`, `PROCESSING_TIMEOUT_S` | processing limits |

Run: `pip install -r requirements.txt` then `uvicorn app.main:app --host 0.0.0.0 --port 8000` behind HTTPS (a reverse proxy or the platform's TLS).

Production notes:
- Run more than one worker/instance only after moving the in-memory **rate limiters** to a shared store (see `docs/security.md`).
- Statement parsing runs in-process; for hostile-input hardening run the API in a container with CPU/memory limits (and consider a sandboxed worker for PDFs).
- Logs contain method, path, status and request id only. Keep it that way in any log shipper configuration.
- Health checks: `/api/v1/health` (liveness), `/api/v1/ready` (database).

## 3. Web app (`apps/statement_analyzer_web/`)
Build-time variables (public values only): `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
`npm ci && npm run build && npm start` (or deploy to Vercel). Serve over HTTPS only. In Supabase Auth settings add the web origin to the redirect allow-list, and configure SMTP so confirmation and password-reset e-mails are delivered.

## 4. Flutter app (`apps/cashbook_flutter/`)
Pass public values with `--dart-define`: `API_BASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
- Web: `flutter build web --dart-define=...` and host the `build/web` folder over HTTPS.
- Windows: `flutter build windows --dart-define=...` (build from a short path; see the setup guide).
- Android / iOS: `flutter build appbundle` / `flutter build ipa`. Requires the Android SDK licences (`flutter doctor --android-licenses`) and, for iOS, macOS with Xcode. **Not built or tested on this machine.** Tokens are stored in the platform keystore/keychain through `flutter_secure_storage`.
- Never put the service-role key in any client.

## 5. Go-live checklist
- [ ] Migrations applied; `/api/v1/ready` = 200
- [ ] Sign-up, e-mail confirmation, sign-in, password reset work end to end against the real project (never exercised here)
- [ ] Web and Flutter share one profile (change the name in one app, see it in the other)
- [ ] Upload a real statement from each bank you care about and check the reconciliation status; add bank-specific fixtures if parsing is wrong
- [ ] If you need scanned statements: Tesseract installed, `OCR_ENABLED=true`, accuracy measured on real scans (never measured here)
- [ ] CORS origins exact; HTTPS everywhere; no secrets in the repo or in client bundles
- [ ] `DELETE /me/account` verified with the real service-role key on a throwaway user
- [ ] Backups on; a restore rehearsed
- [ ] Screen-reader pass (NVDA/VoiceOver/TalkBack) and a real-device pass on the Flutter apps
- [ ] Legal: privacy policy and terms; the app stores extracted transactions, not original files (see `docs/security.md`)

## 6. Local verification without Supabase
`backend/scripts/dev_server.py` starts a real PostgreSQL 16 with every migration applied and Supabase Auth/Storage stand-ins, which is how the end-to-end suites in this repo were run. It proves the SQL, constraints, RLS and the app logic; it does not prove Supabase itself.

## Ledgerline
Ledgerline uses the same API and Supabase project. Apply the two `ledger` migrations and deploy `apps/ledgerline_web` as in section 3. Details, monitoring and backup/recovery: [`docs/ledgerline.md`](ledgerline.md).
