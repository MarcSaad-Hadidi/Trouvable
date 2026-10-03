import { getBusinessShortDescription, getPublicContactEmail } from '@/lib/client-profile';
import { normalizeTruthClass, defaultReviewStatusForTruthClass } from '@/lib/truth/definitions';

/**
 * Safe Merge — Génère des suggestions de merge sans écraser les données existantes.
 *
 * Règles:
 * - Jamais écraser une bonne donnée existante
 * - Champ vide + suggestion forte → confidence high
 * - Champ conflictuel / ambigu → pending à réviser
 * - Toujours stocker: field_name, current_value, suggested_value, confidence, rationale, source
 */
export function generateMergeSuggestions({ clientId, auditId, client, scanResults, aiAnalysis, automationData }) {
    const suggestions = [];
    const ed = scanResults?.extracted_data || {};

    const contactInfo = client?.contact_info || {};
    const businessDetails = client?.business_details || {};
    const existing = {
        phone: contactInfo.phone || '',
        public_email: getPublicContactEmail(contactInfo),
        seo_title: client?.seo_title || '',
        seo_description: client?.seo_description || '',
        address: client?.address || {},
        social_profiles: client?.social_profiles || [],
        short_desc: getBusinessShortDescription(businessDetails),
        services: businessDetails.services || [],
        areas_served: businessDetails.areas_served || [],
    };

    function suggest(field_name, suggestedValue, confidence, rationale, source) {
        if (!suggestedValue) return;
        const sv = typeof suggestedValue === 'string' ? suggestedValue.trim() : JSON.stringify(suggestedValue);
        if (!sv || sv === '[]' || sv === '{}' || sv === '""') return;

        const currentVal = existing[field_name];
        const cv = typeof currentVal === 'string' ? currentVal.trim() : JSON.stringify(currentVal || '');

        if (cv === sv) return;

        if (cv && cv !== '[]' && cv !== '{}' && cv !== '""') {
            confidence = 'low';
            rationale = `Conflit: valeur actuelle "${cv.slice(0, 50)}" vs suggérée "${sv.slice(0, 50)}". ${rationale}`;
        }

        const validSource = ['observed', 'inferred', 'recommended'].includes(source) ? source : 'recommended';
        const truthClass = normalizeTruthClass(validSource);
        suggestions.push({
            client_id: clientId,
            audit_id: auditId,
            field_name,
            current_value: cv || '',
            suggested_value: sv,
            confidence: ['high', 'medium', 'low'].includes(confidence) ? confidence : 'medium',
            rationale: (rationale || '').slice(0, 500),
            source: validSource,
            truth_class: truthClass,
            review_status: defaultReviewStatusForTruthClass(truthClass),
            status: 'pending',
        });
    }

    // From deterministic automation_data
    for (const auto of automationData || []) {
        if (auto.field_key === 'phone' && auto.detected_value) {
            suggest('phone', auto.detected_value, auto.confidence_level, 'Téléphone détecté par crawl', 'observed');
        }
        if (auto.field_key === 'public_email' && auto.detected_value) {
            suggest('public_email', auto.detected_value, auto.confidence_level, 'Email détecté par crawl', 'observed');
        }
        if (auto.field_key === 'short_desc' && auto.detected_value) {
            suggest('short_desc', auto.detected_value, 'medium', 'Meta description du site', 'observed');
        }
        if (auto.field_key === 'social_profiles' && Array.isArray(auto.detected_value) && auto.detected_value.length > 0) {
            const currentSocials = existing.social_profiles || [];
            const newSocials = auto.detected_value.filter(s => !currentSocials.some(cs => cs.url === s || cs === s));
            if (newSocials.length > 0) {
                suggest('social_profiles', newSocials, 'high', `${newSocials.length} profil(s) social(aux) détecté(s) par crawl`, 'observed');
            }
        }
    }

    // SEO title/description from crawl
    if (ed.titles?.length > 0 && !existing.seo_title) {
        suggest('seo_title', ed.titles[0], 'medium', 'Title tag de la homepage', 'observed');
    }
    if (ed.descriptions?.length > 0 && !existing.seo_description) {
        suggest('seo_description', ed.descriptions[0], 'medium', 'Meta description de la homepage', 'observed');
    }

    // From AI analysis
    if (aiAnalysis) {
        for (const ms of aiAnalysis.merge_suggestions || []) {
            if (!ms?.field_name || !ms?.suggested_value) continue;
            suggest(ms.field_name, ms.suggested_value, ms.confidence || 'medium', ms.rationale || 'Suggestion IA', ms.source || 'recommended');
        }

        if (aiAnalysis.detected_services?.length > 0 && existing.services.length === 0) {
            suggest('services', aiAnalysis.detected_services, 'medium', 'Services identifiés par analyse IA du contenu', 'inferred');
        }
        if (aiAnalysis.detected_areas?.length > 0 && existing.areas_served.length === 0) {
            suggest('areas_served', aiAnalysis.detected_areas, 'medium', 'Zones desservies identifiées par analyse IA', 'inferred');
        }
        if (aiAnalysis.detected_business_name && !client?.client_name) {
            suggest('client_name', aiAnalysis.detected_business_name, 'medium', 'Nom d\'entreprise détecté par IA', 'inferred');
        }
    }

    // Deduplicate by field_name (keep highest confidence)
    const confOrder = { high: 3, medium: 2, low: 1 };
    const unique = new Map();
    for (const s of suggestions) {
        const prev = unique.get(s.field_name);
        if (!prev || (confOrder[s.confidence] || 0) > (confOrder[prev.confidence] || 0)) {
            unique.set(s.field_name, s);
        }
    }

    return Array.from(unique.values());
}
