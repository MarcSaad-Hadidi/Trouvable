'use client';

import AuditSiteProfile from '@/features/admin/dossier/audit/AuditSiteProfile';
import AuditExecutiveSummary from '@/features/admin/dossier/audit/AuditExecutiveSummary';
import AuditPriorityProblems from '@/features/admin/dossier/audit/AuditPriorityProblems';
import AuditOpportunitySummary from '@/features/admin/dossier/audit/AuditOpportunitySummary';
import AuditCitabilitySection from '@/features/admin/dossier/audit/AuditCitabilitySection';

import { LabEmptyState, LabSectionHeader, LabStableSection } from './LabPrimitives';
import { getFinalStableScores, scoreToneClass } from './audit-lab-model';
import { llmStatusFr } from './audit-lab-copy';

function TrouvableHero({ score, llmStatus }) {
    const toneClass = score != null ? scoreToneClass(score) : 'text-white/25';
    return (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-violet-400/25 bg-gradient-to-br from-violet-500/[0.14] to-violet-600/[0.04] px-8 py-5 shadow-[0_0_32px_rgba(139,92,246,0.15)]">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-violet-200/80">
                Score Trouvable final
            </span>
            <div className="flex items-baseline gap-1.5">
                <span
                    className={`font-['Plus_Jakarta_Sans',sans-serif] text-[56px] font-extrabold leading-none tabular-nums ${toneClass}`}
                >
                    {score != null ? score : '–'}
                </span>
                {score != null && <span className="text-[14px] text-white/40">/100</span>}
            </div>
            <span className="text-[10.5px] text-white/50">vérité produit communiquée au client</span>
            {llmStatus && (
                <span className="mt-0.5 text-[10px] text-white/40">
                    Composante IA : {llmStatusFr(llmStatus) || llmStatus}
                </span>
            )}
        </div>
    );
}

/**
 * Section A — vérité produit Trouvable.
 *
 * Volontairement minimale : un seul score dominant (le score Trouvable final),
 * un résumé exécutif et les actions prioritaires. La lecture SEO vs GEO, le
 * détail des dimensions, et les composantes SEO/GEO individuelles sont
 * traités explicitement dans la Section B (interprétation) pour ne plus
 * mélanger la vérité client avec les lectures internes.
 */
export default function AuditLabStableResult({ audit, clientId = null }) {
    if (!audit) {
        return (
            <LabStableSection>
                <LabSectionHeader
                    eyebrow="Section A · Résultat final Trouvable"
                    title="Aucun audit enregistré pour ce mandat"
                    subtitle="Lancez un audit depuis la section précédente pour obtenir le score Trouvable, les priorités et les points forts."
                    variant="stable"
                />
                <LabEmptyState
                    title="En attente d'un premier audit"
                    description="Le score Trouvable, les problèmes prioritaires et les opportunités apparaîtront ici dès qu'un audit aura été exécuté."
                />
            </LabStableSection>
        );
    }

    const scores = getFinalStableScores(audit);

    return (
        <LabStableSection>
            <LabSectionHeader
                eyebrow="Section A · Résultat final Trouvable"
                title="Score Trouvable — vérité produit"
                subtitle="C'est le seul score à communiquer au client. Les lectures SEO, GEO et les diagnostics internes sont traités plus bas, sans jamais remplacer ce score."
                variant="stable"
            />

            <div className="flex justify-center">
                <TrouvableHero score={scores.finalScore} llmStatus={scores.llmStatus} />
            </div>

            <div className="mt-6 space-y-5">
                <AuditSiteProfile audit={audit} />
                <AuditExecutiveSummary audit={audit} />
                <AuditPriorityProblems audit={audit} clientId={clientId || audit?.client_id || null} />
                <AuditOpportunitySummary audit={audit} />
                <AuditCitabilitySection audit={audit} />
            </div>
        </LabStableSection>
    );
}
