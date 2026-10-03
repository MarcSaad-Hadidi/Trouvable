import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { hasGeoSlice, loadGeoSlice } from '@/lib/operator-intelligence/geo-slice-loaders';

function buildVisibilitySliceOptions(searchParams) {
    const keys = ['range', 'segment', 'searchType', 'country', 'device', 'debugRaw'];
    const options = {};
    for (const key of keys) {
        const value = searchParams.get(key);
        if (value !== null && value !== '') {
            options[key] = value;
        }
    }
    return options;
}

function noStoreJson(payload, init = {}) {
    return NextResponse.json(payload, {
        ...init,
        headers: {
            'Cache-Control': 'no-store',
            ...(init.headers || {}),
        },
    });
}

export async function GET(request, { params }) {
    const admin = await requireAdmin();
    if (!admin) {
        return noStoreJson({ error: 'Non autorise' }, { status: 401 });
    }

    const { clientId, slice } = await params;
    if (!clientId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) {
        return noStoreJson({ error: 'ID invalide' }, { status: 400 });
    }

    if (!hasGeoSlice(slice)) {
        return noStoreJson({ error: 'Slice inconnue' }, { status: 404 });
    }

    try {
        const url = new URL(request.url);
        const visibilityOpts = slice === 'visibility' ? buildVisibilitySliceOptions(url.searchParams) : {};
        const data = await loadGeoSlice(slice, clientId, visibilityOpts);
        return noStoreJson(data);
    } catch (error) {
        console.error(`[api/admin/geo/client/${clientId}/${slice}]`, error);
        return noStoreJson({ error: 'Erreur chargement tranche' }, { status: 500 });
    }
}

