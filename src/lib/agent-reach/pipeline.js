import 'server-only';
import { getClientById as dbGetClientById } from '@/lib/db/clients';
import { insertCollectionRun, updateCollectionRun, upsertDocuments, listDocuments, deleteMentionsForDocuments, insertMentions, markDocumentsProcessed, clearClusters, upsertClusters } from '@/lib/db/community';
import { getSocialWatchConfig, buildSeedQueries, buildRelevanceAnchors } from './community-context';
import { collectCommunityPosts, buildCollectionDiagnosis } from './community-collection';
import { isWebSearchAvailable } from './web-search-collector';
import { toDocumentRows, aggregateMentionsToClusters } from './community-signals';
import { enrichCommunityDocuments, normalizeCommunityClusterLabels, synthesizeCommunityOpportunities } from './community-enrichment';
import { listMentionsForClustering, persistCommunityOpportunities } from './community-persistence';

// ──────────────────────────────────────────────────────────────
// Main pipeline orchestrator
// ──────────────────────────────────────────────────────────────

export async function runCommunityPipeline(clientId, { triggerSource = 'system' } = {}) {
    const client = await dbGetClientById(clientId).catch(() => null);
    if (!client) {
        return { success: false, error: 'Client introuvable', summary: {} };
    }

    const mandate = getSocialWatchConfig(client);
    const seedQueries = buildSeedQueries(client);

    // Serialize seeds for the collection run record (store query + strategy)
    const seedQueriesForRecord = seedQueries.map((s) =>
        typeof s === 'string' ? s : `[${s.strategy}] ${s.query}`
    );

    // Create collection run record
    const run = await insertCollectionRun({
        client_id: clientId,
        source: 'reddit',
        status: 'running',
        started_at: new Date().toISOString(),
        seed_queries: seedQueriesForRecord,
        trigger_source: triggerSource,
    });

    try {
        // Stage 2: collect with source diagnostics and web-search fallback.
        const { rawPosts, seedDiagnostics, collectionSource, webSearchProvider, collectionOutcome } =
            await collectCommunityPosts(seedQueries, mandate.subreddit_targets);

        // If collection completely failed (both Reddit and web-search), short-circuit
        // with an accurate diagnosis instead of proceeding with empty data.
        if (collectionOutcome.isAccessFailure && rawPosts.length === 0) {
            const diagnosis = buildCollectionDiagnosis(collectionOutcome.failureClass, collectionOutcome.summary);
            const webSearchStatus = isWebSearchAvailable()
                ? 'Web search fallback was attempted but returned no results.'
                : 'No web search fallback available (configure TAVILY_API_KEY or GOOGLE_SEARCH_API_KEY).';
            console.warn(`[Community] Collection blocked: ${collectionOutcome.failureClass} — ${collectionOutcome.summary.error}/${collectionOutcome.summary.total} seeds failed. ${webSearchStatus}`);

            await updateCollectionRun(run.id, {
                status: 'partial',
                finished_at: new Date().toISOString(),
                documents_collected: 0,
                documents_persisted: 0,
                documents_skipped: 0,
                error_message: `${diagnosis.description} ${webSearchStatus}`,
                run_context: {
                    seed_diagnostics: seedDiagnostics,
                    failure_class: collectionOutcome.failureClass,
                    collection_diagnosis: diagnosis,
                    is_access_failure: true,
                    collection_source: collectionSource,
                    web_search_available: isWebSearchAvailable(),
                    web_search_provider: webSearchProvider,
                    seed_strategies_used: [...new Set(seedQueries.map((s) => typeof s === 'string' ? 'legacy' : s.strategy))],
                    mandate_configured: mandate.goals.length > 0 || mandate.known_competitors.length > 0,
                },
            });

            return {
                success: false,
                error: `${diagnosis.description} ${webSearchStatus}`,
                summary: {
                    documents_collected: 0,
                    documents_persisted: 0,
                    documents_skipped: 0,
                    mentions_extracted: 0,
                    clusters_built: 0,
                    opportunities_derived: 0,
                    seed_diagnostics: seedDiagnostics,
                    failure_class: collectionOutcome.failureClass,
                    collection_diagnosis: diagnosis,
                    is_access_failure: true,
                    collection_source: collectionSource,
                    web_search_available: isWebSearchAvailable(),
                },
            };
        }

        // Stage 3: Normalize & persist
        // For web search results, each post has _source_platform (reddit, quora, web, etc.)
        // which takes precedence. The sourceLabel is only the fallback for untagged posts.
        const documentRows = toDocumentRows(rawPosts, clientId, run.id, { sourceLabel: collectionSource === 'web_search' ? 'web_search' : 'reddit' });
        const { persisted, skipped } = await upsertDocuments(documentRows);

        await updateCollectionRun(run.id, {
            documents_collected: rawPosts.length,
            documents_persisted: persisted,
            documents_skipped: skipped,
            ...(collectionSource !== 'reddit' ? { source: collectionSource } : {}),
        });

        // Build relevance anchors from client context
        const relevanceAnchors = buildRelevanceAnchors(client);

        // Stage 4: Enrich — extract mentions from unprocessed documents
        // Intentionally omits the source filter to process documents from both reddit
        // and web_search sources. The mention extraction and clustering logic is
        // source-agnostic — it operates on title/body text regardless of origin.
        const unprocessed = await listDocuments(clientId, { unprocessedOnly: true });
        const { mentions, enrichmentMethod } =
            await enrichCommunityDocuments(unprocessed, clientId, client, relevanceAnchors);

        if (mentions.length > 0) {
            // Clear old mentions for these documents before re-inserting
            const docIds = unprocessed.map((d) => d.id);
            await deleteMentionsForDocuments(docIds);
            await insertMentions(mentions);
            await markDocumentsProcessed(docIds);
        }

        // Stage 5: Cluster — rebuild clusters from all mentions
        const allMentions = await listMentionsForClustering(clientId);
        await clearClusters(clientId);

        // Build scoring context for composite score v2
        const clientCity = String(client?.address?.city || client?.target_region || '').trim();
        const businessDesc = String(client?.business_type || '').trim();
        const scoringContext = {
            anchors: relevanceAnchors,
            mandate,
            businessDesc,
            city: clientCity,
        };

        const clusters = aggregateMentionsToClusters(allMentions, clientId, relevanceAnchors, scoringContext);
        const persistedClusters = clusters.length > 0 ? await upsertClusters(clusters) : [];

        await normalizeCommunityClusterLabels(persistedClusters, clientId);

        // Stage 6: derive opportunities, preserving the rule-based fallback.
        const opportunities = await synthesizeCommunityOpportunities(
            persistedClusters, clientId, client, relevanceAnchors, scoringContext,
        );

        await persistCommunityOpportunities(opportunities, clientId);

        // Finalize run — include collection outcome classification
        const finalOutcome = collectionOutcome.failureClass
            ? { failure_class: collectionOutcome.failureClass, collection_diagnosis: buildCollectionDiagnosis(collectionOutcome.failureClass, collectionOutcome.summary) }
            : {};
        await updateCollectionRun(run.id, {
            status: 'completed',
            finished_at: new Date().toISOString(),
            run_context: {
                mentions_extracted: mentions.length,
                clusters_built: persistedClusters.length,
                opportunities_derived: opportunities.length,
                enrichment_method: enrichmentMethod,
                collection_source: collectionSource,
                web_search_provider: webSearchProvider,
                seed_diagnostics: seedDiagnostics,
                mandate_configured: mandate.goals.length > 0 || mandate.known_competitors.length > 0,
                seed_strategies_used: [...new Set(seedQueries.map((s) => typeof s === 'string' ? 'legacy' : s.strategy))],
                ...finalOutcome,
            },
        });

        return {
            success: true,
            error: null,
            summary: {
                documents_collected: rawPosts.length,
                documents_persisted: persisted,
                documents_skipped: skipped,
                mentions_extracted: mentions.length,
                clusters_built: persistedClusters.length,
                opportunities_derived: opportunities.length,
                seed_diagnostics: seedDiagnostics,
                failure_class: collectionOutcome.failureClass || null,
                collection_source: collectionSource,
                web_search_provider: webSearchProvider,
            },
        };
    } catch (err) {
        await updateCollectionRun(run.id, {
            status: 'failed',
            finished_at: new Date().toISOString(),
            error_message: err?.message || 'Pipeline execution failed',
        }).catch(() => {});

        return {
            success: false,
            error: err?.message || 'Pipeline execution failed',
            summary: {},
        };
    }
}
