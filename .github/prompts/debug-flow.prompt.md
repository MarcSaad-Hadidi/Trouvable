---
description: "Structured debugging workflow for reproducing, diagnosing, and fixing a bug"
agent: "agent"
---

# Debug Flow

## Bug report

- **Symptom**: `{{ symptom }}`
- **Route / component**: `{{ location }}`
- **Steps to reproduce**: `{{ steps }}`

## Procedure

### Phase 1 — Reproduce
1. Read the relevant source files to understand current behavior.
2. Check Sentry MCP for matching exceptions if available.
3. If possible, reproduce via Playwright MCP or browser inspection.
4. Confirm: can the bug be reproduced? If not, document what was tried.

### Phase 2 — Diagnose
1. Trace the execution path from the entry point (route handler, page, component) to the failure.
2. Check for common Trouvable bug patterns:
   - RLS policy blocking expected data
   - Supabase `error` field not checked before using `data`
   - Hydration mismatch from `'use client'` / server boundary
   - Clerk auth state not available where expected
   - JSON-LD or metadata using undefined variables
   - Future Stripe webhook missing idempotency check, only if separately implemented (Stripe is currently not implemented or connected)
3. Identify the **root cause**, not just the symptom.

### Phase 3 — Fix
1. Propose the **smallest change** that fixes the root cause.
2. Identify regressions the fix could cause.
3. Implement the fix.
4. Verify with `npm run lint` and relevant test if one exists.

## Output format

```
**Symptoms**: ...
**Root cause**: ...
**Fix**: ... (file + specific change)
**Regressions checked**: ...
**Validation**: ...
```
