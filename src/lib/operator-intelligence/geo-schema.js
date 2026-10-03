import 'server-only';

import { getProvenanceMeta } from '@/lib/operator-intelligence/provenance';

import {
    auditItemReliability,
    compactString,
    findAuditItem,
    getGeoFoundationContext,
    localizeAuditCopy,
    normalizeComparablePhone,
    normalizeComparableText,
    normalizeComparableUrl,
    timeSince,
    toArray,
} from './geo-foundation-shared';

const LOCAL_BUSINESS_REGEX = /(localbusiness|professionalservice|store|restaurant|dentist|medicalclinic|plumber|electrician|hvac|roofing|autobody|autorepair|barber|beautysalon|daycare|dryclean|florist|hairsalon|homeandconstructionbusiness|legalservice|locksmith|movingcompany|notary|petstore|realestateagent)/i;
const ORGANIZATION_REGEX = /(organization|localbusiness|professionalservice|corporation|medicalbusiness|legalservice|realestateagent|store|restaurant)/i;

function uniqueStrings(values = []) {
    return [...new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))];
}

function normalizeTypeList(value) {
    if (Array.isArray(value)) return uniqueStrings(value.map((item) => String(item || '').trim()));
    const compact = compactString(value);
    return compact ? [compact] : [];
}

function rawNodeTypes(node) {
    return normalizeTypeList(node?.['@type']);
}

function rawNodeHasFamily(node, matcher) {
    return rawNodeTypes(node).some((type) => matcher.test(type));
}

function identityEntities(schemaEntities = []) {
    return toArray(schemaEntities).filter((entity) => {
        const types = normalizeTypeList(entity?.types?.length ? entity.types : entity?.type);
        return types.some((type) => ORGANIZATION_REGEX.test(type));
    });
}

function extractRawSameAs(nodes = []) {
    return uniqueStrings(nodes.flatMap((node) => toArray(node?.sameAs)));
}

function collectCoverageNodes(audit) {
    const rawNodes = toArray(audit?.extracted_data?.structured_data);
    const entities = toArray(audit?.extracted_data?.schema_entities);
    const faqPairs = toArray(audit?.extracted_data?.faq_pairs);

    return {
        rawNodes,
        entities,
        faqPairs,
        organizationNodes: rawNodes.filter((node) => rawNodeHasFamily(node, ORGANIZATION_REGEX)),
        localBusinessNodes: rawNodes.filter((node) => rawNodeHasFamily(node, LOCAL_BUSINESS_REGEX)),
        serviceNodes: rawNodes.filter((node) => rawNodeTypes(node).some((type) => /^service$/i.test(type))),
        faqNodes: rawNodes.filter((node) => rawNodeTypes(node).some((type) => /^faqpage$/i.test(type))),
    };
}

function propertyPresent(nodes, entities, propertyKey) {
    if (propertyKey === 'name') {
        return nodes.some((node) => compactString(node?.name)) || entities.some((entity) => compactString(entity?.name));
    }
    if (propertyKey === 'url') {
        return nodes.some((node) => compactString(node?.url)) || entities.some((entity) => compactString(entity?.url));
    }
    if (propertyKey === 'description') {
        return nodes.some((node) => compactString(node?.description)) || entities.some((entity) => compactString(entity?.description));
    }
    if (propertyKey === 'sameAs') {
        return nodes.some((node) => toArray(node?.sameAs).length > 0) || entities.some((entity) => toArray(entity?.sameAs).length > 0);
    }
    if (propertyKey === 'address') {
        return nodes.some((node) => node?.address) || entities.some((entity) => compactString(entity?.address?.line || entity?.address));
    }
    if (propertyKey === 'contact') {
        return nodes.some((node) => compactString(node?.telephone) || compactString(node?.email))
            || entities.some((entity) => compactString(entity?.telephone) || compactString(entity?.email));
    }
    if (propertyKey === 'areaServed') {
        return nodes.some((node) => toArray(node?.areaServed).length > 0) || entities.some((entity) => toArray(entity?.areaServed).length > 0);
    }
    if (propertyKey === 'provider') {
        return nodes.some((node) => node?.provider || node?.brand);
    }
    if (propertyKey === 'mainEntity') {
        return nodes.some((node) => toArray(node?.mainEntity).length > 0);
    }
    return false;
}

function buildCoverageItem({ key, label, nodes, entities, expectedProperties, evidenceLabel, shouldExist }) {
    const observedTypes = uniqueStrings([
        ...nodes.flatMap((node) => rawNodeTypes(node)),
        ...entities.flatMap((entity) => normalizeTypeList(entity?.types?.length ? entity.types : entity?.type)),
    ]);
    const foundCount = expectedProperties.filter((property) => propertyPresent(nodes, entities, property)).length;
    const missingProperties = expectedProperties.filter((property) => !propertyPresent(nodes, entities, property));
    const present = nodes.length > 0 || entities.length > 0;

    return {
        key,
        label,
        operatorStatus: present ? (missingProperties.length > 0 ? 'partiel' : 'couvert') : 'absent',
        reliability: 'measured',
        evidence: present
            ? `${nodes.length || entities.length} élément(s) observé(s) dans la famille ${evidenceLabel}.`
            : `Aucune présence observée dans l’échantillon audité pour ${evidenceLabel}.`,
        observedTypes,
        coveragePercent: expectedProperties.length > 0 ? Math.round((foundCount / expectedProperties.length) * 100) : 0,
        missingProperties,
        foundCount,
        expectedCount: expectedProperties.length,
        shouldExist: Boolean(shouldExist),
    };
}

function normalizeSchemaNameMatch(left, right) {
    const a = normalizeComparableText(left);
    const b = normalizeComparableText(right);
    if (!a || !b) return false;
    if (a === b) return true;
    return a.includes(b) || b.includes(a);
}

function buildEntityConsistency(client, entities) {
    const relevantEntities = identityEntities(entities);
    const observedNames = uniqueStrings(relevantEntities.map((entity) => compactString(entity?.name)).filter(Boolean));
    const observedPhones = uniqueStrings(relevantEntities.map((entity) => normalizeComparablePhone(entity?.telephone)).filter(Boolean));
    const observedEmails = uniqueStrings(relevantEntities.map((entity) => normalizeComparableText(entity?.email)).filter(Boolean));
    const observedAddresses = uniqueStrings(relevantEntities.map((entity) => compactString(entity?.address?.line || entity?.address)).filter(Boolean));

    const clientName = compactString(client?.client_name);
    const clientPhone = normalizeComparablePhone(client?.contact_info?.phone);
    const clientEmail = normalizeComparableText(client?.contact_info?.public_email || client?.contact_info?.email);
    const clientAddress = compactString([
        client?.address?.street,
        client?.address?.city,
        client?.address?.region,
    ].filter(Boolean).join(', '));

    const rows = [];

    rows.push({
        label: 'Nom principal',
        status: !clientName
            ? 'à confirmer'
            : observedNames.length === 0
                ? 'manquant'
                : observedNames.some((value) => normalizeSchemaNameMatch(clientName, value))
                    ? 'aligné'
                    : 'écart',
        detail: observedNames.length > 0 ? observedNames.slice(0, 2).join(' · ') : 'Aucun nom d’entité observé dans le schema.',
        reliability: 'calculated',
    });

    rows.push({
        label: 'Téléphone public',
        status: !clientPhone
            ? 'à confirmer'
            : observedPhones.length === 0
                ? 'manquant'
                : observedPhones.includes(clientPhone)
                    ? 'aligné'
                    : 'écart',
        detail: observedPhones.length > 0 ? observedPhones.join(' · ') : 'Aucun téléphone observé dans le schema.',
        reliability: 'calculated',
    });

    rows.push({
        label: 'Courriel public',
        status: !clientEmail
            ? 'à confirmer'
            : observedEmails.length === 0
                ? 'manquant'
                : observedEmails.includes(clientEmail)
                    ? 'aligné'
                    : 'écart',
        detail: observedEmails.length > 0 ? observedEmails.join(' · ') : 'Aucun courriel observé dans le schema.',
        reliability: 'calculated',
    });

    const normalizedClientAddress = normalizeComparableText(clientAddress);
    rows.push({
        label: 'Adresse / zone',
        status: !normalizedClientAddress
            ? 'à confirmer'
            : observedAddresses.length === 0
                ? 'manquant'
                : observedAddresses.some((value) => normalizeComparableText(value).includes(normalizedClientAddress) || normalizedClientAddress.includes(normalizeComparableText(value)))
                    ? 'aligné'
                    : 'écart',
        detail: observedAddresses.length > 0 ? observedAddresses.slice(0, 2).join(' · ') : 'Aucune adresse d’entité observée.',
        reliability: 'calculated',
    });

    return rows;
}

function buildSameAsSummary(client, nodes, entities) {
    const dossierProfiles = uniqueStrings(toArray(client?.social_profiles));
    const observedSameAs = uniqueStrings([
        ...extractRawSameAs(nodes),
        ...toArray(entities).flatMap((entity) => toArray(entity?.sameAs)),
    ]);

    const dossierSet = new Set(dossierProfiles.map(normalizeComparableUrl));
    const observedSet = new Set(observedSameAs.map(normalizeComparableUrl));

    const matched = dossierProfiles.filter((value) => observedSet.has(normalizeComparableUrl(value)));
    const missingFromSchema = dossierProfiles.filter((value) => !observedSet.has(normalizeComparableUrl(value)));
    const unexpectedInSchema = observedSameAs.filter((value) => !dossierSet.has(normalizeComparableUrl(value)));

    let status = 'absent';
    if (observedSameAs.length > 0 && dossierProfiles.length === 0) status = 'à confirmer';
    else if (observedSameAs.length === 0 && dossierProfiles.length > 0) status = 'absent';
    else if (missingFromSchema.length > 0 || unexpectedInSchema.length > 0) status = 'incohérent';
    else if (observedSameAs.length > 0) status = 'présents';

    return {
        status,
        reliability: observedSameAs.length > 0 || dossierProfiles.length > 0 ? 'calculated' : 'unavailable',
        dossierProfiles,
        observedSameAs,
        matched,
        missingFromSchema,
        unexpectedInSchema,
    };
}

function buildMissingProperties({ coverageItems, client, audit }) {
    const items = [];

    for (const coverage of coverageItems) {
        if (coverage.operatorStatus === 'absent' && coverage.shouldExist) {
            items.push({
                label: `${coverage.label} absent`,
                detail: `Aucun ${coverage.label} n’a été observé alors que le dossier ou l’audit suggère que cette couche devrait exister.`,
                evidence: coverage.evidence,
                reliability: 'measured',
                severity: 'high',
            });
        }

        for (const property of coverage.missingProperties) {
            items.push({
                label: `${coverage.label} · ${property}`,
                detail: `Propriété d’ancrage manquante dans l’échantillon audité pour ${coverage.label}.`,
                evidence: coverage.evidence,
                reliability: 'measured',
                severity: coverage.shouldExist ? 'medium' : 'low',
            });
        }
    }

    if (toArray(client?.business_details?.services).length > 0 && toArray(audit?.extracted_data?.page_summaries).filter((page) => page?.page_type === 'services').length > 0) {
        const hasServiceItem = items.some((item) => item.label.startsWith('Service'));
        if (!hasServiceItem) {
            items.push({
                label: 'Service · cadrage faible',
                detail: 'Des pages service existent, mais aucune entité `Service` exploitable n’a été confirmée au dernier audit.',
                evidence: 'Le dossier partagé liste des services et le crawl a vu des pages service.',
                reliability: 'calculated',
                severity: 'medium',
            });
        }
    }

    return items;
}

function buildRecommendations({ coverageItems, sameAsSummary, consistencyRows, auditSchemaSignal }) {
    const recommendations = [];

    if (coverageItems.some((item) => item.key === 'localbusiness' && item.operatorStatus === 'absent' && item.shouldExist)) {
        recommendations.push({
            title: 'Renforcer l’entité locale principale',
            description: 'Le mandat a des signaux locaux, mais aucune entité LocalBusiness exploitable n’a été observée dans le schema audité.',
            evidence: coverageItems.find((item) => item.key === 'localbusiness')?.evidence || 'Aucune entité locale observée.',
            reliability: 'calculated',
        });
    }

    if (coverageItems.some((item) => item.key === 'service' && item.operatorStatus !== 'couvert' && item.shouldExist)) {
        recommendations.push({
            title: 'Structurer les offres en entités Service',
            description: 'Les services listés dans le dossier ne ressortent pas encore proprement en entités `Service` observables.',
            evidence: coverageItems.find((item) => item.key === 'service')?.evidence || 'Couverture Service partielle.',
            reliability: 'calculated',
        });
    }

    if (sameAsSummary.status === 'incohérent' || sameAsSummary.status === 'absent') {
        recommendations.push({
            title: 'Aligner sameAs avec les profils mandatés',
            description: 'La comparaison dossier partagé ↔ schema montre des profils absents ou divergents.',
            evidence: sameAsSummary.missingFromSchema.concat(sameAsSummary.unexpectedInSchema).slice(0, 4).join(' · ') || 'sameAs incomplet.',
            reliability: 'calculated',
        });
    }

    if (consistencyRows.some((row) => row.status === 'écart')) {
        recommendations.push({
            title: 'Réconcilier les coordonnées d’entité',
            description: 'Certaines coordonnées observées dans le schema ne recoupent pas le dossier partagé du mandat.',
            evidence: consistencyRows.filter((row) => row.status === 'écart').map((row) => `${row.label} · ${row.detail}`).join(' · '),
            reliability: 'calculated',
        });
    }

    if (auditSchemaSignal?.item) {
        recommendations.push({
            title: auditSchemaSignal.kind === 'issue' ? 'Dernière alerte audit' : 'Dernier signal favorable audit',
            description: localizeAuditCopy(compactString(auditSchemaSignal.item.recommended_fix))
                || localizeAuditCopy(compactString(auditSchemaSignal.item.description))
                || 'Le dernier audit contient un signal schema exploitable.',
            evidence: localizeAuditCopy(compactString(auditSchemaSignal.item.evidence_summary))
                || localizeAuditCopy(compactString(auditSchemaSignal.item.description))
                || 'Preuve audit disponible.',
            reliability: auditItemReliability(auditSchemaSignal.item),
        });
    }

    if (recommendations.length === 0) {
        recommendations.push({
            title: 'Aucun correctif schema prioritaire détecté',
            description: 'Le dernier audit montre une base schema exploitable pour cette étape de fondation.',
            evidence: 'Les écarts majeurs ne ressortent pas dans la lecture actuelle.',
            reliability: 'calculated',
        });
    }

    return recommendations.slice(0, 4);
}

function buildEvidenceLayers({ coverageItems, missingProperties, sameAsSummary }) {
    return {
        measured: {
            title: 'Mesurée',
            description: 'Présence ou absence directe des types et propriétés relevées dans le dernier audit de crawl.',
            reliability: 'measured',
            items: coverageItems.map((item) => `${item.label} · ${item.operatorStatus}`),
        },
        calculated: {
            title: 'Calculée',
            description: 'Résumé de couverture, écarts d’entité et comparaison dossier partagé ↔ schema.',
            reliability: 'calculated',
            items: [
                `${missingProperties.length} lacune(s) de propriétés ou de types`,
                `${sameAsSummary.matched.length} profil(s) sameAs aligné(s)`,
            ],
        },
        ai: {
            title: 'Analyse IA',
            description: 'Aucune analyse IA ciblée sur la clarté d’entité n’est persistée pour cette surface à ce stade.',
            reliability: 'unavailable',
            items: ['Les recommandations affichées ici restent déterministes et fondées sur l’audit observé.'],
        },
        unavailable: {
            title: 'Indisponible',
            description: 'Le repo ne réconcilie pas encore honnêtement les profils externes au-delà du dossier partagé et du schema observé.',
            reliability: 'unavailable',
            items: ['Pas de réconciliation externe complète site ↔ annuaires ↔ profils tiers.'],
        },
    };
}

export async function getSchemaSlice(clientId) {
    const { client, audit } = await getGeoFoundationContext(clientId);

    if (!client) {
        return {
            available: false,
            emptyState: {
                title: 'Surface schema indisponible',
                description: 'Le mandat demandé est introuvable.',
            },
        };
    }

    if (!audit) {
        return {
            available: false,
            emptyState: {
                title: 'Surface schema indisponible',
                description: 'Aucun audit exploitable n’est disponible pour lire la couverture schema de ce mandat.',
            },
        };
    }

    const collected = collectCoverageNodes(audit);
    const organizationEntities = identityEntities(collected.entities);
    const coverageItems = [
        buildCoverageItem({
            key: 'organization',
            label: 'Organization',
            nodes: collected.organizationNodes,
            entities: organizationEntities,
            expectedProperties: ['name', 'url', 'description', 'sameAs'],
            evidenceLabel: 'Organization / entité principale',
            shouldExist: true,
        }),
        buildCoverageItem({
            key: 'localbusiness',
            label: 'LocalBusiness',
            nodes: collected.localBusinessNodes,
            entities: collected.entities.filter((entity) => normalizeTypeList(entity?.types?.length ? entity.types : entity?.type).some((type) => LOCAL_BUSINESS_REGEX.test(type))),
            expectedProperties: ['name', 'address', 'contact', 'areaServed'],
            evidenceLabel: 'LocalBusiness / ancrage local',
            shouldExist: Boolean(compactString(client?.address?.city) || compactString(client?.address?.street) || compactString(client?.business_type)),
        }),
        buildCoverageItem({
            key: 'service',
            label: 'Service',
            nodes: collected.serviceNodes,
            entities: [],
            expectedProperties: ['name', 'description', 'provider'],
            evidenceLabel: 'Service',
            shouldExist: toArray(client?.business_details?.services).length > 0,
        }),
        buildCoverageItem({
            key: 'faq',
            label: 'FAQ',
            nodes: collected.faqNodes,
            entities: [],
            expectedProperties: ['mainEntity'],
            evidenceLabel: 'FAQPage',
            shouldExist: toArray(client?.geo_faqs).length > 0,
        }),
    ];

    const missingProperties = buildMissingProperties({ coverageItems, client, audit });
    const sameAsSummary = buildSameAsSummary(client, collected.organizationNodes.concat(collected.localBusinessNodes), collected.entities);
    const consistencyRows = buildEntityConsistency(client, collected.entities);
    const auditSchemaSignal = findAuditItem(audit, (item) => {
        const haystack = `${item?.title || ''} ${item?.description || ''}`.toLowerCase();
        return /schema|json-ld|données structurées|structured data/.test(haystack);
    });

    return {
        available: true,
        provenance: {
            observed: getProvenanceMeta('observed'),
            derived: getProvenanceMeta('derived'),
            inferred: getProvenanceMeta('inferred'),
            not_connected: getProvenanceMeta('not_connected'),
        },
        summary: {
            coveragePercent: Math.round((coverageItems.filter((item) => item.operatorStatus !== 'absent').length / coverageItems.length) * 100),
            observedTypeCount: uniqueStrings(collected.rawNodes.flatMap((node) => rawNodeTypes(node))).length,
            criticalGapCount: missingProperties.filter((item) => item.severity === 'high').length,
            auditFreshness: timeSince(audit?.created_at) || 'Indisponible',
        },
        freshness: {
            audit: {
                label: 'Dernier audit schema',
                value: timeSince(audit?.created_at) || 'Indisponible',
                detail: 'La lecture schema repose sur le dernier crawl structuré stocké.',
                reliability: audit?.created_at ? 'measured' : 'unavailable',
            },
        },
        coverageItems,
        missingProperties,
        consistencyRows,
        sameAsSummary,
        recommendations: buildRecommendations({ coverageItems, sameAsSummary, consistencyRows, auditSchemaSignal }),
        evidenceLayers: buildEvidenceLayers({ coverageItems, missingProperties, sameAsSummary }),
        auditContext: {
            createdAt: audit?.created_at || null,
            latestSignal: auditSchemaSignal?.item
                ? {
                    kind: auditSchemaSignal.kind,
                    title: localizeAuditCopy(compactString(auditSchemaSignal.item.title)) || 'Signal audit schema',
                    evidence: localizeAuditCopy(compactString(auditSchemaSignal.item.evidence_summary))
                        || localizeAuditCopy(compactString(auditSchemaSignal.item.description))
                        || null,
                    reliability: auditItemReliability(auditSchemaSignal.item),
                }
                : null,
        },
        emptyState: null,
    };
}
