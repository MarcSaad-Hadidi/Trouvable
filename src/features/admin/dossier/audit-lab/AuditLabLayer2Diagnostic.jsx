'use client';

import { useMemo } from 'react';

import IssueQuickAction from '@/features/admin/shared/components/IssueQuickAction';

import {
    JsonInspect,
    LabCollapsible,
    LabDiagnosticSection,
    LabEmptyState,
    LabPill,
    LabSectionHeader,
} from './LabPrimitives';
import { getLayer2ViewModel } from './audit-lab-model';
import { humanizeCategoryKey, severityFr, severityTone } from './audit-lab-copy';

const SEVERITY_RANK = { high: 3, critical: 3, medium: 2, warn: 2, warning: 2, low: 1, info: 0 };

function sortFindings(findings) {
    return [...(findings || [])].sort((a, b) => {
        const sa = SEVERITY_RANK[String(a?.severity || '').toLowerCase()] ?? 0;
        const sb = SEVERITY_RANK[String(b?.severity || '').toLowerCase()] ?? 0;
        return sb - sa;
    });
}

function pluralize(n, singular, plural) {
    return `${n} ${n > 1 ? plural : singular}`;
}

/**
 * Produit un résumé opérateur court (1–2 phrases max) par module, à partir
 * des détails techniques renvoyés par le backend Layer 2. Le but est d'éviter
 * que l'opérateur doive lire du JSON brut pour comprendre où en est le site.
 */
function buildModuleSummary(key, data) {
    if (!data) return null;
    const details = data.details || {};

    switch (key) {
        case 'llms_txt_deep': {
            if (!details.found) return 'Aucun fichier /llms.txt exposé sur l’origine — les assistants IA n’ont pas de porte d’entrée dédiée.';
            const parts = [];
            if (details.h2_count) parts.push(pluralize(details.h2_count, 'section', 'sections'));
            if (details.links) parts.push(pluralize(details.links, 'lien', 'liens'));
            if (details.full_variant_found) parts.push('version llms-full.txt détectée');
            const tail = parts.length ? ` · ${parts.join(' · ')}` : '';
            return `Fichier llms.txt présent (${details.character_count || 0} caractères)${tail}.`;
        }
        case 'ai_discovery_endpoints': {
            const endpoints = Array.isArray(data.endpoints) ? data.endpoints : [];
            const found = endpoints.filter((entry) => entry.found).length;
            if (found === 0) return 'Aucun endpoint de découverte IA détecté. Ces points d’entrée restent optionnels mais utiles pour l’avenir.';
            return `${pluralize(found, 'endpoint IA détecté', 'endpoints IA détectés')} sur ${endpoints.length} testés.`;
        }
        case 'brand_entity': {
            const hasOrg = Boolean(details.has_organization_schema || details.has_local_business_schema);
            const sameAs = details.same_as_count || details.sameAs || 0;
            if (!hasOrg && (details.business_names_count || 0) === 0) return 'Pas d’entité de marque clairement déclarée. La visibilité IA reposera sur les indices textuels seuls.';
            const parts = [];
            parts.push(hasOrg ? 'Entité Organization/LocalBusiness déclarée' : 'Pas de schéma Organization détecté');
            if (sameAs) parts.push(`${pluralize(sameAs, 'référence sameAs', 'références sameAs')}`);
            if (details.has_about_page && details.has_contact_page) parts.push('pages À propos + Contact présentes');
            return `${parts.join(' · ')}.`;
        }
        case 'trust_stack': {
            const elements = [];
            if (details.proof_terms >= 3) elements.push('preuves sociales fortes');
            else if (details.proof_terms > 0) elements.push('preuves sociales faibles');
            else elements.push('pas de preuves sociales détectées');
            if (details.review_terms >= 1 || details.structured_review_schema) elements.push('mentions d’avis');
            if ((details.social_profile_urls || 0) >= 2) elements.push(`${details.social_profile_urls} profils sociaux`);
            return `${elements.join(' · ')}.`;
        }
        case 'negative_signals': {
            const injection = Number(details.prompt_injection_matches || 0);
            const blocking = Number(details.ai_blocking_directive_pages || 0);
            const cloaked = Boolean(details.potential_cloaking);
            const bits = [];
            if (injection) bits.push(`${injection} motif(s) d’injection IA`);
            if (blocking) bits.push(`${blocking} page(s) bloquent l’IA`);
            if (cloaked) bits.push('contenus dissimulés suspects');
            if (bits.length === 0) return 'Aucun signal négatif notable (injections, blocages IA, cloaking).';
            return bits.join(' · ');
        }
        default:
            return data.summary || null;
    }
}

const MODULE_META = {
    llms_txt_deep: {
        label: 'llms.txt — qualité du fichier IA',
        hint: 'Structure, liens internes et sections attendues du fichier d’entrée IA.',
    },
    ai_discovery_endpoints: {
        label: 'Découverte IA',
        hint: 'Endpoints optionnels (/ai.txt, /ai/summary.json…) qu’un assistant IA peut sonder.',
    },
    brand_entity: {
        label: 'Marque et entité',
        hint: 'Nom, schémas Organization/LocalBusiness, références sameAs, pages identité.',
    },
    trust_stack: {
        label: 'Signaux de confiance',
        hint: 'Preuves sociales, avis, présence publique, pages À propos / Contact.',
    },
    negative_signals: {
        label: 'Signaux négatifs',
        hint: 'Blocages IA explicites, injections de prompt, cloaking potentiel.',
    },
};

function ModuleCard({ moduleKey, label, data, clientId }) {
    const findings = useMemo(() => sortFindings(Array.isArray(data?.findings) ? data.findings : []), [data]);
    const summary = useMemo(() => buildModuleSummary(moduleKey, data), [moduleKey, data]);
    const meta = MODULE_META[moduleKey] || { label };

    const topFindings = findings.slice(0, 3);
    const extraFindings = findings.slice(3);
    const score = typeof data?.score === 'number' ? data.score : null;
    const highCount = findings.filter((f) => ['high', 'critical'].includes(String(f?.severity || '').toLowerCase())).length;

    return (
        <div className="flex flex-col rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-white/90">{meta.label || label}</div>
                    {meta.hint && <div className="mt-0.5 text-[10px] leading-relaxed text-white/40">{meta.hint}</div>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                    {highCount > 0 && <LabPill label={`${highCount} gravité élevée`} tone="bad" />}
                    {score != null && (
                        <div className="text-right">
                            <div className="text-[11px] font-semibold tabular-nums text-white/70">{score}<span className="text-[9px] text-white/25">/100</span></div>
                            <div className="text-[9px] uppercase tracking-wider text-white/25">indicateur interne</div>
                        </div>
                    )}
                </div>
            </div>

            {summary && (
                <p className="mt-2.5 text-[11.5px] leading-relaxed text-white/65">{summary}</p>
            )}

            {topFindings.length > 0 && (
                <div className="mt-3 space-y-1">
                    {topFindings.map((finding, index) => {
                        const severityLabel = severityFr(finding.severity) || 'Info';
                        const tone = severityTone(finding.severity);
                        const findingText = finding.message || finding.title || finding.label || humanizeCategoryKey(finding.id || 'point');
                        const isActionable = tone === 'bad' || tone === 'warn';
                        const problemRef = isActionable && clientId && finding.id
                            ? {
                                source: 'lab_layer2_finding',
                                clientId,
                                findingId: `${moduleKey}:${finding.id}`,
                                layer: 'layer2',
                                category: moduleKey,
                                label: findingText.slice(0, 80),
                            }
                            : null;
                        return (
                            <div
                                key={`${finding.id || 'finding'}-${index}`}
                                className="rounded-md border border-white/[0.05] bg-white/[0.015] px-2.5 py-1.5"
                            >
                                <div className="flex items-start gap-1.5">
                                    <LabPill label={severityLabel} tone={tone} />
                                    <span className="flex-1 text-[11px] leading-snug text-white/75">
                                        {findingText}
                                    </span>
                                    {problemRef ? (
                                        <IssueQuickAction problemRef={problemRef} label="Prompt" size="xs" variant="primary" />
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {findings.length === 0 && (
                <p className="mt-3 rounded-md border border-emerald-400/15 bg-emerald-400/[0.04] px-2.5 py-1.5 text-[11px] text-emerald-200/85">
                    Aucun point à traiter sur ce module.
                </p>
            )}

            {(extraFindings.length > 0 || data) && (
                <div className="mt-auto pt-3">
                    <LabCollapsible
                        label={extraFindings.length > 0 ? `Voir les autres points (${extraFindings.length}) et données brutes` : 'Voir les données brutes du module'}
                        hint="Diagnostic technique"
                    >
                        {extraFindings.length > 0 && (
                            <div className="mb-3 space-y-1">
                                {extraFindings.map((finding, index) => {
                                    const severityLabel = severityFr(finding.severity) || 'Info';
                                    const tone = severityTone(finding.severity);
                                    return (
                                        <div
                                            key={`${finding.id || 'extra-finding'}-${index}`}
                                            className="rounded-md border border-white/[0.04] bg-white/[0.01] px-2.5 py-1.5"
                                        >
                                            <div className="flex items-start gap-1.5">
                                                <LabPill label={severityLabel} tone={tone} />
                                                <span className="text-[11px] leading-snug text-white/65">
                                                    {finding.message || finding.title || finding.label || humanizeCategoryKey(finding.id || 'point')}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <JsonInspect value={data} maxHeight={220} />
                    </LabCollapsible>
                </div>
            )}
        </div>
    );
}

/**
 * Section C — Enrichissements experts GEO (couche 2).
 *
 * Cinq modules spécialisés ; chaque carte donne un résumé opérateur et les
 * points principaux. Les données techniques et les findings secondaires
 * vivent dans un panneau replié pour ne pas polluer la lecture.
 */
export default function AuditLabLayer2Diagnostic({ audit, clientId = null }) {
    const model = getLayer2ViewModel(audit);

    if (!model.hasAny) {
        return (
            <LabDiagnosticSection ribbon={false}>
                <LabSectionHeader
                    eyebrow="Section D · Enrichissements experts GEO"
                    title="Aucun enrichissement expert"
                    subtitle="Les modules spécialisés (llms.txt, découverte IA, marque, confiance, signaux négatifs) ne sont pas disponibles sur ce dernier audit."
                    variant="diagnostic"
                />
                <LabEmptyState
                    title="Couche experte indisponible"
                    description="Cet audit n'a pas été exécuté avec le pipeline complet, ou les modules experts n'ont pas été persistés. Le score Trouvable reste valide sans ces enrichissements."
                />
            </LabDiagnosticSection>
        );
    }

    const counts = model.summary?.finding_counts || null;
    const totalFindings = model.modules.reduce((acc, m) => acc + (Array.isArray(m.data?.findings) ? m.data.findings.length : 0), 0);
    const highFindings = model.modules.reduce((acc, m) => (
        acc + (Array.isArray(m.data?.findings) ? m.data.findings.filter((f) => ['high', 'critical'].includes(String(f?.severity || '').toLowerCase())).length : 0)
    ), 0);

    return (
        <LabDiagnosticSection ribbon={false}>
            <LabSectionHeader
                eyebrow="Section D · Enrichissements experts GEO"
                title="Modules spécialisés — analyse IA"
                subtitle="Chaque module se concentre sur un signal utile aux moteurs IA. Les indicateurs affichés sont internes : ils aident l'opérateur, ils ne remplacent pas le score Trouvable."
                variant="diagnostic"
                right={<LabPill label="diagnostic interne" tone="warn" />}
            />

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">Modules exécutés</div>
                    <div className="mt-1 text-lg font-extrabold tabular-nums text-white/85">{model.modules.length}</div>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">Points relevés</div>
                    <div className="mt-1 text-lg font-extrabold tabular-nums text-white/85">{counts?.total ?? totalFindings}</div>
                </div>
                <div className="rounded-xl border border-red-400/15 bg-red-400/[0.03] px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-red-300/70">Gravité élevée</div>
                    <div className="mt-1 text-lg font-extrabold tabular-nums text-red-300/90">{counts?.high ?? highFindings}</div>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {model.modules.map((module) => (
                    <ModuleCard key={module.key} moduleKey={module.key} label={module.label} data={module.data} clientId={clientId || audit?.client_id || null} />
                ))}
            </div>
        </LabDiagnosticSection>
    );
}
