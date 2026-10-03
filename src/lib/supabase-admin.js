import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Ce client utilise la clé SERVICE_ROLE, ce qui bypasse RLS.
// NE JAMAIS L'EXPOSER AU FRONTEND NI AUX ROUTES PUBLIQUES SANS CONTRÔLER L'ACCÈS.
export function getAdminSupabase() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing Supabase environment variables for Admin access.');
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    });
}
