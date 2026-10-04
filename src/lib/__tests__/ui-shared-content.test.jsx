import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import TopicFaqList from '@/features/public/shared/TopicFaqList';
import { AgentFixMessage, AgentStrengthMessage } from '@/features/admin/agent/agent-shared';
import { scoreTone } from '@/features/admin/agent/agent-copy';
import { cycleEdgeOpacity, getTypedSlice, inWindow, smoothstep } from '@/features/public/home/animation-timing';

describe('public animation timing', () => {
    it('keeps typing boundaries and empty initial text', () => {
        expect(getTypedSlice('Bonjour', 99, 100, 700)).toBe('');
        expect(getTypedSlice('Bonjour', 100, 100, 700)).toBe('');
        expect(getTypedSlice('Bonjour', 450, 100, 700)).toBe('Bon');
        expect(getTypedSlice('Bonjour', 800, 100, 700)).toBe('Bonjour');
        expect(getTypedSlice('Bonjour', 800, 100, 0)).toBe('Bonjour');
    });
    it('keeps start-inclusive/end-exclusive windows and smooth fade edges', () => {
        expect(inWindow(100, 100, 200)).toBe(true);
        expect(inWindow(200, 100, 200)).toBe(false);
        expect(smoothstep(0, 100, -1)).toBe(0);
        expect(smoothstep(0, 100, 50)).toBe(0.5);
        expect(smoothstep(0, 100, 101)).toBe(1);
        expect(smoothstep(10, 10, 9)).toBe(0);
        expect(smoothstep(10, 10, 10)).toBe(1);
        expect(cycleEdgeOpacity(0, 1000, 100, 100)).toBe(0);
        expect(cycleEdgeOpacity(500, 1000, 100, 100)).toBe(1);
        expect(cycleEdgeOpacity(950, 1000, 100, 100)).toBe(0.5);
        expect(cycleEdgeOpacity(1000, 1000, 100, 100)).toBe(0);
    });
});

it('keeps native FAQ details closed, all content and responsive classes', () => {
    const html = renderToStaticMarkup(
        createElement(TopicFaqList, {
            faqs: [
                { question: 'Question ?', answer: 'Réponse.' },
                { question: 'Autre ?', answer: 'Suite.' },
            ],
        }),
    );
    expect(html.match(/<details /g)).toHaveLength(2);
    expect(html.match(/<summary /g)).toHaveLength(2);
    expect(html).not.toContain(' open');
    expect(html).toContain('Réponse.');
    expect(html).toContain('Suite.');
    expect(html).toContain('justify-between gap-4');
    expect(html).toContain('group-open:rotate-180');
});

it.each([
    [null, 'neutral'],
    [undefined, 'neutral'],
    [0, 'critical'],
    [39, 'critical'],
    [40, 'warning'],
    [69, 'warning'],
    [70, 'ok'],
    [100, 'ok'],
])('keeps score %s tone %s', (score, tone) => {
    expect(scoreTone(score)).toBe(tone);
});

it('shows actual zero strength and preserves missing scores', () => {
    const html = renderToStaticMarkup(
        createElement(AgentStrengthMessage, { item: { message: 'Observé', score: 0, dimensionLabel: 'Protocoles' } }),
    );
    expect(html).toContain('0/100');
    expect(html).toContain('Protocoles');
    expect(
        renderToStaticMarkup(createElement(AgentStrengthMessage, { item: { message: 'Observé', score: null } })),
    ).not.toContain('/100');
});

it('keeps fix priority labels and chip color', () => {
    const html = renderToStaticMarkup(
        createElement(AgentFixMessage, { item: { message: 'Corriger', priority: 'high', dimensionLabel: 'Surface' } }),
    );
    expect(html).toContain('Corriger');
    expect(html).toContain('Surface');
    expect(html).toContain('Priorité haute');
    expect(html).toContain('text-rose-100');
});
