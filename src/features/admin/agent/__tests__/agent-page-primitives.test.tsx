import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { formatValue, GenericTablePanel } from '../agent-page-primitives';

describe('Agent metric presentation', () => {
    it.each([null, undefined, '', NaN, Infinity, -Infinity])('renders unavailable %s as n.d.', (value) => {
        expect(formatValue(value)).toBe('n.d.');
    });

    it('preserves observed zero and finite numeric formatting', () => {
        expect(formatValue(0)).toBe('0');
        expect(formatValue(12.345)).toBe('12.35');
        expect(formatValue(1200)).toBe((1200).toLocaleString('fr-CA'));
    });

    it('preserves literal strings and boolean labels', () => {
        expect(formatValue('0')).toBe('0');
        expect(formatValue('12.50')).toBe('12.50');
        expect(formatValue(false)).toBe('Non');
        expect(formatValue(true)).toBe('Oui');
    });
});

function tableRows(html: string) {
    const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] || '';
    return Array.from(body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g), (row) =>
        Array.from(row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g), (cell) => cell[1]),
    );
}

function tableHeaders(html: string) {
    return Array.from(html.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g), (header) => header[1]);
}

describe('Agent table presentation', () => {
    it('preserves explicit column order, row order and the standard table shell', () => {
        const html = renderToStaticMarkup(
            <GenericTablePanel
                title="Observed sources"
                subtitle="Current sample"
                rows={[
                    { id: 'b', host: 'beta.example', count: 0 },
                    { id: 'a', host: 'alpha.example', count: null },
                ]}
                columns={[
                    { key: 'count', label: 'Mentions' },
                    { key: 'host', label: 'Source' },
                ]}
            />,
        );
        expect(html).toContain('Observed sources');
        expect(html).toContain('Current sample');
        expect(html).toContain('overflow-x-auto');
        expect(html).toContain('scope="col"');
        expect(tableHeaders(html)).toEqual(['Mentions', 'Source']);
        expect(tableRows(html)).toEqual([
            ['0', 'beta.example'],
            ['n.d.', 'alpha.example'],
        ]);
    });

    it('formats missing, boolean, numeric and literal values without inventing zero', () => {
        const values = [0, null, undefined, '', false, true, NaN, Infinity, -Infinity, 12.345, '12.50'];
        const html = renderToStaticMarkup(
            <GenericTablePanel
                title="Values"
                rows={values.map((value, index) => ({ id: `value-${index}`, value }))}
                columns={[{ key: 'value', label: 'Value' }]}
            />,
        );
        expect(tableRows(html)).toEqual([
            ['0'],
            ['n.d.'],
            ['n.d.'],
            ['n.d.'],
            ['Non'],
            ['Oui'],
            ['n.d.'],
            ['n.d.'],
            ['n.d.'],
            ['12.35'],
            ['12.50'],
        ]);
    });

    it('passes each original row to custom renderers and preserves their React markup', () => {
        const rows = [
            { id: 'a', label: 'Alpha', nested: { count: 2 } },
            { id: 'b', label: 'Beta', nested: { count: 0 } },
        ];
        const renderCell = vi.fn((row) => <strong>{`${row.label}: ${row.nested.count}`}</strong>);
        const html = renderToStaticMarkup(
            <GenericTablePanel
                title="Custom"
                rows={rows}
                columns={[{ key: 'label', label: 'Name', render: renderCell }]}
            />,
        );
        expect(renderCell).toHaveBeenCalledTimes(2);
        expect(renderCell.mock.calls[0][0]).toBe(rows[0]);
        expect(renderCell.mock.calls[1][0]).toBe(rows[1]);
        expect(tableRows(html)).toEqual([['<strong>Alpha: 2</strong>'], ['<strong>Beta: 0</strong>']]);
    });

    it('preserves custom zero and empty React results without applying the fallback formatter', () => {
        const html = renderToStaticMarkup(
            <GenericTablePanel
                title="Custom empties"
                rows={[{ id: 'known', source: '<literal>' }]}
                columns={[
                    { key: 'source', label: 'Source' },
                    { key: 'zero', label: 'Zero', render: () => 0 },
                    { key: 'false', label: 'False', render: () => false },
                    { key: 'null', label: 'Null', render: () => null },
                ]}
            />,
        );
        expect(tableRows(html)).toEqual([['&lt;literal&gt;', '0', '', '']]);
    });

    it.each([undefined, []])('infers at most five primitive columns from the first row for columns=%s', (columns) => {
        const html = renderToStaticMarkup(
            <GenericTablePanel
                title="Inferred"
                rows={[
                    {
                        label: 'First',
                        nested: { excluded: true },
                        empty: null,
                        list: ['excluded'],
                        count: 0,
                        enabled: false,
                        unknown: undefined,
                        omitted: 'Sixth primitive',
                    },
                    { label: 'Second', nested: 'Still excluded', count: 2, later: 'Not inferred' },
                ]}
                columns={columns}
            />,
        );
        expect(tableHeaders(html)).toEqual(['label', 'empty', 'count', 'enabled', 'unknown']);
        expect(tableRows(html)).toEqual([
            ['First', 'n.d.', '0', 'Non', 'n.d.'],
            ['Second', 'n.d.', '2', 'n.d.', 'n.d.'],
        ]);
        expect(html).not.toContain('Sixth primitive');
        expect(html).not.toContain('Not inferred');
    });

    it('returns no panel for empty rows or rows without any inferred primitive column', () => {
        expect(renderToStaticMarkup(<GenericTablePanel title="Empty" rows={[]} />)).toBe('');
        expect(renderToStaticMarkup(<GenericTablePanel title="Missing" />)).toBe('');
        expect(renderToStaticMarkup(<GenericTablePanel title="Nested" rows={[{ object: {}, list: [] }]} />)).toBe('');
        expect(renderToStaticMarkup(<GenericTablePanel title="First row" rows={[{}, { value: 1 }]} />)).toBe('');
    });
});
