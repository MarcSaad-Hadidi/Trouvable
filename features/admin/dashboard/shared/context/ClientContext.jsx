'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const ClientContext = createContext(null);

export function useGeoClient() {
    return useContext(ClientContext);
}

function getInitials(name) {
    if (!name || typeof name !== 'string') return '-';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2);
    return name.slice(0, 2).toUpperCase();
}

async function fetchNoStore(url) {
    const response = await fetch(url, { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Erreur ${response.status}`);
    return data;
}

export function ClientProvider({ children, clientId }) {
    const pathname = usePathname();
    const router = useRouter();

    const [client, setClient] = useState(null);
    const [audit, setAudit] = useState(null);
    const [workspace, setWorkspace] = useState(null);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshToken, setRefreshToken] = useState(0);

    const loadClientShell = useCallback(async (id) => {
        if (!id) { setClient(null); setAudit(null); setWorkspace(null); setLoading(false); return; }
        setLoading(true);
        setError(null);
        try {
            const data = await fetchNoStore(`/api/admin/geo/client/${id}`);
            setClient(data.client || null);
            setAudit(data.audit || null);
            setWorkspace(data.workspace || null);
        } catch (loadError) {
            setError(loadError.message);
            setClient(null); setAudit(null); setWorkspace(null);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadClients = useCallback(async () => {
        try {
            const data = await fetchNoStore('/api/admin/geo/clients');
            setClients(data.clients || []);
        } catch (loadError) {
            console.error('[ClientContext] loadClients', loadError);
        }
    }, []);

    useEffect(() => { loadClientShell(clientId); }, [clientId, loadClientShell, refreshToken]);
    useEffect(() => { loadClients(); }, [loadClients]);

    const switchClient = useCallback((id) => {
        if (id) router.push(`/admin/clients/${id}`);
    }, [router]);

    const invalidateWorkspace = useCallback(() => {
        setRefreshToken((v) => v + 1);
    }, []);

    const value = useMemo(() => ({
        client,
        audit,
        workspace,
        clients,
        clientId,
        loading,
        error,
        isNewClientPage: false,
        refreshToken,
        switchClient,
        invalidateWorkspace,
        refetch: invalidateWorkspace,
        getInitials: (name) => getInitials(name || client?.client_name),
    }), [client, audit, workspace, clients, clientId, loading, error, refreshToken, switchClient, invalidateWorkspace]);

    return <ClientContext.Provider value={value}>{children}</ClientContext.Provider>;
}

export function useGeoWorkspaceSlice(slice, options = {}) {
    const { clientId, refreshToken } = useGeoClient();
    const { enabled = true, params = null } = options;
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(Boolean(enabled));
    const [error, setError] = useState(null);

    const serializedParams = useMemo(() => {
        if (!params || typeof params !== 'object') return '';
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null || value === '') continue;
            if (Array.isArray(value)) {
                value.forEach((item) => {
                    if (item === undefined || item === null || item === '') return;
                    searchParams.append(key, String(item));
                });
                continue;
            }
            searchParams.set(key, String(value));
        }
        return searchParams.toString();
    }, [params]);

    const fetchSlice = useCallback(async (signal) => {
        if (!enabled || !clientId || !slice) { setData(null); setLoading(false); setError(null); return; }
        setLoading(true);
        setError(null);
        try {
            const query = new URLSearchParams();
            query.set('refresh', String(refreshToken));
            if (serializedParams) {
                const next = new URLSearchParams(serializedParams);
                for (const [key, value] of next.entries()) {
                    query.set(key, value);
                }
            }
            const response = await fetch(`/api/admin/geo/client/${clientId}/${slice}?${query.toString()}`, { cache: 'no-store', signal });
            const json = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(json.error || `Erreur ${response.status}`);
            setData(json);
        } catch (fetchError) {
            if (fetchError.name === 'AbortError') return;
            setError(fetchError.message);
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, [clientId, enabled, refreshToken, serializedParams, slice]);

    useEffect(() => {
        const controller = new AbortController();
        fetchSlice(controller.signal);
        return () => controller.abort();
    }, [fetchSlice]);

    return { data, loading, error, refetch: () => fetchSlice() };
}

export function useSeoWorkspaceSlice(slice, options = {}) {
    const { clientId, refreshToken } = useGeoClient();
    const { enabled = true, params = null } = options;
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(Boolean(enabled));
    const [error, setError] = useState(null);
    const serializedParams = useMemo(() => {
        if (!params || typeof params !== 'object') return '';
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null || value === '') continue;
            if (Array.isArray(value)) {
                value.forEach((item) => {
                    if (item === undefined || item === null || item === '') return;
                    searchParams.append(key, String(item));
                });
                continue;
            }
            searchParams.set(key, String(value));
        }
        return searchParams.toString();
    }, [params]);

    const fetchSlice = useCallback(async (signal) => {
        if (!enabled || !clientId || !slice) { setData(null); setLoading(false); setError(null); return; }
        setLoading(true);
        setError(null);
        try {
            const query = new URLSearchParams();
            query.set('refresh', String(refreshToken));
            if (serializedParams) {
                const next = new URLSearchParams(serializedParams);
                for (const [key, value] of next.entries()) {
                    query.set(key, value);
                }
            }
            const response = await fetch(`/api/admin/seo/client/${clientId}/${slice}?${query.toString()}`, { cache: 'no-store', signal });
            const json = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(json.error || `Erreur ${response.status}`);
            setData(json);
        } catch (fetchError) {
            if (fetchError.name === 'AbortError') return;
            setError(fetchError.message);
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, [clientId, enabled, refreshToken, serializedParams, slice]);

    useEffect(() => {
        const controller = new AbortController();
        fetchSlice(controller.signal);
        return () => controller.abort();
    }, [fetchSlice]);

    return { data, loading, error, refetch: () => fetchSlice() };
}
