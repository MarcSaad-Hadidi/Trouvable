'use client';

import { Suspense } from 'react';

import GeoSignalsView from '@/features/admin/geo/GeoSignalsView';

export default function GeoSignalsPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-white/40 text-sm">Chargement des signaux…</div>}>
            <GeoSignalsView />
        </Suspense>
    );
}
