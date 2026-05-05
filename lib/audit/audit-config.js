/**
 * Trouvable audit pipeline configuration and feature flags.
 *
 * This file is the single source of truth for toggling the layered architecture
 * (Layer 1 canonical scan, Layer 2 expert enrichments, Layer 3 normalization,
 * Layer 4 product scoring) without rewriting orchestration code.
 *
 * All flags default to enabled so the layered pipeline is the new normal path.
 * Setting `AUDIT_LAYERED_DISABLED=1` forces the legacy behavior for rollback.
 */

export const AUDIT_VERSION_LEGACY = 'v2';
export const AUDIT_VERSION_LAYERED = 'v2.1-layered';

export const LAYERED_SCHEMA_KEY = 'layered_v1';

function envEnabled(flag, defaultEnabled = true) {
    const value = String(process.env[flag] || '').trim();
    if (value === '1' || value === 'true') return true;
    if (value === '0' || value === 'false') return false;
    return defaultEnabled;
}

function envDisabled(flag) {
    const value = String(process.env[flag] || '').trim();
    return value === '1' || value === 'true';
}

export function isLayeredPipelineEnabled() {
    if (envDisabled('AUDIT_LAYERED_DISABLED')) return false;
    return envEnabled('AUDIT_LAYERED_ENABLED', true);
}

export function isSitemapFirstEnabled() {
    if (envDisabled('AUDIT_SITEMAP_FIRST_DISABLED')) return false;
    return envEnabled('AUDIT_SITEMAP_FIRST_ENABLED', true);
}

export function isLayer2ExpertEnabled() {
    if (envDisabled('AUDIT_LAYER2_DISABLED')) return false;
    return envEnabled('AUDIT_LAYER2_ENABLED', true);
}

/**
 * Shadow / benchmark mode runs the layered pipeline in parallel without
 * mutating the product final score. Off by default; enable with
 * AUDIT_SHADOW_MODE=1 to capture `debug_benchmark` comparisons only.
 */
export function isShadowModeEnabled() {
    return envDisabled('AUDIT_SHADOW_MODE');
}

export function resolveAuditVersion() {
    return isLayeredPipelineEnabled() ? AUDIT_VERSION_LAYERED : AUDIT_VERSION_LEGACY;
}

/**
 * Crawl safety ceilings — frontier-exhaustion is the normal stop condition.
 *
 * The crawler walks the discoverable internal graph (BFS + sitemap seeds)
 * until the frontier is empty. These ceilings exist ONLY to prevent
 * runaway crawls (cycles, infinite calendars, faceted UIs, etc.). They
 * are NOT a product-level limit — operators audit full sites by default.
 *
 * Override via env when a mandate justifies a different ceiling:
 *   AUDIT_MAX_PAGES         — hard upper bound on visited pages (safety)
 *   AUDIT_MAX_FETCH_ATTEMPTS — total HTTP attempts (visited + failed)
 *   AUDIT_MAX_DURATION_MS   — wall-clock ceiling for the whole crawl
 */

const DEFAULT_MAX_PAGES = 2000;
const HARD_MAX_PAGES = 10_000;

const DEFAULT_MAX_FETCH_ATTEMPTS = 4000;
const HARD_MAX_FETCH_ATTEMPTS = 20_000;

const DEFAULT_MAX_DURATION_MS = 12 * 60 * 1000;
const HARD_MAX_DURATION_MS = 60 * 60 * 1000;

const DEFAULT_SITEMAP_SEED_LIMIT = 200;
const HARD_SITEMAP_SEED_LIMIT = 10_000;

const DEFAULT_MAX_URLS_FROM_SITEMAP = 200;
const HARD_MAX_URLS_FROM_SITEMAP = 20_000;

const DEFAULT_MAX_SITEMAP_DOCS = 4;
const HARD_MAX_SITEMAP_DOCS = 200;

const DEFAULT_LINK_EXTRACTION_DEPTH = 80;
const HARD_LINK_EXTRACTION_DEPTH = 2_000;

const DEFAULT_RENDER_ATTEMPT_LIMIT = 8;
const HARD_RENDER_ATTEMPT_LIMIT = 100;

const DEFAULT_RENDER_FETCH_FAILURE_ATTEMPT_LIMIT = 10;
const HARD_RENDER_FETCH_FAILURE_ATTEMPT_LIMIT = 100;

const DEFAULT_FULL_AUDIT_TIMEOUT_MS = 280_000;
const HARD_FULL_AUDIT_TIMEOUT_MS = 60 * 60 * 1000;

function clampInt(raw, defaultValue, hardMax) {
    const parsed = parseInt(raw || '', 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
    return Math.min(parsed, hardMax);
}

export function getCrawlSafetyCeiling() {
    return {
        maxPages: clampInt(process.env.AUDIT_MAX_PAGES, DEFAULT_MAX_PAGES, HARD_MAX_PAGES),
        maxFetchAttempts: clampInt(
            process.env.AUDIT_MAX_FETCH_ATTEMPTS,
            DEFAULT_MAX_FETCH_ATTEMPTS,
            HARD_MAX_FETCH_ATTEMPTS,
        ),
        maxDurationMs: clampInt(
            process.env.AUDIT_MAX_DURATION_MS,
            DEFAULT_MAX_DURATION_MS,
            HARD_MAX_DURATION_MS,
        ),
    };
}

export function getSitemapDiscoveryConfig() {
    return {
        maxSitemapDocs: clampInt(
            process.env.AUDIT_MAX_SITEMAP_DOCS,
            DEFAULT_MAX_SITEMAP_DOCS,
            HARD_MAX_SITEMAP_DOCS,
        ),
        maxUrlsFromSitemap: clampInt(
            process.env.AUDIT_MAX_URLS_FROM_SITEMAP,
            DEFAULT_MAX_URLS_FROM_SITEMAP,
            HARD_MAX_URLS_FROM_SITEMAP,
        ),
    };
}

export function getCrawlerRuntimeConfig() {
    return {
        ...getCrawlSafetyCeiling(),
        sitemapSeedLimit: clampInt(
            process.env.AUDIT_SITEMAP_SEED_LIMIT,
            DEFAULT_SITEMAP_SEED_LIMIT,
            HARD_SITEMAP_SEED_LIMIT,
        ),
        linkExtractionDepth: clampInt(
            process.env.AUDIT_LINK_EXTRACTION_DEPTH,
            DEFAULT_LINK_EXTRACTION_DEPTH,
            HARD_LINK_EXTRACTION_DEPTH,
        ),
        renderAttemptLimit: clampInt(
            process.env.AUDIT_RENDER_ATTEMPT_LIMIT,
            DEFAULT_RENDER_ATTEMPT_LIMIT,
            HARD_RENDER_ATTEMPT_LIMIT,
        ),
        renderFetchFailureAttemptLimit: clampInt(
            process.env.AUDIT_RENDER_FETCH_FAILURE_ATTEMPT_LIMIT,
            DEFAULT_RENDER_FETCH_FAILURE_ATTEMPT_LIMIT,
            HARD_RENDER_FETCH_FAILURE_ATTEMPT_LIMIT,
        ),
    };
}

export function getFullAuditTimeoutMs() {
    return clampInt(
        process.env.AUDIT_FULL_TIMEOUT_MS,
        DEFAULT_FULL_AUDIT_TIMEOUT_MS,
        HARD_FULL_AUDIT_TIMEOUT_MS,
    );
}

/**
 * Backwards-compatible alias retained for legacy callers.
 * Prefer `getCrawlSafetyCeiling()` for full guardrail context.
 */
export function getCrawlBudget() {
    return getCrawlSafetyCeiling().maxPages;
}
