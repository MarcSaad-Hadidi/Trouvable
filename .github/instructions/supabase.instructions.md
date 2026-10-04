---
applyTo: 'supabase/**,sql/**,src/lib/db/**,src/lib/supabase-admin.js,src/lib/supabase/**,src/lib/queries/**,src/lib/actions/**,src/lib/data/**,src/features/portal/server/**'
---

# Supabase safety workflow

Services are dormant. These instructions do not authorize remote SQL, backfills or revival. Validate schema changes on a disposable local database; never remove historical setup scripts without proving the reconstruction path.

Every schema, policy, auth, or query change follows the relevant steps below. A query refactor that changes no schema does not need invented SQL. Remote inspection and mutations are separate authorized operations; migrations, fixtures and local mocks are the sources available during hibernation.

## 1. Understand the current state

- Read ordered `supabase/migrations/` and affected schema code. `schema.sql` and `setup_*.sql` are retained historical references, not proof of the current remote catalogue.
- Check `supabase/setup_*.sql` for incremental migration scripts.
- Inspect targeted `src/lib/db/*`, `src/lib/supabase-admin.js` (service role), and `src/lib/supabase/server.js` (public SSR reads). There is no global db.js facade.
- Identify which tables, columns, and policies are affected.

## 2. Assess impact

Before proposing SQL:

- **RLS impact** — Does this change weaken, remove, or bypass existing row-level security?
- **Data loss risk** — Does this DROP, TRUNCATE, or ALTER columns with existing data?
- **Auth boundary** — Does this affect which users/roles can read or write?
- **Downstream consumers** — Which `src/lib/` modules, server actions, or API routes query this table?

## 3. Propose SQL explicitly

- If a schema, policy or data change is necessary, write the exact SQL statements proposed; do not execute them remotely during hibernation.
- Use `IF NOT EXISTS` / `IF EXISTS` guards where appropriate.
- Prefer `ALTER TABLE ... ADD COLUMN` over recreating tables.
- For destructive operations: explain why, show rollback SQL, and flag for human review.
- Never use `DROP TABLE` or `DROP POLICY` without explicit justification and backup plan.

## 4. RLS rules

- **All tables** must have RLS enabled: `ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;`
- Service-role writes bypass RLS — this is intentional for admin/server operations.
- Anon/public read access: only via explicit `FOR SELECT TO anon USING (...)` policies.
- Do not create `FOR ALL` policies — always specify the operation (SELECT, INSERT, UPDATE, DELETE).
- Keep policy changes idempotent, but do not drop a working policy mechanically. Replacement requires inspection of the existing operation/roles/predicate, explicit justification, a rollback and backup plan, and preservation of access protections.

## 5. Migration patterns

- New schema changes → add an ordered migration in `supabase/migrations/`; do not create a second setup history. Preserve historical scripts until reconstruction equivalence is proved locally.
- Column additions → prefer `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
- Data backfills → use `UPDATE ... SET ... WHERE <column> IS NULL` with explicit WHERE clauses.
- Index creation → `CREATE INDEX IF NOT EXISTS` with meaningful names: `idx_<table>_<column>`.

## 6. Client usage patterns

```javascript
// Public SSR reads: use the existing server-only profile loader with RLS/public filters.
import { getClientProfile } from '@/lib/supabase/server';

// Service role: server only, after explicit authorization; prefer targeted domain modules.
import { getAdminSupabase } from '@/lib/supabase-admin';
const { data, error } = await getAdminSupabase().from('table').select('id');
```

- Always handle `error` — never silently ignore Supabase errors.
- Use `.single()` when expecting exactly one row.
- Use `.maybeSingle()` when expecting zero or one row.
- Prefer `.select('col1, col2')` over `.select('*')` in production queries.

## 7. Validation checklist

After any Supabase change:

- [ ] Proposed SQL is idempotent when applicable; a query-only change requires no migration
- [ ] RLS is not weakened without explicit justification
- [ ] Ordered migration represents the structural change; historical reconstruction sources preserved
- [ ] Migration created and checked on a disposable local database when schema/policies/data change; report any unverified reconstruction or RLS behavior
- [ ] Downstream `src/lib/` consumers verified
- [ ] Error handling present in client code
