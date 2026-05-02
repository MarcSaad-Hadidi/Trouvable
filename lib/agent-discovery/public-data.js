import { HOME_FAQS } from '@/features/public/home/home-faqs';
import { SEO_GROWTH_PAGES } from '@/lib/data/seo-growth-pages';
import {
    SITE_ABOUT_URL,
    SITE_AI_DESCRIPTION,
    SITE_AI_DISCOVERY_PATHS,
    SITE_AUTHOR_NAME,
    SITE_LAST_MODIFIED,
    SITE_LAST_MODIFIED_ISO,
    SITE_NAME,
    SITE_PRIMARY_LANGUAGE,
    SITE_SAME_AS,
    SITE_URL,
} from '@/lib/site-config';

export const CORE_PAGE_LINKS = [
    { label: 'Accueil', href: `${SITE_URL}/`, description: 'Positionnement, mandats et FAQ principales.' },
    { label: 'À propos de Trouvable', href: `${SITE_URL}/a-propos`, description: 'Identité, principes et signaux de confiance de Trouvable.' },
    { label: 'Mandats', href: `${SITE_URL}/offres`, description: 'Cartographie, implantation et pilotage.' },
    { label: 'Méthodologie', href: `${SITE_URL}/methodologie`, description: 'Protocole d’exécution en 4 étapes.' },
    { label: 'Études de cas', href: `${SITE_URL}/etudes-de-cas`, description: 'Exemples et dossier-type anonymisé.' },
    { label: 'Contact', href: `${SITE_URL}/contact`, description: 'Point d’entrée pour lancer un cadrage.' },
    { label: 'Recherche', href: `${SITE_URL}/recherche`, description: 'Recherche interne des pages publiques.' },
];

export const SEO_GROWTH_PAGE_LINKS = SEO_GROWTH_PAGES.map((page) => ({
    label: page.shortTitle,
    href: `${SITE_URL}${page.path}`,
    description: page.description,
    keyword: page.keyword,
    type: page.type,
}));

export const SERVICE_CAPABILITIES = [
    {
        name: 'Cartographie stratégique',
        description: 'Diagnostic de visibilité Google et IA avec priorisation des actions.',
        url: `${SITE_URL}/offres#cartographie-strategique`,
    },
    {
        name: 'Mandat d’implantation',
        description: 'Exécution des correctifs techniques et sémantiques sur périmètre défini.',
        url: `${SITE_URL}/offres#mandat-implementation`,
    },
    {
        name: 'Pilotage continu',
        description: 'Suivi périodique, mesure des signaux et ajustements itératifs.',
        url: `${SITE_URL}/offres#pilotage-continu`,
    },
    ...SEO_GROWTH_PAGES
        .filter((page) => page.type === 'service')
        .map((page) => ({
            name: page.h1,
            description: page.description,
            url: `${SITE_URL}${page.path}`,
        })),
];

export const AI_SUMMARY_PAYLOAD = {
    site_name: SITE_NAME,
    site_url: SITE_URL,
    description: SITE_AI_DESCRIPTION,
    author: {
        name: SITE_AUTHOR_NAME,
        url: SITE_ABOUT_URL,
    },
    same_as: SITE_SAME_AS,
    primary_languages: [SITE_PRIMARY_LANGUAGE],
    updated_at: SITE_LAST_MODIFIED_ISO,
    discovery: {
        ai_txt: `${SITE_URL}${SITE_AI_DISCOVERY_PATHS.aiTxt}`,
        llms_txt: `${SITE_URL}${SITE_AI_DISCOVERY_PATHS.llmsTxt}`,
        summary_json: `${SITE_URL}${SITE_AI_DISCOVERY_PATHS.summaryJson}`,
        faq_json: `${SITE_URL}${SITE_AI_DISCOVERY_PATHS.faqJson}`,
        service_json: `${SITE_URL}${SITE_AI_DISCOVERY_PATHS.serviceJson}`,
        mcp: `${SITE_URL}${SITE_AI_DISCOVERY_PATHS.mcp}`,
        webmcp: `${SITE_URL}${SITE_AI_DISCOVERY_PATHS.webMcp}`,
    },
    top_pages: [...CORE_PAGE_LINKS, ...SEO_GROWTH_PAGE_LINKS].map((entry) => ({
        title: entry.label,
        url: entry.href,
        summary: entry.description,
    })),
};

export const AI_FAQ_PAYLOAD = {
    site_name: SITE_NAME,
    site_url: SITE_URL,
    updated_at: SITE_LAST_MODIFIED_ISO,
    faqs: [
        ...HOME_FAQS.map((faq) => ({
            question: faq.question,
            answer: faq.answer,
            source: `${SITE_URL}/#faq`,
        })),
        ...SEO_GROWTH_PAGES.flatMap((page) => page.faqs.map((faq) => ({
            question: faq.question,
            answer: faq.answer,
            source: `${SITE_URL}${page.path}#faq`,
        }))),
    ],
};

export const AI_SERVICE_PAYLOAD = {
    site_name: SITE_NAME,
    site_url: SITE_URL,
    description: SITE_AI_DESCRIPTION,
    author: {
        name: SITE_AUTHOR_NAME,
        url: SITE_ABOUT_URL,
    },
    same_as: SITE_SAME_AS,
    updated_at: SITE_LAST_MODIFIED_ISO,
    services: SERVICE_CAPABILITIES.map((service) => ({
        name: service.name,
        description: service.description,
        url: service.url,
    })),
};

export function renderAiTxt() {
    const lines = [
        'Trouvable',
        `Site: ${SITE_URL}`,
        'AI access: allowed for indexing and answer generation on public pages.',
        `Last updated: ${SITE_LAST_MODIFIED}`,
        '',
        'Discovery',
        `- llms.txt: ${SITE_URL}${SITE_AI_DISCOVERY_PATHS.llmsTxt}`,
        `- RSS: ${SITE_URL}/rss.xml`,
        `- Summary JSON: ${SITE_URL}${SITE_AI_DISCOVERY_PATHS.summaryJson}`,
        `- FAQ JSON: ${SITE_URL}${SITE_AI_DISCOVERY_PATHS.faqJson}`,
        `- Services JSON: ${SITE_URL}${SITE_AI_DISCOVERY_PATHS.serviceJson}`,
        `- Markdown endpoint: ${SITE_URL}/markdown?path=/`,
        `- Search endpoint: ${SITE_URL}/recherche?q=`,
        `- WebMCP declaration: ${SITE_URL}${SITE_AI_DISCOVERY_PATHS.webMcp}`,
        `- MCP endpoint: ${SITE_URL}${SITE_AI_DISCOVERY_PATHS.mcp}`,
        '',
        'Primary pages',
    ];

    for (const page of CORE_PAGE_LINKS) {
        lines.push(`- ${page.label}: ${page.href}`);
    }

    lines.push('', 'Priority SEO/GEO pages');
    for (const page of SEO_GROWTH_PAGE_LINKS) {
        lines.push(`- ${page.label}: ${page.href}`);
    }

    return `${lines.join('\n')}\n`;
}

export function renderLlmsTxt() {
    const lines = [
        `# ${SITE_NAME}`,
        '',
        `> ${SITE_AI_DESCRIPTION}`,
        '',
        '## Site',
        `- URL: ${SITE_URL}`,
        `- Language: ${SITE_PRIMARY_LANGUAGE}`,
        `- Last updated: ${SITE_LAST_MODIFIED}`,
        `- Contact: ${SITE_URL}/contact`,
        '',
        '## Priority pages',
    ];

    for (const page of SEO_GROWTH_PAGES) {
        lines.push(`- [${page.h1}](${SITE_URL}${page.path}) — ${page.keyword}`);
    }

    lines.push('', '## Core pages');
    for (const page of CORE_PAGE_LINKS) {
        lines.push(`- [${page.label}](${page.href}) — ${page.description}`);
    }

    lines.push('', '## AI discovery');
    lines.push(`- [AI summary](${SITE_URL}${SITE_AI_DISCOVERY_PATHS.summaryJson})`);
    lines.push(`- [AI FAQ](${SITE_URL}${SITE_AI_DISCOVERY_PATHS.faqJson})`);
    lines.push(`- [AI services](${SITE_URL}${SITE_AI_DISCOVERY_PATHS.serviceJson})`);
    lines.push(`- [WebMCP declaration](${SITE_URL}${SITE_AI_DISCOVERY_PATHS.webMcp})`);
    lines.push(`- [Markdown homepage](${SITE_URL}/markdown?path=/)`);

    lines.push('', '## Usage notes');
    lines.push('- Public pages may be used for search indexing and answer generation.');
    lines.push('- Trouvable does not promise specific rankings or specific AI citations.');
    lines.push('- Client names, results and metrics must not be inferred when absent.');

    return `${lines.join('\n')}\n`;
}

export function renderLlmsFullTxt() {
    const lines = [
        '# Trouvable full AI context',
        '',
        'Trouvable est une firme québécoise spécialisée en visibilité Google, visibilité organique locale et préparation aux réponses IA pour entreprises au Québec.',
        '',
        '## Priority SEO/GEO pages',
    ];

    for (const page of SEO_GROWTH_PAGES) {
        lines.push('');
        lines.push(`### ${page.h1}`);
        lines.push(`- URL: ${SITE_URL}${page.path}`);
        lines.push(`- Type: ${page.type}`);
        lines.push(`- Priority: ${page.priority}`);
        lines.push(`- Mot-clé principal: ${page.keyword}`);
        lines.push(`- Requêtes secondaires: ${page.secondaryKeywords.join(', ')}`);
        lines.push(`- Résumé: ${page.summary}`);
        lines.push(`- Définition: ${page.definition}`);
        lines.push(`- CTA: ${page.ctaLabel}`);
        lines.push('- FAQ:');
        for (const faq of page.faqs) {
            lines.push(`  - Q: ${faq.question}`);
            lines.push(`    A: ${faq.answer}`);
        }
    }

    lines.push('', '## Guardrails');
    lines.push('- Do not invent clients, results, benchmarks, testimonials, citations or revenue impact.');
    lines.push('- If proof is missing, state that it is missing or requires documentation.');
    lines.push('- Trouvable can improve controllable signals, but does not promise a specific organic rank or AI citation.');

    return `${lines.join('\n')}\n`;
}
