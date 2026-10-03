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

export default function AgentProtocolsPage() {
    const { client, clientId } = useGeoClient();
    const { data, loading, error } = useGeoWorkspaceSlice('agent-protocols');

    const baseHref = clientId ? `/admin/clients/${clientId}` : '/admin/clients';
    const summary = data?.summary || {};
    const emptyState = data?.emptyState || (!data?.available ? {
        title: 'Protocoles AGENT indisponibles',
        description: 'Le dossier ne remonte pas encore de lecture exploitable sur les protocoles exposés.',
    } : null);

    return (
        <AgentPageFrame
            eyebrow="AGENT Ops"
            title="Protocoles AGENT"
            subtitle={`Lecture réelle des signaux techniques exposés pour ${client?.client_name || 'ce mandat'} : protocoles, preuves et manques observables par un agent.`}
            actions={
                <>
                    {pageActionLink(`${baseHref}/agent/readiness`, 'Préparation AGENT')}
                    {pageActionLink(data?.links?.audit || `${baseHref}/dossier/audit`, 'Audit dossier')}
                    {pageActionLink(data?.links?.opportunities || `${baseHref}/geo/opportunities`, 'File d’actions', 'primary')}
                </>
            }
            loading={loading}
            error={error}
            emptyState={emptyState}
            loadingMessage="Lecture des protocoles exposés et des correctifs réels issus du dernier audit."
        >
            <MetricGrid
                items={[
                    {
                        id: 'score',
                        label: 'Score protocoles',
                        value: summary.globalScore ?? 'n.d.',
                        detail: summary.globalStatus || 'Statut indisponible',
                        tone: scoreTone(summary.globalScore),
                    },
                    {
                        id: 'coverage',
                        label: 'Dimensions couvertes',
                        value: `${summary.coveredDimensions ?? 0}/${summary.totalDimensions ?? 0}`,
                        detail: 'Couvert = score ≥ 70',
                        tone: (summary.coveredDimensions ?? 0) > 0 ? 'info' : 'neutral',
                    },
                    {
                        id: 'fixes',
                        label: 'Correctifs ouverts',
                        value: data?.topFixes?.length ?? 0,
                        detail: 'Déblocages techniques identifiés',
                        tone: (data?.topFixes?.length ?? 0) > 0 ? 'warning' : 'neutral',
                    },
                    {
                        id: 'strengths',
                        label: 'Protocoles couverts',
                        value: data?.topStrengths?.length ?? 0,
                        detail: 'Signaux déjà observés',
                        tone: (data?.topStrengths?.length ?? 0) > 0 ? 'ok' : 'neutral',
                    },
                ]}
            />

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.9fr]">
                <KeyValuePanel
                    title="Contexte protocoles"
                    subtitle="Fiabilité de lecture et fraîcheur de l’échantillon courant."
                    entries={[
                        { label: 'Statut global', value: summary.globalStatus },
                        { label: 'Fiabilité', value: formatAgentReliability(data?.reliability) },
                        { label: 'Dernier audit', value: data?.freshness?.auditCreatedAt },
                        { label: 'Statut scan', value: data?.freshness?.scanStatus },
                    ]}
                />

                <AgentMessageList
                    title="Protocoles déjà couverts"
                    subtitle="Dimensions techniques déjà solides pour les agents."
                    items={data?.topStrengths || []}
                    emptyTitle="Aucun protocole solide n’est encore remonté."
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
                title="Dimensions protocoles"
                subtitle="Dimensionnement réel du sous-score protocoles, sans bonus ni statuts inventés."
                dimensions={data?.dimensions || []}
            />

            <AgentMessageList
                title="Correctifs protocoles"
                subtitle="Actions prioritaires pour rendre le mandat plus lisible et exécutable par les agents."
                items={data?.topFixes || []}
                emptyTitle="Aucun correctif protocole prioritaire."
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

