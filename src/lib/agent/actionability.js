/**
 * AGENT actionability — Phase 2.
 *
 * Pure derivation module. No IO. Consumes the last `client_site_audits` row
 * (`extracted_data`) and the normalized `client_geo_profiles` row, produces a
 * report with 5 dimensions and a global actionability score (0–100).
 *
 * Weights are locked (sum = 1.0):
 *   offer_clarity          0.30
 *   contact_booking        0.25
 *   local_coverage         0.20
 *   trust_proof            0.15
 *   content_actionability  0.10
 *
 * The score is NEVER persisted. Computed on read only. No writes, no new
 * tables, no new columns. Guardrail: a dimension cannot exceed 60 without at
 * least one observed signal from the audit (avoids score inflation from
 * declared-but-unverified profile fields).
 */

export const ACTIONABILITY_DIMENSION_WEIGHTS = Object.freeze({
    offer_clarity: 0.30,
    contact_booking: 0.25,
    local_coverage: 0.20,
    trust_proof: 0.15,
    content_actionability: 0.10,
});

const DIMENSION_LABELS = Object.freeze({
    offer_clarity: 'Clarté de l’offre',
    contact_booking: 'Contact & réservation',
    local_coverage: 'Couverture locale',
    trust_proof: 'Confiance & preuve',
    content_actionability: 'Contenu actionnable',
});

const FRESHNESS_CALCULATED_HOURS = 24 * 60; // ≤ 60j
const FRESHNESS_STALE_HOURS = 24 * 180;    // ≤ 180j

function clamp(value, min = 0, max = 100) {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
}

function toArray(value) {
    return Array.isArray(value) ? value : [];
}

function nonEmptyString(value, minLen = 1) {
    return typeof value === 'string' && value.trim().length >= minLen;
}

function hoursSince(iso) {
    if (!iso) return null;
    const parsed = new Date(iso).getTime();
    if (Number.isNaN(parsed)) return null;
    return Math.floor((Date.now() - parsed) / 3600000);
}

function deriveReliability(audit) {
    if (!audit || !audit.created_at) return 'unavailable';
    const hours = hoursSince(audit.created_at);
    if (hours === null) return 'unavailable';
    if (hours <= FRESHNESS_CALCULATED_HOURS) return 'calculated';
    if (hours <= FRESHNESS_STALE_HOURS) return 'stale';
    return 'low';
}

function deriveDimensionStatus(score, hasObserved) {
    if (!Number.isFinite(score)) return 'absent';
    if (score === 0 && !hasObserved) return 'absent';
    if (score >= 70) return 'couvert';
    if (score >= 40) return 'partiel';
    return 'bloqué';
}

function hasSchemaType(schemaEntities, pattern) {
    return toArray(schemaEntities).some((entity) => {
        const type = String(entity?.type || entity?.['@type'] || '');
        return pattern.test(type);
    });
}

// ──────────────────────────────────────────────────────────────
// Dimension: offer clarity
// ──────────────────────────────────────────────────────────────

function buildOfferClarityDimension({ business, extracted }) {
    const services = toArray(business?.services);
    const shortDesc = String(business?.short_desc || '').trim();
    const longDesc = String(business?.long_desc || '').trim();
    const servicePages = Number(extracted?.page_stats?.service_pages || 0);
    const hasServiceSchema = hasSchemaType(extracted?.schema_entities, /^(service|offer|product)$/i);
    const serviceSignals = toArray(extracted?.service_signals?.service_terms);

    let score = 0;
    const evidence = [];
    const gaps = [];
    let observed = false;

    if (services.length >= 1) {
        score += 20;
        evidence.push(`${services.length} service(s) déclaré(s) dans le profil.`);
        if (services.length >= 3) score += 5;
    } else {
        gaps.push('Aucun service déclaré dans le profil.');
    }

    if (shortDesc.length >= 40) {
        score += 15;
        evidence.push('Description courte présente dans le profil.');
    } else {
        gaps.push('Description courte trop brève ou absente.');
    }

    if (longDesc.length >= 120) {
        score += 10;
        evidence.push('Description longue présente dans le profil.');
    }

    if (servicePages >= 1) {
        score += 15;
        observed = true;
        evidence.push(`${servicePages} page(s) "services" observée(s) au crawl.`);
        if (servicePages >= 3) score += 10;
    } else {
        gaps.push('Aucune page service observée au crawl.');
    }

    if (hasServiceSchema) {
        score += 10;
        observed = true;
        evidence.push('Schema Service / Offer détecté.');
    } else {
        gaps.push('Pas de schema Service / Offer sur le site.');
    }

    if (serviceSignals.length > 0) {
        score += 10;
        observed = true;
        evidence.push(`${serviceSignals.length} terme(s) de service extrait(s) des pages.`);
    }

    const capped = observed ? clamp(score) : clamp(Math.min(score, 60));
    return {
        key: 'offer_clarity',
        label: DIMENSION_LABELS.offer_clarity,
        weight: ACTIONABILITY_DIMENSION_WEIGHTS.offer_clarity,
        score: capped,
        status: deriveDimensionStatus(capped, observed),
        evidence,
        gaps,
        topFix: gaps[0] || null,
    };
}

// ──────────────────────────────────────────────────────────────
// Dimension: contact & booking
// ──────────────────────────────────────────────────────────────

function buildContactBookingDimension({ contact, business, address, extracted }) {
    const phoneDeclared = nonEmptyString(contact?.phone);
    const emailDeclared = nonEmptyString(contact?.public_email);
    const phonesObserved = toArray(extracted?.phones).length;
    const emailsObserved = toArray(extracted?.emails).length;
    const contactPages = Number(extracted?.page_stats?.contact_pages || 0);
    const aboutPages = Number(extracted?.page_stats?.about_pages || 0);
    const openingHours = toArray(business?.opening_hours);
    const streetDeclared = nonEmptyString(address?.street);
    const cityDeclared = nonEmptyString(address?.city);
    const mapsUrl = nonEmptyString(business?.maps_url);

    let score = 0;
    const evidence = [];
    const gaps = [];
    let observed = false;

    if (phoneDeclared) {
        score += 15;
        evidence.push('Téléphone public déclaré.');
    } else {
        gaps.push('Aucun téléphone public déclaré.');
    }
    if (phonesObserved > 0) {
        score += 10;
        observed = true;
        evidence.push(`${phonesObserved} téléphone(s) observé(s) sur le site.`);
    } else if (phoneDeclared) {
        gaps.push('Téléphone déclaré mais non observé au crawl.');
    }

    if (emailDeclared) {
        score += 10;
        evidence.push('Courriel public déclaré.');
    } else {
        gaps.push('Aucun courriel public déclaré.');
    }
    if (emailsObserved > 0) {
        score += 10;
        observed = true;
        evidence.push(`${emailsObserved} courriel(s) observé(s) sur le site.`);
    }

    if (contactPages >= 1) {
        score += 15;
        observed = true;
        evidence.push(`${contactPages} page(s) "contact" observée(s).`);
    } else {
        gaps.push('Aucune page contact dédiée.');
    }

    if (aboutPages >= 1) {
        score += 5;
        observed = true;
    }

    if (openingHours.length > 0) {
        score += 10;
        evidence.push('Horaires renseignés.');
    } else {
        gaps.push('Horaires non renseignés.');
    }

    if (streetDeclared || mapsUrl) {
        score += 10;
        evidence.push(mapsUrl ? 'URL Maps déclarée.' : 'Adresse postale déclarée.');
    } else {
        gaps.push('Pas d’adresse postale ni d’URL Maps.');
    }

    if (cityDeclared) {
        score += 5;
    }

    const capped = observed ? clamp(score) : clamp(Math.min(score, 60));
    return {
        key: 'contact_booking',
        label: DIMENSION_LABELS.contact_booking,
        weight: ACTIONABILITY_DIMENSION_WEIGHTS.contact_booking,
        score: capped,
        status: deriveDimensionStatus(capped, observed),
        evidence,
        gaps,
        topFix: gaps[0] || null,
    };
}

// ──────────────────────────────────────────────────────────────
// Dimension: local coverage
// ──────────────────────────────────────────────────────────────

function buildLocalCoverageDimension({ business, address, seoData, extracted }) {
    const cityDeclared = nonEmptyString(address?.city);
    const regionDeclared = nonEmptyString(address?.region) || nonEmptyString(business?.target_region);
    const areasServed = toArray(business?.areas_served);
    const targetCities = toArray(seoData?.target_cities);
    const localCities = toArray(extracted?.local_signals?.cities);
    const localAreas = toArray(extracted?.local_signals?.area_served);
    const localRegions = toArray(extracted?.local_signals?.regions);
    const hasLocalBusiness = extracted?.has_local_business_schema === true;

    let score = 0;
    const evidence = [];
    const gaps = [];
    let observed = false;

    if (cityDeclared) {
        score += 15;
        evidence.push(`Ville déclarée (${address.city}).`);
    } else {
        gaps.push('Aucune ville déclarée dans le profil.');
    }

    if (regionDeclared) score += 10;

    if (areasServed.length > 0) {
        score += 10;
        evidence.push(`${areasServed.length} zone(s) desservie(s) déclarée(s).`);
    } else {
        gaps.push('Aucune zone desservie déclarée.');
    }

    if (targetCities.length > 0) {
        score += 5;
    }

    if (localCities.length > 0) {
        score += 15;
        observed = true;
        evidence.push(`${localCities.length} ville(s) observée(s) dans le contenu.`);
    } else {
        gaps.push('Aucune ville observée dans le contenu du site.');
    }

    if (localAreas.length > 0) {
        score += 10;
        observed = true;
        evidence.push(`${localAreas.length} zone(s) observée(s) dans le contenu.`);
    }

    if (localRegions.length > 0) {
        score += 5;
        observed = true;
    }

    if (hasLocalBusiness) {
        score += 20;
        observed = true;
        evidence.push('Schema LocalBusiness détecté.');
    } else {
        gaps.push('Schema LocalBusiness absent.');
    }

    const capped = observed ? clamp(score) : clamp(Math.min(score, 60));
    return {
        key: 'local_coverage',
        label: DIMENSION_LABELS.local_coverage,
        weight: ACTIONABILITY_DIMENSION_WEIGHTS.local_coverage,
        score: capped,
        status: deriveDimensionStatus(capped, observed),
        evidence,
        gaps,
        topFix: gaps[0] || null,
    };
}

// ──────────────────────────────────────────────────────────────
// Dimension: trust & proof
// ──────────────────────────────────────────────────────────────

function buildTrustProofDimension({ geoData, socialProfiles, extracted }) {
    const trust = extracted?.trust_signals || {};
    const proofTerms = toArray(trust.proof_terms).length;
    const reviewTerms = toArray(trust.review_terms).length;
    const socialNetworks = toArray(trust.social_networks).length;
    const socialLinks = toArray(extracted?.social_links).length;
    const hasReviewSchema = hasSchemaType(extracted?.schema_entities, /review|aggregaterating/i);
    const hasOrganization = extracted?.has_organization_schema === true;
    const hasLocalBusiness = extracted?.has_local_business_schema === true;
    const aboutPages = Number(extracted?.page_stats?.about_pages || 0);
    const contactPages = Number(extracted?.page_stats?.contact_pages || 0);
    const proofs = toArray(geoData?.proofs);
    const guarantees = toArray(geoData?.guarantees);
    const socialProfilesDeclared = toArray(socialProfiles).length;

    let score = 0;
    const evidence = [];
    const gaps = [];
    let observed = false;

    if (proofTerms >= 3) {
        score += 25;
        observed = true;
        evidence.push(`${proofTerms} termes de preuve observés au crawl.`);
    } else if (proofTerms >= 1) {
        score += 12;
        observed = true;
        evidence.push(`${proofTerms} terme(s) de preuve observé(s).`);
    } else if (proofs.length > 0) {
        score += 6;
        evidence.push(`${proofs.length} preuve(s) déclarée(s) dans le profil.`);
    } else {
        gaps.push('Aucune preuve / credibility term observée.');
    }

    if (reviewTerms >= 1 || hasReviewSchema) {
        score += 20;
        observed = true;
        evidence.push(hasReviewSchema ? 'Schema Review / AggregateRating détecté.' : `${reviewTerms} terme(s) d’avis observé(s).`);
        if (hasReviewSchema) score += 5;
    } else {
        gaps.push('Pas de langage ou schema d’avis (Review / AggregateRating).');
    }

    if (socialLinks >= 2) {
        score += 15;
        observed = true;
        evidence.push(`${socialLinks} profils sociaux observés (sameAs).`);
    } else if (socialLinks === 1) {
        score += 7;
        observed = true;
    } else if (socialProfilesDeclared > 0) {
        score += 5;
    } else {
        gaps.push('Moins de deux profils sociaux publics détectés.');
    }

    if (hasOrganization || hasLocalBusiness) {
        score += 10;
        observed = true;
        evidence.push('Identité structurée (Organization / LocalBusiness).');
    } else {
        gaps.push('Pas d’identité structurée (schema Organization).');
    }

    if (aboutPages > 0 && contactPages > 0) {
        score += 10;
        observed = true;
    } else {
        gaps.push('Pages about / contact incomplètes.');
    }

    if (guarantees.length > 0) {
        score += 5;
    }

    if (socialNetworks > 0) {
        score += 5;
        observed = true;
    }

    const capped = observed ? clamp(score) : clamp(Math.min(score, 60));
    return {
        key: 'trust_proof',
        label: DIMENSION_LABELS.trust_proof,
        weight: ACTIONABILITY_DIMENSION_WEIGHTS.trust_proof,
        score: capped,
        status: deriveDimensionStatus(capped, observed),
        evidence,
        gaps,
        topFix: gaps[0] || null,
    };
}

// ──────────────────────────────────────────────────────────────
// Dimension: content actionability
// ──────────────────────────────────────────────────────────────

function buildContentDimension({ business, geoFaqs, extracted }) {
    const longDesc = String(business?.long_desc || '').trim();
    const hasFaqSchema = extracted?.has_faq_schema === true;
    const faqPairs = toArray(extracted?.faq_pairs).length;
    const faqPages = Number(extracted?.page_stats?.faq_pages || 0);
    const aboutPages = Number(extracted?.page_stats?.about_pages || 0);
    const totalWords = Number(extracted?.page_stats?.total_word_count || 0);
    const successPages = Number(extracted?.page_stats?.success_count || extracted?.page_stats?.scanned_count || 0);
    const averageWords = successPages > 0 ? Math.round(totalWords / successPages) : 0;
    const h2Clusters = toArray(extracted?.h2_clusters);
    const h2Rich = h2Clusters.some((cluster) => toArray(cluster).length >= 3);
    const declaredFaqs = toArray(geoFaqs).length;

    let score = 0;
    const evidence = [];
    const gaps = [];
    let observed = false;

    if (faqPairs > 0) {
        score += 25;
        observed = true;
        evidence.push(`${faqPairs} paire(s) FAQ extraite(s).`);
    } else if (declaredFaqs > 0) {
        score += 12;
        evidence.push(`${declaredFaqs} FAQ déclarée(s) dans le profil.`);
    } else if (faqPages > 0) {
        score += 10;
        observed = true;
    } else {
        gaps.push('Aucune FAQ exploitable.');
    }

    if (hasFaqSchema) {
        score += 20;
        observed = true;
        evidence.push('Schema FAQ détecté.');
    } else {
        gaps.push('Schema FAQ absent.');
    }

    if (longDesc.length >= 200) {
        score += 15;
        evidence.push('Description longue substantielle.');
    } else if (averageWords >= 250) {
        score += 15;
        observed = true;
        evidence.push(`Moyenne de ${averageWords} mots par page.`);
    } else {
        gaps.push('Contenu explicatif insuffisant.');
    }

    if (averageWords >= 500) {
        score += 10;
        observed = true;
    }

    if (h2Rich) {
        score += 15;
        observed = true;
        evidence.push('Structuration H2 riche observée.');
    } else {
        gaps.push('Structuration H2 limitée.');
    }

    if (aboutPages >= 1) {
        score += 10;
        observed = true;
    } else {
        gaps.push('Pas de page "à propos" dédiée.');
    }

    const capped = observed ? clamp(score) : clamp(Math.min(score, 60));
    return {
        key: 'content_actionability',
        label: DIMENSION_LABELS.content_actionability,
        weight: ACTIONABILITY_DIMENSION_WEIGHTS.content_actionability,
        score: capped,
        status: deriveDimensionStatus(capped, observed),
        evidence,
        gaps,
        topFix: gaps[0] || null,
    };
}

// ──────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────

function buildEmptyReport(reason) {
    return {
        available: false,
        reliability: 'unavailable',
        summary: { globalScore: null, globalStatus: 'unavailable' },
        dimensions: [],
        topFixes: [],
        topStrengths: [],
        emptyState: {
            title: 'Actionnabilité AGENT indisponible',
            description: reason,
        },
    };
}

const PRIORITY_BY_WEIGHT = [
    ['offer_clarity', 'high'],
    ['contact_booking', 'high'],
    ['local_coverage', 'medium'],
    ['trust_proof', 'medium'],
    ['content_actionability', 'low'],
];

function collectTopFixes(dimensions, limit = 3) {
    const order = new Map(PRIORITY_BY_WEIGHT);
    return dimensions
        .filter((dim) => dim.score < 60 && dim.topFix)
        .sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            const pa = priorityOrder[order.get(a.key)] ?? 9;
            const pb = priorityOrder[order.get(b.key)] ?? 9;
            if (pa !== pb) return pa - pb;
            return a.score - b.score;
        })
        .slice(0, limit)
        .map((dim) => ({
            dimensionKey: dim.key,
            dimensionLabel: dim.label,
            priority: order.get(dim.key) || 'low',
            message: dim.topFix,
        }));
}

function collectTopStrengths(dimensions, limit = 3) {
    return dimensions
        .filter((dim) => dim.score >= 70 && dim.evidence.length > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((dim) => ({
            dimensionKey: dim.key,
            dimensionLabel: dim.label,
            message: dim.evidence[0],
            score: dim.score,
        }));
}

export function buildActionabilityReport({ client = null, audit = null } = {}) {
    if (!audit) {
        return buildEmptyReport('Aucun audit disponible. Lancez un audit pour activer l’analyse d’actionnabilité.');
    }

    if (audit?.scan_status && audit.scan_status === 'failed') {
        return buildEmptyReport('Le dernier audit a échoué. Relancez un audit pour activer l’analyse d’actionnabilité.');
    }

    const extracted = audit.extracted_data || {};
    const business = client?.business_details || {};
    const contact = client?.contact_info || {};
    const address = client?.address || {};
    const seoData = client?.seo_data || {};
    const geoData = client?.geo_ai_data || {};
    const socialProfiles = client?.social_profiles || [];
    const geoFaqs = client?.geo_faqs || [];

    const dimensions = [
        buildOfferClarityDimension({ business, extracted }),
        buildContactBookingDimension({ contact, business, address, extracted }),
        buildLocalCoverageDimension({ business, address, seoData, extracted }),
        buildTrustProofDimension({ geoData, socialProfiles, extracted }),
        buildContentDimension({ business, geoFaqs, extracted }),
    ];

    const weightSum = dimensions.reduce((acc, dim) => acc + dim.weight, 0);
    const weighted = dimensions.reduce((acc, dim) => acc + dim.score * dim.weight, 0);
    const globalScore = weightSum > 0 ? Math.round(weighted / weightSum) : null;

    const globalStatus = globalScore === null
        ? 'unavailable'
        : globalScore >= 70
            ? 'couvert'
            : globalScore >= 40
                ? 'partiel'
                : 'bloqué';

    const reliability = deriveReliability(audit);

    return {
        available: true,
        reliability,
        summary: {
            globalScore,
            globalStatus,
            auditFreshnessHours: hoursSince(audit.created_at),
            auditCreatedAt: audit.created_at || null,
        },
        dimensions,
        topFixes: collectTopFixes(dimensions),
        topStrengths: collectTopStrengths(dimensions),
        emptyState: null,
    };
}

/**
 * Convert a full actionability report into the `{ score, reliability }` shape
 * consumed by `computeAgentScore`. Returns null if unavailable so the score
 * module treats it as a missing input (and renormalizes the weights).
 */
export function deriveActionabilityInput(report) {
    if (!report || report.available === false) return null;
    const score = report?.summary?.globalScore;
    if (!Number.isFinite(score)) return null;
    return {
        score,
        reliability: report.reliability || 'calculated',
    };
}

export const __internal__ = {
    clamp,
    deriveReliability,
    deriveDimensionStatus,
    collectTopFixes,
    buildOfferClarityDimension,
    buildContactBookingDimension,
    buildLocalCoverageDimension,
    buildTrustProofDimension,
    buildContentDimension,
};
