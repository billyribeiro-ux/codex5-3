# Atlas Transport Architecture Decisions

## 1) Persistence choice

**Decision:** SQLite with `better-sqlite3`

**Why:** zero external infrastructure, deterministic local setup, fastest path to runnable production-like transport architecture demo.

## 2) Validation boundary placement

**Decision:** Validation is centralized in `projectService` and not duplicated in transport layers.

**Why:** guarantees one source of truth for business rules regardless of transport path.

## 3) Remote function input validation mode

**Decision:** remote commands use `command('unchecked', ...)` and delegate validation to service layer.

**Why:** avoids split validation rules and enforces service-centric architecture.

## 4) Fallback policy

**Decision:** fallback occurs only after remote retries and only for retriable transport failures.

**Why:** preserves semantics for auth/validation/conflict errors and prevents hiding domain issues behind alternate transport.

## 5) Fallback transport preference by flow

**Decision:**
- Programmatic flows fallback to endpoint (`/projects`)
- Progressive enhancement create flow falls back to form action (`?/create`)

**Why:** endpoint is cleaner for typed programmatic calls; action is better for HTML-first form workflows.

## 6) Auth model for demo

**Decision:** hook-managed demo session cookie with server-side auth helper (`requireAuthenticatedUser`).

**Why:** keeps auth server-only and demonstrates proper layering without adding external auth services.

## 7) Webhook security

**Decision:** webhook secret read via `$env/dynamic/private` in `src/routes/webhooks/projects/+server.ts`.

**Why:** enforces secret isolation to server-only modules.

## 8) Version strategy

**Decision:** exact dependency pinning in `package.json` plus committed lockfile (`package-lock.json`).

**Why:** reproducible builds and deterministic CI/runtime behavior.
