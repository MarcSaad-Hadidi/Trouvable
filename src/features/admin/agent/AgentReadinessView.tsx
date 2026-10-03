'use client';

import { useGeoClient, useGeoWorkspaceSlice } from '@/features/admin/shared/context/ClientContext';
import {
    KeyValuePanel,
    MetricGrid,
    AgentPageFrame,
    pageActionLink,
} from '@/features/admin/agent/agent-page-primitives';
import { AgentChip, AgentDimensionGrid, AgentMessageList } from '@/features/admin/agent/agent-shared';
import { formatAgentStatus, toneForStatus } from '@/features/admin/agent/agent-copy';

function scoreTone(score) {
    if (score == null) return 'neutral';
    if (score >= 70) return 'ok';
    if (score >= 40) return 'warning';
    return 'critical';
}

export default function AgentReadinessPage() {
    const { client, clientId } = useGeoClient();
    const { data, loading, error } = useGeoWorkspaceSlice('agent-readiness');

    const baseHref = clientId ? `/admin/clients/${clientId}` : '/admin/clients';
    const summary = data?.summary || {};
    const dimensions = data?.dimensions || [];
    const blockers = data?.topBlockers || [];
    const emptyState = data?.emptyState || (!data?.available ? {
        title: 'Préparation AGENT indisponible',
        description: 'Aucun audit exploitable ne permet encore de calculer la préparation AGENT pour ce dossier.',
    } : null);

    return (
        <AgentPageFrame
            eyebrow="AGENT Ops"
            title="Préparation AGENT"
            subtitle={`Lecture réelle de la préparation technique pour ${client?.client_name || 'ce mandat'} : dimensions readiness, blocages majeurs et fraîcheur du signal.`}
            actions={
                <>
                    {pageActionLink(`${baseHref}/agent/visibility`, 'Visibilité AGENT')}
                    {pageActionLink(`${baseHref}/agent/protocols`, 'Protocoles AGENT')}
                    {pageActionLink(data?.links?.audit || `${baseHref}/dossier/audit`, 'Audit dossier', 'primary')}
                </>
            }
            loading={loading}
            error={error}
            emptyState={emptyState}
            loadingMessage="Lecture du moteur readiness et des blocages réels du dossier."
        >
            <MetricGrid
                items={[
                    {
                        id: 'score',
                        label: 'Score global',
                        value: summary.globalScore ?? 'n.d.',
                        detail: summary.globalSignalLabel || summary.globalStatus || 'Signal indisponible',
                        tone: scoreTone(summary.globalScore),
                    },
                    {
                        id: 'pages',
                        label: 'Pages auditées',
                        value: summary.pageCount ?? 0,
                        detail: 'Base structurelle observée',
                        tone: (summary.pageCount ?? 0) > 0 ? 'info' : 'neutral',
                    },
                    {
                        id: 'passages',
                        label: 'Passages forts',
                        value: summary.highPassageCount ?? 0,
                        detail: 'Citabilité extraite',
                        tone: (summary.highPassageCount ?? 0) > 0 ? 'ok' : 'neutral',
                    },
                    {
                        id: 'faq',
                        label: 'FAQ / QA',
                        value: summary.faqCount ?? 0,
                        detail: 'Paires utiles détectées',
                        tone: (summary.faqCount ?? 0) > 0 ? 'ok' : 'neutral',
                    },
                ]}
            />

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.85fr]">
                <KeyValuePanel
                    title="État readiness"
                    subtitle="Synthèse de la préparation du dossier actif."
                    entries={[
                        { label: 'Signal global', value: summary.globalSignalLabel || summary.globalStatus },
                        { label: 'Dimensions', value: dimensions.length },
                        { label: 'Dernier audit', value: data?.freshness?.auditCreatedAt || data?.provenance?.observed?.label },
                        { label: 'Statut scan', value: data?.freshness?.scanStatus },
                    ]}
                />

                <AgentMessageList
                    title="Blocages majeurs"
                    subtitle="Points qui empêchent la préparation du mandat pour les agents."
                    items={blockers}
                    emptyTitle="Aucun blocage majeur détecté sur le dossier courant."
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

            <AgentDimensionGrid
                title="Dimensions de préparation"
                subtitle="Dimensions issues du moteur readiness réel, sans score ni libellé artificiels."
                dimensions={dimensions}
            />
        </AgentPageFrame>
    );
}

