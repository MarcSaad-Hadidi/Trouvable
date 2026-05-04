import { lookup } from 'node:dns/promises';
import net from 'node:net';

import { normalizeHostname } from './url-hosts.js';

const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_TIMEOUT_MS = 8000;
const PRIVATE_HOSTNAMES = new Set(['localhost', 'localhost.localdomain']);

function isPrivateIpv4(address) {
    const parts = address.split('.').map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
    const [a, b] = parts;
    return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        a >= 224
    );
}

function isPrivateIpv6(address) {
    const normalized = address.toLowerCase();
    if (normalized === '::1' || normalized === '::') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')) return true;
    const ipv4Mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return ipv4Mapped ? isPrivateIpv4(ipv4Mapped[1]) : false;
}

export function isBlockedIpAddress(address) {
    const family = net.isIP(address);
    if (family === 4) return isPrivateIpv4(address);
    if (family === 6) return isPrivateIpv6(address);
    return true;
}

export function parsePublicHttpUrl(input, baseHref = null) {
    let parsed;
    try {
        parsed = baseHref ? new URL(input, baseHref) : new URL(input);
    } catch {
        return null;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed;
}

async function assertPublicHost(parsedUrl) {
    const hostname = normalizeHostname(parsedUrl.hostname);
    if (!hostname || PRIVATE_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost')) {
        throw new Error('blocked_private_host');
    }

    if (net.isIP(hostname)) {
        if (isBlockedIpAddress(hostname)) throw new Error('blocked_private_ip');
        return;
    }

    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (!Array.isArray(addresses) || addresses.length === 0) throw new Error('dns_lookup_empty');
    if (addresses.some((entry) => isBlockedIpAddress(entry.address))) {
        throw new Error('blocked_private_dns');
    }
}

export async function fetchPublicResource(inputUrl, {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    headers = {},
    method = 'GET',
    signal = undefined,
} = {}) {
    let currentUrl = parsePublicHttpUrl(inputUrl);
    if (!currentUrl) throw new Error('invalid_public_http_url');

    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
        await assertPublicHost(currentUrl);

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        if (signal) {
            if (signal.aborted) controller.abort();
            signal.addEventListener('abort', () => controller.abort(), { once: true });
        }

        try {
            const response = await fetch(currentUrl.toString(), {
                method,
                headers,
                signal: controller.signal,
                redirect: 'manual',
            });

            if (response.status >= 300 && response.status < 400) {
                const location = response.headers.get('location');
                if (!location) return response;
                if (redirectCount >= maxRedirects) throw new Error('too_many_redirects');
                const nextUrl = parsePublicHttpUrl(location, currentUrl.toString());
                if (!nextUrl) throw new Error('invalid_redirect_url');
                currentUrl = nextUrl;
                continue;
            }

            return response;
        } finally {
            clearTimeout(timer);
        }
    }

    throw new Error('too_many_redirects');
}
