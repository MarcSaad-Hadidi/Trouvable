import { hostnameMatches } from './audit/url-hosts.js';

/**
 * Extrait des URLs candidates depuis une réponse texte (sources citées par le modèle).
 * Filtre les URLs manifestement non-citation (images, tracking, assets).
 */
export function extractUrlsFromText(text) {
    if (!text || typeof text !== 'string') return [];
    const urlRegex = /https?:\/\/[^\s\])"'<>]+/gi;
    const raw = text.match(urlRegex) || [];
    const cleaned = raw
        .map((u) => u.replace(/[.,;:)]+$/, ''))
        .filter((u) => !isNonCitationUrl(u));
    return [...new Set(cleaned)].slice(0, 30);
}

const NON_CITATION_PATTERNS = [
    /\.(png|jpg|jpeg|gif|svg|webp|ico|bmp|avif)(\?|$)/i,
    /\.(css|js|woff2?|ttf|eot)(\?|$)/i,
    /\.(pdf|zip|tar|gz)(\?|$)/i,
    /utm_|click_id=|fbclid=|gclid=|mc_cid=/i,
    /cdn\.|cloudfront\.net|cloudflare|fastly/i,
    /googletagmanager|google-analytics|analytics\./i,
    /facebook\.com\/tr|pixel/i,
];

function isNonCitationUrl(url) {
    return NON_CITATION_PATTERNS.some((pattern) => pattern.test(url)) || isGoogleApiAssetUrl(url);
}

export function hostnameFromUrl(url) {
    try {
        const u = new URL(url.startsWith('http') ? url : `https://${url}`);
        return normalizeDomainHost(u.hostname);
    } catch {
        return normalizeDomainHost(url.slice(0, 120));
    }
}

export function normalizeDomainHost(value) {
    if (!value) return '';
    return String(value)
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/[/?#].*$/, '')
        .replace(/:\d+$/, '')
        .replace(/\.$/, '');
}

function isGoogleApiAssetUrl(url) {
    try {
        const parsed = new URL(url);
        const hostname = normalizeDomainHost(parsed.hostname);
        if (hostnameMatches(hostname, 'fonts.googleapis.com')) return true;
        if (hostnameMatches(hostname, 'maps.googleapis.com')) return true;
        return hostnameMatches(hostname, 'googleapis.com') && /^\/(?:fonts|maps\/api)(?:\/|$)/i.test(parsed.pathname);
    } catch {
        return false;
    }
}

const SOURCE_TYPE_MAP = {
    'yelp.com': 'review_platform',
    'google.com/maps': 'review_platform',
    'tripadvisor.com': 'review_platform',
    'trustpilot.com': 'review_platform',
    'bbb.org': 'review_platform',
    'facebook.com': 'social',
    'instagram.com': 'social',
    'linkedin.com': 'social',
    'twitter.com': 'social',
    'x.com': 'social',
    'tiktok.com': 'social',
    'youtube.com': 'social',
    'reddit.com': 'forum',
    'quora.com': 'forum',
    'wikipedia.org': 'encyclopedia',
    'pagesjaunes.ca': 'directory',
    'yellowpages.ca': 'directory',
    '411.ca': 'directory',
    'canpages.ca': 'directory',
    'indeed.com': 'job_board',
    'glassdoor.com': 'job_board',
};

/**
 * Classifies a URL/domain into a source type for operator readability.
 * Returns one of: editorial, directory, review_platform, social, forum,
 * encyclopedia, government, job_board, client_own, or generic.
 */
export function classifySourceType(domain, clientDomain = null) {
    if (!domain) return 'generic';
    const normalized = normalizeDomainHost(domain);

    if (clientDomain && normalized === normalizeDomainHost(clientDomain)) {
        return 'client_own';
    }

    for (const [pattern, type] of Object.entries(SOURCE_TYPE_MAP)) {
        if (normalized.includes(pattern)) return type;
    }

    if (/\.gov\b|\.gc\.ca|\.gouv\./i.test(normalized)) return 'government';

    return 'editorial';
}

/**
 * Computes a source confidence score based on URL quality signals.
 */
export function computeSourceConfidence(url, domain, sourceType) {
    if (!url || !domain) return 0.3;

    let confidence = 0.7;

    if (sourceType === 'client_own') confidence = 0.5;
    else if (sourceType === 'review_platform') confidence = 0.9;
    else if (sourceType === 'encyclopedia') confidence = 0.85;
    else if (sourceType === 'directory') confidence = 0.8;
    else if (sourceType === 'editorial') confidence = 0.85;
    else if (sourceType === 'social') confidence = 0.65;
    else if (sourceType === 'forum') confidence = 0.6;
    else if (sourceType === 'government') confidence = 0.9;

    if (url.length > 200) confidence -= 0.1;
    if (/\d{8,}/.test(url)) confidence -= 0.05;

    return Math.max(0.2, Math.min(0.95, confidence));
}
