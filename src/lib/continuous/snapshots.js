import 'server-only';

import { getDbNowIso as nowIso } from '@/lib/db/core';
import { listActiveClientIds } from '@/lib/db/clients';
import { upsertVisibilityMetricSnapshot } from '@/lib/db/snapshots';
import { flattenSnapshotToLegacy } from '@/lib/operator-intelligence/kpi-core';
import { getGeoWorkspaceSnapshot } from '@/lib/operator-intelligence/snapshot';

function startOfTodayDateString() {
    return new Date().toISOString().slice(0, 10);
}

function toMetricSnapshotPayload(metrics, { clientId, source = 'system', sourceJobRunId = null, metadata = {} }) {
    return {
        client_id: clientId,
        source,
        source_job_run_id: sourceJobRunId,
        snapshot_date: startOfTodayDateString(),
        captured_at: nowIso(),
        seo_score: metrics?.seoScore ?? null,
        geo_score: metrics?.geoScore ?? null,
        visibility_proxy_percent: metrics?.visibilityProxyPercent ?? null,
        mention_rate_percent: metrics?.trackedPromptStats?.mentionRatePercent ?? null,
        citation_coverage_percent: metrics?.citationCoveragePercent ?? null,
        competitor_visibility_count: metrics?.competitorMentions ?? null,
        freshness_audit_at: metrics?.lastAuditAt ?? null,
        freshness_run_at: metrics?.lastGeoRunAt ?? null,
        metadata: { ...metadata, data_status: metrics?.status || 'available', data_sources: metrics?.sources || {} },
    };
}

export async function upsertVisibilitySnapshotForClient({
    clientId,
    source = 'system',
    sourceJobRunId = null,
    metadata = {},
}) {
    const ws = await getGeoWorkspaceSnapshot(clientId);
    const metrics = flattenSnapshotToLegacy(ws.snapshot, ws.latestAudit);
    const payload = toMetricSnapshotPayload(metrics, {
        clientId,
        source,
        sourceJobRunId,
        metadata,
    });

    return upsertVisibilityMetricSnapshot(payload);
}

export async function captureDailySnapshotsForAllClients() {
    const clientIds = await listActiveClientIds();

    let captured = 0;
    for (const clientId of clientIds) {
        try {
            await upsertVisibilitySnapshotForClient({
                clientId,
                source: 'cron',
                metadata: { reason: 'daily_snapshot' },
            });
            captured += 1;
        } catch (snapshotError) {
            console.error(`[Continuous] snapshot failed for client ${clientId}:`, snapshotError.message);
        }
    }

    return { captured, total: clientIds.length };
}
