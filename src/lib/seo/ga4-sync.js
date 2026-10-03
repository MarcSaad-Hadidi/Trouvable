import 'server-only';

import { fetchGa4TrafficDaily, fetchGa4TopPages } from '@/lib/connectors/providers/ga4';
import { getClientById } from '@/lib/db/clients';
import { getClientConnectorRows, updateConnectorState } from '@/lib/connectors/repository';
import { upsertGa4TrafficDailyRows, upsertGa4TopPagesRows } from '@/lib/db/ga4';

function dateToYmd(date) {
    return date.toISOString().slice(0, 10);
}

function resolveWindow({ startDate, endDate } = {}) {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
        ? new Date(startDate)
        : new Date(end.getTime() - 27 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error('Invalid GA4 sync window.');
    }

    return {
        startDate: dateToYmd(start),
        endDate: dateToYmd(end),
    };
}

export async function runGa4SyncForClient(clientId, options = {}) {
    const client = await getClientById(clientId);
    if (!client) {
        return {
            clientId,
            propertyId: null,
            skipped: true,
            reason: 'client_not_found',
        };
    }

    const connectorRows = await getClientConnectorRows(clientId);
    const ga4Row = connectorRows.find((row) => row.provider === 'ga4');
    const propertyId = ga4Row?.config?.propertyId || null;

    if (!propertyId) {
        return {
            clientId,
            propertyId: null,
            skipped: true,
            reason: 'missing_property_id',
        };
    }

    const skipStatuses = ['disabled', 'not_connected', 'sample_mode'];
    if (ga4Row?.status && skipStatuses.includes(ga4Row.status)) {
        return {
            clientId,
            propertyId,
            skipped: true,
            reason: `connector_status_${ga4Row.status}`,
        };
    }

    const googleRefreshToken = ga4Row?.config?.google_refresh_token;
    if (!googleRefreshToken) {
        return {
            clientId,
            propertyId,
            skipped: true,
            reason: 'missing_google_refresh_token',
        };
    }

    const window = resolveWindow(options);

    let trafficRows;
    let pageRows;
    try {
        [trafficRows, pageRows] = await Promise.all([
            fetchGa4TrafficDaily({ propertyId, startDate: window.startDate, endDate: window.endDate, googleRefreshToken }),
            fetchGa4TopPages({ propertyId, startDate: window.startDate, endDate: window.endDate, limit: 50, googleRefreshToken }),
        ]);
    } catch (fetchError) {
        await updateConnectorState({
            clientId,
            provider: 'ga4',
            status: 'error',
            lastError: fetchError.message,
        });
        throw fetchError;
    }

    const trafficUpsertRows = (trafficRows || [])
        .filter((row) => row.date)
        .map((row) => ({
            client_id: clientId,
            property_id: propertyId,
            date: row.date,
            sessions: Number(row.sessions || 0),
            users: Number(row.users || 0),
            new_users: Number(row.new_users || 0),
            page_views: Number(row.page_views || 0),
        }));

    const pageUpsertRows = (pageRows || [])
        .filter((row) => row.landing_page)
        .map((row) => ({
            client_id: clientId,
            property_id: propertyId,
            period_end: window.endDate,
            landing_page: String(row.landing_page).slice(0, 2048),
            sessions: Number(row.sessions || 0),
            users: Number(row.users || 0),
        }));

    const [persistedTraffic, persistedPages] = await Promise.all([
        upsertGa4TrafficDailyRows(trafficUpsertRows),
        upsertGa4TopPagesRows(pageUpsertRows),
    ]);

    await updateConnectorState({
        clientId,
        provider: 'ga4',
        status: 'healthy',
        lastSyncedAt: new Date().toISOString(),
    });

    return {
        clientId,
        propertyId,
        skipped: false,
        syncedTrafficRows: persistedTraffic.length,
        syncedPageRows: persistedPages.length,
        fetchedTrafficRows: trafficRows.length,
        fetchedPageRows: pageRows.length,
        window,
    };
}
