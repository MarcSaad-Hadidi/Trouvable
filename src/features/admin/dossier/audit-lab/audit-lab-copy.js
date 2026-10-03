/**
 * Dictionnaires de libellés français pour la page interne d'audit opérateur.
 *
 * Centralise toutes les conversions "clé backend" -> "texte lisible opérateur"
 * pour éviter la dispersion des libellés techniques dans l'UI. Toutes les
 * fonctions tolèrent l'absence de valeur et retournent un fallback lisible.
 */

const SEVERITY_LABELS = {
    critical: 'Critique',
    high: 'Élevée',
    medium: 'Moyenne',
    low: 'Faible',
    info: 'Info',
    warn: 'À surveiller',
    warning: 'À surveiller',
};

export function severityFr(value) {
    if (!value) return null;
    const key = String(value).toLowerCase();
    return SEVERITY_LABELS[key] || String(value);
}

export function severityTone(value) {
    const key = String(value || '').toLowerCase();
    if (key === 'critical' || key === 'high') return 'bad';
    if (key === 'medium' || key === 'warn' || key === 'warning') return 'warn';
    if (key === 'low' || key === 'info') return 'neutral';
    return 'neutral';
}

/**
 * Traduit un check déterministe (`status` émis par le registre Layer 1)
 * en statut opérateur lisible. Le backend utilise le vocabulaire
 * `pass | warn | fail | skip` — toute autre valeur est traitée comme
 * indéterminée.
 *
 * - OK              : test réussi (`pass`)
 * - À surveiller    : avertissement non bloquant (`warn`)
 * - Problème        : échec bloquant (`fail`)
 * - Non applicable  : check ignoré volontairement (`skip`)
 * - Indéterminé     : statut manquant ou non reconnu
 */
export function checkStatusFr(check) {
    const status = String(check?.status || '').toLowerCase();
    if (status === 'pass') return { key: 'ok', label: 'OK', tone: 'good' };
    if (status === 'warn') return { key: 'watch', label: 'À surveiller', tone: 'warn' };
    if (status === 'fail') return { key: 'problem', label: 'Problème', tone: 'bad' };
    if (status === 'skip') return { key: 'skip', label: 'Non applicable', tone: 'neutral' };

    // Rétro-compatibilité avec les anciennes entrées éventuelles qui utilisaient
    // `passed` + `severity` (audits pré-layered). Garde la page robuste pendant
    // la migration.
    if (check?.passed === true) return { key: 'ok', label: 'OK', tone: 'good' };
    if (check?.passed === false) {
        const sev = String(check.severity || '').toLowerCase();
        if (sev === 'critical' || sev === 'high') return { key: 'problem', label: 'Problème', tone: 'bad' };
        if (sev === 'medium' || sev === 'warn' || sev === 'warning') return { key: 'watch', label: 'À surveiller', tone: 'warn' };
        return { key: 'watch', label: 'À corriger', tone: 'warn' };
    }
    return { key: 'unknown', label: 'Indéterminé', tone: 'neutral' };
}

/**
 * Traduit le statut global d'une page (dérivé par `groupPageChecksByUrl`)
 * en libellé / ton opérateur.
 */
export function pageStatusFr(pageStatus) {
    switch (pageStatus) {
        case 'problem': return { key: 'problem', label: 'Problème', tone: 'bad' };
        case 'watch': return { key: 'watch', label: 'À surveiller', tone: 'warn' };
        case 'ok': return { key: 'ok', label: 'OK', tone: 'good' };
        default: return { key: 'unknown', label: 'Indéterminé', tone: 'neutral' };
    }
}

/**
 * Libellés courts pour les identifiants de checks techniques déterministes.
 * Ne remplace pas `check_id` s'il est absent de la table : on retombe sur
 * `humanizeCategoryKey`.
 */
const CHECK_ID_LABELS = {
    'technical.https': 'Connexion HTTPS',
    'technical.canonical': 'URL canonique',
    'technical.indexability': 'Indexabilité',
    'technical.render_dependency': 'Dépendance au rendu JS',
    'content.title': 'Balise title',
    'content.meta_description': 'Meta description',
    'content.h1': 'Structure H1',
    'content.heading_structure': 'Structure des titres',
    'content.substance': 'Volume de contenu',
    'ai_readiness.schema_stacking': 'Empilement de données structurées',
    'ai_readiness.faq_schema': 'Schéma FAQ',
    'ai_readiness.listicle_pattern': 'Format listicle',
    'ai_readiness.comparison_pattern': 'Format comparatif',
    'ai_readiness.howto_pattern': 'Format HowTo',
    'ai_readiness.freshness': 'Signaux de fraîcheur',
    'ai_readiness.meta_directives': 'Directives IA (meta)',
    'ai_readiness.citation_signals': 'Signaux de citation',
    'ai_readiness.entity_signals': 'Signaux d\u2019entité',
    'ai_readiness.query_optimization': 'Optimisation requêtes IA',
};

export function checkIdFr(checkId) {
    if (!checkId) return null;
    return CHECK_ID_LABELS[checkId] || humanizeCategoryKey(checkId);
}

const CATEGORY_LABELS = {
    technical: 'Technique',
    technical_seo: 'SEO technique',
    on_page: 'Optimisation on-page',
    onpage: 'Optimisation on-page',
    content: 'Contenu',
    ai: 'Intelligence artificielle',
    ai_readiness: 'Lisibilité IA',
    ai_discovery: 'Découverte IA',
    geo: 'GEO',
    geo_signals: 'Signaux GEO',
    brand: 'Marque',
    entity: 'Entité',
    brand_entity: 'Marque / entité',
    trust: 'Confiance',
    trust_stack: 'Signaux de confiance',
    local: 'Local',
    accessibility: 'Accessibilité',
    performance: 'Performance',
    structured_data: 'Données structurées',
    schema: 'Données structurées',
    metadata: 'Métadonnées',
    llms_txt: 'Fichier llms.txt',
    llms_txt_deep: 'Fichier llms.txt',
    robots: 'Robots / indexation',
    indexation: 'Indexation',
    crawl: 'Exploration',
    security: 'Sécurité',
    negative_signals: 'Signaux négatifs',
    ai_discovery_endpoints: 'Endpoints IA',
    citability: 'Citabilité',
};

/**
 * Transforme une clé brute (ex. `technical_seo`) en libellé français lisible.
 * Fallback : remplacement des underscores par des espaces et capitalisation.
 */
export function humanizeCategoryKey(key) {
    if (!key) return '—';
    const raw = String(key);
    const lower = raw.toLowerCase();
    if (CATEGORY_LABELS[lower]) return CATEGORY_LABELS[lower];
    const spaced = raw.replace(/[_\-]+/g, ' ').trim();
    if (!spaced) return raw;
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const PRIORITY_LABELS = {
    high: 'Haute',
    medium: 'Moyenne',
    low: 'Faible',
    critical: 'Critique',
};

export function priorityFr(value) {
    if (!value) return null;
    const key = String(value).toLowerCase();
    return PRIORITY_LABELS[key] || String(value);
}

const CRAWL_STRATEGY_LABELS = {
    sitemap_first: 'Sitemap en priorité',
    sitemap: 'Via sitemap',
    bfs: 'Exploration en largeur',
    seed_bfs: 'Exploration à partir d\u2019une page',
    single_page: 'Page unique',
    homepage_only: 'Page d\u2019accueil uniquement',
};

export function crawlStrategyFr(value) {
    if (!value) return null;
    const key = String(value).toLowerCase();
    return CRAWL_STRATEGY_LABELS[key] || humanizeCategoryKey(value);
}

const RENDER_STRATEGY_LABELS = {
    static_only: 'Analyse statique uniquement',
    static: 'Statique',
    render_on_demand: 'Rendu à la demande',
    render_all: 'Rendu systématique',
    hybrid: 'Rendu hybride',
    playwright: 'Rendu navigateur',
};

export function renderStrategyFr(value) {
    if (!value) return null;
    const key = String(value).toLowerCase();
    return RENDER_STRATEGY_LABELS[key] || humanizeCategoryKey(value);
}

const LLM_STATUS_LABELS = {
    available: 'Disponible',
    failed: 'Dégradée',
    degraded: 'Dégradée',
    skipped: 'Non exécutée',
    unavailable: 'Indisponible',
    pending: 'En attente',
};

export function llmStatusFr(value) {
    if (!value) return null;
    const key = String(value).toLowerCase();
    return LLM_STATUS_LABELS[key] || String(value);
}

const DIMENSION_LABELS = {
    technical_seo: 'SEO technique',
    identity_completeness: 'Identité complète',
    local_readiness: 'Ancrage local / GEO',
    ai_answerability: 'Réponse IA',
    trust_signals: 'Signaux de confiance',
};

export function dimensionLabelFr(key) {
    if (!key) return null;
    const lower = String(key).toLowerCase();
    return DIMENSION_LABELS[lower] || humanizeCategoryKey(key);
}

const SCAN_STATUS_LABELS = {
    completed: 'Terminé',
    success: 'Terminé',
    succeeded: 'Terminé',
    failed: 'Échec',
    error: 'Échec',
    running: 'En cours',
    pending: 'En attente',
    timeout: 'Délai dépassé',
};

export function scanStatusFr(value) {
    if (!value) return null;
    const key = String(value).toLowerCase();
    return SCAN_STATUS_LABELS[key] || String(value);
}
