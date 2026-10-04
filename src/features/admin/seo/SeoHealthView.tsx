// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { RefreshCwIcon } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { useGeoClient, useSeoWorkspaceSlice } from '@/features/admin/shared/context/ClientContext';
import CommandEmptyState from '@/features/admin/shared/components/command/CommandEmptyState';
import { CommandChartCard } from '@/features/admin/shared/components/command/CommandChartCard';
import { CommandTable } from '@/features/admin/shared/components/command/CommandTable';
import { CommandHeader, CommandMetricCard, CommandPageShell } from '@/features/admin/shared/components/command';
import ReliabilityPill from '@/components/shared/metrics/ReliabilityPill';
import { COMMAND_BUTTONS, COMMAND_PANEL, cn } from '@/lib/design/tokens';
import SourceStatusNotice from '@/components/shared/metrics/SourceStatusNotice';

function formatDateTime(value) {
    if (!value) return 'n.d.';
    try {
        return new Date(value).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
        return 'n.d.';
    }
}

function statusToPercent(status) {
    if (status === 'ok' || status === 'pass') return 92;
    if (status === 'warning' || status === 'partial') return 58;
    if (status === 'critical' || status === 'failed') return 28;
    return 10;
}

function statusColor(status) {
    if (status === 'ok' || status === 'pass') return 'bg-emerald-400';
    if (status === 'warning' || status === 'partial') return 'bg-amber-400';
    if (status === 'critical' || status === 'failed') return 'bg-rose-400';
    return 'bg-white/25';
}

function statusLabel(status) {
    if (status === 'ok' || status === 'pass') return 'Valide';
    if (status === 'warning' || status === 'partial') return 'A surveiller';
    if (status === 'critical' || status === 'failed') return 'Critique';
    return 'Indisponible';
}

function priorityTone(priority) {
    const normalized = String(priority || 'medium').toLowerCase();
    if (normalized === 'critical' || normalized === 'high') return 'border-rose-300/22 bg-rose-400/12 text-rose-100';
    if (normalized === 'low') return 'border-emerald-300/22 bg-emerald-400/12 text-emerald-100';
    return 'border-amber-300/22 bg-amber-400/12 text-amber-100';
}

function scoreDetail(history, currentScore) {
    if (!Array.isArray(history) || history.length < 2 || currentScore === null || currentScore === undefined) {
        return currentScore != null ? 'Lecture du dernier audit' : 'Score indisponible';
    }

    const previousEntry = history[history.length - 2];
    const previousScore = Number(previousEntry?.seoScore);
    const current = Number(currentScore);

    if (!Number.isFinite(previousScore) || !Number.isFinite(current)) return 'Lecture du dernier audit';

    const delta = current - previousScore;
    if (delta === 0) return 'Stable vs audit précédent';
    return `${delta > 0 ? '+' : ''}${delta} pt${Math.abs(delta) > 1 ? 's' : ''} vs audit précédent`;
}

function issueDeltaDetail(currentCount, history) {
    if (!Array.isArray(history) || history.length < 2) {
        return currentCount > 0 ? 'Dernier audit observé' : 'Aucune alerte critique';
    }

    const previousEntry = history[history.length - 2];
    const previousCount = Number(previousEntry?.crawlIssueCount ?? previousEntry?.issueCount);
    if (!Number.isFinite(previousCount)) return currentCount > 0 ? 'Dernier audit observé' : 'Aucune alerte critique';

    const delta = currentCount - previousCount;
    if (delta === 0) return 'Stable vs audit précédent';
    return `${delta > 0 ? '+' : ''}${delta} vs audit précédent`;
}

function warningDeltaDetail(currentCount, history) {
    if (!Array.isArray(history) || history.length < 2) {
        return currentCount > 0 ? 'Points à surveiller' : 'Aucun avertissement actif';
    }

    const previousEntry = history[history.length - 2];
    const previousTotal = Number(previousEntry?.issueCount);
    const previousCritical = Number(previousEntry?.crawlIssueCount);

    if (!Number.isFinite(previousTotal)) return currentCount > 0 ? 'Points à surveiller' : 'Aucun avertissement actif';

    const previousWarning = Math.max(previousTotal - (Number.isFinite(previousCritical) ? previousCritical : 0), 0);
    const delta = currentCount - previousWarning;

    if (delta === 0) return 'Stable vs audit précédent';
    return `${delta > 0 ? '+' : ''}${delta} vs audit précédent`;
}

const EMPTY_ROWS = [];

export default function SeoHealthPage() {
    const { client, clientId, refetch } = useGeoClient();
    const { data, loading, error, refetch: refetchHealth } = useSeoWorkspaceSlice('health');
    const [scanUrl, setScanUrl] = useState(client?.website_url || '');
    const [scanning, setScanning] = useState(false);
    const [scanError, setScanError] = useState(null);

    const baseHref = clientId ? `/admin/clients/${clientId}` : '/admin/clients';
    const issues = data?.issues || EMPTY_ROWS;
    const checks = data?.checks || EMPTY_ROWS;
    const indicators = data?.indicators || EMPTY_ROWS;
    const history = data?.history || EMPTY_ROWS;

    const [previousWebsiteUrl, setPreviousWebsiteUrl] = useState(client?.website_url);
    if (previousWebsiteUrl !== client?.website_url) {
        setPreviousWebsiteUrl(client?.website_url);
        if (client?.website_url) setScanUrl(client.website_url);
    }

    const sortedIssues = useMemo(() => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        return [...issues].sort((left, right) => {
            const leftValue = order[String(left?.priority || 'medium').toLowerCase()] ?? 2;
            const rightValue = order[String(right?.priority || 'medium').toLowerCase()] ?? 2;
            return leftValue - rightValue;
        });
    }, [issues]);

    const summaryCards = useMemo(() => {
        const criticalCount = issues.filter((issue) => ['critical', 'high'].includes(String(issue?.priority || '').toLowerCase())).length;
        const warningCount = issues.filter((issue) => !['critical', 'high'].includes(String(issue?.priority || '').toLowerCase())).length;
        const healthyCount = checks.filter((check) => check?.status === 'ok' || check?.status === 'pass').length;

        return [
            {
                id: 'technical-score',
                label: 'Score technique',
                value: data?.seoScore != null ? `${data.seoScore}/100` : 'n.d.',
                detail: scoreDetail(history, data?.seoScore),
                tone: data?.seoScore != null && data.seoScore >= 80 ? 'ok' : data?.seoScore != null && data.seoScore >= 50 ? 'warning' : 'critical',
            },
            {
                id: 'critical-issues',
                label: 'Erreurs critiques',
                value: criticalCount,
                detail: issueDeltaDetail(criticalCount, history),
                tone: criticalCount > 0 ? 'critical' : 'ok',
            },
            {
                id: 'warnings',
                label: 'Avertissements',
                value: warningCount,
                detail: warningDeltaDetail(warningCount, history),
                tone: warningCount > 0 ? 'warning' : 'ok',
            },
            {
                id: 'healthy-signals',
                label: 'Signaux valides',
                value: healthyCount,
                detail: healthyCount > 0 ? 'Contrôles techniques déjà confirmés' : 'Aucun signal sain confirmé',
                tone: healthyCount > 0 ? 'ok' : 'neutral',
            },
        ];
    }, [checks, data, history, issues]);

    const chartData = useMemo(() => {
        return history.map((entry) => ({
            label: entry.label,
            value: Number(entry.crawlIssueCount ?? 0),
        }));
    }, [history]);

    const signalRows = useMemo(() => {
        const preferred = ['https', 'crawl', 'rendered_content'];
        const mappedIndicators = preferred
            .map((id) => indicators.find((indicator) => indicator.id === id))
            .filter(Boolean)
            .map((indicator) => ({
                id: indicator.id,
                label: indicator.label,
                status: indicator.status,
                evidence: indicator.evidence,
            }));

        if (mappedIndicators.length > 0) return mappedIndicators;

        return checks.slice(0, 3).map((check) => ({
            id: check.id,
            label: check.label,
            status: check.status,
            evidence: check.evidence || check.detail,
        }));
    }, [checks, indicators]);

    async function startScan() {
        if (!clientId || !scanUrl.trim()) return;

        setScanning(true);
        setScanError(null);

        try {
            const response = await fetch('/api/admin/audits/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId, websiteUrl: scanUrl.trim() }),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || payload.message || `Erreur ${response.status}`);

            refetch();
            await refetchHealth();
        } catch (requestError) {
            setScanError(requestError.message || 'Erreur réseau');
        } finally {
            setScanning(false);
        }
    }

    if (loading) {
        return (
            <CommandPageShell
                header={
                    <CommandHeader
                        eyebrow="SEO Ops"
                        title="Santé SEO"
                        subtitle="Chargement de l audit technique, des signaux structurels et des problèmes réels du dossier."
                    />
                }
            >
                <div className={cn(COMMAND_PANEL, 'p-8')}>
                    <div className="text-[15px] font-semibold text-white/90">Chargement de la santé SEO</div>
                    <p className="mt-2 text-[13px] text-white/60">Le cockpit attend l audit, l historique récent et les contrôles techniques persistés.</p>
                </div>
            </CommandPageShell>
        );
    }

    if (error) {
        return (
            <CommandPageShell
                header={
                    <CommandHeader
                        eyebrow="SEO Ops"
                        title="Santé SEO"
                        subtitle="Audit technique, contrôles structurels et incidents réellement observés."
                    />
                }
            >
                <CommandEmptyState
                    title="Santé SEO indisponible"
                    description={error}
                    action={<Link href={`${baseHref}/seo/visibility`} className={COMMAND_BUTTONS.primary}>Voir la visibilité</Link>}
                />
            </CommandPageShell>
        );
    }

    if (!data || data.emptyState) {
        return (
            <CommandPageShell
                header={
                    <CommandHeader
                        eyebrow="SEO Ops"
                        title="Santé SEO"
                        subtitle={`Audit technique, checks structurels et erreurs de crawl pour ${client?.client_name || 'ce dossier'}.`}
                        actions={<Link href={`${baseHref}/dossier/connectors`} className={COMMAND_BUTTONS.primary}>Connecteurs</Link>}
                    />
                }
            >
                <SourceStatusNotice status={data?.status} errors={data?.errors} />
                <CommandEmptyState
                    title={data?.emptyState?.title || 'Aucune lecture technique disponible'}
                    description={data?.emptyState?.description || 'Le dernier audit ne remonte pas encore de signaux techniques exploitables.'}
                />
            </CommandPageShell>
        );
    }

    return (
        <CommandPageShell
            header={
                <CommandHeader
                    eyebrow="SEO Ops"
                    title="Santé SEO"
                    subtitle="Audit technique, Core Web Vitals et erreurs de crawl."
                    actions={
                        <button type="button" onClick={startScan} disabled={scanning || !clientId} className={COMMAND_BUTTONS.primary}>
                            <RefreshCwIcon className={cn('h-3.5 w-3.5', scanning && 'animate-spin')} />
                            {scanning ? 'Audit en cours...' : 'Lancer un audit complet'}
                        </button>
                    }
                />
            }
        >
                <SourceStatusNotice status={data?.status} errors={data?.errors} />
            {scanError ? (
                <div className="rounded-[20px] border border-rose-300/18 bg-rose-400/10 px-4 py-3 text-[12px] text-rose-100">
                    {scanError}
                </div>
            ) : null}

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {summaryCards.map((card) => (
                    <CommandMetricCard key={card.id} label={card.label} value={card.value} detail={card.detail} tone={card.tone} />
                ))}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <CommandChartCard title="Évolution des erreurs de crawl" className="lg:col-span-2">
                    {chartData.length > 0 ? (
                        <div className="h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                                    <XAxis dataKey="label" stroke="rgba(255,255,255,0.22)" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="rgba(255,255,255,0.22)" fontSize={11} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#0b0d13',
                                            border: '1px solid rgba(255,255,255,0.12)',
                                            borderRadius: '12px',
                                            fontSize: '12px',
                                        }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="value"
                                        stroke="#ff737b"
                                        strokeWidth={3}
                                        dot={{ r: 4, fill: '#0b0d13', stroke: '#ff737b', strokeWidth: 2 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <CommandEmptyState
                            title="Aucune trajectoire disponible"
                            description="Aucun historique d audits ne permet encore de tracer une courbe reelle des erreurs de crawl."
                        />
                    )}
                </CommandChartCard>

                <div className={cn(COMMAND_PANEL, 'flex flex-col justify-center p-5')}>
                    <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/42">Signaux techniques</div>
                    <div className="space-y-4">
                        {signalRows.map((signal) => (
                            <div key={signal.id}>
                                <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                                    <span className="text-white/78">{signal.label}</span>
                                    <span className={cn(
                                        'font-semibold',
                                        signal.status === 'ok' || signal.status === 'pass'
                                            ? 'text-emerald-300'
                                            : signal.status === 'warning' || signal.status === 'partial'
                                                ? 'text-amber-300'
                                                : signal.status === 'critical' || signal.status === 'failed'
                                                    ? 'text-rose-300'
                                                    : 'text-white/38',
                                    )}>
                                        {statusLabel(signal.status)}
                                    </span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                                    <div className={cn('h-full rounded-full', statusColor(signal.status))} style={{ width: `${statusToPercent(signal.status)}%` }} />
                                </div>
                                <div className="mt-2 text-[11px] leading-relaxed text-white/48">
                                    {signal.evidence || 'Aucune preuve disponible.'}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-2 flex items-center justify-between gap-3">
                <div className="text-[14px] font-semibold text-white/92">Problèmes détectés</div>
                <div className="text-[11px] text-white/42">
                    {`Dernier audit : ${formatDateTime(data.auditMeta?.createdAt)}`}
                </div>
            </div>

            {sortedIssues.length > 0 ? (
                <CommandTable
                    headers={['Problème', 'Priorité', 'Fiabilité', 'Preuve']}
                    rows={sortedIssues.map((issue) => [
                        <div key={`${issue.id}-title`} className="min-w-[220px] whitespace-normal text-white/92">{issue.title}</div>,
                        <span key={`${issue.id}-priority`} className={cn('inline-flex rounded border px-2 py-0.5 text-[10px]', priorityTone(issue.priority))}>
                            {issue.priority || 'medium'}
                        </span>,
                        <ReliabilityPill key={`${issue.id}-reliability`} value={issue.reliability || 'unavailable'} />,
                        <div key={`${issue.id}-evidence`} className="min-w-[260px] whitespace-normal text-white/62">
                            {issue.evidence || issue.description || 'Aucune preuve disponible.'}
                        </div>,
                    ])}
                />
            ) : (
                <CommandEmptyState
                    title="Aucun problème technique majeur"
                    description="Le dernier audit ne remonte pas de problème prioritaire sur ce dossier."
                    action={<Link href={`${baseHref}/seo/visibility`} className={COMMAND_BUTTONS.secondary}>Voir la visibilité</Link>}
                />
            )}
        </CommandPageShell>
    );
}
