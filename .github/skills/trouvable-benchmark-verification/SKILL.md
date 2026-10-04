---
name: trouvable-benchmark-verification
description: Verify AI benchmark results, performance metrics, and comparative claims against actual measured data.
---

# Benchmark Verification Skill

## When to use

- When audit reports include performance scores or benchmark comparisons
- When AI-generated content claims specific metrics or improvements
- When displaying comparison data between AI providers (Mistral, Groq, Gemini)
- When presenting client performance data in portal or admin dashboards
- Before publishing any quantitative claim about SEO/GEO results

## Critical rule

**Never present estimated, projected, or AI-hallucinated numbers as measured facts.** Every quantitative claim must trace back to a real data source.

## Steps

### 1. Identify the claim

For every benchmark or metric displayed:

- What is the exact claim? (e.g., "SEO score: 87/100", "45% improvement")
- Where does it appear? (Admin dashboard, portal, audit report, GEO page)
- What component renders it? (React component path)
- What data source feeds it? (Supabase query, API call, AI response)

### 2. Trace the data pipeline

```
Data source → Query/API → Server component/action → UI component
```

- **Supabase data** → verify the query returns actual stored values
- **AI-generated** → flag as "AI assessment" not "measured result"
- **Calculated** → verify the formula is applied to real inputs
- **Hardcoded** → flag for replacement with real data or removal
- **External API** → verify the API endpoint is real and responding

### 3. Classification

| Data type                          | Display rules                                            |
| ---------------------------------- | -------------------------------------------------------- |
| Measured data (from actual audits) | Display as fact with date                                |
| AI assessment                      | Label as "AI assessment" or "estimated"                  |
| Comparative data                   | Show methodology and date range                          |
| Projected/estimated                | Must include "estimated" qualifier                       |
| Missing data                       | Show "Data not available" — never fill with fake numbers |

### 4. LLM comparison specifics

For multi-LLM comparison features (`src/lib/llm-comparison/`):

- Each provider result must come from an actual API call
- Response times must be measured, not estimated
- Quality scores must use consistent evaluation criteria
- Cost calculations must use current pricing
- Do not fabricate provider comparisons that weren't actually run

### 5. Audit score verification

For audit scores (`src/lib/audit/`):

- Score must be calculated from actual page analysis
- Individual factor scores must sum/weight correctly to total
- Historical comparisons must use same methodology
- "Improvement" claims must compare same metrics at different dates

### 6. Output format

```markdown
## Benchmark Verification: [Feature/Report]

### Claims Found: N

| #   | Claim             | Source         | Verified | Issue            |
| --- | ----------------- | -------------- | -------- | ---------------- |
| 1   | "SEO score: 87"   | Supabase query | ✅       | -                |
| 2   | "45% improvement" | AI-generated   | ❌       | No baseline data |

### Data Pipeline:

- Source: [Supabase/AI/API/hardcoded]
- Query: [verified/unverified]
- Rendering: [correct/incorrect]

### Verdict: VERIFIED / PARTIALLY VERIFIED / UNVERIFIED
```

## References

- `src/lib/audit/` — audit score calculation
- `src/lib/llm-comparison/` — LLM provider comparisons
- `src/lib/continuous/` — continuous visibility metrics
- `src/lib/ai/` — AI response handling
- `src/app/admin/` — admin dashboards displaying metrics
- `src/app/portal/` — client portal displaying results
