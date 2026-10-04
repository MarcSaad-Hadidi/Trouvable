import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/clients', () => ({}));
vi.mock('@/lib/db/opportunities', () => ({}));
vi.mock('@/lib/db/community', () => ({}));

import {
    buildSeedQueries,
    buildRelevanceAnchors,
    scoreThemeRelevance,
    THEME_RELEVANCE_THRESHOLD,
    getSocialWatchConfig,
} from '@/lib/agent-reach/community-context';
import {
    extractMentionsFromDocuments,
    aggregateMentionsToClusters,
    deriveOpportunitiesFromClusters,
    detectSignalFamilies,
} from '@/lib/agent-reach/community-signals';
import {
    classifyCollectionOutcome,
    buildCollectionDiagnosis,
    COLLECTION_FAILURE_CLASS,
} from '@/lib/agent-reach/community-collection';

import { computeCompositeScore } from '@/lib/agent-reach/contracts';

// ──────────────────────────────────────────────────────────────
// Fixtures for the actual exported community transformations.

const TROUVABLE_CLIENT = {
    client_name: 'Trouvable',
    business_type: 'agence SEO GEO visibilité IA',
    address: { city: 'Montréal' },
    target_region: 'Québec',
};

const BAKERY_CLIENT = {
    client_name: 'Boulangerie Artisan',
    business_type: 'boulangerie pâtisserie',
    address: { city: 'Lyon' },
};

const SPARSE_CLIENT = {
    client_name: 'AcmeCorp',
    business_type: '',
    address: {},
};

// ──────────────────────────────────────────────────────────────
// buildSeedQueries
// ──────────────────────────────────────────────────────────────

describe('buildSeedQueries', () => {
    it('generates seeds from client context', () => {
        const seeds = buildSeedQueries(TROUVABLE_CLIENT);
        expect(seeds.length).toBeGreaterThan(0);
        expect(seeds.length).toBeLessThanOrEqual(10);
        // Should include client name + city (seeds are now objects with .query)
        expect(seeds.some((s) => s.query.includes('Trouvable') || s.query.includes('trouvable'))).toBe(true);
    });

    it('handles missing client fields gracefully', () => {
        const seeds = buildSeedQueries({ client_name: 'Test' });
        expect(seeds.length).toBeGreaterThan(0);
    });

    it('uses resolved business context for richer seeds when raw type is weak', () => {
        const weakClient = { client_name: 'Trouvable', business_type: '', address: { city: 'Montréal' } };
        const seeds = buildSeedQueries(weakClient);
        expect(seeds.length).toBeGreaterThan(0);
        // Should still produce seeds with the client name even if business_type is empty
        expect(seeds.some((s) => s.query.includes('Trouvable'))).toBe(true);
    });

    it('includes review/avis seed for client', () => {
        const seeds = buildSeedQueries(TROUVABLE_CLIENT);
        expect(seeds.some((s) => s.query.includes('avis'))).toBe(true);
    });

    it('does not produce empty-string seeds', () => {
        const seeds = buildSeedQueries({ client_name: '', business_type: '', address: {} });
        seeds.forEach((s) => {
            expect(s.query.trim().length).toBeGreaterThan(0);
        });
    });
});

// ──────────────────────────────────────────────────────────────
// getSocialWatchConfig
// ──────────────────────────────────────────────────────────────

describe('getSocialWatchConfig', () => {
    it('returns safe defaults for empty client', () => {
        const config = getSocialWatchConfig({});
        expect(config.goals).toEqual([]);
        expect(config.known_competitors).toEqual([]);
        expect(config.monitored_topics).toEqual([]);
        expect(config.target_customer_description).toBe('');
        expect(config.language_priority).toBe('fr');
        expect(config.subreddit_targets).toEqual([]);
    });

    it('returns safe defaults for null', () => {
        const config = getSocialWatchConfig(null);
        expect(config.goals).toEqual([]);
        expect(config.language_priority).toBe('fr');
    });

    it('extracts structured config from social_watch_config', () => {
        const client = {
            social_watch_config: {
                goals: ['growth', 'reputation'],
                known_competitors: ['CompA', 'CompB'],
                monitored_topics: ['pricing', 'ai seo'],
                target_customer_description: 'PME locales au Québec',
                language_priority: 'fr-CA',
                subreddit_targets: ['r/SEO', 'r/Montreal'],
            },
        };
        const config = getSocialWatchConfig(client);
        expect(config.goals).toEqual(['growth', 'reputation']);
        expect(config.known_competitors).toEqual(['CompA', 'CompB']);
        expect(config.monitored_topics).toEqual(['pricing', 'ai seo']);
        expect(config.target_customer_description).toBe('PME locales au Québec');
        expect(config.language_priority).toBe('fr-CA');
        expect(config.subreddit_targets).toEqual(['r/SEO', 'r/Montreal']);
    });

    it('filters out falsy values from arrays', () => {
        const client = {
            social_watch_config: {
                goals: ['growth', '', null, 'reputation'],
                known_competitors: [null, undefined, 'CompA'],
            },
        };
        const config = getSocialWatchConfig(client);
        expect(config.goals).toEqual(['growth', 'reputation']);
        expect(config.known_competitors).toEqual(['CompA']);
    });
});

// ──────────────────────────────────────────────────────────────
// buildSeedQueries — mandate-aware
// ──────────────────────────────────────────────────────────────

describe('buildSeedQueries mandate-aware', () => {
    it('includes competitor seeds when mandate has known_competitors', () => {
        const client = {
            ...TROUVABLE_CLIENT,
            social_watch_config: {
                known_competitors: ['AgenceXYZ', 'RivalSEO'],
            },
        };
        const seeds = buildSeedQueries(client);
        const queries = seeds.map((s) => s.query);
        expect(queries.some((q) => q.includes('AgenceXYZ'))).toBe(true);
    });

    it('includes topic seeds when mandate has monitored_topics', () => {
        const client = {
            ...TROUVABLE_CLIENT,
            social_watch_config: {
                monitored_topics: ['ai seo pricing'],
            },
        };
        const seeds = buildSeedQueries(client);
        const queries = seeds.map((s) => s.query);
        expect(queries.some((q) => q.includes('ai seo pricing'))).toBe(true);
    });

    it('tags each seed with a strategy label', () => {
        const seeds = buildSeedQueries(TROUVABLE_CLIENT);
        seeds.forEach((s) => {
            expect(s).toHaveProperty('strategy');
            expect(s).toHaveProperty('query');
            expect(typeof s.strategy).toBe('string');
        });
    });

    it('uses English terms when language_priority is en', () => {
        const client = {
            client_name: 'TestCo',
            business_type: 'consulting',
            address: { city: 'Toronto' },
            social_watch_config: { language_priority: 'en' },
        };
        const seeds = buildSeedQueries(client);
        const queries = seeds.map((s) => s.query);
        expect(queries.some((q) => q.includes('review'))).toBe(true);
        expect(queries.some((q) => q.includes('best'))).toBe(true);
    });
});

// ──────────────────────────────────────────────────────────────
// buildRelevanceAnchors
// ──────────────────────────────────────────────────────────────

describe('buildRelevanceAnchors', () => {
    it('includes client name tokens as anchors', () => {
        const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);
        expect(anchors.has('trouvable')).toBe(true);
    });

    it('includes city tokens as anchors', () => {
        const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);
        expect(anchors.has('montreal')).toBe(true);
    });

    it('includes business type tokens as anchors', () => {
        const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);
        expect(anchors.has('seo')).toBe(true);
        expect(anchors.has('geo')).toBe(true);
    });

    it('expands industry vocabulary when business_type matches', () => {
        const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);
        // SEO industry vocab should be expanded
        expect(anchors.has('referencement')).toBe(true);
        expect(anchors.has('backlink')).toBe(true);
        expect(anchors.has('ranking')).toBe(true);
    });

    it('includes intent vocabulary', () => {
        const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);
        expect(anchors.has('recommandation')).toBe(true);
        expect(anchors.has('alternative')).toBe(true);
        expect(anchors.has('compare')).toBe(true);
    });

    it('falls back to all industry vocab when business_type is sparse', () => {
        const anchors = buildRelevanceAnchors(SPARSE_CLIENT);
        // All industry vocab should be included as safe fallback
        expect(anchors.has('seo')).toBe(true);
        expect(anchors.has('marketing')).toBe(true);
        expect(anchors.has('web')).toBe(true);
    });

    it('includes location for non-SEO clients too', () => {
        const anchors = buildRelevanceAnchors(BAKERY_CLIENT);
        expect(anchors.has('lyon')).toBe(true);
    });

    it('enriches anchors via resolved business type when raw type is available', () => {
        // TROUVABLE_CLIENT has business_type 'agence SEO GEO visibilité IA'
        // The resolver should identify this as ai_visibility_software → adding category tokens
        const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);
        expect(anchors.has('visibility')).toBe(true);
    });
});

// ──────────────────────────────────────────────────────────────
// scoreThemeRelevance
// ──────────────────────────────────────────────────────────────

describe('scoreThemeRelevance', () => {
    const trouvableAnchors = buildRelevanceAnchors(TROUVABLE_CLIENT);

    it('scores relevant single tokens positively', () => {
        expect(scoreThemeRelevance('seo', trouvableAnchors)).toBeGreaterThan(0);
        expect(scoreThemeRelevance('referencement', trouvableAnchors)).toBeGreaterThan(0);
        expect(scoreThemeRelevance('trouvable', trouvableAnchors)).toBeGreaterThan(0);
    });

    it('scores irrelevant single tokens as zero', () => {
        expect(scoreThemeRelevance('park', trouvableAnchors)).toBe(0);
        expect(scoreThemeRelevance('oven', trouvableAnchors)).toBe(0);
        expect(scoreThemeRelevance('bagels', trouvableAnchors)).toBe(0);
        expect(scoreThemeRelevance('canadian', trouvableAnchors)).toBe(0);
    });

    it('scores relevant bigrams higher than single tokens', () => {
        const singleScore = scoreThemeRelevance('seo', trouvableAnchors);
        const bigramScore = scoreThemeRelevance('seo local', trouvableAnchors);
        expect(bigramScore).toBeGreaterThan(singleScore);
    });

    it('scores irrelevant bigrams as zero', () => {
        expect(scoreThemeRelevance('park bench', trouvableAnchors)).toBe(0);
        expect(scoreThemeRelevance('oven repair', trouvableAnchors)).toBe(0);
    });

    it('returns zero for empty/null labels', () => {
        expect(scoreThemeRelevance('', trouvableAnchors)).toBe(0);
        expect(scoreThemeRelevance(null, trouvableAnchors)).toBe(0);
    });

    it('returns zero when anchors are empty', () => {
        expect(scoreThemeRelevance('seo', new Set())).toBe(0);
    });

    it('caps score at maximum', () => {
        const score = scoreThemeRelevance('seo', trouvableAnchors);
        expect(score).toBeLessThanOrEqual(2.0);
    });
});

// ──────────────────────────────────────────────────────────────
// End-to-end theme filtering simulation
// ──────────────────────────────────────────────────────────────

describe('pipeline theme filtering (simulated end-to-end)', () => {
    it('filters out junk tokens for a Trouvable-like client', () => {
        const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);
        const junkTokens = ['park', 'oven', 'bagels', 'people', 'canadian', 'sandwich', 'hockey', 'winter'];
        const relevantTokens = ['seo', 'referencement', 'visibilite', 'citation', 'agence', 'ranking', 'local'];

        for (const token of junkTokens) {
            const score = scoreThemeRelevance(token, anchors);
            expect(score).toBe(0);
        }

        for (const token of relevantTokens) {
            const score = scoreThemeRelevance(token, anchors);
            expect(score).toBeGreaterThan(0);
        }
    });

    it('relevant themes outrank noisy frequent tokens', () => {
        const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);

        // Simulate cluster scoring: frequency × (1 + relevance)
        const junkCluster = { label: 'park', mention_count: 20 };
        const relevantCluster = { label: 'seo', mention_count: 5 };

        const junkRelevance = scoreThemeRelevance(junkCluster.label, anchors);
        const relevantRelevance = scoreThemeRelevance(relevantCluster.label, anchors);

        // Junk should have zero relevance → score = frequency × 1 = 20
        // But with threshold filtering, junk won't even make it to clusters
        expect(junkRelevance).toBe(0);
        expect(relevantRelevance).toBeGreaterThan(0);

        // The key point is that junk with relevance=0 gets filtered out entirely
        expect(junkRelevance).toBeLessThan(THEME_RELEVANCE_THRESHOLD); // Below threshold → filtered out
        expect(relevantRelevance).toBeGreaterThanOrEqual(THEME_RELEVANCE_THRESHOLD); // Above threshold → kept
    });

    it('sparse client context does not collapse relevance quality', () => {
        const anchors = buildRelevanceAnchors(SPARSE_CLIENT);

        // Even with sparse context, intent vocab should still work
        expect(scoreThemeRelevance('recommandation', anchors)).toBeGreaterThan(0);
        expect(scoreThemeRelevance('alternative', anchors)).toBeGreaterThan(0);

        // And generic industry vocab should be available as fallback
        expect(scoreThemeRelevance('seo', anchors)).toBeGreaterThan(0);

        // But pure junk should still score zero
        expect(scoreThemeRelevance('park', anchors)).toBe(0);
        expect(scoreThemeRelevance('oven', anchors)).toBe(0);
    });

    it('opportunities are derived from meaningful evidence only', () => {
        const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);

        // Simulate cluster labels that would become opportunities
        const goodThemes = ['seo local', 'visibilite', 'agence', 'referencement'];
        const badThemes = ['park', 'oven', 'bagels', 'hockey'];

        for (const theme of goodThemes) {
            const relevance = scoreThemeRelevance(theme, anchors);
            expect(relevance).toBeGreaterThanOrEqual(THEME_RELEVANCE_THRESHOLD);
        }

        for (const theme of badThemes) {
            const relevance = scoreThemeRelevance(theme, anchors);
            expect(relevance).toBeLessThan(THEME_RELEVANCE_THRESHOLD);
        }
    });

    it('does not over-filter for a bakery client', () => {
        const anchors = buildRelevanceAnchors(BAKERY_CLIENT);

        // Bakery-relevant terms should score positively
        expect(scoreThemeRelevance('lyon', anchors)).toBeGreaterThan(0);
        expect(scoreThemeRelevance('artisan', anchors)).toBeGreaterThan(0);

        // Intent terms should still work
        expect(scoreThemeRelevance('recommandation', anchors)).toBeGreaterThan(0);
        expect(scoreThemeRelevance('prix', anchors)).toBeGreaterThan(0);

        // But random noise should still be blocked
        expect(scoreThemeRelevance('hockey', anchors)).toBe(0);
    });

    it('zero-relevance theme clusters do not survive', () => {
        const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);

        // Even with high mention count, zero-relevance themes should be blocked
        const zeroRelevanceThemes = ['park', 'oven', 'bagels'];
        for (const label of zeroRelevanceThemes) {
            const relevance = scoreThemeRelevance(label, anchors);
            expect(relevance).toBeLessThan(THEME_RELEVANCE_THRESHOLD);
        }
    });

    it('bigrams with relevant content outrank single tokens', () => {
        const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);

        const bigramScore = scoreThemeRelevance('seo local', anchors);
        const singleScore = scoreThemeRelevance('seo', anchors);

        expect(bigramScore).toBeGreaterThan(singleScore);
    });
});

// ──────────────────────────────────────────────────────────────
// Real pipeline behavior tests — extractMentionsFromDocuments
// ──────────────────────────────────────────────────────────────

let _testDocIdCounter = 0;
function makeDoc(title, body = '', opts = {}) {
    _testDocIdCounter += 1;
    return {
        id: opts.id || `test-doc-${_testDocIdCounter}`,
        title,
        body,
        source: opts.source || 'reddit',
        engagement_score: opts.engagement_score || 0,
    };
}

describe('extractMentionsFromDocuments (real pipeline stage 4)', () => {
    const CLIENT_ID = '00000000-0000-0000-0000-000000000001';
    const trouvableAnchors = buildRelevanceAnchors(TROUVABLE_CLIENT);

    it('does not emit junk single tokens as theme mentions for a Trouvable-like client', () => {
        const docs = [
            makeDoc(
                'Best park near Montreal for a walk',
                'People love the park with bagels and oven-baked goods. Canadian winter is long.',
            ),
        ];
        const mentions = extractMentionsFromDocuments(docs, CLIENT_ID, trouvableAnchors);
        const themeLabels = mentions.filter((m) => m.mention_type === 'theme').map((m) => m.label);

        // These junk tokens must NOT appear as themes
        expect(themeLabels).not.toContain('park');
        expect(themeLabels).not.toContain('oven');
        expect(themeLabels).not.toContain('bagels');
        expect(themeLabels).not.toContain('canadian');
        expect(themeLabels).not.toContain('winter');
        expect(themeLabels).not.toContain('walk');
    });

    it('emits relevant category/entity terms as theme mentions', () => {
        const docs = [
            makeDoc(
                'Best SEO agency in Montreal for local ranking',
                'Looking for a good agence SEO to improve referencement and visibility in local search.',
            ),
        ];
        const mentions = extractMentionsFromDocuments(docs, CLIENT_ID, trouvableAnchors);
        const themeLabels = mentions.filter((m) => m.mention_type === 'theme').map((m) => m.label);

        // At least some relevant terms should appear
        const hasRelevantTheme = themeLabels.some(
            (label) =>
                ['seo', 'agence', 'montreal', 'ranking', 'referencement', 'local'].includes(label) ||
                label.includes('seo') ||
                label.includes('agence'),
        );
        expect(hasRelevantTheme).toBe(true);
    });

    it('still detects questions and complaints regardless of theme relevance', () => {
        const docs = [
            makeDoc('Why is this oven so slow and expensive?', 'I hate how my oven takes forever to heat up.'),
        ];
        const mentions = extractMentionsFromDocuments(docs, CLIENT_ID, trouvableAnchors);
        const types = new Set(mentions.map((m) => m.mention_type));

        // Question and complaint detection should still work
        expect(types.has('question')).toBe(true);
        expect(types.has('complaint')).toBe(true);

        // But no junk theme tokens should appear
        const themeLabels = mentions.filter((m) => m.mention_type === 'theme').map((m) => m.label);
        expect(themeLabels).not.toContain('oven');
    });

    it('does not let intent-only tokens pass as themes', () => {
        // Intent vocab words like "help", "support", "problem" should NOT
        // alone qualify a random token as a theme — they need to score
        // above the threshold, which means they need more evidence.
        const docs = [makeDoc('Need help with my kitchen problem', 'Support for fixing broken appliance issue.')];
        const mentions = extractMentionsFromDocuments(docs, CLIENT_ID, trouvableAnchors);
        const themeLabels = mentions.filter((m) => m.mention_type === 'theme').map((m) => m.label);

        // Generic words that only match intent vocab weakly should be filtered
        expect(themeLabels).not.toContain('kitchen');
        expect(themeLabels).not.toContain('broken');
        expect(themeLabels).not.toContain('appliance');
        expect(themeLabels).not.toContain('fixing');
    });

    it('emits bigrams only when they meet the relevance threshold', () => {
        const docs = [makeDoc('SEO local vs park bench comparison', 'Best local agence for referencement.')];
        const mentions = extractMentionsFromDocuments(docs, CLIENT_ID, trouvableAnchors);
        const themeBigrams = mentions
            .filter((m) => m.mention_type === 'theme')
            .map((m) => m.label)
            .filter((l) => l.includes(' '));

        // "park bench" bigram should NOT be emitted
        expect(themeBigrams).not.toContain('park bench');
    });
});

// ──────────────────────────────────────────────────────────────
// Real pipeline behavior tests — aggregateMentionsToClusters
// ──────────────────────────────────────────────────────────────

describe('aggregateMentionsToClusters (real pipeline stage 5)', () => {
    const CLIENT_ID = '00000000-0000-0000-0000-000000000001';
    const trouvableAnchors = buildRelevanceAnchors(TROUVABLE_CLIENT);

    it('zero-relevance theme clusters do not survive even with high mention_count', () => {
        // Simulate many mentions of an irrelevant token
        const junkMentions = Array.from({ length: 30 }, () => ({
            mention_type: 'theme',
            label: 'park',
            snippet: null,
            source: 'reddit',
        }));
        const clusters = aggregateMentionsToClusters(junkMentions, CLIENT_ID, trouvableAnchors);
        const themeLabels = clusters.filter((c) => c.cluster_type === 'theme').map((c) => c.label);

        expect(themeLabels).not.toContain('park');
    });

    it('relevant theme clusters survive and get relevance-weighted scores', () => {
        const relevantMentions = Array.from({ length: 5 }, () => ({
            mention_type: 'theme',
            label: 'seo',
            snippet: null,
            source: 'reddit',
        }));
        const clusters = aggregateMentionsToClusters(relevantMentions, CLIENT_ID, trouvableAnchors);
        const seoClusters = clusters.filter((c) => c.cluster_type === 'theme' && c.label === 'seo');

        expect(seoClusters.length).toBe(1);
        // Score should be > mention_count because relevance multiplier is applied
        expect(seoClusters[0].score).toBeGreaterThan(seoClusters[0].mention_count);
    });

    it('relevant themes outrank frequent junk in final clusters', () => {
        const mentions = [
            // 20 mentions of junk
            ...Array.from({ length: 20 }, () => ({
                mention_type: 'theme',
                label: 'park',
                snippet: null,
                source: 'reddit',
            })),
            // 3 mentions of relevant term
            ...Array.from({ length: 3 }, () => ({
                mention_type: 'theme',
                label: 'seo',
                snippet: null,
                source: 'reddit',
            })),
        ];
        const clusters = aggregateMentionsToClusters(mentions, CLIENT_ID, trouvableAnchors);
        const themeLabels = clusters.filter((c) => c.cluster_type === 'theme').map((c) => c.label);

        // Park must not appear despite being 20× more frequent
        expect(themeLabels).not.toContain('park');

        // SEO must appear (it has >= 2 mentions and passes relevance threshold)
        expect(themeLabels).toContain('seo');
    });

    it('non-theme cluster types (question, complaint) are not relevance-gated', () => {
        const mentions = [
            { mention_type: 'question', label: 'How do I fix my oven?', snippet: 'Some text', source: 'reddit' },
            { mention_type: 'question', label: 'How do I fix my oven?', snippet: 'Some text', source: 'reddit' },
            { mention_type: 'complaint', label: 'Oven is broken', snippet: 'Complaint', source: 'reddit' },
            { mention_type: 'complaint', label: 'Oven is broken', snippet: 'Complaint', source: 'reddit' },
        ];
        const clusters = aggregateMentionsToClusters(mentions, CLIENT_ID, trouvableAnchors);
        const questionClusters = clusters.filter((c) => c.cluster_type === 'question');
        const complaintClusters = clusters.filter((c) => c.cluster_type === 'complaint');

        // Non-theme types should pass through — questions and complaints don't need relevance scoring
        expect(questionClusters.length).toBe(1);
        expect(complaintClusters.length).toBe(1);
    });
});

// ──────────────────────────────────────────────────────────────
// Real pipeline behavior — deriveOpportunitiesFromClusters
// ──────────────────────────────────────────────────────────────

describe('deriveOpportunitiesFromClusters (real pipeline stage 6)', () => {
    const CLIENT_ID = '00000000-0000-0000-0000-000000000001';
    const trouvableAnchors = buildRelevanceAnchors(TROUVABLE_CLIENT);

    it('does not derive content opportunities from irrelevant theme clusters', () => {
        // Even if an irrelevant theme cluster somehow made it through,
        // opportunity derivation should still block it
        const clusters = [
            {
                cluster_type: 'theme',
                label: 'park',
                mention_count: 10,
                evidence_level: 'medium',
                id: null,
                metadata: {},
            },
        ];
        const opps = deriveOpportunitiesFromClusters(clusters, CLIENT_ID, trouvableAnchors);
        const contentOpps = opps.filter(
            (o) =>
                o.opportunity_type === 'content' ||
                o.opportunity_type === 'content_opportunity' ||
                o.opportunity_type === 'ai_mention_opportunity',
        );

        expect(contentOpps.length).toBe(0);
    });

    it('derives content opportunities from relevant theme clusters', () => {
        const clusters = [
            {
                cluster_type: 'theme',
                label: 'seo',
                mention_count: 5,
                evidence_level: 'medium',
                id: null,
                metadata: {},
            },
        ];
        const opps = deriveOpportunitiesFromClusters(clusters, CLIENT_ID, trouvableAnchors);
        // v2: theme clusters produce content_opportunity (or ai_mention_opportunity if AI-related)
        const contentOpps = opps.filter(
            (o) => o.opportunity_type === 'content_opportunity' || o.opportunity_type === 'content',
        );

        expect(contentOpps.length).toBe(1);
        expect(contentOpps[0].title).toContain('seo');
    });

    it('still derives FAQ opportunities from question clusters (no relevance gate)', () => {
        const clusters = [
            {
                cluster_type: 'question',
                label: 'How to fix a broken oven?',
                mention_count: 3,
                evidence_level: 'low',
                id: null,
                metadata: {},
            },
        ];
        const opps = deriveOpportunitiesFromClusters(clusters, CLIENT_ID, trouvableAnchors);
        // With no signal families, produces standard FAQ
        const faqOpps = opps.filter((o) => o.opportunity_type === 'faq');

        expect(faqOpps.length).toBe(1);
    });
});

// ──────────────────────────────────────────────────────────────
// Full pipeline flow: extraction → clustering → opportunities
// ──────────────────────────────────────────────────────────────

describe('full pipeline flow (extraction → clustering → opportunities)', () => {
    const CLIENT_ID = '00000000-0000-0000-0000-000000000001';

    it('Trouvable-like client: junk does not appear in final themes or opportunities', () => {
        const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);

        // Simulate a batch of documents with mixed relevant and irrelevant content
        const docs = [
            makeDoc('Best SEO agence in Montreal', 'Looking for local SEO agency for better ranking and visibility.'),
            makeDoc('Best SEO agence in Montreal', 'Looking for local SEO agency for better ranking and visibility.'),
            makeDoc('Best SEO agence in Montreal', 'Looking for local SEO agency for better ranking and visibility.'),
            makeDoc(
                'Park near downtown Montreal',
                'People love the park. Great bagels nearby. Canadian winter hockey.',
            ),
            makeDoc(
                'Park near downtown Montreal',
                'People love the park. Great bagels nearby. Canadian winter hockey.',
            ),
            makeDoc(
                'Park near downtown Montreal',
                'People love the park. Great bagels nearby. Canadian winter hockey.',
            ),
            makeDoc('My oven is broken, need help', 'This expensive oven has a serious problem. Worst purchase ever.'),
            makeDoc('My oven is broken, need help', 'This expensive oven has a serious problem. Worst purchase ever.'),
        ];

        // Stage 4: Extract
        const mentions = extractMentionsFromDocuments(docs, CLIENT_ID, anchors);

        // Stage 5: Cluster
        const clusters = aggregateMentionsToClusters(mentions, CLIENT_ID, anchors);

        // Stage 6: Opportunities
        const opps = deriveOpportunitiesFromClusters(clusters, CLIENT_ID, anchors);

        // Verify: no junk in theme clusters
        const themeLabels = clusters.filter((c) => c.cluster_type === 'theme').map((c) => c.label);
        expect(themeLabels).not.toContain('park');
        expect(themeLabels).not.toContain('oven');
        expect(themeLabels).not.toContain('bagels');
        expect(themeLabels).not.toContain('hockey');
        expect(themeLabels).not.toContain('winter');

        // Verify: no junk in content opportunities (theme-derived opportunities)
        // Note: complaint-type opportunities are observed signals, not theme-derived,
        // so they correctly include irrelevant topics if users actually complained about them.
        // v2: theme-derived opps use content_opportunity or ai_mention_opportunity types
        const contentOpps = opps.filter(
            (o) =>
                (o.opportunity_type === 'content' ||
                    o.opportunity_type === 'content_opportunity' ||
                    o.opportunity_type === 'ai_mention_opportunity') &&
                (o.title.startsWith('Angle contenu') || o.title.startsWith('Opportunité citation')),
        );
        for (const opp of contentOpps) {
            expect(opp.title).not.toContain('park');
            expect(opp.title).not.toContain('oven');
            expect(opp.title).not.toContain('bagels');
        }

        // Verify: relevant terms survive (at least some SEO/Montreal-related themes)
        const allThemeLabels = themeLabels.join(' ');
        const hasRelevant =
            allThemeLabels.includes('seo') ||
            allThemeLabels.includes('agence') ||
            allThemeLabels.includes('montreal') ||
            allThemeLabels.includes('ranking') ||
            allThemeLabels.includes('local');
        expect(hasRelevant).toBe(true);
    });

    it('sparse client context still blocks junk but keeps intent/industry fallback', () => {
        const anchors = buildRelevanceAnchors(SPARSE_CLIENT);

        const docs = [
            makeDoc('Best SEO tools recommendation', 'Compare the top SEO platforms for your business.'),
            makeDoc('Best SEO tools recommendation', 'Compare the top SEO platforms for your business.'),
            makeDoc('Best SEO tools recommendation', 'Compare the top SEO platforms for your business.'),
            makeDoc('Best park for kids', 'A beautiful park with playground.'),
            makeDoc('Best park for kids', 'A beautiful park with playground.'),
            makeDoc('Best park for kids', 'A beautiful park with playground.'),
        ];

        const mentions = extractMentionsFromDocuments(docs, CLIENT_ID, anchors);
        const clusters = aggregateMentionsToClusters(mentions, CLIENT_ID, anchors);
        const themeLabels = clusters.filter((c) => c.cluster_type === 'theme').map((c) => c.label);

        // Park must not survive even for sparse context
        expect(themeLabels).not.toContain('park');
        expect(themeLabels).not.toContain('playground');
        expect(themeLabels).not.toContain('kids');
        expect(themeLabels).not.toContain('beautiful');
    });
});

// ──────────────────────────────────────────────────────────────
// Signal families v2
// ──────────────────────────────────────────────────────────────

describe('detectSignalFamilies', () => {
    it('detects buyer_question from question with buying keywords', () => {
        const families = detectSignalFamilies(
            'question',
            'How to find the best SEO agency?',
            'Looking for a recommendation',
        );
        expect(families).toContain('buyer_question');
    });

    it('detects best_tool_intent when multiple tool keywords present', () => {
        // Requires ≥2 keyword matches for signal family — "best" alone is not enough
        const families = detectSignalFamilies(
            'question',
            'What is the best SEO tool?',
            'Looking for the best platform for my agency',
        );
        expect(families).toContain('best_tool_intent');
    });

    it('does not detect best_tool_intent from a single "best" keyword', () => {
        // v3: single keyword match is insufficient — prevents false positives
        const families = detectSignalFamilies('question', 'The best park near me', 'Nice park for a walk');
        expect(families).not.toContain('best_tool_intent');
    });

    it('detects comparison_intent from competitor mention with vs keyword', () => {
        const families = detectSignalFamilies('competitor', 'Semrush vs Ahrefs', 'compare these tools');
        expect(families).toContain('comparison_intent');
    });

    it('detects pain_point from complaint with frustration', () => {
        const families = detectSignalFamilies(
            'complaint',
            'Terrible support experience',
            'This is frustrating, the worst service',
        );
        expect(families).toContain('pain_point');
    });

    it('detects ai_mention_opportunity from theme with AI keywords', () => {
        const families = detectSignalFamilies('theme', 'ChatGPT for SEO', 'using AI for keyword research');
        expect(families).toContain('ai_mention_opportunity');
    });

    it('detects response_opportunity from question seeking help', () => {
        const families = detectSignalFamilies(
            'question',
            'Anyone have experience with SEO agencies?',
            'Looking for advice and recommendation',
        );
        expect(families).toContain('response_opportunity');
    });

    it('returns empty array when no families match', () => {
        const families = detectSignalFamilies('language', 'Random title', 'Generic content');
        expect(families).toEqual([]);
    });

    it('does not detect families for non-matching mention types', () => {
        // pain_point only matches 'complaint' mention_type, not 'question'
        const families = detectSignalFamilies('question', 'This is frustrating', 'terrible experience');
        expect(families).not.toContain('pain_point');
    });

    it('does not false-positive on "ai" inside longer words', () => {
        // v3: word-boundary matching prevents "ai" matching inside "maintain", "certain"
        const families = detectSignalFamilies(
            'theme',
            'How to maintain your website',
            'certain practices for better domain authority',
        );
        expect(families).not.toContain('ai_mention_opportunity');
    });

    it('does not false-positive on negated terms', () => {
        // v3: negation awareness prevents "no problem" from triggering pain_point
        const families = detectSignalFamilies(
            'complaint',
            'No problem with this service',
            'not bad at all, never had issues',
        );
        expect(families).toEqual([]);
    });
});

// ──────────────────────────────────────────────────────────────
// Composite scoring model v2
// ──────────────────────────────────────────────────────────────

describe('computeCompositeScore', () => {
    it('returns score between 0 and 100', () => {
        const cluster = {
            label: 'seo ranking',
            mention_count: 5,
            cluster_type: 'question',
            example_snippet: 'best seo tool',
        };
        const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);
        const result = computeCompositeScore(cluster, { anchors, city: 'Montréal' });
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
    });

    it('returns higher score for business-relevant content', () => {
        const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);
        const relevant = computeCompositeScore(
            {
                label: 'seo agence montreal',
                mention_count: 5,
                cluster_type: 'question',
                example_snippet: 'recommend best seo',
            },
            { anchors, city: 'Montréal' },
        );
        const irrelevant = computeCompositeScore(
            { label: 'park playground kids', mention_count: 5, cluster_type: 'question', example_snippet: 'nice park' },
            { anchors, city: 'Montréal' },
        );
        expect(relevant.score).toBeGreaterThan(irrelevant.score);
    });

    it('penalizes spam content', () => {
        const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);
        const clean = computeCompositeScore(
            { label: 'seo recommendation', mention_count: 3, cluster_type: 'question', example_snippet: '' },
            { anchors, city: 'Montréal' },
        );
        const spam = computeCompositeScore(
            {
                label: 'crypto earn money forex',
                mention_count: 3,
                cluster_type: 'question',
                example_snippet: 'casino nft',
            },
            { anchors, city: 'Montréal' },
        );
        expect(clean.score).toBeGreaterThan(spam.score);
    });

    it('provides scoring dimensions breakdown', () => {
        const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);
        const result = computeCompositeScore(
            { label: 'seo ranking', mention_count: 5, cluster_type: 'question', example_snippet: '' },
            { anchors, city: 'Montréal' },
        );
        expect(result.dimensions).toBeDefined();
        expect(result.dimensions.business_relevance).toBeDefined();
        expect(result.dimensions.geographic_proximity).toBeDefined();
        expect(result.dimensions.spam_risk).toBeDefined();
        expect(result.dimensions.frequency).toBeDefined();
    });

    it('boosts niche businesses with few but relevant mentions', () => {
        const anchors = buildRelevanceAnchors(BAKERY_CLIENT);
        const result = computeCompositeScore(
            { label: 'boulangerie', mention_count: 2, cluster_type: 'question', example_snippet: '' },
            { anchors, city: 'Lyon' },
        );
        // Niche boost applies when mentionCount <= 3 and businessRelevance >= 0.5
        expect(result.score).toBeGreaterThan(0);
    });

    it('gives higher execution_potential to questions than themes', () => {
        const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);
        const question = computeCompositeScore(
            { label: 'seo', mention_count: 5, cluster_type: 'question', example_snippet: '' },
            { anchors, city: 'Montréal' },
        );
        const theme = computeCompositeScore(
            { label: 'seo', mention_count: 5, cluster_type: 'theme', example_snippet: '' },
            { anchors, city: 'Montréal' },
        );
        expect(question.dimensions.execution_potential).toBeGreaterThan(theme.dimensions.execution_potential);
    });
});

// ──────────────────────────────────────────────────────────────
// v2 opportunity derivation
// ──────────────────────────────────────────────────────────────

describe('deriveOpportunitiesFromClusters v2', () => {
    const CLIENT_ID = '00000000-0000-0000-0000-000000000001';
    const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);

    it('produces recurring_buyer_question when cluster has buyer_question signal family', () => {
        const clusters = [
            {
                cluster_type: 'question',
                label: 'Best SEO agency in Montreal?',
                mention_count: 4,
                evidence_level: 'medium',
                id: null,
                metadata: { signal_families: ['buyer_question', 'best_tool_intent'] },
            },
        ];
        const opps = deriveOpportunitiesFromClusters(clusters, CLIENT_ID, anchors);
        expect(opps.some((o) => o.opportunity_type === 'recurring_buyer_question')).toBe(true);
    });

    it('produces response_opportunity when cluster has response_opportunity signal family', () => {
        const clusters = [
            {
                cluster_type: 'question',
                label: 'Anyone recommend an SEO tool?',
                mention_count: 3,
                evidence_level: 'low',
                id: null,
                metadata: { signal_families: ['response_opportunity'] },
            },
        ];
        const opps = deriveOpportunitiesFromClusters(clusters, CLIENT_ID, anchors);
        expect(opps.some((o) => o.opportunity_type === 'response_opportunity')).toBe(true);
    });

    it('produces comparison_discussion when cluster has comparison_intent signal family', () => {
        const clusters = [
            {
                cluster_type: 'competitor_complaint',
                label: 'Semrush vs Ahrefs pricing',
                mention_count: 5,
                evidence_level: 'medium',
                id: null,
                metadata: { signal_families: ['comparison_intent'] },
            },
        ];
        const opps = deriveOpportunitiesFromClusters(clusters, CLIENT_ID, anchors);
        expect(opps.some((o) => o.opportunity_type === 'comparison_discussion')).toBe(true);
    });

    it('produces ai_mention_opportunity when theme has AI signal family', () => {
        const clusters = [
            {
                cluster_type: 'theme',
                label: 'chatgpt seo',
                mention_count: 4,
                evidence_level: 'medium',
                id: null,
                metadata: { signal_families: ['ai_mention_opportunity'] },
            },
        ];
        const opps = deriveOpportunitiesFromClusters(clusters, CLIENT_ID, anchors);
        expect(opps.some((o) => o.opportunity_type === 'ai_mention_opportunity')).toBe(true);
    });

    it('produces recurring_pain_point when complaint has pain_point signal family', () => {
        const clusters = [
            {
                cluster_type: 'complaint',
                label: 'Terrible support experience',
                mention_count: 6,
                evidence_level: 'medium',
                id: null,
                metadata: { signal_families: ['pain_point'] },
            },
        ];
        const opps = deriveOpportunitiesFromClusters(clusters, CLIENT_ID, anchors);
        expect(opps.some((o) => o.opportunity_type === 'recurring_pain_point')).toBe(true);
    });

    it('includes v2 metadata in opportunity objects', () => {
        const clusters = [
            {
                cluster_type: 'question',
                label: 'How to find best SEO?',
                mention_count: 4,
                evidence_level: 'medium',
                id: null,
                score: 42,
                metadata: { signal_families: ['buyer_question'] },
            },
        ];
        const opps = deriveOpportunitiesFromClusters(clusters, CLIENT_ID, anchors);
        const opp = opps[0];
        expect(opp.metadata).toBeDefined();
        expect(opp.metadata.why_it_matters).toBeTruthy();
        expect(opp.metadata.suggested_action).toBeTruthy();
        expect(opp.metadata.signal_family).toBeTruthy();
    });

    it('falls back to legacy types when no signal families are detected', () => {
        const clusters = [
            {
                cluster_type: 'question',
                label: 'What is the weather today?',
                mention_count: 3,
                evidence_level: 'low',
                id: null,
                metadata: {},
            },
        ];
        const opps = deriveOpportunitiesFromClusters(clusters, CLIENT_ID, anchors);
        // With no signal families, should produce a standard FAQ
        expect(opps.some((o) => o.opportunity_type === 'faq')).toBe(true);
    });
});

// ──────────────────────────────────────────────────────────────
// Signal families in extraction pipeline
// ──────────────────────────────────────────────────────────────

describe('extractMentionsFromDocuments with signal families', () => {
    const CLIENT_ID = '00000000-0000-0000-0000-000000000001';

    it('tags question mentions with signal families', () => {
        const docs = [makeDoc('How to find the best SEO tool?', 'Looking for a recommendation for my business')];
        const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);
        const mentions = extractMentionsFromDocuments(docs, CLIENT_ID, anchors);
        const questions = mentions.filter((m) => m.mention_type === 'question');
        expect(questions.length).toBeGreaterThan(0);
        expect(questions[0].signal_families).toBeDefined();
        expect(Array.isArray(questions[0].signal_families)).toBe(true);
    });

    it('tags complaint mentions with pain_point when strong language present', () => {
        const docs = [makeDoc('Terrible SEO tool', 'This is the worst, broken and frustrating experience')];
        const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);
        const mentions = extractMentionsFromDocuments(docs, CLIENT_ID, anchors);
        const complaints = mentions.filter((m) => m.mention_type === 'complaint');
        expect(complaints.length).toBeGreaterThan(0);
        expect(complaints[0].signal_families).toContain('pain_point');
    });

    it('aggregates signal families into clusters', () => {
        const docs = [
            makeDoc('Best SEO tool recommendation?', 'Looking for advice on the best tool'),
            makeDoc('Best SEO tool recommendation?', 'Looking for advice on the best tool'),
            makeDoc('Best SEO tool recommendation?', 'Looking for advice on the best tool'),
        ];
        const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);
        const mentions = extractMentionsFromDocuments(docs, CLIENT_ID, anchors);
        const clusters = aggregateMentionsToClusters(mentions, CLIENT_ID, anchors);
        const questionClusters = clusters.filter((c) => c.cluster_type === 'question');
        // At least one question cluster should have signal families in metadata
        const hasSignalFamilies = questionClusters.some(
            (c) => c.metadata?.signal_families && c.metadata.signal_families.length > 0,
        );
        expect(hasSignalFamilies).toBe(true);
    });
});

// ──────────────────────────────────────────────────────────────
// v3 — False positive control (engine quality batch)
// ──────────────────────────────────────────────────────────────

describe('v3 false positive control', () => {
    const CLIENT_ID = '00000000-0000-0000-0000-000000000001';

    describe('word-boundary keyword matching', () => {
        it('does not match "ai" inside "maintain" or "certain"', () => {
            const families = detectSignalFamilies(
                'theme',
                'How to maintain your website',
                'certain practices for domain authority',
            );
            expect(families).not.toContain('ai_mention_opportunity');
        });

        it('matches "ai" as standalone word', () => {
            const families = detectSignalFamilies(
                'theme',
                'ChatGPT and AI tools for SEO',
                'using AI and LLM for keyword research',
            );
            expect(families).toContain('ai_mention_opportunity');
        });

        it('does not match "bad" inside "badge"', () => {
            const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);
            const docs = [
                makeDoc('SEO Badge Program', 'Get your digital badge for completing the certification program.'),
            ];
            const mentions = extractMentionsFromDocuments(docs, CLIENT_ID, anchors);
            const complaints = mentions.filter((m) => m.mention_type === 'complaint');
            expect(complaints.length).toBe(0);
        });

        it('does not match "bug" inside "debugging"', () => {
            const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);
            const docs = [
                makeDoc(
                    'Debugging guide for web developers',
                    'Learn debugging techniques and tools for modern web apps.',
                ),
            ];
            const mentions = extractMentionsFromDocuments(docs, CLIENT_ID, anchors);
            const complaints = mentions.filter((m) => m.mention_type === 'complaint');
            expect(complaints.length).toBe(0);
        });
    });

    describe('negation awareness', () => {
        it('does not trigger complaint on "no problem"', () => {
            const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);
            const docs = [
                makeDoc('SEO setup guide', 'No problem with the installation. Not bad at all, it works great.'),
            ];
            const mentions = extractMentionsFromDocuments(docs, CLIENT_ID, anchors);
            const complaints = mentions.filter((m) => m.mention_type === 'complaint');
            expect(complaints.length).toBe(0);
        });

        it('does not trigger complaint on "never had issues"', () => {
            const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);
            const docs = [
                makeDoc('My SEO experience', 'Never had issues with this tool, without any problem whatsoever.'),
            ];
            const mentions = extractMentionsFromDocuments(docs, CLIENT_ID, anchors);
            const complaints = mentions.filter((m) => m.mention_type === 'complaint');
            expect(complaints.length).toBe(0);
        });
    });

    describe('minimum keyword threshold for signal families', () => {
        it('requires ≥2 keywords for signal family assignment', () => {
            // Single "best" should NOT trigger best_tool_intent
            const families = detectSignalFamilies('question', 'What is the best park?', 'Looking for a nice park');
            expect(families).not.toContain('best_tool_intent');
        });

        it('assigns signal family when ≥2 keywords match', () => {
            // "best" + "tool" should trigger best_tool_intent
            const families = detectSignalFamilies(
                'question',
                'What is the best SEO tool?',
                'Looking for the top platform',
            );
            expect(families).toContain('best_tool_intent');
        });
    });

    describe('stronger complaint detection', () => {
        it('does not trigger complaint on single weak term "support"', () => {
            const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);
            const docs = [makeDoc('Great support from the SEO team', 'The support team was helpful and responsive.')];
            const mentions = extractMentionsFromDocuments(docs, CLIENT_ID, anchors);
            const complaints = mentions.filter((m) => m.mention_type === 'complaint');
            expect(complaints.length).toBe(0);
        });

        it('triggers complaint on a single strong term "terrible"', () => {
            const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);
            const docs = [makeDoc('Terrible SEO agency experience', 'The agency did nothing useful.')];
            const mentions = extractMentionsFromDocuments(docs, CLIENT_ID, anchors);
            const complaints = mentions.filter((m) => m.mention_type === 'complaint');
            expect(complaints.length).toBe(1);
            expect(complaints[0].evidence_level).toBe('medium');
        });

        it('triggers complaint when ≥2 weak terms co-occur', () => {
            const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);
            const docs = [
                makeDoc(
                    'Slow and expensive SEO tool',
                    'This tool is slow and the pricing is too expensive for what it does.',
                ),
            ];
            const mentions = extractMentionsFromDocuments(docs, CLIENT_ID, anchors);
            const complaints = mentions.filter((m) => m.mention_type === 'complaint');
            expect(complaints.length).toBe(1);
        });
    });

    describe('question detection precision', () => {
        it('detects question from explicit question mark in title', () => {
            const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);
            const docs = [makeDoc('What SEO tools do you recommend?', 'Looking for SEO tools.')];
            const mentions = extractMentionsFromDocuments(docs, CLIENT_ID, anchors);
            const questions = mentions.filter((m) => m.mention_type === 'question');
            expect(questions.length).toBe(1);
        });

        it('detects question from question hint phrases', () => {
            const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);
            const docs = [makeDoc('How to improve local SEO ranking', 'Step by step guide needed.')];
            const mentions = extractMentionsFromDocuments(docs, CLIENT_ID, anchors);
            const questions = mentions.filter((m) => m.mention_type === 'question');
            expect(questions.length).toBe(1);
        });
    });
});

// ──────────────────────────────────────────────────────────────
// v3 — Representative scenario testing
// ──────────────────────────────────────────────────────────────

describe('v3 representative scenario tests', () => {
    const CLIENT_ID = '00000000-0000-0000-0000-000000000001';

    it('French-first local business: SEO agency in Lyon', () => {
        const client = {
            client_name: 'Agence Digitale Lyon',
            business_type: 'agence web marketing digital',
            address: { city: 'Lyon' },
        };
        const anchors = buildRelevanceAnchors(client);

        const docs = [
            makeDoc(
                'Meilleur agence web à Lyon?',
                'Je cherche une bonne agence web marketing pour mon entreprise à Lyon.',
            ),
            makeDoc(
                'Meilleur agence web à Lyon?',
                'Je cherche une bonne agence web marketing pour mon entreprise à Lyon.',
            ),
            makeDoc('Recette crêpes bretonnes', 'La meilleure recette de crêpes avec du beurre salé.'),
            makeDoc('Recette crêpes bretonnes', 'La meilleure recette de crêpes avec du beurre salé.'),
        ];

        const mentions = extractMentionsFromDocuments(docs, CLIENT_ID, anchors);
        const clusters = aggregateMentionsToClusters(mentions, CLIENT_ID, anchors);
        const themeLabels = clusters.filter((c) => c.cluster_type === 'theme').map((c) => c.label);

        // Crêpes/beurre should NOT appear as themes for a web agency
        expect(themeLabels).not.toContain('crepes');
        expect(themeLabels).not.toContain('beurre');
        expect(themeLabels).not.toContain('recette');
    });

    it('niche B2B service with sparse volume', () => {
        const client = {
            client_name: 'DataSecure',
            business_type: 'cybersecurity consulting',
            address: { city: 'Paris' },
        };
        const anchors = buildRelevanceAnchors(client);

        const docs = [
            makeDoc('How to protect your small business from cyberattacks?', 'Security tips for SMBs.'),
            makeDoc('How to protect your small business from cyberattacks?', 'Security tips for SMBs.'),
            makeDoc('Best pizza places in Paris', 'Looking for the best pizza delivery.'),
            makeDoc('Best pizza places in Paris', 'Looking for the best pizza delivery.'),
        ];

        const mentions = extractMentionsFromDocuments(docs, CLIENT_ID, anchors);
        const clusters = aggregateMentionsToClusters(mentions, CLIENT_ID, anchors);
        const themeLabels = clusters.filter((c) => c.cluster_type === 'theme').map((c) => c.label);

        // Pizza should NOT appear as themes for cybersecurity
        expect(themeLabels).not.toContain('pizza');
        expect(themeLabels).not.toContain('delivery');
    });

    it('noisy irrelevant content does not produce strong opportunities', () => {
        const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);

        const docs = [
            makeDoc('Random meme post', 'Just a random meme about cats and dogs.'),
            makeDoc('Random meme post', 'Just a random meme about cats and dogs.'),
            makeDoc('Weekend plans thread', 'Going hiking this weekend in the mountains.'),
            makeDoc('Weekend plans thread', 'Going hiking this weekend in the mountains.'),
        ];

        const mentions = extractMentionsFromDocuments(docs, CLIENT_ID, anchors);
        const clusters = aggregateMentionsToClusters(mentions, CLIENT_ID, anchors);
        const opps = deriveOpportunitiesFromClusters(clusters, CLIENT_ID, anchors);

        // Pure noise should produce zero content/AI opportunities
        const contentOpps = opps.filter(
            (o) => o.opportunity_type === 'content_opportunity' || o.opportunity_type === 'ai_mention_opportunity',
        );
        expect(contentOpps.length).toBe(0);
    });

    it('weak thread should NOT become a strong opportunity', () => {
        const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);

        // A thread that mentions SEO tangentially but isn't actionable
        const docs = [
            makeDoc(
                'General discussion about the internet',
                'People sometimes talk about seo and marketing in general.',
            ),
            makeDoc(
                'General discussion about the internet',
                'People sometimes talk about seo and marketing in general.',
            ),
        ];

        const mentions = extractMentionsFromDocuments(docs, CLIENT_ID, anchors);
        const clusters = aggregateMentionsToClusters(mentions, CLIENT_ID, anchors);
        const opps = deriveOpportunitiesFromClusters(clusters, CLIENT_ID, anchors);

        // Should not produce high-confidence opportunities from weak evidence
        for (const opp of opps) {
            if (opp.opportunity_type === 'content_opportunity') {
                expect(opp.evidence_level).not.toBe('strong');
            }
        }
    });

    it('comparison thread produces comparison_discussion opportunity', () => {
        const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);

        const docs = [
            makeDoc(
                'Semrush vs Ahrefs vs Moz — which is best?',
                'I want to compare these SEO tools. Alternative to Semrush?',
            ),
            makeDoc(
                'Semrush vs Ahrefs vs Moz — which is best?',
                'I want to compare these SEO tools. Alternative to Semrush?',
            ),
            makeDoc(
                'Semrush vs Ahrefs vs Moz — which is best?',
                'I want to compare these SEO tools. Alternative to Semrush?',
            ),
        ];

        const mentions = extractMentionsFromDocuments(docs, CLIENT_ID, anchors);
        const clusters = aggregateMentionsToClusters(mentions, CLIENT_ID, anchors);

        // The comparison clusters should have comparison_intent signal
        const compClusters = clusters.filter((c) => (c.metadata?.signal_families || []).includes('comparison_intent'));
        expect(compClusters.length).toBeGreaterThan(0);
    });

    it('complaint thread with strong language produces pain_point', () => {
        const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);

        const docs = [
            makeDoc(
                'Terrible experience with local SEO agency',
                'Frustrated with the horrible service, the worst agency I ever worked with.',
            ),
            makeDoc(
                'Terrible experience with local SEO agency',
                'Frustrated with the horrible service, the worst agency I ever worked with.',
            ),
            makeDoc(
                'Terrible experience with local SEO agency',
                'Frustrated with the horrible service, the worst agency I ever worked with.',
            ),
        ];

        const mentions = extractMentionsFromDocuments(docs, CLIENT_ID, anchors);
        const complaints = mentions.filter((m) => m.mention_type === 'complaint');
        expect(complaints.length).toBe(3);
        // Strong complaint terms should yield medium evidence
        expect(complaints[0].evidence_level).toBe('medium');
    });

    it('AI topic discussion produces ai_mention_opportunity', () => {
        const anchors = buildRelevanceAnchors(TROUVABLE_CLIENT);

        const docs = [
            makeDoc(
                'ChatGPT vs Gemini for SEO content',
                'Which LLM is best for generating SEO content and AI overviews?',
            ),
            makeDoc(
                'ChatGPT vs Gemini for SEO content',
                'Which LLM is best for generating SEO content and AI overviews?',
            ),
            makeDoc(
                'ChatGPT vs Gemini for SEO content',
                'Which LLM is best for generating SEO content and AI overviews?',
            ),
        ];

        const mentions = extractMentionsFromDocuments(docs, CLIENT_ID, anchors);
        const clusters = aggregateMentionsToClusters(mentions, CLIENT_ID, anchors);

        // Should detect AI-related theme signals
        const aiSignals = clusters.filter((c) =>
            (c.metadata?.signal_families || []).includes('ai_mention_opportunity'),
        );
        expect(aiSignals.length).toBeGreaterThan(0);
    });
});

// ──────────────────────────────────────────────────────────────
// v3 — Quality gate tests for contracts helpers
// ──────────────────────────────────────────────────────────────

import {
    matchesKeyword,
    isNegated,
    STRONG_COMPLAINT_TERMS,
    WEAK_COMPLAINT_TERMS,
    MIN_KEYWORD_MATCHES_FOR_SIGNAL,
} from '@/lib/agent-reach/contracts';

describe('matchesKeyword (word-boundary matching)', () => {
    it('matches "ai" as standalone word', () => {
        expect(matchesKeyword('using ai for seo', 'ai')).toBe(true);
    });

    it('does not match "ai" inside "maintain"', () => {
        expect(matchesKeyword('how to maintain your site', 'ai')).toBe(false);
    });

    it('does not match "ai" inside "certain"', () => {
        expect(matchesKeyword('certain aspects of optimization', 'ai')).toBe(false);
    });

    it('matches "ai" at start of text', () => {
        expect(matchesKeyword('ai tools for business', 'ai')).toBe(true);
    });

    it('matches "ai" at end of text', () => {
        expect(matchesKeyword('tools powered by ai', 'ai')).toBe(true);
    });

    it('matches "bad" as standalone but not inside "badge"', () => {
        expect(matchesKeyword('this is bad', 'bad')).toBe(true);
        expect(matchesKeyword('digital badge program', 'bad')).toBe(false);
    });

    it('matches longer keywords via substring (original behavior)', () => {
        expect(matchesKeyword('i am so frustrated with this tool', 'frustrat')).toBe(true);
    });

    it('matches "vs" with boundary but not inside "canvas"', () => {
        expect(matchesKeyword('tool a vs tool b', 'vs')).toBe(true);
        expect(matchesKeyword('working on my canvas', 'vs')).toBe(false);
    });
});

describe('isNegated', () => {
    it('detects "no problem" as negated', () => {
        expect(isNegated('there is no problem here', 'problem')).toBe(true);
    });

    it('detects "not bad" as negated', () => {
        expect(isNegated('this service is not bad at all', 'bad')).toBe(true);
    });

    it('detects "pas de probleme" as negated', () => {
        expect(isNegated("il n'y a pas de probleme", 'probleme')).toBe(true);
    });

    it('does not flag non-negated terms', () => {
        expect(isNegated('this is a big problem', 'problem')).toBe(false);
    });

    it('does not flag when term is not present', () => {
        expect(isNegated('everything is fine', 'problem')).toBe(false);
    });
});

describe('quality constants', () => {
    it('MIN_KEYWORD_MATCHES_FOR_SIGNAL is at least 2', () => {
        expect(MIN_KEYWORD_MATCHES_FOR_SIGNAL).toBeGreaterThanOrEqual(2);
    });

    it('STRONG_COMPLAINT_TERMS has no overlap with WEAK_COMPLAINT_TERMS', () => {
        for (const term of STRONG_COMPLAINT_TERMS) {
            expect(WEAK_COMPLAINT_TERMS).not.toContain(term);
        }
    });

    it('STRONG + WEAK complaint terms cover the original COMPLAINT_TERMS', () => {
        const all = [...STRONG_COMPLAINT_TERMS, ...WEAK_COMPLAINT_TERMS];
        // Must include key original terms
        expect(all).toContain('frustrat');
        expect(all).toContain('problem');
        expect(all).toContain('slow');
        expect(all).toContain('expensive');
    });
});

// ──────────────────────────────────────────────────────────────
// classifyCollectionOutcome
// ──────────────────────────────────────────────────────────────

describe('classifyCollectionOutcome', () => {
    it('returns null failureClass when posts were collected', () => {
        const diags = [
            { seed: 'test', status: 'ok', results: 5 },
            {
                seed: 'test2',
                status: 'error',
                detail: 'HTTP 403',
                http_status: 403,
                failure_class: 'source_access_failure',
            },
        ];
        const result = classifyCollectionOutcome(diags, 5);
        expect(result.failureClass).toBeNull();
        expect(result.isAccessFailure).toBe(false);
    });

    it('classifies all-403 as source_access_failure', () => {
        const diags = [
            {
                seed: 'q1',
                status: 'error',
                detail: 'HTTP 403',
                http_status: 403,
                failure_class: 'source_access_failure',
            },
            {
                seed: 'q2',
                status: 'error',
                detail: 'HTTP 403',
                http_status: 403,
                failure_class: 'source_access_failure',
            },
            {
                seed: 'q3',
                status: 'error',
                detail: 'HTTP 403',
                http_status: 403,
                failure_class: 'source_access_failure',
            },
        ];
        const result = classifyCollectionOutcome(diags, 0);
        expect(result.failureClass).toBe(COLLECTION_FAILURE_CLASS.SOURCE_ACCESS_FAILURE);
        expect(result.isAccessFailure).toBe(true);
        expect(result.summary.error).toBe(3);
        expect(result.summary.ok).toBe(0);
    });

    it('classifies all-429 as source_rate_limited', () => {
        const diags = [
            { seed: 'q1', status: 'error', detail: 'HTTP 429', http_status: 429, failure_class: 'source_rate_limited' },
            { seed: 'q2', status: 'error', detail: 'HTTP 429', http_status: 429, failure_class: 'source_rate_limited' },
        ];
        const result = classifyCollectionOutcome(diags, 0);
        expect(result.failureClass).toBe(COLLECTION_FAILURE_CLASS.SOURCE_RATE_LIMITED);
        expect(result.isAccessFailure).toBe(true);
    });

    it('classifies all-ok-zero-results as seed_quality_failure', () => {
        const diags = [
            { seed: 'q1', status: 'ok', results: 0 },
            { seed: 'q2', status: 'ok', results: 0 },
        ];
        const result = classifyCollectionOutcome(diags, 0);
        expect(result.failureClass).toBe(COLLECTION_FAILURE_CLASS.SEED_QUALITY_FAILURE);
        expect(result.isAccessFailure).toBe(false);
    });

    it('classifies mixed errors + zero-results as source_access_failure when majority are access errors', () => {
        const diags = [
            {
                seed: 'q1',
                status: 'error',
                detail: 'HTTP 403',
                http_status: 403,
                failure_class: 'source_access_failure',
            },
            {
                seed: 'q2',
                status: 'error',
                detail: 'HTTP 403',
                http_status: 403,
                failure_class: 'source_access_failure',
            },
            { seed: 'q3', status: 'ok', results: 0 },
        ];
        const result = classifyCollectionOutcome(diags, 0);
        expect(result.failureClass).toBe(COLLECTION_FAILURE_CLASS.SOURCE_ACCESS_FAILURE);
        expect(result.isAccessFailure).toBe(true);
    });

    it('classifies network errors correctly', () => {
        const diags = [
            { seed: 'q1', status: 'error', detail: 'AbortError', failure_class: 'temporary_network_failure' },
            { seed: 'q2', status: 'error', detail: 'AbortError', failure_class: 'temporary_network_failure' },
        ];
        const result = classifyCollectionOutcome(diags, 0);
        expect(result.failureClass).toBe(COLLECTION_FAILURE_CLASS.TEMPORARY_NETWORK_FAILURE);
        expect(result.isAccessFailure).toBe(true);
    });

    it('handles empty diagnostics', () => {
        const result = classifyCollectionOutcome([], 0);
        expect(result.failureClass).toBe(COLLECTION_FAILURE_CLASS.UNKNOWN_COLLECTION_FAILURE);
        expect(result.isAccessFailure).toBe(false);
    });

    it('handles null diagnostics', () => {
        const result = classifyCollectionOutcome(null, 0);
        expect(result.failureClass).toBe(COLLECTION_FAILURE_CLASS.UNKNOWN_COLLECTION_FAILURE);
        expect(result.isAccessFailure).toBe(false);
    });

    it('returns error breakdown in summary', () => {
        const diags = [
            { seed: 'q1', status: 'error', http_status: 403, failure_class: 'source_access_failure' },
            { seed: 'q2', status: 'error', http_status: 429, failure_class: 'source_rate_limited' },
            { seed: 'q3', status: 'ok', results: 0 },
        ];
        const result = classifyCollectionOutcome(diags, 0);
        expect(result.summary.errorBreakdown).toEqual({
            source_access_failure: 1,
            source_rate_limited: 1,
        });
        expect(result.summary.total).toBe(3);
        expect(result.summary.ok).toBe(1);
        expect(result.summary.error).toBe(2);
    });
});

// ──────────────────────────────────────────────────────────────
// buildCollectionDiagnosis
// ──────────────────────────────────────────────────────────────

describe('buildCollectionDiagnosis', () => {
    it('returns access failure diagnosis with correct severity', () => {
        const diagnosis = buildCollectionDiagnosis(COLLECTION_FAILURE_CLASS.SOURCE_ACCESS_FAILURE, {
            ok: 0,
            error: 5,
            total: 5,
            errorBreakdown: { source_access_failure: 5 },
        });
        expect(diagnosis.severity).toBe('error');
        expect(diagnosis.isAccessFailure).toBe(true);
        expect(diagnosis.title).toContain('accès');
    });

    it('returns rate limit diagnosis with warning severity', () => {
        const diagnosis = buildCollectionDiagnosis(COLLECTION_FAILURE_CLASS.SOURCE_RATE_LIMITED, {
            ok: 0,
            error: 3,
            total: 3,
            errorBreakdown: { source_rate_limited: 3 },
        });
        expect(diagnosis.severity).toBe('warning');
        expect(diagnosis.isAccessFailure).toBe(true);
    });

    it('returns seed quality diagnosis as info', () => {
        const diagnosis = buildCollectionDiagnosis(COLLECTION_FAILURE_CLASS.SEED_QUALITY_FAILURE, {
            ok: 3,
            error: 0,
            total: 3,
            errorBreakdown: {},
        });
        expect(diagnosis.severity).toBe('info');
        expect(diagnosis.isAccessFailure).toBe(false);
    });

    it('returns no signal diagnosis as info', () => {
        const diagnosis = buildCollectionDiagnosis(COLLECTION_FAILURE_CLASS.NO_SIGNAL_FOUND, {
            ok: 3,
            error: 0,
            total: 3,
            errorBreakdown: {},
        });
        expect(diagnosis.severity).toBe('info');
        expect(diagnosis.isAccessFailure).toBe(false);
    });

    it('returns unknown failure as warning', () => {
        const diagnosis = buildCollectionDiagnosis(COLLECTION_FAILURE_CLASS.UNKNOWN_COLLECTION_FAILURE, {
            ok: 0,
            error: 2,
            total: 2,
            errorBreakdown: { unknown_collection_failure: 2 },
        });
        expect(diagnosis.severity).toBe('warning');
        expect(diagnosis.isAccessFailure).toBe(false);
    });

    it('access failure diagnosis explicitly states no market conclusion should be drawn', () => {
        const diagnosis = buildCollectionDiagnosis(COLLECTION_FAILURE_CLASS.SOURCE_ACCESS_FAILURE, {
            ok: 0,
            error: 3,
            total: 3,
            errorBreakdown: { source_access_failure: 3 },
        });
        expect(diagnosis.operatorAction).toContain('technique');
        expect(diagnosis.description).toContain('blocage technique');
    });
});

// ──────────────────────────────────────────────────────────────
// COLLECTION_FAILURE_CLASS constants
// ──────────────────────────────────────────────────────────────

describe('COLLECTION_FAILURE_CLASS', () => {
    it('exports all expected failure classes', () => {
        expect(COLLECTION_FAILURE_CLASS.SOURCE_ACCESS_FAILURE).toBe('source_access_failure');
        expect(COLLECTION_FAILURE_CLASS.SOURCE_RATE_LIMITED).toBe('source_rate_limited');
        expect(COLLECTION_FAILURE_CLASS.SOURCE_AUTH_REQUIRED).toBe('source_auth_required');
        expect(COLLECTION_FAILURE_CLASS.SEED_QUALITY_FAILURE).toBe('seed_quality_failure');
        expect(COLLECTION_FAILURE_CLASS.TEMPORARY_NETWORK_FAILURE).toBe('temporary_network_failure');
        expect(COLLECTION_FAILURE_CLASS.NO_SIGNAL_FOUND).toBe('no_signal_found');
        expect(COLLECTION_FAILURE_CLASS.UNKNOWN_COLLECTION_FAILURE).toBe('unknown_collection_failure');
    });
});
