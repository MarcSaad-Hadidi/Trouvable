---
name: trouvable-next-audit
description: Audit a Next.js App Router page for metadata, performance, accessibility, and SEO compliance.
---

# Next.js Audit Skill

## When to use

- Before deploying a new page or layout
- After significant changes to metadata, structured data, or rendering strategy
- When investigating SEO regressions or performance degradation
- During periodic quality reviews of public-facing pages

## Steps

### 1. Metadata audit

- Verify `metadata` or `generateMetadata()` is exported
- Check title follows pattern: `"Page Title | Trouvable"`
- Check description is present, unique, and under 160 characters
- Verify Open Graph tags (og:title, og:description, og:image)
- Check canonical URL is correct

### 2. Structured data audit

- Verify JSON-LD is present if page type requires it (LocalBusiness, FAQPage, Service, BreadcrumbList)
- Validate JSON-LD against schema.org requirements
- Confirm all data is truthful — no fabricated ratings, addresses, phone numbers, or review counts
- Check for duplicate structured data blocks

### 3. Component boundaries

- Verify server/client split is correct — no unnecessary `'use client'`
- Check that server-only imports (`src/lib/db/*`, `src/lib/supabase-admin.js`, `src/lib/supabase/server.js`) are not in client components
- Verify data fetching happens server-side

### 4. Performance check

- Images use `next/image` with proper sizing
- Links use `next/link`
- Heavy components are lazy-loaded where appropriate
- No unnecessary client-side JavaScript
- Check for layout shift risks (missing width/height on images)

### 5. Accessibility basics

- Headings follow logical hierarchy (h1 → h2 → h3)
- Images have meaningful alt text
- Interactive elements are keyboard-accessible
- Color contrast meets WCAG AA
- Forms have proper labels

### 6. Output format

```markdown
## Audit: [Page Path]

### Metadata: ✅/⚠️/❌
- Title: ...
- Description: ...
- OG tags: ...

### Structured data: ✅/⚠️/❌
- Type: ...
- Truthfulness: ...

### Components: ✅/⚠️/❌
- Server/client split: ...

### Performance: ✅/⚠️/❌
- Images: ...
- Lazy loading: ...

### Accessibility: ✅/⚠️/❌
- Headings: ...
- Alt text: ...

### Verdict: PASS / NEEDS WORK / FAIL
```

## References

- `src/app/` — page components
- `src/lib/seo/` — SEO utilities
- `.github/instructions/nextjs.instructions.md` — App Router rules
