import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import {
    isLayeredPipelineEnabled,
    isLayer2ExpertEnabled,
    isSitemapFirstEnabled,
    isShadowModeEnabled,
    resolveAuditVersion,
    getCrawlBudget,
    getCrawlerRuntimeConfig,
    getFullAuditTimeoutMs,
    getSitemapDiscoveryConfig,
} from '@/lib/audit/audit-config';

export async function GET() {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const payload = {
        auditVersion: resolveAuditVersion(),
        layeredPipeline: isLayeredPipelineEnabled(),
        layer2Expert: isLayer2ExpertEnabled(),
        sitemapFirst: isSitemapFirstEnabled(),
        shadowMode: isShadowModeEnabled(),
        crawlBudget: getCrawlBudget(),
        crawlSafety: getCrawlerRuntimeConfig(),
        sitemapDiscovery: getSitemapDiscoveryConfig(),
        fullAuditTimeoutMs: getFullAuditTimeoutMs(),
    };

    return NextResponse.json(payload, {
        headers: { 'Cache-Control': 'no-store' },
    });
}
