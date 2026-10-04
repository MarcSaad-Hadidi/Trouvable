import 'server-only';

import { NextResponse } from 'next/server';

/** JSON responses for private operator data and actions. */
export function noStoreJson(payload, init = {}) {
    return NextResponse.json(payload, {
        ...init,
        headers: {
            'Cache-Control': 'no-store',
            ...(init.headers || {}),
        },
    });
}
