'use client';

import { useMemo, useState } from 'react';

import IssueQuickAction from '@/features/admin/shared/components/IssueQuickAction';

import {
    LabCollapsible,
    LabDiagnosticSection,
    LabEmptyState,
    LabPill,
    LabSectionHeader,
} from './LabPrimitives';
import {
    aggregateChecksByCategory,
    getLayer1ViewModel,
    groupPageChecksByUrl,
    scoreToneClass,
    summarizePageGroups,
} from './audit-lab-model';
import {
    checkIdFr,
    checkStatusFr,
    crawlStrategyFr,
    humanizeCategoryKey,
    pageStatusFr,
    renderStrategyFr,
} from './audit-lab-copy';

/**
 * Section B — Scan GEO brut.
 *
 * Console opérateur de style "geodaddy" pour lire la couche 1 en un coup
 * d'œil : métadonnées d'exploration, score brut global, scores par catégorie
 * GEO (technique / contenu / accès IA / confiance / GEO local), explorateur
 * filtrable des vérifications par page.
 *
 * IMPORTANT : cette section est 100% diagnostique. Le score brut affiché ici
 * n'est pas le score Trouvable final (cf. Section A · Vue d'ensemble).
 */

const STATUS_TABS = [
    { key: 'all', label: 'Tous' },
    { key: 'problem', label: 'Problèmes', tone: 'bad' },
    { key: 'watch', label: 'À surveiller', tone: 'warn' },
    { key: 'ok', label: 'OK', tone: 'good' },
    { key: 'skip', label: 'Non applicable', tone: 'neutral' },
    { key: 'unknown', label: 'Indéterminé', tone: 'neutral' },
];

const CATEGORY_TAB_ALL = { key: 'all', label: 'Toutes catégories' };

function statusDotClass(tone) {
    if (tone === 'good') return 'bg-emerald-400/80';
    if (tone === 'warn') return 'bg-amber-400/80';
    if (tone === 'bad') return 'bg-red-400/80';
    return 'bg-white/30';
}

function tabToneActive(tone) {
    if (tone === 'bad') return 'border-red-400/40 bg-red-400/[0.08] text-red-200';
    if (tone === 'warn') return 'border-amber-400/40 bg-amber-400/[0.08] text-amber-200';
    if (tone === 'good') return 'border-emerald-400/40 bg-emerald-400/[0.08] text-emerald-200';
    return 'border-white/25 bg-white/[0.06] text-white/85';
}

function statusMatchesKey(checkStatusKey, filterKey) {
    if (filterKey === 'all') return true;
    return checkStatusKey === filterKey;
}

function pageMatchesStatus(group, filter) {
    if (filter === 'all') return true;
    if (filter === 'problem') return group.fail > 0;
    if (filter === 'watch') return group.fail === 0 && group.warn > 0;
    if (filter === 'ok') return group.fail === 0 && group.warn === 0 && group.pass > 0;
    if (filter === 'skip') return group.total > 0 && group.pass === 0 && group.warn === 0 && group.fail === 0 && group.skip > 0;
    if (filter === 'unknown') return group.total === 0 || group.unknown === group.total;
    return true;
}

function pageMatchesCategory(group, categoryKey, statusFilter) {
    if (categoryKey === 'all') return true;
    return group.checks.some((check) => {
        const cat = String(check?.category || '').toLowerCase();
        if (cat !== categoryKey) return false;
        if (statusFilter === 'all') return true;
        const { key } = checkStatusFr(check);
        return key === statusFilter;
    });
}

function pageMatchesSearch(group, needle) {
    if (!needle) return true;
    const lower = needle.toLowerCase();
    if (group.url.toLowerCase().includes(lower)) return true;
    for (const check of group.checks) {
        if (String(check?.category || '').toLowerCase().includes(lower)) return true;
        if (String(check?.check_id || '').toLowerCase().includes(lower)) return true;
        const fr = checkIdFr(check?.check_id || check?.id);
        if (fr && fr.toLowerCase().includes(lower)) return true;
    }
    return false;
}

/* =========================================================================
 * Sub-block 1 — Header
 * ========================================================================= */

function ScanHeaderMetrics({ crawlMetadata, renderStats, siteLevelRawScores, totals, pagesList, sitemapSources }) {
    const strategyLabel = crawlStrategyFr(crawlMetadata?.strategy) || '—';
    const renderLabel = renderStrategyFr(renderStats?.audit_strategy || renderStats?.strategy) || 'Inconnu';
    const overallRaw = siteLevelRawScores?.overall ?? null;
    const pagesVisited = crawlMetadata?.pages_visited ?? pagesList.length ?? 0;
    const pagesBudget = crawlMetadata?.pages_budget;

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">Score brut du scan</div>
                    <div className={`mt-1 font-['Plus_Jakarta_Sans',sans-serif] text-xl font-extrabold tabular-nums ${scoreToneClass(overallRaw)}`}>
                        {overallRaw != null ? overallRaw : '—'}
                        <span className="ml-0.5 text-[10px] text-white/25">/100</span>
                    </div>
                    <div className="mt-0.5 text-[9px] uppercase tracking-wider text-white/30">Diagnostic interne</div>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">Stratégie d&apos;exploration</div>
                    <div className="mt-1 text-[13px] font-semibold text-white/85">{strategyLabel}</div>
                    <div className="mt-0.5 text-[9px] uppercase tracking-wider text-white/30">Mode de rendu : <span className="text-white/50">{renderLabel}</span></div>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">Pages analysées</div>
                    <div className="mt-1 text-xl font-extrabold tabular-nums text-white/85">
                        {pagesVisited}
                        {pagesBudget ? (
                            <span className="ml-1 text-[10px] text-white/30">/ {pagesBudget}</span>
                        ) : null}
                    </div>
                    <div className="mt-0.5 text-[9px] uppercase tracking-wider text-white/30">{sitemapSources.length} source{sitemapSources.length > 1 ? 's' : ''} sitemap</div>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">Couverture pages</div>
                    <div className="mt-1 flex items-baseline gap-1.5 text-[13px] font-semibold">
                        <span className="tabular-nums text-red-300">{totals.pages.problem || 0}</span>
                        <span className="text-[10px] text-white/30">pb.</span>
                        <span className="text-white/15">·</span>
                        <span className="tabular-nums text-amber-200">{totals.pages.watch || 0}</span>
                        <span className="text-[10px] text-white/30">surv.</span>
                        <span className="text-white/15">·</span>
                        <span className="tabular-nums text-emerald-300">{totals.pages.ok || 0}</span>
                        <span className="text-[10px] text-white/30">OK</span>
                    </div>
                    <div className="mt-0.5 text-[9px] uppercase tracking-wider text-white/30">{totals.pages.total} pages testées</div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl border border-red-400/20 bg-red-400/[0.03] px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-red-300/80">Problèmes</div>
                    <div className="mt-1 text-xl font-extrabold tabular-nums text-red-300">{totals.checks.fail}</div>
                    <div className="mt-0.5 text-[9px] uppercase tracking-wider text-white/30">vérifications en échec</div>
                </div>
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.03] px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-amber-300/80">À surveiller</div>
                    <div className="mt-1 text-xl font-extrabold tabular-nums text-amber-200">{totals.checks.warn}</div>
                    <div className="mt-0.5 text-[9px] uppercase tracking-wider text-white/30">avertissements</div>
                </div>
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.03] px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-300/80">Vérifiés OK</div>
                    <div className="mt-1 text-xl font-extrabold tabular-nums text-emerald-300">{totals.checks.pass}</div>
                    <div className="mt-0.5 text-[9px] uppercase tracking-wider text-white/30">vérifications validées</div>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">Non applicables</div>
                    <div className="mt-1 text-xl font-extrabold tabular-nums text-white/65">{totals.checks.skip}</div>
                    <div className="mt-0.5 text-[9px] uppercase tracking-wider text-white/30">
                        {totals.checks.unknown > 0
                            ? `${totals.checks.unknown} indéterminées`
                            : 'skip volontaires'}
                    </div>
                </div>
            </div>

            {renderStats && (
                <div className="rounded-lg border border-white/[0.05] bg-white/[0.015] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">Rendu des pages</span>
                        <LabPill
                            label={renderLabel}
                            tone={renderStats.audit_strategy === 'static_only' ? 'warn' : 'good'}
                        />
                        {renderStats.playwright_available ? (
                            <LabPill label="Navigateur disponible" tone="good" />
                        ) : (
                            <LabPill label="Navigateur indisponible" tone="warn" />
                        )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-white/55">
                        <span>Rendues : <span className="tabular-nums text-white/75">{renderStats.rendered_pages ?? 0}</span></span>
                        <span>Statiques : <span className="tabular-nums text-white/75">{renderStats.static_pages ?? 0}</span></span>
                        <span>Fallback : <span className="tabular-nums text-white/75">{renderStats.render_fallback_pages ?? 0}</span></span>
                        <span>Échecs : <span className="tabular-nums text-white/75">{renderStats.render_failures ?? 0}</span></span>
                    </div>
                    {renderStats.audit_strategy_message && (
                        <p className="mt-1 text-[10px] text-white/40">{renderStats.audit_strategy_message}</p>
                    )}
                </div>
            )}
        </div>
    );
}

/* =========================================================================
 * Sub-block 2 — Category cards
 * ========================================================================= */

function CategoryScoreBar({ pass, warn, fail, skip }) {
    const total = Math.max(1, pass + warn + fail + skip);
    const pctPass = (pass / total) * 100;
    const pctWarn = (warn / total) * 100;
    const pctFail = (fail / total) * 100;
    return (
        <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
            {fail > 0 && <div style={{ width: `${pctFail}%` }} className="bg-red-400/70" />}
            {warn > 0 && <div style={{ width: `${pctWarn}%` }} className="bg-amber-400/70" />}
            {pass > 0 && <div style={{ width: `${pctPass}%` }} className="bg-emerald-400/70" />}
        </div>
    );
}

function CategoryCard({ categoryKey, score, bucket, isActive, onActivate }) {
    const label = humanizeCategoryKey(categoryKey);
    const tone = scoreToneClass(score);
    const borderClass = isActive
        ? 'border-violet-400/40 bg-violet-400/[0.04]'
        : 'border-white/[0.06] bg-white/[0.015] hover:border-white/[0.12] hover:bg-white/[0.025]';

    return (
        <button
            type="button"
            onClick={onActivate}
            className={`group rounded-xl border p-3 text-left transition-colors ${borderClass}`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold text-white/85">{label}</div>
                    <div className="mt-0.5 text-[9px] uppercase tracking-wider text-white/35">
                        {bucket?.total || 0} vérification{(bucket?.total || 0) > 1 ? 's' : ''}
                    </div>
                </div>
                {typeof score === 'number' ? (
                    <div className={`shrink-0 text-right font-['Plus_Jakarta_Sans',sans-serif] text-lg font-extrabold tabular-nums ${tone}`}>
                        {score}
                        <span className="text-[9px] text-white/25">/100</span>
                    </div>
                ) : (
                    <span className="shrink-0 text-[10px] text-white/30">—</span>
                )}
            </div>

            <CategoryScoreBar
                pass={bucket?.pass || 0}
                warn={bucket?.warn || 0}
                fail={bucket?.fail || 0}
                skip={bucket?.skip || 0}
            />

            <div className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-white/45">
                <span><span className="tabular-nums text-red-300/90">{bucket?.fail || 0}</span> pb.</span>
                <span><span className="tabular-nums text-amber-200/90">{bucket?.warn || 0}</span> surv.</span>
                <span><span className="tabular-nums text-emerald-300/90">{bucket?.pass || 0}</span> OK</span>
                {(bucket?.skip || 0) > 0 && <span><span className="tabular-nums text-white/55">{bucket?.skip}</span> skip</span>}
            </div>

            {bucket?.topIssues?.length > 0 && (
                <ul className="mt-2 space-y-0.5 border-t border-white/[0.05] pt-2">
                    {bucket.topIssues.map((issue) => (
                        <li key={issue.checkId} className="flex items-center justify-between gap-2 text-[10px]">
                            <span className="truncate text-white/65" title={issue.checkId}>
                                {checkIdFr(issue.checkId) || issue.checkId}
                            </span>
                            <span className="shrink-0 font-semibold tabular-nums">
                                {issue.fail > 0 && <span className="text-red-300/90">{issue.fail} pb.</span>}
                                {issue.fail > 0 && issue.warn > 0 && <span className="mx-1 text-white/20">·</span>}
                                {issue.warn > 0 && <span className="text-amber-200/90">{issue.warn} surv.</span>}
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            {isActive && (
                <div className="mt-2 rounded-md border border-violet-400/20 bg-violet-400/[0.04] px-2 py-1 text-[10px] text-violet-200">
                    Filtre actif — cliquer à nouveau pour enlever
                </div>
            )}
        </button>
    );
}

function ScanCategoryCards({ categoryAggregates, siteCategoryScores, activeCategory, onSelectCategory }) {
    // Merge: for each category present in either the raw scores OR the
    // aggregated check buckets, build one card. We don't invent categories.
    const categories = new Set();
    if (siteCategoryScores && typeof siteCategoryScores === 'object') {
        for (const key of Object.keys(siteCategoryScores)) categories.add(String(key).toLowerCase());
    }
    for (const agg of categoryAggregates) categories.add(agg.category);

    if (categories.size === 0) return null;

    const bucketByCategory = new Map(categoryAggregates.map((a) => [a.category, a]));

    // Sort: problems first (use fail/warn), then by total checks.
    const ordered = Array.from(categories).sort((a, b) => {
        const ba = bucketByCategory.get(a);
        const bb = bucketByCategory.get(b);
        const failA = ba?.fail || 0;
        const failB = bb?.fail || 0;
        if (failA !== failB) return failB - failA;
        const warnA = ba?.warn || 0;
        const warnB = bb?.warn || 0;
        if (warnA !== warnB) return warnB - warnA;
        return (bb?.total || 0) - (ba?.total || 0);
    });

    return (
        <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/60">
                    Scores par famille de contrôles
                </h3>
                <span className="text-[10px] text-white/35">Cliquez une carte pour ne voir que ses vérifications</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {ordered.map((key) => {
                    const rawScoreEntry = siteCategoryScores?.[key];
                    const score = typeof rawScoreEntry?.score === 'number'
                        ? rawScoreEntry.score
                        : typeof rawScoreEntry === 'number'
                        ? rawScoreEntry
                        : null;
                    const bucket = bucketByCategory.get(key) || {
                        category: key,
                        pass: rawScoreEntry?.pass || 0,
                        warn: rawScoreEntry?.warn || 0,
                        fail: rawScoreEntry?.fail || 0,
                        skip: rawScoreEntry?.skip || 0,
                        total: (rawScoreEntry?.pass || 0) + (rawScoreEntry?.warn || 0) + (rawScoreEntry?.fail || 0) + (rawScoreEntry?.skip || 0),
                        topIssues: [],
                    };
                    return (
                        <CategoryCard
                            key={key}
                            categoryKey={key}
                            score={score}
                            bucket={bucket}
                            isActive={activeCategory === key}
                            onActivate={() => onSelectCategory(activeCategory === key ? 'all' : key)}
                        />
                    );
                })}
            </div>
        </div>
    );
}

/* =========================================================================
 * Sub-block 3 — Page explorer
 * ========================================================================= */

function PageChecksRow({ group, statusFilter, categoryFilter, clientId }) {
    const [open, setOpen] = useState(false);
    const status = pageStatusFr(group.pageStatus);

    const visibleChecks = useMemo(() => {
        return group.checks.filter((check) => {
            if (categoryFilter !== 'all') {
                const cat = String(check?.category || '').toLowerCase();
                if (cat !== categoryFilter) return false;
            }
            if (statusFilter === 'all') return true;
            const { key } = checkStatusFr(check);
            return statusMatchesKey(key, statusFilter);
        });
    }, [group.checks, statusFilter, categoryFilter]);

    const pill = (() => {
        if (group.fail > 0) return { label: `${group.fail} problème${group.fail > 1 ? 's' : ''}`, tone: 'bad' };
        if (group.warn > 0) return { label: `${group.warn} à surveiller`, tone: 'warn' };
        if (group.pass > 0) return { label: `${group.pass} OK`, tone: 'good' };
        return { label: 'Indéterminé', tone: 'neutral' };
    })();

    return (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.015]">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.025]"
            >
                <div className="flex min-w-0 items-center gap-2.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass(status.tone)}`} />
                    <div className="min-w-0">
                        <div className="truncate text-[12px] font-medium text-white/85" title={group.url}>
                            {group.url}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-white/40">
                            {group.pageType && (
                                <>
                                    <span className="text-white/55">{humanizeCategoryKey(group.pageType)}</span>
                                    <span className="text-white/15">·</span>
                                </>
                            )}
                            {group.renderMode && (
                                <>
                                    <span>{humanizeCategoryKey(group.renderMode)}</span>
                                    <span className="text-white/15">·</span>
                                </>
                            )}
                            <span>{group.total} vérification{group.total > 1 ? 's' : ''}</span>
                        </div>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                    {group.fail > 0 && <LabPill label={`${group.fail} pb.`} tone="bad" />}
                    {group.warn > 0 && <LabPill label={`${group.warn} surv.`} tone="warn" />}
                    {group.pass > 0 && group.fail === 0 && group.warn === 0 && <LabPill label={`${group.pass} OK`} tone="good" />}
                    {group.pageStatus === 'unknown' && <LabPill label={pill.label} tone={pill.tone} />}
                    <span className={`ml-1 text-xs text-white/40 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
                </div>
            </button>

            {open && (
                <div className="border-t border-white/[0.05] p-3">
                    {visibleChecks.length === 0 ? (
                        <p className="text-[11px] italic text-white/40">
                            Aucune vérification ne correspond aux filtres courants.
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
                            {visibleChecks.map((check, index) => {
                                const s = checkStatusFr(check);
                                const borderClass = s.tone === 'good'
                                    ? 'border-emerald-400/15 bg-emerald-400/[0.03]'
                                    : s.tone === 'warn'
                                    ? 'border-amber-400/15 bg-amber-400/[0.03]'
                                    : s.tone === 'bad'
                                    ? 'border-red-400/15 bg-red-400/[0.03]'
                                    : 'border-white/[0.06] bg-white/[0.02]';
                                const label = checkIdFr(check.check_id || check.id) || humanizeCategoryKey(check.category || 'vérification');
                                const evidenceText = check.evidence
                                    ? typeof check.evidence === 'string'
                                        ? check.evidence
                                        : JSON.stringify(check.evidence)
                                    : null;
                                const canGeneratePrompt = (s.tone === 'bad' || s.tone === 'warn') && clientId && (check.check_id || check.id);
                                const problemRef = canGeneratePrompt
                                    ? {
                                        source: 'lab_layer1_check',
                                        clientId,
                                        checkId: String(check.check_id || check.id),
                                        pageUrl: group.url,
                                        layer: 'layer1',
                                        category: check.category || null,
                                        label,
                                    }
                                    : null;
                                return (
                                    <div
                                        key={`${check.check_id || check.id || 'check'}-${index}`}
                                        className={`rounded-md border px-2.5 py-1.5 ${borderClass}`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <div
                                                    className="truncate text-[11px] font-medium text-white/85"
                                                    title={check.check_id || check.id || ''}
                                                >
                                                    {label}
                                                </div>
                                                {check.category && (
                                                    <div className="text-[9px] uppercase tracking-wider text-white/30">
                                                        {humanizeCategoryKey(check.category)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1.5">
                                                <LabPill label={s.label} tone={s.tone} />
                                                {problemRef ? (
                                                    <IssueQuickAction problemRef={problemRef} label="Prompt" size="xs" variant="primary" />
                                                ) : null}
                                            </div>
                                        </div>
                                        {evidenceText && (
                                            <p className="mt-1 line-clamp-2 text-[10px] text-white/50" title={evidenceText}>
                                                {evidenceText}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function ScanPageExplorer({
    groups,
    totals,
    categories,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    search,
    setSearch,
    clientId,
}) {
    const filtered = useMemo(
        () => groups
            .filter((group) => pageMatchesStatus(group, statusFilter))
            .filter((group) => pageMatchesCategory(group, categoryFilter, statusFilter))
            .filter((group) => pageMatchesSearch(group, search.trim())),
        [groups, statusFilter, categoryFilter, search],
    );

    const statusCounts = {
        all: totals.pages.total,
        problem: totals.pages.problem || 0,
        watch: totals.pages.watch || 0,
        ok: totals.pages.ok || 0,
        skip: groups.filter((g) => pageMatchesStatus(g, 'skip')).length,
        unknown: totals.pages.unknown || 0,
    };

    return (
        <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/60">
                    Explorateur de vérifications par page
                </h3>
                <span className="text-[10px] text-white/35">
                    {filtered.length} / {groups.length} pages affichées
                </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
                {STATUS_TABS.map((tab) => {
                    const isActive = statusFilter === tab.key;
                    const count = statusCounts[tab.key] ?? 0;
                    const toneClass = isActive
                        ? tabToneActive(tab.tone)
                        : 'border-white/[0.08] bg-white/[0.015] text-white/55 hover:text-white/80';
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setStatusFilter(tab.key)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${toneClass}`}
                        >
                            <span>{tab.label}</span>
                            <span className="rounded-full bg-white/[0.06] px-1.5 py-px text-[9px] tabular-nums text-white/70">
                                {count}
                            </span>
                        </button>
                    );
                })}
                <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Rechercher une URL ou un contrôle…"
                    className="geo-inp ml-auto min-w-[220px] flex-1 px-3 py-1.5 text-[12px] sm:max-w-sm sm:flex-none"
                />
            </div>

            {categories.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-white/35">Catégorie :</span>
                    {[CATEGORY_TAB_ALL, ...categories.map((c) => ({ key: c, label: humanizeCategoryKey(c) }))].map((tab) => {
                        const isActive = categoryFilter === tab.key;
                        const toneClass = isActive
                            ? 'border-violet-400/40 bg-violet-400/[0.08] text-violet-200'
                            : 'border-white/[0.06] bg-white/[0.015] text-white/50 hover:text-white/75';
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setCategoryFilter(tab.key)}
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-colors ${toneClass}`}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="mt-3 space-y-1.5">
                {filtered.length === 0 ? (
                    <LabEmptyState
                        title="Aucune page ne correspond"
                        description="Essayez un autre onglet, une autre catégorie, ou videz le champ de recherche."
                    />
                ) : (
                    filtered.slice(0, 80).map((group) => (
                        <PageChecksRow
                            key={group.url}
                            group={group}
                            statusFilter={statusFilter}
                            categoryFilter={categoryFilter}
                            clientId={clientId}
                        />
                    ))
                )}
                {filtered.length > 80 && (
                    <p className="pt-1 text-[10px] text-white/35">
                        + {filtered.length - 80} autres pages masquées (affinez la recherche pour les faire apparaître).
                    </p>
                )}
            </div>
        </div>
    );
}

/* =========================================================================
 * Main section
 * ========================================================================= */

export default function AuditLabGeoScan({ audit, clientId = null }) {
    const model = getLayer1ViewModel(audit);
    const groups = useMemo(() => groupPageChecksByUrl(model.pageLevelChecks), [model.pageLevelChecks]);
    const totals = useMemo(() => summarizePageGroups(groups), [groups]);
    const categoryAggregates = useMemo(() => aggregateChecksByCategory(groups), [groups]);
    const categoryKeys = useMemo(() => categoryAggregates.map((c) => c.category), [categoryAggregates]);

    const [statusFilter, setStatusFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [search, setSearch] = useState('');

    if (!model.hasAny) {
        return (
            <LabDiagnosticSection ribbon={false}>
                <LabSectionHeader
                    eyebrow="Section C · Scan GEO brut"
                    title="Scan indisponible"
                    subtitle="Aucune donnée de scan n'a été persistée pour cet audit (mode ombre ou audit antérieur au pipeline en couches)."
                    variant="diagnostic"
                />
                <LabEmptyState
                    title="Rien à diagnostiquer ici"
                    description="Lancez un audit complet pour peupler le scan GEO brut. Le résultat Trouvable affiché plus haut reste valide."
                />
            </LabDiagnosticSection>
        );
    }

    const sitemapSources = model.crawlMetadata?.sitemap_sources || [];
    const pagesList = model.pageArtifacts.length > 0 ? model.pageArtifacts : model.scannedPages;

    return (
        <LabDiagnosticSection ribbon={false}>
            <LabSectionHeader
                eyebrow="Section C · Scan GEO brut"
                title="Diagnostic du scan — exploration & contrôles automatiques"
                subtitle="Console opérateur sur la couche 1 : ce que le scanner a trouvé, contrôlé et classé. Ces chiffres sont diagnostiques — le score Trouvable communiqué au client reste celui de la Section A."
                variant="diagnostic"
                right={<LabPill label="diagnostic interne" tone="warn" />}
            />

            <ScanHeaderMetrics
                crawlMetadata={model.crawlMetadata}
                renderStats={model.renderStats}
                siteLevelRawScores={model.siteLevelRawScores}
                totals={totals}
                pagesList={pagesList}
                sitemapSources={sitemapSources}
            />

            <ScanCategoryCards
                categoryAggregates={categoryAggregates}
                siteCategoryScores={model.siteLevelRawScores?.categories}
                activeCategory={categoryFilter}
                onSelectCategory={setCategoryFilter}
            />

            <ScanPageExplorer
                groups={groups}
                totals={totals}
                categories={categoryKeys}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                categoryFilter={categoryFilter}
                setCategoryFilter={setCategoryFilter}
                search={search}
                setSearch={setSearch}
                clientId={clientId || audit?.client_id || null}
            />

            <div className="mt-5 space-y-2">
                {sitemapSources.length > 0 && (
                    <LabCollapsible
                        label={`Sources sitemap (${sitemapSources.length})`}
                        hint="Points d'entrée utilisés pour amorcer l'exploration"
                    >
                        <ul className="space-y-0.5">
                            {sitemapSources.slice(0, 12).map((src, idx) => (
                                <li
                                    key={idx}
                                    className="truncate font-mono text-[11px] text-white/60"
                                    title={typeof src === 'string' ? src : src?.url}
                                >
                                    {typeof src === 'string' ? src : src?.url || JSON.stringify(src)}
                                </li>
                            ))}
                            {sitemapSources.length > 12 && (
                                <li className="text-[10px] text-white/35">+ {sitemapSources.length - 12} autres</li>
                            )}
                        </ul>
                    </LabCollapsible>
                )}

                {pagesList.length > 0 && (
                    <LabCollapsible
                        label={`Pages explorées (${pagesList.length})`}
                        hint="Statut HTTP et mode de rendu par URL"
                    >
                        <div className="space-y-1">
                            {pagesList.slice(0, 50).map((page, idx) => {
                                const statusCode = page.status_code;
                                const tone = statusCode == null
                                    ? 'neutral'
                                    : statusCode >= 500
                                    ? 'bad'
                                    : statusCode >= 300
                                    ? 'warn'
                                    : 'good';
                                return (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between gap-2 rounded-md border border-white/[0.04] bg-white/[0.02] px-2.5 py-1.5"
                                    >
                                        <div className="min-w-0">
                                            <div className="truncate font-mono text-[11px] text-white/70" title={page.url}>
                                                {page.url}
                                            </div>
                                            {page.title && (
                                                <div className="truncate text-[10px] text-white/40">{page.title}</div>
                                            )}
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1">
                                            {statusCode != null && <LabPill label={String(statusCode)} tone={tone} />}
                                            {page.page_type && <LabPill label={humanizeCategoryKey(page.page_type)} />}
                                            {page.render_mode && <LabPill label={humanizeCategoryKey(page.render_mode)} />}
                                        </div>
                                    </div>
                                );
                            })}
                            {pagesList.length > 50 && (
                                <p className="text-[10px] text-white/35">+ {pagesList.length - 50} autres pages</p>
                            )}
                        </div>
                    </LabCollapsible>
                )}
            </div>
        </LabDiagnosticSection>
    );
}
