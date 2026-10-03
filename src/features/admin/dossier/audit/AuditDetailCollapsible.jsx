'use client';

import { useState } from 'react';
import { ProvenancePill } from '@/components/shared/metrics/ProvenancePill';
import {
    toArray,
    normalizeIssue,
    normalizeStrength,
    Pill,
    getPriorityTone,
    getEvidenceStatusMeta,
    getScoreTone,
} from './audit-helpers';

function ScoreCard({ dimension }) {
    const accent = getScoreTone(dimension.score);
    return (
        <div className="rounded-xl border border-white/[0.10] bg-white/[0.04] p-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-white/40">{dimension.label}</div>
            <div className={`mt-1 text-2xl font-extrabold tabular-nums ${accent}`}>
                {dimension.score}<span className="text-sm text-white/25">/100</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
                <Pill label={dimension.applicability} tone="bg-white/[0.05] text-white/55 border-white/10" />
            </div>
            {dimension.summary && <p className="mt-2 text-[11px] leading-relaxed text-white/45">{dimension.summary}</p>}
        </div>
    );
}

export default function AuditDetailCollapsible({ audit }) {
    const [open, setOpen] = useState(false);
    if (!audit) return null;

    const breakdown = audit?.geo_breakdown?.dimensions ? audit.geo_breakdown : audit?.seo_breakdown?.dimensions ? audit.seo_breakdown : null;
    const dimensions = toArray(breakdown?.dimensions);
    const issues = toArray(audit?.issues).map(normalizeIssue);
    const strengths = toArray(audit?.strengths).map(normalizeStrength);
    const pages = toArray(audit?.scanned_pages);
    const renderStats = audit?.extracted_data?.render_stats || null;
    const staticOnlyAudit = renderStats?.audit_strategy === 'static_only';

    return (
        <div className="rounded-2xl border border-dashed border-white/[0.06] bg-white/[0.015]">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex w-full items-center justify-between px-6 py-5 text-left transition-colors hover:bg-white/[0.02]"
            >
                <div>
                    <div className="text-sm font-bold text-white/70">Détails complets de l&apos;audit</div>
                    <div className="mt-0.5 text-[11px] text-white/40">
                        Dimensions, tous les problèmes ({issues.length}), opportunités ({strengths.length}), pages ({pages.length})
                    </div>
                </div>
                <span className={`text-lg text-white/40 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
            </button>

            {open && (
                <div className="space-y-4 border-t border-white/[0.06] p-5">
                    {/* Render mode info */}
                    {renderStats && (
                        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="text-xs font-semibold text-white/70">Mode de rendu</div>
                                <Pill
                                    label={staticOnlyAudit ? 'Statique uniquement' : 'Hybride'}
                                    tone={staticOnlyAudit
                                        ? 'bg-amber-400/10 text-amber-200 border-amber-400/20'
                                        : 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20'}
                                />
                            </div>
                            <p className="mt-1.5 text-[11px] text-white/40">
                                {renderStats.audit_strategy_message
                                    || (staticOnlyAudit
                                        ? 'Rendu navigateur indisponible : couverture limitée au HTML statique.'
                                        : 'Pipeline hybride statique + navigateur.')}
                            </p>
                        </div>
                    )}

                    {/* Dimension score grid */}
                    {dimensions.length > 0 && (
                        <div>
                            <div className="mb-2 text-sm font-bold text-white/70">Scores par dimension</div>
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
                                {dimensions.map((d) => <ScoreCard key={d.key} dimension={d} />)}
                            </div>
                        </div>
                    )}

                    {/* Full issues list */}
                    {issues.length > 0 && (
                        <div>
                            <div className="mb-2 flex items-center gap-2">
                                <span className="text-sm font-bold text-white/70">Tous les problèmes</span>
                                <Pill label={`${issues.length}`} tone="bg-red-400/10 text-red-300 border-red-400/20" />
                            </div>
                            <div className="space-y-2">
                                {issues.map((issue) => {
                                    const ev = getEvidenceStatusMeta(issue.evidence_status);
                                    return (
                                        <div key={issue.id} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="text-xs font-semibold text-white/85">{issue.title}</span>
                                                <Pill label={issue.priority} tone={getPriorityTone(issue.priority)} />
                                                <Pill label={issue.category} tone="bg-white/[0.05] text-white/55 border-white/10" />
                                                <Pill label={ev.label} tone={ev.tone} />
                                                <ProvenancePill value={issue.provenance} />
                                            </div>
                                            <p className="mt-1.5 text-[11px] text-white/50">{issue.description}</p>
                                            {issue.evidence_summary && (
                                                <p className="mt-1 text-[10px] text-white/35">Preuves : {issue.evidence_summary}</p>
                                            )}
                                            {issue.recommended_fix && (
                                                <p className="mt-1 text-[10px] text-white/40">Piste : {issue.recommended_fix}</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Full strengths list */}
                    {strengths.length > 0 && (
                        <div>
                            <div className="mb-2 flex items-center gap-2">
                                <span className="text-sm font-bold text-white/70">Toutes les opportunités</span>
                                <Pill label={`${strengths.length}`} tone="bg-emerald-400/10 text-emerald-300 border-emerald-400/20" />
                            </div>
                            <div className="space-y-2">
                                {strengths.map((s) => (
                                    <div key={s.id} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="text-xs font-semibold text-white/85">{s.title}</span>
                                            <ProvenancePill value={s.provenance} />
                                        </div>
                                        <p className="mt-1.5 text-[11px] text-white/50">{s.description}</p>
                                        {s.evidence_summary && (
                                            <p className="mt-1 text-[10px] text-white/35">Preuve : {s.evidence_summary}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Scanned pages */}
                    {pages.length > 0 && (
                        <div>
                            <div className="mb-2 text-sm font-bold text-white/70">Pages analysées</div>
                            <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                                {pages.map((page, i) => (
                                    <div key={`${page.url}-${i}`} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <Pill
                                                label={page.success ? 'OK' : 'Erreur'}
                                                tone={page.success
                                                    ? 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20'
                                                    : 'bg-amber-400/10 text-amber-200 border-amber-400/20'}
                                            />
                                            <Pill label={page.page_type || 'inconnu'} tone="bg-white/[0.05] text-white/55 border-white/10" />
                                            <span className="text-[10px] text-white/30">{page.status_code || 'n.d.'}</span>
                                        </div>
                                        <div className="mt-1.5 text-[11px] font-medium text-white/65 break-all">{page.url}</div>
                                        {page.error_message && <div className="mt-1 text-[10px] text-red-300">{page.error_message}</div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
