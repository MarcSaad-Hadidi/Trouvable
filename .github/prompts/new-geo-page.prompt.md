---
description: 'Scaffold a new city or expertise GEO page with metadata, JSON-LD, and SEO content'
agent: 'agent'
---

# New GEO Page

## Context

Create a new GEO landing page for Trouvable following existing patterns.

### Input

- **Type**: `city` | `expertise` | `city-expertise`
- **Slug**: `{{ slug }}`
- **Display name**: `{{ displayName }}`

## Steps

1. **Verify the page does not already exist** — check `src/app/villes/[villeSlug]/` and `src/app/expertises/[expertiseSlug]/`. City × expertise routes are prospective and do not exist today.

2. **Copy the nearest existing page** as a structural template. Reuse layout, metadata shape, and JSON-LD schema.

3. **Generate the page file** with:
    - `generateMetadata()` returning title, description, openGraph, alternates
    - JSON-LD (`LocalBusiness` or `Service` schema) with **only factual, verifiable data**
    - Semantic HTML structure matching existing GEO pages
    - Internal links to related city/expertise pages
    - CTA section with `ContactButton`

4. **Add the slug to `src/app/sitemap.js`** if not dynamically generated.

5. **Verify** — run `npm run lint` and check the page renders with `npm run dev`.

## Rules

- Never fabricate metrics, reviews, or business counts.
- Match existing Tailwind classes and design tokens.
- Follow `trouvable-seo-geo-truth` skill for truthfulness.
- If data is missing, show a placeholder clearly marked as "data needed."
