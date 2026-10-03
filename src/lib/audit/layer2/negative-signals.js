/**
 * Layer 2 negative / manipulation signal detection.
 *
 * Scans already-extracted page payloads (HTML snippets, text chunks, meta
 * directives) for patterns that hurt AI answerability or indicate attempted
 * prompt injection against AI assistants that crawl the site.
 *
 * Signals detected (presence only, not quantified punitively by Layer 4):
 *   - AI-blocking meta directives (noai, google-extended=noindex, etc.)
 *   - prompt injection strings targeting LLM scraping ("ignore previous")
 *   - cloaked or invisible text likely pushed at AI assistants
 *   - excessive boilerplate duplication across pages
 */

const PROMPT_INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /disregard\s+the\s+above/i,
    /you\s+are\s+now\s+(a|an)\s+/i,
    /system\s*:\s*you\s+must/i,
    /<system>[\s\S]{0,80}<\/system>/i,
    /\[\s*internal\s+note[\s\S]{0,80}\]/i,
];

const CLOAKING_CLASS_PATTERN = /class\s*=\s*["'][^"']*(sr-only|visually-hidden|hidden-for-humans|ai-only)[^"']*["']/i;
const AI_HIDDEN_ATTR_PATTERN = /aria-hidden\s*=\s*"true"[\s>]/i;

function normalizeText(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/\s+/g, ' ').trim();
}

function collectAllText(extracted) {
    const chunks = Array.isArray(extracted?.text_chunks) ? extracted.text_chunks : [];
    return normalizeText(chunks.join('\n'));
}

function collectAllRawHtml(pageSummaries) {
    const parts = [];
    for (const page of pageSummaries || []) {
        if (typeof page?.raw_html_sample === 'string') parts.push(page.raw_html_sample);
    }
    return parts.join('\n');
}

export function auditNegativeSignals({ extracted, scannedPages = [], layer1PageChecks = [] }) {
    const findings = [];
    const text = collectAllText(extracted);
    const htmlSample = collectAllRawHtml(extracted?.page_summaries || []);

    const injectionMatches = [];
    for (const pattern of PROMPT_INJECTION_PATTERNS) {
        const match = text.match(pattern) || htmlSample.match(pattern);
        if (match) injectionMatches.push(match[0].slice(0, 160));
    }

    if (injectionMatches.length > 0) {
        findings.push({
            id: 'negative.prompt_injection_detected',
            severity: 'high',
            message: `Prompt-injection style phrases detected: ${injectionMatches.slice(0, 2).join(' | ')}`,
        });
    }

    const blockingDirectives = [];
    for (const pageResult of layer1PageChecks) {
        for (const check of pageResult?.checks || []) {
            if (check.check_id === 'ai_readiness.meta_directives' && check.status === 'fail') {
                const directives = check.data?.directives || [];
                for (const directive of directives) {
                    if (/(noai|noindex|none)/i.test(directive.content || '')) {
                        blockingDirectives.push({ page: pageResult.page_url, name: directive.name, content: directive.content });
                    }
                }
            }
        }
    }
    if (blockingDirectives.length > 0) {
        findings.push({
            id: 'negative.ai_blocking_directives',
            severity: 'high',
            message: `${blockingDirectives.length} page(s) declare AI-blocking meta directives.`,
        });
    }

    const cloaked = CLOAKING_CLASS_PATTERN.test(htmlSample) || AI_HIDDEN_ATTR_PATTERN.test(htmlSample);
    if (cloaked) {
        findings.push({
            id: 'negative.potential_cloaking',
            severity: 'low',
            message: 'Visually hidden containers detected; verify they do not contain AI-targeted content.',
        });
    }

    const pageCount = (scannedPages || []).filter((p) => p?.success).length;
    const duplicationIndicator = detectBoilerplateDuplication(extracted?.page_summaries || [], pageCount);
    if (duplicationIndicator.duplicated_pct > 0.65 && pageCount >= 4) {
        findings.push({
            id: 'negative.heavy_boilerplate',
            severity: 'low',
            message: `High boilerplate overlap between pages (${Math.round(duplicationIndicator.duplicated_pct * 100)}% shared text).`,
        });
    }

    let score = 100;
    score -= findings.filter((f) => f.severity === 'high').length * 30;
    score -= findings.filter((f) => f.severity === 'medium').length * 12;
    score -= findings.filter((f) => f.severity === 'low').length * 5;
    score = Math.max(0, Math.min(100, score));

    return {
        score,
        findings,
        details: {
            prompt_injection_matches: injectionMatches.length,
            ai_blocking_directive_pages: blockingDirectives.length,
            potential_cloaking: cloaked,
            duplication: duplicationIndicator,
        },
    };
}

function detectBoilerplateDuplication(pageSummaries, pageCount) {
    if (!Array.isArray(pageSummaries) || pageSummaries.length < 3) {
        return { duplicated_pct: 0 };
    }
    const fingerprintCounts = new Map();
    for (const page of pageSummaries) {
        const chunk = normalizeText(page?.description || page?.title || '').slice(0, 140).toLowerCase();
        if (!chunk) continue;
        fingerprintCounts.set(chunk, (fingerprintCounts.get(chunk) || 0) + 1);
    }
    let duplicated = 0;
    for (const count of fingerprintCounts.values()) {
        if (count > 1) duplicated += count;
    }
    if (pageCount === 0) return { duplicated_pct: 0 };
    return { duplicated_pct: duplicated / pageCount };
}
