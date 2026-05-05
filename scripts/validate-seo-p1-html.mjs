/**
 * SEO P1 HTML validation — dev fetch OR prerendered `.next/server/app/*.html` after `npm run build`.
 *
 * Usage:
 *   node scripts/validate-seo-p1-html.mjs http://localhost:3000
 *   node scripts/validate-seo-p1-html.mjs --build
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const PATHS = [
    '/agence-geo-montreal',
    '/services/audit-visibilite-ia',
    '/services/visibilite-google-reponses-ia',
    '/services/seo-ia-referencement-generatif',
    '/ressources/mesurer-visibilite-ia',
    '/plateformes/chatgpt',
    '/plateformes/claude',
    '/plateformes/perplexity',
    '/plateformes/gemini',
    '/plateformes/copilot',
    '/plateformes/ai-overviews',
    '/villes/montreal',
];

function routeToBuildHtmlFile(routePath) {
    const rel = routePath.replace(/^\//, '');
    return path.join(ROOT, '.next', 'server', 'app', `${rel}.html`);
}

function stripTags(s) {
    return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseJsonLdBlocks(html) {
    const blocks = [];
    const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        const raw = m[1].trim();
        try {
            blocks.push(JSON.parse(raw));
        } catch {
            blocks.push(null);
        }
    }
    return blocks;
}

function deepHasType(obj, target) {
    if (obj == null) return false;
    if (typeof obj !== 'object') return false;
    const t = obj['@type'];
    if (t === target) return true;
    if (Array.isArray(t) && t.includes(target)) return true;
    if (Array.isArray(obj)) return obj.some((x) => deepHasType(x, target));
    return Object.keys(obj).some((k) => deepHasType(obj[k], target));
}

function collectInternalHrefs(html) {
    const internalHrefs = new Set();
    const hrefRe = /\shref=(["'])(\/[^"'#?]*)\1/gi;
    let hm;
    while ((hm = hrefRe.exec(html)) !== null) {
        let p = hm[2].split('#')[0];
        if (!p || p.startsWith('/_next')) continue;
        if (p.endsWith('/')) p = p.slice(0, -1);
        internalHrefs.add(p || '/');
    }
    return internalHrefs;
}

/** Rough route existence: prerendered HTML or app segment with page.jsx */
function loadKnownRoutesFromDisk() {
    const known = new Set(['/']);
    const appDir = path.join(ROOT, 'app');

    function walk(dir, segments) {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const hasPage = entries.some((e) => e.isFile() && /^page\.(jsx|tsx|js|ts)$/.test(e.name));
        if (hasPage && segments.length > 0) {
            const route = `/${segments.join('/')}`;
            known.add(route.replace(/\/\([^)]+\)\//g, '/').replace(/\/\([^)]+\)$/g, ''));
        }
        for (const e of entries) {
            if (!e.isDirectory()) continue;
            const name = e.name;
            if (name === 'api' || name.startsWith('_')) continue;
            walk(path.join(dir, name), [...segments, name.replace(/^\((.+)\)$/, '[$1]')]);
        }
    }
    walk(appDir, []);

    const nextApp = path.join(ROOT, '.next', 'server', 'app');
    if (fs.existsSync(nextApp)) {
        function walkHtml(dir, prefix) {
            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, e.name);
                if (e.isDirectory()) {
                    walkHtml(full, `${prefix}${e.name}/`);
                } else if (e.name.endsWith('.html') && !e.name.startsWith('_')) {
                    const routePath = `${prefix}${e.name.replace(/\.html$/, '')}`;
                    known.add(`/${routePath.replace(/\/$/, '')}`);
                }
            }
        }
        walkHtml(nextApp, '');
    }

    return known;
}

function analyzeHtml(html, pathLabel, sourceLabel) {
    const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleM ? stripTags(titleM[1]) : '';

    const descM =
        html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
    const description = descM ? descM[1].trim() : '';

    const canonM =
        html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
        || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
    const canonical = canonM ? canonM[1].trim() : '';

    const h1Regex = /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi;
    const h1Blocks = [];
    let hm;
    while ((hm = h1Regex.exec(html)) !== null) {
        const inner = stripTags(hm[1]);
        if (inner.length > 0) h1Blocks.push(inner);
    }

    const jsonLdRaw = parseJsonLdBlocks(html);
    const jsonLdParseFailures = jsonLdRaw.filter((x) => x === null).length;
    const jsonLdOk = jsonLdRaw.filter(Boolean);

    let hasFaq = false;
    let hasBreadcrumb = false;
    for (const node of jsonLdOk) {
        if (deepHasType(node, 'FAQPage')) hasFaq = true;
        if (deepHasType(node, 'BreadcrumbList')) hasBreadcrumb = true;
    }

    const internalHrefs = collectInternalHrefs(html);

    return {
        path: pathLabel,
        source: sourceLabel,
        titleLen: title.length,
        titlePreview: title.slice(0, 76),
        descLen: description.length,
        canonical,
        h1Count: h1Blocks.length,
        h1Texts: h1Blocks.map((t) => t.slice(0, 140)),
        jsonLdBlocks: jsonLdOk.length,
        jsonLdParseFailures,
        hasFaq,
        hasBreadcrumb,
        internalHrefCount: internalHrefs.size,
        internalHrefs,
        httpStatus: null,
    };
}

async function loadHtmlFetch(baseUrl, routePath) {
    const url = `${baseUrl.replace(/\/$/, '')}${routePath}`;
    const res = await fetch(url, {
        headers: { Accept: 'text/html' },
        redirect: 'follow',
    });
    const html = await res.text();
    return { html, status: res.status };
}

function loadHtmlBuild(routePath) {
    const file = routeToBuildHtmlFile(routePath);
    if (!fs.existsSync(file)) {
        throw new Error(`missing prerender ${path.relative(ROOT, file)} — run npm run build`);
    }
    const html = fs.readFileSync(file, 'utf8');
    return { html, status: 200 };
}

async function main() {
    const args = process.argv.slice(2);
    const useBuild = args.includes('--build');
    const baseUrl = args.find((a) => !a.startsWith('-')) || 'http://localhost:3000';

    const knownRoutes = loadKnownRoutesFromDisk();

    console.log(useBuild ? 'Source: .next/server/app/*.html (post-build)\n' : `Source: fetch ${baseUrl}\n`);

    const rows = [];
    const allInternal = new Set();

    for (const p of PATHS) {
        try {
            const { html, status } = useBuild ? loadHtmlBuild(p) : await loadHtmlFetch(baseUrl, p);
            const row = analyzeHtml(html, p, useBuild ? 'build' : 'fetch');
            row.httpStatus = status;
            rows.push(row);
            row.internalHrefs.forEach((h) => allInternal.add(h));
        } catch (e) {
            rows.push({ path: p, error: e.message });
        }
    }

    const linkIssues = [];
    const skipPrefixes = ['/api/', '/admin/', '/portal/', '/_next'];
    /** Clerk sign-in lives under /espace/* ; HTML often links to /espace */
    const skipExact = new Set([
        '/.well-known/webmcp',
        '/favicon.ico',
        '/espace',
        '/markdown',
    ]);
    const hasExtension = (p) => /\.[a-z0-9]{2,5}$/i.test(p.split('/').pop());

    for (const href of allInternal) {
        if (skipExact.has(href)) continue;
        if (skipPrefixes.some((pre) => href.startsWith(pre))) continue;
        if (hasExtension(href)) continue;

        let normalized = href;
        if (normalized.length > 1 && normalized.endsWith('/')) normalized = normalized.slice(0, -1);

        let ok = knownRoutes.has(normalized);
        if (!ok && !normalized.endsWith(']]')) {
            ok =
                knownRoutes.has(`${normalized}/`)
                || fs.existsSync(path.join(ROOT, 'app', ...normalized.split('/').filter(Boolean), 'page.jsx'))
                || fs.existsSync(path.join(ROOT, 'app', ...normalized.split('/').filter(Boolean), 'page.tsx'));
        }
        if (!ok) linkIssues.push(`broken internal href (aggregate scan): ${href}`);
    }

    const issues = [];
    for (const r of rows) {
        if (r.error) {
            issues.push(`${r.path}: ${r.error}`);
            continue;
        }
        if (r.httpStatus !== 200) issues.push(`${r.path}: HTTP ${r.httpStatus}`);
        if (r.titleLen === 0) issues.push(`${r.path}: missing <title>`);
        if (r.descLen === 0) issues.push(`${r.path}: missing meta description`);
        if (!r.canonical) issues.push(`${r.path}: missing canonical`);
        if (r.h1Count !== 1) issues.push(`${r.path}: expected 1 non-empty <h1>, got ${r.h1Count}`);
        if (r.jsonLdParseFailures > 0) issues.push(`${r.path}: invalid JSON-LD JSON parse`);
    }

    console.table(
        rows.map((r) =>
            r.error
                ? { path: r.path, ok: false, err: r.error.slice(0, 60) }
                : {
                      path: r.path,
                      http: r.httpStatus,
                      h1: r.h1Count,
                      title: r.titleLen,
                      desc: r.descLen,
                      canon: r.canonical ? 'yes' : 'no',
                      ldBlocks: r.jsonLdBlocks,
                      ldParse: r.jsonLdParseFailures,
                      FAQ: r.hasFaq ? 'yes' : '—',
                      crumbs: r.hasBreadcrumb ? 'yes' : '—',
                  },
        ),
    );

    console.log('\n--- H1 (trimmed) ---');
    for (const r of rows) {
        if (!r.error && r.h1Texts?.length) console.log(`${r.path}\n  → ${r.h1Texts[0]}`);
    }

    console.log('\n--- FAQ / Breadcrumb (JSON-LD deep scan) ---');
    for (const r of rows) {
        if (r.error) continue;
        console.log(`${r.path}: FAQ ${r.hasFaq ? 'yes' : 'no'}, BreadcrumbList ${r.hasBreadcrumb ? 'yes' : 'no'}`);
    }

    if (linkIssues.length) {
        console.log('\n--- Internal links (sample issues from merged href scan) ---');
        linkIssues.slice(0, 40).forEach((x) => console.log(` - ${x}`));
        if (linkIssues.length > 40) console.log(` … +${linkIssues.length - 40} more`);
    } else {
        console.log('\n--- Internal links: no obvious unknown routes in merged scan ---');
    }

    console.log('\n--- Summary ---');
    const allIssues = [...issues, ...linkIssues];
    if (allIssues.length === 0) {
        console.log('All automated checks passed.');
    } else {
        console.log('Issues:');
        allIssues.forEach((i) => console.log(` - ${i}`));
        process.exitCode = 1;
    }
}

main();
