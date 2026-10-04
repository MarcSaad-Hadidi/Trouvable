// Editorial term matching shared by SEO content and page overlap analysis.
const TOKEN_STOPWORDS = new Set([
    'avec',
    'dans',
    'pour',
    'sans',
    'plus',
    'entre',
    'vous',
    'votre',
    'vos',
    'sur',
    'les',
    'des',
    'une',
    'du',
    'de',
    'the',
    'and',
    'for',
    'www',
    'com',
    'https',
    'http',
    'page',
    'pages',
    'service',
    'services',
    'site',
    'home',
]);

export function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

/** Extra stopwords belong to the consumer's editorial scope. */
export function createSeoQueryMatcher({ additionalStopwords = [] } = {}) {
    const stopwords = new Set([...TOKEN_STOPWORDS, ...additionalStopwords]);
    function tokenize(value) {
        return normalizeText(value)
            .split(/[^a-z0-9]+/)
            .map((token) => token.trim())
            .filter((token) => token.length >= 3 && !stopwords.has(token));
    }

    function sharedTokens(left, right) {
        const leftTokens = Array.from(new Set(tokenize(left)));
        const rightTokenSet = new Set(tokenize(right));
        return leftTokens.filter((token) => rightTokenSet.has(token));
    }

    function overlapScore(left, right) {
        const leftTokens = new Set(tokenize(left));
        const rightTokens = new Set(tokenize(right));

        if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

        let overlap = 0;
        for (const token of leftTokens) {
            if (rightTokens.has(token)) overlap += 1;
        }

        return overlap / Math.max(leftTokens.size, rightTokens.size);
    }

    return { tokenize, sharedTokens, overlapScore };
}
