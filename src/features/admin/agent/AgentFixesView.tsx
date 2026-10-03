'use client';

import { useGeoClient, useGeoWorkspaceSlice } from '@/features/admin/shared/context/ClientContext';
import { CommandChartCard } from '@/features/admin/shared/components/command/CommandChartCard';
import {
    KeyValuePanel,
    MetricGrid,
    AgentPageFrame,
    pageActionLink,
} from '@/features/admin/agent/agent-page-primitives';
import { AgentChip, AgentMessageList } from '@/features/admin/agent/agent-shared';
import {
    formatAgentCategory,
    formatAgentPriority,
    formatAgentSource,
    formatAgentStatus,
    toneForPriority,
    toneForStatus,
} from '@/features/admin/agent/agent-copy';

export default function AgentFixesPage() {
    const { client, clientId } = useGeoClient();
    const { data, loading, error } = useGeoWorkspaceSlice('agent-fixes');

    const baseHref = clientId ? `/admin/clients/${clientId}` : '/admin/clients';
    const summary = data?.summary || {};
    const uncoveredSubscores = data?.coherence?.uncoveredSubscores || [];

    return (
        <AgentPageFrame
            eyebrow="AGENT Ops"
            title="Correctifs AGENT"
            subtitle={`Remédiation AGENT consolidée pour ${client?.client_name || 'ce mandat'} : problèmes détectés, priorisation et file de traitement alignés.`}
            actions={
                <>
                    {pageActionLink(data?.links?.agentOverview || `${baseHref}/agent`, 'Vue AGENT')}
                    {pageActionLink(data?.links?.geoOpportunities || `${baseHref}/geo/opportunities`, 'File GEO complète', 'primary')}
                </>
            }
            loading={loading}
            error={error}
            emptyState={data?.emptyState || null}
            loadingMessage="Assemblage des correctifs AGENT depuis les dimensions, blocages et opportunités réelles."
        >
            <MetricGrid
                items={[
                    {
                        id: 'open',
                        label: 'Correctifs actifs',
                        value: summary.open ?? 0,
                        detail: `${summary.total ?? 0} action(s) au total`,
                        tone: (summary.open ?? 0) > 0 ? 'warning' : 'neutral',
                    },
                    {
                        id: 'high',
                        label: 'Priorité haute',
                        value: summary.highPriorityOpen ?? 0,
                        detail: `${summary.derivedOpen ?? 0} signal(aux) issu(s) des dimensions`,
                        tone: (summary.highPriorityOpen ?? 0) > 0 ? 'critical' : 'neutral',
                    },
                    {
                        id: 'progress',
                        label: 'En cours',
                        value: summary.inProgress ?? 0,
                        detail: 'Actions engagées',
                        tone: (summary.inProgress ?? 0) > 0 ? 'info' : 'neutral',
                    },
                    {
                        id: 'review',
                        label: 'À revoir',
                        value: summary.reviewQueueCount ?? 0,
                        detail: `${summary.remediationDraftCount ?? 0} brouillon(s)`,
                        tone: (summary.reviewQueueCount ?? 0) > 0 ? 'warning' : 'neutral',
                    },
                ]}
            />

            {data?.staleWarning?.message ? (
                <CommandChartCard
                    title="Avertissement de fraîcheur"
                    subtitle="Certaines preuves appartiennent à un audit précédent et peuvent nécessiter une mise à jour."
                >
                    <div className="rounded-[18px] border border-amber-300/20 bg-amber-400/10 p-4 text-[12px] leading-relaxed text-amber-100/90">
                        {data.staleWarning.message}
                    </div>
                </CommandChartCard>
            ) : null}

            {uncoveredSubscores.length > 0 ? (
                <CommandChartCard
                    title="Cohérence à corriger"
                    subtitle="Des sous-scores restent sans action liée. La remontée problème → remédiation doit être complétée."
                >
                    <div className="rounded-[18px] border border-rose-300/20 bg-rose-400/10 p-4 text-[12px] leading-relaxed text-rose-100/90">
                        Sous-scores non couverts: {uncoveredSubscores.join(', ')}
                    </div>
                </CommandChartCard>
            ) : null}

            <KeyValuePanel
                title="Cadre backlog"
                subtitle="Lecture synthétique de la file AGENT consolidée."
                entries={[
                    { label: 'Correctifs depuis opportunités', value: summary.opportunityOpen },
                    { label: 'Correctifs dérivés des dimensions', value: summary.derivedOpen },
                    { label: 'Merges en attente', value: summary.pendingMergeCount },
                    { label: 'Sous-scores non couverts', value: summary.uncoveredSubscores },
                ]}
            />

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.95fr]">
                <AgentMessageList
                    title="Correctifs prioritaires"
                    subtitle="Actions prioritaires issues des faiblesses réelles AGENT et de la file opérationnelle."
                    items={data?.topFixes || []}
                    emptyTitle="Aucun correctif actif dans l’extrait courant."
                    renderItem={(item) => (
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[13px] font-semibold text-white/92">{item.title}</span>
                                {item.priority ? <AgentChip tone={toneForPriority(item.priority)}>{formatAgentPriority(item.priority)}</AgentChip> : null}
                                {item.status ? <AgentChip tone={toneForStatus(item.status)}>{formatAgentStatus(item.status)}</AgentChip> : null}
                            </div>
                            {item.description ? <div className="text-[12px] leading-relaxed text-white/60">{item.description}</div> : null}
                            <div className="text-[11px] text-white/42">
                                {formatAgentCategory(item.category)} · {formatAgentSource(item.source)} · {item.created_at || 'Date non disponible'}
                            </div>
                        </div>
                    )}
                />

                <AgentMessageList
                    title="Preuves d’audit"
                    subtitle="Éléments de preuve liés au backlog AGENT pour orienter la qualification et la correction."
                    items={data?.auditEvidence || []}
                    emptyTitle="Aucune preuve d’audit liée à l’extrait courant."
                    renderItem={(item) => (
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[13px] font-semibold text-white/92">{item.title}</span>
                                {item.priority ? <AgentChip tone={toneForPriority(item.priority)}>{formatAgentPriority(item.priority)}</AgentChip> : null}
                            </div>
                            {item.evidence_summary ? <div className="text-[12px] leading-relaxed text-white/60">{item.evidence_summary}</div> : null}
                            {item.recommended_fix ? <div className="text-[11px] text-emerald-100/80">Piste: {item.recommended_fix}</div> : null}
                        </div>
                    )}
                />
            </div>
        </AgentPageFrame>
    );
}
