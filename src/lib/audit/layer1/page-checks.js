/**
 * Layer 1 deterministic page-level check registry.
 *
 * Each check produces a normalized result:
 *   { check_id, category, status: 'pass'|'warn'|'fail'|'skip', evidence, weight }
 *
 * The registry is inspired by the geodaddy-cli analyzer taxonomy (technical,
 * content, geo, ai-readiness) but remains Trouvable-native: results are raw
 * diagnostic facts, not product scores. Layer 4 consumes them via the
 * normalized audit object — never directly.
 */

const CATEGORY = {
    TECHNICAL: 'technical',
    CONTENT: 'content',
    GEO: 'geo',
    AI_READINESS: 'ai_readiness',
    TRUST: 'trust',
};

const STATUS = {
    PASS: 'pass',
    WARN: 'warn',
    FAIL: 'fail',
    SKIP: 'skip',
};

function result({ id, category, status, evidence = '', weight = 1, data = null }) {
    return {
        check_id: id,
        category,
        status,
        evidence,
        weight,
        data,
    };
}

function textOfCheerio($) {
    try {
        return ($('body').text() || '').replace(/\s+/g, ' ').trim();
    } catch {
        return '';
    }
}

function hasListiclePattern(text, $) {
    if (!text) return false;
    const lowered = text.toLowerCase();
    if (/\btop\s*\d{1,2}\b/.test(lowered)) return true;
    if (/\bbest\s+\d{1,2}\b/.test(lowered)) return true;
    if (/\b(meilleur[es]?|top)\s+\d{1,2}\b/.test(lowered)) return true;
    try {
        const numberedHeadings = $('h2, h3').filter((_, el) => /^\s*\d+[\.)\-:]/.test($(el).text() || '')).length;
        if (numberedHeadings >= 3) return true;
    } catch { /* ignore */ }
    return false;
}

function hasComparisonPattern(text) {
    if (!text) return false;
    const lowered = text.toLowerCase();
    return /\bvs\.?\b|\bversus\b|\bcompared to\b|\bcomparaison\b|\bvs\s+[a-z]/i.test(lowered);
}

function hasHowToPattern($, text) {
    if ($('[itemtype*="HowTo" i]').length > 0) return true;
    if (/how to\b|comment\s+\w+\s+/i.test(text || '')) {
        try {
            const orderedLists = $('ol').length;
            if (orderedLists > 0) return true;
        } catch { /* ignore */ }
    }
    return false;
}

function hasFreshnessSignal($, html) {
    if (!html) return false;
    if ($('time[datetime]').length > 0) return true;
    if (/datePublished|dateModified/i.test(html)) return true;
    if (/\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/.test(html)) return true;
    return false;
}

function detectAiMetaDirectives($) {
    const directives = [];
    $('meta[name], meta[http-equiv]').each((_, el) => {
        const name = String($(el).attr('name') || $(el).attr('http-equiv') || '').toLowerCase();
        const content = String($(el).attr('content') || '').toLowerCase();
        if (!name || !content) return;
        if (['googlebot', 'bingbot', 'chatgpt-user', 'gptbot', 'google-extended', 'perplexitybot', 'claudebot', 'applebot-extended', 'ccbot'].includes(name)) {
            directives.push({ name, content });
        } else if (name === 'robots') {
            if (/(noai|noimageai|noindex|nosnippet|max-snippet)/i.test(content)) {
                directives.push({ name, content });
            }
        }
    });
    return directives;
}

function detectCitationSignals(text) {
    if (!text) return { count: 0, terms: [] };
    const patterns = ['cited in', 'cite as', 'according to', 'research shows', 'selon', 'd\'apres', 'source :', 'source:', 'reference :', 'reference:'];
    const lower = text.toLowerCase();
    const matched = patterns.filter((p) => lower.includes(p));
    return { count: matched.length, terms: matched };
}

function detectEntitySignals($, schemaData) {
    const organizationCount = Array.isArray(schemaData) ? schemaData.filter((entry) => {
        const t = String(entry?.['@type'] || entry?.type || '').toLowerCase();
        return /organization|localbusiness|person|product|service/.test(t);
    }).length : 0;
    const hasSameAs = $('[itemprop="sameAs"]').length > 0;
    return { organization_entities: organizationCount, has_same_as: hasSameAs };
}

/**
 * Run the deterministic page-level check registry for one page.
 *
 * @param {object} ctx
 * @param {import('cheerio').CheerioAPI} ctx.$
 * @param {string} ctx.pageUrl
 * @param {string} ctx.html
 * @param {object} ctx.meta — already-extracted page metadata
 *    { title, description, h1s, canonical, hasNoindex, wordCount, pageType,
 *      schemaData, hasFaqSchema, hasLocalBusinessSchema, hasOrganizationSchema,
 *      hydrationHints, httpStatus }
 * @returns {Array<object>} normalized check results
 */
export function runPageChecks({ $, pageUrl, html, meta }) {
    const checks = [];
    if (!$ || !pageUrl) return checks;

    const bodyText = textOfCheerio($);
    const isHttps = pageUrl.startsWith('https://');
    checks.push(result({
        id: 'technical.https',
        category: CATEGORY.TECHNICAL,
        status: isHttps ? STATUS.PASS : STATUS.FAIL,
        evidence: isHttps ? 'Page served over HTTPS.' : 'Page not served over HTTPS.',
        weight: 2,
    }));

    const titleLen = (meta.title || '').length;
    checks.push(result({
        id: 'content.title',
        category: CATEGORY.CONTENT,
        status: titleLen >= 10 && titleLen <= 70 ? STATUS.PASS : titleLen > 0 ? STATUS.WARN : STATUS.FAIL,
        evidence: titleLen > 0 ? `Title length ${titleLen} char(s).` : 'Missing <title>.',
        weight: 2,
        data: { length: titleLen },
    }));

    const descLen = (meta.description || '').length;
    checks.push(result({
        id: 'content.meta_description',
        category: CATEGORY.CONTENT,
        status: descLen >= 70 && descLen <= 180 ? STATUS.PASS : descLen > 0 ? STATUS.WARN : STATUS.FAIL,
        evidence: descLen > 0 ? `Description length ${descLen} char(s).` : 'Missing meta description.',
        weight: 1,
        data: { length: descLen },
    }));

    const h1Count = Array.isArray(meta.h1s) ? meta.h1s.length : 0;
    checks.push(result({
        id: 'content.h1',
        category: CATEGORY.CONTENT,
        status: h1Count === 1 ? STATUS.PASS : h1Count === 0 ? STATUS.FAIL : STATUS.WARN,
        evidence: `${h1Count} <h1> element(s) on page.`,
        weight: 1,
        data: { count: h1Count },
    }));

    checks.push(result({
        id: 'technical.canonical',
        category: CATEGORY.TECHNICAL,
        status: meta.canonical ? STATUS.PASS : STATUS.WARN,
        evidence: meta.canonical ? `Canonical URL set to ${meta.canonical}.` : 'No canonical URL declared.',
        weight: 1,
    }));

    checks.push(result({
        id: 'technical.indexability',
        category: CATEGORY.TECHNICAL,
        status: meta.hasNoindex ? STATUS.FAIL : STATUS.PASS,
        evidence: meta.hasNoindex ? 'Page blocks indexing via noindex.' : 'Page is indexable.',
        weight: 2,
    }));

    const heading2Count = $('h2').length;
    const heading3Count = $('h3').length;
    checks.push(result({
        id: 'content.heading_structure',
        category: CATEGORY.CONTENT,
        status: heading2Count >= 2 ? STATUS.PASS : heading2Count >= 1 ? STATUS.WARN : STATUS.FAIL,
        evidence: `${heading2Count} <h2>, ${heading3Count} <h3>.`,
        weight: 1,
        data: { h2: heading2Count, h3: heading3Count },
    }));

    const wordCount = Number(meta.wordCount || 0);
    checks.push(result({
        id: 'content.substance',
        category: CATEGORY.CONTENT,
        status: wordCount >= 350 ? STATUS.PASS : wordCount >= 120 ? STATUS.WARN : STATUS.FAIL,
        evidence: `${wordCount} words of extracted body text.`,
        weight: 1,
        data: { word_count: wordCount },
    }));

    const hasSchema = Array.isArray(meta.schemaData) && meta.schemaData.length > 0;
    const schemaTypes = hasSchema ? meta.schemaData.map((entry) => String(entry?.['@type'] || entry?.type || '')).filter(Boolean) : [];
    checks.push(result({
        id: 'ai_readiness.schema_stacking',
        category: CATEGORY.AI_READINESS,
        status: schemaTypes.length >= 2 ? STATUS.PASS : schemaTypes.length === 1 ? STATUS.WARN : STATUS.FAIL,
        evidence: schemaTypes.length ? `Schema types detected: ${schemaTypes.slice(0, 4).join(', ')}.` : 'No JSON-LD schema detected.',
        weight: 2,
        data: { types: schemaTypes.slice(0, 10) },
    }));

    checks.push(result({
        id: 'ai_readiness.faq_schema',
        category: CATEGORY.AI_READINESS,
        status: meta.hasFaqSchema ? STATUS.PASS : STATUS.WARN,
        evidence: meta.hasFaqSchema ? 'FAQ schema present.' : 'No FAQ schema detected on page.',
        weight: 1,
    }));

    const listicle = hasListiclePattern(bodyText, $);
    checks.push(result({
        id: 'ai_readiness.listicle_pattern',
        category: CATEGORY.AI_READINESS,
        status: listicle ? STATUS.PASS : STATUS.WARN,
        evidence: listicle ? 'Listicle / top-N / numbered heading pattern detected.' : 'No listicle / top-N pattern detected.',
        weight: 1,
    }));

    const comparison = hasComparisonPattern(bodyText);
    checks.push(result({
        id: 'ai_readiness.comparison_pattern',
        category: CATEGORY.AI_READINESS,
        status: comparison ? STATUS.PASS : STATUS.SKIP,
        evidence: comparison ? 'Comparison ("vs" / "compared to") pattern detected.' : 'No comparison pattern detected.',
        weight: 1,
    }));

    const howto = hasHowToPattern($, bodyText);
    checks.push(result({
        id: 'ai_readiness.howto_pattern',
        category: CATEGORY.AI_READINESS,
        status: howto ? STATUS.PASS : STATUS.SKIP,
        evidence: howto ? 'HowTo schema or ordered procedural content detected.' : 'No HowTo pattern detected.',
        weight: 1,
    }));

    const freshness = hasFreshnessSignal($, html);
    checks.push(result({
        id: 'ai_readiness.freshness',
        category: CATEGORY.AI_READINESS,
        status: freshness ? STATUS.PASS : STATUS.WARN,
        evidence: freshness ? 'Date / freshness signal detected.' : 'No date or freshness signal detected.',
        weight: 1,
    }));

    const aiDirectives = detectAiMetaDirectives($);
    const blockingDirective = aiDirectives.find((d) => /(noai|noindex|none)/.test(d.content));
    checks.push(result({
        id: 'ai_readiness.meta_directives',
        category: CATEGORY.AI_READINESS,
        status: blockingDirective ? STATUS.FAIL : aiDirectives.length ? STATUS.WARN : STATUS.PASS,
        evidence: blockingDirective
            ? `Blocking AI directive: ${blockingDirective.name}=${blockingDirective.content}`
            : aiDirectives.length
              ? `AI-targeted meta directives present: ${aiDirectives.map((d) => `${d.name}=${d.content}`).slice(0, 3).join('; ')}`
              : 'No AI-blocking meta directives detected.',
        weight: 2,
        data: { directives: aiDirectives.slice(0, 8) },
    }));

    const citations = detectCitationSignals(bodyText);
    checks.push(result({
        id: 'ai_readiness.citation_signals',
        category: CATEGORY.AI_READINESS,
        status: citations.count >= 2 ? STATUS.PASS : citations.count === 1 ? STATUS.WARN : STATUS.SKIP,
        evidence: citations.count ? `Citation signals: ${citations.terms.slice(0, 4).join(', ')}` : 'No explicit citation language detected.',
        weight: 1,
        data: citations,
    }));

    const entities = detectEntitySignals($, meta.schemaData);
    checks.push(result({
        id: 'ai_readiness.entity_signals',
        category: CATEGORY.AI_READINESS,
        status: entities.organization_entities >= 1 ? STATUS.PASS : STATUS.WARN,
        evidence: entities.organization_entities
            ? `${entities.organization_entities} organization-style entity in structured data.`
            : 'No Organization/LocalBusiness/Product entity detected.',
        weight: 1,
        data: entities,
    }));

    const wordsPerSentence = (() => {
        const sentences = (bodyText.match(/[.!?]+\s|\n/g) || []).length + 1;
        if (sentences === 0 || wordCount === 0) return 0;
        return wordCount / sentences;
    })();
    const queryOptimized = wordsPerSentence > 0 && wordsPerSentence <= 26 && (
        bodyText.toLowerCase().includes('?') ||
        /^(what|how|why|when|where|can|should|comment|pourquoi|quand|que|quelle?|ou)\b/i.test(meta.title || '')
    );
    checks.push(result({
        id: 'ai_readiness.query_optimization',
        category: CATEGORY.AI_READINESS,
        status: queryOptimized ? STATUS.PASS : STATUS.WARN,
        evidence: queryOptimized
            ? 'Query-shaped title or question-oriented copy detected.'
            : 'No query-optimized title or question-rich content detected.',
        weight: 1,
        data: { words_per_sentence: Math.round(wordsPerSentence * 10) / 10 },
    }));

    const hydrationHints = Array.isArray(meta.hydrationHints) ? meta.hydrationHints : [];
    if (hydrationHints.length > 0 && wordCount < 120) {
        checks.push(result({
            id: 'technical.render_dependency',
            category: CATEGORY.TECHNICAL,
            status: STATUS.WARN,
            evidence: `Thin static HTML with hydration hints: ${hydrationHints.slice(0, 3).join(', ')}`,
            weight: 1,
            data: { hydration_hints: hydrationHints },
        }));
    }

    return checks;
}

export const PAGE_CHECK_CATEGORIES = CATEGORY;
export const PAGE_CHECK_STATUS = STATUS;
