import React from 'react';
import { SITE_PHONE_TEL } from '@/lib/site-contact';
import {
    SITE_ABOUT_URL,
    SITE_AI_DESCRIPTION,
    SITE_AUTHOR_NAME,
    SITE_LAST_MODIFIED_ISO,
    SITE_NAME,
    SITE_PRIMARY_LANGUAGE,
    SITE_SAME_AS,
    SITE_URL,
} from '@/lib/site-config';

const SCHEMA_CONTEXT = 'https://schema.org';

const VALID_BUSINESS_TYPES = new Set([
    'LocalBusiness',
    'Store',
    'Restaurant',
    'ProfessionalService',
    'HomeAndConstructionBusiness',
    'LegalService',
    'MedicalBusiness',
    'HealthAndBeautyBusiness',
    'AutomotiveBusiness',
    'RealEstateAgent',
    'FinancialService',
    'FoodEstablishment',
    'AnimalShelter',
    'ChildCare',
    'DryCleaningOrLaundry',
    'EmergencyService',
    'EmploymentAgency',
    'EntertainmentBusiness',
    'Library',
    'LodgingBusiness',
    'RadioStation',
    'SelfStorage',
    'SportsActivityLocation',
    'TelevisionStation',
    'TouristInformationCenter',
    'TravelAgency',
]);

function normalizeText(value) {
    if (typeof value !== 'string') return '';
    return value.trim();
}

function compactValue(value) {
    if (Array.isArray(value)) {
        const items = value
            .map((entry) => compactValue(entry))
            .filter((entry) => entry !== undefined);
        return items.length > 0 ? items : undefined;
    }

    if (value && typeof value === 'object') {
        const result = {};
        for (const [key, entry] of Object.entries(value)) {
            const compacted = compactValue(entry);
            if (compacted !== undefined) result[key] = compacted;
        }
        return Object.keys(result).length > 0 ? result : undefined;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }

    if (value === null || value === undefined) return undefined;
    return value;
}

function toAbsoluteUrl(baseUrl, pathOrUrl) {
    if (!pathOrUrl) return undefined;
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    if (!baseUrl) return undefined;
    if (pathOrUrl.startsWith('/')) return `${baseUrl}${pathOrUrl}`;
    return `${baseUrl}/${pathOrUrl}`;
}

function normalizeFaqs(faqs) {
    if (!Array.isArray(faqs)) return [];
    return faqs
        .map((faq) => ({
            question: normalizeText(faq?.question || faq?.q || ''),
            answer: normalizeText(faq?.answer || faq?.a || ''),
        }))
        .filter((faq) => faq.question && faq.answer);
}

function buildAddressSchema(address) {
    if (!address || typeof address !== 'object') return undefined;

    return compactValue({
        '@type': 'PostalAddress',
        streetAddress: address.street,
        addressLocality: address.city,
        postalCode: address.postalCode,
        addressRegion: address.region,
        addressCountry: address.country,
    });
}

function buildFaqSchema(faqs) {
    const normalizedFaqs = normalizeFaqs(faqs);
    if (normalizedFaqs.length === 0) return undefined;

    return compactValue({
        '@type': 'FAQPage',
        mainEntity: normalizedFaqs.map((faq) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: faq.answer,
            },
        })),
    });
}

function buildBreadcrumbSchema(items, baseUrl) {
    if (!Array.isArray(items)) return undefined;

    const breadcrumbItems = items
        .map((item) => ({
            name: normalizeText(item?.name || ''),
            url: toAbsoluteUrl(baseUrl, item?.url || ''),
        }))
        .filter((item) => item.name && item.url);

    if (breadcrumbItems.length === 0) return undefined;

    return compactValue({
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: item.url,
        })),
    });
}

function buildOrganizationSchema(baseUrl, address, dateModified) {
    return compactValue({
        '@type': 'Organization',
        '@id': `${baseUrl}#organization`,
        name: SITE_NAME,
        url: baseUrl,
        logo: `${baseUrl}/logos/trouvable_logo_blanc1.png`,
        description: SITE_AI_DESCRIPTION,
        inLanguage: SITE_PRIMARY_LANGUAGE,
        telephone: SITE_PHONE_TEL,
        sameAs: SITE_SAME_AS,
        about: [
            'visibilité organique locale',
            'optimisation pour moteurs génératifs',
            'données structurées',
        ],
        mentions: [
            `${baseUrl}/offres`,
            `${baseUrl}/methodologie`,
            `${baseUrl}/etudes-de-cas`,
        ],
        contactPoint: [{
            '@type': 'ContactPoint',
            contactType: 'customer support',
            telephone: SITE_PHONE_TEL,
            areaServed: ['CA-QC'],
            availableLanguage: ['fr-CA'],
            url: `${baseUrl}/contact`,
        }],
        areaServed: [
            { '@type': 'City', name: 'Montréal' },
            { '@type': 'City', name: 'Laval' },
            { '@type': 'City', name: 'Québec' },
            { '@type': 'City', name: 'Longueuil' },
            { '@type': 'City', name: 'Brossard' },
        ],
        address: buildAddressSchema(address),
        mainEntityOfPage: baseUrl,
        dateModified: dateModified || SITE_LAST_MODIFIED_ISO,
    });
}

function buildProfessionalServiceSchema(baseUrl, dateModified) {
    return compactValue({
        '@type': 'ProfessionalService',
        '@id': `${baseUrl}#professional-service`,
        name: SITE_NAME,
        url: baseUrl,
        description: 'Mandats de cartographie, implantation et pilotage continu pour la visibilité Google et IA.',
        inLanguage: SITE_PRIMARY_LANGUAGE,
        provider: { '@id': `${baseUrl}#organization` },
        areaServed: [
            { '@type': 'AdministrativeArea', name: 'Québec' },
        ],
        serviceType: [
            'Cartographie stratégique',
            'Mandat d’implantation',
            'Pilotage continu',
        ],
        sameAs: SITE_SAME_AS,
        contactPoint: [{
            '@type': 'ContactPoint',
            contactType: 'customer support',
            telephone: SITE_PHONE_TEL,
            availableLanguage: ['fr-CA'],
            url: `${baseUrl}/contact`,
        }],
        about: [
            'référencement local',
            'cohérence des données publiques',
            'réponses IA conversationnelles',
        ],
        mentions: [
            `${baseUrl}/offres`,
            `${baseUrl}/notre-mesure`,
        ],
        mainEntityOfPage: baseUrl,
        dateModified: dateModified || SITE_LAST_MODIFIED_ISO,
    });
}

function buildWebsiteSchema(baseUrl, searchPath, dateModified) {
    return compactValue({
        '@type': 'WebSite',
        '@id': `${baseUrl}#website`,
        name: SITE_NAME,
        url: baseUrl,
        description: SITE_AI_DESCRIPTION,
        inLanguage: SITE_PRIMARY_LANGUAGE,
        publisher: { '@id': `${baseUrl}#organization` },
        about: [
            'SEO local',
            'GEO',
            'données structurées',
        ],
        mentions: [
            `${baseUrl}/a-propos`,
            `${baseUrl}/offres`,
            `${baseUrl}/contact`,
        ],
        potentialAction: searchPath
            ? {
                '@type': 'SearchAction',
                target: `${baseUrl}${searchPath}?q={search_term_string}`,
                'query-input': 'required name=search_term_string',
            }
            : undefined,
        mainEntityOfPage: baseUrl,
        dateModified: dateModified || SITE_LAST_MODIFIED_ISO,
    });
}

function buildHomeItemListSchema(baseUrl) {
    return compactValue({
        '@type': 'ItemList',
        '@id': `${baseUrl}#home-mandates`,
        name: 'Mandats Trouvable',
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: 3,
        itemListElement: [
            {
                '@type': 'ListItem',
                position: 1,
                name: 'Cartographie stratégique',
                url: `${baseUrl}/offres#cartographie-strategique`,
            },
            {
                '@type': 'ListItem',
                position: 2,
                name: 'Mandat d’implantation',
                url: `${baseUrl}/offres#mandat-implementation`,
            },
            {
                '@type': 'ListItem',
                position: 3,
                name: 'Pilotage continu',
                url: `${baseUrl}/offres#pilotage-continu`,
            },
        ],
    });
}

function buildServiceSchema(service, baseUrl, dateModified) {
    if (!service || typeof service !== 'object') return undefined;
    const name = normalizeText(service.name || '');
    const description = normalizeText(service.description || '');
    const slug = normalizeText(service.slug || '');
    const serviceUrl = toAbsoluteUrl(baseUrl, service.url || (slug ? `/expertises/${slug}` : ''));

    if (!name || !serviceUrl) return undefined;

    return compactValue({
        '@type': 'Service',
        '@id': `${serviceUrl}#service`,
        name: `Mandat visibilité ${name}`,
        serviceType: normalizeText(service.serviceType || name),
        description: description || `Mandat d’exécution ${name}.`,
        url: serviceUrl,
        provider: { '@id': `${baseUrl}#organization` },
        areaServed: {
            '@type': 'AdministrativeArea',
            name: 'Québec, Canada',
        },
        inLanguage: SITE_PRIMARY_LANGUAGE,
        about: Array.isArray(service.about) && service.about.length > 0 ? service.about : [name, 'visibilité locale', 'réponses IA'],
        mentions: [`${baseUrl}/offres`, `${baseUrl}/methodologie`],
        mainEntityOfPage: serviceUrl,
        dateModified: dateModified || SITE_LAST_MODIFIED_ISO,
    });
}

function buildItemListSchema({ list, name, id, pageUrl }) {
    if (!Array.isArray(list) || list.length === 0) return undefined;

    const normalizedItems = list
        .map((entry) => {
            if (typeof entry === 'string') {
                return { name: normalizeText(entry) };
            }
            return {
                name: normalizeText(entry?.name || ''),
                url: normalizeText(entry?.url || ''),
            };
        })
        .filter((entry) => entry.name);

    if (normalizedItems.length === 0) return undefined;

    return compactValue({
        '@type': 'ItemList',
        '@id': id,
        name,
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: normalizedItems.length,
        itemListElement: normalizedItems.map((entry, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: entry.name,
            url: entry.url || undefined,
        })),
        mainEntityOfPage: pageUrl,
    });
}

function buildArticleSchema(article, baseUrl, dateModifiedFallback) {
    if (!article || typeof article !== 'object') return undefined;
    const pageUrl = normalizeText(article.url || '');
    const title = normalizeText(article.headline || article.name || '');
    const description = normalizeText(article.description || '');
    if (!pageUrl || !title) return undefined;

    return compactValue({
        '@type': 'Article',
        '@id': `${pageUrl}#article`,
        headline: title,
        name: title,
        description,
        url: pageUrl,
        mainEntityOfPage: pageUrl,
        image: article.image,
        inLanguage: SITE_PRIMARY_LANGUAGE,
        author: {
            '@type': 'Organization',
            '@id': `${baseUrl}#organization`,
            name: SITE_AUTHOR_NAME,
            url: SITE_ABOUT_URL,
        },
        publisher: {
            '@type': 'Organization',
            '@id': `${baseUrl}#organization`,
            name: SITE_NAME,
            logo: {
                '@type': 'ImageObject',
                url: `${baseUrl}/logos/trouvable_logo_blanc1.png`,
            },
        },
        about: article.about,
        mentions: article.mentions,
        citation: Array.isArray(article.references)
            ? article.references.map((reference) => reference.url || reference.href).filter(Boolean)
            : undefined,
        datePublished: article.datePublished,
        dateModified: article.dateModified || dateModifiedFallback || SITE_LAST_MODIFIED_ISO,
    });
}

function buildHowToSchema(howTo, dateModifiedFallback) {
    if (!howTo || typeof howTo !== 'object' || !Array.isArray(howTo.steps)) return undefined;
    const name = normalizeText(howTo.name || '');
    const pageUrl = normalizeText(howTo.url || '');
    const normalizedSteps = howTo.steps
        .map((step) => normalizeText(step))
        .filter(Boolean);

    if (!name || !pageUrl || normalizedSteps.length < 2) return undefined;

    return compactValue({
        '@type': 'HowTo',
        '@id': `${pageUrl}#howto`,
        name,
        description: normalizeText(howTo.description || ''),
        totalTime: normalizeText(howTo.totalTime || ''),
        inLanguage: SITE_PRIMARY_LANGUAGE,
        mainEntityOfPage: pageUrl,
        step: normalizedSteps.map((step, index) => ({
            '@type': 'HowToStep',
            position: index + 1,
            name: `Étape ${index + 1}`,
            text: step,
            url: `${pageUrl}#etape-${index + 1}`,
        })),
        dateModified: howTo.dateModified || dateModifiedFallback || SITE_LAST_MODIFIED_ISO,
    });
}

function buildLocalBusinessSchemas(clientProfile, baseUrl, dateModified) {
    if (!clientProfile || typeof clientProfile !== 'object') return [];

    const businessType = normalizeText(clientProfile.business_type || 'LocalBusiness');
    const safeBusinessType = VALID_BUSINESS_TYPES.has(businessType) ? businessType : 'LocalBusiness';

    const websiteUrl = normalizeText(clientProfile.website_url || '');
    const pageUrl = clientProfile.client_slug
        ? `${baseUrl}/clients/${clientProfile.client_slug}`
        : websiteUrl || undefined;

    const schema = compactValue({
        '@type': safeBusinessType,
        '@id': pageUrl ? `${pageUrl}#localbusiness` : undefined,
        name: normalizeText(clientProfile.client_name || ''),
        url: websiteUrl || pageUrl,
        description: normalizeText(clientProfile.seo_description || clientProfile.business_details?.short_desc || ''),
        telephone: normalizeText(clientProfile.contact_info?.phone || ''),
        email: normalizeText(clientProfile.contact_info?.public_email || ''),
        openingHours: Array.isArray(clientProfile.business_details?.opening_hours) ? clientProfile.business_details.opening_hours : undefined,
        sameAs: Array.isArray(clientProfile.social_profiles)
            ? clientProfile.social_profiles.filter((profile) => typeof profile === 'string' && profile.trim().length > 0)
            : undefined,
        address: buildAddressSchema(clientProfile.address),
        areaServed: Array.isArray(clientProfile.seo_data?.target_cities)
            ? clientProfile.seo_data.target_cities
                .filter((city) => typeof city === 'string' && city.trim().length > 0)
                .map((city) => ({ '@type': 'City', name: city }))
            : undefined,
        inLanguage: SITE_PRIMARY_LANGUAGE,
        mainEntityOfPage: pageUrl,
        dateModified: dateModified || SITE_LAST_MODIFIED_ISO,
    });

    if (!schema) return [];

    return [schema];
}

export default function GeoSeoInjector({
    clientProfile,
    faqs,
    breadcrumbs,
    organization,
    address,
    service,
    baseUrl = SITE_URL,
    includeWebsite = false,
    includeProfessionalService = false,
    includeHomepageItemList = false,
    searchPath = '/recherche',
    article,
    howTo,
    itemList,
    dateModified = SITE_LAST_MODIFIED_ISO,
}) {
    const entities = [];

    if (organization && baseUrl) {
        entities.push(buildOrganizationSchema(baseUrl, address, dateModified));
    }

    if (includeProfessionalService && baseUrl) {
        entities.push(buildProfessionalServiceSchema(baseUrl, dateModified));
    }

    if (includeWebsite && baseUrl) {
        entities.push(buildWebsiteSchema(baseUrl, searchPath, dateModified));
    }

    if (includeHomepageItemList && baseUrl) {
        entities.push(buildHomeItemListSchema(baseUrl));
    }

    if (clientProfile) {
        entities.push(...buildLocalBusinessSchemas(clientProfile, baseUrl, dateModified));
    }

    const faqSchema = buildFaqSchema(faqs);
    if (faqSchema) entities.push(faqSchema);

    const breadcrumbSchema = buildBreadcrumbSchema(breadcrumbs, baseUrl);
    if (breadcrumbSchema) entities.push(breadcrumbSchema);

    const serviceSchema = buildServiceSchema(service, baseUrl, dateModified);
    if (serviceSchema) entities.push(serviceSchema);

    const itemListSchema = buildItemListSchema({
        list: itemList?.items || itemList?.list || itemList,
        name: itemList?.name || 'Liste',
        id: itemList?.id,
        pageUrl: itemList?.pageUrl,
    });
    if (itemListSchema) entities.push(itemListSchema);

    const articleSchema = buildArticleSchema(article, baseUrl, dateModified);
    if (articleSchema) entities.push(articleSchema);

    const howToSchema = buildHowToSchema(howTo, dateModified);
    if (howToSchema) entities.push(howToSchema);

    const cleanEntities = entities.map((entry) => compactValue(entry)).filter(Boolean);
    if (cleanEntities.length === 0) return null;

    return (
        <>
            {cleanEntities.map((entry, index) => {
                const payload = { '@context': SCHEMA_CONTEXT, ...entry };
                const key = entry['@id'] || `${entry['@type'] || 'schema'}-${index}`;
                return (
                    <script
                        key={key}
                        type="application/ld+json"
                        dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
                    />
                );
            })}
        </>
    );
}
