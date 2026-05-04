import { hostnameFromInput, inputMatchesHostname } from './url-hosts.js';

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const NORTH_AMERICAN_PHONE_REGEX = /(?:\+?1[\s.\-/]?)?(?:\(?[2-9]\d{2}\)?[\s.\-/]?)[2-9]\d{2}[\s.\-/]?\d{4}(?:\s*(?:#|x|ext\.?|poste)\s*\d{1,5})?/gi;
const FRENCH_PHONE_REGEX = /(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/g;
const CANADIAN_POSTAL_CODE_REGEX = /\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d\b/gi;

const TRUST_TERMS = [
    'avis', 'temoignage', 'temoignages', 'review', 'reviews', 'client depuis', 'depuis',
    'certifie', 'certifiee', 'garantie', 'recommande', 'expert', 'experts', 'experience', 'reconnu',
    'licence', 'licencie', 'assurance', 'assure', 'rbq', 'professionnel', 'professionnels',
    'annees d\'experience', 'ans d\'experience', 'fiable', 'qualite', 'satisfaction',
    'membre', 'accrédité', 'accredite', 'insured', 'licensed', 'bonded',
];

const SAAS_TERMS = [
    'logiciel', 'software', 'platform', 'plateforme', 'saas', 'demo', 'essai gratuit', 'free trial',
    'pricing', 'tarifs', 'api', 'integration', 'integrations', 'dashboard', 'login', 'connexion',
    'sign in', 'sign up', 'automation', 'workflow',
];

const LOCAL_TERMS = [
    'montreal', 'laval', 'longueuil', 'quebec', 'rive-sud', 'rive sud', 'rive-nord', 'rive nord',
    'ville', 'region', 'quartier', 'zone desservie', 'zones desservies', 'service area', 'area served',
    'secteur', 'local', 'adresse', 'bureau',
    'brossard', 'terrebonne', 'repentigny', 'blainville', 'mascouche', 'boisbriand',
    'saint-jerome', 'saint-jean', 'saint-laurent', 'saint-leonard', 'saint-hubert',
    'gatineau', 'sherbrooke', 'trois-rivieres', 'drummondville', 'granby', 'saguenay',
    'verdun', 'lasalle', 'lachine', 'anjou', 'outremont', 'westmount', 'rosemont',
    'ahuntsic', 'villeray', 'plateau', 'hochelaga', 'mercier',
    'zone d\'intervention', 'zones d\'intervention', 'secteurs desservis',
    'grand montreal', 'grande region', 'couronne nord', 'couronne sud',
    'nous desservons', 'nous couvrons', 'aire de service',
];

const FAQ_QUESTION_REGEX = /(?:^|\s)(?:q(?:uestion)?\s*:|how|what|why|when|where|who|can|should|combien|comment|pourquoi|quand|ou|qui)\b/i;
const MAX_TEXT_CHUNKS_PER_PAGE = 8;

export function normalizeWhitespace(value) {
    if (!value || typeof value !== 'string') return '';
    return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

export function uniqueStrings(values = []) {
    return [...new Set(
        values
            .filter((value) => typeof value === 'string')
            .map((value) => normalizeWhitespace(value))
            .filter(Boolean)
    )];
}

export function truncate(value, max = 220) {
    if (!value || typeof value !== 'string') return '';
    if (value.length <= max) return value;
    return `${value.slice(0, max - 3)}...`;
}

export function firstNonEmpty(...values) {
    for (const value of values) {
        const normalized = normalizeWhitespace(value);
        if (normalized) return normalized;
    }
    return '';
}

export function normalizeEmailCandidate(email) {
    if (!email || typeof email !== 'string') return '';
    return email.replace(/^mailto:/i, '').split('?')[0].replace(/[),.;:]+$/g, '').trim().toLowerCase();
}

export function normalizePhoneCandidate(phone) {
    if (!phone || typeof phone !== 'string') return '';

    const withoutScheme = phone.replace(/^tel:/i, '').split('?')[0].trim().replace(/\u00A0/g, ' ');
    if (!withoutScheme) return '';

    const extensionMatch = withoutScheme.match(/(?:#|x|ext\.?|poste)\s*(\d{1,5})$/i);
    const extension = extensionMatch?.[1] || '';
    const baseValue = extensionMatch ? withoutScheme.slice(0, extensionMatch.index).trim() : withoutScheme;
    const digits = baseValue.replace(/\D/g, '');

    if (digits.length === 11 && digits.startsWith('1')) {
        const core = digits.slice(1);
        return `+1 ${core.slice(0, 3)}-${core.slice(3, 6)}-${core.slice(6)}${extension ? ` ext ${extension}` : ''}`;
    }

    if (digits.length === 10) {
        return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}${extension ? ` ext ${extension}` : ''}`;
    }

    if (digits.length >= 9 && (/^\+33/.test(baseValue) || /^0033/.test(baseValue) || /^0/.test(baseValue))) {
        return `${baseValue.replace(/\s+/g, ' ')}${extension ? ` ext ${extension}` : ''}`.trim();
    }

    return normalizeWhitespace(withoutScheme);
}

export function collectTextChunks($) {
    const chunks = [];
    const seen = new Set();
    const selectors = ['main p', 'main li', 'article p', 'article li', 'section p', 'section li', '[role="main"] p', '[role="main"] li', 'body p', 'body li'];

    for (const selector of selectors) {
        $(selector).each((_, element) => {
            const text = normalizeWhitespace($(element).text());
            if (text.length < 45) return;
            const dedupeKey = text.toLowerCase();
            if (seen.has(dedupeKey)) return;
            seen.add(dedupeKey);
            chunks.push(text);
        });
        if (chunks.length >= MAX_TEXT_CHUNKS_PER_PAGE) break;
    }

    if (chunks.length === 0) {
        const fallback = normalizeWhitespace($('main, article, [role="main"], body').first().text());
        if (fallback) chunks.push(fallback.slice(0, 4000));
    }

    return chunks.slice(0, MAX_TEXT_CHUNKS_PER_PAGE);
}

export function extractPhonesAndEmails($) {
    const phones = new Set();
    const emails = new Set();

    $('a[href^="tel:"]').each((_, el) => {
        const tel = normalizePhoneCandidate($(el).attr('href'));
        if (tel) phones.add(tel);
    });

    $('a[href^="mailto:"]').each((_, el) => {
        const mail = normalizeEmailCandidate($(el).attr('href'));
        if (mail) emails.add(mail);
    });

    const text = normalizeWhitespace($('body').text());
    for (const match of text.match(EMAIL_REGEX) || []) {
        const normalized = normalizeEmailCandidate(match);
        if (normalized) emails.add(normalized);
    }

    for (const match of [...(text.match(NORTH_AMERICAN_PHONE_REGEX) || []), ...(text.match(FRENCH_PHONE_REGEX) || [])]) {
        const normalized = normalizePhoneCandidate(match);
        if (normalized) phones.add(normalized);
    }

    return { phones: [...phones], emails: [...emails] };
}

export function extractSocialLinks($) {
    const socials = [];
    const networks = ['facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'x.com', 'tiktok.com', 'youtube.com'];

    $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        if (networks.some((network) => inputMatchesHostname(href, network))) socials.push(href);
    });

    return uniqueStrings(socials);
}

export function inferPageType(targetUrl, title, h1, bodyText, anchorText = '') {
    const haystack = `${targetUrl} ${title} ${h1} ${anchorText} ${bodyText.slice(0, 300)}`.toLowerCase();

    if (haystack.includes('contact') || haystack.includes('nous joindre') || haystack.includes('contactez') || haystack.includes('soumission') || haystack.includes('estimation') || haystack.includes('demande de devis') || haystack.includes('demandez') || haystack.includes('nous contacter') || haystack.includes('rejoignez')) return 'contact';
    if (haystack.includes('faq') || haystack.includes('question')) return 'faq';
    if (haystack.includes('about') || haystack.includes('a propos') || haystack.includes('propos') || haystack.includes('qui sommes') || haystack.includes('notre histoire') || haystack.includes('notre equipe') || haystack.includes('notre entreprise')) return 'about';
    if (haystack.includes('pricing') || haystack.includes('tarif') || haystack.includes('price')) return 'pricing';
    if (haystack.includes('feature') || haystack.includes('fonctionnalite') || haystack.includes('features')) return 'features';
    if (haystack.includes('product') || haystack.includes('produit') || haystack.includes('platform') || haystack.includes('plateforme')) return 'product';
    if (haystack.includes('blog') || haystack.includes('article') || haystack.includes('guide')) return 'blog';
    if (haystack.includes('docs') || haystack.includes('documentation') || haystack.includes('api')) return 'docs';
    if (haystack.includes('service') || haystack.includes('prestation') || haystack.includes('solution')) return 'services';
    if (haystack.includes('ville') || haystack.includes('zone') || haystack.includes('region') || haystack.includes('secteur')) return 'location';
    return 'unknown';
}

function normalizeSchemaType(rawType) {
    if (Array.isArray(rawType)) return rawType.map((value) => normalizeWhitespace(String(value).replace(/^https?:\/\/schema.org\//i, ''))).filter(Boolean);
    if (typeof rawType === 'string') return rawType.split(',').map((value) => normalizeWhitespace(value.replace(/^https?:\/\/schema.org\//i, ''))).filter(Boolean);
    return [];
}

function normalizeAddress(address) {
    if (!address || typeof address !== 'object') return null;
    const street = firstNonEmpty(address.streetAddress, address.street);
    const city = firstNonEmpty(address.addressLocality, address.city);
    const region = firstNonEmpty(address.addressRegion, address.region);
    const postalCode = firstNonEmpty(address.postalCode, address.zip);
    const country = firstNonEmpty(address.addressCountry, address.country);
    return {
        street,
        city,
        region,
        postalCode,
        country,
        line: uniqueStrings([street, city, region, postalCode, country]).join(', '),
    };
}

function normalizeAreaServed(areaServed) {
    if (!areaServed) return [];
    if (Array.isArray(areaServed)) return uniqueStrings(areaServed.flatMap((item) => normalizeAreaServed(item)));
    if (typeof areaServed === 'string') return uniqueStrings(areaServed.split(/[,/|]/));
    if (typeof areaServed === 'object') return uniqueStrings([areaServed.name, areaServed.addressLocality, areaServed.addressRegion]);
    return [];
}

function parseFaqEntities(mainEntity, pageUrl) {
    const pairs = [];
    const entities = Array.isArray(mainEntity) ? mainEntity : [mainEntity];
    for (const entity of entities) {
        if (!entity || typeof entity !== 'object') continue;
        const question = firstNonEmpty(entity.name, entity.question, entity.headline);
        const answer = firstNonEmpty(entity.acceptedAnswer?.text, entity.acceptedAnswer?.name, entity.text, entity.answer);
        if (question && answer) {
            pairs.push({ question, answer: truncate(answer, 400), source: 'observed', extraction_source: 'schema', page_url: pageUrl });
        }
    }
    return pairs;
}

export function collectSchemaData($, pageUrl) {
    const structuredData = [];
    const schemaEntities = [];
    const faqPairs = [];
    let hasFaqSchema = false;
    let hasLocalBusinessSchema = false;
    let hasOrganizationSchema = false;

    function visitNode(node) {
        if (!node) return;
        if (Array.isArray(node)) return node.forEach(visitNode);
        if (typeof node !== 'object') return;
        if (Array.isArray(node['@graph'])) node['@graph'].forEach(visitNode);

        const types = normalizeSchemaType(node['@type']);
        if (types.length === 0) return;

        structuredData.push(node);
        if (types.some((type) => /faqpage/i.test(type))) {
            hasFaqSchema = true;
            faqPairs.push(...parseFaqEntities(node.mainEntity, pageUrl));
        }
        if (types.some((type) => /(localbusiness|professionalservice|store|restaurant|dentist|medicalclinic|plumber|electrician|hvac|roofing|autobody|autorepair|barber|beautysalon|daycare|dryclean|florist|hairsalon|homeandc|legalservice|locksmith|movingcompany|notary|petstore|realestateagent)/i.test(type))) {
            hasLocalBusinessSchema = true;
        }
        if (types.some((type) => /^organization$/i.test(type))) {
            hasOrganizationSchema = true;
        }

        const address = normalizeAddress(node.address);
        const entity = {
            type: types[0],
            types,
            name: firstNonEmpty(node.name, node.headline, node.alternateName),
            url: firstNonEmpty(node.url, pageUrl),
            telephone: firstNonEmpty(node.telephone),
            email: firstNonEmpty(node.email),
            description: firstNonEmpty(node.description),
            sameAs: Array.isArray(node.sameAs) ? uniqueStrings(node.sameAs) : [],
            areaServed: normalizeAreaServed(node.areaServed),
            address,
        };

        if (entity.name || entity.telephone || entity.email || entity.areaServed.length > 0 || entity.sameAs.length > 0 || entity.address?.line) {
            schemaEntities.push(entity);
        }
    }

    $('script[type="application/ld+json"]').each((_, el) => {
        const rawJson = $(el).html();
        if (!rawJson) return;
        try {
            visitNode(JSON.parse(rawJson));
        } catch { }
    });

    return { structuredData, schemaEntities, faqPairs, hasFaqSchema, hasLocalBusinessSchema, hasOrganizationSchema };
}

export function extractFaqPairsFromDom($, pageUrl) {
    const pairs = [];
    const seen = new Set();
    const pushPair = (question, answer, extractionSource) => {
        const normalizedQuestion = normalizeWhitespace(question);
        const normalizedAnswer = normalizeWhitespace(answer);
        if (!normalizedQuestion || !normalizedAnswer || normalizedQuestion.length < 10 || normalizedAnswer.length < 20) return;
        const key = `${normalizedQuestion.toLowerCase()}::${normalizedAnswer.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        pairs.push({ question: normalizedQuestion, answer: truncate(normalizedAnswer, 400), source: 'observed', extraction_source: extractionSource, page_url: pageUrl });
    };

    $('details').each((_, el) => pushPair($(el).find('summary').first().text(), $(el).text(), 'details'));
    $('dt').each((_, el) => pushPair($(el).text(), $(el).next('dd').text(), 'definition-list'));
    $('h2, h3, h4').each((_, el) => {
        const question = normalizeWhitespace($(el).text());
        if (!question || (!question.includes('?') && !FAQ_QUESTION_REGEX.test(question))) return;
        const blocks = [];
        let current = $(el).next();
        let depth = 0;
        while (current.length > 0 && depth < 4) {
            const tagName = (current.get(0)?.tagName || '').toLowerCase();
            if (['h2', 'h3', 'h4'].includes(tagName)) break;
            const text = normalizeWhitespace(current.text());
            if (text) blocks.push(text);
            current = current.next();
            depth += 1;
        }
        pushPair(question, blocks.join(' '), 'heading-block');
    });

    return pairs.slice(0, 8);
}

export function extractBusinessNames($, schemaEntities = []) {
    return uniqueStrings([
        ...schemaEntities.map((entity) => entity.name),
        $('meta[property="og:site_name"]').attr('content'),
        $('[itemprop="name"]').first().text(),
        $('header a[aria-label], header .logo, header [class*="logo"]').first().text(),
        $('h1').first().text(),
        $('title').text().split('|')[0],
    ]).slice(0, 6);
}

export function extractLocalSignals($, text, schemaEntities, pageUrl) {
    const addressLines = [];
    const cities = [];
    const regions = [];
    const areaServed = [];
    const mapsLinks = [];
    const localTerms = [];

    for (const entity of schemaEntities) {
        if (entity.address?.line) addressLines.push(entity.address.line);
        if (entity.address?.city) cities.push(entity.address.city);
        if (entity.address?.region) regions.push(entity.address.region);
        areaServed.push(...(entity.areaServed || []));
    }

    $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (href && isMapsLink(href)) mapsLinks.push(href);
    });
    $('address').each((_, el) => {
        const value = normalizeWhitespace($(el).text());
        if (value) addressLines.push(value);
    });

    for (const term of LOCAL_TERMS) {
        if (text.includes(term)) localTerms.push(term);
    }
    for (const match of text.match(CANADIAN_POSTAL_CODE_REGEX) || []) addressLines.push(match);
    if (pageUrl.toLowerCase().includes('/ville') || pageUrl.toLowerCase().includes('/region') || pageUrl.toLowerCase().includes('/secteur')) {
        localTerms.push('location-page-url');
        const slugMatch = pageUrl.match(/\/(?:villes?|regions?|secteurs?)\/([\w-]+)/i);
        if (slugMatch) {
            const name = decodeURIComponent(slugMatch[1]).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            if (name.length >= 3) cities.push(name);
        }
    }

    return {
        cities: uniqueStrings(cities).slice(0, 12),
        regions: uniqueStrings(regions).slice(0, 12),
        area_served: uniqueStrings(areaServed).slice(0, 16),
        address_lines: uniqueStrings(addressLines).slice(0, 12),
        maps_links: uniqueStrings(mapsLinks).slice(0, 8),
        local_terms: uniqueStrings(localTerms).slice(0, 12),
    };
}

export function extractServiceSignals($, pageType, text) {
    const services = [];
    const keywords = [];
    if (['services', 'pricing', 'features', 'product'].includes(pageType)) {
        $('h2, h3, li').each((_, el) => {
            const value = normalizeWhitespace($(el).text());
            if (!value || value.length < 8 || value.length > 120 || /[|>{}]/.test(value)) return;
            services.push(value);
        });
    }
    for (const term of [...SAAS_TERMS, 'service', 'services', 'solution', 'solutions', 'expertise', 'specialite']) {
        if (text.includes(term)) keywords.push(term);
    }
    return { services: uniqueStrings(services).slice(0, 14), keywords: uniqueStrings(keywords).slice(0, 12) };
}

export function extractTrustSignals(text, socialLinks) {
    const proofTerms = TRUST_TERMS.filter((term) => text.includes(term));
    const reviewTerms = ['avis', 'review', 'reviews', 'temoignage', 'temoignages', 'testimonial', 'testimonials'].filter((term) => text.includes(term));

    return {
        proof_terms: uniqueStrings(proofTerms),
        review_terms: uniqueStrings(reviewTerms),
        social_networks: uniqueStrings(socialLinks.map((link) => {
            if (inputMatchesHostname(link, 'facebook.com')) return 'facebook';
            if (inputMatchesHostname(link, 'instagram.com')) return 'instagram';
            if (inputMatchesHostname(link, 'linkedin.com')) return 'linkedin';
            if (inputMatchesHostname(link, 'youtube.com')) return 'youtube';
            if (inputMatchesHostname(link, 'tiktok.com')) return 'tiktok';
            if (inputMatchesHostname(link, 'twitter.com') || inputMatchesHostname(link, 'x.com')) return 'x';
            return '';
        })),
    };
}

function isMapsLink(href) {
    try {
        const parsed = new URL(href);
        const hostname = hostnameFromInput(href);
        if (inputMatchesHostname(href, 'maps.apple.com')) return true;
        if (inputMatchesHostname(href, 'goo.gl')) return parsed.pathname.toLowerCase().startsWith('/maps');
        return hostname === 'google.com' && parsed.pathname.toLowerCase().startsWith('/maps');
    } catch {
        return false;
    }
}

export function scoreLinkPriority(url, anchorText = '', keywordPages = []) {
    const haystack = `${url} ${anchorText}`.toLowerCase();
    let score = 0;
    for (const keyword of keywordPages) {
        if (haystack.includes(keyword)) score += 5;
    }
    if (haystack.includes('contact')) score += 4;
    if (haystack.includes('faq')) score += 4;
    if (haystack.includes('service')) score += 3;
    if (haystack.includes('pricing') || haystack.includes('tarif')) score += 2;
    return score;
}

export function mergeUnique(base, incoming) {
    return uniqueStrings([...(base || []), ...(incoming || [])]);
}

export function appendTextChunks(existing, incoming) {
    return uniqueStrings([...(existing || []), ...(incoming || [])]).slice(0, 40);
}

export { collectContentBlocks, scoreBlockCitability, scorePageCitability } from './citability.js';
