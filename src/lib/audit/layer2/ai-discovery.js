/**
 * Layer 2 AI discovery endpoint audit.
 *
 * Probes the common forward-looking AI discovery paths and reports what the
 * site exposes. None of these endpoints are yet standardized, so the audit is
 * diagnostic only — presence is additive evidence, absence is not a failure.
 *
 * Endpoints probed:
 *  - `/.well-known/ai.txt`           AI access policy (draft)
 *  - `/ai/summary.json`              Brand summary
 *  - `/ai/faq.json`                  FAQ for assistants
 *  - `/ai/service.json`              Service catalog for assistants
 *  - `/ai.txt`                       Legacy location
 */

import { fetchPublicResource } from '../url-safety.js';

const DEFAULT_TIMEOUT_MS = 6000;

const ENDPOINTS = [
    { key: 'ai_well_known', path: '/.well-known/ai.txt', expected_content_type: /text\//i, format: 'text' },
    { key: 'ai_legacy', path: '/ai.txt', expected_content_type: /text\//i, format: 'text' },
    { key: 'ai_summary_json', path: '/ai/summary.json', expected_content_type: /application\/json/i, format: 'json' },
    { key: 'ai_faq_json', path: '/ai/faq.json', expected_content_type: /application\/json/i, format: 'json' },
    { key: 'ai_service_json', path: '/ai/service.json', expected_content_type: /application\/json/i, format: 'json' },
];

function trouvableUserAgent() {
    return 'Mozilla/5.0 (TrouvableAuditBot/3.0; +https://trouvable.com/audit)';
}

async function probeEndpoint(origin, endpoint) {
    const url = `${origin}${endpoint.path}`;
    const result = {
        key: endpoint.key,
        url,
        found: false,
        status: 0,
        content_type: null,
        content_type_valid: false,
        size_bytes: 0,
        parse_ok: false,
        parse_reason: null,
    };
    try {
        const response = await fetchPublicResource(url, {
            timeoutMs: DEFAULT_TIMEOUT_MS,
            headers: {
                'User-Agent': trouvableUserAgent(),
                Accept: endpoint.format === 'json' ? 'application/json, */*' : 'text/plain, */*',
            },
        });
        result.status = response.status;
        result.content_type = response.headers.get('content-type') || null;
        if (!response.ok) return result;

        const body = await response.text();
        result.size_bytes = body.length;
        result.found = true;
        result.content_type_valid = !result.content_type || endpoint.expected_content_type.test(result.content_type);

        if (endpoint.format === 'json') {
            try {
                JSON.parse(body);
                result.parse_ok = true;
            } catch (error) {
                result.parse_ok = false;
                result.parse_reason = error?.message || 'invalid_json';
            }
        } else {
            result.parse_ok = body.trim().length > 0;
            if (!result.parse_ok) result.parse_reason = 'empty_body';
        }
        return result;
    } catch (error) {
        result.parse_reason = error?.message || 'fetch_failed';
        return result;
    }
}

export async function auditAiDiscoveryEndpoints(siteUrl) {
    let origin;
    try {
        origin = new URL(siteUrl).origin;
    } catch {
        return {
            score: 0,
            endpoints: [],
            findings: [{ id: 'ai_discovery.invalid_url', severity: 'medium', message: 'Could not resolve site origin for AI discovery probe.' }],
        };
    }

    const results = await Promise.all(ENDPOINTS.map((endpoint) => probeEndpoint(origin, endpoint)));
    const findings = [];

    const foundCount = results.filter((r) => r.found).length;
    const jsonInvalid = results.filter((r) => r.found && /\.json$/.test(r.url) && !r.parse_ok);
    for (const entry of jsonInvalid) {
        findings.push({
            id: `ai_discovery.${entry.key}.invalid_json`,
            severity: 'high',
            message: `${entry.url} is served but does not parse as valid JSON.`,
        });
    }

    if (foundCount === 0) {
        findings.push({
            id: 'ai_discovery.none',
            severity: 'low',
            message: 'No AI discovery endpoints detected. These are optional but help future AI surfaces.',
        });
    }

    let score = 0;
    for (const entry of results) {
        if (!entry.found) continue;
        if (entry.key === 'ai_well_known' || entry.key === 'ai_legacy') score += 20;
        else if (entry.parse_ok) score += 20;
        else score += 5;
    }
    score = Math.max(0, Math.min(100, score));

    return {
        score,
        endpoints: results,
        findings,
    };
}
