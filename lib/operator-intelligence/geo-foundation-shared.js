import 'server-only';

import { getLatestAudit as dbGetLatestAudit } from '@/lib/db/audits';
import { normalizeClientProfileShape } from '@/lib/client-profile';
import { mapProvenanceToReliability } from '@/lib/operator-intelligence/reliability';
import { getAdminSupabase } from '@/lib/supabase-admin';

export function toArray(value) {
    return Array.isArray(value) ? value : [];
}

export function compactString(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function timeSince(value) {
    if (!value) return null;

    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) return null;

    const diff = Date.now() - timestamp;
    const hours = Math.floor(diff / 3600000);

    if (hours < 1) return '< 1h';
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}j`;
}

export function normalizeComparableText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

export function normalizeComparableUrl(value) {
    const compact = compactString(value);
    if (!compact) return '';

    try {
        const parsed = new URL(compact);
        const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
        const pathname = parsed.pathname.replace(/\/+$/, '');
        return `${host}${pathname}`;
    } catch {
        return compact.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
    }
}

export function normalizeComparablePhone(value) {
    return String(value || '').replace(/\D+/g, '');
}

export function findAuditItem(audit, matcher) {
    const issue = toArray(audit?.issues).find((item) => matcher(item));
    if (issue) return { kind: 'issue', item: issue };

    const strength = toArray(audit?.strengths).find((item) => matcher(item));
    if (strength) return { kind: 'strength', item: strength };

    return null;
}

export function auditItemReliability(item) {
    return mapProvenanceToReliability(item?.provenance || item?.truth_class);
}

const AUDIT_COPY_EXACT = new Map([
    ['AI crawlers can access the site', 'Les crawlers IA peuvent accéder au site'],
    ['Critical AI crawlers are blocked', 'Des crawlers IA critiques sont bloqués'],
    ['No critical AI crawlers are blocked via robots.txt.', 'Aucun crawler IA critique n’est bloqué via robots.txt.'],
    ['robots.txt is present and allows major AI crawlers.', 'robots.txt est présent et n’indique pas de blocage sur les principaux crawlers IA.'],
    ['Local schema is present', 'Le schema local est présent'],
    ['Structured local business data was observed.', 'Des données structurées de type activité locale ont été observées.'],
    ['Observed LocalBusiness-style JSON-LD.', 'Un JSON-LD de type LocalBusiness a été observé.'],
    ['Local schema is missing for a locally relevant site', 'Le schema local manque pour un site à enjeu local'],
    ['No LocalBusiness-style schema was observed in JSON-LD.', 'Aucun schema de type LocalBusiness n’a été observé dans le JSON-LD.'],
    [
        'The crawl did not observe LocalBusiness-style schema even though the detected site type has local recommendation relevance.',
        'Le crawl n’a pas observé de schema de type LocalBusiness alors que le site présente une pertinence locale.',
    ],
    [
        'Add schema that exposes the business type, public contact details, and local footprint.',
        'Ajouter un schema qui expose le type d’activité, les coordonnées publiques et l’ancrage local.',
    ],
    [
        'Review robots.txt directives for GPTBot, ClaudeBot, PerplexityBot, and other AI crawlers. Allow them unless there is a strong reason to block.',
        'Relire les directives robots.txt pour GPTBot, ClaudeBot, PerplexityBot et les autres crawlers IA. Les autoriser sauf raison forte de blocage.',
    ],
]);

export function localizeAuditCopy(value) {
    const compact = compactString(value);
    if (!compact) return null;

    if (AUDIT_COPY_EXACT.has(compact)) {
        return AUDIT_COPY_EXACT.get(compact);
    }

    let match = compact.match(/^(\d+) critical AI crawler\(s\) are blocked via robots\.txt, which prevents inclusion in AI-generated answers\.$/i);
    if (match) {
        return `${match[1]} crawler(s) IA critique(s) sont bloqués via robots.txt, ce qui limite leur exposition dans les réponses générées par IA.`;
    }

    match = compact.match(/^Blocked:\s+(.+)\.$/i);
    if (match) {
        return `Bloqués : ${match[1]}.`;
    }

    match = compact.match(/^No robots\.txt found/i);
    if (match) {
        return 'Aucun robots.txt observé : les crawlers IA ne sont pas explicitement bloqués.';
    }

    match = compact.match(/^(\d+)\sFAQ\/QA pair\(s\) extracted\.$/i);
    if (match) {
        return `${match[1]} paire(s) FAQ/QA extraite(s).`;
    }

    return compact;
}

export async function getGeoFoundationContext(clientId) {
    const supabase = getAdminSupabase();

    const [{ data: clientRow, error: clientError }, audit] = await Promise.all([
        supabase
            .from('client_geo_profiles')
            .select('*')
            .eq('id', clientId)
            .maybeSingle(),
        dbGetLatestAudit(clientId).catch(() => null),
    ]);

    if (clientError) {
        throw new Error(`[OperatorIntelligence/geo-foundation] client: ${clientError.message}`);
    }

    return {
        client: clientRow ? normalizeClientProfileShape(clientRow) : null,
        audit: audit || null,
    };
}
