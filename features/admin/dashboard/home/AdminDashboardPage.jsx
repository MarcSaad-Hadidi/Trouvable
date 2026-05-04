import Link from 'next/link';
import { listOperatorClients, enrichClientsWithOperationalSignals } from '@/lib/operator-data';
import {
    COMMAND_BUTTONS,
    COMMAND_PANEL,
    CommandHeader,
    CommandMetricCard,
    CommandPageShell,
    cn,
} from '@/features/admin/dashboard/shared/components/command';
import CommandStrip from '@/features/admin/dashboard/shared/components/CommandStrip';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Tableau de bord | Centre de commande Trouvable',
};

const ATTENTION_ORDER = { critical: 0, needs_attention: 1, watch: 2, stable: 3 };

const KPI_TONE = {
    default: 'neutral',
    blue: 'info',
    critical: 'critical',
    warning: 'warning',
    success: 'ok',
};

function HealthBar({ rows }) {
    const buckets = [
        { key: 'critical', label: 'Critique', color: '#f87171' },
        { key: 'needs_attention', label: 'Action requise', color: '#fbbf24' },
        { key: 'watch', label: 'Surveillance', color: 'rgba(255,255,255,0.3)' },
        { key: 'stable', label: 'Stable', color: '#34d399' },
    ];
    const counts = {};
    buckets.forEach((b) => { counts[b.key] = rows.filter((r) => (r.operatorSignals?.attention || 'stable') === b.key).length; });
    const total = rows.length || 1;
    const activeBuckets = buckets.filter((b) => counts[b.key] > 0);
    if (activeBuckets.length <= 1) return null;

    return (
        <div className={cn(COMMAND_PANEL, 'px-5 py-4')}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/[0.4] mb-3">
                Santé du portefeuille
            </div>
            <div className="flex h-[8px] overflow-hidden rounded-full bg-white/[0.03] mb-3">
                {buckets.map((bucket) => {
                    const pct = (counts[bucket.key] / total) * 100;
                    if (pct === 0) return null;
                    return (
                        <div
                            key={bucket.key}
                            className="h-full transition-all duration-700"
                            style={{ width: `${pct}%`, background: bucket.color, opacity: 0.65, marginRight: 1 }}
                        />
                    );
                })}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                {buckets.map((bucket) => {
                    if (counts[bucket.key] === 0) return null;
                    const pct = Math.round((counts[bucket.key] / total) * 100);
                    return (
                        <div key={bucket.key} className="flex items-center gap-2 text-[10px]">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: bucket.color, opacity: 0.7 }} />
                            <span className="text-white/40">{bucket.label}</span>
                            <span className="font-bold tabular-nums text-white/65">{counts[bucket.key]}</span>
                            <span className="text-white/20">({pct}%)</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function FreshnessGrid({ rows }) {
    const now = Date.now();
    const withRun = rows.filter((r) => r.operatorSignals?.latestRunAt);
    if (withRun.length === 0) return null;

    const fresh = withRun.filter((r) => (now - new Date(r.operatorSignals.latestRunAt).getTime()) / 3600000 < 24).length;
    const aging = withRun.filter((r) => { const h = (now - new Date(r.operatorSignals.latestRunAt).getTime()) / 3600000; return h >= 24 && h < 72; }).length;
    const stale = withRun.filter((r) => (now - new Date(r.operatorSignals.latestRunAt).getTime()) / 3600000 >= 72).length;
    const noRun = rows.length - withRun.length;

    return (
        <div className={cn(COMMAND_PANEL, 'px-5 py-4')}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/[0.4] mb-3">Fraîcheur des données</div>
            <div className="grid grid-cols-4 gap-3 text-center">
                <div>
                    <div className="text-[18px] font-bold tabular-nums text-emerald-300">{fresh}</div>
                    <div className="text-[9px] text-white/25 mt-0.5">{'< 24h'}</div>
                </div>
                <div>
                    <div className="text-[18px] font-bold tabular-nums text-amber-300">{aging}</div>
                    <div className="text-[9px] text-white/25 mt-0.5">24-72h</div>
                </div>
                <div>
                    <div className="text-[18px] font-bold tabular-nums text-red-300">{stale}</div>
                    <div className="text-[9px] text-white/25 mt-0.5">{'> 72h'}</div>
                </div>
                <div>
                    <div className="text-[18px] font-bold tabular-nums text-white/30">{noRun}</div>
                    <div className="text-[9px] text-white/25 mt-0.5">Aucune exécution</div>
                </div>
            </div>
        </div>
    );
}

function AttentionDot({ attention }) {
    const colors = { critical: 'bg-red-400', needs_attention: 'bg-amber-400', watch: 'bg-white/30', stable: 'bg-emerald-400' };
    return <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors[attention] || colors.stable} ${attention === 'critical' ? 'cmd-health-dot' : ''}`} />;
}

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

    const criticalCount = clients.filter((c) => c.operatorSignals?.attention === 'critical').length;
    const attentionCount = clients.filter((c) => c.operatorSignals?.attention === 'needs_attention').length;
    const stableCount = clients.filter((c) => c.operatorSignals?.attention === 'stable').length;
    const totalActions = clients.reduce((sum, c) => sum + (c.operatorSignals?.openOpportunities ?? 0), 0);
    const priorityClients = sorted.filter((c) => c.operatorSignals?.attention === 'critical' || c.operatorSignals?.attention === 'needs_attention').slice(0, 8);
    const latestClient = clients[0] || null;
    const criticalClient = sorted.find((c) => c.operatorSignals?.attention === 'critical') || null;

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

                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
                        <CommandMetricCard label="Mandats actifs" value={clients.length} tone={KPI_TONE.blue} />
                        <CommandMetricCard
                            label="Critiques"
                            value={criticalCount}
                            tone={criticalCount > 0 ? KPI_TONE.critical : KPI_TONE.default}
                        />
                        <CommandMetricCard
                            label="Actions requises"
                            value={attentionCount}
                            tone={attentionCount > 0 ? KPI_TONE.warning : KPI_TONE.default}
                        />
                        <CommandMetricCard label="Stables" value={stableCount} tone={KPI_TONE.success} />
                        <CommandMetricCard label="Actions en file" value={totalActions} tone={KPI_TONE.default} />
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <HealthBar rows={clients} />
                        <FreshnessGrid rows={clients} />
                    </div>

                    {priorityClients.length > 0 && (
                        <div className={cn(COMMAND_PANEL, 'overflow-hidden p-0')}>
                            <div className="px-5 py-3.5 border-b border-white/[0.05]">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/[0.4]">Mandats prioritaires</div>
                            </div>
                            <div className="divide-y divide-white/[0.04]">
                                {priorityClients.map((c) => {
                                    const s = c.operatorSignals;
                                    return (
                                        <Link
                                            key={c.id}
                                            href={`/admin/clients/${c.id}/dossier`}
                                            className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.025] transition-colors group"
                                        >
                                            <AttentionDot attention={s?.attention} />
                                            <div className="flex-1 min-w-0">
                                                <span className="text-[13px] font-semibold text-white/85 group-hover:text-[#a78bfa] transition-colors truncate block">
                                                    {c.client_name}
                                                </span>
                                                <span className="text-[10px] text-white/25 mt-0.5 block">
                                                    {s?.activePrompts ?? 0} prompts · {s?.openOpportunities ?? 0} actions · {s?.completedRunsWindow ?? 0} exécutions / 21 j
                                                </span>
                                            </div>
                                            {s?.reasons?.length > 0 && (
                                                <div className="hidden sm:flex flex-wrap gap-1 shrink-0">
                                                    {s.reasons.slice(0, 3).map((r) => (
                                                        <span key={r} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/30 border border-white/[0.05]">{r}</span>
                                                    ))}
                                                </div>
                                            )}
                                            <svg className="w-4 h-4 text-white/15 group-hover:text-white/35 shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Link href="/admin/clients" className={cn(COMMAND_PANEL, 'group px-4 py-4 transition-all hover:border-white/[0.18]')}>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/[0.4] mb-2">Portefeuille</div>
                            <div className="text-[13px] font-semibold text-white/75 transition-colors group-hover:text-white">Tous les mandats</div>
                        </Link>
                        <Link href="/admin/clients/new" className={cn(COMMAND_PANEL, 'group px-4 py-4 transition-all hover:border-white/[0.18]')}>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/[0.4] mb-2">Nouveau</div>
                            <div className="text-[13px] font-semibold text-white/75 transition-colors group-hover:text-white">Créer un mandat</div>
                        </Link>
                        {latestClient && (
                            <Link href={`/admin/clients/${latestClient.id}/dossier`} className={cn(COMMAND_PANEL, 'group px-4 py-4 transition-all hover:border-white/[0.18]')}>
                                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/[0.4] mb-2">Dernier mandat</div>
                                <div className="text-[13px] font-semibold text-white/75 transition-colors group-hover:text-white truncate">{latestClient.client_name}</div>
                            </Link>
                        )}
                        {criticalCount > 0 && criticalClient && (
                            <Link
                                href={`/admin/clients/${criticalClient.id}/dossier`}
                                className="group rounded-[22px] border border-rose-300/25 bg-[linear-gradient(180deg,rgba(36,18,22,0.96)_0%,rgba(19,11,14,0.94)_100%)] px-4 py-4 transition-all hover:border-rose-300/40"
                            >
                                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-200/70 mb-2">Critique</div>
                                <div className="text-[13px] font-semibold text-rose-100 transition-colors group-hover:text-white truncate">
                                    {criticalClient.client_name}
                                </div>
                            </Link>
                        )}
                    </div>
                </CommandPageShell>
            </div>
        </div>
    );
}
