const STATUS_LABELS: Record<string, string> = {
    open: 'Ouvert',
    in_progress: 'En cours',
    needs_review: 'À revoir',
    pending: 'En attente',
    draft: 'Brouillon',
    done: 'Terminé',
    dismissed: 'Écarté',
    resolved: 'Résolu',
    covered: 'Couvert',
    couvert: 'Couvert',
    partial: 'Partiel',
    partiel: 'Partiel',
    faible: 'Faible',
    blocked: 'Bloqué',
    bloque: 'Bloqué',
    bloqué: 'Bloqué',
    absent: 'Absent',
    warning: 'Alerte',
    unavailable: 'Indisponible',
    unknown: 'Inconnu',
};

const PRIORITY_LABELS: Record<string, string> = {
    high: 'Priorité haute',
    medium: 'Priorité moyenne',
    low: 'Priorité basse',
};

const RELIABILITY_LABELS: Record<string, string> = {
    measured: 'Mesuré',
    observed: 'Observé',
    calculated: 'Calculé',
    derived: 'Dérivé',
    inferred: 'Inféré',
    stale: 'À rafraîchir',
    low: 'Faible',
    unavailable: 'Indisponible',
    ai_analysis: 'Analyse IA',
};

const VERDICT_LABELS: Record<string, string> = {
    bon: 'Bon',
    a_consolider: 'À consolider',
    a_reprendre: 'À reprendre',
    unavailable: 'Indisponible',
};

const CONFIDENCE_LABELS: Record<string, string> = {
    high: 'Confiance élevée',
    medium: 'Confiance moyenne',
    low: 'Confiance faible',
    unavailable: 'Confiance indisponible',
};

const SOURCE_LABELS: Record<string, string> = {
    opportunity: 'File GEO',
    readiness: 'Préparation',
    actionability: 'Actionnabilité',
    protocols: 'Protocoles',
    visibility: 'Visibilité',
    review: 'Revue',
    score_guardrail: 'Garde-fou score',
};

function normalizeToken(value?: string | null): string {
    return String(value || '').trim().toLowerCase();
}

function titleCase(text: string): string {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function humanizeToken(value?: string | null): string {
    const normalized = normalizeToken(value);
    if (!normalized) return 'Indisponible';
    return titleCase(normalized.replace(/_/g, ' '));
}

export function formatAgentStatus(value?: string | null): string {
    const normalized = normalizeToken(value);
    return STATUS_LABELS[normalized] || humanizeToken(value);
}

export function formatAgentPriority(value?: string | null): string {
    const normalized = normalizeToken(value);
    return PRIORITY_LABELS[normalized] || humanizeToken(value);
}

export function formatAgentReliability(value?: string | null): string {
    const normalized = normalizeToken(value);
    return RELIABILITY_LABELS[normalized] || humanizeToken(value);
}

export function formatAgentVerdict(value?: string | null): string {
    const normalized = normalizeToken(value);
    return VERDICT_LABELS[normalized] || humanizeToken(value);
}

export function formatAgentConfidence(value?: string | null): string {
    const normalized = normalizeToken(value);
    return CONFIDENCE_LABELS[normalized] || humanizeToken(value);
}

export function formatAgentSource(value?: string | null): string {
    const normalized = normalizeToken(value);
    return SOURCE_LABELS[normalized] || humanizeToken(value);
}

export function formatAgentCategory(value?: string | null): string {
    const compact = String(value || '').trim();
    if (!compact) return 'Catégorie non définie';
    return titleCase(compact);
}

export function toneForPriority(value?: string | null): 'critical' | 'warning' | 'neutral' {
    const normalized = normalizeToken(value);
    if (normalized === 'high') return 'critical';
    if (normalized === 'medium') return 'warning';
    return 'neutral';
}

export function toneForStatus(value?: string | null): 'critical' | 'warning' | 'ok' | 'neutral' {
    const normalized = normalizeToken(value);
    if (['bloque', 'bloqué', 'blocked', 'absent', 'failed'].includes(normalized)) return 'critical';
    if (['partiel', 'partial', 'warning', 'needs_review', 'open', 'in_progress'].includes(normalized)) return 'warning';
    if (['couvert', 'covered', 'done', 'resolved'].includes(normalized)) return 'ok';
    return 'neutral';
}

