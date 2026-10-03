import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase-admin';

/**
 * Endpoint interne opérateur — historique d'audits pour un client.
 *
 * Retourne jusqu'aux `limit` derniers audits persistés (par défaut 6), avec
 * juste assez de champs pour alimenter la Section E « Comparaison » sans
 * re-télécharger l'intégralité du JSON (surtout `extracted_data` qui peut
 * peser plusieurs Mo). Utilisé en mode « audit actuel vs audit précédent ».
 */
export async function GET(_request, { params }) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { clientId } = await params;
    if (!clientId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) {
        return NextResponse.json({ error: 'Identifiant client invalide' }, { status: 400 });
    }

    const url = new URL(_request.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '6', 10) || 6, 2), 20);

    const supabase = getAdminSupabase();
    const { data, error } = await supabase
        .from('client_site_audits')
        .select('id, created_at, scan_status, source_url, resolved_url, seo_score, geo_score, geo_breakdown, issues, strengths, scanned_pages')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const audits = (data || [])
        .filter((row) => row && row.scan_status !== 'failed')
        .map((row) => ({
            id: row.id,
            createdAt: row.created_at,
            scanStatus: row.scan_status,
            sourceUrl: row.source_url,
            resolvedUrl: row.resolved_url,
            seoScore: row.seo_score,
            geoScore: row.geo_score,
            hybridScore: row?.geo_breakdown?.overall?.hybrid_score ?? null,
            deterministicScore: row?.geo_breakdown?.overall?.deterministic_score ?? null,
            classification: row?.geo_breakdown?.site_classification
                ? {
                    type: row.geo_breakdown.site_classification.type || null,
                    label: row.geo_breakdown.site_classification.label || null,
                    confidence: row.geo_breakdown.site_classification.confidence || null,
                }
                : null,
            dimensions: Array.isArray(row?.geo_breakdown?.dimensions)
                ? row.geo_breakdown.dimensions.map((dim) => ({
                    key: String(dim.key || dim.id || '').toLowerCase(),
                    score: typeof dim.score === 'number' ? dim.score : null,
                    applicability: dim.applicability || null,
                }))
                : [],
            issues: Array.isArray(row?.issues)
                ? row.issues.slice(0, 8).map((issue) => ({
                    id: issue.id || issue.code || null,
                    title: issue.title || issue.message || null,
                    severity: issue.severity || issue.priority || null,
                    category: issue.category || null,
                    dimension: issue.dimension || null,
                }))
                : [],
            strengths: Array.isArray(row?.strengths)
                ? row.strengths.slice(0, 6).map((strength) => ({
                    id: strength.id || strength.code || null,
                    title: strength.title || strength.message || null,
                    category: strength.category || null,
                    dimension: strength.dimension || null,
                }))
                : [],
            pagesScanned: Array.isArray(row?.scanned_pages) ? row.scanned_pages.length : 0,
            pagesSuccessful: Array.isArray(row?.scanned_pages)
                ? row.scanned_pages.filter((page) => page?.success).length
                : 0,
        }));

    return NextResponse.json({
        generatedAt: new Date().toISOString(),
        count: audits.length,
        audits,
    });
}
