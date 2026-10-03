import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { listRemediationSuggestionsForClient } from '@/lib/remediation/remediation-store';
import { normalizeRemediationSuggestionReviewItem } from '@/lib/truth/operator-review';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

    const { clientId } = await params;
    if (!clientId) {
        return NextResponse.json({ error: 'clientId manquant' }, { status: 400 });
    }

    const url = new URL(request.url);
    const type = url.searchParams.get('type') || null;

    try {
        let suggestions = await listRemediationSuggestionsForClient(clientId);

        if (type) {
            suggestions = suggestions.filter((s) => s.problem_type === type);
        }

        return NextResponse.json({
            suggestions: suggestions.map((suggestion) => ({
                ...suggestion,
                review_item: normalizeRemediationSuggestionReviewItem(suggestion),
            })),
        });
    } catch (error) {
        console.error('[API/admin/remediation/suggestions] Erreur:', error);
        return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
    }
}
