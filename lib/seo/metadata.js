import {
    SITE_ABOUT_URL,
    SITE_AUTHOR_NAME,
    SITE_DESCRIPTION,
    SITE_NAME,
} from '@/lib/site-config';

export const META_DESCRIPTION_MIN = 120;
export const META_DESCRIPTION_MAX = 158;

function normalizeWhitespace(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function truncateAtWordBoundary(value, maxLength = META_DESCRIPTION_MAX) {
    const text = normalizeWhitespace(value);
    if (text.length <= maxLength) return text;

    const truncated = text.slice(0, maxLength + 1);
    const lastSpace = truncated.lastIndexOf(' ');
    const candidate = lastSpace > META_DESCRIPTION_MIN ? truncated.slice(0, lastSpace) : text.slice(0, maxLength);
    return candidate.replace(/[,:;.\s]+$/, '').trim();
}

export function fitMetaDescription(value, fallback = SITE_DESCRIPTION) {
    const text = normalizeWhitespace(value);
    if (text.length >= META_DESCRIPTION_MIN && text.length <= META_DESCRIPTION_MAX) {
        return text;
    }

    if (text.length > META_DESCRIPTION_MAX) {
        return truncateAtWordBoundary(text);
    }

    const expanded = normalizeWhitespace(`${text} ${fallback}`);
    return truncateAtWordBoundary(expanded);
}

export function withPublicAuthor(metadata = {}) {
    return {
        ...metadata,
        authors: metadata.authors || [{ name: SITE_AUTHOR_NAME, url: SITE_ABOUT_URL }],
        creator: metadata.creator || SITE_AUTHOR_NAME,
        publisher: metadata.publisher || SITE_NAME,
    };
}

export function buildPublicMetadata({
    title,
    description,
    canonical,
    openGraph = {},
    twitter = {},
    robots,
}) {
    const normalizedDescription = fitMetaDescription(description);

    return withPublicAuthor({
        title,
        description: normalizedDescription,
        alternates: canonical ? { canonical } : undefined,
        openGraph: {
            ...openGraph,
            title: openGraph.title || title,
            description: openGraph.description ? fitMetaDescription(openGraph.description) : normalizedDescription,
        },
        twitter: {
            ...twitter,
            title: twitter.title || title,
            description: twitter.description ? fitMetaDescription(twitter.description) : normalizedDescription,
        },
        robots,
    });
}
