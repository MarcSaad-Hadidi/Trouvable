import 'server-only';

import { getProvenanceMeta } from '@/lib/operator-intelligence/provenance';
import {
    compactString,
    getGeoFoundationContext,
    normalizeComparablePhone,
    normalizeComparableText,
    normalizeComparableUrl,
    timeSince,
    toArray,
} from './geo-foundation-shared';

function uniqueStrings(values = []) {
    return [...new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))];
}

function normalizeSchemaNameMatch(left, right) {
    const a = normalizeComparableText(left);
    const b = normalizeComparableText(right);
    if (!a || !b) return false;
    if (a === b) return true;
    return a.includes(b) || b.includes(a);
}

function extractRelevantEntities(entities = []) {
    return toArray(entities).filter((entity) => {
        const types = toArray(entity?.types?.length ? entity.types : entity?.type).map(t => String(t).toLowerCase());
        return types.some((type) => /(organization|localbusiness|professionalservice|store|restaurant|corporation)/.test(type));
    });
}

function extractServiceEntities(entities = [], nodes = []) {
    const fromEntities = toArray(entities).filter((e) => {
        const types = toArray(e?.types?.length ? e.types : e?.type).map(t => String(t).toLowerCase());
        return types.some(t => t === 'service');
    });

    const fromNodes = toArray(nodes).filter((node) => {
        const types = toArray(node?.['@type']).map(t => String(t).toLowerCase());
        return types.some(t => t === 'service');
    });
    
    return { fromEntities, fromNodes };
}

function buildBrandConsistency(client, entities) {
    const canonicalName = compactString(client?.client_name);
    const relevantEntities = extractRelevantEntities(entities);
    const observedNames = uniqueStrings(relevantEntities.map((e) => compactString(e?.name)).filter(Boolean));

    let status;
    let reliability;
    const contradictions = [];
    
    if (!canonicalName) {
        status = 'à confirmer';
        reliability = 'unavailable';
        contradictions.push('Nom canonique absent du dossier partagé.');
    } else if (observedNames.length === 0) {
        status = 'manquant';
        reliability = 'measured';
        contradictions.push('Aucun nom d’entité (Organization/LocalBusiness) observé dans le schema audité.');
    } else {
        const matched = observedNames.some(name => normalizeSchemaNameMatch(canonicalName, name));
        if (matched) {
            status = 'alignée';
            reliability = 'calculated';
        } else {
            status = 'écart';
            reliability = 'calculated';
            contradictions.push(`Nom observé ('${observedNames[0]}') diverge du nom canonique ('${canonicalName}').`);
        }
    }

    return {
        key: 'brand',
        label: 'Cohérence marque',
        status,
        reliability,
        observedSignals: observedNames,
        contradictions,
        evidence: observedNames.length > 0 
            ? `Noms trouvés dans les sources structurées : ${observedNames.join(' · ')}` 
            : 'Aucun signal structuré exploitable pour le nom.',
    };
}

function buildNAPConsistency(client, entities) {
    const canonicalPhone = normalizeComparablePhone(client?.contact_info?.phone);
    const canonicalEmail = normalizeComparableText(client?.contact_info?.public_email || client?.contact_info?.email);

    const addressParts = [client?.address?.street, client?.address?.city, client?.address?.region].filter(Boolean);
    const canonicalAddress = compactString(addressParts.join(', '));
    const normalizedCanonicalAddress = normalizeComparableText(canonicalAddress);

    const relevantEntities = extractRelevantEntities(entities);
    const observedPhones = uniqueStrings(relevantEntities.map((e) => normalizeComparablePhone(e?.telephone)).filter(Boolean));
    const observedEmails = uniqueStrings(relevantEntities.map((e) => normalizeComparableText(e?.email)).filter(Boolean));
    const observedAddresses = uniqueStrings(relevantEntities.map((e) => compactString(e?.address?.line || e?.address)).filter(Boolean));

    const contradictions = [];
    const gaps = [];

    if (canonicalPhone) {
        if (observedPhones.length === 0) gaps.push('Téléphone structuré manquant');
        else if (!observedPhones.includes(canonicalPhone)) contradictions.push(`Téléphone canonique non trouvé parmi les téléphones structurés.`);
    }

    if (canonicalEmail) {
        if (observedEmails.length === 0) gaps.push('Email structuré manquant');
        else if (!observedEmails.includes(canonicalEmail)) contradictions.push(`Courriel canonique non trouvé parmi les courriels structurés.`);
    }

    if (normalizedCanonicalAddress) {
        if (observedAddresses.length === 0) gaps.push('Adresse structurée manquante');
        else {
            const matches = observedAddresses.some((addr) => {
                const norm = normalizeComparableText(addr);
                return norm.includes(normalizedCanonicalAddress) || normalizedCanonicalAddress.includes(norm);
            });
            if (!matches) contradictions.push('Adresse canonique divergente de l’adresse structurée.');
        }
    }

    const hasAnyCanonical = canonicalPhone || canonicalEmail || normalizedCanonicalAddress;
    const hasAnyObserved = observedPhones.length > 0 || observedEmails.length > 0 || observedAddresses.length > 0;

    let status;
    let reliability = 'unavailable';

    if (!hasAnyCanonical) {
        status = 'à confirmer';
    } else if (!hasAnyObserved) {
        status = 'manquant';
        reliability = 'measured';
    } else if (contradictions.length > 0) {
        status = 'incohérent';
        reliability = 'calculated';
    } else if (gaps.length > 0) {
        status = 'partiellement alignée';
        reliability = 'calculated';
    } else {
        status = 'alignée';
        reliability = 'calculated';
    }

    const observedFields = [];
    if (observedPhones.length > 0) observedFields.push('Téléphones');
    if (observedEmails.length > 0) observedFields.push('Courriels');
    if (observedAddresses.length > 0) observedFields.push('Adresses locales');

    return {
        key: 'nap',
        label: 'Cohérence NAP',
        status,
        reliability,
        observedFields,
        missingFields: gaps,
        contradictions,
        evidence: hasAnyObserved
            ? `Signaux NAP relevés sur : ${observedFields.join(', ')}.`
            : 'Aucun ancrage NAP détecté.',
    };
}

function buildServicesConsistency(client, entities, nodes, _pageSummaries) {
    const canonicalServices = uniqueStrings(toArray(client?.business_details?.services));
    const { fromEntities, fromNodes } = extractServiceEntities(entities, nodes);
    
    const observedServices = uniqueStrings([
        ...fromEntities.map(e => compactString(e?.name)),
        ...fromNodes.map(n => compactString(n?.name))
    ].filter(Boolean));

    let status;
    let reliability = 'unavailable';
    const contradictions = [];
    const aligned = [];
    const notAligned = [];
    const gaps = [];

    if (canonicalServices.length === 0) {
        status = 'à confirmer';
        gaps.push('Aucun service renseigné dans le dossier partagé');
    } else if (observedServices.length === 0) {
        status = 'manquant';
        reliability = 'measured';
        gaps.push('Aucune entité Service structurée découverte');
    } else {
        canonicalServices.forEach(srv => {
            const match = observedServices.some(obs => normalizeComparableText(obs).includes(normalizeComparableText(srv)) || normalizeComparableText(srv).includes(normalizeComparableText(obs)));
            if (match) aligned.push(srv);
            else notAligned.push(srv);
        });

        if (aligned.length === canonicalServices.length) {
            status = 'alignée';
            reliability = 'calculated';
        } else if (aligned.length > 0) {
            status = 'partiellement alignée';
            reliability = 'calculated';
            contradictions.push(`${notAligned.length} service(s) canonique(s) sans entité Service équivalente.`);
        } else {
            status = 'incohérent';
            reliability = 'calculated';
            contradictions.push('Les services canoniques ne matchent aucune entité Service structurée.');
        }
    }

    return {
        key: 'services',
        label: 'Cohérence services',
        status,
        reliability,
        alignedSignals: aligned,
        unalignedSignals: notAligned,
        gaps,
        contradictions,
        evidence: observedServices.length > 0
            ? `${observedServices.length} entité(s) Service relevée(s) lors du dernier audit.`
            : 'Aucun découpage de service détectable dans le JSON-LD.',
    };
}

function buildZonesConsistency(client, entities, nodes) {
    const canonicalZones = uniqueStrings([
        ...toArray(client?.seo_data?.target_cities),
        ...toArray(client?.business_details?.areas_served),
        compactString(client?.address?.city)
    ]);

    const relevantEntities = extractRelevantEntities(entities);
    const observedAreas = uniqueStrings(relevantEntities.flatMap(e => toArray(e?.areaServed)));
    
    // Also check raw nodes just in case
    const rawAreas = uniqueStrings(toArray(nodes).flatMap(n => toArray(n?.areaServed).map(a => compactString(a?.name || a))));
    const allObserved = uniqueStrings([...observedAreas, ...rawAreas]);

    let status;
    let reliability = 'unavailable';
    const contradictions = [];
    const aligned = [];
    const notAligned = [];
    const gaps = [];

    if (canonicalZones.length === 0) {
        status = 'à confirmer';
        gaps.push('Aucune zone desservie ou ville d’ancrage dans le dossier partagé');
    } else if (allObserved.length === 0) {
        status = 'manquant';
        reliability = 'measured';
        gaps.push('Aucune propriété areaServed relevée dans le schema');
    } else {
        canonicalZones.forEach(zone => {
            const match = allObserved.some(obs => normalizeSchemaNameMatch(zone, obs));
            if (match) aligned.push(zone);
            else notAligned.push(zone);
        });

        if (aligned.length === canonicalZones.length) {
            status = 'alignée';
            reliability = 'calculated';
        } else if (aligned.length > 0) {
            status = 'partiellement alignée';
            reliability = 'calculated';
            contradictions.push(`${notAligned.length} zone(s) de couverture orphelines (non vues dans areaServed).`);
        } else {
            status = 'écart notable';
            reliability = 'calculated';
            contradictions.push('Zone de chalandise canonique et zones schema complètement divergentes.');
        }
    }

    return {
        key: 'zones',
        label: 'Cohérence zones',
        status,
        reliability,
        alignedSignals: aligned,
        unalignedSignals: notAligned,
        gaps,
        contradictions,
        evidence: allObserved.length > 0
            ? `${allObserved.length} mention(s) de zone d’intervention trouvée(s) (ex: ${allObserved.slice(0,2).join(', ')}).`
            : 'Les données de couverture spatiale sont invisibles dans les structures de site.',
    };
}

function buildDescriptionConsistency(client, entities, pageSummaries) {
    const canonicalDesc = compactString(client?.business_details?.short_desc) || compactString(client?.business_details?.long_desc);
    const relevantEntities = extractRelevantEntities(entities);
    
    const schemaDesc = relevantEntities.map(e => compactString(e?.description)).find(Boolean);
    const pageDesc = toArray(pageSummaries).find(p => p?.page_type === 'home')?.summary;

    const observedDesc = schemaDesc || pageDesc;

    let status;
    let reliability = 'unavailable';
    const contradictions = [];

    if (!canonicalDesc) {
        status = 'à confirmer';
    } else if (!observedDesc) {
        status = 'manquant';
        reliability = 'measured';
    } else {
        // We only do a very soft check based on tokens overlapping or length since LLMs summaries aren't verbatim
        const canonNorm = normalizeComparableText(canonicalDesc);
        const obsNorm = normalizeComparableText(observedDesc);
        
        // simple token overlap
        const canonWords = canonNorm.split(' ').filter(w => w.length > 3);
        const obsWords = obsNorm.split(' ').filter(w => w.length > 3);
        
        const intersection = canonWords.filter(w => obsWords.includes(w));
        const overlap = canonWords.length > 0 ? intersection.length / canonWords.length : 0;

        if (overlap > 0.2) {
            status = 'alignée';
            reliability = 'calculated';
        } else if (overlap > 0.05) {
            status = 'partiellement alignée';
            reliability = 'calculated';
            contradictions.push('Décalage de lexique ou d’intention significatif entre la présentation dossier et la lecture site/schema.');
        } else {
            status = 'écart notable';
            reliability = 'calculated';
            contradictions.push('Les termes constitutifs de la description canonique sont absents du résumé principal.');
        }
    }

    return {
        key: 'descriptions',
        label: 'Cohérence descriptions',
        status,
        reliability,
        contradictions,
        evidence: schemaDesc 
            ? 'Description lue directement dans les propriétés de l’entité.'
            : pageDesc ? 'Description lue depuis le résumé IA de la page d’accueil.'
            : 'Aucun paragraphe macro n’a pu être extrait.',
    };
}

function buildProfilesConsistency(client, entities, nodes) {
    const dossierProfiles = uniqueStrings(toArray(client?.social_profiles));
    const extractRawSameAs = toArray(nodes).flatMap((node) => toArray(node?.sameAs));
    const entitySameAs = toArray(entities).flatMap((entity) => toArray(entity?.sameAs));
    
    const observedSameAs = uniqueStrings([...extractRawSameAs, ...entitySameAs]);

    const dossierSet = new Set(dossierProfiles.map(normalizeComparableUrl));
    const observedSet = new Set(observedSameAs.map(normalizeComparableUrl));

    const missingFromSchema = dossierProfiles.filter((value) => !observedSet.has(normalizeComparableUrl(value)));
    const unexpectedInSchema = observedSameAs.filter((value) => !dossierSet.has(normalizeComparableUrl(value)));

    let status;
    let reliability = 'unavailable';
    const contradictions = [];

    if (dossierProfiles.length === 0 && observedSameAs.length === 0) {
        status = 'indisponible';
    } else if (dossierProfiles.length > 0 && observedSameAs.length === 0) {
        status = 'manquant';
        reliability = 'measured';
        contradictions.push('Profils canoniques non signalés en sameAs.');
    } else if (missingFromSchema.length > 0 || unexpectedInSchema.length > 0) {
        status = 'incohérent';
        reliability = 'calculated';
        if (missingFromSchema.length > 0) contradictions.push(`${missingFromSchema.length} profil(s) canonique(s) absent(s) du schema.`);
        if (unexpectedInSchema.length > 0) contradictions.push(`${unexpectedInSchema.length} lien(s) sameAs non identifié(s) dans le dossier.`);
    } else {
        status = 'alignée';
        reliability = 'calculated';
    }

    return {
        key: 'profiles',
        label: 'Profils externes / sameAs',
        status,
        reliability,
        presenceCount: observedSameAs.length,
        missingFromSchema,
        unexpectedInSchema,
        contradictions,
        evidence: observedSameAs.length > 0 
            ? `${observedSameAs.length} mention(s) sameAs exploitées.`
            : 'Aucun sameAs.'
    };
}

function extractCriticalContradictions(dimensions) {
    return dimensions.flatMap(dim => 
        (dim.contradictions || []).map(text => ({ dimension: dim.label, text, severity: 'high' }))
    );
}

function buildGlobalStateAndRecommendations(dimensions) {
    const recommendations = [];
    const unavailableCount = dimensions.filter(d => ['indisponible', 'à confirmer'].includes(d.status)).length;
    const missingCount = dimensions.filter(d => ['manquant'].includes(d.status)).length;
    const issueCount = dimensions.filter(d => ['incohérent', 'écart', 'écart notable', 'partiellement alignée'].includes(d.status)).length;

    let globalState;
    let reliability = 'unavailable';
    
    if (unavailableCount === dimensions.length) {
        globalState = 'indisponible';
    } else if (missingCount > dimensions.length / 2) {
        globalState = 'faible (manques majeurs)';
        reliability = 'measured';
    } else if (issueCount > 1) {
        globalState = 'divergence observée';
        reliability = 'calculated';
    } else if (dimensions.filter(d => d.status === 'alignée').length >= 3) {
        globalState = 'cohérence probable';
        reliability = 'calculated';
    } else {
        globalState = 'comparaison partielle';
        reliability = 'calculated';
    }

    dimensions.forEach(dim => {
        if (dim.key === 'brand' && ['incohérent', 'écart', 'manquant'].includes(dim.status)) {
            recommendations.push({
                title: 'Clarifier ou consolider la marque canonique',
                explanation: dim.status === 'manquant' 
                    ? 'L’absence de nom dans le JSON-LD d’entité principale dégrade fortement la clarté GEO.' 
                    : 'Le dossier partagé et la lecture locale du site déploient des identités divergentes.',
                reliability: 'calculated'
            });
        }
        if (dim.key === 'nap' && (dim.missingFields?.length > 0 || dim.contradictions?.length > 0)) {
            recommendations.push({
                title: 'Harmoniser le socle NAP',
                explanation: 'Les coordonnées (téléphone, adresse) doivent faire office de source de vérité unique pour faciliter l’élicitation algorithmique.',
                reliability: 'calculated'
            });
        }
        if (dim.key === 'services' && ['manquant', 'incohérent', 'partiellement alignée'].includes(dim.status)) {
            recommendations.push({
                title: 'Déployer les entités Service manquantes',
                explanation: 'Les offres mentionnées dans le dossier ne se retrouvent pas en tant que nœuds sémantiques isolés et vérifiables.',
                reliability: 'calculated'
            });
        }
    });

    if (recommendations.length === 0) {
        recommendations.push({
            title: 'Base de cohérence saine reconnue',
            explanation: 'Les signaux observés actuellement concordent globalement avec le dossier opérateur.',
            reliability: 'calculated'
        });
    }

    return { globalState, reliability, recommendations: recommendations.slice(0, 3) };
}

export async function getConsistencySlice(clientId) {
    const { client, audit } = await getGeoFoundationContext(clientId);

    if (!client) {
        return {
            available: false,
            emptyState: {
                title: 'Surface de cohérence indisponible',
                description: 'Le mandat demandé est introuvable.',
            },
        };
    }

    if (!audit) {
        return {
            available: false,
            emptyState: {
                title: 'Données insuffisantes',
                description: 'Aucun audit exploitable n’est disponible pour extraire des comparaisons tangibles sur ce mandat.',
            },
        };
    }

    const rawNodes = toArray(audit?.extracted_data?.structured_data);
    const entities = toArray(audit?.extracted_data?.schema_entities);
    const pageSummaries = toArray(audit?.extracted_data?.page_summaries);

    const brand = buildBrandConsistency(client, entities);
    const nap = buildNAPConsistency(client, entities);
    const services = buildServicesConsistency(client, entities, rawNodes, pageSummaries);
    const zones = buildZonesConsistency(client, entities, rawNodes);
    const descriptions = buildDescriptionConsistency(client, entities, pageSummaries);
    const profiles = buildProfilesConsistency(client, entities, rawNodes);

    const dimensions = [brand, nap, services, zones, descriptions, profiles];
    const criticalContradictions = extractCriticalContradictions(dimensions);
    const { globalState, reliability: globalReliability, recommendations } = buildGlobalStateAndRecommendations(dimensions);

    return {
        available: true,
        provenance: {
            observed: getProvenanceMeta('observed'),
            derived: getProvenanceMeta('derived'),
            inferred: getProvenanceMeta('inferred'),
            not_connected: getProvenanceMeta('not_connected'),
        },
        freshness: {
            audit: {
                label: 'Dernier audit considéré',
                value: timeSince(audit?.created_at) || 'Inconnue',
                detail: 'Comparaison effectuée à partir du dernier balayage local enregistré.',
                reliability: audit?.created_at ? 'measured' : 'unavailable',
            },
        },
        summary: {
            globalState,
            reliability: globalReliability,
            criticalCount: criticalContradictions.length,
        },
        dimensions,
        criticalContradictions,
        recommendations,
        emptyState: null,
    };
}
