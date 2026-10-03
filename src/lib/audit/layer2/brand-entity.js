/**
 * Layer 2 brand / entity audit.
 *
 * Scores whether the site presents itself as a well-defined entity to AI and
 * search assistants. Inputs come from Layer 1 extraction (no extra fetching)
 * so this is pure analysis. Brand/entity strength is a signal for AI
 * answerability but is interpreted by Layer 4 — not stored as a product score.
 */

function uniqueStrings(values) {
    return [...new Set((values || []).filter((v) => typeof v === 'string' && v.trim().length).map((v) => v.trim()))];
}

function detectOrganizationEntity(schemaEntities = []) {
    return schemaEntities.some((entity) => {
        const type = String(entity?.type || entity?.['@type'] || '').toLowerCase();
        return /organization|localbusiness|person|product/.test(type);
    });
}

function detectSameAsLinks(schemaEntities = [], socialLinks = []) {
    const fromSchema = schemaEntities.flatMap((entity) => {
        const sameAs = entity?.sameAs || entity?.['sameAs'];
        if (Array.isArray(sameAs)) return sameAs;
        if (typeof sameAs === 'string') return [sameAs];
        return [];
    });
    return uniqueStrings([...fromSchema, ...socialLinks]);
}

export function auditBrandEntity({ extracted }) {
    const findings = [];
    const businessNames = uniqueStrings(extracted?.business_names || []);
    const schemaEntities = Array.isArray(extracted?.schema_entities) ? extracted.schema_entities : [];
    const socialLinks = Array.isArray(extracted?.social_links) ? extracted.social_links : [];
    const hasOrgSchema = detectOrganizationEntity(schemaEntities) || extracted?.has_organization_schema === true || extracted?.has_local_business_schema === true;
    const sameAs = detectSameAsLinks(schemaEntities, socialLinks);

    const details = {
        business_name_cluster_size: businessNames.length,
        has_organization_entity: hasOrgSchema,
        same_as_count: sameAs.length,
        same_as_sample: sameAs.slice(0, 6),
        has_contact_identity: (extracted?.phones?.length || 0) > 0 || (extracted?.emails?.length || 0) > 0,
        has_about_page: Number(extracted?.page_stats?.about_pages || 0) > 0,
        has_contact_page: Number(extracted?.page_stats?.contact_pages || 0) > 0,
    };

    if (businessNames.length === 0) {
        findings.push({ id: 'brand.no_business_name', severity: 'high', message: 'No consistent business name cluster detected across pages.' });
    } else if (businessNames.length > 3) {
        findings.push({ id: 'brand.name_inconsistency', severity: 'medium', message: `Multiple business name variants detected: ${businessNames.slice(0, 4).join(', ')}` });
    }
    if (!hasOrgSchema) {
        findings.push({ id: 'brand.no_org_entity', severity: 'high', message: 'No Organization / LocalBusiness / Person schema entity detected.' });
    }
    if (sameAs.length < 2) {
        findings.push({ id: 'brand.weak_same_as', severity: 'medium', message: 'Fewer than two sameAs / social profile references — brand graph is thin.' });
    }
    if (!details.has_about_page || !details.has_contact_page) {
        findings.push({ id: 'brand.missing_identity_pages', severity: 'medium', message: 'Missing a dedicated about and/or contact page reduces entity clarity.' });
    }

    let score = 0;
    if (businessNames.length >= 1 && businessNames.length <= 3) score += 25;
    if (hasOrgSchema) score += 25;
    score += Math.min(sameAs.length * 8, 32);
    if (details.has_contact_identity) score += 10;
    if (details.has_about_page && details.has_contact_page) score += 8;
    score = Math.max(0, Math.min(100, score));

    return { score, findings, details };
}
