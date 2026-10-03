import 'server-only';

import { z } from 'zod';
import { registerTask } from './registry.js';

const mentionSchema = z.object({
    mention_type: z.enum(['complaint', 'question', 'theme', 'competitor', 'recommendation', 'opportunity', 'language']),
    label: z.string().min(1).max(500),
    snippet: z.string().max(500).nullable().optional(),
    evidence_level: z.enum(['low', 'medium', 'strong']).default('low'),
    provenance: z.enum(['observed', 'derived', 'inferred']).default('derived'),
    confidence: z.enum(['high', 'medium', 'low']).default('medium').optional(),
});

// Quality gate thresholds for LLM output normalization
const MIN_LABEL_LENGTH = 3;
const MIN_SINGLE_WORD_THEME_LENGTH = 5;

const outputSchema = z.object({
    mentions: z.array(mentionSchema).default([]),
});

function buildMessages(input) {
    const { documents, clientName, businessType, competitors, mandateContext } = input;

    const docSummaries = documents.map((doc, i) => {
        const title = String(doc.title || '').trim();
        const body = String(doc.body || '').slice(0, 600).trim();
        return `--- Document ${i + 1} (id: ${doc.id}) ---\nTitle: ${title}\nBody: ${body}`;
    }).join('\n\n');

    const competitorList = (competitors || []).length > 0
        ? `Known competitors: ${competitors.join(', ')}`
        : 'No known competitors provided.';

    // Build mandate context section for richer classification
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
        if (mandateContext.seo_description) {
            mandateLines.push(`Business description: ${mandateContext.seo_description}`);
        }
    }
    const mandateSection = mandateLines.length > 0
        ? ['', 'Business context:', ...mandateLines].join('\n')
        : '';

    return [
        {
            role: 'system',
            content: [
                'You are an expert business intelligence analyst. You extract structured mentions from community documents (Reddit posts, forum threads) for operator use.',
                '',
                'Mention types:',
                '- complaint: user expressing clear dissatisfaction, frustration, or a concrete problem. Must be a genuine complaint, not a neutral mention of a topic.',
                '- question: user explicitly asking for advice, recommendations, or how-to information. Must be a real question, not a statement.',
                '- theme: recurring topic or keyword genuinely relevant to the business domain. Must be specific and actionable, not generic.',
                '- competitor: mention of a specific competing business, product, or alternative by name.',
                '- recommendation: user explicitly recommending a specific business or solution.',
                '- language: distinctive phrases or titles with high engagement that reveal user vocabulary.',
                '',
                'Quality rules (STRICT):',
                '- Only extract mentions that are genuinely, clearly present in the text. NEVER invent, exaggerate, or stretch weak signals.',
                '- A single document may produce 0 to 5 mentions — extract ONLY what is clearly there. 0 mentions is a valid and expected output for irrelevant or generic documents.',
                '- Reject generic or cosmetic mentions that would not help a business operator take action.',
                '- Do NOT tag a mention as "complaint" if the text is neutral, positive, or merely mentions a topic that could theoretically be negative.',
                '- Do NOT tag a mention as "question" if the text is a statement, opinion, or does not genuinely seek advice.',
                '- Do NOT tag generic discussion topics (e.g. "internet", "technology", "marketing") as "theme" — themes must be specific enough to be actionable.',
                '- Set evidence_level to "medium" ONLY when the signal is clear and unambiguous. Default to "low" for contextual or weak signals.',
                '- Set evidence_level to "strong" ONLY when there is explicit, direct, unambiguous evidence (e.g., "I need to hire an SEO agency in Lyon by next month").',
                '- Set provenance to "observed" for directly stated content, "derived" for patterns you infer from context.',
                '- For each mention, provide a concise label and a relevant snippet (max 300 chars) from the source text.',
                '- When business goals or topics of interest are provided, prioritize signals relevant to those goals. Ignore signals irrelevant to the business context.',
                '- Do NOT include the document id in the label or snippet.',
                '- Respond with valid JSON only. No commentary, no markdown fences.',
            ].join('\n'),
        },
        {
            role: 'user',
            content: [
                `Business: ${clientName || 'Unknown'}`,
                `Business type: ${businessType || 'Unknown'}`,
                competitorList,
                mandateSection,
                '',
                'Documents to analyze:',
                '',
                docSummaries,
                '',
                'Extract all mentions as JSON: { "mentions": [...] }',
                'Remember: 0 mentions is valid for irrelevant documents. Quality over quantity.',
            ].filter(Boolean).join('\n'),
        },
    ];
}

/**
 * Normalizes raw LLM output, attaching document-level fields after classification.
 * Returns the mentions array with document metadata attached.
 * Applies quality gates to filter out weak/malformed LLM outputs.
 */
function normalize(raw, input) {
    const mentions = raw?.mentions || [];
    const { documents, clientId, source } = input;

    // If there's only one document batch, we can map mentions back
    // For multi-doc batches, mentions are document-agnostic from the LLM
    // We attach document_id from the first doc as default, caller overrides per-mention
    const defaultDocId = documents?.[0]?.id || null;
    const defaultSource = source || documents?.[0]?.source || 'reddit';

    return mentions
        .filter((m) => {
            // Quality gate: reject mentions with empty or too-short labels
            const label = String(m.label || '').trim();
            if (label.length < MIN_LABEL_LENGTH) return false;
            // Quality gate: reject mentions with generic single-word labels
            if (label.split(/\s+/).length === 1 && label.length < MIN_SINGLE_WORD_THEME_LENGTH && m.mention_type === 'theme') return false;
            // Quality gate: reject valid-type check
            const validTypes = ['complaint', 'question', 'theme', 'competitor', 'recommendation', 'opportunity', 'language'];
            if (!validTypes.includes(m.mention_type)) return false;
            return true;
        })
        .map((m) => ({
            client_id: clientId,
            document_id: m.document_id || defaultDocId,
            mention_type: m.mention_type,
            label: String(m.label || '').slice(0, 500),
            snippet: m.snippet ? String(m.snippet).slice(0, 500) : null,
            evidence_level: m.evidence_level || 'low',
            provenance: m.provenance || 'derived',
            source: defaultSource,
        }));
}

registerTask({
    taskId: 'community-classify',
    mode: 'json',
    provider: 'mistral',
    fallbackProvider: null,
    purpose: 'query',
    temperature: 0.1,
    maxTokens: 2048,
    buildMessages,
    outputSchema,
    normalize,
});
