'use client';

import SourceStatusNotice from '@/components/shared/metrics/SourceStatusNotice';
import { useGeoClient, useGeoWorkspaceSlice } from '@/features/admin/shared/context/ClientContext';
import {
    KeyValuePanel,
    MetricGrid,
    AgentPageFrame,
    pageActionLink,
} from '@/features/admin/agent/agent-page-primitives';
import { AgentStrengthMessage, AgentFixMessage, AgentDimensionGrid, AgentMessageList } from '@/features/admin/agent/agent-shared';
import { scoreTone, formatAgentReliability } from '@/features/admin/agent/agent-copy';

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
            notice={<SourceStatusNotice domain="AGENT" status={data?.status} errors={data?.errors} />}
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
                    renderItem={(item) => <AgentStrengthMessage item={item} />}
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
                renderItem={(item) => <AgentFixMessage item={item} />}
            />
        </AgentPageFrame>
    );
}
