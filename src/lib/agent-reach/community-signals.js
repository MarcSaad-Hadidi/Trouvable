import 'server-only';
import crypto from 'crypto';
import {
    evidenceLevel,
    SIGNAL_FAMILIES,
    computeCompositeScore,
    MIN_KEYWORD_MATCHES_FOR_SIGNAL,
    STRONG_COMPLAINT_TERMS,
    WEAK_COMPLAINT_TERMS,
    matchesKeyword,
    isNegated,
} from './contracts';
import {
    normalizeText,
    tokenize,
    extractBigrams,
    scoreThemeRelevance,
    THEME_RELEVANCE_THRESHOLD,
} from './community-context';

// ──────────────────────────────────────────────────────────────
// Text analysis constants (from social.js — canonical copies)
// Note: COMPLAINT_TERMS replaced by STRONG_COMPLAINT_TERMS and
// WEAK_COMPLAINT_TERMS in contracts.js for better precision.
// ──────────────────────────────────────────────────────────────

const QUESTION_HINTS = ['how', 'what', 'why', 'which', 'where', 'best', 'combien', 'comment', 'pourquoi', 'quel'];

const COMPETITOR_HINTS = ['vs', 'versus', 'alternative', 'alternatives', 'instead of', 'comparer', 'compare'];

function dedupeHash(source, externalId, title) {
    const raw = `${source}:${externalId || ''}:${(title || '').trim().toLowerCase().slice(0, 120)}`;
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 40);
}

// ──────────────────────────────────────────────────────────────
// Stage 3 — Normalize & persist documents
// ──────────────────────────────────────────────────────────────

export function toDocumentRows(rawPosts, clientId, collectionRunId, { sourceLabel = 'reddit' } = {}) {
    return rawPosts.map((post) => {
        const source = post._source_platform || sourceLabel;
        const externalId = post.id || null;
        return {
            client_id: clientId,
            collection_run_id: collectionRunId,
            source,
            external_id: externalId,
            url: post.permalink || null,
            title: post.title,
            body: post.body || null,
            author: null,
            published_at: post.created_at || null,
            source_metadata: {
                subreddit: post.subreddit || null,
                ups: post.ups || 0,
                ...(post._search_score !== undefined && post._search_score !== null
                    ? { search_score: post._search_score }
                    : {}),
            },
            normalized_content: normalizeText(`${post.title} ${post.body}`),
            language: 'fr',
            engagement_score: Math.min(post.ups || 0, 9999),
            seed_query: post.seed_query || null,
            dedupe_hash: dedupeHash(source, externalId || post.permalink, post.title),
            is_processed: false,
        };
    });
}

// ──────────────────────────────────────────────────────────────
// Signal family detection — tag mentions with operator-actionable families
// ──────────────────────────────────────────────────────────────

export function detectSignalFamilies(mentionType, label, snippet) {
    const families = [];
    const combined = `${label || ''} ${snippet || ''}`.toLowerCase();

    for (const [familyId, family] of Object.entries(SIGNAL_FAMILIES)) {
        // Check if mention type matches this family
        if (!family.mention_types.includes(mentionType)) continue;
        // Count keyword matches using word-boundary-aware matching
        let keywordMatches = 0;
        for (const kw of family.keywords) {
            if (matchesKeyword(combined, kw) && !isNegated(combined, kw)) {
                keywordMatches++;
            }
        }
        // Require minimum keyword count to reduce false positives
        if (keywordMatches >= MIN_KEYWORD_MATCHES_FOR_SIGNAL) {
            families.push(familyId);
        }
    }

    return families;
}

// ──────────────────────────────────────────────────────────────
// Stage 4 — Enrich: extract mentions from unprocessed documents
// ──────────────────────────────────────────────────────────────

export function extractMentionsFromDocuments(documents, clientId, relevanceAnchors = new Set()) {
    const mentions = [];

    for (const doc of documents) {
        const merged = `${doc.title || ''} ${doc.body || ''}`;
        const mergedLower = merged.toLowerCase();
        const titleLower = (doc.title || '').toLowerCase();

        // Question signals — require actual question structure, not just hint words
        const hasQuestionMark = (doc.title || '').includes('?');
        const hasQuestionPhrase = QUESTION_HINTS.some((h) => {
            // Require hint at start of title or after common separators for stronger signal
            const idx = titleLower.indexOf(`${h} `);
            return idx >= 0 && (idx === 0 || titleLower[idx - 1] === ' ' || titleLower[idx - 1] === ',');
        });
        const looksLikeQuestion = hasQuestionMark || (hasQuestionPhrase && titleLower.length < 200);
        if (looksLikeQuestion) {
            const questionLabel = (doc.title || '').replace(/\?+$/, '?');
            const questionSnippet = merged.slice(0, 300);
            mentions.push({
                client_id: clientId,
                document_id: doc.id,
                mention_type: 'question',
                label: questionLabel,
                snippet: questionSnippet,
                evidence_level: 'low',
                provenance: 'observed',
                source: doc.source,
                signal_families: detectSignalFamilies('question', questionLabel, questionSnippet),
            });
        }

        // Complaint signals — require stronger evidence to reduce false positives
        // Strong term: 1 match is sufficient (frustrating, terrible, scam, etc.)
        // Weak term: require ≥2 matches or co-occurrence with a strong term
        const strongMatches = STRONG_COMPLAINT_TERMS.filter(
            (term) => mergedLower.includes(term) && !isNegated(mergedLower, term),
        );
        const weakMatches = WEAK_COMPLAINT_TERMS.filter(
            (term) => matchesKeyword(mergedLower, term) && !isNegated(mergedLower, term),
        );
        const hasStrongComplaint = strongMatches.length >= 1;
        const hasWeakComplaint = weakMatches.length >= 2;
        const hasComplaint = hasStrongComplaint || hasWeakComplaint;

        if (hasComplaint) {
            const complaintLabel = doc.title || mergedLower.slice(0, 120);
            const complaintSnippet = merged.slice(0, 300);
            const evidenceFromComplaint = hasStrongComplaint ? 'medium' : 'low';
            mentions.push({
                client_id: clientId,
                document_id: doc.id,
                mention_type: 'complaint',
                label: complaintLabel,
                snippet: complaintSnippet,
                evidence_level: evidenceFromComplaint,
                provenance: 'observed',
                source: doc.source,
                signal_families: detectSignalFamilies('complaint', complaintLabel, complaintSnippet),
            });
        }

        // Competitor signals — require comparison hint AND complaint evidence
        const hasCompetitor = COMPETITOR_HINTS.some((h) => matchesKeyword(mergedLower, h));
        if (hasCompetitor && hasComplaint) {
            const compLabel = doc.title || '';
            const compSnippet = merged.slice(0, 300);
            mentions.push({
                client_id: clientId,
                document_id: doc.id,
                mention_type: 'competitor',
                label: compLabel,
                snippet: compSnippet,
                evidence_level: 'low',
                provenance: 'observed',
                source: doc.source,
                signal_families: detectSignalFamilies('competitor', compLabel, compSnippet),
            });
        }

        // Preserve token order, then phrase order, with one relevance gate.
        const tokens = tokenize(merged);
        for (const label of [...tokens, ...extractBigrams(tokens)]) {
            if (scoreThemeRelevance(label, relevanceAnchors) >= THEME_RELEVANCE_THRESHOLD) {
                mentions.push({
                    client_id: clientId,
                    document_id: doc.id,
                    mention_type: 'theme',
                    label,
                    snippet: null,
                    evidence_level: 'low',
                    provenance: 'derived',
                    source: doc.source,
                    signal_families: detectSignalFamilies('theme', label, mergedLower),
                });
            }
        }

        // Language signals — high-engagement titles
        const engagement = doc.engagement_score || 0;
        if ((doc.title || '').length >= 12 && engagement >= 5) {
            mentions.push({
                client_id: clientId,
                document_id: doc.id,
                mention_type: 'language',
                label: doc.title,
                snippet: merged.slice(0, 300),
                evidence_level: 'low',
                provenance: 'observed',
                source: doc.source,
                signal_families: [],
            });
        }
    }

    return mentions;
}

// ──────────────────────────────────────────────────────────────
// Stage 5 — Cluster: aggregate mentions into clusters
// ──────────────────────────────────────────────────────────────

export function aggregateMentionsToClusters(mentions, clientId, relevanceAnchors = new Set(), scoringContext = {}) {
    const TYPE_TO_CLUSTER = {
        complaint: 'complaint',
        question: 'question',
        theme: 'theme',
        competitor: 'competitor_complaint',
        language: 'language',
    };

    const buckets = new Map();

    for (const mention of mentions) {
        const clusterType = TYPE_TO_CLUSTER[mention.mention_type];
        if (!clusterType) continue;
        const key = `${clusterType}::${mention.label}`;
        if (!buckets.has(key)) {
            buckets.set(key, {
                client_id: clientId,
                cluster_type: clusterType,
                label: mention.label,
                mention_count: 0,
                sources: new Set(),
                example_url: null,
                example_snippet: null,
                last_seen_at: null,
                metadata: {},
                _signal_families: new Set(),
            });
        }
        const bucket = buckets.get(key);
        bucket.mention_count += 1;
        if (mention.source) bucket.sources.add(mention.source);
        if (!bucket.example_snippet && mention.snippet) bucket.example_snippet = mention.snippet;
        // Aggregate signal families from mentions
        if (Array.isArray(mention.signal_families)) {
            for (const fam of mention.signal_families) bucket._signal_families.add(fam);
        }
    }

    // Also build source_bucket clusters from document metadata
    const sourceCounts = new Map();
    for (const mention of mentions) {
        const src = mention.source || 'unknown';
        sourceCounts.set(src, (sourceCounts.get(src) || 0) + 1);
    }
    for (const [source, count] of sourceCounts) {
        const key = `source_bucket::${source}`;
        buckets.set(key, {
            client_id: clientId,
            cluster_type: 'source_bucket',
            label: source,
            mention_count: count,
            sources: new Set([source]),
            example_url: null,
            example_snippet: null,
            last_seen_at: null,
            metadata: {},
            _signal_families: new Set(),
        });
    }

    return [...buckets.values()]
        .filter((c) => {
            if (c.cluster_type === 'source_bucket') return true;
            if (c.mention_count < 2) return false;

            // Theme clusters must pass a relevance gate
            if (c.cluster_type === 'theme') {
                const relevance = scoreThemeRelevance(c.label, relevanceAnchors);
                if (relevance < THEME_RELEVANCE_THRESHOLD) return false;
            }

            return true;
        })
        .map((c) => {
            // Compute composite score v2 when scoring context is available
            const hasContext = scoringContext.anchors || scoringContext.city;
            let score;
            let scoreDimensions = null;

            if (hasContext && c.cluster_type !== 'source_bucket') {
                const composite = computeCompositeScore(c, scoringContext);
                score = composite.score;
                scoreDimensions = composite.dimensions;
            } else {
                // Fallback: relevance-weighted score for theme clusters, raw count for others
                score = c.mention_count;
                if (c.cluster_type === 'theme') {
                    const relevance = scoreThemeRelevance(c.label, relevanceAnchors);
                    score = c.mention_count * (1 + relevance);
                }
            }

            const signalFamilies = [...c._signal_families];
            const metadata = { ...c.metadata };
            if (signalFamilies.length > 0) metadata.signal_families = signalFamilies;
            if (scoreDimensions) metadata.score_dimensions = scoreDimensions;

            return {
                client_id: c.client_id,
                cluster_type: c.cluster_type,
                label: c.label,
                mention_count: c.mention_count,
                example_url: c.example_url,
                example_snippet: c.example_snippet,
                sources: [...c.sources],
                evidence_level: evidenceLevel(c.mention_count),
                score: Math.round(score * 100) / 100,
                last_seen_at: new Date().toISOString(),
                metadata,
            };
        });
}

// ──────────────────────────────────────────────────────────────
// Stage 6 — Derive opportunities from clusters
// ──────────────────────────────────────────────────────────────

export function buildOpportunityMetadata(cluster, whyItMatters, suggestedAction, signalFamily) {
    return {
        why_it_matters: whyItMatters,
        suggested_action: suggestedAction,
        source_url: cluster?.example_url || null,
        signal_family: signalFamily || null,
        composite_score: cluster?.score || 0,
        score_dimensions: cluster?.metadata?.score_dimensions || null,
        signal_families: cluster?.metadata?.signal_families || [],
    };
}

export function deriveOpportunitiesFromClusters(clusters, clientId, relevanceAnchors = new Set()) {
    const opportunities = [];

    // The same persisted envelope applies to every rule-derived opportunity.
    function buildOpportunity(cluster, fields) {
        return {
            client_id: clientId,
            ...fields,
            evidence_level: cluster.evidence_level,
            mention_count: cluster.mention_count,
            provenance: 'inferred',
            source_cluster_id: cluster.id || null,
            status: 'open',
        };
    }

    // ── Recurring buyer questions → response_opportunity + faq ──
    const questions = clusters.filter((c) => c.cluster_type === 'question').slice(0, 6);
    for (const q of questions) {
        const families = q.metadata?.signal_families || [];
        const hasBuyerIntent = families.includes('buyer_question') || families.includes('best_tool_intent');
        const hasResponseOpp = families.includes('response_opportunity');

        // Always produce FAQ opportunity (backward compatible)
        opportunities.push(
            buildOpportunity(q, {
                opportunity_type: hasBuyerIntent ? 'recurring_buyer_question' : 'faq',
                title: hasBuyerIntent ? `Question acheteur récurrente: ${q.label}` : `FAQ: ${q.label}`,
                rationale: hasBuyerIntent
                    ? "Question récurrente de prospects avec intention d'achat ou de comparaison."
                    : 'Inféré des questions communautaires récurrentes observées.',
                metadata: buildOpportunityMetadata(
                    q,
                    hasBuyerIntent
                        ? 'Ces questions viennent de prospects en phase de décision, et y répondre positionne votre expertise.'
                        : 'Ces questions reviennent régulièrement, et une page FAQ dédiée capterait ce trafic.',
                    hasBuyerIntent
                        ? 'Répondez directement dans le fil ou créez du contenu ciblé pour cette question.'
                        : 'Créez une page FAQ ou un article de blog répondant précisément à cette question.',
                    hasBuyerIntent ? 'buyer_question' : null,
                ),
            }),
        );

        // If response opportunity signal detected, also produce a response_opportunity
        if (hasResponseOpp) {
            opportunities.push(
                buildOpportunity(q, {
                    opportunity_type: 'response_opportunity',
                    title: `Répondre au fil: ${q.label}`,
                    rationale: 'Fil actif où une réponse experte ajouterait de la valeur et de la visibilité.',
                    metadata: buildOpportunityMetadata(
                        q,
                        'Ce fil est actif et recherche une expertise, et y répondre construit votre autorité.',
                        'Rédigez une réponse experte et utile dans le fil. Ne faites pas de promotion directe.',
                        'response_opportunity',
                    ),
                }),
            );
        }
    }

    // ── Comparison discussions → comparison_discussion ──
    const comparisonClusters = clusters
        .filter((c) => (c.metadata?.signal_families || []).includes('comparison_intent'))
        .slice(0, 4);
    for (const comp of comparisonClusters) {
        opportunities.push(
            buildOpportunity(comp, {
                opportunity_type: 'comparison_discussion',
                title: `Discussion comparative: ${comp.label}`,
                rationale: 'Utilisateurs comparant des solutions, opportunité de positionnement.',
                metadata: buildOpportunityMetadata(
                    comp,
                    "Les utilisateurs comparent activement des solutions dans cette discussion. C'est le moment idéal pour se positionner.",
                    'Créez du contenu de comparaison honnête ou répondez avec des faits différenciants.',
                    'comparison_intent',
                ),
            }),
        );
    }

    // ── Content opportunities from relevant themes ──
    const themes = clusters
        .filter((c) => c.cluster_type === 'theme')
        .filter((c) => scoreThemeRelevance(c.label, relevanceAnchors) >= THEME_RELEVANCE_THRESHOLD)
        .slice(0, 4);
    for (const theme of themes) {
        const hasAi = (theme.metadata?.signal_families || []).includes('ai_mention_opportunity');
        const oppType = hasAi ? 'ai_mention_opportunity' : 'content_opportunity';
        opportunities.push(
            buildOpportunity(theme, {
                opportunity_type: oppType,
                title: hasAi ? `Opportunité citation IA: ${theme.label}` : `Angle contenu: ${theme.label}`,
                rationale: hasAi
                    ? "Discussion liée à l'IA où votre marque pourrait être citée par les assistants IA."
                    : 'Inféré des thèmes de discussion externe récurrents.',
                metadata: buildOpportunityMetadata(
                    theme,
                    hasAi
                        ? 'Les assistants IA citent du contenu bien structuré sur ce sujet, optimisez-le pour être référencé.'
                        : 'Ce thème revient fréquemment dans les discussions, et du contenu ciblé capterait ce trafic.',
                    hasAi
                        ? 'Créez du contenu structuré (FAQ, guide) optimisé pour la citation par les AI Overviews.'
                        : "Créez un article ou une page dédiée à ce sujet pour capter l'intérêt communautaire.",
                    hasAi ? 'ai_mention_opportunity' : null,
                ),
            }),
        );
    }

    // ── Recurring pain points from complaints ──
    const complaints = clusters.filter((c) => c.cluster_type === 'complaint').slice(0, 4);
    for (const complaint of complaints) {
        const hasPainPoint = (complaint.metadata?.signal_families || []).includes('pain_point');
        opportunities.push(
            buildOpportunity(complaint, {
                opportunity_type: hasPainPoint ? 'recurring_pain_point' : 'content',
                title: hasPainPoint
                    ? `Point de douleur récurrent: ${complaint.label}`
                    : `Traiter la préoccupation: ${complaint.label}`,
                rationale: hasPainPoint
                    ? 'Frustration récurrente détectée, et adresser ce point crée un avantage compétitif.'
                    : 'Inféré du langage de plainte récurrent observé dans les discussions.',
                metadata: buildOpportunityMetadata(
                    complaint,
                    hasPainPoint
                        ? 'Les utilisateurs expriment une frustration forte et répétée sur ce sujet, et y répondre vous différencie.'
                        : 'Cette préoccupation revient dans les discussions, et du contenu rassurant réduirait les frictions.',
                    hasPainPoint
                        ? 'Montrez comment votre solution résout ce problème spécifique. Utilisez des témoignages si possible.'
                        : 'Créez du contenu adressant cette préoccupation et proposant votre approche.',
                    hasPainPoint ? 'pain_point' : null,
                ),
            }),
        );
    }

    // ── Differentiation from competitor complaints ──
    const competitorComplaints = clusters.filter((c) => c.cluster_type === 'competitor_complaint').slice(0, 4);
    for (const cc of competitorComplaints) {
        const hasWeakness = (cc.metadata?.signal_families || []).includes('competitor_weakness');
        opportunities.push(
            buildOpportunity(cc, {
                opportunity_type: 'differentiation',
                title: hasWeakness
                    ? `Faiblesse concurrentielle exploitable: ${cc.label}`
                    : `Angle de différenciation: résoudre "${cc.label}"`,
                rationale: hasWeakness
                    ? "Les utilisateurs se plaignent d'un concurrent sur ce point, ce qui crée une opportunité de différenciation directe."
                    : "Inféré des patterns de plaintes où l'opérateur peut mieux se différencier.",
                metadata: buildOpportunityMetadata(
                    cc,
                    hasWeakness
                        ? 'Les utilisateurs quittent un concurrent à cause de ce problème, positionnez-vous comme la meilleure alternative.'
                        : 'Ce pattern de plainte récurrent est une opportunité de différenciation.',
                    hasWeakness
                        ? 'Créez du contenu de comparaison ciblé et des pages de migration/switching.'
                        : 'Mettez en avant votre avantage sur ce point dans vos pages clés.',
                    hasWeakness ? 'competitor_weakness' : null,
                ),
            }),
        );
    }

    return opportunities;
}
