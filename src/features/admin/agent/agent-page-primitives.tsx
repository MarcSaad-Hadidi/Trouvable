'use client';

import Link from 'next/link';
import React from 'react';

import { CommandPageShell, CommandHeader, CommandMetricCard } from '@/features/admin/shared/components/command';
import { CommandChartCard } from '@/features/admin/shared/components/command/CommandChartCard';
import { CommandTable } from '@/features/admin/shared/components/command/CommandTable';
import CommandEmptyState from '@/features/admin/shared/components/command/CommandEmptyState';
import { COMMAND_BUTTONS, COMMAND_PANEL, cn } from '@/lib/design/tokens';

function isPrimitive(value: unknown) {
    return (
        value === null ||
        value === undefined ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    );
}

export function formatValue(value: unknown) {
    if (value === null || value === undefined || value === '') return 'n.d.';
    if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return 'n.d.';
        if (Number.isInteger(value)) return value.toLocaleString('fr-CA');
        return value.toFixed(2);
    }
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.length ? `${value.length} élément(s)` : '0';
    if (typeof value === 'object') return 'Disponible';
    return String(value);
}

export function toneFromStatus(status?: string | null) {
    const normalized = String(status || '').toLowerCase();
    if (
        [
            'ok',
            'healthy',
            'success',
            'sain',
            'covered',
            'couvert',
            'aligne',
            'alignee',
            'aligné',
            'alignée',
            'autorise',
            'autorisé',
            'present',
            'available',
            'done',
            'resolved',
        ].includes(normalized)
    )
        return 'ok';
    if (
        [
            'warning',
            'warn',
            'partial',
            'partiel',
            'weak',
            'stale',
            'draft',
            'ambigu',
            'a confirmer',
            'à confirmer',
            'open',
            'in_progress',
            'needs_review',
        ].includes(normalized)
    )
        return 'warning';
    if (
        [
            'critical',
            'error',
            'failed',
            'blocked',
            'bloque',
            'bloqué',
            'absent',
            'missing',
            'invalid',
            'critique',
        ].includes(normalized)
    )
        return 'critical';
    if (['info', 'observed', 'measured', 'derived', 'calculated'].includes(normalized)) return 'info';
    return 'neutral';
}

export function pageActionLink(
    href: string | undefined | null,
    label: string,
    variant: 'primary' | 'secondary' = 'secondary',
) {
    if (!href) return null;
    return (
        <Link href={href} className={variant === 'primary' ? COMMAND_BUTTONS.primary : COMMAND_BUTTONS.secondary}>
            {label}
        </Link>
    );
}

export function AgentPageFrame({
    eyebrow,
    title,
    subtitle,
    actions = null,
    loading = false,
    error = null,
    emptyState = null,
    loadingMessage = 'Chargement des données du mandat...',
    errorAction = null,
    notice = null,
    children,
}: {
    eyebrow: React.ReactNode;
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    actions?: React.ReactNode;
    loading?: boolean;
    error?: string | null;
    emptyState?: { title?: string; description?: string } | null;
    loadingMessage?: string;
    errorAction?: React.ReactNode;
    notice?: React.ReactNode;
    children?: React.ReactNode;
}) {
    return (
        <CommandPageShell
            header={<CommandHeader eyebrow={eyebrow} title={title} subtitle={subtitle} actions={actions} />}
        >
            {!loading && !error ? notice : null}
            {loading ? (
                <div className={cn(COMMAND_PANEL, 'p-8')}>
                    <div className="text-[15px] font-semibold text-white/88">Chargement</div>
                    <p className="mt-2 text-[13px] text-white/50">{loadingMessage}</p>
                </div>
            ) : error ? (
                <CommandEmptyState
                    title="Données indisponibles"
                    description={error}
                    tone="critical"
                    action={errorAction}
                />
            ) : emptyState ? (
                <CommandEmptyState
                    title={emptyState.title || 'Aucune donnée disponible'}
                    description={
                        emptyState.description ||
                        'Le backend ne retourne pas encore de données exploitables pour cette vue.'
                    }
                />
            ) : (
                children
            )}
        </CommandPageShell>
    );
}

export function MetricGrid({
    items = [] as Array<{
        id?: string;
        label: React.ReactNode;
        value: React.ReactNode;
        detail?: React.ReactNode;
        tone?: string;
    }>,
}) {
    if (!items.length) return null;
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {items.map((item, index) => (
                <CommandMetricCard
                    key={item.id || index}
                    label={item.label}
                    value={item.value}
                    detail={item.detail}
                    tone={item.tone || 'neutral'}
                />
            ))}
        </div>
    );
}

export function KeyValuePanel({
    title,
    subtitle,
    entries = [] as Array<{ label: string; value: unknown }>,
}: {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    entries?: Array<{ label: string; value: unknown }>;
}) {
    if (!entries.length) return null;
    return (
        <CommandChartCard title={title} subtitle={subtitle}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {entries.map((entry, index) => (
                    <div
                        key={`${entry.label}-${index}`}
                        className="rounded-[18px] border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                    >
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">
                            {entry.label}
                        </div>
                        <div className="mt-2 text-[13px] font-medium text-white/84">{formatValue(entry.value)}</div>
                    </div>
                ))}
            </div>
        </CommandChartCard>
    );
}

export function GenericTablePanel({
    title,
    subtitle,
    rows = [],
    columns,
}: {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    rows?: Array<Record<string, any>>;
    columns?: Array<{ key: string; label: string; render?: (row: any) => React.ReactNode }>;
}) {
    if (!rows?.length) return null;
    const resolvedColumns: Array<{ key: string; label: string; render?: (row: any) => React.ReactNode }> =
        columns && columns.length
            ? columns
            : Object.keys(rows[0] || {})
                  .filter((key) => isPrimitive(rows[0]?.[key]))
                  .slice(0, 5)
                  .map((key) => ({ key, label: key }));

    if (!resolvedColumns.length) return null;

    return (
        <CommandChartCard title={title} subtitle={subtitle}>
            <CommandTable
                columns={resolvedColumns.map((column) => ({
                    id: column.key,
                    label: column.label,
                    render: (row) => (column.render ? column.render(row) : formatValue(row[column.key])),
                }))}
                rows={rows}
            />
        </CommandChartCard>
    );
}
