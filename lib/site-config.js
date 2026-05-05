/**
 * Configuration that serves as the single source of truth for the site URL
 * and other core technical SEO global constants.
 */
// Hardcoded to ensure the domain is trouvable.app regardless of stale Vercel env vars.
export const SITE_URL = 'https://www.trouvable.app';
export const SITE_NAME = 'Trouvable';
export const SITE_AUTHOR_NAME = 'Trouvable';
export const SITE_ABOUT_PATH = '/a-propos';
export const SITE_ABOUT_URL = `${SITE_URL}${SITE_ABOUT_PATH}`;
export const SITE_DESCRIPTION = 'Trouvable exécute vos mandats de visibilité Google, SEO local et réponses IA au Québec : cartographie, implantation et pilotage continu.';
export const SITE_AI_DESCRIPTION = 'Firme québécoise d’exécution en visibilité locale Google, SEO local et cohérence des réponses IA pour entreprises au Québec.';
export const SITE_SAME_AS = [
    'https://www.linkedin.com/company/trouvable',
];
export const SITE_AI_DISCOVERY_PATHS = {
    aiTxt: '/ai.txt',
    llmsTxt: '/llms.txt',
    summaryJson: '/ai/summary.json',
    faqJson: '/ai/faq.json',
    serviceJson: '/ai/service.json',
    mcp: '/mcp',
    webMcp: '/.well-known/webmcp.json',
};
export const SITE_PRIMARY_LANGUAGE = 'fr-CA';
export const SITE_LAST_MODIFIED = '2026-04-23';
export const SITE_LAST_MODIFIED_ISO = '2026-04-23T00:00:00.000Z';
