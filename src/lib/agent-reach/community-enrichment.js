import 'server-only';
import { executeTask } from '@/lib/ai/tasks/registry';
import { getSocialWatchConfig } from './community-context';
import { extractMentionsFromDocuments, deriveOpportunitiesFromClusters, buildOpportunityMetadata } from './community-signals';

// Register once at import, before any collection or enrichment request.
import '@/lib/ai/tasks/community-classify';
import '@/lib/ai/tasks/community-labels';
import '@/lib/ai/tasks/community-synthesize';

const COMMUNITY_USE_LLM_ENRICHMENT = process.env.COMMUNITY_USE_LLM_ENRICHMENT === 'true';

const LLM_ENRICHMENT_BATCH_SIZE = 10;

// ──────────────────────────────────────────────────────────────
// Stage 4b — LLM-powered mention extraction (Mistral)
// Falls back to keyword extraction on failure.
// ──────────────────────────────────────────────────────────────

async function extractMentionsWithLLM(documents, clientId, client) {
    const clientName = String(client?.client_name || '').trim();
    const businessType = String(client?.business_type || '').trim();
    const mandate = getSocialWatchConfig(client);

    const allMentions = [];

    // Batch documents to stay within token limits
    for (let i = 0; i < documents.length; i += LLM_ENRICHMENT_BATCH_SIZE) {
        const batch = documents.slice(i, i + LLM_ENRICHMENT_BATCH_SIZE);
        const docSummaries = batch.map((d) => ({
            id: d.id,
            title: d.title || '',
            body: (d.body || '').slice(0, 600),
            source: d.source || 'unknown',
        }));

        const result = await executeTask('community-classify', {
            clientId,
            clientName,
            businessType,
            competitors: mandate.known_competitors,
            documents: docSummaries,
            // Mandate context for richer classification
            mandateContext: {
                goals: mandate.goals,
                monitored_topics: mandate.monitored_topics,
                target_customer_description: mandate.target_customer_description,
                seo_description: String(client?.seo_description || '').trim(),
            },
        }, { clientId, triggerSource: 'pipeline' });

        if (result.data) {
            allMentions.push(...result.data);
        }
    }

    return allMentions;
}

export async function enrichCommunityDocuments(unprocessed, clientId, client, relevanceAnchors) {
    let mentions;
    let enrichmentMethod = 'keyword';

    // LLM enrichment with validation safeguards
    if (COMMUNITY_USE_LLM_ENRICHMENT && unprocessed.length > 0) {
        const docCount = unprocessed.length;
        const estimatedBatches = Math.ceil(docCount / LLM_ENRICHMENT_BATCH_SIZE);
        console.warn(`[Community] LLM enrichment enabled — processing ${docCount} docs in ${estimatedBatches} batches for client ${clientId}`);

        try {
            const llmStart = Date.now();
            mentions = await extractMentionsWithLLM(unprocessed, clientId, client);
            const llmDuration = Date.now() - llmStart;

            // Validation: check that LLM produced reasonable output
            if (mentions.length === 0 && docCount > 0) {
                console.warn(`[Community] LLM enrichment returned 0 mentions for ${docCount} docs — falling back to keyword`);
                mentions = extractMentionsFromDocuments(unprocessed, clientId, relevanceAnchors);
            } else {
                enrichmentMethod = 'llm';
                console.warn(`[Community] LLM enrichment completed: ${mentions.length} mentions in ${llmDuration}ms`);
            }
        } catch (llmErr) {
            console.warn('[Community] LLM enrichment failed, falling back to keyword extraction:', llmErr?.message);
            mentions = extractMentionsFromDocuments(unprocessed, clientId, relevanceAnchors);
        }
    } else {
        mentions = extractMentionsFromDocuments(unprocessed, clientId, relevanceAnchors);
    }
    return { mentions, enrichmentMethod };
}

export async function normalizeCommunityClusterLabels(persistedClusters, clientId) {
    // Stage 5.5: Optional — normalize cluster labels via LLM
    if (COMMUNITY_USE_LLM_ENRICHMENT && persistedClusters.length > 0) {
        try {
            const labelResult = await executeTask('community-labels', {
                clusters: persistedClusters.map((c) => ({
                    label: c.label,
                    cluster_type: c.cluster_type,
                    mention_count: c.mention_count,
                })),
            }, { clientId, triggerSource: 'pipeline' });

            if (labelResult.data && Array.isArray(labelResult.data)) {
                const labelMap = new Map(labelResult.data.map((l) => [l.original, l]));
                for (const cluster of persistedClusters) {
                    const normalized = labelMap.get(cluster.label);
                    if (normalized && normalized.normalized && !normalized.is_duplicate_of) {
                        cluster.label = normalized.normalized;
                    }
                }
            }
        } catch (labelErr) {
            console.warn('[Community] Cluster label normalization failed (non-blocking):', labelErr?.message);
        }
    }
}

export async function synthesizeCommunityOpportunities(persistedClusters, clientId, client, relevanceAnchors, scoringContext) {
    const { mandate, businessDesc, city: clientCity } = scoringContext;
    // Stage 6: Derive opportunities
    let opportunities;

    if (COMMUNITY_USE_LLM_ENRICHMENT && persistedClusters.length > 0) {
        try {
            const synthResult = await executeTask('community-synthesize', {
                clientId,
                clientName: client?.client_name || '',
                businessType: client?.business_type || '',
                mandateContext: {
                    goals: mandate.goals,
                    monitored_topics: mandate.monitored_topics,
                    target_customer_description: mandate.target_customer_description,
                    businessDesc,
                    city: clientCity,
                },
                clusters: persistedClusters.map((c) => ({
                    label: c.label,
                    cluster_type: c.cluster_type,
                    mention_count: c.mention_count,
                    sources: c.sources || [],
                    signal_families: c.metadata?.signal_families || [],
                })),
            }, { clientId, triggerSource: 'pipeline' });

            if (synthResult.data && Array.isArray(synthResult.data)) {
                opportunities = synthResult.data
                    .filter((opp) => {
                        // Quality gate: reject weak-evidence opportunities from LLM
                        const headline = String(opp.headline || '').trim();
                        return headline.length >= 5;
                    })
                    .map((opp) => {
                        const matchedCluster = persistedClusters.find((c) => c.label === opp.cluster_label);
                        return {
                            client_id: clientId,
                            opportunity_type: opp.opportunity_type,
                            title: opp.headline,
                            rationale: opp.rationale,
                            evidence_level: opp.evidence_strength === 'strong' ? 'strong' : opp.evidence_strength === 'moderate' ? 'medium' : 'low',
                            mention_count: matchedCluster?.mention_count || 0,
                            provenance: 'inferred',
                            source_cluster_id: matchedCluster?.id || null,
                            status: 'open',
                            metadata: {
                                ...buildOpportunityMetadata(
                                    matchedCluster,
                                    opp.why_it_matters || opp.rationale || null,
                                    opp.suggested_action || null,
                                    matchedCluster?.metadata?.signal_families?.[0],
                                ),
                                synthesis_source: 'llm',
                            },
                        };
                    });
            } else {
                opportunities = deriveOpportunitiesFromClusters(persistedClusters, clientId, relevanceAnchors);
            }
        } catch (synthErr) {
            console.warn('[Community] Opportunity synthesis failed, falling back to rule-based:', synthErr?.message);
            opportunities = deriveOpportunitiesFromClusters(persistedClusters, clientId, relevanceAnchors);
        }
    } else {
        opportunities = deriveOpportunitiesFromClusters(persistedClusters, clientId, relevanceAnchors);
    }
    return opportunities;
}
