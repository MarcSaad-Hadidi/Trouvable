import { lookup } from 'node:dns/promises';
import net from 'node:net';

const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_TIMEOUT_MS = 8000;
const PRIVATE_HOSTNAMES = new Set([
    'localhost',
    'localhost.localdomain',
    'ip6-localhost',
    'ip6-loopback',
    'metadata',
    'metadata.google.internal',
    'metadata.azure.com',
]);
const PRIVATE_HOSTNAME_SUFFIXES = [
    '.localhost',
    '.local',
    '.lan',
    '.home',
    '.internal',
    '.intranet',
];
const BLOCKED_PORTS = new Set([
    0, 21, 22, 23, 25, 53, 110, 111, 135, 139, 143, 389, 445, 465, 587,
    993, 995, 1433, 1521, 2049, 2375, 2376, 3306, 3389, 5432, 5601, 5672,
    5900, 5984, 6379, 9200, 9300, 11211, 27017,
]);
const BLOCKED_IPV4_CIDRS = [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4],
];
const BLOCKED_IPV6_CIDRS = [
    ['::', 128],
    ['::1', 128],
    ['64:ff9b::', 96],
    ['100::', 64],
    ['2001::', 32],
    ['2001:2::', 48],
    ['2001:db8::', 32],
    ['2002::', 16],
    ['fc00::', 7],
    ['fe80::', 10],
    ['ff00::', 8],
];

function stripIpv6Brackets(value) {
    const hostname = String(value || '').trim().toLowerCase();
    if (hostname.startsWith('[') && hostname.endsWith(']')) return hostname.slice(1, -1);
    return hostname;
}

function normalizeSafetyHostname(value) {
    return stripIpv6Brackets(value).replace(/\.$/, '');
}

function ipv4ToInteger(address) {
    const parts = address.split('.').map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
    return parts.reduce((acc, part) => (acc * 256) + part, 0);
}

function isIpv4InCidr(address, baseAddress, prefixLength) {
    const value = ipv4ToInteger(address);
    const base = ipv4ToInteger(baseAddress);
    if (value === null || base === null) return true;
    const bucketSize = 2 ** (32 - prefixLength);
    return Math.floor(value / bucketSize) === Math.floor(base / bucketSize);
}

function isPrivateIpv4(address) {
    return BLOCKED_IPV4_CIDRS.some(([base, prefix]) => isIpv4InCidr(address, base, prefix));
}

function parseIpv6ToBigInt(address) {
    const normalized = stripIpv6Brackets(address);
    if (!normalized || normalized.includes('%')) return null;

    const halves = normalized.split('::');
    if (halves.length > 2) return null;

    const parseGroups = (value) => {
        if (!value) return [];
        return value.split(':').map((group) => {
            if (!/^[0-9a-f]{1,4}$/i.test(group)) return null;
            return Number.parseInt(group, 16);
        });
    };

    const head = parseGroups(halves[0]);
    const tail = halves.length === 2 ? parseGroups(halves[1]) : [];
    if (head.includes(null) || tail.includes(null)) return null;

    const missing = 8 - head.length - tail.length;
    if (halves.length === 1 && missing !== 0) return null;
    if (halves.length === 2 && missing < 1) return null;

    const groups = halves.length === 2
        ? [...head, ...Array(missing).fill(0), ...tail]
        : head;
    if (groups.length !== 8) return null;

    return groups.reduce((acc, group) => (acc << 16n) + BigInt(group), 0n);
}

function isIpv6InCidr(address, baseAddress, prefixLength) {
    const value = parseIpv6ToBigInt(address);
    const base = parseIpv6ToBigInt(baseAddress);
    if (value === null || base === null) return true;
    if (prefixLength === 0) return true;
    const shift = 128n - BigInt(prefixLength);
    return (value >> shift) === (base >> shift);
}

function mappedIpv4FromIpv6(address) {
    const value = parseIpv6ToBigInt(address);
    if (value === null) return null;
    if ((value >> 32n) !== 0xffffn) return null;
    const ipv4 = Number(value & 0xffffffffn);
    return [
        (ipv4 >>> 24) & 255,
        (ipv4 >>> 16) & 255,
        (ipv4 >>> 8) & 255,
        ipv4 & 255,
    ].join('.');
}

function isPrivateIpv6(address) {
    const mappedIpv4 = mappedIpv4FromIpv6(address);
    if (mappedIpv4) return isPrivateIpv4(mappedIpv4);
    return BLOCKED_IPV6_CIDRS.some(([base, prefix]) => isIpv6InCidr(address, base, prefix));
}

export function isBlockedIpAddress(address) {
    const normalized = stripIpv6Brackets(address);
    const family = net.isIP(normalized);
    if (family === 4) return isPrivateIpv4(normalized);
    if (family === 6) return isPrivateIpv6(normalized);
    return true;
}

function isValidDnsHostname(hostname) {
    if (!hostname || hostname.length > 253) return false;
    if (hostname.includes('..') || hostname.includes('%')) return false;
    if (!hostname.includes('.')) return false;
    return hostname.split('.').every((label) => (
        label.length >= 1
        && label.length <= 63
        && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)
    ));
}

function isBlockedHostname(hostname) {
    if (PRIVATE_HOSTNAMES.has(hostname)) return true;
    return PRIVATE_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

export function parsePublicHttpUrl(input, baseHref = null) {
    let parsed;
    try {
        parsed = baseHref ? new URL(input, baseHref) : new URL(input);
    } catch {
        return null;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;
    if (!normalizeSafetyHostname(parsed.hostname)) return null;
    return parsed;
}

async function assertPublicHost(parsedUrl) {
    const hostname = normalizeSafetyHostname(parsedUrl.hostname);
    if (!hostname || isBlockedHostname(hostname)) {
        throw new Error('blocked_private_host');
    }

    if (parsedUrl.port && BLOCKED_PORTS.has(Number(parsedUrl.port))) {
        throw new Error('blocked_port');
    }

    if (net.isIP(hostname)) {
        if (isBlockedIpAddress(hostname)) throw new Error('blocked_private_ip');
        return;
    }

    if (!isValidDnsHostname(hostname)) {
        throw new Error('invalid_hostname');
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
        let abortListener = null;
        if (signal) {
            if (signal.aborted) controller.abort();
            abortListener = () => controller.abort();
            signal.addEventListener('abort', abortListener, { once: true });
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
            if (signal && abortListener) signal.removeEventListener('abort', abortListener);
        }
    }

    throw new Error('too_many_redirects');
}
