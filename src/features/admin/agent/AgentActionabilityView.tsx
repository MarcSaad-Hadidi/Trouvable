'use client';

import { useGeoClient, useGeoWorkspaceSlice } from '@/features/admin/shared/context/ClientContext';
import {
    KeyValuePanel,
    MetricGrid,
    AgentPageFrame,
    pageActionLink,
} from '@/features/admin/agent/agent-page-primitives';
import { AgentChip, AgentDimensionGrid, AgentMessageList } from '@/features/admin/agent/agent-shared';
import { formatAgentPriority, formatAgentReliability, toneForPriority } from '@/features/admin/agent/agent-copy';

function scoreTone(score) {
    if (score == null) return 'neutral';
    if (score >= 70) return 'ok';
    if (score >= 40) return 'warning';
    return 'critical';
}

export default function AgentActionabilityPage() {
    const { client, clientId } = useGeoClient();
    const { data, loading, error } = useGeoWorkspaceSlice('agent-actionability');

    const baseHref = clientId ? `/admin/clients/${clientId}` : '/admin/clients';
    const summary = data?.summary || {};
    const dimensions = data?.dimensions || [];
    const coveredDimensions = dimensions.filter((item) => Number(item?.score) >= 70).length;
    const emptyState = data?.emptyState || (!data?.available ? {
        title: 'Actionnabilité AGENT indisponible',
        description: 'Le backend ne remonte pas encore de lecture actionnable pour ce dossier.',
    } : null);

    return (
        <AgentPageFrame
            eyebrow="AGENT Ops"
            title="Actionnabilité AGENT"
            subtitle={`Lecture réelle de l’actionnabilité pour ${client?.client_name || 'ce mandat'} : dimensions, forces et correctifs dérivés de l’audit courant.`}
            actions={
                <>
                    {pageActionLink(data?.links?.profile || `${baseHref}/dossier`, 'Dossier client')}
                    {pageActionLink(data?.links?.audit || `${baseHref}/dossier/audit`, 'Audit dossier')}
                    {pageActionLink(data?.links?.opportunities || `${baseHref}/geo/opportunities`, 'File d’actions', 'primary')}
                </>
            }
            loading={loading}
            error={error}
            emptyState={emptyState}
            loadingMessage="Calcul des dimensions d’actionnabilité et des actions prioritaires."
        >
            <MetricGrid
                items={[
                    {
                        id: 'score',
                        label: 'Score global',
                        value: summary.globalScore ?? 'n.d.',
                        detail: summary.globalStatus || 'Statut indisponible',
                        tone: scoreTone(summary.globalScore),
                    },
                    {
                        id: 'covered',
                        label: 'Dimensions couvertes',
                        value: coveredDimensions,
                        detail: `sur ${dimensions.length} dimensions`,
                        tone: coveredDimensions > 0 ? 'info' : 'neutral',
                    },
                    {
                        id: 'fixes',
                        label: 'Correctifs prioritaires',
                        value: data?.topFixes?.length ?? 0,
                        detail: 'Déblocages identifiés',
                        tone: (data?.topFixes?.length ?? 0) > 0 ? 'warning' : 'neutral',
                    },
                    {
                        id: 'strengths',
                        label: 'Forces observées',
                        value: data?.topStrengths?.length ?? 0,
                        detail: 'Signaux déjà couverts',
                        tone: (data?.topStrengths?.length ?? 0) > 0 ? 'ok' : 'neutral',
                    },
                ]}
            />

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.9fr]">
                <KeyValuePanel
                    title="Cadre d’analyse"
                    subtitle="Fiabilité et fraîcheur de l’échantillon utilisé."
                    entries={[
                        { label: 'Statut global', value: summary.globalStatus },
                        { label: 'Fiabilité', value: formatAgentReliability(data?.reliability) },
                        { label: 'Dernier audit', value: data?.freshness?.auditCreatedAt },
                        { label: 'Statut scan', value: data?.freshness?.scanStatus },
                    ]}
                />

                <AgentMessageList
                    title="Forces détectées"
                    subtitle="Extraits réels des dimensions déjà solides."
                    items={data?.topStrengths || []}
                    emptyTitle="Aucune force solide n’a encore été qualifiée."
                    renderItem={(item) => (
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[13px] font-semibold text-white/92">{item.message}</span>
                                {item.score != null ? <AgentChip tone="ok">{item.score}/100</AgentChip> : null}
                            </div>
                            {item.dimensionLabel ? <div className="text-[12px] text-white/58">{item.dimensionLabel}</div> : null}
                        </div>
                    )}
                />
            </div>

            <AgentDimensionGrid
                title="Dimensions d’actionnabilité"
                subtitle="Grille branchée sur les dimensions réelles calculées par le moteur AGENT."
                dimensions={dimensions}
            />

            <AgentMessageList
                title="Correctifs prioritaires"
                subtitle="Actions dérivées des dimensions faibles ou bloquées."
                items={data?.topFixes || []}
                emptyTitle="Aucun correctif prioritaire ouvert."
                renderItem={(item) => (
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[13px] font-semibold text-white/92">{item.message}</span>
                            {item.priority ? <AgentChip tone={toneForPriority(item.priority)}>{formatAgentPriority(item.priority)}</AgentChip> : null}
                        </div>
                        {item.dimensionLabel ? <div className="text-[12px] text-white/58">{item.dimensionLabel}</div> : null}
                    </div>
                )}
            />
        </AgentPageFrame>
    );
}

