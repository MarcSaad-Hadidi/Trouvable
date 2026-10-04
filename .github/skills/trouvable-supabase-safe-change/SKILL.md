---
name: trouvable-supabase-safe-change
description: Step-by-step workflow for safe Supabase schema, policy, and data changes with rollback planning.
---

# Supabase Safe Change Skill

## When to use

- Before executing ANY DDL statement (CREATE, ALTER, DROP)
- Before modifying RLS policies
- Before running data migrations or backfills
- When adding or modifying Supabase client queries in `src/lib/`
- When debugging data access or permission issues

Production currently serves static `parking/`; the application and services are dormant. This guidance does not authorize deployment, remote database/provider calls, billing connections, or service revival. Keep validation local unless the user explicitly authorizes a separate operational task.

## Pre-flight checklist

Before making any change, answer:

1. What is the current state? (Read ordered migrations and affected historical SQL; do not infer the remote catalogue)
2. What exactly will change? (Exact SQL statements)
3. What could break? (Downstream consumers, RLS, auth boundaries)
4. Can this be rolled back? (Reversible vs destructive)
5. Who needs to know? (Frontend, API routes, server actions affected)

## Steps

### 1. Read current state

```bash
# Files to inspect
supabase/migrations/        # Ordered migrations
supabase/schema.sql         # Historical DDL reference
supabase/setup_*.sql        # Historical setup references
src/lib/supabase/server.js   # Separate public SSR profile reads (anon/RLS)
src/lib/supabase-admin.js       # Service-role client
src/lib/db/                     # Targeted service-role domain modules; require server authorization
src/lib/queries/                # Query utilities
src/lib/actions/                # Server actions
```

### 2. Write migration SQL

**Template:**

```sql
-- Migration: [description]
-- Date: [YYYY-MM-DD]
-- Risk: [LOW/MEDIUM/HIGH]
-- Rollback: [rollback SQL or "N/A - additive only"]

-- Guard: idempotent execution
ALTER TABLE public.<table> ADD COLUMN IF NOT EXISTS <column> <type>;

-- Policy changes (always drop-then-create)
DROP POLICY IF EXISTS "<policy_name>" ON public.<table>;
CREATE POLICY "<policy_name>"
ON public.<table>
FOR <SELECT|INSERT|UPDATE|DELETE>
TO <role>
USING (<condition>);

-- Index (if needed)
CREATE INDEX IF NOT EXISTS idx_<table>_<column> ON public.<table> (<column>);
```

### 3. Risk classification

| Change type           | Risk     | Requires                                       |
| --------------------- | -------- | ---------------------------------------------- |
| ADD COLUMN (nullable) | LOW      | Schema update + migration script               |
| ADD COLUMN (NOT NULL) | MEDIUM   | Default value + backfill plan                  |
| ADD INDEX             | LOW      | Performance check for large tables             |
| ADD POLICY            | MEDIUM   | Verify doesn't conflict with existing policies |
| ALTER COLUMN type     | HIGH     | Data compatibility check + rollback SQL        |
| DROP COLUMN           | HIGH     | Verify no downstream consumers + rollback SQL  |
| DROP POLICY           | HIGH     | Security impact assessment + rollback SQL      |
| DROP TABLE            | CRITICAL | Human approval required                        |

### 4. Preserve ordered migration history

After validating the proposed migration on a disposable local database:

- Add an ordered migration in `supabase/migrations/`; do not create a second setup history
- Preserve historical `supabase/schema.sql` and `supabase/setup_*.sql` until reconstruction equivalence is proved locally
- Update targeted `src/lib/db/` or `src/lib/queries/` when query patterns change
- Service-role modules bypass RLS: preserve explicit server authorization. Public SSR `src/lib/supabase/server.js` is a distinct anon/RLS profile loader; there is no global db.js facade

### 5. Downstream verification

- [ ] All `src/lib/` modules that query affected tables still work
- [ ] Server actions in `src/lib/actions/` handle new columns
- [ ] API routes in `src/app/api/` return correct data
- [ ] Admin UI in `src/app/admin/` displays correctly
- [ ] Portal views in `src/app/portal/` unaffected or updated

### 6. Validation

```bash
# After authorized disposable-local validation; no remote application
npm run lint          # Catch any broken imports
npm test              # Run test suite
# Then: manual verification of affected routes
```

## References

- `supabase/migrations/` — ordered migrations
- `supabase/schema.sql` — historical DDL reference
- `supabase/setup_*.sql` — historical setup references
- `src/lib/db/` — targeted service-role domain modules
- `src/lib/supabase/server.js` — public SSR profile reads (anon/RLS)
- `src/lib/supabase-admin.js` — service-role client
- `.github/instructions/supabase.instructions.md` — detailed Supabase rules
- `.github/agents/trouvable-data.agent.md` — data specialist agent
