"use client";

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const ContactModal = dynamic(() => import('@/features/public/shared/ContactModal'), {
    ssr: false,
});

export default function LazyContactModal() {
    const [shouldMount, setShouldMount] = useState(false);

    useEffect(() => {
        const onOpen = () => setShouldMount(true);
        window.addEventListener('openContactModal', onOpen);

        return () => {
            window.removeEventListener('openContactModal', onOpen);
        };
    }, []);

    return shouldMount ? <ContactModal /> : null;
}
