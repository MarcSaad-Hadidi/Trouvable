---
name: trouvable-release-check
description: Pre-release validation checklist for deployment readiness — covers build, lint, tests, security, SEO, and domain-specific checks.
---

# Release Check Skill

## When to use

- Before merging a feature branch to `main`
- Before deploying to production via Vercel
- After completing a significant feature or refactor
- When assessing merge confidence for a PR

Production currently serves static `parking/`; the application and services are dormant. This guidance does not authorize deployment, remote database/provider calls, billing connections, or service revival. Keep validation local unless the user explicitly authorizes a separate operational task.

## Steps

### 1. Build verification

```bash
npm run build         # Must pass with zero errors
npm run lint          # Must pass with zero errors
npm run typecheck     # Generate Next route types and check TypeScript
npm test              # Must pass with zero failures
```

### 2. Domain-specific checklists

#### Auth & Security

- [ ] No secrets or API keys in source code
- [ ] Clerk request proxy routes are correctly protected
- [ ] Admin routes gated by email allowlist
- [ ] Portal routes gated by membership scope
- [ ] RLS policies unchanged or intentionally updated
- [ ] No new `dangerouslySetInnerHTML` without sanitization

#### SEO/GEO

- [ ] New pages have metadata (title, description, OG tags)
- [ ] JSON-LD structured data is truthful
- [ ] No fabricated citations, ratings, or business data
- [ ] `src/app/sitemap.js` and `src/app/robots.txt/route.js` valid for the application; production remains the static parking surface
- [ ] Internal links point to existing routes

#### Billing/Subscriptions (conditional future implementation)

Stripe checkout, subscription persistence, webhooks and entitlement enforcement are not implemented or connected today. Mark these checks N/A for current consolidation; apply them only to explicitly authorized future billing work.

- [ ] Stripe webhook handlers tested
- [ ] Plan entitlements correctly enforce access
- [ ] Checkout flows complete successfully
- [ ] No billing data exposed to unauthorized users

#### Database

- [ ] Schema changes have migration scripts
- [ ] Structural changes represented by ordered `supabase/migrations/`; historical schema/setup references preserved
- [ ] RLS not weakened
- [ ] Queries handle errors explicitly

#### UI/Frontend

- [ ] Responsive at mobile, tablet, and desktop
- [ ] Interactive states present (hover, focus, loading, error)
- [ ] No hydration mismatches
- [ ] No console errors in browser
- [ ] Accessibility basics intact (headings, labels, alt text)

### 3. Risk assessment

| Factor                      | Level     | Notes                                                        |
| --------------------------- | --------- | ------------------------------------------------------------ |
| Auth boundary change        | 🔴 HIGH   | Requires manual verification                                 |
| RLS policy change           | 🔴 HIGH   | Requires manual verification                                 |
| Future billing logic change | 🔴 HIGH   | Requires separately authorized Stripe test-mode verification |
| Schema migration            | 🟡 MEDIUM | Verify idempotency                                           |
| New public page             | 🟡 MEDIUM | SEO/metadata check required                                  |
| Component styling           | 🟢 LOW    | Visual regression check                                      |
| Internal refactor           | 🟢 LOW    | Test suite coverage                                          |

### 4. Merge confidence verdict

Based on checks above, assign one of:

- **✅ READY** — All checks pass, no open risks
- **⚠️ READY WITH VALIDATIONS** — Checks pass but manual verification recommended for specific areas
- **❌ NOT READY** — Failing checks or unresolved risks
- **🚫 BLOCKED** — Critical issues that prevent deployment

### 5. Output format

```markdown
## Release Check: [Branch/PR]

### Build: ✅/❌

### Lint: ✅/❌

### Tests: ✅/❌

### Domain Checks:

- Auth: ✅/⚠️/❌
- SEO/GEO: ✅/⚠️/❌
- Billing: ✅/⚠️/❌ (or N/A)
- Database: ✅/⚠️/❌ (or N/A)
- UI: ✅/⚠️/❌

### Risk Level: LOW / MEDIUM / HIGH

### Verdict: READY / READY WITH VALIDATIONS / NOT READY / BLOCKED

### Post-deploy verification (only for a separately authorized deployment):

1. [Specific route or flow to check]
```

## References

- `.github/agents/trouvable-release.agent.md` — release specialist agent
- `AGENTS.md` — build and test commands
- `vercel.json` — deployment configuration
