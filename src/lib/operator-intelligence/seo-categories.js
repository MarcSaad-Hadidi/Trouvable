/**
 * Shared SEO category filters for audit issues/strengths.
 * Used by seo-health, seo-local, and seo-actions slices.
 */

export const SEO_CATEGORIES = new Set(['technical', 'seo', 'trust', 'identity']);
export const LOCAL_CATEGORIES = new Set(['geo', 'local', 'content']);

/**
 * Returns true if an issue/strength category is SEO-relevant.
 */
export function isSeoRelevant(category) {
    const cat = (category || '').toLowerCase();
    return SEO_CATEGORIES.has(cat) || cat.startsWith('technical') || cat.startsWith('seo') || cat.startsWith('identity');
}

/**
 * Returns true if an issue/strength category is local-relevant.
 */
export function isLocalRelevant(category) {
    const cat = (category || '').toLowerCase();
    return LOCAL_CATEGORIES.has(cat) || cat.startsWith('local') || cat.startsWith('geo');
}

/**
 * Filter an array of issues/strengths to SEO-relevant items.
 */
export function filterSeoRelevant(items) {
    return (items || []).filter((item) => isSeoRelevant(item.category));
}

/**
 * Filter an array of issues/strengths to local-relevant items.
 */
export function filterLocalRelevant(items) {
    return (items || []).filter((item) => isLocalRelevant(item.category));
}
