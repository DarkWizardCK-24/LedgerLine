# Architecture
Modular monolith. One FastAPI service (`/api/v1/*`), one Supabase project (Auth + Postgres + Storage).
Schemas: `public.profiles` (shared identity), `cashbook.*`, `analyzer.*`, `audit.*`. No cross-writes between
cashbook and analyzer except the explicit, idempotent, audited import flow (Phase 7).
Clients never hold service-role keys; FastAPI verifies Supabase JWTs and enforces ownership.
