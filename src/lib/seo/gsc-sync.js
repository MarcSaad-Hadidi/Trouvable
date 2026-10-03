import 'server-only';

import { fetchGscSearchAnalytics, hasGscServiceAccountCredentials } from '@/lib/connectors/providers/gsc';
import { getClientById, listClientsWithSiteUrl } from '@/lib/db/clients';
import { upsertGscSearchAnalyticsRows } from '@/lib/db/gsc';
import { updateConnectorState, getClientConnectorRows } from '@/lib/connectors/repository';
import { mapGoogleOAuthError, resolveGscProperty } from '@/lib/seo/gsc-property';

function dateToYmd(date) {
    return date.toISOString().slice(0, 10);
}

function resolveWindow({ startDate, endDate } = {}) {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - (27 * 24 * 60 * 60 * 1000));

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error('Invalid GSC sync window.');
    }

    return {
        startDate: dateToYmd(start),
        endDate: dateToYmd(end),
    };
}

function toUpsertRows({ clientId, siteUrl, rows, date }) {
    return (rows || [])
        .filter((row) => row?.query && row?.page)
        .map((row) => ({
            client_id: clientId,
            site_url: siteUrl,
            date,
            query: String(row.query).slice(0, 1024),
            page: String(row.page).slice(0, 2048),
            clicks: Number(row.clicks || 0),
            impressions: Number(row.impressions || 0),
            ctr: Number(row.ctr || 0),
            position: Number(row.position || 0),
        }));
}

function classifyGscSyncError(error) {
    const rawCode = String(error?.response?.data?.error || error?.code || error?.message || '').toLowerCase();
    const rawMessage = String(error?.response?.data?.error_description || error?.message || '').toLowerCase();
    if (rawCode.includes('invalid_client')) return 'invalid_client';
    if (rawCode.includes('invalid_grant')) return 'invalid_grant';
    if (
        error?.response?.status === 403
        || rawCode.includes('permission')
        || rawMessage.includes('permission')
        || rawMessage.includes('site not found')
        || rawMessage.includes('insufficient')
    ) {
        return 'no_property_access';
    }
    return rawCode || 'gsc_sync_failed';
}

export async function runGscSyncForClient(clientId, options = {}) {
    const client = await getClientById(clientId);
    const connectors = await getClientConnectorRows(clientId);
    const gscConnector = connectors.find(c => c.provider === 'gsc');

    /* Use the shared resolver so the sync job and the read-side
       (lib/operator-intelligence/visibility.js) target the exact same
       GSC property. Previously the sync used `client.website_url` only
       which caused mandates with a custom property override to drift. */
    const siteUrl = resolveGscProperty({
        connector: gscConnector || null,
        websiteUrl: client?.website_url || null,
    });

    if (!siteUrl) {
        return {
            clientId,
            siteUrl: null,
            syncedRows: 0,
            fetchedRows: 0,
            skipped: true,
            reason: 'missing_website_url',
        };
    }

    const googleRefreshToken = gscConnector?.config?.google_refresh_token;

    if (!googleRefreshToken && !hasGscServiceAccountCredentials()) {
        await updateConnectorState({
            clientId,
            provider: 'gsc',
            status: 'error',
            lastError: '[missing_refresh_token] Refresh token Google manquant: reconnectez Google Search Console.',
        });
        return {
            clientId,
            siteUrl,
            syncedRows: 0,
            fetchedRows: 0,
            skipped: true,
            reason: 'missing_refresh_token',
        };
    }

    const window = resolveWindow(options);

    let rows;
    try {
        rows = await fetchGscSearchAnalytics({
            siteUrl,
            startDate: window.startDate,
            endDate: window.endDate,
            rowLimit: options.rowLimit || 1000,
            googleRefreshToken,
        });
    } catch (fetchError) {
        const errorCode = classifyGscSyncError(fetchError);
        const remedy = mapGoogleOAuthError(errorCode, fetchError?.message || null);
        await updateConnectorState({
            clientId,
            provider: 'gsc',
            status: 'error',
            lastError: remedy ? `[${remedy.code}] ${remedy.headline}: ${remedy.body}` : (fetchError.message || 'gsc_sync_failed'),
        });
        throw fetchError;
    }

    // TODO: include date dimension in the API query for true per-day granularity.
    const upsertRows = toUpsertRows({
        clientId,
        siteUrl,
        rows,
        date: window.endDate,
    });

    const persisted = await upsertGscSearchAnalyticsRows(upsertRows);

    await updateConnectorState({
        clientId,
        provider: 'gsc',
        status: 'healthy',
        lastSyncedAt: new Date().toISOString(),
    });

    return {
        clientId,
        siteUrl,
        syncedRows: persisted.length,
        fetchedRows: rows.length,
        skipped: false,
        window,
    };
}

export async function runGscSyncForAllClients(options = {}) {
    const clients = await listClientsWithSiteUrl();
    const results = [];

    for (const client of clients) {
        try {
            const result = await runGscSyncForClient(client.id, options);
            results.push(result);
        } catch (error) {
            results.push({
                clientId: client.id,
                siteUrl: client.website_url || null,
                syncedRows: 0,
                fetchedRows: 0,
                skipped: false,
                error: error?.message || 'gsc_sync_failed',
            });
        }
    }

    return {
        totalClients: clients.length,
        succeeded: results.filter((item) => !item.error).length,
        failed: results.filter((item) => item.error).length,
        results,
    };
}
