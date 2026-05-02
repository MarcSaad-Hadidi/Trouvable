/**
 * Layer 2 orchestrator — specialized GEO enrichments.
 *
 * Runs AFTER Layer 1 completes. It reuses Layer 1 / crawler-access data where
 * possible so it does NOT trigger a second crawl. The output is bundled under
 * `site_level_expert` on the canonical internal audit object.
 *
 * Each sub-module is diagnostic: it produces findings + an expert score. The
 * expert score is namespaced under `subsystem_scores.layer2_expert.*` — it is
 * NOT the Trouvable final product score.
 */

import { auditLlmsTxtDeep } from './llms-deep.js';
import { auditAiDiscoveryEndpoints } from './ai-discovery.js';
import { auditBrandEntity } from './brand-entity.js';
import { auditTrustStack } from './trust-stack.js';
import { auditNegativeSignals } from './negative-signals.js';
import { lookup } from 'node:dns/promises';
import net from 'node:net';

function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function isPrivateOrLocalHostname(hostname) {
    const h = String(hostname || '').toLowerCase();
    return h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local');
}

function isPrivateOrLocalIp(ip) {
    if (!ip) return true;
    if (net.isIPv4(ip)) {
        if (ip.startsWith('10.')) return true;
        if (ip.startsWith('127.')) return true;
        if (ip.startsWith('169.254.')) return true;
        if (ip.startsWith('192.168.')) return true;
        const firstOctet = Number(ip.split('.')[0]);
        const secondOctet = Number(ip.split('.')[1]);
        if (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) return true;
        if (firstOctet === 0) return true;
        return false;
    }
    if (net.isIPv6(ip)) {
        const normalized = ip.toLowerCase();
        if (normalized === '::1') return true;
        if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA fc00::/7
        if (normalized.startsWith('fe80:')) return true; // link-local
        if (normalized.startsWith('::ffff:')) {
            const mapped = normalized.slice(7);
            if (net.isIPv4(mapped)) return isPrivateOrLocalIp(mapped);
        }
        return false;
    }
    return true;
}

async function isSafePublicHttpUrl(rawUrl) {
    let parsed;
    try {
        parsed = new URL(rawUrl);
    } catch {
        return false;
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    if (parsed.username || parsed.password) return false;
    if (!parsed.hostname) return false;
    if (isPrivateOrLocalHostname(parsed.hostname)) return false;

    try {
        const resolved = await lookup(parsed.hostname, { all: true });
        if (!Array.isArray(resolved) || resolved.length === 0) return false;
        return resolved.every((entry) => !isPrivateOrLocalIp(entry.address));
    } catch {
        return false;
    }
}

async function resolveLlmsTxtBodies(siteUrl, crawlerAccessData) {
    // Prefer already-fetched bodies if crawler-access was extended to capture them;
    // fall back to a lightweight re-fetch only when absent. This avoids a second
    // crawl while keeping the module usable standalone.
    const hasCachedLlmsTxt = crawlerAccessData?.llmsTxtBody !== undefined && crawlerAccessData?.llmsTxtBody !== null;
    const hasCachedLlmsFull = crawlerAccessData?.llmsFullBody !== undefined && crawlerAccessData?.llmsFullBody !== null;
    if (hasCachedLlmsTxt || hasCachedLlmsFull) {
        return {
            llmsTxtBody: crawlerAccessData.llmsTxtBody || null,
            llmsFullBody: crawlerAccessData.llmsFullBody || null,
        };
    }

    try {
        const safe = await isSafePublicHttpUrl(siteUrl);
        if (!safe) return { llmsTxtBody: null, llmsFullBody: null };

        const origin = new URL(siteUrl).origin;
        const [llmsTxtRes, llmsFullRes] = await Promise.all([
            fetch(`${origin}/llms.txt`, { headers: { 'User-Agent': 'TrouvableAuditBot/3.0', Accept: 'text/plain,*/*' }, redirect: 'follow' }).catch(() => null),
            fetch(`${origin}/llms-full.txt`, { headers: { 'User-Agent': 'TrouvableAuditBot/3.0', Accept: 'text/plain,*/*' }, redirect: 'follow' }).catch(() => null),
        ]);
        const llmsTxtBody = llmsTxtRes && llmsTxtRes.ok ? await llmsTxtRes.text().catch(() => null) : null;
        const llmsFullBody = llmsFullRes && llmsFullRes.ok ? await llmsFullRes.text().catch(() => null) : null;
        return { llmsTxtBody, llmsFullBody };
    } catch {
        return { llmsTxtBody: null, llmsFullBody: null };
    }
}

/**
 * Run Layer 2 specialized GEO enrichments.
 *
 * @param {object} params
 * @param {string} params.siteUrl — resolved site URL.
 * @param {object} params.scanResults — Layer 1 scan output (extracted_data, scanned_pages, etc.).
 * @param {object} [params.crawlerAccessData] — output of `analyzeCrawlerAccess`.
 * @param {Array<object>} [params.layer1PageChecks] — per-page check results from Layer 1.
 * @returns {Promise<object>} expert bundle
 */
export async function runLayer2Expert({ siteUrl, scanResults, crawlerAccessData, layer1PageChecks = [] }) {
    const startedAt = Date.now();
    const extracted = scanResults?.extracted_data || {};

    const [{ llmsTxtBody, llmsFullBody }, aiDiscovery] = await Promise.all([
        resolveLlmsTxtBodies(siteUrl, crawlerAccessData),
        auditAiDiscoveryEndpoints(siteUrl),
    ]);

    const llmsDeep = auditLlmsTxtDeep(llmsTxtBody, siteUrl, { llmsFullContent: llmsFullBody });
    const brandEntity = auditBrandEntity({ extracted });
    const trustStack = auditTrustStack({ extracted });
    const negative = auditNegativeSignals({ extracted, scannedPages: scanResults?.scanned_pages || [], layer1PageChecks });

    const modules = {
        llms_txt_deep: llmsDeep,
        ai_discovery_endpoints: aiDiscovery,
        brand_entity: brandEntity,
        trust_stack: trustStack,
        negative_signals: negative,
    };

    const scores = Object.fromEntries(Object.entries(modules).map(([key, value]) => [key, safeNumber(value?.score, 0)]));
    const weightedAverage = (
        scores.llms_txt_deep * 0.2 +
        scores.ai_discovery_endpoints * 0.1 +
        scores.brand_entity * 0.3 +
        scores.trust_stack * 0.3 +
        scores.negative_signals * 0.1
    );

    const findings = Object.entries(modules).flatMap(([moduleKey, moduleResult]) => (
        (moduleResult?.findings || []).map((finding) => ({ ...finding, module: moduleKey }))
    ));

    return {
        summary_score: Math.round(weightedAverage),
        module_scores: scores,
        findings,
        modules,
        duration_ms: Date.now() - startedAt,
    };
}
