'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

import { COMMAND_PANEL, COMMAND_SURFACE_SOFT, cn, getToneMeta } from './tokens';

/**
 * CommandTable — table standardisée pour listes d'opérations, files d'actions et portefeuille.
 *
 * Props :
 *   - columns: Array<{
 *       id: string,
 *       label: string | ReactNode,
 *       align?: 'left' | 'right' | 'center',
 *       width?: string,            // ex: '180px' ou '25%'
 *       sortable?: boolean,        // active le tri cliquable
 *       accessor?: (row) => any,   // valeur pour le tri (défaut: row[id])
 *       render?: (row, index) => ReactNode, // cellule custom (défaut: accessor)
 *       sticky?: boolean,          // colonne figée (utile pour "actions")
 *     }>
 *   - rows: Array<object>            — données (chaque ligne doit avoir `id` unique)
 *   - emptyState: ReactNode          — affiché si rows vide après filtrage (défaut: rien)
 *   - rowHref?: (row) => string      — rend la ligne cliquable (navigation)
 *   - onRowClick?: (row) => void     — callback ligne (prioritaire sur rowHref)
 *   - defaultSort?: { id, direction: 'asc' | 'desc' }
 *   - toneForRow?: (row) => tone     — applique une bordure gauche sémantique
 *   - density?: 'comfortable' | 'compact'
 *   - stickyHeader?: boolean         — header collant (défaut true)
 *   - footer?: ReactNode             — footer (pagination, totaux…)
 *   - className?: string
 */
export function CommandTable({
    columns = [],
    headers = null,
    rows = [],
    emptyState = null,
    rowHref = null,
    onRowClick = null,
    defaultSort = null,
    toneForRow = null,
    density = 'comfortable',
    stickyHeader = true,
    footer = null,
    className = '',
}) {
    const [sort, setSort] = useState(defaultSort);
    const resolvedColumns = useMemo(() => {
        if (columns.length > 0 || !Array.isArray(headers) || headers.length === 0) {
            return columns;
        }

        return headers.map((label, index) => ({
            id: `legacy-${index}`,
            label,
            render: (row) => (Array.isArray(row) ? row[index] : row?.[`legacy-${index}`]),
        }));
    }, [columns, headers]);

    const sortedRows = useMemo(() => {
        if (!sort || !sort.id) return rows;
        const column = resolvedColumns.find((c) => c.id === sort.id);
        if (!column) return rows;
        const accessor = column.accessor || ((row) => row?.[column.id]);
        const direction = sort.direction === 'desc' ? -1 : 1;
        return [...rows].sort((a, b) => {
            const av = accessor(a);
            const bv = accessor(b);
            if (av == null && bv == null) return 0;
            if (av == null) return 1;
            if (bv == null) return -1;
            if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * direction;
            return String(av).localeCompare(String(bv), 'fr') * direction;
        });
    }, [rows, sort, resolvedColumns]);

    const toggleSort = (columnId) => {
        setSort((prev) => {
            if (!prev || prev.id !== columnId) return { id: columnId, direction: 'asc' };
            if (prev.direction === 'asc') return { id: columnId, direction: 'desc' };
            return null;
        });
    };

    if (rows.length === 0 && emptyState) {
        return <>{emptyState}</>;
    }

    const rowPadding = density === 'compact' ? 'px-3 py-2' : 'px-4 py-3';
    const headerPadding = density === 'compact' ? 'px-3 py-2' : 'px-4 py-2.5';

    return (
        <div className={cn(COMMAND_SURFACE_SOFT, 'overflow-hidden', className)}>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-[12px]">
                    <thead
                        className={cn(
                            'bg-white/[0.03] text-white/45',
                            stickyHeader && 'sticky top-0 z-10 backdrop-blur-sm',
                        )}
                    >
                        <tr className="border-b border-white/[0.06]">
                            {resolvedColumns.map((column) => {
                                const active = sort?.id === column.id;
                                const SortIcon = active
                                    ? sort.direction === 'asc'
                                        ? ArrowUp
                                        : ArrowDown
                                    : ArrowUpDown;
                                return (
                                    <th
                                        key={column.id}
                                        scope="col"
                                        style={column.width ? { width: column.width } : undefined}
                                        className={cn(
                                            headerPadding,
                                            'text-[10px] font-bold uppercase tracking-[0.12em]',
                                            column.align === 'right' && 'text-right',
                                            column.align === 'center' && 'text-center',
                                            column.sticky && 'sticky right-0 bg-[#0a0c10]/95 backdrop-blur-sm',
                                        )}
                                    >
                                        {column.sortable ? (
                                            <button
                                                type="button"
                                                onClick={() => toggleSort(column.id)}
                                                className={cn(
                                                    'inline-flex items-center gap-1.5 transition-colors',
                                                    active ? 'text-white/80' : 'hover:text-white/70',
                                                )}
                                            >
                                                <span>{column.label}</span>
                                                <SortIcon className="h-3 w-3 opacity-70" />
                                            </button>
                                        ) : (
                                            column.label
                                        )}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedRows.map((row, index) => {
                            const tone = toneForRow ? toneForRow(row) : null;
                            const toneMeta = tone ? getToneMeta(tone) : null;
                            const interactive = Boolean(onRowClick || rowHref);
                            return (
                                <CommandTableRow
                                    key={row.id ?? index}
                                    row={row}
                                    index={index}
                                    columns={resolvedColumns}
                                    rowPadding={rowPadding}
                                    toneMeta={toneMeta}
                                    interactive={interactive}
                                    onRowClick={onRowClick}
                                    rowHref={rowHref}
                                />
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {footer ? (
                <div className={cn(COMMAND_PANEL, 'rounded-none border-x-0 border-b-0 px-4 py-3')}>
                    {footer}
                </div>
            ) : null}
        </div>
    );
}

export default CommandTable;

function CommandTableRow({ row, index, columns, rowPadding, toneMeta, interactive, onRowClick, rowHref }) {
    const handleClick = (event) => {
        if (onRowClick) {
            onRowClick(row, event);
            return;
        }
        if (rowHref) {
            const href = rowHref(row);
            if (href && typeof window !== 'undefined') window.location.assign(href);
        }
    };

    return (
        <tr
            onClick={interactive ? handleClick : undefined}
            className={cn(
                'border-b border-white/[0.04] transition-colors',
                interactive && 'cursor-pointer hover:bg-white/[0.025]',
                index % 2 === 1 && !toneMeta && 'bg-white/[0.01]',
                toneMeta && 'border-l-2',
            )}
            style={
                toneMeta
                    ? { borderLeftColor: toneMeta.ring, boxShadow: `inset 3px 0 0 ${toneMeta.ring}` }
                    : undefined
            }
        >
            {columns.map((column) => {
                const accessor = column.accessor || ((r) => r?.[column.id]);
                const value = accessor(row);
                const rendered = column.render ? column.render(row, index) : value;
                return (
                    <td
                        key={column.id}
                        className={cn(
                            rowPadding,
                            'text-white/80 align-middle',
                            column.align === 'right' && 'text-right',
                            column.align === 'center' && 'text-center',
                            column.sticky && 'sticky right-0 bg-[#0a0c10]/95 backdrop-blur-sm',
                        )}
                    >
                        {rendered}
                    </td>
                );
            })}
        </tr>
    );
}
