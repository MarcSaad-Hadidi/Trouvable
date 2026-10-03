import 'server-only';

import { z } from 'zod';
import { registerTask } from './registry.js';

const labelEntrySchema = z.object({
    original: z.string(),
    normalized: z.string(),
    cluster_type: z.string(),
    is_duplicate_of: z.string().nullable().optional(),
});

const outputSchema = z.object({
    labels: z.array(labelEntrySchema).default([]),
});

function buildMessages(input) {
    const { clusters } = input;

    const clusterList = clusters.map((c, i) =>
        `${i + 1}. [${c.cluster_type}] "${c.label}" (${c.mention_count} mentions)`
    ).join('\n');

    return [
        {
            role: 'system',
            content: [
                'You are a data normalization specialist.',
                'Your task is to normalize and deduplicate cluster labels from community intelligence data.',
                '',
                'Rules:',
                '- Normalize labels to a clean, canonical form (fix casing, remove noise, standardize terminology).',
                '- Identify duplicates: labels that refer to the same concept should have is_duplicate_of set to the preferred canonical form.',
                '- Preserve the original meaning — do NOT merge labels that are genuinely different topics.',
                '- Keep labels concise (2-6 words ideal).',
                '- Use lowercase for normalized labels.',
                '- For French labels, preserve French; for English labels, preserve English.',
                '- Respond with valid JSON only. No commentary.',
            ].join('\n'),
        },
        {
            role: 'user',
            content: [
                'Normalize these cluster labels:',
                '',
                clusterList,
                '',
                'Respond as JSON: { "labels": [{ "original": "...", "normalized": "...", "cluster_type": "...", "is_duplicate_of": null | "canonical" }] }',
            ].join('\n'),
        },
    ];
}

function normalize(raw) {
    const labels = raw?.labels || [];
    return labels.map((entry) => ({
        original: String(entry.original || ''),
        normalized: String(entry.normalized || entry.original || '').toLowerCase().trim(),
        cluster_type: String(entry.cluster_type || ''),
        is_duplicate_of: entry.is_duplicate_of || null,
    }));
}

registerTask({
    taskId: 'community-labels',
    mode: 'json',
    provider: 'mistral',
    fallbackProvider: null,
    purpose: 'query',
    temperature: 0.05,
    maxTokens: 1500,
    buildMessages,
    outputSchema,
    normalize,
});
