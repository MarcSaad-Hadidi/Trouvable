import 'server-only';

import { getAdminSupabase } from '@/lib/supabase-admin';

export function db() {
    return getAdminSupabase();
}

export function getDbNowIso() {
    return new Date().toISOString();
}
