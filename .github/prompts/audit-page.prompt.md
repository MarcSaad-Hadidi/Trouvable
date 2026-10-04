---
description: 'Run a structured audit on a specific page or route'
agent: 'agent'
---

# Audit Page

## Target

Audit the page at: `{{ route }}`

## Audit procedure

Run through each audit dimension sequentially:

### 1. Technical SEO

- [ ] `generateMetadata()` present and correct (title, description, OG)
- [ ] JSON-LD valid and truthful
- [ ] Canonical URL set
- [ ] Heading hierarchy (single H1, logical H2-H3)
- [ ] Internal links functional

### 2. Performance

- [ ] No unnecessary `'use client'` — prefer server components
- [ ] Images use `next/image` with proper sizing
- [ ] Heavy components lazy-loaded or behind dynamic imports
- [ ] No layout shift triggers

### 3. Accessibility

- [ ] Color contrast meets WCAG AA
- [ ] Interactive elements keyboard-accessible
- [ ] Images have alt text
- [ ] Form inputs have labels

### 4. Code quality

- [ ] No duplicated logic — reuses existing utils/components
- [ ] Error boundaries (`error.jsx`, `not-found.jsx`) in place
- [ ] Loading states for async data
- [ ] Clean separation of server/client responsibilities

### 5. Data integrity

- [ ] Supabase queries check `error` before using `data`
- [ ] No fabricated metrics or citations
- [ ] User-facing data matches database source of truth

## Output

Produce a scorecard:

```
| Dimension        | Score | Issues |
|-----------------|-------|--------|
| Technical SEO   | X/10  | ...    |
| Performance     | X/10  | ...    |
| Accessibility   | X/10  | ...    |
| Code quality    | X/10  | ...    |
| Data integrity  | X/10  | ...    |
```

Then list actionable fixes ordered by impact.
