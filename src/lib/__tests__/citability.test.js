import { describe, expect, it, vi } from 'vitest';
import { load } from 'cheerio';

vi.mock('server-only', () => ({}));

import {
    collectContentBlocks,
    scoreBlockCitability,
    scorePageCitability,
} from '../audit/citability.js';

describe('citability', () => {
    it('extracts heading-bound blocks and preserves FAQ/list context', () => {
        const html = `
            <html>
                <body>
                    <main>
                        <script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage"}</script>
                        <h1>Plomberie d'urgence a Montreal</h1>
                        <p>ABC Plomberie intervient a Montreal et Laval depuis 2014 pour les fuites, drains bloques et inspections camera residentielles.</p>
                        <section>
                            <h2>Quels quartiers couvrez-vous ?</h2>
                            <p>Nous couvrons Rosemont, le Plateau et Laval avec un delai moyen de 60 minutes pour les urgences.</p>
                            <ul>
                                <li>Debouchage haute pression a partir de 149 $ avec rapport photo apres intervention.</li>
                            </ul>
                        </section>
                    </main>
                </body>
            </html>
        `;

        const blocks = collectContentBlocks(load(html), 'https://example.com');

        expect(blocks).toHaveLength(3);
        expect(blocks[0]).toMatchObject({
            page_url: 'https://example.com',
            heading: "Plomberie d'urgence a Montreal",
            block_type: 'paragraph',
        });
        expect(blocks[1]).toMatchObject({
            heading: 'Quels quartiers couvrez-vous ?',
            block_type: 'faq_answer',
        });
        expect(blocks[2]).toMatchObject({
            heading: 'Quels quartiers couvrez-vous ?',
            block_type: 'list_item',
        });
        expect(blocks.every((block) => block.block_id.length === 16)).toBe(true);
    });

    it('scores specific factual blocks higher than vague blocks', () => {
        const highValueBlock = {
            heading: 'Interventions urgentes',
            block_type: 'paragraph',
            text: 'ABC Plomberie intervient a Montreal et Laval depuis 2014. L equipe assure des depannages 24 heures sur 24 avec un delai moyen de 60 minutes. Les interventions d urgence commencent a 149 $ et couvrent les fuites, drains bloques et inspections camera.',
        };
        const lowValueBlock = {
            heading: 'A propos',
            block_type: 'paragraph',
            text: 'This is okay.',
        };

        const highScore = scoreBlockCitability(highValueBlock);
        const lowScore = scoreBlockCitability(lowValueBlock);

        expect(highScore.citability_score).toBeGreaterThanOrEqual(60);
        expect(highScore.sub_scores.specificity).toBeGreaterThan(0);
        expect(highScore.sub_scores.factual_density).toBeGreaterThan(0);

        expect(lowScore.citability_score).toBeLessThan(30);
        expect(lowScore.citability_score).toBeLessThan(highScore.citability_score);
    });

    it('aggregates page-level citability counts and averages', () => {
        const blocks = [
            {
                block_id: 'block-high',
                heading: 'Interventions urgentes',
                block_type: 'paragraph',
                text: 'ABC Plomberie intervient a Montreal et Laval depuis 2014. L equipe assure des depannages 24 heures sur 24 avec un delai moyen de 60 minutes. Les interventions d urgence commencent a 149 $ et couvrent les fuites, drains bloques et inspections camera.',
            },
            {
                block_id: 'block-low',
                heading: 'A propos',
                block_type: 'paragraph',
                text: 'This is okay.',
            },
        ];

        const pageSummary = scorePageCitability(blocks);

        expect(pageSummary.block_count).toBe(2);
        expect(pageSummary.high_citability_count).toBe(1);
        expect(pageSummary.low_citability_count).toBe(1);
        expect(pageSummary.page_score).toBeGreaterThan(0);
        expect(pageSummary.page_score).toBeLessThan(100);
        expect(pageSummary.scored_blocks).toHaveLength(2);
    });
});