import 'server-only';

import { z } from 'zod';
import { registerTask } from './registry.js';

const VALID_OPPORTUNITY_TYPES = [
    'response', 'faq', 'content', 'differentiation',
    'recurring_buyer_question', 'comparison_discussion', 'recurring_pain_point',
    'response_opportunity', 'ai_mention_opportunity', 'content_opportunity',
];

// Quality gate thresholds for LLM output normalization
const MIN_HEADLINE_LENGTH = 5;
const MIN_RATIONALE_LENGTH = 10;
const MAX_OPPORTUNITIES = 8;

const opportunitySchema = z.object({
    cluster_label: z.string(),
    cluster_type: z.string(),
    opportunity_type: z.enum(VALID_OPPORTUNITY_TYPES),
    headline: z.string().min(1).max(200),
    rationale: z.string().min(1).max(500),
    suggested_action: z.string().min(1).max(500),
    why_it_matters: z.string().max(500).optional(),
    priority: z.enum(['high', 'medium', 'low']),
    evidence_strength: z.enum(['strong', 'moderate', 'weak']),
    confidence: z.enum(['high', 'medium', 'low']).default('medium').optional(),
});

const outputSchema = z.object({
    opportunities: z.array(opportunitySchema).default([]),
});

function buildMessages(input) {
    const { clientName, businessType, clusters, mandateContext } = input;

    const clusterSummary = clusters.map((c, i) =>
        `${i + 1}. [${c.cluster_type}] "${c.label}" — ${c.mention_count} mentions, sources: ${c.sources?.join(', ') || 'unknown'}${c.signal_families?.length ? `, signals: ${c.signal_families.join(', ')}` : ''}`
    ).join('\n');

    // Build mandate context for richer synthesis
    const mandateLines = [];
    if (mandateContext) {
        if (mandateContext.goals?.length > 0) {
            mandateLines.push(`Business goals: ${mandateContext.goals.join(', ')}`);
        }
        if (mandateContext.monitored_topics?.length > 0) {
            mandateLines.push(`Topics of interest: ${mandateContext.monitored_topics.join(', ')}`);
        }
        if (mandateContext.target_customer_description) {
            mandateLines.push(`Target customers: ${mandateContext.target_customer_description}`);
        }
        if (mandateContext.businessDesc) {
            mandateLines.push(`Business description: ${mandateContext.businessDesc}`);
        }
        if (mandateContext.city) {
            mandateLines.push(`Location: ${mandateContext.city}`);
        }
    }
    const mandateSection = mandateLines.length > 0
        ? ['', 'Business context:', ...mandateLines].join('\n')
        : '';

    return [
        {
            role: 'system',
            content: [
                'You are an expert business strategist specializing in local business visibility and reputation.',
                'Your task is to synthesize raw community intelligence clusters into actionable operator opportunities.',
                '',
                'Quality rules (STRICT):',
                '- Each opportunity MUST be grounded in the cluster data provided. Do NOT invent signals or stretch weak evidence.',
                '- Do NOT produce opportunities from weak, generic, or cosmetic clusters. If a cluster is too vague to act on, SKIP it.',
                '- Only produce opportunities that a business operator could realistically act on within 1-2 weeks.',
                '- headline: one-line operator-facing summary (clear, direct, jargon-free, max 200 chars).',
                '- rationale: 1-2 sentences explaining why this matters for THIS SPECIFIC business, referencing the evidence.',
                '- suggested_action: concrete, specific next step the operator can take. NOT generic advice like "create content" or "improve SEO".',
                '- why_it_matters: 1 sentence explaining the business impact (optional but preferred).',
                '- priority: based on mention volume AND business impact (high = many mentions + high impact + clear intent).',
                '- evidence_strength: strong (10+ mentions, consistent pattern), moderate (3-9 mentions, clear signal), weak (1-2 mentions, contextual).',
                '- Do NOT produce more than 8 opportunities total. Quality over quantity.',
                '- opportunity_type must be one of: response, faq, content, differentiation, recurring_buyer_question, comparison_discussion, recurring_pain_point, response_opportunity, ai_mention_opportunity, content_opportunity.',
                '- Use expanded types when appropriate: recurring_buyer_question for buyer questions, comparison_discussion for vs/compare threads, recurring_pain_point for strong pain signals, response_opportunity for direct reply threads, ai_mention_opportunity for AI-related topics, content_opportunity for general content angles.',
                '- Write in the same language as the cluster labels (French if labels are French).',
                '- Respond with valid JSON only. No commentary.',
            ].join('\n'),
        },
        {
            role: 'user',
            content: [
                `Business: ${clientName || 'Unknown'} (${businessType || 'local business'})`,
                mandateSection,
                '',
                'Community clusters:',
                clusterSummary,
                '',
                'Synthesize into opportunities as JSON: { "opportunities": [...] }',
                'Remember: skip weak clusters. Produce fewer, stronger, more actionable opportunities.',
            ].filter(Boolean).join('\n'),
        },
    ];
}

function normalize(raw, input) {
    const opportunities = raw?.opportunities || [];

    return opportunities
        .filter((opp) => {
            // Quality gate: reject opportunities with empty/short headlines
            const headline = String(opp.headline || '').trim();
            if (headline.length < MIN_HEADLINE_LENGTH) return false;
            // Quality gate: reject opportunities with empty rationale
            const rationale = String(opp.rationale || '').trim();
            if (rationale.length < MIN_RATIONALE_LENGTH) return false;
            return true;
        })
        .slice(0, MAX_OPPORTUNITIES)
        .map((opp) => ({
            cluster_label: String(opp.cluster_label || ''),
            cluster_type: String(opp.cluster_type || ''),
            opportunity_type: VALID_OPPORTUNITY_TYPES.includes(opp.opportunity_type) ? opp.opportunity_type : 'content',
            headline: String(opp.headline || '').slice(0, 200),
            rationale: String(opp.rationale || '').slice(0, 500),
            suggested_action: String(opp.suggested_action || '').slice(0, 500),
            why_it_matters: opp.why_it_matters ? String(opp.why_it_matters).slice(0, 500) : null,
            priority: ['high', 'medium', 'low'].includes(opp.priority) ? opp.priority : 'medium',
            evidence_strength: ['strong', 'moderate', 'weak'].includes(opp.evidence_strength) ? opp.evidence_strength : 'weak',
            client_id: input?.clientId || null,
        }));
}

registerTask({
    taskId: 'community-synthesize',
    mode: 'json',
    provider: 'mistral',
    fallbackProvider: null,
    purpose: 'query',
    temperature: 0.3,
    maxTokens: 3000,
    buildMessages,
    outputSchema,
    normalize,
});
