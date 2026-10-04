---
applyTo: "src/app/**,src/features/**,src/components/**,src/proxy.js,next.config.*,src/lib/actions/**"
---

# Next.js App Router instructions

Read the relevant `node_modules/next/dist/docs/` guide before writing framework code. Preserve the dormant application and static hibernation contract; no service revival is implied by these instructions.

## Server vs Client components

- **Default is server** — only add `'use client'` when the component needs browser APIs, hooks, or event handlers.
- Never import server-only modules (`src/lib/db/*`, `src/lib/supabase-admin.js`, `src/lib/auth.js`) in client components.
- Keep `'use client'` components as leaf nodes — push interactivity to the smallest possible boundary.
- Use `src/components/ui/` primitives for reusable client-side elements.

## Data fetching

- Keep privileged data access in server components, route handlers or server actions. Client fetching is valid for interactive navigation and existing operator slices; preserve authorization, loading/error states and protection against stale responses when the client changes.
- Use server actions (`src/lib/actions/`) for mutations from client components.
- For initial server data, fetch in `page.jsx` or `layout.jsx` and pass safe props. Preserve intentional lazy loading and client-context refreshes.
- For static data with revalidation: use `export const revalidate = <seconds>`.

## Route structure

```
src/app/
├── layout.jsx          # Root metadata, globals and public providers
├── page.jsx            # Homepage
├── admin/              # Operator workspace (Clerk email-gated)
├── portal/             # Client read-only portal (membership-scoped)
├── api/                # Route handlers
├── villes/             # GEO city pages
├── expertises/         # GEO expertise pages
├── a-propos/           # About
├── contact/            # Contact form
├── methodologie/       # Methodology
├── offres/             # Offers/pricing
├── etudes-de-cas/      # Case studies
├── notre-mesure/       # Custom measurement
```

## Metadata

- Metadata may be inherited from layouts or supplied by framework file conventions. Add page exports when the route needs distinct metadata; do not duplicate valid inherited definitions.
- Use `generateMetadata()` when metadata depends on dynamic data (for example villes or expertises); retain server boundaries and truthful canonical URLs.
- Metadata must be truthful — no fabricated page titles, descriptions, or structured data.
- JSON-LD structured data: use `<script type="application/ld+json">` in page components.
- Check `src/lib/seo/` for shared metadata utilities.

## Proxy

- Next 16 Proxy lives at `src/proxy.js`, beside `src/app`. Read the installed proxy guide; do not restore the deprecated middleware convention.
- Clerk auth middleware handles route protection.
- Do not add heavy logic to middleware — keep it fast.
- Admin routes: gated by Clerk email allowlist.
- Portal routes: gated by server-resolved membership scope.

## Caching and revalidation

- Static pages: default Next.js caching behavior.
- Dynamic pages with ISR: use `revalidate` export.
- On-demand revalidation: use `revalidatePath()` or `revalidateTag()` in server actions.
- Never share personalized responses between users. Preserve the installed Next runtime behavior of authentication APIs and existing cache/revalidation contracts.
- For authenticated handlers, verify request-time execution and response caching against the installed guides; use explicit dynamic configuration where needed, without adding unrelated exports mechanically.

## Server actions

- Define in `src/lib/actions/` — not inline in components.
- Always validate inputs server-side (use `src/lib/admin-schemas.js` patterns).
- Preserve each action's structured response contract (for example `{ error }` or `{ success, data, error }`); display safe validation and execution feedback in the consuming UI.
- Handle Supabase errors explicitly — never let them bubble unhandled.

## Error handling

- Use `error.jsx` boundary files for route-level error handling.
- Use `not-found.jsx` for 404 states.
- Use `loading.jsx` for suspense boundaries on dynamic routes.
- API routes: return appropriate HTTP status codes (400, 401, 403, 404, 500).

## Performance

- Prefer `next/image` for application images when its optimization fits the source and layout. `ImageResponse` uses its own supported rendering elements, including `<img>`; preserve deliberate raw images when their runtime/source requires them, with dimensions and alt text as appropriate.
- Use `next/link` for internal navigation — never raw `<a>` tags for internal routes.
- Lazy-load heavy components where appropriate. Use `ssr: false` only inside client components when the component requires browser-only rendering; preserve server rendering for public content and metadata.
- Minimize client-side JavaScript — prefer server rendering.

## Vercel deployment

- Check `vercel.json` for custom configuration.
- Environment variables: set in Vercel dashboard, reference via `process.env`.
- Proxy uses the runtime supported by the installed Next version; do not assume middleware edge behavior.
- Application check: `npm run build`, plus lint/typecheck/tests. Production hibernation deploys `parking/` through `node scripts/validate-hibernation.mjs`, without npm or Next. Do not change that contract or deploy to validate a refactor.
