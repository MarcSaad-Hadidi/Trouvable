'use client';

import { useGeoClient, useGeoWorkspaceSlice } from '@/features/admin/dashboard/shared/context/ClientContext';
import { CommandChartCard } from '@/features/admin/dashboard/shared/components/command/CommandChartCard';
import { KeyValuePanel, MetricGrid, AgentPageFrame, pageActionLink } from '@/features/admin/dashboard/agent/agent-page-primitives';
import { AgentChip, AgentDimensionGrid, AgentMessageList } from '@/features/admin/dashboard/agent/agent-shared';
import {
    formatAgentCategory,
    formatAgentConfidence,
    formatAgentPriority,
    formatAgentReliability,
    formatAgentSource,
    formatAgentStatus,
    formatAgentVerdict,
    toneForPriority,
    toneForStatus,
} from '@/features/admin/dashboard/agent/agent-copy';

const SUBSCORE_LABELS = {
    visibility: 'Visibilité',
    readiness: 'Préparation',
    actionability: 'Actionnabilité',
    advanced_protocols: 'Protocoles',
};

export default function AgentOverviewPage() {
    const { client, clientId } = useGeoClient();
    const { data, loading, error } = useGeoWorkspaceSlice('agent');
    const baseHref = clientId ? `/admin/clients/${clientId}` : '/admin/clients';
    const score = data?.score || null;
    const snapshot = data?.snapshot || null;
    const subscores = score
        ? Object.values(score.subscores || {}).map((entry) => {
            const item = (entry || {}) as any;
            return {
                key: item.key,
                score: item.score,
                status: item.status,
                weight: item.weight,
                signalLabel: item.signalLabel,
                evidence: item.evidence,
                gaps: item.gaps,
                label: SUBSCORE_LABELS[item.key] || item.key || 'Sous-score',
                summary: item.reason || `${formatAgentReliability(item.reliability)}${item.provisional ? ' · provisoire' : ''}`,
            };
        })
        : [];

    return (
        <AgentPageFrame
            eyebrow="AGENT Ops"
            title="Vue AGENT"
            subtitle={`Lecture consolidée AGENT pour ${client?.client_name || 'ce mandat'} : sous-scores, blocages et remédiation issus des mêmes signaux réels.`}
            actions={(
                <>
                    {pageActionLink(data?.links?.visibility || `${baseHref}/agent/visibility`, 'Visibilité AGENT')}
                    {pageActionLink(data?.links?.readiness || `${baseHref}/agent/readiness`, 'Préparation AGENT')}
                    {pageActionLink(data?.links?.fixes || `${baseHref}/agent/fixes`, 'Correctifs AGENT', 'primary')}
                </>
            )}
            loading={loading}
            error={error}
            emptyState={data?.emptyState || null}
            loadingMessage="Calcul du score AGENT et agrégation des remédiations liées aux dimensions réelles."
        >
            {data?.status === 'partial' || data?.status === 'unavailable' ? (
                <p role="status" className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-200">Données partielles : certains signaux AGENT sont indisponibles.</p>
            ) : null}
            <MetricGrid
                items={[
                    {
                        id: 'score',
                        label: 'Score AGENT',
                        value: score?.agent_score ?? 'n.d.',
                        detail: formatAgentVerdict(score?.verdict),
                        tone: score?.agent_score != null ? 'info' : 'neutral',
                    },
                    {
                        id: 'runs',
                        label: 'Exécutions complétées',
                        value: snapshot?.completedRunsTotal ?? 'n.d.',
                        detail: (snapshot?.completedRunsTotal ?? null) === null ? 'Exécutions indisponibles' : (snapshot?.lastRunAt || 'Aucune exécution observée'),
                        tone: snapshot?.completedRunsTotal > 0 ? 'ok' : 'neutral',
                    },
                    {
                        id: 'prompts',
                        label: 'Prompts suivis',
                        value: snapshot?.trackedPromptsTotal ?? 'n.d.',
                        detail: 'Base de lecture AGENT',
                        tone: snapshot?.trackedPromptsTotal > 0 ? 'info' : 'neutral',
                    },
                    {
                        id: 'open',
                        label: 'Correctifs actifs',
                        value: snapshot?.openOpportunitiesCount ?? 'n.d.',
                        detail: (snapshot?.highPriorityOpen ?? null) === null ? 'Priorités hautes indisponibles' : `${snapshot.highPriorityOpen} priorité(s) haute(s)`,
                        tone: (snapshot?.highPriorityOpen ?? 0) > 0 ? 'warning' : 'neutral',
                    },
                ]}
            />

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.8fr]">
                <CommandChartCard
                    title="Lecture du score"
                    subtitle="Score composite calculé à la lecture à partir des slices AGENT, sans simulation ni persistance artificielle."
                >
                    <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.02] p-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <AgentChip tone={score?.agent_score != null ? 'info' : 'neutral'}>{formatAgentVerdict(score?.verdict)}</AgentChip>
                            <AgentChip>{formatAgentConfidence(score?.confidence)}</AgentChip>
                            {score?.provisional ? <AgentChip tone="warning">Provisoire</AgentChip> : null}
                        </div>
                        <div className="mt-4 text-[14px] leading-relaxed text-white/78">
                            Le score AGENT agrège visibilité, préparation, actionnabilité et protocoles.
                            Chaque sous-score non parfait doit être reflété dans la remédiation affichée.
                        </div>
                    </div>
                </CommandChartCard>
                <KeyValuePanel
                    title="Cadre mandat"
                    subtitle="Fenêtre opérationnelle utilisée pour la vue globale."
                    entries={[
                        { label: 'Dernier audit', value: snapshot?.lastAuditAt },
                        { label: 'Dernière exécution', value: snapshot?.lastRunAt },
                        { label: 'Correctifs haute priorité', value: snapshot?.highPriorityOpen },
                        { label: 'Correctifs issus des opportunités', value: snapshot?.opportunityOpenCount },
                        { label: 'Correctifs dérivés des dimensions', value: snapshot?.derivedOpenCount },
                    ]}
                />
            </div>

            <AgentDimensionGrid
                title="Sous-scores AGENT"
                subtitle="Chaque sous-score reste branché à sa slice source et garde sa fiabilité explicite."
                dimensions={subscores}
            />

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <AgentMessageList
                    title="Correctifs prioritaires"
                    subtitle="Remédiations consolidées depuis les problèmes réels détectés dans les dimensions AGENT."
                    items={data?.topFixes || []}
                    emptyTitle={data?.status === 'partial' || data?.status === 'unavailable' ? 'Correctifs prioritaires indisponibles.' : 'Aucun correctif prioritaire dans la fenêtre courante.'}
                    renderItem={(item) => (
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[13px] font-semibold text-white/92">{item.title}</span>
                                {item.priority ? <AgentChip tone={toneForPriority(item.priority)}>{formatAgentPriority(item.priority)}</AgentChip> : null}
                                {item.status ? <AgentChip tone={toneForStatus(item.status)}>{formatAgentStatus(item.status)}</AgentChip> : null}
                            </div>
                            <div className="text-[12px] text-white/60">
                                {formatAgentCategory(item.category)} · {formatAgentSource(item.source)}
                            </div>
                            {item.description ? <div className="text-[12px] leading-relaxed text-white/60">{item.description}</div> : null}
                        </div>
                    )}
                />
                <AgentMessageList
                    title="Blocages majeurs"
                    subtitle="Blocages critiques consolidés depuis la préparation et les correctifs à priorité haute."
                    items={data?.topBlockers || []}
                    emptyTitle={data?.status === 'partial' || data?.status === 'unavailable' ? 'Blocages majeurs indisponibles.' : 'Aucun blocage majeur détecté.'}
                    renderItem={(item) => (
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[13px] font-semibold text-white/92">{item.title}</span>
                                {item.status ? <AgentChip tone={toneForStatus(item.status)}>{formatAgentStatus(item.status)}</AgentChip> : null}
                            </div>
                            {item.detail ? <div className="text-[12px] leading-relaxed text-white/60">{item.detail}</div> : null}
                        </div>
                    )}
                />
            </div>
        </AgentPageFrame>
    );
}

