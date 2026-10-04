'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

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

async function fetchNoStore(url, signal) {
    const response = await fetch(url, { cache: 'no-store', signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Erreur ${response.status}`);
    return data;
}

export function ClientProvider({ children, clientId }) {
    const router = useRouter();

    const [client, setClient] = useState(null);
    const [audit, setAudit] = useState(null);
    const [workspace, setWorkspace] = useState(null);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshToken, setRefreshToken] = useState(0);

    const loadClientShell = useCallback(async (id, signal) => {
        if (!id) {
            setClient(null);
            setAudit(null);
            setWorkspace(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const data = await fetchNoStore(`/api/admin/geo/client/${id}`, signal);
            if (signal?.aborted) return;
            setClient(data.client || null);
            setAudit(data.audit || null);
            setWorkspace(data.workspace || null);
        } catch (loadError) {
            if (signal?.aborted) return;
            setError(loadError.message);
            setClient(null);
            setAudit(null);
            setWorkspace(null);
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        // The effect starts an external request and keeps its loading feedback until the response.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadClientShell(clientId, controller.signal);
        return () => controller.abort();
    }, [clientId, loadClientShell, refreshToken]);
    useEffect(() => {
        const controller = new AbortController();
        fetchNoStore('/api/admin/geo/clients', controller.signal)
            .then((data) => {
                if (!controller.signal.aborted) setClients(data.clients || []);
            })
            .catch((loadError) => {
                if (!controller.signal.aborted) console.error('[ClientContext] loadClients', loadError);
            });
        return () => controller.abort();
    }, []);

    const switchClient = useCallback(
        (id) => {
            if (id) router.push(`/admin/clients/${id}`);
        },
        [router],
    );

    const invalidateWorkspace = useCallback(() => {
        setRefreshToken((v) => v + 1);
    }, []);

    const value = useMemo(
        () => ({
            client: client?.id === clientId ? client : null,
            audit: client?.id === clientId ? audit : null,
            workspace: client?.id === clientId ? workspace : null,
            clients,
            clientId,
            loading,
            error,
            isNewClientPage: false,
            refreshToken,
            switchClient,
            invalidateWorkspace,
            refetch: invalidateWorkspace,
            getInitials: (name) => getInitials(name || (client?.id === clientId ? client?.client_name : null)),
        }),
        [client, audit, workspace, clients, clientId, loading, error, refreshToken, switchClient, invalidateWorkspace],
    );

    return <ClientContext.Provider value={value}>{children}</ClientContext.Provider>;
}

export function useGeoWorkspaceSlice(slice, options = {}) {
    const { clientId, refreshToken } = useGeoClient();
    const { enabled = true, params = null } = options;
    const [data, setData] = useState(null);
    const [dataClientId, setDataClientId] = useState(null);
    const [loading, setLoading] = useState(Boolean(enabled));
    const [error, setError] = useState(null);
    const requestSequence = useRef(0);

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

    const fetchSlice = useCallback(
        async (signal) => {
            const requestId = ++requestSequence.current;
            if (!enabled || !clientId || !slice) {
                setData(null);
                setLoading(false);
                setError(null);
                return;
            }
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
                const response = await fetch(`/api/admin/geo/client/${clientId}/${slice}?${query.toString()}`, {
                    cache: 'no-store',
                    signal,
                });
                const json = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(json.error || `Erreur ${response.status}`);
                if (signal?.aborted || requestId !== requestSequence.current) return;
                setData(json);
                setDataClientId(clientId);
            } catch (fetchError) {
                if (signal?.aborted || requestId !== requestSequence.current || fetchError.name === 'AbortError')
                    return;
                setError(fetchError.message);
            } finally {
                if (!signal?.aborted && requestId === requestSequence.current) setLoading(false);
            }
        },
        [clientId, enabled, refreshToken, serializedParams, slice],
    );

    useEffect(() => {
        const controller = new AbortController();
        // Starts a cancellable external request; retain its loading/reset feedback.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchSlice(controller.signal);
        return () => controller.abort();
    }, [fetchSlice]);

    return { data: dataClientId === clientId ? data : null, loading, error, refetch: () => fetchSlice() };
}

export function useSeoWorkspaceSlice(slice, options = {}) {
    const { clientId, refreshToken } = useGeoClient();
    const { enabled = true, params = null } = options;
    const [data, setData] = useState(null);
    const [dataClientId, setDataClientId] = useState(null);
    const [loading, setLoading] = useState(Boolean(enabled));
    const [error, setError] = useState(null);
    const requestSequence = useRef(0);
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

    const fetchSlice = useCallback(
        async (signal) => {
            const requestId = ++requestSequence.current;
            if (!enabled || !clientId || !slice) {
                setData(null);
                setLoading(false);
                setError(null);
                return;
            }
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
                const response = await fetch(`/api/admin/seo/client/${clientId}/${slice}?${query.toString()}`, {
                    cache: 'no-store',
                    signal,
                });
                const json = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(json.error || `Erreur ${response.status}`);
                if (signal?.aborted || requestId !== requestSequence.current) return;
                setData(json);
                setDataClientId(clientId);
            } catch (fetchError) {
                if (signal?.aborted || requestId !== requestSequence.current || fetchError.name === 'AbortError')
                    return;
                setError(fetchError.message);
            } finally {
                if (!signal?.aborted && requestId === requestSequence.current) setLoading(false);
            }
        },
        [clientId, enabled, refreshToken, serializedParams, slice],
    );

    useEffect(() => {
        const controller = new AbortController();
        // Starts a cancellable external request; retain its loading/reset feedback.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchSlice(controller.signal);
        return () => controller.abort();
    }, [fetchSlice]);

    return { data: dataClientId === clientId ? data : null, loading, error, refetch: () => fetchSlice() };
}
