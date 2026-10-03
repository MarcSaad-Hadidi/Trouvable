/**
 * Layer 2 trust stack review.
 *
 * Examines multiple trust surfaces at once — proof terms, reviews, social
 * presence, structured identity, support pages — and produces a combined
 * expert finding set. The goal is not to re-score what Layer 4 already scores
 * under `trust_signals`, but to surface cross-surface observations AI
 * assistants would notice (e.g. rich proof but no schema, or schema but no
 * independent review presence).
 */

function sizeOf(value) {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === 'object') return Object.keys(value).length;
    return 0;
}

export function auditTrustStack({ extracted }) {
    const findings = [];
    const trust = extracted?.trust_signals || {};
    const schemaEntities = Array.isArray(extracted?.schema_entities) ? extracted.schema_entities : [];
    const socialLinks = Array.isArray(extracted?.social_links) ? extracted.social_links : [];

    const details = {
        proof_terms: sizeOf(trust.proof_terms || []),
        review_terms: sizeOf(trust.review_terms || []),
        social_networks: sizeOf(trust.social_networks || []),
        social_profile_urls: socialLinks.length,
        structured_review_schema: schemaEntities.some((entity) => /review|aggregaterating/i.test(String(entity?.type || entity?.['@type'] || ''))),
        has_organization_schema: extracted?.has_organization_schema === true,
        has_local_business_schema: extracted?.has_local_business_schema === true,
        about_pages: Number(extracted?.page_stats?.about_pages || 0),
        contact_pages: Number(extracted?.page_stats?.contact_pages || 0),
    };

    const strongProof = details.proof_terms >= 3;
    const hasReviews = details.review_terms >= 1 || details.structured_review_schema;
    const hasPublicPresence = details.social_profile_urls >= 2;
    const hasEntityClarity = details.has_organization_schema || details.has_local_business_schema;

    if (!strongProof) {
        findings.push({ id: 'trust.thin_proof', severity: 'medium', message: 'Few proof / credibility terms detected across pages.' });
    }
    if (!hasReviews) {
        findings.push({ id: 'trust.no_reviews', severity: 'medium', message: 'No review language or Review / AggregateRating schema detected.' });
    }
    if (!hasPublicPresence) {
        findings.push({ id: 'trust.weak_social_presence', severity: 'low', message: 'Fewer than two public social profiles detected.' });
    }
    if (strongProof && !details.structured_review_schema) {
        findings.push({ id: 'trust.proof_without_schema', severity: 'low', message: 'Strong proof language but no Review / AggregateRating schema — AI assistants may miss it.' });
    }
    if (hasEntityClarity && details.social_profile_urls === 0) {
        findings.push({ id: 'trust.entity_without_sameas', severity: 'low', message: 'Structured identity declared but no linked social / sameAs presence.' });
    }
    if (details.about_pages === 0 || details.contact_pages === 0) {
        findings.push({ id: 'trust.missing_identity_pages', severity: 'low', message: 'Dedicated about and contact pages strengthen trust signals.' });
    }

    let score = 0;
    if (strongProof) score += 25;
    else if (details.proof_terms > 0) score += 12;
    if (hasReviews) score += 25;
    if (hasPublicPresence) score += 15;
    else if (details.social_profile_urls === 1) score += 7;
    if (hasEntityClarity) score += 15;
    if (details.about_pages > 0 && details.contact_pages > 0) score += 10;
    if (details.structured_review_schema) score += 10;
    score = Math.max(0, Math.min(100, score));

    return { score, findings, details };
}
