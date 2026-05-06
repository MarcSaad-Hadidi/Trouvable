// @ts-nocheck
'use client';

import { useState, useMemo } from 'react';
import {
    CommandHeader,
    CommandPageShell,
    CommandMetricCard,
    cn,
} from '@/features/admin/dashboard/shared/components/command';
import { COMMAND_BUTTONS, COMMAND_PANEL, COMMAND_SURFACE } from '@/lib/tokens';
import { CumulativeModelVisibilityChart } from '@/features/admin/dashboard/geo/components/GeoRealCharts';
import { GeoEmptyPanel, GeoModelAvatar, GeoProvenancePill } from '@/features/admin/dashboard/geo/components/GeoPremium';
import { useGeoClient, useGeoWorkspaceSlice } from '@/features/admin/dashboard/shared/context/ClientContext';
import { FlaskConicalIcon, LayersIcon, BarChart3Icon } from 'lucide-react';

async function parseJsonResponse(response) {
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(json.error || `Erreur ${response.status}`);
    }
    return json;
}

function formatDateTime(value) {
    if (!value) return '-';
    try {
        return new Date(value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
        return '-';
    }
}

function formatDisplayModelName(label, fallback) {
    const source = String(label || fallback || '').trim();
    const simplified = source.replace(/\s*\([^)]*\)/g, '').trim();
    return simplified || source;
}

export default function GeoModelesView() {
    const { clientId, invalidateWorkspace } = useGeoClient();
    const { data, loading, error } = useGeoWorkspaceSlice('models');
    const [benchmarkRunning, setBenchmarkRunning] = useState(false);
    const [benchmarkNotice, setBenchmarkNotice] = useState(null);
    const [benchmarkError, setBenchmarkError] = useState(null);
    const [selectedVariants, setSelectedVariants] = useState(null);

    const variantsCatalog = data?.benchmark?.variantsCatalog || [];

    const allModels = useMemo(() => {
        if (!data) return [];
        const observed = data?.modelPerformance || [];
        const variants = data?.benchmark?.variantsCatalog || [];
        const sessions = data?.benchmark?.sessions || [];

        const observedMap = new Map();
        for (const row of observed) {
            observedMap.set(`${row.provider}|||${row.model}`, row);
        }

        const benchmarkVariantMap = new Map();
        for (const session of sessions) {
            for (const row of session.rows || []) {
                const key = row.engine_variant || `${row.provider}|||${row.model}`;
                if (!benchmarkVariantMap.has(key)) {
                    benchmarkVariantMap.set(key, {
                        runs: 0,
                        targetFound: 0,
                        sources: 0,
                        runtimeProvider: row.provider || null,
                        runtimeModel: row.model || null,
                    });
                }
                const agg = benchmarkVariantMap.get(key);
                const history = Array.isArray(row.history) && row.history.length > 0 ? row.history : [row];

                for (const attempt of history) {
                    agg.runs += 1;
                    if (attempt.target_found) agg.targetFound += 1;
                    agg.sources += attempt.citations || 0;
                }

                if (row.provider) agg.runtimeProvider = row.provider;
                if (row.model) agg.runtimeModel = row.model;
            }
        }

        const merged = [];
        const seen = new Set();

        for (const variant of variants) {
            const key = `${variant.provider}|||${variant.model}`;
            if (seen.has(key)) continue;
            seen.add(key);

            const obs = observedMap.get(key);
            const bench = benchmarkVariantMap.get(variant.id);
            const totalRuns = (obs?.runs ?? 0) + (bench?.runs ?? 0);
            const totalTargetFound = (obs?.targetFound ?? 0) + (bench?.targetFound ?? 0);
            const totalSources = (obs?.sources ?? 0) + (bench?.sources ?? 0);

            merged.push({
                provider: variant.provider,
                model: variant.model,
                label: variant.label,
                runs: totalRuns,
                targetFound: totalTargetFound,
                targetRatePercent: totalRuns > 0 ? Math.round((totalTargetFound / totalRuns) * 100) : 0,
                sources: totalSources,
                hasData: !!(obs || bench),
                productionRuns: obs?.runs ?? 0,
                benchmarkRuns: bench?.runs ?? 0,
                benchmarkRuntimeProvider: bench?.runtimeProvider ?? null,
                benchmarkRuntimeModel: bench?.runtimeModel ?? null,
            });
        }

        for (const row of observed) {
            const key = `${row.provider}|||${row.model}`;
            if (!seen.has(key)) {
                seen.add(key);
                const totalRuns = row.runs;
                merged.push({
                    ...row,
                    label: null,
                    runs: totalRuns,
                    targetFound: row.targetFound,
                    targetRatePercent: totalRuns > 0 ? Math.round((row.targetFound / totalRuns) * 100) : row.targetRatePercent,
                    sources: row.sources,
                    hasData: true,
                    productionRuns: row.runs,
                    benchmarkRuns: 0,
                });
            }
        }

        return merged.sort((a, b) => {
            if (a.hasData !== b.hasData) return a.hasData ? -1 : 1;
            return b.runs - a.runs;
        });
    }, [data]);

    const selected = useMemo(() => {
        const defaults = variantsCatalog.map((item) => item.id);
        if (!selectedVariants) return defaults;
        const safe = selectedVariants.filter((id) => defaults.includes(id));
        return safe.length > 0 ? safe : defaults;
    }, [variantsCatalog, selectedVariants]);

    async function runBenchmark() {
        if (!clientId || benchmarkRunning) return;
        setBenchmarkRunning(true);
        setBenchmarkError(null);
        setBenchmarkNotice(null);
        try {
            const response = await fetch('/api/admin/queries/benchmark', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId,
                    variants: selected,
                }),
            });
            const json = await parseJsonResponse(response);
            setBenchmarkNotice(`Test lancé: ${json.benchmarkSessionId.slice(0, 8)}`);
            invalidateWorkspace();
        } catch (runError) {
            setBenchmarkError(runError.message);
        } finally {
            setBenchmarkRunning(false);
        }
    }

    function toggleVariant(id) {
        setSelectedVariants((current) => {
            const base = Array.isArray(current) ? current : variantsCatalog.map((item) => item.id);
            if (base.includes(id)) {
                const next = base.filter((item) => item !== id);
                return next.length > 0 ? next : base;
            }
            return [...base, id];
        });
    }

    const header = (
        <CommandHeader
            eyebrow="IA / GEO Experimental"
            title="Laboratoire Modèles"
            subtitle="Analyse de performance multi-modèles et banc d'essai des variantes d'exécution."
            actions={(
                <div className="flex gap-2">
                    <GeoProvenancePill meta={data?.provenance?.observed} />
                    <button 
                        onClick={runBenchmark}
                        disabled={benchmarkRunning}
                        className={COMMAND_BUTTONS.primary}
                    >
                        <FlaskConicalIcon className={cn("h-4 w-4", benchmarkRunning && "animate-pulse")} />
                        {benchmarkRunning ? 'Test...' : 'Lancer Bench'}
                    </button>
                </div>
            )}
        />
    );

    if (loading) return <CommandPageShell header={header}><div className="p-8 animate-pulse text-white/50">Lecture du registre des modèles...</div></CommandPageShell>;
    if (error || !data) return <CommandPageShell header={header}><GeoEmptyPanel title="Données indisponibles" description={error || "Impossible de charger le laboratoire."} /></CommandPageShell>;

    return (
        <CommandPageShell header={header}>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <CommandMetricCard label="Top Rate" value={`${allModels[0]?.targetRatePercent || 0}%`} detail="Meilleur modèle" tone="ok" />
                <CommandMetricCard label="Leader" value={formatDisplayModelName(allModels[0]?.label, allModels[0]?.model)} detail="Recommandé" tone="info" />
                <CommandMetricCard label="Audités" value={allModels.filter(m => m.hasData).length} detail="Sur catalogue" tone="neutral" />
                <CommandMetricCard label="Sessions" value={data.benchmark?.sessions?.length || 0} detail="Expériences" tone="neutral" />
            </div>

            <div className="mt-2 grid grid-cols-1 gap-4 lg:grid-cols-12 h-[calc(100vh-280px)] min-h-[600px]">
                <div className="lg:col-span-8 flex flex-col gap-4 overflow-y-auto geo-scrollbar pb-10">
                    <div className={cn(COMMAND_PANEL, "p-8 bg-[#06070a]")}>
                        <div className="flex items-center gap-2 mb-8 text-[#7c6aef]">
                            <BarChart3Icon className="h-4 w-4" />
                            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em]">Performance de Production</h3>
                        </div>
                        <CumulativeModelVisibilityChart
                            recentQueryRuns={data.recentQueryRuns}
                            title="Tendance de détection cible"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {allModels.map((row, index) => (
                            <div key={`${row.provider}-${row.model}`} className={cn(COMMAND_SURFACE, "p-6 flex flex-col bg-[#06070a] group hover:border-[#7c6aef]/30 transition-all")}>
                                <div className="flex justify-between items-start mb-6">
                                    <GeoModelAvatar label={row.provider} />
                                    <div className={cn("px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border", row.hasData ? "border-emerald-500/20 text-emerald-400 bg-emerald-500/5" : "border-white/5 text-white/20")}>
                                        {row.hasData ? 'Active' : 'Untested'}
                                    </div>
                                </div>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-white/20 mb-1">{row.provider}</div>
                                <div className="text-[15px] font-bold text-white mb-6 italic">"{formatDisplayModelName(row.label, row.model)}"</div>
                                
                                {row.hasData ? (
                                    <div className="mt-auto grid grid-cols-3 gap-4 pt-6 border-t border-white/5">
                                        <div>
                                            <div className="text-[9px] font-bold uppercase text-white/20">ROI</div>
                                            <div className="text-[16px] font-bold text-emerald-400">{row.targetRatePercent}%</div>
                                        </div>
                                        <div>
                                            <div className="text-[9px] font-bold uppercase text-white/20">Runs</div>
                                            <div className="text-[16px] font-bold text-white/60">{row.runs}</div>
                                        </div>
                                        <div>
                                            <div className="text-[9px] font-bold uppercase text-white/20">Sources</div>
                                            <div className="text-[16px] font-bold text-white/60">{row.sources}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-auto pt-6 border-t border-white/5 text-[10px] text-white/10 uppercase tracking-widest font-bold">
                                        Aucune donnée disponible
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto geo-scrollbar pb-10">
                    <div className={cn(COMMAND_PANEL, "p-8 bg-[#06070a]")}>
                        <div className="flex items-center gap-2 mb-8 text-[#7c6aef]">
                            <FlaskConicalIcon className="h-4 w-4" />
                            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em]">Expérimentation</h3>
                        </div>
                        <div className="space-y-6">
                            <p className="text-[12px] text-white/40 leading-relaxed uppercase tracking-widest font-bold">Variantes en catalogue</p>
                            <div className="flex flex-wrap gap-2">
                                {variantsCatalog.map((v) => (
                                    <button 
                                        key={v.id} 
                                        onClick={() => toggleVariant(v.id)}
                                        className={cn("px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all", selected.includes(v.id) ? "bg-[#7c6aef]/10 border-[#7c6aef]/40 text-[#b8adff]" : "bg-white/5 border-white/5 text-white/20")}
                                    >
                                        {v.id}
                                    </button>
                                ))}
                            </div>
                            {benchmarkNotice && <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-[11px] text-emerald-400 font-bold uppercase tracking-widest">{benchmarkNotice}</div>}
                            {benchmarkError && <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/10 text-[11px] text-rose-300 font-bold uppercase tracking-widest">{benchmarkError}</div>}
                        </div>
                    </div>

                    <div className={cn(COMMAND_PANEL, "p-8 bg-[#06070a]")}>
                        <div className="flex items-center gap-2 mb-8 text-white/20">
                            <LayersIcon className="h-4 w-4" />
                            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em]">Journal des Sessions</h3>
                        </div>
                        <div className="space-y-4">
                            {data.benchmark?.sessions?.map((session) => (
                                <div key={session.id} className={cn(COMMAND_SURFACE, "p-5 space-y-4")}>
                                    <div className="flex items-center justify-between">
                                        <div className="text-[11px] font-bold text-white/60">ID: {session.id.slice(0, 8)}</div>
                                        <div className="text-[10px] text-white/20">{formatDateTime(session.created_at)}</div>
                                    </div>
                                    <div className="space-y-2">
                                        {(session.rows || []).slice(0, 3).map((row, i) => (
                                            <div key={i} className="flex items-center justify-between text-[10px] border-b border-white/5 pb-2">
                                                <span className="text-white/40 uppercase tracking-widest">{row.engine_variant}</span>
                                                <span className={row.target_found ? "text-emerald-400" : "text-rose-400"}>{row.target_found ? 'CIBLE OK' : 'MISS'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {data.benchmark?.sessions?.length === 0 && <p className="text-[11px] text-white/10 italic text-center">Aucune session active.</p>}
                        </div>
                    </div>
                </div>
            </div>
        </CommandPageShell>
    );
}
