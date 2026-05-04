import { fetchPublicResource } from './url-safety.js';

const FETCH_TIMEOUT_MS = 8000;

const AI_CRAWLERS = {
    critical: [
        { name: 'GPTBot', service: 'OpenAI (training + ChatGPT search)' },
        { name: 'OAI-SearchBot', service: 'OpenAI (search-only)' },
        { name: 'ChatGPT-User', service: 'ChatGPT browsing mode' },
        { name: 'ClaudeBot', service: 'Anthropic / Claude' },
        { name: 'PerplexityBot', service: 'Perplexity AI search' },
    ],
    secondary: [
        { name: 'Amazonbot', service: 'Amazon / Alexa AI' },
        { name: 'Google-Extended', service: 'Google Gemini training' },
        { name: 'Bytespider', service: 'ByteDance / TikTok AI' },
        { name: 'CCBot', service: 'Common Crawl' },
        { name: 'Applebot-Extended', service: 'Apple Intelligence' },
        { name: 'FacebookBot', service: 'Meta AI' },
        { name: 'Cohere-ai', service: 'Cohere models' },
    ],
};

const CRAWLER_STATUS = {
    ALLOWED: 'allowed',
    BLOCKED: 'blocked',
    RESTRICTED: 'restricted',
    UNKNOWN: 'unknown',
};

function normalizeAgentKey(value) {
    if (typeof value !== 'string') return '';
    const normalized = value.trim().toLowerCase();
    return normalized || '';
}

async function fetchTextResource(url) {
    try {
        const response = await fetchPublicResource(url, {
            timeoutMs: FETCH_TIMEOUT_MS,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, TrouvableAuditBot/3.0)',
                Accept: 'text/plain, text/html, */*',
            },
        });
        if (!response.ok) return null;
        const text = await response.text();
        return text || null;
    } catch {
        return null;
    }
}

function parseRobotsTxt(robotsTxt) {
    if (!robotsTxt || typeof robotsTxt !== 'string') return { rules: {}, hasSitemap: false };

    const lines = robotsTxt.split(/\r?\n/);
    const rules = {};
    let currentAgents = [];
    let hasSitemap = false;
    let collectingAgents = false;

    for (const rawLine of lines) {
        const line = rawLine.split('#')[0].trim();
        if (!line) continue;

        const [directive, ...rest] = line.split(':');
        const key = directive.trim().toLowerCase();
        const value = rest.join(':').trim();

        if (key === 'sitemap') {
            hasSitemap = true;
            continue;
        }

        if (key === 'user-agent') {
            const agentKey = normalizeAgentKey(value);
            if (!agentKey) continue;

            if (!collectingAgents) currentAgents = [];
            collectingAgents = true;

            if (!currentAgents.includes(agentKey)) currentAgents.push(agentKey);
            if (!rules[agentKey]) {
                rules[agentKey] = {
                    key: agentKey,
                    label: value.trim() || agentKey,
                    disallow: [],
                    allow: [],
                    crawlDelay: null,
                };
            }
            continue;
        }

        if (!currentAgents.length) continue;
        collectingAgents = false;

        for (const agent of currentAgents) {
            if (!rules[agent]) {
                rules[agent] = {
                    key: agent,
                    label: agent,
                    disallow: [],
                    allow: [],
                    crawlDelay: null,
                };
            }
            if (key === 'disallow' && value) {
                rules[agent].disallow.push(value);
            } else if (key === 'allow' && value) {
                rules[agent].allow.push(value);
            } else if (key === 'crawl-delay' && value) {
                const parsed = parseInt(value, 10);
                if (!isNaN(parsed) && parsed > 0) rules[agent].crawlDelay = parsed;
            }
        }
    }

    return { rules, hasSitemap };
}

function getCrawlerRuleEvaluation(crawlerName, parsedRobots) {
    const { rules } = parsedRobots;

    const crawlerKey = normalizeAgentKey(crawlerName);
    const crawlerRules = rules[crawlerKey];
    const wildcardRules = rules['*'];

    const effectiveRules = crawlerRules || wildcardRules;

    if (!effectiveRules) {
        return {
            status: CRAWLER_STATUS.UNKNOWN,
            matchedBy: 'none',
            ruleLabel: null,
            disallow: [],
            allow: [],
            crawlDelay: null,
        };
    }

    const disallow = Array.isArray(effectiveRules.disallow) ? effectiveRules.disallow : [];
    const allow = Array.isArray(effectiveRules.allow) ? effectiveRules.allow : [];
    const hasRootBlock = disallow.includes('/');
    const hasSpecificBlocks = disallow.length > 0;
    const hasAllows = allow.length > 0;

    let status = CRAWLER_STATUS.ALLOWED;
    if (hasRootBlock && !hasAllows) status = CRAWLER_STATUS.BLOCKED;
    else if (hasRootBlock && hasAllows) status = CRAWLER_STATUS.RESTRICTED;
    else if (hasSpecificBlocks && !hasRootBlock) status = CRAWLER_STATUS.RESTRICTED;

    return {
        status,
        matchedBy: crawlerRules ? 'specific' : 'wildcard',
        ruleLabel: effectiveRules.label || effectiveRules.key || null,
        disallow,
        allow,
        crawlDelay: effectiveRules.crawlDelay ?? null,
    };
}

function getCrawlerStatus(crawlerName, parsedRobots) {
    return getCrawlerRuleEvaluation(crawlerName, parsedRobots).status;
}

function scoreCrawlerAccess(crawlerStatuses) {
    let score = 100;

    for (const [, entry] of Object.entries(crawlerStatuses)) {
        if (entry.status === CRAWLER_STATUS.BLOCKED) {
            score -= entry.tier === 'critical' ? 15 : 5;
        } else if (entry.status === CRAWLER_STATUS.RESTRICTED) {
            score -= entry.tier === 'critical' ? 8 : 3;
        }
    }

    return Math.max(0, score);
}

function validateLlmsTxt(content) {
    if (!content || typeof content !== 'string') return { valid: false, reason: 'empty' };

    const lines = content.trim().split(/\r?\n/);
    if (lines.length === 0) return { valid: false, reason: 'empty' };

    const firstLine = lines[0].trim();
    if (!firstLine.startsWith('# ')) return { valid: false, reason: 'missing_h1' };

    const hasH2 = lines.some((line) => line.trim().startsWith('## '));
    const hasLinks = lines.some((line) => /\[.+\]\(.+\)/.test(line));

    if (!hasH2 && !hasLinks) return { valid: true, reason: 'minimal' };
    if (hasH2 && hasLinks) return { valid: true, reason: 'complete' };

    return { valid: true, reason: 'partial' };
}

function scoreLlmsTxt(status) {
    if (!status.found) return 0;
    if (!status.validation.valid) return 30;
    if (status.validation.reason === 'minimal') return 50;
    if (status.validation.reason === 'partial') return 60;
    if (status.validation.reason === 'complete' && status.hasFullVersion) return 95;
    if (status.validation.reason === 'complete') return 80;
    return 50;
}

export async function analyzeCrawlerAccess(siteUrl) {
    let origin;
    try {
        const parsed = new URL(siteUrl);
        origin = parsed.origin;
    } catch {
        return createEmptyResult('invalid_url');
    }

    const robotsUrl = `${origin}/robots.txt`;
    const llmsTxtUrl = `${origin}/llms.txt`;
    const llmsFullTxtUrl = `${origin}/llms-full.txt`;

    const [robotsTxt, llmsTxt, llmsFullTxt] = await Promise.all([
        fetchTextResource(robotsUrl),
        fetchTextResource(llmsTxtUrl),
        fetchTextResource(llmsFullTxtUrl),
    ]);

    const parsedRobots = parseRobotsTxt(robotsTxt);

    const crawlerStatuses = {};
    for (const crawler of AI_CRAWLERS.critical) {
        const evaluation = getCrawlerRuleEvaluation(crawler.name, parsedRobots);
        crawlerStatuses[crawler.name] = {
            name: crawler.name,
            service: crawler.service,
            tier: 'critical',
            status: evaluation.status,
            matchedBy: evaluation.matchedBy,
            ruleLabel: evaluation.ruleLabel,
            disallow: evaluation.disallow,
            allow: evaluation.allow,
            crawlDelay: evaluation.crawlDelay,
        };
    }
    for (const crawler of AI_CRAWLERS.secondary) {
        const evaluation = getCrawlerRuleEvaluation(crawler.name, parsedRobots);
        crawlerStatuses[crawler.name] = {
            name: crawler.name,
            service: crawler.service,
            tier: 'secondary',
            status: evaluation.status,
            matchedBy: evaluation.matchedBy,
            ruleLabel: evaluation.ruleLabel,
            disallow: evaluation.disallow,
            allow: evaluation.allow,
            crawlDelay: evaluation.crawlDelay,
        };
    }

    const crawlerAccessScore = scoreCrawlerAccess(crawlerStatuses);

    const blockedCritical = Object.values(crawlerStatuses).filter((c) => c.tier === 'critical' && c.status === CRAWLER_STATUS.BLOCKED);
    const blockedSecondary = Object.values(crawlerStatuses).filter((c) => c.tier === 'secondary' && c.status === CRAWLER_STATUS.BLOCKED);

    const llmsTxtStatus = {
        found: llmsTxt !== null,
        hasFullVersion: llmsFullTxt !== null,
        validation: llmsTxt !== null ? validateLlmsTxt(llmsTxt) : { valid: false, reason: 'absent' },
    };
    const llmsTxtScore = scoreLlmsTxt(llmsTxtStatus);

    return {
        observedAt: new Date().toISOString(),
        robotsTxtFound: robotsTxt !== null,
        robotsHasSitemap: parsedRobots.hasSitemap,
        robotsRules: parsedRobots.rules,
        crawlerStatuses,
        crawlerAccessScore,
        blockedCriticalCount: blockedCritical.length,
        blockedSecondaryCount: blockedSecondary.length,
        blockedCriticalNames: blockedCritical.map((c) => c.name),
        llmsTxt: llmsTxtStatus,
        llmsTxtScore,
        fetchError: null,
    };
}

function createEmptyResult(reason) {
    const crawlerStatuses = {};
    for (const crawler of [...AI_CRAWLERS.critical, ...AI_CRAWLERS.secondary]) {
        crawlerStatuses[crawler.name] = {
            name: crawler.name,
            service: crawler.service,
            tier: AI_CRAWLERS.critical.some((c) => c.name === crawler.name) ? 'critical' : 'secondary',
            status: CRAWLER_STATUS.UNKNOWN,
        };
    }
    return {
        observedAt: new Date().toISOString(),
        robotsTxtFound: false,
        robotsHasSitemap: false,
        robotsRules: {},
        crawlerStatuses,
        crawlerAccessScore: 100,
        blockedCriticalCount: 0,
        blockedSecondaryCount: 0,
        blockedCriticalNames: [],
        llmsTxt: { found: false, hasFullVersion: false, validation: { valid: false, reason: 'absent' } },
        llmsTxtScore: 0,
        fetchError: reason || 'fetch_failed',
    };
}

export { AI_CRAWLERS, CRAWLER_STATUS, parseRobotsTxt, getCrawlerRuleEvaluation, getCrawlerStatus, validateLlmsTxt, scoreLlmsTxt };
