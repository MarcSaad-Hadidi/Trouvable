'use client';

import GeoCompareView from '@/features/admin/geo/GeoCompareView';
import { useGeoClient } from '@/features/admin/shared/context/ClientContext';

export default function GeoComparePage() {
    const { clientId, client } = useGeoClient();
    return <GeoCompareView linkedClientId={clientId} linkedClientName={client?.client_name || ''} />;
}

