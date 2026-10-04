---
name: trouvable-seo-geo-truth
description: Verify SEO/GEO content truthfulness — metadata, JSON-LD, citations, entity descriptions, and local business data.
---

# SEO/GEO Truthfulness Verification Skill

## When to use

- When creating or modifying GEO pages (`src/app/villes/`, `src/app/expertises/`)
- When adding or changing JSON-LD structured data
- When touching metadata, citations, or entity descriptions
- When adding local business information (addresses, phone numbers, ratings)
- Before deploying any public-facing SEO/GEO content

## Critical rule

**Never fabricate:** phone numbers, ratings, review counts, citations, benchmark outcomes, addresses, business hours, competitor claims, customer data, or any structured data fact. If data is missing, say it is missing.

## Steps

### 1. Content source verification

- Identify the data source for every factual claim
- Trace factual data to its actual source (`client_geo_profiles`, verified provided content, etc.); historical `supabase/schema.sql` describes structure and does not prove current records.
- Cross-reference with `src/lib/seo/` utilities for data retrieval patterns
- Flag any content that appears to be placeholder or template data

### 2. JSON-LD validation

For every structured data block:

- Schema type is appropriate (LocalBusiness, Service, FAQPage, BreadcrumbList, etc.)
- `@context` is `"https://schema.org"`
- Required fields are present and truthful
- No fabricated `aggregateRating`, `review`, `priceRange`, or `openingHours`
- `address` matches actual business data
- `telephone` is a real, verified number or omitted entirely

### 3. GEO page checklist

For city/expertise pages:

- [ ] City name and region are correct
- [ ] No invented statistics about market presence
- [ ] Service descriptions match actual offerings
- [ ] FAQ answers are factual, not speculative
- [ ] Breadcrumb navigation is accurate
- [ ] Internal links point to existing pages
- [ ] Meta description reflects actual page content

### 4. Citation integrity

- Every citation must reference a real source
- No fabricated URLs, publication names, or author names
- If citation data comes from AI-generated content, flag it for human verification
- Benchmark results must be from actual measured data, not projections

### 5. Entity description rules

- Describe what the business actually does
- Use language that matches the brand voice
- Do not claim capabilities or results that aren't documented
- Keep descriptions consistent across pages (same business = same core facts)

### 6. Output format

```markdown
## Truthfulness Report: [Page/Feature]

### Data Sources: ✅/⚠️/❌

- Source: [database/API/hardcoded/unknown]
- Verified: [yes/no/partially]

### JSON-LD: ✅/⚠️/❌

- Schema type: ...
- Fabricated fields: [none/list]

### Citations: ✅/⚠️/❌

- Total: N
- Verified: N
- Flagged: N

### Verdict: TRUTHFUL / NEEDS REVIEW / VIOLATIONS FOUND
```

## References

- `src/app/villes/` — GEO city pages
- `src/app/expertises/` — GEO expertise pages
- `src/lib/seo/` — SEO utilities
- `supabase/migrations/` and `supabase/schema.sql` — schema references, not evidence of factual records
- `.github/agents/trouvable-seo-geo.agent.md` — SEO/GEO specialist agent
