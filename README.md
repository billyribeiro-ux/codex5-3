# Atlas Transport Architecture (SvelteKit)

Production-grade reference implementation for a remote-first transport strategy in SvelteKit.

## Stack and version pinning

- `svelte: 5.51.0`
- `@sveltejs/kit: 2.50.2` (remote functions available since 2.27)
- TypeScript + Zod + SQLite (`better-sqlite3`)

All dependencies are pinned to exact versions in `package.json` and `package-lock.json` is committed for reproducibility.

## Architecture at a glance

- **Primary transport:** remote functions (`src/routes/projects/projects.remote.ts`)
- **Fallback transports:**
  - form actions (`src/routes/projects/+page.server.ts`) for HTML-first flows
  - endpoint POST (`src/routes/projects/+server.ts`) for programmatic fallback
- **Single source of business logic:** `src/lib/server/services/projectService.ts`

See full architecture documentation in `docs/TRANSPORT_ARCHITECTURE.md`.

## How to run

1. Install dependencies:

```sh
npm install
```

2. (Optional) configure env vars:

```sh
cp .env.example .env
```

3. Start dev server:

```sh
npm run dev
```

4. Open the demo UI:

- `http://localhost:5173/projects`

## Quality gates

Typecheck:

```sh
npm run check
```

Lint:

```sh
npm run lint
```

Tests:

```sh
npm test
```

## Additional docs

- `docs/TRANSPORT_ARCHITECTURE.md`
- `docs/DECISIONS.md`
