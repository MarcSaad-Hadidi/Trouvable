'use client';

import { useGeoClient, useGeoWorkspaceSlice } from '@/features/admin/dashboard/shared/context/ClientContext';
import { GenericTablePanel, KeyValuePanel, MetricGrid, AgentPageFrame, pageActionLink } from '@/features/admin/dashboard/agent/agent-page-primitives';

export default function AgentVisibilityPage() {
    const { client, clientId } = useGeoClient();
    const { data, loading, error } = useGeoWorkspaceSlice('agent-visibility');
    const baseHref = clientId ? `/admin/clients/${clientId}` : '/admin/clients';
    const kpis = data?.kpis || null;
    const promptCoverage = data?.promptCoverage || null;

    return (
        <AgentPageFrame
            eyebrow="AGENT Ops"
            title="Visibilité AGENT"
            subtitle={`Lecture réelle de la présence du mandat ${client?.client_name || ''} dans les réponses IA, à partir des prompts, exécutions, concurrents et sources observés.`.trim()}
            actions={
                <>
                    {pageActionLink(data?.links?.prompts || `${baseHref}/geo/prompts`, 'Requêtes GEO')}
                    {pageActionLink(data?.links?.runs || `${baseHref}/geo/runs`, 'Exécutions GEO')}
                    {pageActionLink(data?.links?.continuous || `${baseHref}/geo/continuous`, 'Suivi continu', 'primary')}
                </>
            }
            loading={loading}
            error={error}
            emptyState={data?.emptyState || null}
            loadingMessage="Lecture du taux de mention, de la couverture source et des modèles réellement actifs."
        >
            <MetricGrid
                items={[
                    {
                        id: 'mention',
                        label: 'Taux de mention',
                        value: kpis?.mentionRatePercent != null ? `${kpis.mentionRatePercent}%` : 'n.d.',
                        detail: `${kpis?.completedRunsTotal ?? 0} exécution(s) complétée(s)`,
                        tone: 'ok',
                    },
                    {
                        id: 'visibility',
                        label: 'Proxy de visibilité',
                        value: kpis?.visibilityProxyPercent != null ? `${kpis.visibilityProxyPercent}%` : 'n.d.',
                        detail: kpis?.visibilityProxyReliability || 'Fiabilité indisponible',
                        tone: 'info',
                    },
                    {
                        id: 'sources',
                        label: 'Couverture citations',
                        value: kpis?.citationCoveragePercent != null ? `${kpis.citationCoveragePercent}%` : 'n.d.',
                        detail: `${kpis?.genericMentionsCount ?? 0} mention(s) générique(s)`,
                        tone: 'neutral',
                    },
                    {
                        id: 'competitors',
                        label: 'Concurrents cités',
                        value: kpis?.competitorMentionsCount ?? 0,
                        detail: `${kpis?.trackedPromptsTotal ?? 0} prompt(s) suivi(s)`,
                        tone: (kpis?.competitorMentionsCount ?? 0) > 0 ? 'warning' : 'neutral',
                    },
                ]}
            />

            <KeyValuePanel
                title="Couverture des prompts"
                subtitle="Distribution réelle des prompts suivis dans le funnel de visibilité IA."
                entries={[
                    { label: 'Total suivis', value: promptCoverage?.total },
                    { label: 'Actifs', value: promptCoverage?.active },
                    { label: 'Avec cible trouvée', value: promptCoverage?.withTargetFound },
                    { label: 'Exécution sans cible', value: promptCoverage?.withRunNoTarget },
                    { label: 'Sans exécution', value: promptCoverage?.noRunYet },
                    { label: 'Taux de mention', value: promptCoverage?.mentionRatePercent != null ? `${promptCoverage.mentionRatePercent}%` : 'n.d.' },
                ]}
            />

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <GenericTablePanel
                    title="Modèles principaux"
                    subtitle="Fournisseurs et modèles les plus actifs sur le mandat."
                    rows={data?.topModels || []}
                    columns={[
                        { key: 'provider', label: 'Fournisseur' },
                        { key: 'model', label: 'Modèle' },
                        { key: 'total_runs', label: 'Exécutions' },
                        { key: 'total_mentions', label: 'Mentions' },
                    ]}
                />
                <GenericTablePanel
                    title="Concurrents cités"
                    subtitle="Concurrents observés dans les réponses IA."
                    rows={data?.topCompetitors || []}
                    columns={[
                        { key: 'name', label: 'Concurrent' },
                        { key: 'mention_count', label: 'Mentions' },
                    ]}
                />
                <GenericTablePanel
                    title="Sources citées"
                    subtitle="Hôtes les plus présents dans les réponses observées."
                    rows={data?.topSources || []}
                    columns={[
                        { key: 'host', label: 'Source' },
                        { key: 'citation_count', label: 'Citations' },
                    ]}
                />
            </div>
        </AgentPageFrame>
    );
}
