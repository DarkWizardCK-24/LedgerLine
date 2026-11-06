# Setup guide

Prerequisites: Flutter 3.47+, Node 22+, Python 3.10+, Git. Optional later: Supabase CLI, Tesseract (OCR, Phase 5).

## Backend
```
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env      # fill in Supabase values
uvicorn app.main:app --reload --port 8000
pytest
```
Health: http://localhost:8000/api/v1/health · Readiness (DB): `/api/v1/ready` · Docs: `/docs`

## Web (Analyzer)
```
cd apps/statement_analyzer_web
copy .env.example .env.local
npm run dev        # http://localhost:3000
```

## Flutter (CashBook)
```
cd apps/cashbook_flutter
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:8000
```

## Local backend without Supabase (real Postgres)
`pip install pgserver` bundles PostgreSQL 16. `python scripts/dev_server.py --port 8010 --seed-user <uuid>` (in `backend/`) starts a throwaway database with every migration applied and the API on top of it; tokens are verified with `SUPABASE_JWT_SECRET` (defaults to the e2e test secret). Sign-in is **not** real there, and users must be pre-seeded because nothing creates them at sign-up. `DATABASE_URL=sqlite:///…` also works for quick runs but creates no tables.
End-to-end: build the web app with `NEXT_PUBLIC_API_BASE_URL=http://localhost:8010` and the mock Supabase URL, `npm start`, then `node e2e/phase5.js` and `node e2e/phase6.js` — each needs a **fresh** dev server (`--seed-user 11111111-1111-4111-8111-111111111111 --seed-user 22222222-2222-4222-8222-222222222222`).

## Flutter against the real backend
Signed-in users read and write through the API; sample mode (no Supabase configured and `START_IN_DEMO=true`) keeps the in-memory sample data.
```bash
cd apps/cashbook_flutter
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:8010 \
  --dart-define=SUPABASE_URL=https://<project>.supabase.co --dart-define=SUPABASE_ANON_KEY=<anon key>
# data layer vs a real API + Postgres (token for a seeded user, HS256 with the dev secret):
E2E_API_URL=http://localhost:8010 E2E_TOKEN=<jwt> flutter test test/live_backend_test.dart
```
On Windows the plugin build can exceed the 260-character path limit when the repo is deeply nested: build from a short path (e.g. copy `lib`, `windows`, `assets`, `web`, `pubspec.*` to `C:\cb`) or enable long paths.

## Database
Create a Supabase project, then apply `supabase/migrations/*.sql` (SQL editor or `supabase db push`).
Custom schemas are not exposed via the Data API by design; all access goes through FastAPI.


## Accounts (Supabase Auth) — one project for both apps
1. Create a Supabase project and apply `supabase/migrations/*.sql`.
2. In Authentication → Providers keep Email enabled. Decide whether email confirmation is required: if it is, sign-up shows "check your inbox" instead of signing in immediately.
3. Backend `.env`: `SUPABASE_URL`, `SUPABASE_JWT_SECRET` (legacy secret) — asymmetric signing keys are verified automatically through the project's JWKS endpoint.
4. CashBook: `--dart-define=SUPABASE_URL=… --dart-define=SUPABASE_ANON_KEY=…`. Analyzer: `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`. Both take the **same public key**.
5. Never ship the service-role key to either client.

Both apps then share users, sessions' tokens (issued by the same project) and the profile row behind `/api/v1/profiles/me`.


## Statement processing & OCR
Python dependencies are in `requirements.txt` (pypdf, PyMuPDF, openpyxl, xlrd, msoffcrypto-tool, Pillow, pytesseract, python-multipart).

OCR is **off by default**. To enable it for scanned PDFs:
1. Install Tesseract — Windows: `winget install UB-Mannheim.TesseractOCR` (add it to `PATH`); macOS: `brew install tesseract`; Debian/Ubuntu: `sudo apt install tesseract-ocr`.
2. Verify: `backend/.venv/Scripts/python -c "import pytesseract; print(pytesseract.get_tesseract_version())"`.
3. Set `OCR_ENABLED=true` in `backend/.env`.

Limits (env, optional): `MAX_UPLOAD_MB=25`, `MAX_PDF_PAGES=100`, `PROCESSING_TIMEOUT_S=30`.
