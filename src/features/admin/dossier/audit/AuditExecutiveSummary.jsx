'use client';

import { Pill, getScoreTone } from './audit-helpers';

const GEO_LEVEL_META = {
    strong: { label: 'Fort', tone: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20' },
    moderate: { label: 'Modéré', tone: 'bg-amber-400/10 text-amber-200 border-amber-400/20' },
    weak: { label: 'Faible', tone: 'bg-red-400/10 text-red-300 border-red-400/20' },
    unclear: { label: 'Indéterminé', tone: 'bg-white/[0.05] text-white/55 border-white/10' },
};

export default function AuditExecutiveSummary({ audit }) {
    const aiAnalysis = audit?.geo_breakdown?.ai_analysis || null;
    if (!aiAnalysis) return null;

    const geoLevel = GEO_LEVEL_META[aiAnalysis.geo_recommendability] || GEO_LEVEL_META.unclear;
    const llmScore = typeof aiAnalysis.llm_comprehension_score === 'number' ? aiAnalysis.llm_comprehension_score : null;

    return (
        <div className="cmd-surface p-5">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-base font-bold text-white/95"><span className="text-violet-400">✦</span> Synthèse IA</div>
                    <div className="mt-0.5 text-[11px] text-white/40">Analyse générée par intelligence artificielle</div>
                </div>
                <div className="flex items-center gap-2">
                    <Pill
                        label={aiAnalysis.status === 'available' ? 'Généré' : 'Solution de repli'}
                        tone={aiAnalysis.status === 'available'
                            ? 'bg-amber-400/10 text-amber-200 border-amber-400/20'
                            : 'bg-white/[0.05] text-white/55 border-white/10'}
                    />
                </div>
            </div>

            {aiAnalysis.business_summary && (
                <div className="mt-3 border-l-2 border-violet-400/25 pl-4">
                    <p className="text-sm leading-[1.7] text-white/75">{aiAnalysis.business_summary}</p>
                </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-transparent p-3">
                    <div className="text-[11px] font-bold uppercase text-white/40">Recommandabilité GEO</div>
                    <div className="mt-1.5 flex items-center gap-2">
                        <Pill label={geoLevel.label} tone={geoLevel.tone} />
                    </div>
                </div>

                {llmScore != null && (
                    <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-transparent p-3">
                        <div className="text-[11px] font-bold uppercase text-white/40">Compréhension LLM</div>
                        <div className="mt-1.5 flex items-baseline gap-1">
                            <span className={`text-2xl font-extrabold tabular-nums ${getScoreTone(Math.round(llmScore / 15 * 100))}`}>{llmScore}</span>
                            <span className="text-xs text-white/25">/15</span>
                        </div>
                        <div className="mt-1.5 h-1 w-16 rounded-full bg-white/[0.06] overflow-hidden">
                            <div className={`h-full rounded-full ${llmScore >= 10 ? 'bg-emerald-400' : llmScore >= 6 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${Math.round(llmScore / 15 * 100)}%` }} />
                        </div>
                    </div>
                )}

                {aiAnalysis.answerability_summary && (
                    <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-transparent p-3">
                        <div className="text-[11px] font-bold uppercase text-white/40">Capacité à répondre</div>
                        <p className="mt-1.5 text-xs leading-relaxed text-white/60">{aiAnalysis.answerability_summary}</p>
                    </div>
                )}
            </div>

            {aiAnalysis.geo_recommendability_rationale && (
                <p className="mt-4 text-xs leading-relaxed text-white/50">{aiAnalysis.geo_recommendability_rationale}</p>
            )}
        </div>
    );
}
