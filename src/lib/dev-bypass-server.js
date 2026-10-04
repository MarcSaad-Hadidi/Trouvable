import 'server-only';

import { headers } from 'next/headers';

import {
    getDevAdminIdentity,
    isDevAuthBypassAllowedForHeaders,
    isDevCloudflareBypassAllowedForHeaders,
} from '@/lib/dev-bypass';

async function getCurrentHeaders() {
    try {
        return await headers();
    } catch {
        return null;
    }
}

export async function isCurrentRequestAuthBypassEnabled() {
    const currentHeaders = await getCurrentHeaders();
    return Boolean(currentHeaders && isDevAuthBypassAllowedForHeaders(currentHeaders));
}

export async function isCurrentRequestCloudflareBypassEnabled() {
    const currentHeaders = await getCurrentHeaders();
    return Boolean(currentHeaders && isDevCloudflareBypassAllowedForHeaders(currentHeaders));
}

export async function getDevAdminForCurrentRequest() {
    return (await isCurrentRequestAuthBypassEnabled()) ? getDevAdminIdentity() : null;
}
