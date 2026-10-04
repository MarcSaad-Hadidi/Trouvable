/** Values allowed by `query_mentions_entity_type_check` in Postgres. */
const QUERY_MENTION_ENTITY_TYPES = new Set(['business', 'competitor', 'source']);

/**
 * Maps extraction-layer types to DB-safe `entity_type`.
 * Extraction v2 uses `generic_mention` in-memory; persisted rows use `business` + is_target=false.
 */
export function normalizeEntityTypeForDb(entityType) {
    const raw = String(entityType || 'business').trim();
    if (raw === 'generic_mention') return 'business';
    if (QUERY_MENTION_ENTITY_TYPES.has(raw)) return raw;
    return 'business';
}
