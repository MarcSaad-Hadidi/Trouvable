'use client';

import { toArray, Pill } from './audit-helpers';

export default function AuditSiteProfile({ audit }) {
    const breakdown = audit?.geo_breakdown?.dimensions ? audit.geo_breakdown : audit?.seo_breakdown?.dimensions ? audit.seo_breakdown : null;
    const sc = breakdown?.site_classification;
    const aiAnalysis = audit?.geo_breakdown?.ai_analysis || null;
    if (!sc) return null;

    const reasons = toArray(sc.reasons);
    const evidence = toArray(sc.evidence_summary);
    const services = toArray(aiAnalysis?.detected_services);
    const areas = toArray(aiAnalysis?.detected_areas);

    return (
        <div className="cmd-surface-elevated p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-violet-300/60">Profil de site détecté</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3">
                        <span className="text-lg font-bold text-white/95">{sc.label}</span>
                        <Pill label={`Confiance : ${sc.confidence || 'faible'}`} tone="bg-white/[0.05] text-white/60 border-white/10" />
                    </div>
                    {reasons.length > 0 && (
                        <p className="mt-2.5 text-[12px] text-white/55 leading-relaxed">
                            Profil identifié via : {reasons.map((r) => r.label || r).join(', ')}
                        </p>
                    )}
                    {evidence.length > 0 && (
                        <div className="mt-3 border-l-2 border-violet-400/30 pl-3">
                            <div className="text-[10px] font-bold uppercase text-white/30 mb-1.5">Preuves</div>
                            <ul className="space-y-0.5">
                                {evidence.map((e, i) => (
                                    <li key={i} className="text-[11px] text-white/50">• {e}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            {(services.length > 0 || areas.length > 0) && (
                <div className="mt-4 flex flex-wrap gap-4 border-t border-white/[0.06] pt-4">
                    {services.length > 0 && (
                        <div>
                            <div className="text-[10px] font-bold uppercase text-white/30">Services détectés</div>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {services.slice(0, 6).map((s) => (
                                    <span key={s} className="rounded-md border border-white/[0.10] bg-white/[0.05] px-2.5 py-1 text-[11px] text-white/65">{s}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    {areas.length > 0 && (
                        <div>
                            <div className="text-[10px] font-bold uppercase text-white/30">Zones géographiques</div>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {areas.slice(0, 6).map((a) => (
                                    <span key={a} className="rounded-md border border-white/[0.10] bg-white/[0.05] px-2.5 py-1 text-[11px] text-white/65">{a}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {aiAnalysis?.detected_business_name && (
                <div className="mt-3 text-xs text-white/50">
                    Nom d&apos;entreprise détecté : <span className="font-semibold text-white/75">{aiAnalysis.detected_business_name}</span>
                </div>
            )}
        </div>
    );
}
