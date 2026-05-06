'use client';

import { ProvenancePill } from '@/components/shared/metrics/ProvenancePill';
import { getUnifiedProblemModel } from '@/features/admin/dashboard/dossier/audit-lab/audit-lab-model';

import IssueQuickAction from '@/features/admin/dashboard/shared/components/IssueQuickAction';

import { Pill } from './audit-helpers';

/**
 * Problèmes prioritaires — hiérarchie de sévérité.
 *
 * Fix de cohérence (2026-04) : la section "Problèmes prioritaires" ne peut
 * plus afficher « Aucun problème majeur » tant qu'il reste des échecs ou
 * avertissements dans l'audit. Elle s'appuie désormais sur le modèle unifié
 * `getUnifiedProblemModel` qui fusionne :
 *   - `audit.issues` (tagués par le moteur de scoring v2)
 *   - les checks Layer 1 `fail`/`warn` non déjà couverts par un issue
 *
 * Hiérarchie affichée :
 *   - Bloquants  : critical / high + Layer 1 fail de poids fort
 *   - Importants : medium + Layer 1 fail/warn de poids standard
 *   - À surveiller : low + Layer 1 warn
 *
 * Messages d'en-tête garantis cohérents avec ce que la page affiche plus bas.
 */

function SlotBadge({ slot }) {
    const meta = slot === 'blocking'
        ? { label: 'Bloquant', tone: 'bg-red-500/15 text-red-300 border-red-400/30' }
        : slot === 'important'
        ? { label: 'Important', tone: 'bg-amber-500/15 text-amber-200 border-amber-400/30' }
        : { label: 'À surveiller', tone: 'bg-white/[0.08] text-white/60 border-white/15' };
    return <Pill label={meta.label} tone={meta.tone} />;
}

function SourceBadge({ source, provenance }) {
    if (source === 'layer1') {
        return <Pill label="Scan Layer 1" tone="bg-white/[0.05] text-white/55 border-white/10" />;
    }
    if (provenance === 'derived') {
        return <Pill label="Dérivé" tone="bg-white/[0.05] text-white/55 border-white/10" />;
    }
    return null;
}

function ProblemCard({ problem, clientId }) {
    const isBlocking = problem.slot === 'blocking';
    const isImportant = problem.slot === 'important';

    const cardClass = isBlocking
        ? 'bg-gradient-to-r from-red-500/[0.08] to-transparent border-l-[3px] border-l-red-400/70 border-t border-r border-b border-t-white/[0.06] border-r-white/[0.06] border-b-white/[0.06]'
        : isImportant
        ? 'bg-gradient-to-r from-amber-500/[0.05] to-transparent border-l-[3px] border-l-amber-400/50 border-t border-r border-b border-t-white/[0.06] border-r-white/[0.06] border-b-white/[0.06]'
        : 'border bg-white/[0.025] border-white/[0.06]';

    const problemRef = clientId
        ? {
            source: 'audit_priority_problem',
            clientId,
            issueId: problem.source === 'issue' ? problem.id : null,
            checkId: problem.source === 'layer1' ? (problem.checkId || problem.id?.replace(/^layer1:/, '')) : null,
            pageUrl: problem.pageUrl || problem.sourceUrl || null,
            dimension: problem.dimension || null,
            category: problem.category || null,
            label: problem.title,
        }
        : null;

    return (
        <div className={`flex items-start gap-3 rounded-xl px-4 py-3 ${cardClass}`}>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-white/92">{problem.title}</span>
                    <SlotBadge slot={problem.slot} />
                    {problem.category && (
                        <Pill label={problem.category} tone="bg-white/[0.05] text-white/55 border-white/10" />
                    )}
                    <SourceBadge source={problem.source} provenance={problem.provenance} />
                </div>
                {problem.description && (
                    <p className="mt-1 text-xs leading-relaxed text-white/55 line-clamp-2">{problem.description}</p>
                )}
                {problem.recommendedFix && (
                    <p className="mt-1 text-[11px] leading-relaxed text-white/45 line-clamp-2">
                        <span className="text-white/60">Action :</span> {problem.recommendedFix}
                    </p>
                )}
                {problem.provenance && problem.source === 'issue' && (
                    <div className="mt-1.5">
                        <ProvenancePill value={problem.provenance} />
                    </div>
                )}
            </div>
            {problemRef ? (
                <IssueQuickAction
                    problemRef={problemRef}
                    label="Prompt IA"
                    variant="primary"
                    size="xs"
                    className="mt-1 shrink-0"
                />
            ) : null}
        </div>
    );
}

function HeadlineBadge({ totals }) {
    const toneClass = totals.blocking > 0
        ? 'bg-red-500/15 text-red-300 border-red-400/30'
        : totals.important > 0
        ? 'bg-amber-500/15 text-amber-200 border-amber-400/30'
        : totals.watch > 0
        ? 'bg-white/[0.08] text-white/70 border-white/15'
        : 'bg-emerald-500/10 text-emerald-300 border-emerald-400/20';

    const label = totals.blocking > 0
        ? `${totals.blocking} bloquant${totals.blocking > 1 ? 's' : ''}`
        : totals.important > 0
        ? `${totals.important} important${totals.important > 1 ? 's' : ''}`
        : totals.watch > 0
        ? `${totals.watch} à surveiller`
        : 'tout est bon';

    return <Pill label={label} tone={toneClass} />;
}

export default function AuditPriorityProblems({ audit, maxVisible = 6, clientId = null }) {
    const model = getUnifiedProblemModel(audit);
    const { blocking, important, watch, headline, subheadline, totals } = model;
    const resolvedClientId = clientId || audit?.client_id || null;

    const ordered = [...blocking, ...important, ...watch];
    const visible = ordered.slice(0, maxVisible);
    const remaining = ordered.length - visible.length;

    return (
        <div className="cmd-surface p-5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-base font-bold text-white/95">Problèmes prioritaires</div>
                    <div className="mt-0.5 text-[12px] font-semibold text-white/75">{headline}</div>
                    <div className="mt-0.5 text-[11px] text-white/50">{subheadline}</div>
                </div>
                <HeadlineBadge totals={totals} />
            </div>

            {visible.length === 0 ? (
                <p className="mt-3 text-xs text-white/50">
                    Aucun problème — ni bloquant, ni important, ni à surveiller — n&apos;a été détecté sur ce dernier audit.
                </p>
            ) : (
                <div className="mt-4 space-y-2">
                    {visible.map((problem) => (
                        <ProblemCard key={problem.id} problem={problem} clientId={resolvedClientId} />
                    ))}
                </div>
            )}

            {remaining > 0 && (
                <p className="mt-3 text-[11px] text-white/35">
                    + {remaining} problème{remaining > 1 ? 's' : ''} supplémentaire{remaining > 1 ? 's' : ''} non affiché{remaining > 1 ? 's' : ''} ici.
                </p>
            )}

            {totals.total > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2 text-[10.5px] text-white/45">
                    <span className="text-white/60">Répartition :</span>
                    <span className="inline-flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                        <span>{totals.blocking} bloquant{totals.blocking > 1 ? 's' : ''}</span>
                    </span>
                    <span className="text-white/15">·</span>
                    <span className="inline-flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                        <span>{totals.important} important{totals.important > 1 ? 's' : ''}</span>
                    </span>
                    <span className="text-white/15">·</span>
                    <span className="inline-flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                        <span>{totals.watch} à surveiller</span>
                    </span>
                </div>
            )}
        </div>
    );
}
