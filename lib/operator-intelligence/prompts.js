import 'server-only';

import { getBusinessShortDescription } from '@/lib/client-profile';
import * as db from '@/lib/db';
import {
    getTrackedQueryCategoryMeta,
    getTrackedQueryCategoryOptions,
    normalizeTrackedQueryCategory,
    inferDiscoveryMode,
    isVisibilityEligible,
    countsAsVisibilityOutcome,
    getDiscoveryModeOptions,
    getDiscoveryModeMeta,
    normalizeDiscoveryMode,
} from '@/lib/operator-intelligence/prompt-taxonomy';
import { getProvenanceMeta } from '@/lib/operator-intelligence/provenance';
import { isRunFailureStatus, isRunSuccessStatus, normalizeRunParseStatus } from '@/lib/operator-intelligence/run-lifecycle';
import {
    buildPromptMetadata,
    getPromptIntentFamilies,
    shouldSoftBlockPromptActivation,
} from '@/lib/queries/prompt-intelligence';
import { deserializePromptContractFromRow } from '@/lib/queries/prompt-contract-persistence';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { buildCanonicalBusinessDetection } from '@/lib/truth/detection';

function sortPrompts(a, b) {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    if (a.quality_status !== b.quality_status) {
        const weight = { weak: 0, review: 1, strong: 2 };
        return (weight[a.quality_status] || 0) - (weight[b.quality_status] || 0);
    }
    return String(a.query_text || '').localeCompare(String(b.query_text || ''), 'fr-CA');
}

function inferSiteType(latestAudit) {
    return (
        latestAudit?.geo_breakdown?.site_classification?.type
        || latestAudit?.seo_breakdown?.site_classification?.type
        || 'generic_business'
    );
}

function inferSiteTypeLabel(latestAudit) {
    return (
        latestAudit?.geo_breakdown?.site_classification?.label
        || latestAudit?.seo_breakdown?.site_classification?.label
        || 'Entreprise generaliste'
    );
}

function extractKnownCompetitors(client = {}) {
    if (Array.isArray(client?.business_details?.competitors)) {
        return [...new Set(client.business_details.competitors.map((value) => String(value || '').trim()).filter(Boolean))];
    }
    return [];
}

function humanizeSlug(slug) {
    return String(slug || '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isWeakAnchorText(value) {
    const t = String(value || '').trim().toLowerCase();
    if (t.length < 4) return true;
    if (/^(service local|general|entreprise|business|saas|saas product|logiciel|plateforme|notre activite|activite)$/.test(t)) return true;
    if (/^https?:\/\/schema\.org\//i.test(String(value || ''))) return true;
    return false;
}

/** Ancre métier pour éviter les prompts « catégorie SEO » vides. */
function resolveOfferAnchor({ services, categoryLabel, resolvedBusiness }) {
    const fromResolved = String(resolvedBusiness?.offering_anchor || '').trim();
    if (!isWeakAnchorText(fromResolved)) return fromResolved;
    const s0 = String(services[0] || '').trim();
    if (!isWeakAnchorText(s0)) return s0;
    const s1 = String(services[1] || '').trim();
    if (!isWeakAnchorText(s1)) return s1;
    const cat = String(categoryLabel || '').trim();
    if (cat.length >= 4 && !/^(localbusiness|organization|business|company|service)$/i.test(cat)) return cat;
    const slugHuman = humanizeSlug(resolvedBusiness?.canonical_category);
    if (slugHuman && !/^(service local|general)$/i.test(slugHuman)) return slugHuman;
    return '';
}

function buildPromptBlueprints({ clientName, categoryLabel, city, locale, services, knownCompetitors, resolvedBusiness }) {
    const canonicalCategory = resolvedBusiness?.canonical_category;
    const businessModel = resolvedBusiness?.business_model_detected;
    const isSaas = businessModel === 'saas' || canonicalCategory === 'ai_visibility_software';
    const cityTextWithPreposition = city ? `a ${city}` : 'dans ma zone';
    const anchor = resolveOfferAnchor({ services, categoryLabel, resolvedBusiness });
    const primaryService = String(services[0] || '').trim() || anchor;
    const declaredCompetitor = knownCompetitors[0]?.trim() || '';
    const useCaseHint = String(resolvedBusiness?.primary_use_case || '').replace(/^Livrer \/ réaliser : /i, '').trim() || anchor || `les besoins couverts par ${clientName}`;
    const normalizedOfferLabel = String(anchor || primaryService || '').replace(/^\d+\.\s*/, '').trim();
    const userVisibleOffering = normalizedOfferLabel || (isSaas ? 'visibilite IA locale' : `service ${cityTextWithPreposition}`);
    const offerAnchor = normalizedOfferLabel || String(categoryLabel || '').trim();
    const shortlistCompetitorsPrompt = `Quelles alternatives a ${clientName} existent pour ${userVisibleOffering}${city ? ` ${cityTextWithPreposition}` : ''} ?`;
    const dualChoicePrompt = declaredCompetitor
        ? `${clientName} ou ${declaredCompetitor} pour ${useCaseHint} ${cityTextWithPreposition} : que choisir et pourquoi ?`
        : shortlistCompetitorsPrompt;

    const softwareLabel = isSaas
        ? (canonicalCategory === 'ai_visibility_software'
            ? 'visibilite dans les reponses IA pour commerces locaux'
            : (anchor || humanizeSlug(canonicalCategory) || 'logiciel metier'))
        : '';

    // Shared metadata shape for all blueprints
    const shared = { locale, offer_anchor: offerAnchor, offer_label_normalized: normalizedOfferLabel, user_visible_offering: userVisibleOffering };

    // --- Blind discovery prompts (NO client name, NO competitor names) ---
    // These measure spontaneous visibility: the generation prompt is target-blind.
    // visibility_eligible: true — these are the only runs that can count toward spontaneous visibility KPIs.
    const blindDiscoveryPrompts = isSaas
        ? [
            {
                id: 'blind-market-discovery',
                query_text: `Quel est le meilleur outil de ${userVisibleOffering} pour un commerce local ?`,
                intent_family: 'discovery',
                category: 'discovery',
                prompt_mode: 'user_like',
                discovery_mode: 'blind_discovery',
                visibility_eligible: true,
                rationale: 'Question marche spontanee sans nom de marque, mesure la visibilite reelle.',
                ...shared,
            },
            {
                id: 'blind-service-discovery',
                query_text: `Comment ameliorer sa visibilite dans les reponses IA quand on est un commerce local ?`,
                intent_family: 'discovery',
                category: 'service_intent',
                prompt_mode: 'user_like',
                discovery_mode: 'blind_discovery',
                visibility_eligible: true,
                rationale: 'Question service generique, teste si la marque emerge spontanement.',
                ...shared,
            },
        ]
        : [
            {
                id: 'blind-local-discovery',
                query_text: city
                    ? `Quel est le meilleur ${offerAnchor || categoryLabel} ${cityTextWithPreposition} ?`
                    : `Comment trouver un bon ${offerAnchor || categoryLabel} pres de chez moi ?`,
                intent_family: 'local_recommendation',
                category: city ? 'local_intent' : 'service_intent',
                prompt_mode: 'user_like',
                discovery_mode: 'blind_discovery',
                visibility_eligible: true,
                rationale: 'Recommandation locale spontanee sans marque, mesure la visibilite reelle.',
                ...shared,
            },
            {
                id: 'blind-service-discovery',
                query_text: `Quels criteres pour choisir un bon ${offerAnchor || categoryLabel}${city ? ` ${cityTextWithPreposition}` : ''} ?`,
                intent_family: 'discovery',
                category: 'service_intent',
                prompt_mode: 'user_like',
                discovery_mode: 'blind_discovery',
                visibility_eligible: true,
                rationale: 'Question service generique sans marque, teste si la cible emerge spontanement.',
                ...shared,
            },
        ];

    // --- Brand-aware prompts (existing, with client name) ---
    // visibility_eligible: false — these are intentionally biased and must not inflate spontaneous visibility.
    const brandAwarePrompts = isSaas
        ? [
            {
                id: 'brand-visibility',
                query_text: `Pour quels types d'entreprises ${clientName} est-il pertinent ?`,
                intent_family: 'brand',
                category: 'brand',
                prompt_mode: 'user_like',
                discovery_mode: 'neutral_brand_check',
                visibility_eligible: false,
                rationale: 'Question utilisateur naturelle orientee positionnement.',
                ...shared,
            },
            {
                id: 'brand-use-cases',
                query_text: `Dans quels cas d'usage une entreprise locale choisirait ${clientName} ?`,
                intent_family: 'brand',
                category: 'brand',
                prompt_mode: 'user_like',
                discovery_mode: 'neutral_brand_check',
                visibility_eligible: false,
                rationale: 'Clarifie la promesse en situation reelle.',
                ...shared,
            },
            {
                id: 'competitor-alternatives',
                query_text: `Quelles alternatives a ${clientName} sont citees pour ${softwareLabel} et pourquoi ?`,
                intent_family: 'competitor',
                category: 'competitor_comparison',
                prompt_mode: 'user_like',
                discovery_mode: 'competitor_discovery',
                visibility_eligible: false,
                rationale: 'Detection d alternatives directes cote marche.',
                ...shared,
            },
            {
                id: 'competitor-probe',
                query_text: declaredCompetitor
                    ? `${clientName} vs ${declaredCompetitor} : compare 3 criteres et justifie chaque ecart.`
                    : `Liste 3 options concurrentes a ${clientName}, avec un critere de differentiation par option.`,
                intent_family: 'competitor',
                category: 'competitor_comparison',
                prompt_mode: 'operator_probe',
                discovery_mode: 'competitor_discovery',
                visibility_eligible: false,
                rationale: 'Probe operateur pour shortlist et justification.',
                ...shared,
            },
            {
                id: 'pricing',
                query_text: `Que comprend une offre de ${softwareLabel}, et quels frais caches ou delais verifier ?`,
                intent_family: 'pricing',
                category: 'brand',
                prompt_mode: 'user_like',
                discovery_mode: 'neutral_brand_check',
                visibility_eligible: false,
                rationale: 'Demande prix/inclusions/delais en une seule intention claire.',
                ...shared,
            },
            {
                id: 'buyer-guidance',
                query_text: `Quels criteres et quelles preuves demander avant de choisir ${clientName} ?`,
                intent_family: 'buyer_guidance',
                category: 'brand',
                prompt_mode: 'user_like',
                discovery_mode: 'skeptical_brand_evaluation',
                visibility_eligible: false,
                rationale: 'Guide d achat actionnable.',
                ...shared,
            },
            {
                id: 'implementation',
                query_text: `Quels prerequis techniques et indicateurs suivre dans les 30 premiers jours avec ${clientName} ?`,
                intent_family: 'implementation',
                category: 'brand',
                prompt_mode: 'operator_probe',
                discovery_mode: 'controlled_context_answer',
                visibility_eligible: false,
                rationale: 'Qualification post-signature (etapes + KPI).',
                ...shared,
            },
        ]
        : [
            {
                id: 'brand-visibility',
                query_text: `Pour quels besoins ${clientName} est-il le plus pertinent ${city ? cityTextWithPreposition : ''} ?`,
                intent_family: 'brand',
                category: 'brand',
                prompt_mode: 'user_like',
                discovery_mode: 'neutral_brand_check',
                visibility_eligible: false,
                rationale: 'Positionnement marque orienté besoin.',
                ...shared,
            },
            {
                id: 'competitor-alternatives',
                query_text: shortlistCompetitorsPrompt,
                intent_family: 'competitor',
                category: 'competitor_comparison',
                prompt_mode: 'user_like',
                discovery_mode: 'competitor_discovery',
                visibility_eligible: false,
                rationale: 'Expose alternatives reelles cote utilisateur.',
                ...shared,
            },
            {
                id: 'competitor-comparison',
                query_text: dualChoicePrompt,
                intent_family: 'competitor',
                category: 'competitor_comparison',
                prompt_mode: 'operator_probe',
                discovery_mode: 'competitor_discovery',
                visibility_eligible: false,
                rationale: 'Probe comparatif structuré.',
                ...shared,
            },
            {
                id: 'pricing',
                query_text: `Quels prix, inclusions et delais faut-il verifier pour ${userVisibleOffering} ${cityTextWithPreposition} ?`,
                intent_family: 'pricing',
                category: 'brand',
                prompt_mode: 'user_like',
                discovery_mode: 'neutral_brand_check',
                visibility_eligible: false,
                rationale: 'Pricing concret et non vague.',
                ...shared,
            },
            {
                id: 'objections',
                query_text: `Quelles questions, risques et preuves verifier avant de choisir ${clientName} ?`,
                intent_family: 'buyer_guidance',
                category: 'brand',
                prompt_mode: 'operator_probe',
                discovery_mode: 'skeptical_brand_evaluation',
                visibility_eligible: false,
                rationale: 'Buyer guidance exploitable.',
                ...shared,
            },
            {
                id: 'implementation',
                query_text: `Quelles etapes, prerequis et indicateurs suivre apres signature pour ${userVisibleOffering} ?`,
                intent_family: 'implementation',
                category: 'brand',
                prompt_mode: 'operator_probe',
                discovery_mode: 'controlled_context_answer',
                visibility_eligible: false,
                rationale: 'Cadre implementation court et structuré.',
                ...shared,
            },
        ];

    // Blind discovery first, then brand-aware — discovery prompts are the primary visibility metric
    return [...blindDiscoveryPrompts, ...brandAwarePrompts];
}

export function buildStarterPromptPack({ client, siteType, siteClassification, locale, existingPrompts }) {
    const existing = new Set(
        (existingPrompts || [])
            .map((prompt) => String(prompt?.query_text || '').trim().toLowerCase())
            .filter(Boolean)
    );

    const clientName = String(client?.client_name || '').trim() || 'votre marque';
    const city = String(client?.address?.city || client?.target_region || '').trim();
    const categoryLabel = String(client?.business_type || 'service local').trim();
    const services = Array.isArray(client?.business_details?.services) ? client.business_details.services : [];
    const knownCompetitors = extractKnownCompetitors(client);

    const canonicalDetection = buildCanonicalBusinessDetection({
        clientName,
        rawBusinessType: categoryLabel,
        siteClassification,
        servicesPreview: Array.isArray(client?.business_details?.services) ? client.business_details.services : [],
        shortDescription: getBusinessShortDescription(client?.business_details || {}).slice(0, 400),
        seoTeaser: String(client?.seo_description || '').trim().slice(0, 220),
        address: client?.address || {},
        targetRegion: String(client?.target_region || '').trim(),
    });
    const resolvedBusiness = canonicalDetection.resolved_business;

    const blueprints = buildPromptBlueprints({
        clientName,
        categoryLabel,
        city,
        locale: locale || 'fr-CA',
        services,
        knownCompetitors,
        resolvedBusiness
    });

    const prompts = blueprints
        .filter((item) => !existing.has(item.query_text.toLowerCase()))
        .map((item) => {
            const metadata = buildPromptMetadata({
                queryText: item.query_text,
                clientName,
                city,
                region: String(client?.target_region || ''),
                locale: item.locale,
                category: categoryLabel,
                services,
                knownCompetitors,
                promptOrigin: `starter_pack_${siteType || 'generic'}`,
                intentFamily: item.intent_family,
                promptMode: item.prompt_mode || 'user_like',
                offerAnchor: item.offer_anchor || '',
                userVisibleOffering: item.user_visible_offering || '',
                targetAudience: resolvedBusiness?.target_audience || '',
                primaryUseCase: resolvedBusiness?.primary_use_case || '',
                differentiationAngle: item.intent_family === 'competitor' ? 'comparative' : '',
            });

            return {
                ...item,
                ...metadata,
                discovery_mode: item.discovery_mode || 'brand_aware',
                visibility_eligible: item.visibility_eligible === true,
                prompt_mode: metadata.prompt_mode || item.prompt_mode || 'user_like',
                offer_anchor: item.offer_anchor || null,
                offer_label_normalized: item.offer_label_normalized || null,
                user_visible_offering: item.user_visible_offering || null,
                evidence: 'inferred',
                confidence: metadata.quality_status === 'strong' ? 'high' : metadata.quality_status === 'review' ? 'medium' : 'low',
                activation_blocked: shouldSoftBlockPromptActivation(metadata),
                validation: {
                    status: metadata.validation_status || metadata.quality_status,
                    is_valid: metadata.quality_status !== 'weak',
                    reasons: Array.isArray(metadata.validation_reasons) ? metadata.validation_reasons : metadata.quality_reasons,
                },
                is_selected_default: metadata.quality_status === 'strong',
            };
        })
        .slice(0, 10);

    const weakCount = prompts.filter((item) => item.quality_status === 'weak').length;
    return {
        title: prompts.length > 0 ? 'Pack de prompts suggeres' : 'Pack de demarrage deja couvert',
        description: prompts.length > 0
            ? 'Suggestions inferees depuis le contexte client. Les prompts faibles sont marques pour revue operateur.'
            : 'Les prompts suivis existants couvrent deja le pack de demarrage recommande.',
        prompts,
        weakPromptCount: weakCount,
        supportedIntentFamilies: getPromptIntentFamilies(),
    };
}

function emptyMentionCounts() {
    return {
        source: 0,
        competitor: 0,
        non_target: 0,
        target: 0,
    };
}

export async function getPromptSlice(clientId) {
    const supabase = getAdminSupabase();
    const [client, latestAudit, trackedQueries, lastRunMap, runs] = await Promise.all([
        db.getClientById(clientId).catch(() => null),
        db.getLatestAudit(clientId).catch(() => null),
        db.getTrackedQueriesAll(clientId),
        db.getLastRunPerTrackedQuery(clientId),
        db.getQueryRunsHistory(clientId, 400).catch(() => []),
    ]);

    const historyByPrompt = new Map();
    for (const run of runs || []) {
        if (!run.tracked_query_id) continue;
        if (!historyByPrompt.has(run.tracked_query_id)) {
            historyByPrompt.set(run.tracked_query_id, {
                total: 0,
                completed: 0,
                failed: 0,
                running: 0,
                pending: 0,
            });
        }
        const bucket = historyByPrompt.get(run.tracked_query_id);
        bucket.total += 1;
        if (isRunSuccessStatus(run.status)) bucket.completed += 1;
        else if (isRunFailureStatus(run.status)) bucket.failed += 1;
        else if (run.status === 'running') bucket.running += 1;
        else if (run.status === 'pending') bucket.pending += 1;
    }

    const latestRunIds = [...new Set([...lastRunMap.values()].map((run) => run?.id).filter(Boolean))];
    const mentionCountsByRunId = new Map();

    if (latestRunIds.length > 0) {
        const { data: mentionRows, error: mentionError } = await supabase
            .from('query_mentions')
            .select('query_run_id, entity_type, is_target')
            .in('query_run_id', latestRunIds);

        if (mentionError) {
            throw new Error(`[OperatorIntelligence/prompts] mentions: ${mentionError.message}`);
        }

        for (const mention of mentionRows || []) {
            if (!mentionCountsByRunId.has(mention.query_run_id)) {
                mentionCountsByRunId.set(mention.query_run_id, emptyMentionCounts());
            }
            const bucket = mentionCountsByRunId.get(mention.query_run_id);
            const entityType = mention.entity_type || 'business';

            if (entityType === 'source') {
                bucket.source += 1;
                continue;
            }
            if (entityType === 'competitor') {
                bucket.competitor += 1;
                continue;
            }
            if (mention.is_target === true) {
                bucket.target += 1;
                continue;
            }
            bucket.non_target += 1;
        }
    }

    const knownCompetitors = extractKnownCompetitors(client || {});
    const city = client?.address?.city || client?.target_region || '';
    const region = client?.target_region || '';
    const services = Array.isArray(client?.business_details?.services) ? client.business_details.services : [];

    const prompts = (trackedQueries || [])
        .map((query) => {
            const categoryMeta = getTrackedQueryCategoryMeta(query.category || query.query_type, query.query_text);
            const lastRun = lastRunMap.get(query.id) || null;
            const resolvedParseStatus = lastRun ? normalizeRunParseStatus(lastRun) : null;
            const history = historyByPrompt.get(query.id) || { total: 0, completed: 0, failed: 0, running: 0, pending: 0 };
            const mentionCounts = lastRun
                ? (mentionCountsByRunId.get(lastRun.id) || emptyMentionCounts())
                : emptyMentionCounts();
            const responseText = String(lastRun?.response_text || '').trim();

            // Resolve discovery mode: explicit stored > inferred from metadata
            const rawDiscoveryMode = query.discovery_mode || query.prompt_metadata?.discovery_mode || '';
            const normalizedDiscoveryMode = normalizeDiscoveryMode(rawDiscoveryMode);
            const resolvedDiscoveryMode = rawDiscoveryMode
                ? normalizedDiscoveryMode
                : inferDiscoveryMode({
                    category: categoryMeta.key,
                    intentFamily: query.intent_family,
                    queryText: query.query_text,
                    clientName: client?.client_name || '',
                });
            const promptVisibilityEligible = isVisibilityEligible(resolvedDiscoveryMode);
            const discoveryModeMeta = getDiscoveryModeMeta(resolvedDiscoveryMode);

            const computedMetadata = buildPromptMetadata({
                queryText: query.query_text,
                clientName: client?.client_name || '',
                city,
                region,
                locale: query.locale || 'fr-CA',
                category: client?.business_type || '',
                services,
                knownCompetitors,
                promptOrigin: query.prompt_origin || 'manual_operator',
                intentFamily: query.intent_family || null,
                promptMode: query.prompt_mode || query.prompt_metadata?.prompt_mode || 'user_like',
                offerAnchor: query.offer_anchor || query.prompt_metadata?.offer_anchor || '',
                userVisibleOffering: query.user_visible_offering || query.prompt_metadata?.user_visible_offering || '',
                targetAudience: query.target_audience || query.prompt_metadata?.target_audience || '',
                primaryUseCase: query.primary_use_case || query.prompt_metadata?.primary_use_case || '',
                differentiationAngle: query.differentiation_angle || query.prompt_metadata?.differentiation_angle || '',
            });

            const contract = deserializePromptContractFromRow({
                row: query,
                computed: computedMetadata,
            });

            return {
                id: query.id,
                query_text: query.query_text,
                locale: query.locale || 'fr-CA',
                is_active: query.is_active !== false,
                category: categoryMeta.key,
                category_label: categoryMeta.label,
                category_description: categoryMeta.description,
                discovery_mode: resolvedDiscoveryMode,
                discovery_mode_label: discoveryModeMeta.label,
                bias_risk: discoveryModeMeta.bias_risk,
                evidence_level: discoveryModeMeta.evidence_level,
                answer_type: discoveryModeMeta.answer_type,
                context_injected: discoveryModeMeta.bias_risk === 'context_injected',
                source_grounded: discoveryModeMeta.bias_risk === 'source_grounded',
                visibility_eligible: promptVisibilityEligible,
                created_at: query.created_at,
                updated_at: query.updated_at,
                prompt_metadata: query.prompt_metadata || {},
                prompt_origin: contract.prompt_origin,
                intent_family: contract.intent_family,
                prompt_mode: contract.prompt_mode,
                query_type_v2: contract.query_type_v2,
                funnel_stage: contract.funnel_stage,
                geo_scope: contract.geo_scope,
                brand_scope: contract.brand_scope,
                comparison_scope: contract.comparison_scope,
                validation_status: contract.validation_status,
                validation_reasons: contract.validation_reasons,
                offer_anchor: contract.offer_anchor,
                user_visible_offering: contract.user_visible_offering,
                target_audience: contract.target_audience,
                primary_use_case: contract.primary_use_case,
                differentiation_angle: contract.differentiation_angle,
                quality_status: contract.quality_status,
                quality_score: contract.quality_score,
                quality_reasons: contract.quality_reasons,
                activation_blocked: shouldSoftBlockPromptActivation({ quality_status: contract.quality_status }),
                last_run: lastRun
                    ? {
                        id: lastRun.id,
                        created_at: lastRun.created_at,
                        status: lastRun.status,
                        parse_status: resolvedParseStatus,
                        parse_confidence: lastRun.parse_confidence ?? null,
                        target_found: lastRun.target_found === true,
                        provider: lastRun.provider,
                        model: lastRun.model,
                        target_position: lastRun.target_position ?? lastRun.parsed_response?.target_position ?? null,
                        total_mentioned: Number(lastRun.total_mentioned || 0),
                        run_signal_tier: lastRun.parsed_response?.run_signal_tier || null,
                        discovery_mode: lastRun.discovery_mode || lastRun.parsed_response?.discovery_mode || resolvedDiscoveryMode,
                        answer_generation_mode: lastRun.parsed_response?.answer_generation_mode || lastRun.prompt_payload?.answer_generation_mode || null,
                        context_injected: lastRun.parsed_response?.context_injected === true || lastRun.prompt_payload?.context_injected === true,
                        source_grounded: lastRun.parsed_response?.source_grounded === true || lastRun.prompt_payload?.source_grounded === true,
                        bias_risk: lastRun.parsed_response?.bias_risk || lastRun.prompt_payload?.bias_risk || null,
                        evidence_level: lastRun.parsed_response?.evidence_level || lastRun.prompt_payload?.evidence_level || null,
                        prompt_version: lastRun.parsed_response?.prompt_version || lastRun.prompt_payload?.prompt_version || null,
                        visibility_eligible: isVisibilityEligible(lastRun.discovery_mode || lastRun.parsed_response?.discovery_mode || resolvedDiscoveryMode),
                        measurement_outcome: lastRun.parsed_response?.measurement_outcome || null,
                        mention_counts: mentionCounts,
                        response_excerpt: responseText ? responseText.slice(0, 220) : '',
                        has_more_response: responseText.length > 220,
                    }
                    : null,
                lifecycle: {
                    latest_status: lastRun?.status || 'no_run',
                    has_run: Boolean(lastRun),
                },
                run_history: history,
            };
        })
        .sort(sortPrompts);

    const withTargetFound = prompts.filter((prompt) => prompt.last_run?.target_found === true).length;
    const withRunNoTarget = prompts.filter((prompt) => prompt.last_run && prompt.last_run.target_found === false).length;
    const noRunYet = prompts.filter((prompt) => !prompt.last_run).length;
    const weakPromptCount = prompts.filter((prompt) => prompt.quality_status === 'weak').length;
    const total = prompts.length;

    const latestStatusCounts = {
        completed: prompts.filter((prompt) => isRunSuccessStatus(prompt.last_run?.status)).length,
        failed: prompts.filter((prompt) => isRunFailureStatus(prompt.last_run?.status)).length,
        running: prompts.filter((prompt) => prompt.last_run?.status === 'running').length,
        pending: prompts.filter((prompt) => prompt.last_run?.status === 'pending').length,
        no_run: noRunYet,
    };

    const categories = getTrackedQueryCategoryOptions().map((option) => ({
        ...option,
        count: prompts.filter((prompt) => normalizeTrackedQueryCategory(prompt.category, prompt.query_text) === option.key).length,
        active_count: prompts.filter((prompt) => prompt.category === option.key && prompt.is_active).length,
    }));

    const siteType = inferSiteType(latestAudit);
    const siteTypeLabel = inferSiteTypeLabel(latestAudit);
    const siteClassification = latestAudit?.geo_breakdown?.site_classification || latestAudit?.seo_breakdown?.site_classification || {};
    const locale = 'fr-CA';
    const canonicalDetection = buildCanonicalBusinessDetection({
        clientName: client?.client_name || '',
        rawBusinessType: String(client?.business_type || '').trim(),
        siteClassification,
        servicesPreview: Array.isArray(client?.business_details?.services) ? client.business_details.services : [],
        shortDescription: getBusinessShortDescription(client?.business_details || {}).slice(0, 400),
        seoTeaser: String(client?.seo_description || '').trim().slice(0, 220),
        address: client?.address || {},
        targetRegion: client?.target_region || '',
        localSignals: latestAudit?.extracted_data?.local_signals || {},
        pageSummaries: latestAudit?.extracted_data?.page_summaries || [],
    });
    const starterPack = buildStarterPromptPack({
        client,
        siteType,
        siteClassification,
        locale,
        existingPrompts: prompts,
    });

    // --- Mode-split visibility metrics ---
    // Uses measurement_outcome taxonomy as source of truth, NOT raw target_found.
    const blindPrompts = prompts.filter((p) => p.discovery_mode === 'blind_discovery');
    const assistedPrompts = prompts.filter((p) => p.discovery_mode !== 'blind_discovery');
    const contextInjectedPrompts = prompts.filter((p) => p.context_injected === true || p.discovery_mode === 'brand_aware' || p.discovery_mode === 'controlled_context_answer');

    const blindWithRun = blindPrompts.filter((p) => p.last_run);
    const assistedWithRun = assistedPrompts.filter((p) => p.last_run);
    const modeBreakdown = getDiscoveryModeOptions().reduce((acc, mode) => {
        const modePrompts = prompts.filter((p) => p.discovery_mode === mode.key);
        const withRun = modePrompts.filter((p) => p.last_run);
        acc[mode.key] = {
            label: mode.label,
            total_prompts: modePrompts.length,
            with_run: withRun.length,
            context_injected: mode.bias_risk === 'context_injected',
            visibility_eligible: mode.visibility_eligible === true,
        };
        return acc;
    }, {});

    // Spontaneous visibility: only runs whose measurement_outcome counts_as_visibility
    const spontaneousVisibilityCount = blindWithRun.filter((p) => countsAsVisibilityOutcome(p.last_run.measurement_outcome)).length;
    const spontaneousTotal = blindWithRun.length;
    // Assisted: raw target_found (honestly labeled — not a spontaneous metric)
    const assistedTargetFound = assistedWithRun.filter((p) => p.last_run.target_found === true).length;
    const assistedTotal = assistedWithRun.length;

    const visibilityByMode = {
        blind_discovery: {
            total_prompts: blindPrompts.length,
            with_run: spontaneousTotal,
            visibility_count: spontaneousVisibilityCount,
            visibility_rate_percent: spontaneousTotal > 0 ? Math.round((spontaneousVisibilityCount / spontaneousTotal) * 100) : null,
            label: 'Visibilite spontanee',
        },
        assisted_or_named: {
            total_prompts: assistedPrompts.length,
            with_run: assistedTotal,
            assisted_mention_count: assistedTargetFound,
            assisted_mention_rate_percent: assistedTotal > 0 ? Math.round((assistedTargetFound / assistedTotal) * 100) : null,
            context_injected_prompts: contextInjectedPrompts.length,
            label: 'Runs non spontanes',
        },
        by_mode: modeBreakdown,
    };

    return {
        provenance: {
            observed: getProvenanceMeta('observed'),
            derived: getProvenanceMeta('derived'),
            inferred: getProvenanceMeta('inferred'),
        },
        categoryOptions: getTrackedQueryCategoryOptions(),
        discoveryModeOptions: getDiscoveryModeOptions(),
        siteContext: {
            siteType,
            siteTypeLabel,
            businessType: client?.business_type || null,
            primaryCity: client?.address?.city || client?.target_region || null,
            resolved_business: canonicalDetection.resolved_business,
            canonical_detection: canonicalDetection,
        },
        starterPack,
        summary: {
            total,
            active: prompts.filter((prompt) => prompt.is_active).length,
            inactive: prompts.filter((prompt) => !prompt.is_active).length,
            withTargetFound,
            withRunNoTarget,
            noRunYet,
            weakPromptCount,
            latestStatusCounts,
            mentionRatePercent: total > 0 ? Math.round((withTargetFound / total) * 100) : null,
            visibilityByMode,
        },
        categories,
        prompts,
        emptyState: {
            title: 'Aucun prompt suivi pour le moment',
            description: 'Ajoutez des prompts suivis pour alimenter les exécutions, citations et signaux concurrents.',
        },
    };
}
