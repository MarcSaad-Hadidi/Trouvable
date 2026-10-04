'use client';

import { CommandChartCard } from '@/features/admin/shared/components/command/CommandChartCard';
import { COMMAND_PANEL, cn } from '@/lib/design/tokens';
import { toneFromStatus } from '@/features/admin/agent/agent-page-primitives';
import { formatAgentStatus, formatAgentPriority, toneForPriority } from '@/features/admin/agent/agent-copy';

type AgentMessage = {
    message: string;
    dimensionLabel?: string;
};

export function AgentStrengthMessage({ item }: { item: AgentMessage & { score?: number | null } }) {
    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold text-white/92">{item.message}</span>
                {item.score != null ? <AgentChip tone="ok">{item.score}/100</AgentChip> : null}
            </div>
            {item.dimensionLabel ? <div className="text-[12px] text-white/58">{item.dimensionLabel}</div> : null}
        </div>
    );
}

export function AgentFixMessage({ item }: { item: AgentMessage & { priority?: string } }) {
    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold text-white/92">{item.message}</span>
                {item.priority ? (
                    <AgentChip tone={toneForPriority(item.priority)}>{formatAgentPriority(item.priority)}</AgentChip>
                ) : null}
            </div>
            {item.dimensionLabel ? <div className="text-[12px] text-white/58">{item.dimensionLabel}</div> : null}
        </div>
    );
}

function toneClasses(tone) {
    if (tone === 'ok') return 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100';
    if (tone === 'warning') return 'border-amber-300/20 bg-amber-400/10 text-amber-100';
    if (tone === 'critical') return 'border-rose-300/20 bg-rose-400/10 text-rose-100';
    if (tone === 'info') return 'border-sky-300/20 bg-sky-400/10 text-sky-100';
    return 'border-white/[0.08] bg-white/[0.03] text-white/60';
}

export function AgentChip({ children, tone = 'neutral' }) {
    return (
        <span
            className={cn('rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em]', toneClasses(tone))}
        >
            {children}
        </span>
    );
}

export function AgentDimensionGrid({ title, subtitle, dimensions = [] }) {
    if (!dimensions.length) return null;
    return (
        <CommandChartCard title={title} subtitle={subtitle}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {dimensions.map((dimension) => {
                    const tone = toneFromStatus(dimension.status);
                    return (
                        <div key={dimension.key || dimension.label} className={cn(COMMAND_PANEL, 'p-4')}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-[13px] font-semibold text-white/92">{dimension.label}</div>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                        {dimension.status ? (
                                            <AgentChip tone={tone}>{formatAgentStatus(dimension.status)}</AgentChip>
                                        ) : null}
                                        {dimension.weight != null ? (
                                            <AgentChip>{`${Math.round(Number(dimension.weight) * 100)}%`}</AgentChip>
                                        ) : null}
                                        {dimension.signalLabel ? <AgentChip>{dimension.signalLabel}</AgentChip> : null}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[26px] font-semibold tracking-[-0.05em] text-white/94">
                                        {dimension.score ?? '-'}
                                    </div>
                                    <div className="text-[10px] text-white/38">/100</div>
                                </div>
                            </div>
                            {dimension.summary ? (
                                <p className="mt-3 text-[12px] leading-relaxed text-white/58">{dimension.summary}</p>
                            ) : null}
                            {Array.isArray(dimension.evidence) && dimension.evidence.length > 0 ? (
                                <div className="mt-3 space-y-1">
                                    {dimension.evidence.slice(0, 3).map((item, index) => (
                                        <div
                                            key={`${dimension.key}-ev-${index}`}
                                            className="text-[11px] text-emerald-100/80"
                                        >
                                            - {item}
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                            {Array.isArray(dimension.gaps) && dimension.gaps.length > 0 ? (
                                <div className="mt-3 space-y-1">
                                    {dimension.gaps.slice(0, 3).map((item, index) => (
                                        <div
                                            key={`${dimension.key}-gap-${index}`}
                                            className="text-[11px] text-amber-100/80"
                                        >
                                            - {item}
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </CommandChartCard>
    );
}

export function AgentMessageList({ title, subtitle, items = [], emptyTitle, renderItem }) {
    return (
        <CommandChartCard title={title} subtitle={subtitle}>
            {items.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-white/[0.08] bg-white/[0.02] p-4 text-[12px] text-white/55">
                    {emptyTitle}
                </div>
            ) : (
                <div className="space-y-3">
                    {items.map((item, index) => (
                        <div
                            key={item.id || `${title}-${index}`}
                            className="rounded-[18px] border border-white/[0.06] bg-white/[0.02] p-4"
                        >
                            {renderItem(item, index)}
                        </div>
                    ))}
                </div>
            )}
        </CommandChartCard>
    );
}
