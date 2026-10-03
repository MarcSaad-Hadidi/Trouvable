import 'server-only';

import crypto from 'node:crypto';

const MIN_BLOCK_CHARS = 30;
const MAX_BLOCKS_PER_PAGE = 20;

const CONTENT_SELECTORS = ['main', 'article', '[role="main"]', 'section', 'body'];
const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const BLOCK_CONTENT_TAGS = new Set(['p', 'li', 'dd', 'blockquote']);
const PRONOUN_START = /^(it|this|that|these|those|ils?|elles?|ce|cet|cette|ces)\b/i;
const QUESTION_ANSWER_PATTERN = /\?\s*\n|\?\s+[A-Z\u00C0-\u00FF]/;
const ASSERTION_VERBS = /\b(est|sont|a|ont|propose|offre|garantit|assure|permet|fournit|is|are|has|have|provides|offers|ensures|guarantees)\b/i;
const DATE_PATTERN = /\b(20[0-9]{2}|19[0-9]{2}|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|january|february|march|april|may|june|july|august|september|october|november|december)\b/i;
const AMOUNT_PATTERN = /\b\d+[\s]?[$€£%]\b|\b[$€£]\s?\d+|\b\d+\s?%/;
const NUMBER_PATTERN = /\b\d{2,}\b/;

function makeBlockId(pageUrl, position, heading) {
    const raw = `${pageUrl || ''}::${position}::${heading || ''}`;
    return crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16);
}

function normalizeText(value) {
    if (!value || typeof value !== 'string') return '';
    return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function countWords(text) {
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
}

function countSentences(text) {
    if (!text) return 0;
    const sentences = text.split(/[.!?]+\s/).filter((s) => s.trim().length > 5);
    return sentences.length;
}

function countCapitalizedWords(text) {
    if (!text) return 0;
    const words = text.match(/\b[A-Z\u00C0-\u00D6][a-z\u00E0-\u00FF]{2,}\b/g);
    return words ? words.length : 0;
}

/**
 * Scores specificity (0-25): presence of numbers, proper nouns, specific terms.
 */
function scoreSpecificity(text) {
    let score = 0;
    if (NUMBER_PATTERN.test(text)) score += 8;
    const capitalizedCount = countCapitalizedWords(text);
    if (capitalizedCount >= 3) score += 8;
    else if (capitalizedCount >= 1) score += 4;
    if (/\b(km|m²|hectare|euro|dollar|année|mois|jour|heure)\b/i.test(text)) score += 5;
    if (text.length > 120) score += 4;
    return Math.min(score, 25);
}

/**
 * Scores self-containment (0-25): sentence count, subject+verb, no pronoun start.
 */
function scoreSelfContainment(text) {
    let score = 0;
    const sentences = countSentences(text);
    if (sentences >= 3) score += 10;
    else if (sentences >= 2) score += 6;
    else if (sentences >= 1) score += 3;
    if (!PRONOUN_START.test(text)) score += 8;
    if (ASSERTION_VERBS.test(text)) score += 7;
    return Math.min(score, 25);
}

/**
 * Scores answer density (0-25): question-answer patterns, assertion verbs, keyword density.
 */
function scoreAnswerDensity(text) {
    let score = 0;
    if (QUESTION_ANSWER_PATTERN.test(text)) score += 10;
    if (ASSERTION_VERBS.test(text)) score += 5;
    const words = text.split(/\s+/).length;
    const contentWords = text.replace(/\b(le|la|les|de|du|des|un|une|et|ou|en|a|the|a|an|of|in|to|and|or|is|are)\b/gi, '').split(/\s+/).filter(Boolean).length;
    const density = words > 0 ? contentWords / words : 0;
    if (density > 0.7) score += 10;
    else if (density > 0.5) score += 5;
    return Math.min(score, 25);
}

/**
 * Scores factual density (0-25): dates, amounts, percentages, locations.
 */
function scoreFactualDensity(text) {
    let score = 0;
    if (DATE_PATTERN.test(text)) score += 8;
    if (AMOUNT_PATTERN.test(text)) score += 8;
    if (/\b(Montréal|Québec|Laval|Canada|France|Paris)\b/i.test(text)) score += 5;
    const capitalizedCount = countCapitalizedWords(text);
    if (capitalizedCount >= 2) score += 4;
    return Math.min(score, 25);
}

/**
 * Extracts heading-bound content blocks from cheerio DOM.
 * @param {import('cheerio').CheerioAPI} $
 * @param {string} pageUrl
 * @returns {Array<{block_id: string, page_url: string, heading: string|null, heading_level: number|null, block_text: string, text: string, block_type: string, position: number, char_count: number, word_count: number}>}
 */
export function collectContentBlocks($, pageUrl) {
    let container = null;
    for (const selector of CONTENT_SELECTORS) {
        const el = $(selector).first();
        if (el.length > 0 && normalizeText(el.text()).length > 50) {
            container = el;
            break;
        }
    }
    if (!container) return [];

    const blocks = [];
    let position = 0;

    // Detect FAQ schema context on the page
    const hasFaqSchema = $('script[type="application/ld+json"]').toArray().some((el) => {
        const html = $(el).html();
        return html && /faqpage/i.test(html);
    });

    // Walk direct children and their descendants for headings and content
    const children = container.children().toArray();
    let currentHeading = null;
    let currentHeadingLevel = null;
    let currentTexts = [];
    let currentBlockType = 'paragraph';

    function flushBlock() {
        const text = normalizeText(currentTexts.join(' '));
        if (text.length >= MIN_BLOCK_CHARS && blocks.length < MAX_BLOCKS_PER_PAGE) {
            const blockType = currentBlockType === 'list_item'
                ? 'list_item'
                : hasFaqSchema && currentHeading && /\?/.test(currentHeading)
                    ? 'faq_answer'
                    : 'paragraph';
            blocks.push({
                block_id: makeBlockId(pageUrl, position, currentHeading),
                page_url: pageUrl || '',
                heading: currentHeading,
                heading_level: currentHeadingLevel,
                block_text: text,
                text,
                block_type: blockType,
                position,
                char_count: text.length,
                word_count: countWords(text),
            });
            position += 1;
        }
        currentTexts = [];
        currentBlockType = 'paragraph';
    }

    for (const child of children) {
        const tagName = (child.tagName || '').toLowerCase();

        if (HEADING_TAGS.has(tagName)) {
            flushBlock();
            currentHeading = normalizeText($(child).text());
            currentHeadingLevel = Number(tagName.slice(1)) || null;
            continue;
        }

        if (BLOCK_CONTENT_TAGS.has(tagName)) {
            const text = normalizeText($(child).text());
            if (text.length >= 15) {
                currentBlockType = tagName === 'li' ? 'list_item' : 'paragraph';
                currentTexts.push(text);
            }
            continue;
        }

        // Recurse into div/section/article children
        if (['div', 'section', 'article'].includes(tagName)) {
            $(child).find('h1, h2, h3, h4, h5, h6, p, li, dd, blockquote').each((_, el) => {
                const elTag = (el.tagName || '').toLowerCase();
                if (HEADING_TAGS.has(elTag)) {
                    flushBlock();
                    currentHeading = normalizeText($(el).text());
                    currentHeadingLevel = Number(elTag.slice(1)) || null;
                } else if (BLOCK_CONTENT_TAGS.has(elTag)) {
                    const text = normalizeText($(el).text());
                    if (text.length >= 15) {
                        // Detect list items as separate block type
                        if (elTag === 'li') {
                            flushBlock();
                            if (text.length >= MIN_BLOCK_CHARS && blocks.length < MAX_BLOCKS_PER_PAGE) {
                                blocks.push({
                                    block_id: makeBlockId(pageUrl, position, currentHeading),
                                    page_url: pageUrl || '',
                                    heading: currentHeading,
                                    heading_level: currentHeadingLevel,
                                    block_text: text,
                                    text,
                                    block_type: 'list_item',
                                    position,
                                    char_count: text.length,
                                    word_count: countWords(text),
                                });
                                position += 1;
                            }
                        } else {
                            currentBlockType = 'paragraph';
                            currentTexts.push(text);
                        }
                    }
                }
            });
        }
    }

    flushBlock();

    return blocks.slice(0, MAX_BLOCKS_PER_PAGE);
}

/**
 * Scores a single content block for citability (0-100).
 * @param {{text: string, block_type: string, heading: string|null}} block
 * @returns {{score: number, citability_score: number, sub_scores: {specificity: number, self_containment: number, answer_density: number, factual_density: number}}}
 */
export function scoreBlockCitability(block) {
    if (!block || !block.text) {
        return { score: 0, citability_score: 0, sub_scores: { specificity: 0, self_containment: 0, answer_density: 0, factual_density: 0 } };
    }

    const text = block.text;
    const specificity = scoreSpecificity(text);
    const self_containment = scoreSelfContainment(text);
    const answer_density = scoreAnswerDensity(text);
    const factual_density = scoreFactualDensity(text);
    const score = specificity + self_containment + answer_density + factual_density;

    return {
        score,
        citability_score: score,
        sub_scores: { specificity, self_containment, answer_density, factual_density },
    };
}

/**
 * Aggregates page-level citability summary from scored blocks.
 * @param {Array<{text: string, block_type: string, heading: string|null, block_id: string}>} blocks
 * @returns {{page_score: number, block_count: number, high_citability_count: number, low_citability_count: number, scored_blocks: Array}}
 */
export function scorePageCitability(blocks) {
    if (!Array.isArray(blocks) || blocks.length === 0) {
        return { page_score: 0, block_count: 0, high_citability_count: 0, low_citability_count: 0, scored_blocks: [] };
    }

    const scored = blocks.map((block) => {
        const result = scoreBlockCitability(block);
        return { ...block, ...result, citability_score: result.citability_score ?? result.score ?? 0 };
    });

    const scores = scored.map((b) => b.citability_score ?? b.score ?? 0);
    const total = scores.reduce((sum, s) => sum + s, 0);
    const page_score = Math.round(total / scores.length);
    const high_citability_count = scores.filter((s) => s >= 60).length;
    const low_citability_count = scores.filter((s) => s < 30).length;

    return {
        page_score,
        block_count: blocks.length,
        high_citability_count,
        low_citability_count,
        scored_blocks: scored,
    };
}
