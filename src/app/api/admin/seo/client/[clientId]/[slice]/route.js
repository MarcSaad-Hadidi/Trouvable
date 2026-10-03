import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { getSeoOverviewSlice } from '@/lib/operator-intelligence/seo-overview';
import { getSeoHealthSlice } from '@/lib/operator-intelligence/seo-health';
import { getSeoContentSlice } from '@/lib/operator-intelligence/seo-content';
import { getSeoCannibalizationSlice } from '@/lib/operator-intelligence/seo-cannibalization';
import { getSeoLocalSlice } from '@/lib/operator-intelligence/seo-local';
import { getSeoActionsSlice } from '@/lib/operator-intelligence/seo-actions';
import { getSeoOpportunitiesSlice } from '@/lib/operator-intelligence/seo-opportunities';
import { getVisibilitySlice } from '@/lib/operator-intelligence/visibility';

// ──────────────────────────────────────────────────────────────
// SEO admin API — /api/admin/seo/client/[clientId]/[slice]
// Own namespace, separate from GEO.
// ──────────────────────────────────────────────────────────────

async function loadShellAudit(clientId) {
    // Reuse existing shell loader to get latest audit
    const { getOperatorWorkspaceShell } = await import('@/lib/operator-intelligence/base');
    try {
        const shell = await getOperatorWorkspaceShell(clientId);
        return shell?.audit || null;
    } catch {
        return null;
    }
}

const LOADERS = {
    overview: async (clientId) => {
        const audit = await loadShellAudit(clientId);
        return getSeoOverviewSlice(clientId, { audit });
    },
    visibility: (clientId, options = {}) => getVisibilitySlice(clientId, options),
    health: async (clientId) => {
        const audit = await loadShellAudit(clientId);
        return getSeoHealthSlice(clientId, { audit });
    },
    content: (clientId) => getSeoContentSlice(clientId),
    cannibalization: (clientId) => getSeoCannibalizationSlice(clientId),
    local: async (clientId) => {
        const audit = await loadShellAudit(clientId);
        return getSeoLocalSlice(clientId, { audit });
    },
    actions: async (clientId) => {
        const audit = await loadShellAudit(clientId);
        return getSeoActionsSlice(clientId, { audit });
    },
    opportunities: async (clientId) => {
        const audit = await loadShellAudit(clientId);
        return getSeoOpportunitiesSlice(clientId, { audit });
    },
};

function noStoreJson(payload, init = {}) {
    return NextResponse.json(payload, {
        ...init,
        headers: {
            'Cache-Control': 'no-store',
            ...(init.headers || {}),
        },
    });
}

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
    const admin = await requireAdmin();
    if (!admin) {
        return noStoreJson({ error: 'Non autorise' }, { status: 401 });
    }

    const { clientId, slice } = await params;
    if (!clientId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) {
        return noStoreJson({ error: 'ID invalide' }, { status: 400 });
    }

    const loader = LOADERS[slice];
    if (!loader) {
        return noStoreJson({ error: 'Slice SEO inconnue' }, { status: 404 });
    }

    try {
        const searchParams = new URL(request.url).searchParams;
        const data = await loader(clientId, {
            range: searchParams.get('range'),
            segment: searchParams.get('segment'),
            searchType: searchParams.get('searchType'),
            country: searchParams.get('country'),
            device: searchParams.get('device'),
            debugRaw: searchParams.get('debugRaw'),
        });
        return noStoreJson(data);
    } catch (error) {
        console.error(`[api/admin/seo/client/${clientId}/${slice}]`, error);
        return noStoreJson({ error: 'Erreur chargement tranche SEO' }, { status: 500 });
    }
}

