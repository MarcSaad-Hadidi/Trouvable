'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
    LabEmptyState,
    LabPill,
    LabSectionHeader,
} from './LabPrimitives';
import {
    buildCompareSnapshotFromAudit,
    formatDate,
    formatMs,
    scoreToneClass,
} from './audit-lab-model';
import {
    dimensionLabelFr,
    humanizeCategoryKey,
    severityFr,
    severityTone,
} from './audit-lab-copy';

/**
 * Bloc "Comparaison des audits".
 *
 * Historiquement une section (E) intégrée dans la page d'audit, ce composant
 * vit désormais sur une route dédiée (`/admin/clients/[id]/dossier/audit/comparison`).
 * Il est donc rendu comme le contenu principal d'une page, sans chrome
 * "Section E" résiduel.
 *
 * Trois modes d'usage :
 *
 *   1. Audit actuel vs audit précédent (interne, persistance base)
 *      -> charge l'historique via /api/admin/audits/history/[clientId]
 *      -> "A" = audit courant (déjà dans le contexte), "B" = audit sélectionné
 *
 *   2. Audit actuel vs benchmark externe (dry-run)
 *      -> "A" = audit courant, "B" = audit dry-run d'une URL externe
 *         via /api/admin/audits/compare (on ne garde que B)
 *
 *   3. Site A vs Site B (dry-run pur)
 *      -> deux URL dry-run via /api/admin/audits/compare, sans persistance
 *
 * Règles UI :
 *   - entête clair, mode sélectionné via onglets
 *   - résumé delta d'abord (pourquoi regarder ?), détails ensuite
 *   - libellés FR partout, chrome visuel identique pour les deux colonnes
 *   - jamais de JSON brut ici : cette section est orientée produit, pas debug
 */

const MODES = [
    { key: 'history', label: 'Audit actuel vs précédent' },
    { key: 'benchmark', label: 'Audit actuel vs site externe' },
    { key: 'dry-run', label: 'Site A vs Site B (dry-run)' },
];

const DIMENSION_ORDER = [
    'technical_seo',
    'identity_completeness',
    'local_readiness',
    'ai_answerability',
    'trust_signals',
];

/* =========================================================================
 * Small presentational helpers
 * ========================================================================= */

function formatDelta(a, b) {
    if (a == null || b == null) return null;
    return Math.round(a - b);
}

function deltaTone(delta, { invert = false } = {}) {
    if (delta == null) return 'neutral';
    if (delta === 0) return 'neutral';
    const positive = invert ? delta < 0 : delta > 0;
    return positive ? 'good' : 'bad';
}

function deltaLabel(delta, { suffix = ' pts' } = {}) {
    if (delta == null) return '—';
    if (delta === 0) return 'Égalité';
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta}${suffix}`;
}

function DeltaPill({ a, b, invert = false, suffix = ' pts' }) {
    const delta = formatDelta(a, b);
    const tone = deltaTone(delta, { invert });
    if (delta == null) return <LabPill label="—" tone="neutral" />;
    return <LabPill label={deltaLabel(delta, { suffix })} tone={tone} />;
}

function ScoreCell({ label, value, highlight = false, suffix = '/100' }) {
    const tone = scoreToneClass(value);
    return (
        <div className={`rounded-xl border px-3 py-2.5 ${highlight ? 'border-violet-400/25 bg-violet-500/[0.05]' : 'border-white/[0.08] bg-white/[0.02]'}`}>
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">{label}</div>
            <div className="mt-1 flex items-baseline gap-1">
                <span className={`text-lg font-extrabold tabular-nums ${tone}`}>
                    {value == null ? '—' : value}
                </span>
                {value != null && <span className="text-[10px] text-white/30">{suffix}</span>}
            </div>
        </div>
    );
}

function SideHeader({ side, label, snapshot }) {
    if (!snapshot) return null;
    const subtitle = snapshot.auditId
        ? `Audit ${snapshot.auditId.slice(0, 8)}… · ${formatDate(snapshot.createdAt)}`
        : snapshot.resolvedUrl || snapshot.url;
    const displayUrl = snapshot.resolvedUrl || snapshot.url || '—';

    return (
        <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/40">{side}</div>
                <div className="truncate text-[12px] font-semibold text-white/90" title={displayUrl}>
                    {label || displayUrl}
                </div>
                {subtitle && subtitle !== label && (
                    <div className="truncate text-[10px] text-white/40" title={subtitle}>{subtitle}</div>
                )}
            </div>
            {snapshot.classification?.label && (
                <LabPill label={snapshot.classification.label} tone="info" />
            )}
        </div>
    );
}

/* =========================================================================
 * Summary row (core deltas)
 * ========================================================================= */

function SummaryRow({ label, a, b, invert = false, suffix = '/100', deltaSuffix = ' pts', emphasize = false }) {
    const delta = formatDelta(a, b);
    const tone = deltaTone(delta, { invert });
    const borderClass = emphasize ? 'border-violet-400/25 bg-violet-500/[0.04]' : 'border-white/[0.06] bg-white/[0.01]';

    return (
        <div className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 rounded-lg border px-3 py-2 ${borderClass}`}>
            <div className="min-w-0">
                <div className={`text-[12px] font-semibold ${emphasize ? 'text-white/95' : 'text-white/80'}`}>{label}</div>
            </div>
            <div className={`text-right font-semibold tabular-nums ${scoreToneClass(a)}`}>
                {a == null ? '—' : a}
                {a != null && <span className="ml-0.5 text-[9px] text-white/25">{suffix}</span>}
            </div>
            <div className={`text-right font-semibold tabular-nums ${scoreToneClass(b)}`}>
                {b == null ? '—' : b}
                {b != null && <span className="ml-0.5 text-[9px] text-white/25">{suffix}</span>}
            </div>
            <div className="min-w-[72px] text-right">
                <LabPill
                    label={deltaLabel(delta, { suffix: deltaSuffix })}
                    tone={tone}
                />
            </div>
        </div>
    );
}

function SummaryTable({ rows, headerA, headerB }) {
    return (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.015]">
            <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-white/[0.05] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-white/40">
                <div>Indicateur</div>
                <div className="text-right">{headerA}</div>
                <div className="text-right">{headerB}</div>
                <div className="min-w-[72px] text-right">Écart</div>
            </div>
            <div className="space-y-1 p-2">
                {rows}
            </div>
        </div>
    );
}

/* =========================================================================
 * Issues / strengths
 * ========================================================================= */

function ListColumn({ label, items, tone, empty }) {
    const toneClass = tone === 'bad' ? 'text-red-300/85' : tone === 'good' ? 'text-emerald-300/85' : 'text-white/65';
    return (
        <div>
            <div className={`mb-1 text-[10px] font-bold uppercase tracking-[0.08em] ${toneClass}`}>{label}</div>
            {items.length === 0 ? (
                <p className="rounded-md border border-dashed border-white/[0.06] bg-white/[0.01] px-2.5 py-1.5 text-[10.5px] italic text-white/35">
                    {empty}
                </p>
            ) : (
                <ul className="space-y-1">
                    {items.slice(0, 5).map((item, index) => (
                        <li
                            key={`${item.id || item.title || 'item'}-${index}`}
                            className="flex items-start gap-1.5 rounded-md border border-white/[0.04] bg-white/[0.01] px-2.5 py-1.5"
                        >
                            {item.severity && tone === 'bad' && (
                                <LabPill label={severityFr(item.severity) || 'Info'} tone={severityTone(item.severity)} />
                            )}
                            <span className="text-[11px] leading-snug text-white/75">
                                {item.title || humanizeCategoryKey(item.id || item.category || 'point')}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/* =========================================================================
 * Comparison result panel
 * ========================================================================= */

function HeadlineDelta({ label, a, b, invert = false }) {
    const delta = formatDelta(a, b);
    const tone = deltaTone(delta, { invert });
    const textClass = tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-red-300' : 'text-white/70';
    return (
        <div className="flex flex-col items-center gap-0.5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">{label}</span>
            <span className={`font-['Plus_Jakarta_Sans',sans-serif] text-[26px] font-extrabold leading-none tabular-nums ${textClass}`}>
                {deltaLabel(delta, { suffix: '' })}
                {delta != null && delta !== 0 && <span className="ml-0.5 text-[12px] text-white/35">pts</span>}
            </span>
            <span className="text-[9.5px] text-white/35">
                {a == null ? '—' : a}<span className="text-white/20"> / </span>{b == null ? '—' : b}
            </span>
        </div>
    );
}

function ComparisonPanel({ siteA, siteB, labelA, labelB }) {
    const summaryRows = useMemo(() => {
        const a = siteA?.scores || {};
        const b = siteB?.scores || {};
        return [
            { key: 'final', label: 'Score Trouvable final', a: a.finalScore, b: b.finalScore, emphasize: true },
            { key: 'seo', label: 'Score SEO', a: a.seoScore, b: b.seoScore },
            { key: 'geo', label: 'Score GEO / local', a: a.geoScore, b: b.geoScore },
            { key: 'layer1', label: 'Score brut du scan', a: siteA?.layer1?.overall ?? null, b: siteB?.layer1?.overall ?? null },
            { key: 'layer2', label: 'Indicateur expert', a: siteA?.layer2?.summary_score ?? null, b: siteB?.layer2?.summary_score ?? null },
        ];
    }, [siteA, siteB]);

    const dimensionRows = useMemo(() => {
        const mapA = new Map((siteA?.dimensions || []).map((d) => [d.key, d]));
        const mapB = new Map((siteB?.dimensions || []).map((d) => [d.key, d]));
        const keys = new Set([...mapA.keys(), ...mapB.keys()]);
        const ordered = DIMENSION_ORDER.filter((k) => keys.has(k)).concat(
            Array.from(keys).filter((k) => !DIMENSION_ORDER.includes(k)),
        );
        return ordered.map((key) => ({
            key,
            label: dimensionLabelFr(key),
            a: mapA.get(key)?.score ?? null,
            b: mapB.get(key)?.score ?? null,
        }));
    }, [siteA, siteB]);

    const coverageA = siteA?.pagesScanned
        ? `${siteA.pagesSuccessful}/${siteA.pagesScanned}`
        : null;
    const coverageB = siteB?.pagesScanned
        ? `${siteB.pagesSuccessful}/${siteB.pagesScanned}`
        : null;

    return (
        <div className="space-y-4">
            {/* Headline deltas — "what changed" in one glance */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <HeadlineDelta label="Écart Trouvable" a={siteA?.scores?.finalScore} b={siteB?.scores?.finalScore} />
                <HeadlineDelta label="Écart SEO" a={siteA?.scores?.seoScore} b={siteB?.scores?.seoScore} />
                <HeadlineDelta label="Écart GEO" a={siteA?.scores?.geoScore} b={siteB?.scores?.geoScore} />
            </div>

            {/* Side-by-side headers */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-2 rounded-xl border border-violet-400/25 bg-violet-500/[0.03] p-3">
                    <SideHeader side="Côté A" label={labelA} snapshot={siteA} />
                </div>
                <div className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-white/[0.015] p-3">
                    <SideHeader side="Côté B" label={labelB} snapshot={siteB} />
                </div>
            </div>

            {/* Summary table — scores & deltas */}
            <SummaryTable
                headerA="Côté A"
                headerB="Côté B"
                rows={summaryRows.map((row) => (
                    <SummaryRow
                        key={row.key}
                        label={row.label}
                        a={row.a}
                        b={row.b}
                        emphasize={row.emphasize}
                    />
                ))}
            />

            {/* Coverage + errors row */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <ScoreCell label="Pages explorées — A" value={coverageA ?? '—'} suffix="" />
                <ScoreCell label="Pages explorées — B" value={coverageB ?? '—'} suffix="" />
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">Écart de couverture</div>
                    <div className="mt-1 text-[14px] font-semibold tabular-nums text-white/80">
                        {siteA?.pagesSuccessful != null && siteB?.pagesSuccessful != null
                            ? deltaLabel(siteA.pagesSuccessful - siteB.pagesSuccessful, { suffix: ' pages' })
                            : '—'}
                    </div>
                </div>
            </div>

            {/* Dimensions detail */}
            {dimensionRows.length > 0 && (
                <SummaryTable
                    headerA="A"
                    headerB="B"
                    rows={dimensionRows.map((dim) => (
                        <SummaryRow key={dim.key} label={dim.label} a={dim.a} b={dim.b} />
                    ))}
                />
            )}

            {/* Issues / strengths columns */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-violet-400/15 bg-violet-500/[0.02] p-3">
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-violet-300/80">Côté A — points clés</div>
                    <div className="grid grid-cols-1 gap-2">
                        <ListColumn label="Problèmes majeurs" items={siteA?.issues || []} tone="bad" empty="Aucun problème majeur remonté." />
                        <ListColumn label="Points forts" items={siteA?.strengths || []} tone="good" empty="Aucun point fort remonté." />
                    </div>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] p-3">
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-white/60">Côté B — points clés</div>
                    <div className="grid grid-cols-1 gap-2">
                        <ListColumn label="Problèmes majeurs" items={siteB?.issues || []} tone="bad" empty="Aucun problème majeur remonté." />
                        <ListColumn label="Points forts" items={siteB?.strengths || []} tone="good" empty="Aucun point fort remonté." />
                    </div>
                </div>
            </div>
        </div>
    );
}

/* =========================================================================
 * Mode 1 — History (current persisted audit vs another persisted audit)
 * ========================================================================= */

function HistoryMode({ clientId, currentAudit }) {
    const [history, setHistory] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [selectedId, setSelectedId] = useState(null);

    useEffect(() => {
        if (!clientId) return undefined;
        const controller = new AbortController();
        setLoading(true);
        setLoadError(null);
        fetch(`/api/admin/audits/history/${clientId}?limit=6`, { cache: 'no-store', signal: controller.signal })
            .then(async (response) => {
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
                return payload;
            })
            .then((payload) => {
                setHistory(payload);
                const currentId = currentAudit?.id;
                const candidates = (payload.audits || []).filter((audit) => audit.id !== currentId);
                if (candidates[0]) setSelectedId(candidates[0].id);
            })
            .catch((err) => {
                if (err.name !== 'AbortError') setLoadError(err.message);
            })
            .finally(() => setLoading(false));
        return () => controller.abort();
    }, [clientId, currentAudit?.id]);

    const snapshotA = useMemo(() => buildCompareSnapshotFromAudit(currentAudit, { label: 'Audit actuel' }), [currentAudit]);
    const selectedAudit = useMemo(() => {
        if (!history?.audits || !selectedId) return null;
        return history.audits.find((audit) => audit.id === selectedId) || null;
    }, [history, selectedId]);

    const snapshotB = useMemo(() => {
        if (!selectedAudit) return null;
        return {
            url: selectedAudit.sourceUrl,
            resolvedUrl: selectedAudit.resolvedUrl,
            label: `Audit du ${formatDate(selectedAudit.createdAt)}`,
            auditId: selectedAudit.id,
            createdAt: selectedAudit.createdAt,
            success: true,
            pagesScanned: selectedAudit.pagesScanned || 0,
            pagesSuccessful: selectedAudit.pagesSuccessful || 0,
            classification: selectedAudit.classification,
            scores: {
                finalScore: selectedAudit.hybridScore ?? selectedAudit.deterministicScore ?? selectedAudit.geoScore ?? selectedAudit.seoScore ?? null,
                seoScore: selectedAudit.seoScore,
                geoScore: selectedAudit.geoScore,
                deterministicScore: selectedAudit.deterministicScore,
            },
            dimensions: selectedAudit.dimensions || [],
            layer1: null,
            layer2: null,
            issues: selectedAudit.issues || [],
            strengths: selectedAudit.strengths || [],
        };
    }, [selectedAudit]);

    const eligibleAudits = (history?.audits || []).filter((audit) => audit.id !== currentAudit?.id);

    if (!currentAudit) {
        return (
            <LabEmptyState
                title="Aucun audit actuel"
                description="Lancez un premier audit pour pouvoir comparer à un audit antérieur."
            />
        );
    }

    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/40">Audit à comparer</div>
                        <p className="mt-0.5 text-[11px] text-white/55">
                            Comparer l'audit actuel ({formatDate(currentAudit.created_at)}) à l'un des précédents.
                        </p>
                    </div>
                    {loading && <span className="text-[11px] text-white/45">Chargement de l'historique…</span>}
                </div>
                {loadError && (
                    <p className="mt-2 rounded-md border border-red-400/20 bg-red-400/[0.05] px-3 py-2 text-[11px] text-red-300">
                        Impossible de charger l'historique : {loadError}
                    </p>
                )}
                {!loading && eligibleAudits.length === 0 && !loadError && (
                    <p className="mt-2 text-[11px] italic text-white/45">
                        Aucun audit précédent n'est enregistré pour ce mandat — revenez après un prochain lancement.
                    </p>
                )}
                {eligibleAudits.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {eligibleAudits.map((audit) => {
                            const isActive = audit.id === selectedId;
                            return (
                                <button
                                    key={audit.id}
                                    type="button"
                                    onClick={() => setSelectedId(audit.id)}
                                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] transition-colors ${
                                        isActive
                                            ? 'border-violet-400/40 bg-violet-400/[0.1] text-violet-200'
                                            : 'border-white/[0.08] bg-white/[0.02] text-white/65 hover:text-white/90'
                                    }`}
                                    title={audit.id}
                                >
                                    <span>{formatDate(audit.createdAt)}</span>
                                    <span className="text-white/30">·</span>
                                    <span className={`tabular-nums ${scoreToneClass(audit.hybridScore ?? audit.deterministicScore ?? null)}`}>
                                        {audit.hybridScore ?? audit.deterministicScore ?? '—'}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {snapshotA && snapshotB ? (
                <ComparisonPanel
                    siteA={snapshotA}
                    siteB={snapshotB}
                    labelA="Audit actuel"
                    labelB={snapshotB.label}
                />
            ) : !loading && (
                <LabEmptyState
                    title="Sélectionnez un audit précédent"
                    description="Choisissez un audit dans la liste ci-dessus pour afficher la comparaison."
                />
            )}
        </div>
    );
}

/* =========================================================================
 * Mode 2 — Benchmark (current persisted audit vs a dry-run of an external URL)
 * ========================================================================= */

function BenchmarkMode({ currentAudit }) {
    const [url, setUrl] = useState('');
    const [running, setRunning] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);

    const handleRun = useCallback(async () => {
        if (!currentAudit || !url.trim() || running) return;
        setRunning(true);
        setError(null);
        setResult(null);
        try {
            const response = await fetch('/api/admin/audits/compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    urlA: currentAudit.source_url || currentAudit.resolved_url,
                    urlB: url.trim(),
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                setError(payload?.error || `Erreur ${response.status}`);
                return;
            }
            setResult(payload);
        } catch (err) {
            setError(err?.message || 'Erreur réseau');
        } finally {
            setRunning(false);
        }
    }, [currentAudit, url, running]);

    const snapshotA = useMemo(() => buildCompareSnapshotFromAudit(currentAudit, { label: 'Audit actuel' }), [currentAudit]);
    const snapshotB = result?.siteB || null;

    if (!currentAudit) {
        return (
            <LabEmptyState
                title="Aucun audit actuel"
                description="Lancez d'abord un audit pour pouvoir le comparer à un benchmark externe."
            />
        );
    }

    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">
                            Site externe à comparer
                        </div>
                        <input
                            type="url"
                            value={url}
                            onChange={(event) => setUrl(event.target.value)}
                            placeholder="https://concurrent.fr"
                            className="geo-inp mt-1 w-full px-3 py-1.5 text-[12px]"
                            disabled={running}
                        />
                        <p className="mt-1 text-[10.5px] text-white/40">
                            L'audit actuel du mandat sert de référence (« Côté A »). Le site externe est exploré en dry-run, sans persistance.
                            L'analyse IA narrative est désactivée pour rester reproductible.
                        </p>
                    </div>
                    <div className="flex items-end">
                        <button
                            type="button"
                            onClick={handleRun}
                            disabled={running || !url.trim()}
                            className="geo-btn geo-btn-vio w-full whitespace-nowrap px-4 py-1.5 text-[12px] disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
                        >
                            {running ? 'Comparaison en cours…' : 'Comparer'}
                        </button>
                    </div>
                </div>
                {error && (
                    <p className="mt-2 rounded-md border border-red-400/20 bg-red-400/[0.05] px-3 py-2 text-[11px] text-red-300">
                        {error}
                    </p>
                )}
            </div>

            {snapshotA && snapshotB ? (
                <>
                    <ComparisonPanel
                        siteA={snapshotA}
                        siteB={snapshotB}
                        labelA="Audit actuel (persisté)"
                        labelB="Benchmark externe (dry-run)"
                    />
                    {result?.totalDurationMs != null && (
                        <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] px-3 py-2 text-[10.5px] text-white/40">
                            Durée du dry-run : {formatMs(result.totalDurationMs)} · LLM non exécuté (par conception).
                        </div>
                    )}
                </>
            ) : (
                <LabEmptyState
                    title="Aucune comparaison pour l'instant"
                    description="Entrez l'URL d'un site externe et lancez la comparaison pour voir les écarts avec l'audit actuel."
                />
            )}
        </div>
    );
}

/* =========================================================================
 * Mode 3 — Pure dry-run (two arbitrary URLs)
 * ========================================================================= */

function DryRunMode({ defaultUrlA }) {
    const [urlA, setUrlA] = useState(defaultUrlA || '');
    const [urlB, setUrlB] = useState('');
    const [running, setRunning] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);

    useEffect(() => {
        if (defaultUrlA) setUrlA(defaultUrlA);
    }, [defaultUrlA]);

    const handleRun = useCallback(async () => {
        if (!urlA.trim() || !urlB.trim() || running) return;
        setRunning(true);
        setError(null);
        setResult(null);
        try {
            const response = await fetch('/api/admin/audits/compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urlA: urlA.trim(), urlB: urlB.trim() }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                setError(payload?.error || `Erreur ${response.status}`);
                return;
            }
            setResult(payload);
        } catch (err) {
            setError(err?.message || 'Erreur réseau');
        } finally {
            setRunning(false);
        }
    }, [urlA, urlB, running]);

    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">Site A (référence)</div>
                        <input
                            type="url"
                            value={urlA}
                            onChange={(event) => setUrlA(event.target.value)}
                            placeholder="https://site-a.fr"
                            className="geo-inp mt-1 w-full px-3 py-1.5 text-[12px]"
                            disabled={running}
                        />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">Site B (comparaison)</div>
                        <input
                            type="url"
                            value={urlB}
                            onChange={(event) => setUrlB(event.target.value)}
                            placeholder="https://concurrent.fr"
                            className="geo-inp mt-1 w-full px-3 py-1.5 text-[12px]"
                            disabled={running}
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            type="button"
                            onClick={handleRun}
                            disabled={running || !urlA.trim() || !urlB.trim()}
                            className="geo-btn geo-btn-vio w-full whitespace-nowrap px-4 py-1.5 text-[12px] disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
                        >
                            {running ? 'Comparaison en cours…' : 'Lancer la comparaison'}
                        </button>
                    </div>
                </div>
                <p className="mt-2 text-[10.5px] text-white/40">
                    Les deux sites sont explorés en parallèle (~60–120 s). Rien n'est enregistré : cette comparaison ne remplace pas un audit client officiel.
                </p>
                {error && (
                    <p className="mt-2 rounded-md border border-red-400/20 bg-red-400/[0.05] px-3 py-2 text-[11px] text-red-300">
                        {error}
                    </p>
                )}
            </div>

            {result?.siteA && result?.siteB ? (
                <>
                    <ComparisonPanel
                        siteA={result.siteA}
                        siteB={result.siteB}
                        labelA="Site A (dry-run)"
                        labelB="Site B (dry-run)"
                    />
                    <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] px-3 py-2 text-[10.5px] text-white/40">
                        Durée totale : {formatMs(result.totalDurationMs)} · LLM non exécuté (par conception).
                    </div>
                </>
            ) : (
                <LabEmptyState
                    title="Aucune comparaison pour l'instant"
                    description="Saisissez deux URLs et lancez la comparaison pour voir les écarts en direct."
                />
            )}
        </div>
    );
}

/* =========================================================================
 * Section wrapper
 * ========================================================================= */

export default function AuditLabComparison({ clientId, currentAudit, defaultUrl, omitSectionHeader = false }) {
    const [mode, setMode] = useState('history');

    return (
        <section className={omitSectionHeader ? 'space-y-4' : 'rounded-2xl border border-white/[0.10] bg-gradient-to-br from-white/[0.04] via-white/[0.01] to-transparent p-5'}>
            {!omitSectionHeader && (
                <LabSectionHeader
                    eyebrow="Comparaison d'audits"
                    title="Lire les écarts entre deux audits ou deux sites"
                    subtitle="Score Trouvable, SEO, GEO, couverture de crawl, dimensions, problèmes et points forts — côte à côte. Trois modes selon le besoin : évolution du mandat, benchmark externe, comparaison libre."
                    right={<LabPill label="lecture comparée" tone="info" />}
                />
            )}

            <div className="mb-4 flex flex-wrap gap-1.5">
                {MODES.map((tab) => {
                    const isActive = mode === tab.key;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setMode(tab.key)}
                            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                                isActive
                                    ? 'border-violet-400/40 bg-violet-400/[0.08] text-violet-100'
                                    : 'border-white/[0.08] bg-white/[0.015] text-white/60 hover:text-white/85'
                            }`}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {mode === 'history' && <HistoryMode clientId={clientId} currentAudit={currentAudit} />}
            {mode === 'benchmark' && <BenchmarkMode currentAudit={currentAudit} />}
            {mode === 'dry-run' && <DryRunMode defaultUrlA={defaultUrl || currentAudit?.source_url || ''} />}
        </section>
    );
}
