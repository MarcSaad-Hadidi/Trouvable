import 'server-only';

import { normalizeTrackedQueryCategory } from '@/lib/operator-intelligence/prompt-taxonomy';

/** Omit nested `discovery_mode` until all environments have `tracked_queries.discovery_mode` migrated. */
export const QUERY_RUN_TRACKED_QUERY_SELECT = 'tracked_queries(query_text, category, query_type, locale)';

const LEGACY_TRACKED_QUERY_CATEGORY_MAP = {
    discovery: 'general',
    local_intent: 'local',
    service_intent: 'service',
    competitor_comparison: 'competitor',
    brand: 'brand',
};

function getSingleRelation(value) {
    if (Array.isArray(value)) return value[0] || null;
    return value || null;
}

export function normalizeQueryRunRow(row) {
    if (!row) return row;
    const trackedQuery = getSingleRelation(row.tracked_queries);
    return {
        ...row,
        tracked_queries: trackedQuery,
        query_text: row.query_text || trackedQuery?.query_text || null,
    };
}

export function normalizeQueryRunRows(rows) {
    return (rows || []).map((row) => normalizeQueryRunRow(row));
}

export function createDbError(context, error, metadata = {}) {
    const dbError = new Error(`[DB] ${context}: ${error?.message || 'Unknown database error'}`);
    dbError.code = error?.code;
    dbError.details = error?.details;
    dbError.hint = error?.hint;
    dbError.constraint = error?.constraint;
    Object.assign(dbError, metadata);
    return dbError;
}

export function extractMissingSchemaCacheColumn(error, relationName = null) {
    const haystack = [error?.message, error?.details, error?.hint].filter(Boolean).join(' ');
    const match = haystack.match(/Could not find the '([^']+)' column of '([^']+)' in the schema cache/i);
    if (!match) return null;

    const [, column, relation] = match;
    if (relationName && String(relation || '').toLowerCase() !== String(relationName).toLowerCase()) {
        return null;
    }

    return column;
}

export function isTrackedQueryConstraintDriftError(error) {
    if (!error || String(error.code || '') !== '23514') return false;
    const constraint = String(error.constraint || '').toLowerCase();
    const message = String(error.message || '').toLowerCase();
    const details = String(error.details || '').toLowerCase();
    const trackedQueriesContext = constraint.includes('tracked_queries')
        || message.includes('tracked_queries')
        || details.includes('tracked_queries');

    if (!trackedQueriesContext) return false;

    return (
        constraint.includes('query_type')
        || constraint.includes('category')
        || message.includes('query_type')
        || message.includes('category')
        || message.includes('check constraint')
        || details.includes('check constraint')
    );
}

export function mapTrackedQueryWriteToLegacy(row) {
    const canonicalCategory = normalizeTrackedQueryCategory(row?.category ?? row?.query_type, row?.query_text);
    const legacyCategory = LEGACY_TRACKED_QUERY_CATEGORY_MAP[canonicalCategory] || 'general';
    return {
        ...row,
        category: legacyCategory,
        query_type: legacyCategory,
    };
}

export function isTrackedQueryConstraintDrift(error) {
    return Boolean(error?.isTrackedQueryConstraintDrift);
}
