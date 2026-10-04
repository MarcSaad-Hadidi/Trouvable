---
applyTo: 'src/app/**,src/features/**,src/components/**,src/lib/**,src/proxy.js,scripts/**,supabase/**,sql/**,tests/**,next.config.*,tailwind.config.*,postcss.config.*,vercel.json'
---

# Trouvable engineering instructions

## Hibernation

- Preserve the static parking, disabled deployments and dormant services. Local validation does not authorize remote calls, migrations, email or service revival.
- Read AGENTS.md and the relevant installed Next guide before framework changes.

## App Router architecture

- Preserve correct server/client component boundaries.
- Do not move logic to the client unnecessarily.
- Prefer server-side data access when appropriate.
- Avoid patterns that conflict with App Router or Vercel deployment.

## Supabase safety

For any schema, policy, auth, or query change — follow the workflow in `supabase.instructions.md`.
When touching Supabase from `src/lib/` code: inspect affected migrations and query/auth contracts, explain RLS impact, and propose SQL explicitly only if schema, policies or stored data must change. During hibernation, validate with local fixtures or a disposable local database; no remote mutation or service revival is authorized.

## SEO/GEO truthfulness

When touching metadata, JSON-LD, citations, GEO pages, local business info, expertises, or entity descriptions:

- Only use data that is actually present, verified, or explicitly provided.
- Do not add placeholder values disguised as real content.

## Coding style

- Write clean, production-appropriate code.
- Prefer readable code over clever code.
- Avoid unnecessary abstractions and duplicate logic.
- Keep functions focused, components cohesive.
- Preserve semantic HTML where relevant.
- Keep Tailwind usage organized and readable.
- Avoid introducing dependencies unless strongly justified.
- Match local repo style — do not reformat unrelated areas, rename unrelated symbols, or move files unless necessary.

## Frontend expectations

- Preserve or improve visual polish.
- Do not produce generic-looking interfaces — maintain premium product feel.
- Keep layouts aligned with current design direction.
- Preserve accessibility basics.
- Avoid fragile UI logic.
- Verify interactive states when relevant.
- For front-end bugs: inspect real browser behavior before guessing.

## Backend expectations

- Trace the request/data path fully.
- Identify where state is created, transformed, and consumed.
- Verify assumptions against schema and code.
- Call out side effects.
- Do not silently weaken security or policy behavior.

## Testing expectations

Use effort proportional to the change:

- Small fix → targeted validation
- Moderate feature → targeted test coverage + flow check
- Risky refactor → broader regression suggestions

Prefer tests that validate actual behavior, not superficial implementation details.

## Anti-patterns

Do NOT:

- Make large rewrites for small problems
- Propose destructive SQL casually
- Weaken RLS or auth without explicit justification
- Invent missing data or present assumptions as facts
- Touch unrelated files for style-only reasons
- Recommend over-engineered solutions when simple ones work

## Decision rules

If uncertain → inspect more before changing.
If multiple valid solutions → choose lowest risk, smallest footprint.
If production-sensitive → be conservative, explain impact, validate carefully.
