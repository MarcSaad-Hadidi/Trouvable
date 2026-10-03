'use client';

import { useGeoClient, useGeoWorkspaceSlice } from '@/features/admin/shared/context/ClientContext';
import { CommandChartCard } from '@/features/admin/shared/components/command/CommandChartCard';
import {
    GenericTablePanel,
    KeyValuePanel,
    MetricGrid,
    AgentPageFrame,
    pageActionLink,
} from '@/features/admin/agent/agent-page-primitives';
import { AgentChip, AgentMessageList } from '@/features/admin/agent/agent-shared';
import { formatAgentCategory, formatAgentPriority, toneForPriority } from '@/features/admin/agent/agent-copy';

export default function AgentCompetitorsPage() {
    const { client, clientId } = useGeoClient();
    const { data, loading, error } = useGeoWorkspaceSlice('agent-competitors');

    const baseHref = clientId ? `/admin/clients/${clientId}` : '/admin/clients';
    const summary = data?.summary || {};
    const emptyState = data?.emptyState || (!data?.available ? {
        title: 'Comparatif AGENT indisponible',
        description: 'Aucune exécution exploitable ne permet encore de lire la pression concurrentielle du dossier.',
    } : null);

    return (
        <AgentPageFrame
            eyebrow="AGENT Ops"
            title="Comparatif AGENT"
            subtitle={`Lecture concurrentielle réelle pour ${client?.client_name || 'ce mandat'} : concurrents cités, prompts perdus et mentions génériques.`}
            actions={(
                <>
                    {pageActionLink(data?.links?.prompts || `${baseHref}/geo/prompts`, 'Requêtes GEO')}
                    {pageActionLink(data?.links?.runs || `${baseHref}/geo/runs`, 'Exécutions GEO')}
                    {pageActionLink(data?.links?.competitors || `${baseHref}/geo/competitors`, 'Carte concurrents', 'primary')}
                </>
            )}
            loading={loading}
            error={error}
            emptyState={emptyState}
            loadingMessage="Lecture des concurrents observés dans les réponses IA du dossier."
        >
            <MetricGrid
                items={[
                    {
                        id: 'runs',
                        label: 'Exécutions complétées',
                        value: summary.totalCompletedRuns ?? 0,
                        detail: "Base d'observation",
                        tone: (summary.totalCompletedRuns ?? 0) > 0 ? 'info' : 'neutral',
                    },
                    {
                        id: 'mentions',
                        label: 'Mentions concurrents',
                        value: summary.competitorMentions ?? 0,
                        detail: `${summary.recommendedCompetitors ?? 0} concurrent(s) recommandé(s)`,
                        tone: (summary.competitorMentions ?? 0) > 0 ? 'warning' : 'neutral',
                    },
                    {
                        id: 'pressure',
                        label: 'Pression / exécution',
                        value: summary.normalizedPressurePerRun != null ? summary.normalizedPressurePerRun.toFixed(1) : 'n.d.',
                        detail: 'Indicateur normalisé',
                        tone: 'info',
                    },
                    {
                        id: 'lost',
                        label: 'Exécutions sans cible',
                        value: summary.runsWithoutTargetButCompetitor ?? 0,
                        detail: 'Substitution observée',
                        tone: (summary.runsWithoutTargetButCompetitor ?? 0) > 0 ? 'critical' : 'neutral',
                    },
                ]}
            />

            {summary.sampleSizeWarning ? (
                <CommandChartCard title="Alerte échantillon" subtitle="Lecture honnête de la taille de base utilisée pour le comparatif.">
                    <div className="rounded-[18px] border border-amber-300/20 bg-amber-400/10 p-4 text-[12px] leading-relaxed text-amber-100/90">
                        {summary.sampleSizeWarning}
                    </div>
                </CommandChartCard>
            ) : null}

            <KeyValuePanel
                title="Cadre concurrentiel"
                subtitle="Synthèse du comparatif observé sur les exécutions du mandat."
                entries={[
                    { label: 'Mentions cible', value: summary.targetMentions },
                    { label: 'Mentions concurrents', value: summary.competitorMentions },
                    { label: 'Concurrents recommandés', value: summary.recommendedCompetitors },
                    { label: 'Score pression', value: summary.competitorPressureScore },
                ]}
            />

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.95fr]">
                <GenericTablePanel
                    title="Concurrents principaux"
                    subtitle="Concurrents réellement cités dans les réponses IA."
                    rows={data?.topCompetitors || []}
                    columns={[
                        { key: 'name', label: 'Concurrent' },
                        { key: 'count', label: 'Mentions' },
                    ]}
                />

                <AgentMessageList
                    title="Prompts sous pression"
                    subtitle="Prompts où un concurrent apparaît alors que la cible manque."
                    items={data?.promptsLost || []}
                    emptyTitle="Aucun prompt perdu n’a été remonté."
                    renderItem={(item) => (
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[13px] font-semibold text-white/92">{item.queryText}</span>
                                {item.severity ? <AgentChip tone={toneForPriority(item.severity)}>{formatAgentPriority(item.severity)}</AgentChip> : null}
                            </div>
                            <div className="text-[12px] text-white/60">
                                {formatAgentCategory(item.category)} · {item.competitorMentions ?? 0} mention(s) · dernière exécution {item.latestRunAt || 'n.d.'}
                            </div>
                        </div>
                    )}
                />
            </div>

            <AgentMessageList
                title="Mentions génériques"
                subtitle="Noms détectés mais pas encore qualifiés comme concurrents confirmés."
                items={data?.genericMentions || []}
                emptyTitle="Aucune mention générique non confirmée."
                renderItem={(item) => (
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-semibold text-white/92">{item.name}</span>
                        <AgentChip>{item.count ?? 0} mention(s)</AgentChip>
                    </div>
                )}
            />
        </AgentPageFrame>
    );
}
