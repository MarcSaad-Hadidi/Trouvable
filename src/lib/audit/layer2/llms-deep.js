/**
 * Layer 2 deep llms.txt validation.
 *
 * Goes beyond the shallow validation in `lib/audit/crawler-access.js`:
 *  - counts sections, links, absolute URL ratio
 *  - detects optional/important sections (Overview, Products, Docs, Policies)
 *  - flags obvious red flags (mostly offsite links, empty sections, excessive
 *    length without structure)
 *  - produces a structured findings list + a diagnostic expert score
 *
 * This module does NOT feed the Trouvable final product score directly. Its
 * output lands in `site_level_expert.llms_txt_deep` on the canonical audit
 * object and is summarized in reports by Layer 4.
 */

const IMPORTANT_SECTION_PATTERNS = [
    { key: 'overview', regex: /^##\s+(overview|about|a\s*propos|a propos|presentation)/i },
    { key: 'products', regex: /^##\s+(products?|offres?|services?|produits?)/i },
    { key: 'docs', regex: /^##\s+(docs?|documentation|guides?|resources?|ressources?)/i },
    { key: 'contact', regex: /^##\s+(contact|support|help|aide)/i },
    { key: 'policies', regex: /^##\s+(polic(y|ies)|terms|conditions|legal|mentions|confidentialit)/i },
];

function safeUrl(value, base) {
    try {
        return new URL(value, base).href;
    } catch {
        return null;
    }
}

function sameHost(aUrl, bUrl) {
    try {
        return new URL(aUrl).hostname.toLowerCase() === new URL(bUrl).hostname.toLowerCase();
    } catch {
        return false;
    }
}

/**
 * @param {string|null} content — raw llms.txt body, or null if absent.
 * @param {string} siteUrl — resolved site URL for link host comparison.
 * @param {object} [options]
 * @param {string|null} [options.llmsFullContent] — raw llms-full.txt body.
 */
export function auditLlmsTxtDeep(content, siteUrl, options = {}) {
    const findings = [];
    const details = {
        found: !!content,
        full_variant_found: !!options.llmsFullContent,
        character_count: content ? content.length : 0,
        line_count: 0,
        h1_count: 0,
        h2_count: 0,
        links: 0,
        internal_links: 0,
        external_links: 0,
        sections_detected: {},
        red_flags: [],
    };

    if (!content) {
        findings.push({ id: 'llms_txt.absent', severity: 'high', message: 'No /llms.txt found on origin.' });
        return { score: 0, findings, details };
    }

    const lines = content.split(/\r?\n/);
    details.line_count = lines.length;

    let h1Present = false;
    const sectionsDetected = new Set();
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line.startsWith('# ')) {
            if (!h1Present) {
                h1Present = true;
                details.h1_count += 1;
            } else {
                details.h1_count += 1;
            }
        } else if (line.startsWith('## ')) {
            details.h2_count += 1;
            for (const pattern of IMPORTANT_SECTION_PATTERNS) {
                if (pattern.regex.test(line)) sectionsDetected.add(pattern.key);
            }
        }

        let linkMatch;
        while ((linkMatch = linkRegex.exec(rawLine)) !== null) {
            details.links += 1;
            const href = linkMatch[2];
            const absolute = safeUrl(href, siteUrl);
            if (!absolute) continue;
            if (sameHost(absolute, siteUrl)) details.internal_links += 1;
            else details.external_links += 1;
        }
    }

    for (const key of sectionsDetected) {
        details.sections_detected[key] = true;
    }

    if (!h1Present) {
        findings.push({ id: 'llms_txt.missing_h1', severity: 'medium', message: 'llms.txt should start with a top-level `# Brand` heading.' });
    }
    if (details.h2_count === 0) {
        findings.push({ id: 'llms_txt.no_sections', severity: 'medium', message: 'No `##` sections found; structure is too flat for AI discovery.' });
    }
    if (details.links === 0) {
        findings.push({ id: 'llms_txt.no_links', severity: 'medium', message: 'No markdown links detected; AI assistants rely on explicit link lists.' });
    }
    if (details.links > 0 && details.internal_links === 0) {
        findings.push({ id: 'llms_txt.no_internal_links', severity: 'high', message: 'All links point off-site; llms.txt should primarily reference the site itself.' });
        details.red_flags.push('all_external_links');
    }
    if (details.external_links > details.internal_links * 2 && details.links > 4) {
        findings.push({ id: 'llms_txt.mostly_external', severity: 'low', message: 'Majority of links are off-site; ensure the site is well represented.' });
    }
    if (details.character_count > 20_000 && details.h2_count < 3) {
        findings.push({ id: 'llms_txt.verbose_unstructured', severity: 'low', message: 'Very long llms.txt without clear sections may reduce AI retrieval quality.' });
        details.red_flags.push('verbose_unstructured');
    }

    for (const pattern of IMPORTANT_SECTION_PATTERNS) {
        if (!sectionsDetected.has(pattern.key)) {
            findings.push({
                id: `llms_txt.missing_${pattern.key}`,
                severity: pattern.key === 'overview' ? 'medium' : 'low',
                message: `Recommended section not detected: ${pattern.key}.`,
            });
        }
    }

    let score = 0;
    if (h1Present) score += 15;
    score += Math.min(details.h2_count * 5, 25);
    score += Math.min(Math.floor(details.internal_links / 2) * 4, 20);
    score += Math.min(sectionsDetected.size * 6, 30);
    if (details.full_variant_found) score += 10;
    if (details.red_flags.includes('all_external_links')) score -= 20;
    score = Math.max(0, Math.min(100, score));

    return { score, findings, details };
}
