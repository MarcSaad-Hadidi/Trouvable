'use client';

import { getCitabilityActionableModel } from '@/features/admin/dossier/audit-lab/audit-lab-model';

import { extractLlmsTxtStatus, extractCrawlerStatus, getScoreTone, Pill } from './audit-helpers';

/**
 * Citabilité & extractabilité — redesign orienté réécriture (2026-04).
 *
 * La section ne se contente plus d'afficher une liste décorative de blocs.
 * Elle répond explicitement aux trois questions opérateur :
 *   1. Qu'est-ce qui est déjà prêt à être cité ?
 *   2. Qu'est-ce qui est proche de la citation et à pousser en premier ?
 *   3. Qu'est-ce qu'il faut réécrire en priorité, et pourquoi (quel sous-
 *      score tire vers le bas) ?
 *
 * Chaque bloc faible expose son sous-score le plus bas, accompagné d'un
 * conseil de réécriture concret (spécificité, autonomie, densité de
 * réponse, densité factuelle).
 */

function SubScoreBar({ label, value, max = 25, highlight = false }) {
    const pct = Math.min(100, Math.round((value / max) * 100));
    const tone = pct >= 70 ? 'bg-emerald-400' : pct >= 45 ? 'bg-amber-400' : 'bg-red-400';
    return (
        <div className={`flex items-center gap-2 ${highlight ? 'rounded-md bg-white/[0.04] px-2 py-1' : ''}`}>
            <span className={`w-[88px] shrink-0 text-[11px] font-medium ${highlight ? 'text-red-200' : 'text-white/55'}`}>
                {label}
            </span>
            <div className="relative h-[6px] flex-1 rounded-full bg-white/[0.08]">
                <div className={`absolute inset-y-0 left-0 rounded-full ${tone}`} style={{ width: `${pct}%` }} />
            </div>
            <span className={`w-[32px] text-right text-[10px] font-semibold tabular-nums ${pct >= 70 ? 'text-emerald-300/80' : pct >= 45 ? 'text-amber-300/80' : 'text-red-300/80'}`}>
                {value}/{max}
            </span>
        </div>
    );
}

function StatusIndicator({ label, ok }) {
    return (
        <div className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${ok ? 'bg-emerald-400/[0.06] border border-emerald-400/15' : 'bg-amber-400/[0.06] border border-amber-400/15'}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className={`text-[11px] font-medium ${ok ? 'text-emerald-300/80' : 'text-amber-300/80'}`}>{label}</span>
        </div>
    );
}

function StatChip({ label, value, accent }) {
    const accentClass = accent === 'emerald' ? 'text-emerald-300' : accent === 'red' ? 'text-red-300' : accent === 'amber' ? 'text-amber-300' : 'text-white/90';
    const bgClass = accent === 'emerald'
        ? 'bg-emerald-400/[0.07] border-emerald-400/20'
        : accent === 'red'
            ? 'bg-red-400/[0.07] border-red-400/20'
            : accent === 'amber'
                ? 'bg-amber-400/[0.07] border-amber-400/20'
                : 'bg-white/[0.05] border-white/[0.10]';
    return (
        <div className={`rounded-lg px-3.5 py-2 border ${bgClass}`}>
            <span className={`text-lg font-bold tabular-nums ${accentClass}`}>{value}</span>
            <div className="text-[10px] font-bold uppercase tracking-wide text-white/45">{label}</div>
        </div>
    );
}

function ReadyBlockCard({ block }) {
    const score = block.citability_score ?? 0;
    const sub = block.sub_scores || {};
    return (
        <div className="rounded-xl border border-emerald-400/25 bg-gradient-to-r from-emerald-500/[0.08] via-emerald-500/[0.03] to-transparent p-3.5">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="truncate text-[13px] font-bold text-white/95">{block.heading || 'Sans titre'}</div>
                    {block.page_url && (
                        <div className="mt-0.5 truncate text-[10px] text-white/35" title={block.page_url}>{block.page_url}</div>
                    )}
                </div>
                <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-400/15 px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-emerald-300">
                    {score}
                </span>
            </div>
            {block.text_sample && (
                <p className="mt-2 text-[11.5px] leading-relaxed text-white/60 line-clamp-2">{block.text_sample}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5 text-[9.5px] text-white/50">
                <span>Spéc. {sub.specificity ?? 0}/25</span>
                <span>·</span>
                <span>Auto. {sub.self_containment ?? 0}/25</span>
                <span>·</span>
                <span>Rép. {sub.answer_density ?? 0}/25</span>
                <span>·</span>
                <span>Fact. {sub.factual_density ?? 0}/25</span>
            </div>
        </div>
    );
}

function RewriteBlockCard({ block, rank, priority }) {
    const weakest = block._weakest;
    const score = block.citability_score ?? 0;
    const borderClass = priority === 'high'
        ? 'border-red-400/30 bg-gradient-to-r from-red-500/[0.08] via-red-500/[0.03] to-transparent'
        : 'border-amber-400/25 bg-gradient-to-r from-amber-500/[0.06] via-amber-500/[0.02] to-transparent';
    const pillClass = priority === 'high'
        ? 'bg-red-400/15 text-red-300 border-red-400/30'
        : 'bg-amber-400/15 text-amber-300 border-amber-400/30';

    return (
        <div className={`rounded-xl border p-3.5 ${borderClass}`}>
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full border px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${pillClass}`}>
                            #{rank}
                        </span>
                        <span className="truncate text-[13px] font-bold text-white/95">{block.heading || 'Sans titre'}</span>
                    </div>
                    {block.page_url && (
                        <div className="mt-0.5 truncate text-[10px] text-white/35" title={block.page_url}>{block.page_url}</div>
                    )}
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold tabular-nums ${pillClass}`}>
                    {score}
                </span>
            </div>

            {block.text_sample && (
                <p className="mt-2 text-[11px] leading-relaxed text-white/55 line-clamp-2">{block.text_sample}</p>
            )}

            <div className="mt-3 space-y-1.5">
                <SubScoreBar label="Spécificité" value={block.sub_scores?.specificity ?? 0} highlight={weakest?.key === 'specificity'} />
                <SubScoreBar label="Autonomie" value={block.sub_scores?.self_containment ?? 0} highlight={weakest?.key === 'self_containment'} />
                <SubScoreBar label="Densité rép." value={block.sub_scores?.answer_density ?? 0} highlight={weakest?.key === 'answer_density'} />
                <SubScoreBar label="Densité fact." value={block.sub_scores?.factual_density ?? 0} highlight={weakest?.key === 'factual_density'} />
            </div>

            {weakest && weakest.hint && (
                <div className="mt-3 rounded-lg border border-violet-400/20 bg-violet-500/[0.05] px-2.5 py-2">
                    <div className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-violet-300/80">
                        Réécriture suggérée — axe « {weakest.label} »
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-white/75">{weakest.hint}</p>
                </div>
            )}
        </div>
    );
}

export default function AuditCitabilitySection({ audit }) {
    if (!audit) return null;

    const model = getCitabilityActionableModel(audit);
    const llmsStatus = extractLlmsTxtStatus(audit);
    const crawlerStatus = extractCrawlerStatus(audit);

    const hasData = model.hasAny || llmsStatus || crawlerStatus;
    if (!hasData) return null;

    const { ready, close, rewrite, pages, stats } = model;

    return (
        <div className="cmd-surface p-6">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-base font-bold text-white/95">Citabilité &amp; extractabilité</div>
                    <div className="mt-0.5 text-[11px] text-white/45">
                        Blocs prêts à citer, blocs proches du seuil, blocs à réécrire en priorité — avec l&apos;axe faible identifié.
                    </div>
                </div>
                {stats.avgScore != null && (
                    <div className="text-right">
                        <div className="flex items-baseline justify-end gap-1">
                            <span className={`text-3xl font-extrabold tabular-nums ${getScoreTone(stats.avgScore)}`}>{stats.avgScore}</span>
                            <span className="text-sm text-white/30">/100</span>
                        </div>
                        <div className="text-[11px] font-medium text-white/45 mt-0.5">Score moyen des blocs</div>
                    </div>
                )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
                {stats.totalBlocks > 0 && (
                    <>
                        <StatChip label="Blocs analysés" value={stats.totalBlocks} />
                        <StatChip label="Prêts à citer" value={stats.readyCount || 0} accent="emerald" />
                        <StatChip label="Proches du seuil" value={stats.closeCount || 0} accent="amber" />
                        <StatChip label="À réécrire" value={stats.rewriteCount || 0} accent="red" />
                    </>
                )}
                <div className="ml-auto flex flex-wrap items-center gap-2">
                    {crawlerStatus && <StatusIndicator label={crawlerStatus.ok ? 'Crawlers IA OK' : 'Crawlers IA bloqués'} ok={crawlerStatus.ok} />}
                    {llmsStatus && <StatusIndicator label={llmsStatus.found ? 'llms.txt OK' : 'llms.txt manquant'} ok={llmsStatus.found} />}
                </div>
            </div>

            {/* Priority rewrite section — answers "what to fix first" */}
            {rewrite.length > 0 && (
                <div className="mt-5">
                    <div className="mb-2 flex items-center gap-2">
                        <span className="text-xs font-bold text-red-300">À réécrire en priorité</span>
                        <Pill label={`${rewrite.length}`} tone="bg-red-400/10 text-red-300 border-red-400/20" />
                        <span className="text-[10.5px] text-white/40">— axe faible identifié &amp; conseil de réécriture</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                        {rewrite.map((block, idx) => (
                            <RewriteBlockCard
                                key={block.block_id || `${block.page_url}-${block.heading}-${idx}`}
                                block={block}
                                rank={idx + 1}
                                priority="high"
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Close-to-threshold section — answers "what is cheapest to push over the line" */}
            {close.length > 0 && (
                <div className="mt-5">
                    <div className="mb-2 flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-300">Proches du seuil de citation</span>
                        <Pill label={`${close.length}`} tone="bg-amber-400/10 text-amber-200 border-amber-400/20" />
                        <span className="text-[10.5px] text-white/40">— petits ajustements, gain rapide</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                        {close.map((block, idx) => (
                            <RewriteBlockCard
                                key={block.block_id || `${block.page_url}-${block.heading}-${idx}`}
                                block={block}
                                rank={idx + 1}
                                priority="medium"
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Ready-to-cite — answers "what already works" */}
            {ready.length > 0 && (
                <div className="mt-5">
                    <div className="mb-2 flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-300">Blocs prêts à être cités</span>
                        <Pill label={`${ready.length}`} tone="bg-emerald-400/10 text-emerald-300 border-emerald-400/20" />
                    </div>
                    <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                        {ready.map((block, idx) => (
                            <ReadyBlockCard
                                key={block.block_id || `${block.page_url}-${block.heading}-${idx}`}
                                block={block}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Page-level ranking — where to focus the rewrite effort */}
            {pages.length > 0 && (
                <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.015] p-3.5">
                    <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.08em] text-white/45">
                        Pages à prioriser pour la réécriture
                    </div>
                    <div className="space-y-1">
                        {pages.map((page) => (
                            <div
                                key={page.url}
                                className="flex items-center justify-between gap-3 rounded-md border border-white/[0.04] bg-white/[0.015] px-3 py-1.5"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-[11.5px] font-semibold text-white/80" title={page.url}>
                                        {page.url}
                                    </div>
                                    <div className="text-[10px] text-white/40">
                                        {page.totalBlocks} bloc{page.totalBlocks > 1 ? 's' : ''} ·
                                        <span className="ml-1 text-emerald-300/70">{page.highBlocks} citable{page.highBlocks > 1 ? 's' : ''}</span>
                                        <span className="mx-1 text-white/20">·</span>
                                        <span className="text-red-300/70">{page.lowBlocks} faible{page.lowBlocks > 1 ? 's' : ''}</span>
                                    </div>
                                </div>
                                {page.pageScore != null && (
                                    <span className={`shrink-0 text-sm font-bold tabular-nums ${getScoreTone(page.pageScore)}`}>
                                        {page.pageScore}/100
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!model.hasAny && (
                <p className="mt-3 text-xs text-white/40">
                    Aucun bloc n&apos;a été analysé — le site n&apos;expose pas assez de contenu structuré sous des titres clairs pour que la citabilité soit évaluée.
                </p>
            )}
        </div>
    );
}
