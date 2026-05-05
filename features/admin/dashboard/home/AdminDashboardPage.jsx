import Link from 'next/link';
import { listOperatorClients, enrichClientsWithOperationalSignals } from '@/lib/operator-data';
import {
    COMMAND_BUTTONS,
    COMMAND_PANEL,
    COMMAND_SURFACE,
    CommandHeader,
    CommandPageShell,
    cn,
    getToneMeta,
} from '@/features/admin/dashboard/shared/components/command';
import CommandStrip from '@/features/admin/dashboard/shared/components/CommandStrip';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Tableau de bord | Centre de commande Trouvable',
};

const ATTENTION_ORDER = { critical: 0, needs_attention: 1, watch: 2, stable: 3 };

/* ── Utilities ── */

function timeSinceLabel(dateStr) {
    if (!dateStr) return null;
    const hours = Math.floor((Date.now() - new Date(dateStr).getTime()) / 3600000);
    if (hours < 1) return '< 1h';
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}j`;
}

function attentionTone(attention) {
    if (attention === 'critical') return 'critical';
    if (attention === 'needs_attention') return 'warning';
    if (attention === 'watch') return 'neutral';
    return 'ok';
}

/* ── Portfolio Pulse Ring (SVG) ── */

function PulseRing({ counts, total }) {
    const segments = [
        { key: 'critical', color: '#e06060', count: counts.critical },
        { key: 'needs_attention', color: '#d4a34a', count: counts.needs_attention },
        { key: 'watch', color: 'rgba(255,255,255,0.2)', count: counts.watch },
        { key: 'stable', color: '#4ade80', count: counts.stable },
    ];

    const radius = 58;
    const strokeWidth = 10;
    const circumference = 2 * Math.PI * radius;
    const size = (radius + strokeWidth) * 2;
    const center = size / 2;
    let offset = 0;

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
                {/* Track */}
                <circle
                    cx={center} cy={center} r={radius}
                    fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth}
                />
                {/* Segments */}
                {segments.map((seg) => {
                    if (seg.count === 0 || total === 0) return null;
                    const pct = seg.count / total;
                    const len = pct * circumference;
                    const gap = total > 1 ? 3 : 0;
                    const el = (
                        <circle
                            key={seg.key}
                            cx={center} cy={center} r={radius}
                            fill="none"
                            stroke={seg.color}
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${Math.max(0, len - gap)} ${circumference - len + gap}`}
                            strokeDashoffset={-offset}
                            strokeLinecap="round"
                            className="transition-all duration-700"
                            style={{ opacity: 0.8 }}
                        />
                    );
                    offset += len;
                    return el;
                })}
            </svg>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-[32px] font-bold tracking-[-0.04em] text-white tabular-nums">{total}</div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">mandats</div>
            </div>
        </div>
    );
}

/* ── Legend Row ── */

function PulseLegend({ counts }) {
    const items = [
        { key: 'critical', label: 'Critique', color: '#e06060', count: counts.critical },
        { key: 'needs_attention', label: 'Action requise', color: '#d4a34a', count: counts.needs_attention },
        { key: 'watch', label: 'Surveillance', color: 'rgba(255,255,255,0.35)', count: counts.watch },
        { key: 'stable', label: 'Stable', color: '#4ade80', count: counts.stable },
    ];
    return (
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {items.map((item) => (
                <div key={item.key} className="flex items-center gap-2.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.color, opacity: 0.75 }} />
                    <span className="text-[11px] text-white/45">{item.label}</span>
                    <span className="ml-auto text-[13px] font-bold tabular-nums text-white/75">{item.count}</span>
                </div>
            ))}
        </div>
    );
}

/* ── Next Decision Card ── */

function NextDecisionCard({ client }) {
    if (!client) return null;
    const s = client.operatorSignals;
    const isUrgent = s?.attention === 'critical' || s?.attention === 'needs_attention';
    const tone = getToneMeta(attentionTone(s?.attention));
    const primaryReason = s?.reasons?.[0] || (isUrgent ? 'Examen recommandé' : 'Mandat le plus actif');

    return (
        <div className={cn(COMMAND_SURFACE, 'relative overflow-hidden p-5 sm:p-6')}>
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-40" />
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
                            {isUrgent ? 'Prochaine décision' : 'Prochain mandat'}
                        </span>
                    </div>
                    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em]', tone.pill)}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
                        {s?.attention === 'critical' ? 'Critique' : s?.attention === 'needs_attention' ? 'Action requise' : s?.attention === 'watch' ? 'Surveillance' : 'Stable'}
                    </span>
                </div>

                <div>
                    <h3 className="text-[20px] font-bold tracking-[-0.03em] text-white/95">{client.client_name}</h3>
                    <p className="mt-2 text-[12px] leading-relaxed text-white/50">
                        {primaryReason} · {s?.openOpportunities ?? 0} actions en file · {s?.completedRunsWindow ?? 0} exécutions / 21j
                    </p>
                </div>

                {s?.reasons?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {s.reasons.slice(0, 4).map((r) => (
                            <span key={r} className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-[9px] font-semibold text-white/40">{r}</span>
                        ))}
                    </div>
                )}

                <Link
                    href={`/admin/clients/${client.id}/dossier`}
                    className={cn(COMMAND_BUTTONS.primary, 'self-start')}
                >
                    Ouvrir le dossier
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                </Link>
            </div>
        </div>
    );
}

/* ── Freshness Indicators ── */

function FreshnessCard({ rows }) {
    const now = Date.now();
    const withRun = rows.filter((r) => r.operatorSignals?.latestRunAt);
    const fresh = withRun.filter((r) => (now - new Date(r.operatorSignals.latestRunAt).getTime()) / 3600000 < 24).length;
    const aging = withRun.filter((r) => { const h = (now - new Date(r.operatorSignals.latestRunAt).getTime()) / 3600000; return h >= 24 && h < 72; }).length;
    const stale = withRun.filter((r) => (now - new Date(r.operatorSignals.latestRunAt).getTime()) / 3600000 >= 72).length;
    const noRun = rows.length - withRun.length;

    const cells = [
        { label: '< 24h', value: fresh, color: 'text-emerald-300' },
        { label: '24–72h', value: aging, color: 'text-amber-300' },
        { label: '> 72h', value: stale, color: 'text-red-300' },
        { label: 'Aucune', value: noRun, color: 'text-white/30' },
    ];

    return (
        <div className={cn(COMMAND_PANEL, 'px-5 py-4')}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35 mb-4">Fraîcheur des données</div>
            <div className="grid grid-cols-4 gap-3 text-center">
                {cells.map((c) => (
                    <div key={c.label}>
                        <div className={cn('text-[20px] font-bold tabular-nums', c.color)}>{c.value}</div>
                        <div className="text-[9px] text-white/25 mt-0.5">{c.label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ── Actions Pipeline ── */

function ActionsPipelineCard({ totalActions, criticalCount, attentionCount }) {
    return (
        <div className={cn(COMMAND_PANEL, 'px-5 py-4')}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35 mb-4">Actions en pipeline</div>
            <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                    <div className="text-[20px] font-bold tabular-nums text-white/85">{totalActions}</div>
                    <div className="text-[9px] text-white/25 mt-0.5">Total</div>
                </div>
                <div>
                    <div className="text-[20px] font-bold tabular-nums text-[#e06060]">{criticalCount}</div>
                    <div className="text-[9px] text-white/25 mt-0.5">Critiques</div>
                </div>
                <div>
                    <div className="text-[20px] font-bold tabular-nums text-[#d4a34a]">{attentionCount}</div>
                    <div className="text-[9px] text-white/25 mt-0.5">Attention</div>
                </div>
            </div>
        </div>
    );
}

/* ── Priority Mandate Strip ── */

function MandateCard({ client }) {
    const s = client.operatorSignals;
    const tone = getToneMeta(attentionTone(s?.attention));
    const freshLabel = timeSinceLabel(s?.latestRunAt);

    return (
        <Link
            href={`/admin/clients/${client.id}/dossier`}
            className="group flex w-[260px] shrink-0 flex-col gap-3 rounded-[14px] border border-white/[0.07] bg-[#111111] p-4 transition-all duration-200 hover:border-white/[0.14] hover:bg-[#141414]"
        >
            <div className="flex items-center justify-between">
                <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em]', tone.pill)}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot, s?.attention === 'critical' && 'cmd-health-dot')} />
                    {s?.attention === 'critical' ? 'Critique' : s?.attention === 'needs_attention' ? 'Attention' : s?.attention === 'watch' ? 'Surveillance' : 'Stable'}
                </span>
                {freshLabel && (
                    <span className="text-[9px] text-white/25 tabular-nums">{freshLabel}</span>
                )}
            </div>
            <div>
                <div className="text-[14px] font-semibold text-white/90 group-hover:text-white truncate transition-colors">{client.client_name}</div>
                <div className="text-[10px] text-white/30 mt-1">
                    {s?.openOpportunities ?? 0} actions · {s?.completedRunsWindow ?? 0} exéc.
                </div>
            </div>
            {s?.reasons?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {s.reasons.slice(0, 2).map((r) => (
                        <span key={r} className="rounded border border-white/[0.05] bg-white/[0.03] px-1.5 py-0.5 text-[8px] text-white/30">{r}</span>
                    ))}
                </div>
            )}
        </Link>
    );
}

/* ── Main Page ── */

export default async function AdminDashboard() {
    let clients = [];
    let enrichError = null;

    try {
        const raw = await listOperatorClients();
        clients = await enrichClientsWithOperationalSignals(raw);
    } catch (err) {
        console.error('[AdminDashboard] load:', err);
        enrichError = err.message;
    }

    const sorted = [...clients].sort((a, b) => {
        const da = ATTENTION_ORDER[a.operatorSignals?.attention] ?? 9;
        const db = ATTENTION_ORDER[b.operatorSignals?.attention] ?? 9;
        return da - db;
    });

    const counts = {
        critical: clients.filter((c) => c.operatorSignals?.attention === 'critical').length,
        needs_attention: clients.filter((c) => c.operatorSignals?.attention === 'needs_attention').length,
        watch: clients.filter((c) => c.operatorSignals?.attention === 'watch').length,
        stable: clients.filter((c) => c.operatorSignals?.attention === 'stable').length,
    };

    const totalActions = clients.reduce((sum, c) => sum + (c.operatorSignals?.openOpportunities ?? 0), 0);
    const urgentClient = sorted.find((c) => c.operatorSignals?.attention === 'critical' || c.operatorSignals?.attention === 'needs_attention') || sorted[0] || null;

    const header = (
        <CommandHeader
            eyebrow="Centre de commande"
            title="Tableau de bord"
            subtitle="Triage portefeuille, mandats critiques, fraîcheur des données et prochaines actions."
            actions={(
                <>
                    <Link href="/admin/clients" className={COMMAND_BUTTONS.secondary}>
                        Portefeuille
                    </Link>
                    <Link href="/admin/clients/new" className={COMMAND_BUTTONS.primary}>
                        Nouveau mandat
                    </Link>
                </>
            )}
        />
    );

    return (
        <div className="flex-1 flex flex-col h-screen min-w-0">
            <CommandStrip />
            <div className="geo-content flex-1 overflow-y-auto">
                <CommandPageShell header={header}>
                    {enrichError && (
                        <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-[12px] text-rose-200">
                            Erreur de chargement : {enrichError}
                        </div>
                    )}

                    {/* ── Row 1: Portfolio Pulse + Next Decision ── */}
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                        {/* Portfolio Pulse */}
                        <div className={cn(COMMAND_SURFACE, 'p-5 sm:p-6')}>
                            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35 mb-5">Portfolio Pulse</div>
                            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
                                <PulseRing counts={counts} total={clients.length} />
                                <PulseLegend counts={counts} />
                            </div>
                        </div>

                        {/* Next Decision */}
                        <NextDecisionCard client={urgentClient} />
                    </div>

                    {/* ── Row 2: Freshness + Actions Pipeline ── */}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <FreshnessCard rows={clients} />
                        <ActionsPipelineCard
                            totalActions={totalActions}
                            criticalCount={counts.critical}
                            attentionCount={counts.needs_attention}
                        />
                    </div>

                    {/* ── Row 3: Priority Mandate Strip ── */}
                    {sorted.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">Mandats par priorité</div>
                                <Link href="/admin/clients" className="text-[10px] font-semibold text-white/30 hover:text-white/60 transition-colors">
                                    Voir tout →
                                </Link>
                            </div>
                            <div className="flex gap-3 overflow-x-auto pb-2 -mb-2 scrollbar-thin scrollbar-thumb-white/10">
                                {sorted.slice(0, 12).map((c) => (
                                    <MandateCard key={c.id} client={c} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Row 4: Quick Actions ── */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Link href="/admin/clients" className={cn(COMMAND_PANEL, 'group px-4 py-4 transition-all hover:border-white/[0.18]')}>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35 mb-2">Portefeuille</div>
                            <div className="text-[13px] font-semibold text-white/75 transition-colors group-hover:text-white">Tous les mandats</div>
                        </Link>
                        <Link href="/admin/clients/new" className={cn(COMMAND_PANEL, 'group px-4 py-4 transition-all hover:border-white/[0.18]')}>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35 mb-2">Nouveau</div>
                            <div className="text-[13px] font-semibold text-white/75 transition-colors group-hover:text-white">Créer un mandat</div>
                        </Link>
                        {clients[0] && (
                            <Link href={`/admin/clients/${clients[0].id}/dossier`} className={cn(COMMAND_PANEL, 'group px-4 py-4 transition-all hover:border-white/[0.18]')}>
                                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35 mb-2">Dernier mandat</div>
                                <div className="text-[13px] font-semibold text-white/75 transition-colors group-hover:text-white truncate">{clients[0].client_name}</div>
                            </Link>
                        )}
                        {counts.critical > 0 && urgentClient && (
                            <Link
                                href={`/admin/clients/${urgentClient.id}/dossier`}
                                className="group rounded-[14px] border border-[#e06060]/20 bg-[#e06060]/[0.04] px-4 py-4 transition-all hover:border-[#e06060]/35"
                            >
                                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#e06060]/60 mb-2">Critique</div>
                                <div className="text-[13px] font-semibold text-[#f0a8a8] transition-colors group-hover:text-white truncate">
                                    {urgentClient.client_name}
                                </div>
                            </Link>
                        )}
                    </div>
                </CommandPageShell>
            </div>
        </div>
    );
}
