---
name: trouvable-citations-debugging
description: Debug and verify AI-generated citations, source attributions, and factual references in audit and GEO content.
---

# Citations Debugging Skill

## When to use

- When AI-generated content includes citations or source references
- When debugging incorrect or missing citations in audit reports
- When verifying factual claims in GEO content or case studies
- When citations link to non-existent or incorrect URLs
- When audit reports contain benchmark data that needs verification

## Context

Trouvable uses multiple AI providers (Mistral, Groq, Gemini) for audit intelligence and content generation. AI-generated citations are a known reliability risk — they may reference non-existent sources, misattribute claims, or fabricate benchmark data.

## Steps

### 1. Identify citation sources

- Trace where citations originate in the pipeline:
  - `src/lib/ai/` — AI prompt construction and response parsing
  - `src/lib/audit/` — Audit report generation
  - `src/lib/continuous/` — Continuous visibility engine
  - `src/lib/seo/` — SEO content generation
- Identify the AI provider used for the specific content
- Check prompt templates for citation instructions

### 2. Classify citation types

| Type | Risk level | Verification |
|---|---|---|
| URL citations | HIGH — AI frequently fabricates URLs | HTTP HEAD check or flag as unverified |
| Publication references | HIGH — names/dates may be fabricated | Cross-reference with known sources |
| Statistical claims | MEDIUM — numbers may be hallucinated | Trace to database or external source |
| Best practice references | LOW — generally accurate patterns | Verify against industry standards |
| Internal data references | LOW — traceable to Supabase | Verify query returns expected data |

### 3. Debug missing or wrong citations

1. Check AI prompt — does it instruct the model to cite sources?
2. Check response parsing — are citations being extracted correctly?
3. Check rendering — are citation components displaying the right data?
4. Check database — if citations are stored, verify the stored values
5. Check for templating errors — citation placeholders not filled

### 4. Fix patterns

**For fabricated URLs:**
```javascript
// DON'T: Include unverified AI-generated URLs
citation: { url: aiResponse.sourceUrl } // May not exist

// DO: Flag as AI-generated or omit
citation: { source: aiResponse.sourceName, verified: false }
```

**For statistical claims:**
```javascript
// DON'T: Present AI estimates as measured facts
"Your SEO score improved by 47%" // Fabricated number

// DO: Use actual measured data or qualify
"Based on our latest audit data..." // With real supabase query backing it
```

### 5. Verification output

```markdown
## Citations Audit: [Feature/Report]

### Sources Found: N
| # | Type | Content | Source | Verified |
|---|---|---|---|---|
| 1 | URL | "..." | AI-generated | ❌ |
| 2 | Stat | "..." | Supabase query | ✅ |

### Issues:
1. [Issue description + location in code]

### Recommendations:
1. [Fix + risk level]

### Verdict: VERIFIED / PARTIAL / UNRELIABLE
```

## References

- `src/lib/ai/` — AI integration layer
- `src/lib/audit/` — Audit report generation
- `src/lib/continuous/` — Continuous visibility engine
- `src/lib/seo/` — SEO content utilities
- `.github/agents/trouvable-seo-geo.agent.md` — SEO/GEO specialist
