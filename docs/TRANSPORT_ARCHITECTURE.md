# Atlas Transport Architecture

## Goal

The application uses **remote functions as the primary interactive RPC transport** with deterministic fallback to **form actions** and **+server endpoints** when transport-level failures occur.

All domain logic lives in one server-side service layer:

- `src/lib/server/services/projectService.ts`

Every transport calls that service layer:

- Remote functions: `src/routes/projects/projects.remote.ts`
- Form actions + initial SSR load: `src/routes/projects/+page.server.ts`
- Programmatic endpoint fallback: `src/routes/projects/+server.ts`
- External integration webhook endpoint: `src/routes/webhooks/projects/+server.ts`

## Version pinning strategy

Pinned in `package.json` (no `^` ranges):

- `svelte: 5.51.0`
- `@sveltejs/kit: 2.50.2` (>= 2.27, remote functions supported)

Lockfile policy:

- Canonical package manager is **npm**
- Commit `package-lock.json`
- Upgrade cadence: monthly minor/patch review, immediate security patch updates, major upgrades in dedicated migration PRs

## When to use load vs remote vs actions vs endpoints

| Mechanism | Use when | Notes |
|---|---|---|
| `+page.server.ts` load | Initial SSR data required for first paint | Used for initial projects list and request id |
| Remote functions (`query`/`command`) | Interactive reads/mutations from client UI | Primary transport path |
| Form actions (`+page.server.ts` actions) | HTML-first critical flows and progressive enhancement | Also used as fallback transport for create flow |
| `+server.ts` endpoints | Programmatic fallback path and external callers | Used as fallback for list/update/delete, and webhook integration |

## Fallback rules

Fallback is handled by `src/lib/client/callWithFallback.ts`.

### Decision tree

1. Try remote function first
2. Retry remote on retriable transport failure using bounded exponential backoff
3. If still failing and fallback transport is configured, call fallback
4. If fallback fails, surface AppError

### What triggers fallback

Fallback **is allowed** only for transport failures:

- network failures (`TypeError` from fetch stack)
- 5xx responses / retriable transport-class failures

### What does NOT trigger fallback

- `401/403` auth failures → no fallback, trigger re-auth flow
- `400` validation failures → no fallback, show field errors
- `409` conflict failures → no fallback, show conflict UI

## Error taxonomy

`src/lib/errors/appError.ts`

| Code | HTTP | Retriable | Fallback eligible | Typical UI behavior |
|---|---:|---:|---:|---|
| `TRANSPORT_FAILURE` | 5xx / network | ✅ | ✅ | Retry then fallback |
| `AUTH_UNAUTHORIZED` | 401 | ❌ | ❌ | Trigger re-auth flow |
| `AUTH_FORBIDDEN` | 403 | ❌ | ❌ | Trigger re-auth flow / forbidden message |
| `VALIDATION` | 400 | ❌ | ❌ | Show field-level errors |
| `CONFLICT` | 409 | ❌ | ❌ | Show conflict message / reconciliation UI |
| `NOT_FOUND` | 404 | ❌ | ❌ | Show not-found state |
| `INTERNAL` | 5xx or mapped unknown | context-dependent | usually ❌ unless mapped to transport failure | Generic error handling |

## Security model

- Auth derived server-side in `src/hooks.server.ts` and enforced via server-only auth helper: `src/lib/server/auth.ts`
- Service context is server-created: `src/lib/server/services/context.ts`
- No client-trusted input for domain operations (all service boundaries validated with Zod)
- Secret usage remains server-only (`$env/dynamic/private`) in webhook handler

## Observability

- Request IDs assigned in `src/hooks.server.ts` and returned as `x-request-id` response header
- Mutation audit events emitted in service layer (`project.audit` logs include action, projectId, userId, requestId)

## Projects module mapping

- Shared domain contracts: `src/lib/projects/contracts.ts`
- Service and validation: `src/lib/server/services/projectService.ts`
- UI demo (remote-first + optimistic updates + rollback + fallback): `src/routes/projects/+page.svelte`

## Testing coverage

- Unit: `src/lib/server/services/projectService.test.ts`
  - validation mapping to `AppError`
  - sqlite conflict mapping to `CONFLICT`
- Integration: `src/routes/projects/projects.transport.test.ts`
  - endpoint (`+server.ts`) create path
  - action (`+page.server.ts`) create path
