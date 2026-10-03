import 'server-only';

import { CONNECTOR_PROVIDERS } from '@/lib/continuous/constants';
import { normalizeConnectorRow } from '@/lib/connectors/contracts';
import { getAdminSupabase } from '@/lib/supabase-admin';

export async function ensureClientConnectorRows(clientId) {
    const supabase = getAdminSupabase();
    const rows = CONNECTOR_PROVIDERS.map((provider) => ({
        client_id: clientId,
        provider,
        status: 'not_connected',
        config: {},
    }));

    const { error } = await supabase
        .from('client_data_connectors')
        .upsert(rows, { onConflict: 'client_id,provider', ignoreDuplicates: true });

    if (error) {
        throw new Error(`[Connectors] ensureClientConnectorRows: ${error.message}`);
    }
}

export async function getClientConnectorRows(clientId) {
    const supabase = getAdminSupabase();

    await ensureClientConnectorRows(clientId);

    const { data, error } = await supabase
        .from('client_data_connectors')
        .select('*')
        .eq('client_id', clientId)
        .order('provider', { ascending: true });

    if (error) {
        throw new Error(`[Connectors] getClientConnectorRows: ${error.message}`);
    }

    const byProvider = new Map((data || []).map((row) => [row.provider, row]));
    return CONNECTOR_PROVIDERS.map((provider) => normalizeConnectorRow(byProvider.get(provider) || { client_id: clientId, provider }, provider));
}

export async function updateConnectorState({ clientId, provider, status, config = null, lastError = null, lastSyncedAt = undefined }) {
    const supabase = getAdminSupabase();

    const payload = {
        client_id: clientId,
        provider,
        status,
        ...(config !== null && config !== undefined ? { config } : {}),
        last_error: lastError,
        ...(lastSyncedAt !== undefined ? { last_synced_at: lastSyncedAt } : {}),
    };

    const { data, error } = await supabase
        .from('client_data_connectors')
        .upsert(payload, { onConflict: 'client_id,provider' })
        .select('*')
        .single();

    if (error) {
        throw new Error(`[Connectors] updateConnectorState: ${error.message}`);
    }

    return normalizeConnectorRow(data, provider);
}
