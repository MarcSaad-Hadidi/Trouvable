import 'server-only';

import { normalizeClientProfileShape } from '@/lib/client-profile';
import { getOperatorWorkspaceShell } from '@/lib/operator-intelligence/base';
import { getAdminSupabase } from '@/lib/supabase-admin';

export async function listOperatorClients() {
    const supabase = getAdminSupabase();
    const { data, error } = await supabase
        .from('client_geo_profiles')
        .select('id, client_name, client_slug, website_url, business_type, publication_status, is_published, lifecycle_status, updated_at, archived_at')
        .is('archived_at', null)
        .order('updated_at', { ascending: false });

    if (error) {
        throw new Error(`[OperatorData] listOperatorClients: ${error.message}`);
    }

    return (data || []).map(normalizeClientProfileShape);
}

export async function getOperatorGeoWorkspacePayload(clientId) {
    return getOperatorWorkspaceShell(clientId);
}

const RUNS_LOOKBACK_MS = 21 * 86400000;

/**
 * Enrichit la liste clients avec des signaux légers pour le pilotage opérateur
 * (échecs récents, confiance parse, opportunités ouvertes, fraîcheur audit/run).
 */
export async function enrichClientsWithOperationalSignals(clients) {
    if (!clients?.length) {
        return (clients || []).map((c) => ({ ...c, operatorSignals: null }));
    }

    const supabase = getAdminSupabase();
    const ids = clients.map((c) => c.id);
    const since = new Date(Date.now() - RUNS_LOOKBACK_MS).toISOString();

    const [runsRes, auditsRes, oppsRes, tqRes] = await Promise.all([
        supabase
            .from('query_runs')
            .select('client_id, status, parse_status, parse_confidence, created_at, provider, model')
            .in('client_id', ids)
            .gte('created_at', since)
            .or('run_mode.is.null,run_mode.eq.standard')
            .order('created_at', { ascending: false })
            .limit(4000),
        supabase
            .from('client_site_audits')
            .select('client_id, created_at')
            .in('client_id', ids)
            .order('created_at', { ascending: false })
            .limit(800),
        supabase
            .from('opportunities')
            .select('client_id')
            .in('client_id', ids)
            .eq('status', 'open'),
        supabase
            .from('tracked_queries')
            .select('client_id, is_active')
            .in('client_id', ids),
    ]);

    if (runsRes.error) {
        throw new Error(`[OperatorData] runs batch: ${runsRes.error.message}`);
    }
    if (auditsRes.error) {
        throw new Error(`[OperatorData] audits batch: ${auditsRes.error.message}`);
    }
    if (oppsRes.error) {
        throw new Error(`[OperatorData] opportunities batch: ${oppsRes.error.message}`);
    }
    if (tqRes.error) {
        throw new Error(`[OperatorData] tracked_queries batch: ${tqRes.error.message}`);
    }

    const latestAuditByClient = new Map();
    for (const row of auditsRes.data || []) {
        if (!latestAuditByClient.has(row.client_id)) {
            latestAuditByClient.set(row.client_id, row.created_at);
        }
    }

    const openOppsByClient = new Map();
    for (const row of oppsRes.data || []) {
        openOppsByClient.set(row.client_id, (openOppsByClient.get(row.client_id) || 0) + 1);
    }

    const activePromptsByClient = new Map();
    for (const row of tqRes.data || []) {
        if (row.is_active !== false) {
            activePromptsByClient.set(row.client_id, (activePromptsByClient.get(row.client_id) || 0) + 1);
        }
    }

    const runsByClient = new Map();
    for (const row of runsRes.data || []) {
        if (!runsByClient.has(row.client_id)) runsByClient.set(row.client_id, []);
        runsByClient.get(row.client_id).push(row);
    }

    return clients.map((client) => {
        const runs = runsByClient.get(client.id) || [];
        const failed = runs.filter((r) => r.status === 'failed').length;
        const completed = runs.filter((r) => r.status === 'completed').length;
        const denom = completed + failed;
        const failRate = denom > 0 ? failed / denom : 0;
        const lowConf = runs.filter(
            (r) => r.status === 'completed' && r.parse_confidence !== null && r.parse_confidence !== undefined && Number(r.parse_confidence) < 0.5,
        ).length;
        const parseRisk = runs.filter(
            (r) => r.status === 'completed' && (r.parse_status === 'parsed_failed' || r.parse_status === 'parsed_partial'),
        ).length;

        const latestRun = runs[0] || null;

        const latestAuditAt = latestAuditByClient.get(client.id) || null;
        const hoursSinceAudit = latestAuditAt
            ? (Date.now() - new Date(latestAuditAt).getTime()) / 3600000
            : null;
        const hoursSinceRun = latestRun
            ? (Date.now() - new Date(latestRun.created_at).getTime()) / 3600000
            : null;

        const activePrompts = activePromptsByClient.get(client.id) || 0;
        const openOpportunities = openOppsByClient.get(client.id) || 0;

        const reasons = [];
        let attention = 'stable';

        if (failRate > 0.2 && denom >= 3) {
            attention = 'critical';
            reasons.push('fail_rate_high');
        } else if (failRate > 0.08 && denom >= 3) {
            attention = attention === 'critical' ? attention : 'needs_attention';
            reasons.push('failures');
        } else if (failed > 0 && attention === 'stable') {
            attention = 'watch';
            reasons.push('some_failures');
        }

        if (parseRisk >= 3 && completed >= 3) {
            attention = attention === 'stable' ? 'watch' : attention;
            reasons.push('parse_quality');
        }

        if (lowConf >= 2 && completed >= 2) {
            attention = attention === 'stable' ? 'watch' : attention;
            reasons.push('low_parse_confidence');
        }

        if (hoursSinceRun !== null && hoursSinceRun > 72 && activePrompts > 0) {
            if (attention === 'stable') attention = 'watch';
            reasons.push('stale_runs');
        }

        if (hoursSinceAudit !== null && hoursSinceAudit > 720) {
            if (attention === 'stable') attention = 'watch';
            reasons.push('stale_audit');
        }

        if (openOpportunities >= 5) {
            if (attention === 'stable') attention = 'watch';
            reasons.push('opportunity_backlog');
        }

        if (activePrompts === 0) {
            reasons.push('no_active_prompts');
        }

        return {
            ...client,
            operatorSignals: {
                attention,
                reasons,
                openOpportunities,
                activePrompts,
                completedRunsWindow: completed,
                failedRunsWindow: failed,
                lowConfidenceRunsWindow: lowConf,
                parseRiskRunsWindow: parseRisk,
                latestRunAt: latestRun?.created_at || null,
                latestAuditAt,
                failRatePercent: denom > 0 ? Math.round(failRate * 100) : null,
            },
        };
    });
}
