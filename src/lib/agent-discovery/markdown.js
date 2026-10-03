import { load } from 'cheerio';

function normalizeText(value) {
    if (typeof value !== 'string') return '';
    return value.replace(/\s+/g, ' ').trim();
}

function pushLine(lines, value) {
    const line = normalizeText(value);
    if (!line) return;

    const last = lines[lines.length - 1];
    if (last === line) return;
    lines.push(line);
}

function markdownFromElement(tagName, text) {
    if (!text) return '';

    if (tagName === 'h1') return `# ${text}`;
    if (tagName === 'h2') return `## ${text}`;
    if (tagName === 'h3') return `### ${text}`;
    if (tagName === 'h4') return `#### ${text}`;
    if (tagName === 'h5') return `##### ${text}`;
    if (tagName === 'h6') return `###### ${text}`;
    if (tagName === 'li') return `- ${text}`;
    return text;
}

function selectContentRoot($) {
    const article = $('main article').first();
    if (article.length > 0) return article;

    const main = $('main').first();
    if (main.length > 0) return main;

    return $('body');
}

export function renderMarkdownFromHtml({
    html,
    sourceUrl,
    fallbackTitle = 'Trouvable',
}) {
    if (typeof html !== 'string' || html.trim().length === 0) {
        const emptyMarkdown = `# ${fallbackTitle}\n\nNo markdown content could be generated.\n`;
        return {
            markdown: emptyMarkdown,
            estimatedTokens: estimateMarkdownTokens(emptyMarkdown),
        };
    }

    const $ = load(html);
    $('script,style,noscript,template,svg,iframe').remove();

    const title = normalizeText($('title').first().text())
        || normalizeText($('h1').first().text())
        || fallbackTitle;
    const description = normalizeText($('meta[name="description"]').attr('content') || '');

    const lines = [
        '---',
        `title: ${title}`,
        `source: ${sourceUrl}`,
        '---',
        '',
        `# ${title}`,
        '',
    ];

    if (description) {
        lines.push(description, '');
    }

    const root = selectContentRoot($);
    const nodes = root.find('h1,h2,h3,h4,h5,h6,p,li').slice(0, 220);

    nodes.each((_, node) => {
        const tagName = (node?.tagName || '').toLowerCase();
        const text = normalizeText($(node).text());
        if (!text) return;
        if (text.length < 3) return;

        const markdownLine = markdownFromElement(tagName, text);
        pushLine(lines, markdownLine);

        if (tagName !== 'li') lines.push('');
    });

    lines.push(`[HTML version](${sourceUrl})`);

    const markdown = lines.join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trimEnd()
        .concat('\n');

    return {
        markdown,
        estimatedTokens: estimateMarkdownTokens(markdown),
    };
}

export function estimateMarkdownTokens(markdown) {
    if (typeof markdown !== 'string' || markdown.trim().length === 0) {
        return 0;
    }

    const words = markdown.trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(words * 1.35));
}
