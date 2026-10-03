const PUBLICATION_STATES = new Set(['draft', 'published']);

export function normalizePortalContactEmail(email) {
    if (typeof email !== 'string') return '';
    return email.trim().toLowerCase();
}

export function getPublicContactEmail(contactInfo = {}) {
    if (!contactInfo || typeof contactInfo !== 'object') return '';
    return contactInfo.public_email || contactInfo.email || '';
}

export function getCanonicalContactInfo(contactInfo = {}) {
    if (!contactInfo || typeof contactInfo !== 'object') {
        return { phone: '', public_email: '' };
    }

    return {
        ...contactInfo,
        public_email: getPublicContactEmail(contactInfo),
    };
}

export function getCompatibilitySyncedContactInfo(contactInfo = {}) {
    if (!contactInfo || typeof contactInfo !== 'object') {
        return { phone: '', public_email: '', email: '' };
    }

    const publicEmail = getPublicContactEmail(contactInfo).trim();

    return {
        ...contactInfo,
        public_email: publicEmail,
        email: publicEmail,
    };
}

export function getBusinessShortDescription(businessDetails = {}) {
    if (!businessDetails || typeof businessDetails !== 'object') return '';
    return businessDetails.short_desc || businessDetails.short_description || '';
}

export function getCanonicalBusinessDetails(businessDetails = {}) {
    if (!businessDetails || typeof businessDetails !== 'object') {
        return { short_desc: '' };
    }

    return {
        ...businessDetails,
        short_desc: getBusinessShortDescription(businessDetails),
    };
}

export function getCompatibilitySyncedBusinessDetails(businessDetails = {}) {
    if (!businessDetails || typeof businessDetails !== 'object') {
        return { short_desc: '', short_description: '' };
    }

    const shortDesc = getBusinessShortDescription(businessDetails).trim();

    return {
        ...businessDetails,
        short_desc: shortDesc,
        short_description: shortDesc,
    };
}

export function getPublicationStatus(profile = {}) {
    if (PUBLICATION_STATES.has(profile?.publication_status)) {
        return profile.publication_status;
    }

    return profile?.is_published ? 'published' : 'draft';
}

export function isPublishedProfile(profile = {}) {
    return getPublicationStatus(profile) === 'published';
}

export function normalizeClientProfileShape(profile) {
    if (!profile || typeof profile !== 'object') return profile;

    const publication_status = getPublicationStatus(profile);

    return {
        ...profile,
        contact_info: getCanonicalContactInfo(profile.contact_info),
        business_details: getCanonicalBusinessDetails(profile.business_details),
        publication_status,
        is_published: publication_status === 'published',
    };
}

export function syncClientProfileCompatibilityFields(updates = {}) {
    if (!updates || typeof updates !== 'object') return updates;

    const next = { ...updates };

    if (Object.prototype.hasOwnProperty.call(next, 'contact_info')) {
        next.contact_info = getCompatibilitySyncedContactInfo(next.contact_info);
    }

    if (Object.prototype.hasOwnProperty.call(next, 'business_details')) {
        next.business_details = getCompatibilitySyncedBusinessDetails(next.business_details);
    }

    if (Object.prototype.hasOwnProperty.call(next, 'publication_status')) {
        next.is_published = next.publication_status === 'published';
    } else if (Object.prototype.hasOwnProperty.call(next, 'is_published')) {
        next.publication_status = next.is_published ? 'published' : 'draft';
    }

    return next;
}

function nonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function hasNonEmptyArray(value) {
    return Array.isArray(value) && value.some((item) => {
        if (typeof item === 'string') return item.trim().length > 0;
        if (item && typeof item === 'object') return Object.values(item).some(nonEmptyString);
        return Boolean(item);
    });
}

export function getProfileCompletenessSummary(profile) {
    const client = normalizeClientProfileShape(profile || {});
    const contact = client?.contact_info || {};
    const business = client?.business_details || {};
    const seoData = client?.seo_data || {};
    const geoData = client?.geo_ai_data || {};
    const address = client?.address || {};

    const sections = [
        {
            key: 'contact_completeness',
            label: 'Coordonnees publiques',
            complete: nonEmptyString(contact.phone) && nonEmptyString(contact.public_email),
            detail: 'Telephone et courriel visibles',
        },
        {
            key: 'service_clarity',
            label: "Clarte de l'offre",
            complete: nonEmptyString(business.short_desc) || hasNonEmptyArray(business.services) || nonEmptyString(business.long_desc),
            detail: 'Description claire et services renseignes',
        },
        {
            key: 'local_coverage',
            label: 'Couverture locale',
            complete:
                nonEmptyString(address.city) ||
                nonEmptyString(address.region) ||
                hasNonEmptyArray(seoData.target_cities) ||
                hasNonEmptyArray(business.areas_served),
            detail: 'Villes, regions ou zones desservies',
        },
        {
            key: 'structured_data',
            label: 'Base structuree',
            complete:
                nonEmptyString(client.business_type) &&
                nonEmptyString(address.city) &&
                (nonEmptyString(address.street) || nonEmptyString(business.maps_url) || hasNonEmptyArray(business.opening_hours)),
            detail: 'Adresse, type d activite et elements locaux',
        },
        {
            key: 'trust_signals',
            label: 'Signaux de confiance',
            complete:
                hasNonEmptyArray(client.social_profiles) ||
                hasNonEmptyArray(geoData.proofs) ||
                hasNonEmptyArray(geoData.guarantees),
            detail: 'Preuves, garanties ou reseaux',
        },
        {
            key: 'faq_content',
            label: 'FAQ et contenu',
            complete: hasNonEmptyArray(client.geo_faqs) || nonEmptyString(business.long_desc),
            detail: 'FAQ ou contenu explicatif',
        },
    ];

    const completedCount = sections.filter((section) => section.complete).length;
    const percentage = sections.length > 0
        ? Math.round((completedCount / sections.length) * 100)
        : 0;

    return {
        percentage,
        completedCount,
        totalCount: sections.length,
        sections,
        gaps: sections.filter((section) => !section.complete),
    };
}
