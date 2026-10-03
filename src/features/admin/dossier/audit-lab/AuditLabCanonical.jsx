'use client';

import {
    JsonInspect,
    LabCanonicalSection,
    LabCollapsible,
    LabEmptyState,
    LabMetric,
    LabPill,
    LabSectionHeader,
} from './LabPrimitives';
import { getCanonicalViewModel, scoreToneClass } from './audit-lab-model';
import { llmStatusFr } from './audit-lab-copy';

function EvidenceList({ label, items, max = 6 }) {
    if (!Array.isArray(items) || items.length === 0) return null;
    return (
        <div className="rounded-lg border border-white/[0.05] bg-white/[0.015] p-3">
            <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/45">{label}</div>
                <span className="text-[10px] text-white/35">{items.length}</span>
            </div>
            <ul className="mt-1.5 space-y-0.5">
                {items.slice(0, max).map((item, idx) => (
                    <li key={idx} className="truncate font-mono text-[11px] text-white/65" title={typeof item === 'string' ? item : JSON.stringify(item)}>
                        {typeof item === 'string' ? item : item?.name || item?.value || item?.url || JSON.stringify(item)}
                    </li>
                ))}
                {items.length > max && (
                    <li className="text-[10px] text-white/35">+ {items.length - max} autres</li>
                )}
            </ul>
        </div>
    );
}

function renderWeightProfile(weightProfile) {
    if (!weightProfile) return null;
    if (typeof weightProfile === 'string') return weightProfile;
    if (typeof weightProfile !== 'object') return String(weightProfile);
    const entries = Object.entries(weightProfile);
    if (entries.length === 0) return null;
    return entries
        .map(([key, value]) => `${key}=${typeof value === 'number' ? value : JSON.stringify(value)}`)
        .join(' · ');
}

function renderReasonText(reason) {
    if (!reason) return null;
    if (typeof reason === 'string') return reason;
    if (typeof reason === 'object') {
        return reason.label || reason.title || reason.evidence || reason.type || JSON.stringify(reason);
    }
    return String(reason);
}

function ClassificationCard({ classification }) {
    if (!classification) return null;
    const weightProfileText = renderWeightProfile(classification.weight_profile);
    return (
        <div className="rounded-lg border border-violet-400/[0.12] bg-violet-500/[0.02] p-3">
            <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-violet-300/70">Classification du site</div>
                {classification.confidence && <LabPill label={`Confiance : ${classification.confidence}`} tone="info" />}
            </div>
            <div className="mt-1.5 text-sm font-bold text-white/90">{classification.label || classification.type || '—'}</div>
            {weightProfileText && (
                <div className="mt-1 text-[10px] text-white/45">
                    Profil de pondération :
                    <span className="ml-1 font-mono text-[10px] text-white/60">{weightProfileText}</span>
                </div>
            )}
            {Array.isArray(classification.reasons) && classification.reasons.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-[11px] text-white/55">
                    {classification.reasons.slice(0, 4).map((reason, idx) => {
                        const text = renderReasonText(reason);
                        if (!text) return null;
                        return <li key={idx}>• {text}</li>;
                    })}
                </ul>
            )}
        </div>
    );
}

/**
 * Section 5 — Canonical / normalized object (Layer 3 + Layer 4 surface).
 *
 * Structured presentation of `extracted_data.layered_v1` so the operator can
 * audit the normalized truth, the classification and the final score mapping
 * BEFORE dropping into raw JSON. This is the "internal source of truth" view
 * for the layered architecture, clearly differentiated from the stable
 * product result hero above.
 */
export default function AuditLabCanonical({ audit }) {
    const model = getCanonicalViewModel(audit);

    if (!model.hasAny) {
        return (
            <LabCanonicalSection>
                <LabSectionHeader
                    eyebrow="Section F · Vérité normalisée interne"
                    title="Aucune structure normalisée"
                    subtitle="La représentation normalisée des couches 3 et 4 n'est pas disponible pour ce dernier audit."
                    variant="canonical"
                />
                <LabEmptyState
                    title="Objet normalisé absent"
                    description="Cet audit a été produit sans le pipeline complet. Le résultat Trouvable affiché plus haut reste valide — la vue normalisée sert surtout à la validation opérateur."
                />
            </LabCanonicalSection>
        );
    }

    const { canonical, schema, target, classification, normalizedEvidence, finalScore, dashboardReportingFields, recommendations, subsystemScores } = model;

    return (
        <LabCanonicalSection>
            <LabSectionHeader
            eyebrow="Section F · Vérité normalisée interne"
            title="Vérité normalisée & détail du score Trouvable"
                subtitle="Représentation opérateur de la structure interne (couches 3 et 4) qui alimente le score final. Cette vue existe pour valider la chaîne — elle ne remplace jamais ce qui est affiché en section 2."
                variant="canonical"
                right={schema?.audit_version && <LabPill label={schema.audit_version} tone="info" />}
            />

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <LabMetric label="Score hybride" value={finalScore?.hybrid_score ?? '—'} suffix={finalScore?.hybrid_score != null ? '/100' : null} tone={scoreToneClass(finalScore?.hybrid_score)} />
                <LabMetric label="Score déterministe" value={finalScore?.deterministic_score ?? '—'} suffix={finalScore?.deterministic_score != null ? '/100' : null} tone={scoreToneClass(finalScore?.deterministic_score)} />
                <LabMetric label="Composante IA" value={llmStatusFr(finalScore?.llm_status) || '—'} />
                <LabMetric label="Schéma" value={schema?.version != null ? `v${schema.version}` : '—'} suffix={schema?.name} />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <ClassificationCard classification={classification} />

                {dashboardReportingFields && (
                    <div className="rounded-lg border border-white/[0.05] bg-white/[0.015] p-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/45">Scores publiés aux tableaux de bord</div>
                        <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[11px] text-white/60">
                            <div>SEO : <span className="tabular-nums text-white/85">{dashboardReportingFields.seo_score ?? '—'}</span></div>
                            <div>GEO : <span className="tabular-nums text-white/85">{dashboardReportingFields.geo_score ?? '—'}</span></div>
                            <div>Hybride : <span className="tabular-nums text-white/85">{dashboardReportingFields.hybrid_score ?? '—'}</span></div>
                            <div>Type de site : <span className="font-mono text-white/85">{dashboardReportingFields.classification_type ?? '—'}</span></div>
                        </div>
                        <p className="mt-2 text-[10px] text-white/35">
                            Valeurs effectivement enregistrées et affichées côté tableaux de bord.
                        </p>
                    </div>
                )}
            </div>

            {normalizedEvidence && (
                <div className="mt-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/45">Informations extraites et normalisées</div>
                    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                        <EvidenceList label="Noms d'entreprise" items={normalizedEvidence.business_names} />
                        <EvidenceList label="Téléphones" items={normalizedEvidence.phones} />
                        <EvidenceList label="Emails" items={normalizedEvidence.emails} />
                        <EvidenceList label="Liens sociaux" items={normalizedEvidence.social_links} />
                        <EvidenceList label="Entités structurées" items={normalizedEvidence.schema_entities} />
                    </div>
                </div>
            )}

            {(subsystemScores || recommendations || target) && (
                <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
                    {subsystemScores && (
                        <div className="rounded-lg border border-white/[0.05] bg-white/[0.015] p-3">
                            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/45">Indicateurs des sous-systèmes</div>
                            <div className="mt-1.5 grid grid-cols-1 gap-1 text-[11px] text-white/60">
                                <div>Technique (couche 1) : <span className="tabular-nums text-white/85">{subsystemScores.layer1_raw_scan?.overall ?? '—'}</span></div>
                                <div>Experts (couche 2) : <span className="tabular-nums text-white/85">{subsystemScores.layer2_expert_summary?.summary_score ?? '—'}</span></div>
                                <div>Accessibilité aux robots : <span className="tabular-nums text-white/85">{subsystemScores.crawler_access_score ?? '—'}</span></div>
                            </div>
                            <p className="mt-2 text-[10px] text-white/35">Usage interne uniquement.</p>
                        </div>
                    )}

                    {recommendations && (
                        <div className="rounded-lg border border-white/[0.05] bg-white/[0.015] p-3">
                            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/45">Recommandations détectées</div>
                            <div className="mt-1.5 grid grid-cols-1 gap-1 text-[11px] text-white/60">
                                <div>Problèmes : <span className="tabular-nums text-white/85">{recommendations.issues_count ?? '—'}</span></div>
                                <div>Points forts : <span className="tabular-nums text-white/85">{recommendations.strengths_count ?? '—'}</span></div>
                                <div>Opportunités reliées : <span className="tabular-nums text-white/85">{Array.isArray(recommendations.opportunities_hooks) ? recommendations.opportunities_hooks.length : 0}</span></div>
                            </div>
                        </div>
                    )}

                    {target && (
                        <div className="rounded-lg border border-white/[0.05] bg-white/[0.015] p-3">
                            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/45">URL analysée</div>
                            <div className="mt-1.5 space-y-1 text-[11px] text-white/60">
                                <div className="truncate font-mono text-[10px]" title={target.source_url}>source : {target.source_url || '—'}</div>
                                <div className="truncate font-mono text-[10px]" title={target.resolved_url}>résolue : {target.resolved_url || '—'}</div>
                                <div className="truncate font-mono text-[10px]" title={target.audit_id}>audit : {target.audit_id || '—'}</div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="mt-4">
                <LabCollapsible label="Structure complète (JSON)" hint="Réservé à l'usage opérateur interne">
                    <JsonInspect value={canonical} maxHeight={480} />
                </LabCollapsible>
            </div>
        </LabCanonicalSection>
    );
}
