import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

const REPO_PATHS = {
    appLayout: path.join(REPO_ROOT, 'app', 'layout.jsx'),
    appPage: path.join(REPO_ROOT, 'app', 'page.jsx'),
    appRobotsRoute: path.join(REPO_ROOT, 'app', 'robots.txt', 'route.js'),
    appRobotsMetadata: path.join(REPO_ROOT, 'app', 'robots.js'),
    appSitemap: path.join(REPO_ROOT, 'app', 'sitemap.js'),
    publicRobots: path.join(REPO_ROOT, 'public', 'robots.txt'),
    geoSeoInjector: path.join(REPO_ROOT, 'features', 'public', 'shared', 'GeoSeoInjector.jsx'),
    faqAccordion: path.join(REPO_ROOT, 'features', 'public', 'shared', 'FaqAccordion.jsx'),
    expertisesDir: path.join(REPO_ROOT, 'app', 'expertises'),
    villesDir: path.join(REPO_ROOT, 'app', 'villes'),
};
const HOMEPAGE_PATTERN = /\b(homepage|page d accueil|page d'accueil|accueil)\b/i;
const CANONICAL_PATTERN = /\bcanonical\b/i;
const CRAWLER_PATTERN = /\b(robots|crawler|gptbot|claudebot|perplexity|llms\.txt)\b/i;

function compactString(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function uniqueStrings(values) {
    return [...new Set((Array.isArray(values) ? values : []).map((value) => compactString(value)).filter(Boolean))];
}

function buildHaystack(issue = {}) {
    return [
        issue.title,
        issue.description,
        issue.category,
        issue.dimension,
        issue.evidence,
        issue.recommendedFix,
        issue.affectedScope,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

function repoEntryExists(pathKey) {
    const targetPath = REPO_PATHS[pathKey];
    if (!targetPath) return false;

    try {
        return fs.existsSync(/*turbopackIgnore: true*/ targetPath);
    } catch {
        return false;
    }
}

function readRepoText(pathKey) {
    const targetPath = REPO_PATHS[pathKey];
    if (!targetPath) return '';

    try {
        return fs.readFileSync(/*turbopackIgnore: true*/ targetPath, 'utf8');
    } catch {
        return '';
    }
}

function isHomepageUrl(value) {
    if (!value) return false;

    try {
        const parsed = new URL(value);
        return parsed.pathname === '/' || parsed.pathname === '';
    } catch {
        return false;
    }
}

export function getCorrectionPromptCategory(issue = {}) {
    const haystack = buildHaystack(issue);

    if (/schema|json-ld|structured data/.test(haystack)) return 'schema_readiness';
    if (/llms\.txt|crawler|robots|gptbot|claudebot|perplexity/.test(haystack)) return 'citation_ai';
    if (/faq|question|content|answer/.test(haystack)) return 'content_problem';
    if (/structure|navigation|maillage|internal link|hierarchy/.test(haystack)) return 'structure_problem';
    if (/coverage|missing page|service area|location page|new page/.test(haystack)) return 'coverage_opportunity';
    return 'technical_issue';
}

function getCategoryInstruction(issueCategory) {
    if (issueCategory === 'schema_readiness') {
        return 'Verifier la generation et l injection du schema existant avant toute modification, puis corriger uniquement les blocs JSON-LD reellement lies a la preuve.';
    }

    if (issueCategory === 'citation_ai') {
        return 'Verifier d abord les regles robots, les routes techniques et les metadonnees publiques qui conditionnent l acces des crawlers et la lisibilite machine.';
    }

    if (issueCategory === 'content_problem') {
        return 'Verifier d abord la page ou le composant de contenu concerne, puis corriger seulement la partie redactionnelle ou FAQ justifiee par la preuve.';
    }

    if (issueCategory === 'structure_problem') {
        return 'Verifier la structure App Router et les composants partages relies a la page avant de toucher au rendu ou a la navigation.';
    }

    if (issueCategory === 'coverage_opportunity') {
        return 'Verifier si la couverture demandee existe deja dans le repo avant de creer ou modifier une page.';
    }

    return 'Verifier d abord la route App Router concernee, puis le composant ou helper SEO existant qui produit le signal observe.';
}

function buildRepoSignals(issueCategory, issue = {}, sourceUrl = null) {
    const verifiedPaths = [];
    const repoFacts = [];
    const validationTargets = [];
    const haystack = buildHaystack(issue);
    const homepageIssue = isHomepageUrl(sourceUrl) || HOMEPAGE_PATTERN.test(haystack);

    if (repoEntryExists('appLayout')) {
        verifiedPaths.push('app/layout.jsx');
        repoFacts.push('Chemin verifie present dans le repo: app/layout.jsx.');
    }

    if (homepageIssue && repoEntryExists('appPage')) {
        verifiedPaths.push('app/page.jsx');
        repoFacts.push('Chemin verifie present dans le repo: app/page.jsx (page d accueil App Router).');
    }

    if (issueCategory === 'schema_readiness' && repoEntryExists('geoSeoInjector')) {
        verifiedPaths.push('features/public/shared/GeoSeoInjector.jsx');
        repoFacts.push('Chemin verifie present dans le repo: features/public/shared/GeoSeoInjector.jsx.');
        validationTargets.push('Verifier la presence du JSON-LD rendu sur la page observee apres correction.');
    }

    if (issueCategory === 'citation_ai' || CRAWLER_PATTERN.test(haystack)) {
        if (repoEntryExists('appRobotsRoute')) {
            verifiedPaths.push('app/robots.txt/route.js');
            repoFacts.push('Chemin verifie present dans le repo: app/robots.txt/route.js.');
            repoFacts.push('Le repo genere /robots.txt depuis app/robots.txt/route.js.');
            validationTargets.push('Verifier la reponse generee sur /robots.txt apres correction.');
        } else if (repoEntryExists('appRobotsMetadata')) {
            verifiedPaths.push('app/robots.js');
            repoFacts.push('Chemin verifie present dans le repo: app/robots.js.');
            repoFacts.push('Le repo genere /robots.txt depuis app/robots.js.');
            validationTargets.push('Verifier la reponse generee sur /robots.txt apres correction.');
        }

        if (repoEntryExists('appSitemap')) {
            verifiedPaths.push('app/sitemap.js');
            repoFacts.push('Chemin verifie present dans le repo: app/sitemap.js.');
        }

        if (!repoEntryExists('publicRobots')) {
            repoFacts.push('Aucun fichier public/robots.txt n a ete detecte dans le repo au moment de la generation.');
        }

        if (/llms\.txt/.test(haystack)) {
            validationTargets.push('Verifier la reponse publique /llms.txt si la correction touche cette surface.');
        }
    }

    if (issueCategory === 'content_problem' && repoEntryExists('faqAccordion')) {
        verifiedPaths.push('features/public/shared/FaqAccordion.jsx');
        repoFacts.push('Chemin verifie present dans le repo: features/public/shared/FaqAccordion.jsx.');
        validationTargets.push('Verifier le rendu visible du contenu ou de la FAQ apres correction.');
    }

    if (issueCategory === 'coverage_opportunity') {
        if (repoEntryExists('expertisesDir')) {
            verifiedPaths.push('app/expertises/');
            repoFacts.push('Chemin verifie present dans le repo: app/expertises/.');
        }
        if (repoEntryExists('villesDir')) {
            verifiedPaths.push('app/villes/');
            repoFacts.push('Chemin verifie present dans le repo: app/villes/.');
        }
    }

    if (CANONICAL_PATTERN.test(haystack)) {
        const layoutContent = readRepoText('appLayout');
        if (layoutContent && /(alternates\s*:\s*{[\s\S]*canonical|canonical\s*:)/.test(layoutContent)) {
            repoFacts.push("app/layout.jsx contient deja une declaration canonique dans metadata; verifier pourquoi le rendu audite ne l expose pas avant d ajouter une seconde source.");
        }

        validationTargets.push('Verifier qu une seule balise canonical correcte est rendue sur la page observee apres correction.');
    }

    if (validationTargets.length === 0) {
        validationTargets.push('Verifier le rendu de la surface observee apres correction.');
    }

    validationTargets.push('Lancer npm run lint.');

    return {
        verifiedPaths: uniqueStrings(verifiedPaths),
        repoFacts: uniqueStrings(repoFacts),
        validationTargets: uniqueStrings(validationTargets),
    };
}

function getInspectionTargets(issueCategory, issue = {}, repoSignals = {}) {
    const liveUrl = compactString(issue.sourceUrl);
    const targets = [...uniqueStrings(repoSignals.verifiedPaths)];
    const haystack = buildHaystack(issue);

    if (issueCategory === 'citation_ai') {
        targets.push('Reponse publique /robots.txt');
    }

    if (/llms\.txt/.test(haystack)) {
        targets.push('Reponse publique /llms.txt');
    }

    if (issueCategory === 'coverage_opportunity') {
        targets.push('Route App Router correspondant a la page ou au template vise');
    }

    if (CANONICAL_PATTERN.test(haystack) || isHomepageUrl(liveUrl) || HOMEPAGE_PATTERN.test(haystack)) {
        targets.push('Route App Router correspondant a la page observee');
    }

    if (liveUrl) {
        targets.push(`URL observee: ${liveUrl}`);
    }

    if (targets.length === 0) {
        targets.push('Route App Router correspondant a la page observee');
        targets.push('app/layout.jsx');
    }

    return uniqueStrings(targets);
}

function getMissingFields(issue = {}, repoSignals = {}) {
    const missing = [
        'Fichier exact a modifier non confirme par les donnees detectees.',
        'Route ou page precise a confirmer humainement si le probleme n est pas sitewide.',
    ];

    if (!compactString(issue.sourceUrl)) {
        missing.push("URL publique exacte indisponible dans l'audit courant.");
    }

    if (!compactString(issue.recommendedFix)) {
        missing.push("Suggestion de correction existante indisponible dans la source actuelle.");
    }

    if (!compactString(issue.evidence)) {
        missing.push("Preuve textuelle detaillee indisponible dans l'audit courant.");
    }

    if (!Array.isArray(repoSignals.verifiedPaths) || repoSignals.verifiedPaths.length === 0) {
        missing.push('Aucun chemin repo verifie n a pu etre rattache automatiquement a ce probleme.');
    }

    return uniqueStrings(missing);
}

export function buildSeoHealthCorrectionPromptContext({ client, audit, issue }) {
    const category = getCorrectionPromptCategory(issue);
    const sourceUrl = compactString(issue?.sourceUrl) || compactString(audit?.resolved_url) || compactString(audit?.source_url);
    const truthState = compactString(issue?.truth_class) || 'unavailable';
    const evidenceSummary = compactString(issue?.evidence) || 'Preuve textuelle indisponible dans la lecture SEO Health.';
    const repoSignals = buildRepoSignals(category, issue, sourceUrl);

    return {
        source: {
            surface: 'seo_health',
            triggerSource: 'manual',
            auditId: audit?.id || null,
            auditCreatedAt: audit?.created_at || null,
            clientId: client?.id || null,
            clientName: compactString(client?.client_name) || 'Client non renseigne',
        },
        problem: {
            issueId: issue?.id || null,
            title: compactString(issue?.title) || 'Probleme detecte',
            description: compactString(issue?.description) || compactString(issue?.title) || 'Probleme detecte',
            category,
            severity: compactString(issue?.priority) || 'medium',
            type: compactString(issue?.category) || 'seo',
            dimension: compactString(issue?.dimension) || 'technical_seo',
            truthState,
            confidence: compactString(issue?.confidence) || 'unavailable',
        },
        evidence: {
            summary: evidenceSummary,
            recommendedFix: compactString(issue?.recommendedFix) || 'Correction existante indisponible.',
            sourceUrl,
        },
        inspectionTargets: getInspectionTargets(category, {
            ...issue,
            sourceUrl,
        }, repoSignals),
        verifiedPaths: repoSignals.verifiedPaths,
        repoFacts: repoSignals.repoFacts,
        validationTargets: repoSignals.validationTargets,
        missingFields: getMissingFields({
            ...issue,
            sourceUrl,
        }, repoSignals),
        constraints: {
            absolute: [
                'Ne pas inventer de preuve, de fichier ou de donnees manquantes.',
                'Inspect-first: comprendre les surfaces existantes avant de modifier le code.',
                'Faire un fix minimal, sans refonte hors perimetre.',
                "Ne pas modifier les donnees, l'auth, les policies RLS ou l'infrastructure sensible.",
                'Validation explicite obligatoire avant de conclure.',
            ],
            categoryInstruction: getCategoryInstruction(category),
        },
    };
}
