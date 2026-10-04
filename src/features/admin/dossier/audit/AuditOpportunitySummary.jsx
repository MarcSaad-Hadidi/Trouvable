'use client';

import { ProvenancePill } from '@/components/shared/metrics/ProvenancePill';
import { getOpportunityModel } from '@/features/admin/dossier/audit-lab/audit-lab-model';

import { Pill } from './audit-helpers';

/**
 * Opportunités détectées — redesign orienté action (2026-04).
 *
 * Historiquement, cette section affichait en vrac les `strengths` de l'audit
 * (observations positives) sans les rendre actionnables. Elle est désormais
 * construite à partir du modèle d'opportunités unifié qui :
 *
 *   - classe chaque opportunité en famille (gains rapides, SEO, GEO,
 *     contenu & citation, confiance & entité) ;
 *   - explique quoi a été détecté, pourquoi ça compte, quoi faire ensuite,
 *     l'impact attendu et l'effort estimé.
 *
 * Les `strengths` deviennent des "leviers" (un signal existe déjà, on peut
 * l'amplifier). Les `issues` deviennent des "manques" (correctifs à faire).
 */

function ImpactPill({ value }) {
    const meta =
        value === 'fort'
            ? { tone: 'bg-emerald-400/15 text-emerald-200 border-emerald-400/25', label: 'Impact fort' }
            : value === 'moyen'
              ? { tone: 'bg-sky-400/10 text-sky-200 border-sky-400/20', label: 'Impact moyen' }
              : { tone: 'bg-white/[0.05] text-white/55 border-white/10', label: 'Impact variable' };
    return <Pill label={meta.label} tone={meta.tone} />;
}

function EffortPill({ value }) {
    const meta =
        value === 'faible'
            ? { tone: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20', label: 'Effort faible' }
            : value === 'moyen'
              ? { tone: 'bg-amber-400/10 text-amber-200 border-amber-400/20', label: 'Effort moyen' }
              : { tone: 'bg-rose-400/10 text-rose-200 border-rose-400/20', label: 'Effort élevé' };
    return <Pill label={meta.label} tone={meta.tone} />;
}

function KindPill({ kind }) {
    return kind === 'gap' ? (
        <Pill label="Manque" tone="bg-red-400/10 text-red-200 border-red-400/20" />
    ) : (
        <Pill label="Levier" tone="bg-emerald-400/10 text-emerald-300 border-emerald-400/20" />
    );
}

function OpportunityCard({ opportunity }) {
    return (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
            <div className="flex flex-wrap items-center gap-1.5">
                <KindPill kind={opportunity.kind} />
                <span className="text-sm font-semibold text-white/92">{opportunity.title}</span>
            </div>

            <div className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed">
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-white/40">Détecté</span>
                    <p className="text-white/75 line-clamp-2">{opportunity.detected}</p>
                </div>
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-white/40">Pourquoi</span>
                    <p className="text-white/65 line-clamp-2">{opportunity.why}</p>
                </div>
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-violet-300/70">Action</span>
                    <p className="text-white/80 line-clamp-2">{opportunity.action}</p>
                </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <ImpactPill value={opportunity.expectedImpact} />
                <EffortPill value={opportunity.effort} />
                {opportunity.provenance && <ProvenancePill value={opportunity.provenance} />}
            </div>
        </div>
    );
}

function FamilyBlock({ family, maxItems }) {
    const visible = family.items.slice(0, maxItems);
    const remaining = family.items.length - visible.length;

    return (
        <div className={`rounded-2xl border p-4 ${family.accent}`}>
            <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                    <div className={`text-[10px] font-bold uppercase tracking-[0.1em] ${family.accentText}`}>
                        {family.label}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-white/50">{family.description}</p>
                </div>
                <Pill
                    label={`${family.items.length} ${family.items.length > 1 ? 'leviers' : 'levier'}`}
                    tone="bg-white/[0.05] text-white/60 border-white/10"
                />
            </div>
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                {visible.map((opp, idx) => (
                    <OpportunityCard key={`${family.key}-${idx}`} opportunity={opp} />
                ))}
            </div>
            {remaining > 0 && (
                <p className="mt-2 text-[10.5px] text-white/40">
                    + {remaining} opportunité{remaining > 1 ? 's' : ''} supplémentaire{remaining > 1 ? 's' : ''} dans
                    cette famille.
                </p>
            )}
        </div>
    );
}

export default function AuditOpportunitySummary({ audit, maxItemsPerFamily = 4 }) {
    const model = getOpportunityModel(audit);
    if (!model.hasAny) return null;

    return (
        <div className="cmd-surface p-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-base font-bold text-white/95">Opportunités détectées</div>
                    <div className="mt-0.5 text-[11px] text-white/45">
                        Classées par famille d&apos;action. Chaque carte indique quoi, pourquoi, action, impact et
                        effort.
                    </div>
                </div>
                <Pill
                    label={`${model.totals.total} opportunité${model.totals.total > 1 ? 's' : ''}`}
                    tone="bg-emerald-400/10 text-emerald-300 border-emerald-400/20"
                />
            </div>

            <div className="mt-4 space-y-3">
                {model.families.map((family) => (
                    <FamilyBlock key={family.key} family={family} maxItems={maxItemsPerFamily} />
                ))}
            </div>
        </div>
    );
}
