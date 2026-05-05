# AGENTS.md

## Stack

Next.js 16 App Router · React 18 · Tailwind 3 · Supabase · Clerk 7 · Vercel
Testing: Vitest · AI: Mistral, Groq, Gemini · Email: Resend · Bot protection: Cloudflare Turnstile

## Build & Test

```bash
npm run dev        # local dev server
npm run build      # production build
npm run lint       # ESLint
npm run lint:fix   # ESLint autofix
npm test           # vitest run
npm run test:watch # vitest watch
```

## Architecture

- **`app/`** — Next.js App Router (pages, layouts, route handlers)
  - `admin/` — operator workspace (Clerk email-gated)
  - `portal/` — client read-only portal (membership-scoped)
  - `api/` — route handlers
  - SEO/GEO pages: `villes/`, `expertises/`, `a-propos/`, `contact/`, `methodologie/`, `offres/`, `etudes-de-cas/`, `notre-mesure/`
- **`lib/`** — server-only logic, data access, AI, server actions
  - `auth.js` — Clerk helpers · `db.js` — Supabase facade · `supabase-admin.js` — service-role client
  - `db/`, `actions/`, `queries/` — domain data modules
  - `ai/`, `audit/`, `continuous/`, `seo/`, `llm-comparison/` — feature modules
- **`components/`** — React components (server by default, `'use client'` explicit)
  - `ui/` — reusable primitives · `portal/`, `premium/`, `audit/`, `offers/` — feature groups
- **`supabase/`** — schema DDL, setup scripts, migrations
- **`docs/`** — implementation plans, audits, technical specs

Key docs: [phase-3-implementation-plan](docs/phase-3-implementation-plan.md) · [continuous-visibility-engine-data-model](docs/continuous-visibility-engine-data-model.md) · [phase-3-1-quality-engine](docs/phase-3-1-quality-engine.md)

## Project-wide rules

- Respect existing architecture and file organization.
- Prefer small, focused changes over broad refactors.
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

- Branch from `main`: `feat/short-description` or `fix/short-description`
- Commit messages: `type(scope): description` — types: feat, fix, refactor, docs, test, chore, perf, style
- Keep commits small and atomic — one logical change per commit
- No force-pushes to `main`
- Run `npm run lint` and `npm test` before considering a PR ready

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
- Supabase: `NEXT_PUBLIC_SUPABASE_*` (anon), `SUPABASE_SERVICE_ROLE_KEY` (service)
- Stripe: `STRIPE_SECRET_KEY` (server), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (client)
- AI: `MISTRAL_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY` (all server-only)

## Admin shell scroll model (do not break)

The admin workspace uses a fixed three-tier scroll model. Operator pages
must respect it or scroll will break in production:

1. **`.geo-shell`** — `height: 100vh; overflow: hidden`. Always full viewport, never scrolls.
2. **`.geo-main`** — flex column, `overflow: hidden`. Hosts the chrome (MissionBar / MandateRibbon) and the content viewport.
3. **`.geo-content`** — the **single** `overflow-y: auto` viewport. Every operator page is rendered inside it.

Rules for pages and feature components rendered inside `.geo-content`:

- Do **not** set `h-screen`, `max-h-screen`, or `overflow-y-auto` on a top-level page wrapper. The shell already owns the scroll.
- Use `min-h-0` on flex children that must shrink (e.g. nested column layouts inside drawers or two-pane shells).
- Inner `overflow-hidden` is fine on cards, charts, and decorative containers — but never on the page-root element.
- Drawers (e.g. `EvidenceDrawer`) own their own scroll via a portal and `overscroll-behavior: contain`. Do not duplicate that pattern at page level.
- The unified `OperatorPageShell` wraps `.operator-shell`, which intentionally has no `overflow` — it is layout-only.

When in doubt: render plain content inside `<OperatorPageShell>` and let `.geo-content` scroll the viewport.

## Validation

After meaningful changes, recommend the smallest relevant validation: `npm run lint`, targeted test, single route check, focused browser verification. Do not recommend heavy suites unless scope justifies it.