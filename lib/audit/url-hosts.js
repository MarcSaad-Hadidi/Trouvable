const BLOCKED_NAVIGATION_SCHEMES = ['java' + 'script:', 'data:', 'vbscript:'];

export function hasBlockedNavigationScheme(value) {
    if (typeof value !== 'string') return false;
    const normalized = value.trim().replace(/[\u0000-\u001F\u007F\s]+/g, '').toLowerCase();
    return BLOCKED_NAVIGATION_SCHEMES.some((scheme) => normalized.startsWith(scheme));
}

export function normalizeHostname(value) {
    if (!value) return '';
    return String(value)
        .trim()
        .toLowerCase()
        .replace(/\.$/, '')
        .replace(/^www\./, '');
}

export function hostnameFromInput(value, baseHref = null) {
    if (!value || typeof value !== 'string') return '';
    try {
        const parsed = baseHref ? new URL(value, baseHref) : new URL(value);
        return normalizeHostname(parsed.hostname);
    } catch {
        try {
            const parsed = new URL(`https://${value}`);
            return normalizeHostname(parsed.hostname);
        } catch {
            return normalizeHostname(value.replace(/[/?#].*$/, '').replace(/:\d+$/, ''));
        }
    }
}

export function hostnameMatches(hostname, domain) {
    const host = normalizeHostname(hostname);
    const target = normalizeHostname(domain);
    if (!host || !target) return false;
    return host === target || host.endsWith(`.${target}`);
}

export function inputMatchesHostname(value, domain, baseHref = null) {
    return hostnameMatches(hostnameFromInput(value, baseHref), domain);
}
