import { NextResponse } from 'next/server';

export const maxDuration = 300;

import { requireAdmin } from '@/lib/auth';
import { runSiteAudit } from '@/lib/audit/scanner';
import { classifySiteForAudit } from '@/lib/audit/site-classification';
import { analyzeCrawlerAccess } from '@/lib/audit/crawler-access';
import { scoreAuditV2 } from '@/lib/audit/score';
import { runLayer2Expert } from '@/lib/audit/layer2';
import { isLayer2ExpertEnabled, isLayeredPipelineEnabled } from '@/lib/audit/audit-config';
import { parsePublicHttpUrl } from '@/lib/audit/url-safety';

const AUDIT_COMPARE_ALLOWED_HOSTS = (process.env.AUDIT_COMPARE_ALLOWED_HOSTS || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

function isHostnameAllowed(hostname) {
    if (!hostname) return false;
    if (AUDIT_COMPARE_ALLOWED_HOSTS.length === 0) return true;
    const normalized = hostname.toLowerCase();
    return AUDIT_COMPARE_ALLOWED_HOSTS.some((allowed) => (
        allowed.startsWith('.')
            ? normalized === allowed.slice(1) || normalized.endsWith(allowed)
            : normalized === allowed
    ));
}

/**
 * Internal-only comparison endpoint.
 *
 * Runs the deterministic portion of the audit pipeline (crawl → classify →
 * crawler-access → Layer 2 → deterministic scoring) against two URLs in
 * parallel, **without** persisting anything to the database. The LLM step is
 * skipped intentionally: comparison is about reproducible diagnostic deltas,
 * not AI-generated narrative.
 *
 * Shape returned to the client is intentionally compact so the operator view
 * can render side-by-side without re-deriving data.
 */
function normalizeUrl(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
        const parsed = new URL(candidate);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
        const safeParsed = parsePublicHttpUrl(parsed.toString());
        if (!safeParsed) return null;
        if (!isHostnameAllowed(safeParsed.hostname)) return null;
        return safeParsed.toString();
    } catch {
        return null;
    }
}

function summarizeRawScan(raw) {
    if (!raw) return null;
    return {
        overall: raw.overall ?? null,
        categories: raw.categories || {},
        totals: raw.totals || null,
    };
}

function summarizeLayer2(expert) {
    if (!expert) return null;
    const modules = {};
    for (const [key, moduleData] of Object.entries(expert.modules || {})) {
        if (!moduleData) continue;
        const findings = Array.isArray(moduleData.findings) ? moduleData.findings : [];
        modules[key] = {
            score: typeof moduleData.score === 'number' ? moduleData.score : null,
            findings_total: findings.length,
            findings_high: findings.filter((f) => ['high', 'critical'].includes(String(f?.severity || '').toLowerCase())).length,
            top_findings: findings
                .slice()
                .sort((a, b) => {
                    const rank = { high: 3, critical: 3, medium: 2, low: 1, info: 0 };
                    return (rank[String(b?.severity || '').toLowerCase()] ?? 0) - (rank[String(a?.severity || '').toLowerCase()] ?? 0);
                })
                .slice(0, 3)
                .map((finding) => ({
                    id: finding.id,
                    severity: finding.severity,
                    message: finding.message,
                })),
        };
    }
    return {
        summary_score: typeof expert.summary_score === 'number' ? expert.summary_score : null,
        module_scores: expert.module_scores || {},
        modules,
    };
}

function summarizeDimensions(dimensions) {
    if (!Array.isArray(dimensions)) return [];
    return dimensions.map((dim) => ({
        key: dim.key,
        score: dim.score,
        applicability: dim.applicability,
    }));
}

function summarizeIssues(issues) {
    if (!Array.isArray(issues)) return [];
    return issues.slice(0, 8).map((issue) => ({
        id: issue.id || issue.code || null,
        title: issue.title || issue.message || null,
        severity: issue.severity || issue.priority || null,
        category: issue.category || null,
    }));
}

function summarizeStrengths(strengths) {
    if (!Array.isArray(strengths)) return [];
    return strengths.slice(0, 6).map((strength) => ({
        id: strength.id || strength.code || null,
        title: strength.title || strength.message || null,
        category: strength.category || null,
    }));
}

async function auditSiteForCompare(url) {
    const startedAt = Date.now();
    const result = {
        url,
        resolvedUrl: null,
        durationMs: 0,
        success: false,
        error: null,
        pagesScanned: 0,
        pagesSuccessful: 0,
        classification: null,
        scores: { finalScore: null, seoScore: null, geoScore: null, deterministicScore: null },
        dimensions: [],
        layer1: null,
        layer2: null,
        issues: [],
        strengths: [],
    };

    try {
        const scanResults = await runSiteAudit(url);
        result.resolvedUrl = scanResults.resolved_url || url;
        result.pagesScanned = (scanResults.scanned_pages || []).length;
        result.pagesSuccessful = (scanResults.scanned_pages || []).filter((p) => p.success).length;

        if (result.pagesSuccessful === 0) {
            result.error = scanResults.error_message || 'Aucune page explorée avec succès.';
            result.durationMs = Date.now() - startedAt;
            return result;
        }

        const classification = classifySiteForAudit(scanResults);
        result.classification = {
            type: classification.type,
            label: classification.label,
            confidence: classification.confidence,
        };

        let crawlerAccessData = null;
        try {
            crawlerAccessData = await analyzeCrawlerAccess(url);
        } catch {
            crawlerAccessData = null;
        }

        let layer2Expert = null;
        if (isLayeredPipelineEnabled() && isLayer2ExpertEnabled()) {
            try {
                layer2Expert = await runLayer2Expert({
                    siteUrl: url,
                    scanResults,
                    crawlerAccessData,
                    layer1PageChecks: scanResults?.extracted_data?.layered_v1_layer1?.page_level_checks || [],
                });
            } catch {
                layer2Expert = null;
            }
        }

        const deterministic = scoreAuditV2(scanResults, classification, {
            crawlerAccessData,
            layer1RawScan: scanResults?.extracted_data?.layered_v1_layer1?.site_level_raw_scores || null,
            layer2Expert,
        });

        result.scores = {
            seoScore: deterministic.seo_score,
            geoScore: deterministic.geo_score,
            deterministicScore: deterministic.deterministic_score,
            finalScore: deterministic.deterministic_score,
        };
        result.dimensions = summarizeDimensions(deterministic.score_dimensions);
        result.layer1 = summarizeRawScan(scanResults?.extracted_data?.layered_v1_layer1?.site_level_raw_scores);
        result.layer2 = summarizeLayer2(layer2Expert);
        result.issues = summarizeIssues(deterministic.issues);
        result.strengths = summarizeStrengths(deterministic.strengths);
        result.success = true;
    } catch (error) {
        result.error = error?.message || 'Erreur inattendue pendant l’audit de comparaison.';
    }

    result.durationMs = Date.now() - startedAt;
    return result;
}

export async function POST(request) {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Payload JSON invalide' }, { status: 400 });
    }

    const urlA = normalizeUrl(body?.urlA);
    const urlB = normalizeUrl(body?.urlB);

    if (!urlA || !urlB) {
        return NextResponse.json({ error: 'Deux URL valides sont requises (urlA, urlB).' }, { status: 400 });
    }

    if (urlA === urlB) {
        return NextResponse.json({ error: 'Les deux URL sont identiques — la comparaison ne serait pas significative.' }, { status: 400 });
    }

    const startedAt = Date.now();
    try {
        const [siteA, siteB] = await Promise.all([
            auditSiteForCompare(urlA),
            auditSiteForCompare(urlB),
        ]);

        return NextResponse.json({
            generatedAt: new Date().toISOString(),
            totalDurationMs: Date.now() - startedAt,
            pipelineMode: {
                layered: isLayeredPipelineEnabled(),
                layer2: isLayer2ExpertEnabled(),
            },
            siteA,
            siteB,
        });
    } catch (error) {
        console.error('[API/audits/compare] Erreur:', error);
        return NextResponse.json({ error: error?.message || 'Erreur inattendue' }, { status: 500 });
    }
}
