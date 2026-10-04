'use client';

import GeoCompareView from '@/features/admin/geo/GeoCompareView';
import AdminPageViewport from '@/features/admin/shared/layout/AdminPageViewport';

export default function GeoComparePage() {
    return (
        <AdminPageViewport>
            <GeoCompareView />
        </AdminPageViewport>
    );
}
