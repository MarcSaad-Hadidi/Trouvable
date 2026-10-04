# AGENTS.md

## Stack

Next.js 16.3 App Router · React 19 · Tailwind 3 · Supabase · Clerk 7 · Vercel
Testing: Vitest · AI: Mistral, Groq, Gemini · Email: Resend · Bot protection: Cloudflare Turnstile

## Build & Test

```bash
npm run dev        # local dev server
npm run build      # production build
npm run typecheck  # Next route types + configured TypeScript program
npm run lint       # ESLint (JS/JSX/TS/TSX), zero warnings
npm run lint:fix   # ESLint autofix
npm test           # vitest run
npm run test:watch # vitest watch
npm run verify    # serial format/lint/types/tests/build/hibernation/repository checks
```

Use Node.js 24.19.0 (`.node-version`) and npm 11.6.2 (`packageManager`). See [CONTRIBUTING.md](CONTRIBUTING.md#commandes-de-vérification) for each check's scope and limits. Do not run typecheck and build concurrently: both write Next route types.

## Architecture

- **`src/app/`** — Next.js App Router (pages, layouts, route handlers)
    - `admin/` — operator workspace (Clerk email-gated)
    - `portal/` — client read-only portal (membership-scoped)
    - `api/` — route handlers
    - SEO/GEO pages: `villes/`, `expertises/`, `a-propos/`, `contact/`, `methodologie/`, `offres/`, `etudes-de-cas/`, `notre-mesure/`
- **`src/lib/`** — server-only logic, data access, AI, server actions
    - `auth.js` — Clerk helpers · `db/*` — domain data access · `supabase-admin.js` — service-role client
    - `db/`, `actions/`, `queries/` — domain data modules
    - `ai/`, `audit/`, `continuous/`, `seo/`, `llm-comparison/` — feature modules
- **`src/components/`** — React components (server by default, `'use client'` explicit)
    - `ui/` — reusable primitives · `shared/` — cross-product components; product implementations live in `src/features/`
- **`supabase/`** — schema DDL, setup scripts, migrations
- **`src/features/`** — public, admin, portal, espace, auth product surfaces; admin sections live directly under `src/features/admin/`
- **`src/proxy.js`** — Clerk request boundary and application security headers
- **`parking/`** — static production during hibernation
- **`docs/`** — durable architecture, domain contracts and operations

Key docs: [architecture](docs/architecture/current-structure.md) · [decisions](docs/architecture/refactor-decisions.md) · [development](CONTRIBUTING.md) · [hibernation](docs/operations/trouvable-hibernation.md)

## Hibernation boundary

- Production serves only `parking/`; application and services remain dormant.
- Do not reactivate deployments, cron, Supabase, provider calls or email to validate a refactor.
- Keep SQL migrations and historical setup scripts unless replacement is proved on a disposable local database; never apply them remotely for this consolidation.
- Automatic CI validates hibernation; application validation is manual in the same workflow, without production secrets or deployment.
- Build without service secrets does not prove authenticated Clerk/Supabase behavior.

## Project-wide rules

- Respect existing architecture and file organization.
- Prefer small, focused changes over broad refactors.
- An explicitly requested refactor may regroup or rename internal responsibilities when the benefit is demonstrated and contracts are preserved.
- Reuse existing utilities, hooks, services, and patterns before adding new abstractions.
- Do not rename files, folders, exports, or public interfaces unless necessary.
- Understand before changing: inspect relevant files, identify the real execution path, explain the likely cause, propose a minimal plan, then implement.
- When changing behavior, identify likely regressions and mention them.
- If frontend and backend are both impacted, clearly separate responsibilities.
- Do not invent requirements not asked for.
- When uncertain, prefer the simplest implementation that fits the codebase.
- Assume changes may affect real users and real deployment — be conservative around auth, RLS, schema, caching, metadata, middleware, billing, and public-facing content.

## Factual integrity

Never fabricate: product metrics, SEO/GEO results, analytics, citations, benchmark outcomes, customer data, structured data facts, competitor claims.
If data is missing, say it is missing.

## Quality bar

- Avoid duplication.
- Preserve existing conventions.
- Favor maintainability over cleverness.
- Surface risks early.

## Output style

- Be direct and structured.
- Start by identifying impacted files.
- Explain the reasoning briefly.
- End with a short validation checklist.

## Git workflow

- Branch from the latest `origin/main`: `feat/short-description`, `fix/short-description`, or `refactor/short-description`
- Continue an existing PR on its dedicated branch and preserve its commits; do not restart an ongoing consolidation from `main`.
- Commit messages: `type(scope): description` — types: feat, fix, refactor, docs, test, chore, perf, style
- Keep commits small and atomic — one logical change per commit
- No force-pushes to `main`
- Run `npm run verify` before considering an application PR ready; use targeted checks during implementation and report any blocked validation.

## Error handling patterns

- **Server actions / route handlers**: return `{ error: string }` objects — never throw unhandled
- **Supabase queries**: always check `error` before using `data`
- **Client components**: wrap data-fetching in try/catch, show user-visible feedback
- **Page-level**: use `error.jsx` and `not-found.jsx` boundaries per route segment
- **API routes**: return structured `{ error, status }` JSON — never leak stack traces
- **Form validation**: validate at the boundary (server action), display inline errors client-side

## Environment & secrets

- Never hardcode secrets, API keys, or tokens in source files
- `.env.local` for local development, Vercel environment variables for production
- Reference via `process.env.VARIABLE_NAME`
- Clerk: `NEXT_PUBLIC_CLERK_*` (client), `CLERK_*` (server)
- Supabase: `NEXT_PUBLIC_SUPABASE_*` (anon), `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (server service client)
- Billing is not an active product integration; never add or connect payment secrets to validate a refactor.
- AI: `MISTRAL_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY` (all server-only)

## Admin shell scroll model (do not break)

The admin workspace uses a fixed three-tier scroll model. Operator pages
must respect it or scroll will break in production:

1. **`.geo-shell`** — `height: 100vh; overflow: hidden`. Always full viewport, never scrolls.
2. **`.geo-main`** — flex column, `min-height: 0; overflow: hidden`. Hosts the chrome (CommandStrip / MissionCommandHeader) and the content viewport.
3. **`.geo-content`** — the **single** `overflow-y: auto` viewport. Every operator page is rendered inside it.

Root admin pages use [AdminPageViewport](src/features/admin/shared/layout/AdminPageViewport.jsx); client layouts use [ClientWorkspaceShell](src/features/admin/shared/layout/ClientWorkspaceShell.jsx). Feature views must not add a second viewport.

Rules for pages and feature components rendered inside `.geo-content`:

- Do **not** set `h-screen`, `max-h-screen`, or `overflow-y-auto` on a top-level page wrapper. The shell already owns the scroll.
- Use `min-h-0` on flex children that must shrink (e.g. nested column layouts inside drawers or two-pane shells).
- Inner `overflow-hidden` is fine on cards, charts, and decorative containers — but never on the page-root element.
- Drawers (e.g. `EvidenceDrawer`) own their own scroll via a portal and `overscroll-behavior: contain`. Do not duplicate that pattern at page level.
- [CommandPageShell](src/features/admin/shared/components/command/CommandPageShell.jsx) is a layout-only wrapper with no `overflow`.

When in doubt: render plain content inside `<CommandPageShell>` and let `.geo-content` scroll the viewport.

## Validation

After meaningful changes, recommend the smallest relevant validation: `npm run lint`, targeted test, single route check, focused browser verification. Do not recommend heavy suites unless scope justifies it.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
