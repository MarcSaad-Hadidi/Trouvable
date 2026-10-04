# Trouvable — Repository-wide Copilot instructions

## Identity

Trouvable is an operator tool for local visibility, SEO/GEO and audit intelligence. Production is a static parking page; the application and services are dormant. Do not reactivate deployments, cron, Supabase, providers or email for code validation.
Every change may affect real users, real search rankings, and real revenue.

## Stack

Next.js 16.3 App Router · React 19 · Tailwind 3 · Supabase (Postgres + RLS) · Clerk 7 · Vercel
Testing: Vitest · AI: Mistral, Groq, Gemini · Email: Resend · Bot protection: Cloudflare Turnstile

## MCP tool routing

Use an available MCP server when it is relevant to the task. The names below describe intended capabilities, not guaranteed tools in every environment. Inspect local code and installed documentation first when they answer the question; report unavailable capabilities instead of inventing results.

| Domain                                                        | MCP server            | When to use                                                                                                       |
| ------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| App Router, rendering, metadata, proxy, caching, revalidation | `Next DevTools MCP`   | When available; read the installed Next guides first                                                              |
| Browser DOM, console, network, layout                         | `Chrome DevTools MCP` | Runtime inspection, visual debugging                                                                              |
| E2E flows, interaction verification                           | `Playwright MCP`      | Flow testing, regression checks                                                                                   |
| Schema, RLS, policies, queries, auth                          | `Supabase MCP`        | Remote access only in a separately authorized operational task; use migrations and local mocks during hibernation |
| Production exceptions, stack traces                           | `Sentry MCP`          | Incident triage, regression detection                                                                             |
| Framework/library API correctness                             | `Context7`            | Before assuming any API behavior                                                                                  |
| Web search, external fact verification                        | `Tavily MCP`          | Only for genuine external validation                                                                              |
| Git history, PRs, issues, file contents                       | `GitHub MCP`          | Code tracing, history, coordination                                                                               |
| API contracts, endpoint testing                               | `Postman MCP`         | When API contract artifacts matter                                                                                |

**Rule:** Use relevant tools only when available and authorized. Hibernation forbids production IO and service revival for local validation. Remote mutations, deployment, billing and messages need explicit authorization; tool availability is not permission.

## Specialist agents

Route work to the right specialist — see `.github/agents/` for the full roster:

| Agent                    | Domain                                            |
| ------------------------ | ------------------------------------------------- |
| `trouvable-orchestrator` | Default entry point, triage and routing           |
| `trouvable-architect`    | Planning, new features, multi-file implementation |
| `trouvable-frontend`     | Premium UI/UX, components, visual polish          |
| `trouvable-data`         | Supabase, schema, RLS, auth, queries              |
| `trouvable-debug`        | Bugs, regressions, runtime failures               |
| `trouvable-seo-geo`      | Metadata, JSON-LD, GEO pages, citations           |
| `trouvable-billing`      | Stripe, plans, subscriptions, entitlements        |
| `trouvable-release`      | Merge confidence, release readiness               |

## Core principles

1. **Understand before changing** — inspect relevant files, trace the real execution path, explain the likely cause, propose a minimal plan, then implement.
2. **Smallest correct change** — prefer focused fixes; an explicitly requested structural refactor may regroup responsibilities when its benefit and preserved behavior are demonstrated.
3. **Truthfulness** — never fabricate metrics, SEO results, analytics, citations, benchmark outcomes, customer data, or structured data facts. If data is missing, say it is missing.
4. **Safety-first** — be conservative around auth, RLS, schema, caching, metadata, middleware, billing, and public-facing content.
5. **Reuse** — use existing utilities, hooks, services, and patterns before adding new abstractions.
6. **Validate** — recommend the smallest relevant validation after every meaningful change.

## Key files

| Purpose                                            | Location                                                              |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| Project rules & architecture                       | `AGENTS.md`                                                           |
| Engineering instructions                           | `.github/instructions/trouvable.instructions.md`                      |
| SQL history and retained reconstruction references | `supabase/migrations/`, `supabase/schema.sql`, `supabase/setup_*.sql` |
| Auth helpers                                       | `src/lib/auth.js`                                                     |
| Domain data modules                                | `src/lib/db/`                                                         |
| Service-role client                                | `src/lib/supabase-admin.js`                                           |
| Architecture and operating contracts               | `docs/architecture/` and `docs/operations/`                           |

## Git workflow

- Start new work from the latest `origin/main`: `feat/...`, `fix/...` or `refactor/...`.
- Continue an existing PR on its dedicated branch, preserving its commits and user changes.
- Commit messages: `type(scope): description` — types: feat, fix, refactor, docs, test, chore, perf, style
- Keep commits small and atomic — one logical change per commit
- No force-pushes to `main`
- Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and the hibernation validator before considering an application PR ready. Automatic Hibernation Gate is not application CI; the application job is manual and must not use production secrets or deploy.

## Environment & secrets

- Never hardcode secrets, API keys, or tokens in source files
- Use `.env.local` for local development, Vercel environment variables for production
- Reference secrets via `process.env.VARIABLE_NAME`
- Clerk keys: `NEXT_PUBLIC_CLERK_*` (client) and `CLERK_*` (server)
- Supabase keys: `NEXT_PUBLIC_SUPABASE_*` (anon) and `SUPABASE_SERVICE_ROLE_KEY` (service)
- Billing is not an active product integration; never connect payment secrets to validate a refactor.
