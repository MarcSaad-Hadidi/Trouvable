---
description: 'Add a new expertise to the platform with page, data, and navigation'
agent: 'agent'
---

# New Expertise

## Input

- **Expertise name**: `{{ expertiseName }}`
- **Slug**: `{{ slug }}`
- **Category**: `{{ category }}`

## Implementation steps

### 1. Data layer

- Add the expertise to the database or config where expertises are defined.
- Verify the entry includes: slug, display name, description, category.
- If Supabase-backed: add via migration script in `supabase/`.

### 2. GEO page

- Inspect the existing dynamic entry `src/app/expertises/[expertiseSlug]/page.jsx` and `src/features/public/expertise/` before adding a route.
- Ensure `generateMetadata()` returns proper title, description, and OG data.
- Add JSON-LD (`Service` schema) with truthful data only.

### 3. Cross-linking

- Link to/from relevant existing city pages (`src/app/villes/[villeSlug]/`). A city × expertise route is prospective and requires an explicit scope decision.
- Add to any expertise listing or navigation components.
- Update internal link meshes on existing GEO pages.

### 4. Sitemap

- Verify the new expertise appears in `src/app/sitemap.js` output.

### 5. Validation

- `npm run lint` — no errors
- `npm run dev` — page renders correctly
- Metadata is correct in page source
- JSON-LD is valid (no fabricated data)

## Rules

- Follow existing expertise page patterns exactly.
- Never fabricate business counts, case studies, or testimonials.
- Reuse the same components and Tailwind tokens as existing expertise pages.
