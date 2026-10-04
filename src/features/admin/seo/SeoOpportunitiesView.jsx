'use client';

import SourceStatusNotice from '@/components/shared/metrics/SourceStatusNotice';
import Link from 'next/link';

import ReliabilityPill from '@/components/shared/metrics/ReliabilityPill';

import IssueQuickAction from '@/features/admin/shared/components/IssueQuickAction';
import { useGeoClient, useSeoWorkspaceSlice } from '@/features/admin/shared/context/ClientContext';
import {
    formatDateLabel,
    formatDateTimeLabel,
    formatNumber,
    formatPercent,
    formatPosition,
    getPanelToneFromStatus,
    SeoActionLink,
    SeoEmptyState,
    SeoLoadingState,
    SeoPageHeader,
    SeoPageShell,
    SeoPanel,
    SeoSectionNav,
    SeoStatCard,
    SeoStatusBadge,
} from '@/features/admin/seo/SeoOpsPrimitives';

const PRIORITY_TONE_CLASSES = {
    critical: 'border-red-400/20 bg-red-400/10 text-red-200',
    warning: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
    default: 'border-white/10 bg-white/[0.05] text-white/68',
};

const ACTION_TONE_CLASSES = {
    Fusionner: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    Repositionner: 'border-sky-400/20 bg-sky-400/10 text-sky-100',
    Différencier: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
    'Conserver séparé': 'border-white/10 bg-white/[0.05] text-white/70',
};

function formatSiteTypeLabel(label) {
    if (!label) return null;

    return String(label)
        .replace(/\bsoftware\b/gi, 'logiciel')
        .replace(/\bunknown\b/gi, 'indéterminé');
}

function PriorityBadge({ tone, label }) {
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${PRIORITY_TONE_CLASSES[tone] || PRIORITY_TONE_CLASSES.default}`}
        >
            {label}
        </span>
    );
}

function ActionBadge({ label }) {
    if (!label) return null;

    return (
        <span
            className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${ACTION_TONE_CLASSES[label] || ACTION_TONE_CLASSES['Conserver séparé']}`}
        >
            {label}
        </span>
    );
}

function MetricChip({ metric }) {
    let value = metric.value;

    if (metric.type === 'number') value = formatNumber(metric.value);
    if (metric.type === 'percent') value = formatPercent(metric.value);
    if (metric.type === 'position') value = formatPosition(metric.value);

    return (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/35">{metric.label}</div>
            <div className="mt-1.5 text-sm font-medium text-white/88">{value}</div>
        </div>
    );
}

function FreshnessCard({ item }) {
    return (
        <div className="rounded-[24px] border border-white/[0.08] bg-black/18 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-white/92">{item.label}</div>
                <div className="flex items-center gap-2">
                    <SeoStatusBadge status={item.status} />
                    <ReliabilityPill value={item.reliability} />
                </div>
            </div>

            <div className="mt-4 text-xl font-semibold tracking-[-0.03em] text-white">{item.value}</div>
            <div className="mt-2 text-[12px] leading-relaxed text-white/56">{item.detail}</div>

            {'lastObservedDate' in item ? (
                <div className="mt-4 text-[11px] text-white/40">
                    Dernière date observée: {formatDateLabel(item.lastObservedDate)}
                    {item.lastSyncedAt ? ` · Dernière synchro: ${formatDateTimeLabel(item.lastSyncedAt)}` : ''}
                </div>
            ) : null}
        </div>
    );
}

function ReliabilityLayerCard({ item }) {
    return (
        <div className="rounded-[24px] border border-white/[0.08] bg-black/20 p-4">
            <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-semibold text-white/92">{item.title}</div>
                <ReliabilityPill value={item.reliability} />
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-white/66">{item.text}</p>
        </div>
    );
}

function OpportunityCard({ item, clientId }) {
    const problemRef =
        clientId && item?.id
            ? {
                  source: 'seo_opportunity',
                  clientId,
                  opportunityId: String(item.id),
                  issueId: item.issueId || null,
                  pageUrl: item.pages?.[0]?.url || null,
                  category: item.category || null,
                  label: item.title,
                  taskType: 'seo_improvement',
              }
            : null;

    return (
        <div className="rounded-[26px] border border-white/[0.08] bg-black/22 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-semibold text-white/92">{item.title}</div>
                <ReliabilityPill value={item.reliability} />
                <PriorityBadge tone={item.priorityTone} label={item.priorityLabel} />
                <ActionBadge label={item.actionLabel} />
                {problemRef ? (
                    <IssueQuickAction
                        problemRef={problemRef}
                        label="Prompt IA"
                        size="xs"
                        variant="primary"
                        className="ml-auto"
                    />
                ) : null}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/44">
                <span>{item.source}</span>
                {item.confidenceLabel ? <span>· {item.confidenceLabel}</span> : null}
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-3">
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/35">Pourquoi</div>
                    <div className="mt-2 text-[12px] leading-relaxed text-white/78">{item.why}</div>
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/35">Preuve</div>
                    <div className="mt-2 text-[12px] leading-relaxed text-white/78">{item.evidence}</div>
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/35">
                        Impact attendu
                    </div>
                    <div className="mt-2 text-[12px] leading-relaxed text-white/78">{item.impact}</div>
                </div>
            </div>

            {item.metrics?.length ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {item.metrics.map((metric) => (
                        <MetricChip key={`${item.id}_${metric.label}`} metric={metric} />
                    ))}
                </div>
            ) : null}

            {item.pages?.length ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                    {item.pages.map((page, index) => (
                        <div
                            key={`${item.id}_page_${index}`}
                            className="rounded-2xl border border-white/[0.08] bg-black/18 p-3"
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="text-[12px] font-semibold text-white/88">
                                    {page.role || 'Page concernée'}
                                </div>
                            </div>
                            {page.url ? (
                                <a
                                    href={page.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-2 block break-all text-[12px] font-medium text-sky-100/80 transition-colors hover:text-sky-100"
                                >
                                    {page.label}
                                </a>
                            ) : (
                                <div className="mt-2 text-[12px] font-medium text-white/78">{page.label}</div>
                            )}
                        </div>
                    ))}
                </div>
            ) : null}

            {item.note ? <div className="mt-4 text-[11px] leading-relaxed text-white/42">{item.note}</div> : null}

            {item.href && item.cta ? (
                <div className="mt-4">
                    <SeoActionLink href={item.href} variant="secondary" className="px-3.5 py-2 text-[11px]">
                        {item.cta}
                    </SeoActionLink>
                </div>
            ) : null}
        </div>
    );
}

function SectionBlock({ section, emptyTitle, clientId }) {
    if (section.status === 'unavailable') {
        return <SeoEmptyState title={emptyTitle} description={section.description} />;
    }

    if (!section.items.length) {
        return <SeoEmptyState title={emptyTitle} description={section.description} />;
    }

    return (
        <div className="space-y-3">
            {section.items.map((item) => (
                <OpportunityCard key={item.id} item={item} clientId={clientId} />
            ))}
        </div>
    );
}

function HookCard({ item }) {
    const body = (
        <div className="rounded-[24px] border border-white/[0.08] bg-black/20 p-4 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]">
            <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-semibold text-white/92">{item.title}</div>
                <ReliabilityPill value={item.reliability} />
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-white/66">{item.description}</p>
            <div className="mt-4 inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-medium text-white/78">
                {item.cta}
            </div>
        </div>
    );

    return (
        <Link href={item.href} className="block text-white">
            {body}
        </Link>
    );
}

export default function SeoOpportunitiesView() {
    const { client, clientId } = useGeoClient();
    const { data, loading, error } = useSeoWorkspaceSlice('opportunities');

    const baseHref = clientId ? `/admin/clients/${clientId}` : '/admin/clients';

    if (loading) {
        return (
            <SeoLoadingState
                title="Chargement des opportunités SEO…"
                description="Assemblage des actions rapides Search Console, des retravails audités et des relais SEO réellement fondés."
            />
        );
    }

    if (error) {
        return (
            <SeoPageShell>
                <SeoEmptyState
                    title="Opportunités SEO indisponibles"
                    description={error}
                    action={<SeoActionLink href={`${baseHref}/seo/visibility`}>Voir la visibilité SEO</SeoActionLink>}
                />
            </SeoPageShell>
        );
    }

    if (data?.emptyState) {
        return (
            <SeoPageShell>
                <SourceStatusNotice status={data?.status} errors={data?.errors} />
                <SeoPageHeader
                    eyebrow="SEO Ops"
                    title="Opportunités SEO"
                    subtitle={`File opérateur SEO pour ${client?.client_name || 'ce mandat'}, basée uniquement sur les signaux réellement stockés.`}
                    actions={
                        <>
                            <SeoActionLink href={`${baseHref}/seo/visibility`} variant="secondary">
                                Visibilité SEO
                            </SeoActionLink>
                            <SeoActionLink href={`${baseHref}/seo/health`} variant="secondary">
                                Santé SEO
                            </SeoActionLink>
                            <SeoActionLink href={`${baseHref}/dossier/connectors`} variant="primary">
                                Connecteurs
                            </SeoActionLink>
                        </>
                    }
                />
                <SeoEmptyState title={data.emptyState.title} description={data.emptyState.description} />
            </SeoPageShell>
        );
    }

    return (
        <SeoPageShell>
            <SourceStatusNotice status={data?.status} errors={data?.errors} />
            <SeoPageHeader
                eyebrow="SEO Ops"
                title="Opportunités SEO"
                subtitle={`Backlog opérateur pour ${client?.client_name || 'ce mandat'}: actions rapides, pages 4–20, reprises metadata, retravails éditoriaux et arbitrages de consolidation, sans glisser vers une lecture GEO.`}
                actions={
                    <>
                        <SeoActionLink href={`${baseHref}/seo/visibility`} variant="secondary">
                            Visibilité SEO
                        </SeoActionLink>
                        <SeoActionLink href={`${baseHref}/seo/content`} variant="secondary">
                            Contenu SEO
                        </SeoActionLink>
                        <SeoActionLink href={`${baseHref}/seo/health`} variant="primary">
                            Santé SEO
                        </SeoActionLink>
                    </>
                }
            />

            <SeoSectionNav
                items={[
                    { id: 'overview', label: 'Vue d’ensemble' },
                    { id: 'quick-wins', label: 'Actions rapides' },
                    { id: 'click-gap', label: 'Écart de clic' },
                    { id: 'positions', label: 'Pages 4–20' },
                    { id: 'metadata', label: 'Metadata' },
                    { id: 'refresh', label: 'Retravail' },
                    { id: 'coverage', label: 'Couverture' },
                    { id: 'internal-linking', label: 'Maillage' },
                    { id: 'consolidation', label: 'Arbitrages' },
                    { id: 'hooks', label: 'Relais' },
                ]}
            />

            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                Priorisation SEO
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {(data?.summaryCards || []).map((card) => (
                    <SeoStatCard
                        key={card.id}
                        label={card.label}
                        value={card.value}
                        detail={card.detail}
                        reliability={card.reliability}
                        accent={card.accent}
                    />
                ))}
            </div>

            <SeoPanel
                id="overview"
                title="Vue d’ensemble backlog"
                subtitle="Résumé opérateur, fraîcheur des signaux et rappel explicite du cadre de vérité appliqué à cette file SEO."
                reliability="calculated"
                tone="info"
            >
                <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-4">
                        <div className="rounded-[24px] border border-white/[0.08] bg-black/20 p-4 sm:p-5">
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="text-sm font-semibold text-white/92">Résumé opérateur</div>
                                <ReliabilityPill value={data.operatorSummary.reliability} />
                            </div>
                            <p className="mt-3 text-[14px] leading-relaxed text-white/72">
                                {data.operatorSummary.text}
                            </p>
                            <div className="mt-3 text-[12px] leading-relaxed text-white/44">
                                {data.operatorSummary.note}
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                            <FreshnessCard item={data.freshness.audit} />
                            <FreshnessCard
                                item={{
                                    ...data.freshness.gsc,
                                    value: data.freshness.gsc.lastObservedDate
                                        ? formatDateLabel(data.freshness.gsc.lastObservedDate)
                                        : 'Indisponible',
                                }}
                            />
                            <FreshnessCard item={data.freshness.backlog} />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/42">
                            Cadre de vérité
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {(data.reliabilityBreakdown || []).map((item) => (
                                <ReliabilityLayerCard key={item.id} item={item} />
                            ))}
                        </div>

                        {data.auditMeta?.sourceUrl || data.auditMeta?.siteTypeLabel ? (
                            <div className="rounded-[24px] border border-white/[0.08] bg-black/20 p-4 sm:p-5">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/35">
                                    Référence active
                                </div>
                                <div className="mt-3 text-[12px] leading-relaxed text-white/70">
                                    {formatSiteTypeLabel(data.auditMeta?.siteTypeLabel)
                                        ? `${formatSiteTypeLabel(data.auditMeta?.siteTypeLabel)} · `
                                        : ''}
                                    {data.auditMeta?.sourceUrl || 'URL source indisponible'}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            </SeoPanel>

            <SeoPanel
                id="quick-wins"
                title="Actions rapides SEO"
                subtitle="Sous-ensemble des actions les plus rapides à activer quand la visibilité ou l’audit donnent déjà une direction claire."
                reliability={data.quickWins.reliability}
                tone={getPanelToneFromStatus(data.quickWins.status)}
                action={<SeoStatusBadge status={data.quickWins.status} />}
            >
                <SectionBlock
                    section={data.quickWins}
                    emptyTitle="Aucune action rapide dominante"
                    clientId={clientId}
                />
            </SeoPanel>

            <SeoPanel
                id="click-gap"
                title="Écart de clic exploitable"
                subtitle="Pages déjà visibles où l’objectif prioritaire est d’abord de récupérer plus de clics avant de produire davantage."
                reliability={data.clickGap.reliability}
                tone={getPanelToneFromStatus(data.clickGap.status)}
                action={<SeoStatusBadge status={data.clickGap.status} />}
            >
                <SectionBlock section={data.clickGap} emptyTitle="Aucun écart de clic dominant" clientId={clientId} />
            </SeoPanel>

            <SeoPanel
                id="positions"
                title="Pages en positions 4 à 20"
                subtitle="Pages déjà présentes dans la zone de visibilité organique qui peuvent encore progresser avec un travail ciblé."
                reliability={data.positionBand.reliability}
                tone={getPanelToneFromStatus(data.positionBand.status)}
                action={<SeoStatusBadge status={data.positionBand.status} />}
            >
                <SectionBlock
                    section={data.positionBand}
                    emptyTitle="Aucune page prioritaire en positions 4 à 20"
                    clientId={clientId}
                />
            </SeoPanel>

            <SeoPanel
                id="metadata"
                title="Opportunités metadata"
                subtitle="Titles, metas et H1 à reprendre d’abord sur les surfaces déjà critiques ou déjà visibles."
                reliability={data.metadata.reliability}
                tone={getPanelToneFromStatus(data.metadata.status)}
                action={<SeoStatusBadge status={data.metadata.status} />}
            >
                <SectionBlock
                    section={data.metadata}
                    emptyTitle="Aucune reprise metadata prioritaire"
                    clientId={clientId}
                />
            </SeoPanel>

            <SeoPanel
                id="refresh"
                title="Retravail et actualisation"
                subtitle="Pages en recul ou trop faibles éditorialement pour soutenir la progression SEO actuelle."
                reliability={data.refresh.reliability}
                tone={getPanelToneFromStatus(data.refresh.status)}
                action={<SeoStatusBadge status={data.refresh.status} />}
            >
                <SectionBlock section={data.refresh} emptyTitle="Aucun retravail prioritaire" clientId={clientId} />
            </SeoPanel>

            <SeoPanel
                id="coverage"
                title="Couverture et nouvelles pages"
                subtitle="Manques structurels réellement visibles dans l’audit, sans inventer des pages non justifiées par les signaux actuels."
                reliability={data.coverage.reliability}
                tone={getPanelToneFromStatus(data.coverage.status)}
                action={<SeoStatusBadge status={data.coverage.status} />}
            >
                <SectionBlock
                    section={data.coverage}
                    emptyTitle="Aucun manque de couverture dominant"
                    clientId={clientId}
                />
            </SeoPanel>

            <SeoPanel
                id="internal-linking"
                title="Maillage interne si fondé"
                subtitle="Pistes de structure seulement quand un hub et des pages support existent déjà. Aucun défaut de maillage n’est inventé sans graphe de liens."
                reliability={data.internalLinking.reliability}
                tone={getPanelToneFromStatus(data.internalLinking.status)}
                action={<SeoStatusBadge status={data.internalLinking.status} />}
            >
                <SectionBlock
                    section={data.internalLinking}
                    emptyTitle="Maillage interne non qualifiable proprement"
                    clientId={clientId}
                />
            </SeoPanel>

            <SeoPanel
                id="consolidation"
                title="Arbitrages de consolidation"
                subtitle="Fusions, repositionnements ou différenciations à instruire depuis la surface cannibalisation déjà en place."
                reliability={data.consolidation.reliability}
                tone={getPanelToneFromStatus(data.consolidation.status)}
                action={<SeoStatusBadge status={data.consolidation.status} />}
            >
                <SectionBlock
                    section={data.consolidation}
                    emptyTitle="Aucun arbitrage de consolidation prioritaire"
                    clientId={clientId}
                />
            </SeoPanel>

            <SeoPanel
                id="hooks"
                title="Relais opérateur"
                subtitle="Entrées utiles vers les surfaces SEO existantes pour exécuter, confirmer ou détailler les opportunités listées ici."
                reliability="calculated"
                tone="default"
            >
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                    {(data.actionHooks || []).map((item) => (
                        <HookCard key={item.id} item={item} />
                    ))}
                </div>
            </SeoPanel>
        </SeoPageShell>
    );
}
